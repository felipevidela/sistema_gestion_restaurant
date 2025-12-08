// Configuración de la API
// En desarrollo: http://localhost:8000/api
// En producción: mismo dominio (Railway sirve backend + frontend)
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

/**
 * Formatear hora a formato militar de 24 horas (HH:MM)
 * @param {string} time - Hora en formato HH:MM:SS o HH:MM
 * @returns {string} - Hora en formato HH:MM
 */
function formatearHora24(time) {
  if (!time) return '';
  // Si viene con segundos (HH:MM:SS), quitarlos
  return time.substring(0, 5);
}

/**
 * Obtener el token de autenticación del localStorage
 */
function getAuthToken() {
  return localStorage.getItem('token');
}

/**
 * Obtener headers con autenticación
 */
function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Token ${token}` })
  };
}

/**
 * Registrar nuevo usuario
 * @param {Object} userData - {username, email, password, password_confirm, nombre_completo, rut, telefono, email_perfil}
 * @returns {Object} - {token, user_id, username, email, rol, rol_display, nombre_completo, message}
 */
export async function register(userData) {
  const response = await fetch(`${API_BASE_URL}/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    // Formatear errores del backend
    if (typeof error === 'object' && !error.error) {
      const errorMessages = Object.entries(error)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
        .join('\n');
      throw new Error(errorMessages);
    }
    throw new Error(error.error || error.message || 'Error al registrar usuario');
  }

  const data = await response.json();

  // Guardar token y datos de usuario en localStorage (auto-login)
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify({
    id: data.user_id,
    username: data.username,
    email: data.email,
    rol: data.rol,
    rol_display: data.rol_display,
    nombre_completo: data.nombre_completo
  }));

  return data;
}

/**
 * Registrar usuario y crear reserva en una sola operación
 * @param {Object} data - Datos de usuario y reserva combinados
 * @returns {Object} - {token, user_id, username, email, rol, nombre_completo, reserva, message}
 */
export async function registerAndReserve(data) {
  const response = await fetch(`${API_BASE_URL}/register-and-reserve/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  // FIX #231: Manejar respuesta con requires_confirmation
  const responseData = await response.json();

  // Si el backend solicita confirmación (status 200 con requires_confirmation)
  if (response.status === 200 && responseData.requires_confirmation) {
    // Retornar datos para que el frontend muestre modal de confirmación
    return responseData;
  }

  // Para otros casos de error
  if (!response.ok) {
    // Formatear errores del backend
    if (responseData.details) {
      const errorMessages = Object.entries(responseData.details)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
        .join('\n');
      throw new Error(errorMessages || responseData.error);
    }
    throw new Error(responseData.error || 'Error al crear la reserva');
  }

  // Guardar token y datos de usuario en localStorage (auto-login) solo si la reserva fue creada
  if (responseData.token) {
    localStorage.setItem('token', responseData.token);
    localStorage.setItem('user', JSON.stringify({
      id: responseData.user_id,
      username: responseData.username,
      email: responseData.email,
      rol: responseData.rol,
      rol_display: responseData.rol_display,
      nombre_completo: responseData.nombre_completo
    }));
  }

  return responseData;
}

/**
 * Login de usuario
 * @param {Object} credentials - {username, password}
 * @returns {Object} - {token, user_id, username, email, rol, rol_display, nombre_completo}
 */
export async function login({ username, password }) {
  const response = await fetch(`${API_BASE_URL}/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al iniciar sesión');
  }

  const data = await response.json();

  // Guardar token y datos de usuario en localStorage
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify({
    id: data.user_id,
    username: data.username,
    email: data.email,
    rol: data.rol,
    rol_display: data.rol_display,
    nombre_completo: data.nombre_completo
  }));

  return data;
}

/**
 * Logout de usuario
 */
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Obtener usuario actual del localStorage
 */
export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Verificar si el usuario está autenticado
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Obtener reservas con filtros opcionales
 * @param {Object} params - {fecha, estado, fecha_inicio, fecha_fin, search, page, page_size}
 * @param {string} params.search - Búsqueda por cliente (nombre, username, email)
 * @param {Object} options - { fetchAllPages?: boolean }
 * @returns {Array} - Lista de reservas
 */
