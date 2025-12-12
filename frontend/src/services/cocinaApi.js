// API de Cocina - Gestión de pedidos y cola de cocina
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

/**
 * Obtener token de autenticación
 */
function getAuthToken() {
  return localStorage.getItem('token');
}

/**
 * Headers con autenticación
 */
function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Token ${token}` })
  };
}

// Tiempo máximo para esperar respuestas de la API (ms)
// NOTA: 30s temporal mientras se optimiza la actualización de disponibilidad en backend
const DEFAULT_TIMEOUT = 30000;

/**
 * fetch con timeout para evitar que el frontend quede bloqueado si el backend no responde
 * @param {string} url
 * @param {Object} options
 * @param {number} timeoutMs
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La solicitud está tardando demasiado. Intenta nuevamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Manejar errores de respuesta
 */
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    // Extraer mensaje de error de múltiples formatos posibles
    let errorMessage = error.detail
      || error.error
      || error.message
      || (error.detalles && JSON.stringify(error.detalles))
      || `Error ${response.status}: ${response.statusText}`;

    // Log detallado del error para debugging
    console.error('API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      errorBody: error
    });

    throw new Error(errorMessage);
  }
  const data = await response.json().catch(() => null);
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data.results;
  }
  // Respuestas vacías (204) o sin body
  if (data === null) return [];
  return data;
}

// ==================== ESTADOS DE PEDIDO ====================

export const ESTADOS_PEDIDO = {
  CREADO: { label: 'Creado', color: 'secondary', icon: 'bi-clock' },
  URGENTE: { label: 'Urgente', color: 'danger', icon: 'bi-exclamation-triangle' },
  EN_PREPARACION: { label: 'En preparación', color: 'warning', icon: 'bi-fire' },
  LISTO: { label: 'Listo', color: 'success', icon: 'bi-check-lg' },
  ENTREGADO: { label: 'Entregado', color: 'info', icon: 'bi-check-circle' },
  CANCELADO: { label: 'Cancelado', color: 'dark', icon: 'bi-x-circle' },
};

// Transiciones válidas por rol (sincronizadas con roles reales del sistema)
export const TRANSICIONES_POR_ROL = {
  admin: '*', // Admin tiene todas las transiciones
  cajero: {
    // Cajero coordina toda la operación de cocina
    CREADO: ['EN_PREPARACION', 'URGENTE', 'CANCELADO'],
    URGENTE: ['EN_PREPARACION', 'CANCELADO'],
    EN_PREPARACION: ['LISTO', 'CANCELADO'],
    LISTO: ['ENTREGADO', 'CANCELADO'],
  },
  mesero: {
    // Mesero entrega pedidos y puede cancelar antes de preparación
    LISTO: ['ENTREGADO', 'CANCELADO'],
    CREADO: ['CANCELADO'],
    URGENTE: ['CANCELADO'],
  },
  cliente: {
    // Cliente no puede cambiar estados (solo visualizar)
  },
};

/**
 * Verificar si un rol puede hacer una transición
 */
export function puedeTransicionar(rol, estadoActual, nuevoEstado) {
  if (rol === 'admin') return true;

  const transiciones = TRANSICIONES_POR_ROL[rol];
  if (!transiciones) return false;

  const permitidas = transiciones[estadoActual];
  return permitidas && permitidas.includes(nuevoEstado);
}

// ==================== PEDIDOS ====================

/**
 * Listar pedidos con filtros
 * @param {Object} filtros - { estado, mesa, fecha }
 */
export async function getPedidos(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.estado) params.append('estado', filtros.estado);
  if (filtros.mesa) params.append('mesa', filtros.mesa);
  if (filtros.fecha) params.append('fecha', filtros.fecha);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/cocina/pedidos/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Obtener detalle de un pedido
 */
export async function getPedido(id) {
  const response = await fetch(`${API_BASE_URL}/cocina/pedidos/${id}/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Crear nuevo pedido
 * @param {Object} data - { mesa, reserva?, notas?, detalles: [{plato, cantidad, notas?}] }
 */
export async function crearPedido(data) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/cocina/pedidos/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Actualizar pedido (solo notas)
 */
export async function actualizarPedido(id, data) {
  const response = await fetch(`${API_BASE_URL}/cocina/pedidos/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Cambiar estado de un pedido
 * @param {number} id - ID del pedido
 * @param {string} nuevoEstado - Nuevo estado
 */
export async function cambiarEstadoPedido(id, nuevoEstado) {
  const response = await fetch(`${API_BASE_URL}/cocina/pedidos/${id}/estado/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ estado: nuevoEstado })
  });
  return handleResponse(response);
}

/**
 * Cancelar pedido (atajo para cambiar a CANCELADO)
 * @param {number} id - ID del pedido
 * @param {string} motivo - Motivo de cancelación (opcional)
 */