export async function getReservas(params = {}, options = {}) {
  const {
    fecha,
    estado,
    fecha_inicio,
    fecha_fin,
    fechaInicio,
    fechaFin,
    page,
    page_size,
    pageSize,
    search,  // Búsqueda por cliente (username, nombre, email)
    all,     // Búsqueda global en todo el historial
  } = params;

  const { fetchAllPages = true } = options;

  const searchParams = new URLSearchParams();

  if (fecha === 'today') {
    searchParams.append('date', 'today');
  } else if (fecha) {
    searchParams.append('fecha_reserva', fecha);
  }

  const fechaInicioValue = fecha_inicio || fechaInicio;
  const fechaFinValue = fecha_fin || fechaFin;

  if (fechaInicioValue) {
    searchParams.append('fecha_inicio', fechaInicioValue);
  }

  if (fechaFinValue) {
    searchParams.append('fecha_fin', fechaFinValue);
  }

  if (estado && estado !== 'TODOS') {
    searchParams.append('estado', estado.toLowerCase());
  }

  // Búsqueda por cliente (username, nombre, email)
  if (search && search.trim() !== '') {
    searchParams.append('search', search.trim());
  }

  // Búsqueda global en todo el historial (sin límite de fecha)
  if (all === 'true' || all === true) {
    searchParams.append('all', 'true');
  }

  if (page) {
    searchParams.append('page', page);
  }

  if (page_size || pageSize) {
    searchParams.append('page_size', page_size || pageSize);
  }

  const baseUrl = `${API_BASE_URL}/reservas/`;
  const initialUrl = `${baseUrl}?${searchParams.toString()}`;

  const fetchPage = async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener reservas');
    }

    return response.json();
  };

  const normalizeUrl = (url) => {
    if (!url) return null;

    // Si ya es una URL completa, verificar y corregir protocolo
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Forzar HTTPS si estamos en producción
      if (import.meta.env.PROD && url.startsWith('http://')) {
        return url.replace('http://', 'https://');
      }
      return url;
    }

    // URLs relativas
    if (url.startsWith('/')) {
      return `${API_BASE_URL}${url}`;
    }
    return `${API_BASE_URL}/${url}`;
  };

  let nextUrl = initialUrl;
  const todasLasReservas = [];

  do {
    const data = await fetchPage(nextUrl);
    const reservasPage = Array.isArray(data.results) ? data.results : data;
    todasLasReservas.push(...reservasPage);

    if (!fetchAllPages || !data.next) {
      nextUrl = null;
    } else {
      nextUrl = normalizeUrl(data.next);
    }
  } while (nextUrl);

  return todasLasReservas.map(reserva => {
    const nombreNormalizado =
      (reserva.cliente_nombre_completo && reserva.cliente_nombre_completo.trim() !== '')
        ? reserva.cliente_nombre_completo
        : (reserva.cliente_nombre && reserva.cliente_nombre.trim() !== '')
          ? reserva.cliente_nombre
          : reserva.cliente_username;

    return {
      id: reserva.id,
      cliente: nombreNormalizado || 'Sin nombre',
      cliente_telefono: reserva.cliente_telefono,
      cliente_email: reserva.cliente_email,
      cliente_rut: reserva.cliente_rut,
      mesa: `M${String(reserva.mesa_numero).padStart(2, '0')}`,
      fecha: reserva.fecha_reserva,
      hora: formatearHora24(reserva.hora_inicio),
      personas: reserva.num_personas,
      estado: reserva.estado.toUpperCase(),
      notas: reserva.notas || '',
    };
  });
}

/**
 * Actualizar el estado de una reserva
 * @param {Object} params - {id: number, nuevoEstado: string}
 * @returns {Object} - Reserva actualizada
 */
export async function updateEstadoReserva({ id, nuevoEstado }) {
  const response = await fetch(
    `${API_BASE_URL}/reservas/${id}/cambiar_estado/`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ estado: nuevoEstado.toLowerCase() }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al actualizar estado de la reserva');
  }

  return response.json();
}

/**
 * Actualizar una reserva completa
 * @param {Object} params - {id: number, reservaData: Object}
 * @returns {Object} - Reserva actualizada
 */