export async function cancelarPedido(id, motivo = '') {
  const body = { estado: 'CANCELADO' };
  // Solo agregar motivo si se proporciona
  if (motivo && motivo.trim()) {
    body.motivo = motivo.trim();
  }

  const response = await fetch(`${API_BASE_URL}/cocina/pedidos/${id}/estado/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });
  return handleResponse(response);
}

// ==================== COLA DE COCINA ====================

/**
 * Obtener cola de pedidos pendientes/en preparación
 * @param {Object} opciones - { estados, mesa, ultimas_horas, ordering }
 */
export async function getColaCocina(opciones = {}) {
  const params = new URLSearchParams();

  // Filtrar por estados (default: cola de cocina)
  const estadosDefecto = ['CREADO', 'URGENTE', 'EN_PREPARACION'];
  const estados = opciones.estados || estadosDefecto;
  estados.forEach(e => params.append('estado', e));

  // Otros filtros opcionales (solo agregar si tienen valor)
  if (opciones.mesa) params.append('mesa', opciones.mesa);

  // ultimas_horas: convertir a número si viene como string del select
  if (opciones.ultimas_horas) {
    const horas = typeof opciones.ultimas_horas === 'string'
      ? parseInt(opciones.ultimas_horas, 10)
      : opciones.ultimas_horas;
    params.append('ultimas_horas', horas);
  }

  // ordering: solo enviar si tiene valor (no cadena vacía)
  if (opciones.ordering && opciones.ordering !== '') {
    params.append('ordering', opciones.ordering);
  }

  const queryString = params.toString();
  const url = `${API_BASE_URL}/cocina/pedidos/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Obtener solo pedidos urgentes
 */
export async function getPedidosUrgentes() {
  const response = await fetch(`${API_BASE_URL}/cocina/cola/urgentes/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Obtener pedidos LISTO (meseros)
 * @param {Object} opciones - { page, page_size, mesa, ordering, busqueda }
 */
export async function getPedidosListos(opciones = {}) {
  const params = new URLSearchParams();
  if (opciones.page) params.append('page', opciones.page);
  if (opciones.page_size) params.append('page_size', opciones.page_size);
  if (opciones.mesa) params.append('mesa', opciones.mesa);
  if (opciones.ordering) params.append('ordering', opciones.ordering);
  if (opciones.busqueda) params.append('busqueda', opciones.busqueda);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/cocina/pedidos/listos/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || `Error ${response.status}`);
  }

  return {
    results: data.results || data,
    count: data.count,
    next: data.next,
    previous: data.previous
  };
}

/**
 * Obtener pedidos ENTREGADOS del día
 * @param {Object} opciones - { page, page_size, fecha, mesa, ordering, busqueda }
 */
export async function getPedidosEntregados(opciones = {}) {
  const params = new URLSearchParams();
  if (opciones.page) params.append('page', opciones.page);
  if (opciones.page_size) params.append('page_size', opciones.page_size);
  if (opciones.fecha) params.append('fecha', opciones.fecha);
  if (opciones.mesa) params.append('mesa', opciones.mesa);
  if (opciones.ordering) params.append('ordering', opciones.ordering);
  if (opciones.busqueda) params.append('busqueda', opciones.busqueda);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/cocina/pedidos/entregados/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || `Error ${response.status}`);
  }

  return {
    results: data.results || data,
    count: data.count,
    next: data.next,
    previous: data.previous
  };
}

// ==================== ESTADÍSTICAS ====================

/**
 * Obtener tiempos promedio de preparación
 */
export async function getEstadisticasTiempos() {
  const response = await fetch(`${API_BASE_URL}/cocina/estadisticas/tiempos/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Obtener resumen de pedidos del día
 */
export async function getResumenDia() {
  const response = await fetch(`${API_BASE_URL}/cocina/estadisticas/resumen/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ==================== PEDIDOS POR MESA ====================

/**
 * Obtener pedidos activos de una mesa específica
 */
export async function getPedidosMesa(mesaId) {
  const response = await fetch(`${API_BASE_URL}/cocina/pedidos/?mesa=${mesaId}`, {
    headers: getAuthHeaders()
  });
  const data = await handleResponse(response);
  // Filtrar solo pedidos activos (no entregados ni cancelados)
  return data.filter(p => !['ENTREGADO', 'CANCELADO'].includes(p.estado));
}

/**
 * Obtener pedidos de una reserva específica
 */
export async function getPedidosReserva(reservaId) {
  const response = await fetch(`${API_BASE_URL}/cocina/pedidos/?reserva=${reservaId}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ==================== PEDIDOS CANCELADOS ====================

/**
 * Obtener pedidos CANCELADOS con filtros de auditoría
 * @param {Object} opciones - { page, page_size, periodo, fecha, usuario, busqueda, ordering }
 */
export async function getPedidosCancelados(opciones = {}) {
  const params = new URLSearchParams();
  if (opciones.page) params.append('page', opciones.page);
  if (opciones.page_size) params.append('page_size', opciones.page_size);
  if (opciones.periodo) params.append('periodo', opciones.periodo);
  if (opciones.fecha) params.append('fecha', opciones.fecha);
  if (opciones.usuario) params.append('usuario', opciones.usuario);
  if (opciones.busqueda) params.append('busqueda', opciones.busqueda);
  if (opciones.ordering) params.append('ordering', opciones.ordering);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/cocina/pedidos/cancelados/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || `Error ${response.status}`);
  }

  // Mapear estructura paginada igual que getPedidosListos
  return {
    results: data.results || data,
    count: data.count,
    next: data.next,
    previous: data.previous
  };
}

// ==================== ESTADÍSTICAS DE CANCELACIONES ====================

/**
 * Obtener estadísticas de pedidos cancelados
 * @param {string} periodo - 'dia' | 'semana' | 'mes'
 */
export async function getEstadisticasCancelaciones(periodo = 'dia') {
  const response = await fetch(
    `${API_BASE_URL}/cocina/estadisticas/cancelaciones/?periodo=${periodo}`,
    {
      headers: getAuthHeaders()
    }
  );
  return handleResponse(response);
}