export async function updateReserva({ id, reservaData }) {
  const response = await fetch(
    `${API_BASE_URL}/reservas/${id}/`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(reservaData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Error del backend:', error);
    const errorMsg = error.detail || error.error || JSON.stringify(error) || 'Error al actualizar reserva';
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Crear una nueva reserva
 * @param {Object} reservaData - {mesa, fecha_reserva, hora_inicio, hora_fin, num_personas, notas}
 * @returns {Object} - Reserva creada
 */
export async function createReserva(reservaData) {
  const response = await fetch(`${API_BASE_URL}/reservas/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(reservaData),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Error del backend:', error);
    const errorMsg = error.detail || JSON.stringify(error) || 'Error al crear reserva';
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Obtener horas disponibles para una fecha y número de personas
 * @param {Object} params - {fecha: string (YYYY-MM-DD), personas: number}
 * @returns {Object} - {horas_disponibles: Array, horas_no_disponibles: Array, ...}
 */
export async function getHorasDisponibles({ fecha, personas = 1 } = {}) {
  const params = new URLSearchParams();
  if (fecha) params.append('fecha', fecha);
  if (personas) params.append('personas', personas.toString());

  const response = await fetch(
    `${API_BASE_URL}/horas-disponibles/?${params.toString()}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener horas disponibles');
  }

  return response.json();
}

/**
 * Obtener todas las mesas
 * @param {Object} params - {estado: string, fecha: string, hora: string} (opcional)
 * @returns {Array} - Lista de mesas
 */
export async function getMesas({ estado, fecha, hora } = {}) {
  const params = new URLSearchParams();
  if (estado) params.append('estado', estado);
  if (fecha) params.append('fecha', fecha);
  if (hora) params.append('hora', hora);

  const response = await fetch(
    `${API_BASE_URL}/consultar-mesas/?${params.toString()}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener mesas');
  }

  return response.json();
}

/**
 * Actualizar el estado de una mesa
 * @param {Object} params - {id: number, nuevoEstado: string}
 * @returns {Object} - Mesa actualizada
 */
export async function updateEstadoMesa({ id, nuevoEstado }) {
  const response = await fetch(
    `${API_BASE_URL}/mesas/${id}/`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ estado: nuevoEstado }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al actualizar estado de la mesa');
  }

  return response.json();
}

/**
 * Obtener todos los usuarios del sistema (solo Admin)
 * @returns {Array} - Lista de usuarios con sus perfiles
 */
export async function listarUsuarios() {
  const response = await fetch(`${API_BASE_URL}/usuarios/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al obtener usuarios');
  }

  return response.json();
}

/**
 * Cambiar el rol de un usuario (solo Admin)
 * @param {Object} params - {userId: number, nuevoRol: string}
 * @returns {Object} - Usuario actualizado
 */
export async function cambiarRolUsuario({ userId, nuevoRol }) {
  const response = await fetch(
    `${API_BASE_URL}/usuarios/${userId}/cambiar-rol/`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rol: nuevoRol }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al cambiar rol del usuario');
  }

  return response.json();
}

/**
 * Cancelar una reserva (eliminar)
 * @param {number} reservaId - ID de la reserva a cancelar
 */
export async function cancelarReserva(reservaId) {
  const response = await fetch(
    `${API_BASE_URL}/reservas/${reservaId}/`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al cancelar reserva');
  }

  return true;
}

/**
 * Obtener el perfil del usuario autenticado
 * @returns {Object} - Datos del perfil (nombre_completo, telefono, rut, email, rol, etc.)
 */
export async function getPerfil() {
  const response = await fetch(`${API_BASE_URL}/perfil/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener perfil');
  }

  return response.json();
}

/**
 * Actualizar el perfil del usuario autenticado
 * @param {Object} perfilData - {nombre, apellido, telefono, rut}
 * @returns {Object} - {success: true, message: string, perfil: Object}
 */
export async function updatePerfil(perfilData) {
  const response = await fetch(`${API_BASE_URL}/perfil/actualizar/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(perfilData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al actualizar perfil');
  }

  const data = await response.json();

  // Actualizar localStorage con el nuevo nombre_completo
  if (data.success && data.perfil) {
    const user = getCurrentUser();
    if (user) {
      user.nombre_completo = data.perfil.nombre_completo;
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  return data;
}

// ============ FUNCIONES PARA USUARIOS INVITADOS ============

/**
 * Verificar si un token de invitado es válido
 * @param {string} token - Token único del invitado
 * @returns {Object} - {valido, email, nombre_completo, es_invitado, token_usado, expira}
 */
export async function verificarTokenInvitado(token) {
  const response = await fetch(`${API_BASE_URL}/verificar-token/${token}/`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al verificar token');
  }

  return response.json();
}

/**
 * Ver reserva de un invitado usando su token
 * @param {string} token - Token único del invitado
 * @returns {Object} - {reserva, cliente, es_invitado, puede_activar_cuenta}
 */
export async function verReservaInvitado(token) {
  const response = await fetch(`${API_BASE_URL}/reserva-invitado/${token}/`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al cargar reserva');
  }

  return response.json();
}

/**
 * Cancelar reserva de un invitado usando su token
 * @param {string} token - Token único del invitado
 * @returns {Object} - {success, message, reserva_cancelada}
 */
export async function cancelarReservaInvitado(token) {
  const response = await fetch(`${API_BASE_URL}/reserva-invitado/${token}/cancelar/`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al cancelar reserva');
  }

  return response.json();
}

/**
 * Activar cuenta de un invitado estableciendo contraseña
 * @param {Object} data - {token, password, password_confirm}
 * @returns {Object} - {success, message, token, user_id, username, email, rol, nombre_completo}
 */
export async function activarCuentaInvitado(data) {
  const response = await fetch(`${API_BASE_URL}/activar-cuenta/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al activar cuenta');
  }

  return response.json();
}

// ============ BLOQUEOS DE MESAS ============

/**
 * Listar todos los bloqueos de mesas
 * @param {Object} filters - Filtros opcionales: { mesa_numero, activo, categoria, solo_activos, activos_en_fecha }
 * @returns {Array} - Lista de bloqueos
 */
export async function listarBloqueos(filters = {}) {
  const queryParams = new URLSearchParams();

  if (filters.mesa_numero) queryParams.append('mesa_numero', filters.mesa_numero);
  if (filters.activo !== undefined) queryParams.append('activo', filters.activo);
  if (filters.categoria) queryParams.append('categoria', filters.categoria);
  if (filters.solo_activos) queryParams.append('solo_activos', 'true');
  if (filters.activos_en_fecha) queryParams.append('activos_en_fecha', filters.activos_en_fecha);

  const url = `${API_BASE_URL}/bloqueos/?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.detail || 'Error al listar bloqueos');
  }

  const data = await response.json();
  // El backend retorna un objeto de paginación, extraer el array de results
  return data.results || data;
}

/**
 * Obtener detalle de un bloqueo específico
 * @param {number} bloqueoId - ID del bloqueo
 * @returns {Object} - Detalles del bloqueo
 */
export async function obtenerBloqueo(bloqueoId) {
  const response = await fetch(`${API_BASE_URL}/bloqueos/${bloqueoId}/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener bloqueo');
  }

  return response.json();
}

/**
 * Crear un nuevo bloqueo de mesa
 * @param {Object} bloqueoData - Datos del bloqueo
 * @returns {Object} - Bloqueo creado
 */
export async function crearBloqueo(bloqueoData) {
  const response = await fetch(`${API_BASE_URL}/bloqueos/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(bloqueoData),
  });

  if (!response.ok) {
    const error = await response.json();
    // Formatear errores del backend
    if (typeof error === 'object' && !error.error) {
      const errorMessages = Object.entries(error)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
        .join('\n');
      throw new Error(errorMessages);
    }
    throw new Error(error.error || 'Error al crear bloqueo');
  }

  return response.json();
}

/**
 * Actualizar un bloqueo existente
 * @param {number} bloqueoId - ID del bloqueo
 * @param {Object} bloqueoData - Datos actualizados del bloqueo
 * @returns {Object} - Bloqueo actualizado
 */
export async function actualizarBloqueo(bloqueoId, bloqueoData) {
  const response = await fetch(`${API_BASE_URL}/bloqueos/${bloqueoId}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(bloqueoData),
  });

  if (!response.ok) {
    const error = await response.json();
    // Formatear errores del backend
    if (typeof error === 'object' && !error.error) {
      const errorMessages = Object.entries(error)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
        .join('\n');
      throw new Error(errorMessages);
    }
    throw new Error(error.error || 'Error al actualizar bloqueo');
  }

  return response.json();
}

/**
 * Eliminar un bloqueo
 * @param {number} bloqueoId - ID del bloqueo
 * @returns {void}
 */
export async function eliminarBloqueo(bloqueoId) {
  const response = await fetch(`${API_BASE_URL}/bloqueos/${bloqueoId}/`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al eliminar bloqueo');
  }
}

/**
 * Desactivar un bloqueo (sin eliminarlo)
 * @param {number} bloqueoId - ID del bloqueo
 * @returns {Object} - Bloqueo desactivado
 */
export async function desactivarBloqueo(bloqueoId) {
  const response = await fetch(`${API_BASE_URL}/bloqueos/${bloqueoId}/desactivar/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al desactivar bloqueo');
  }

  return response.json();
}

/**
 * Activar un bloqueo previamente desactivado
 * @param {number} bloqueoId - ID del bloqueo
 * @returns {Object} - Bloqueo activado
 */
export async function activarBloqueo(bloqueoId) {
  const response = await fetch(`${API_BASE_URL}/bloqueos/${bloqueoId}/activar/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al activar bloqueo');
  }

  return response.json();
}

/**
 * Obtener bloqueos activos para hoy
 * @returns {Array} - Lista de bloqueos activos hoy
 */
export async function obtenerBloqueosActivosHoy() {
  const response = await fetch(`${API_BASE_URL}/bloqueos/activos-hoy/`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener bloqueos activos hoy');
  }

  return response.json();
}
