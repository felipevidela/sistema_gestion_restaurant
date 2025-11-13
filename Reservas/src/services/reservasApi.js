// Configuración de la API
const API_BASE_URL = "http://localhost:8000/api";

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

  if (!response.ok) {
    const error = await response.json();
    // Formatear errores del backend
    if (error.details) {
      const errorMessages = Object.entries(error.details)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
        .join('\n');
      throw new Error(errorMessages || error.error);
    }
    throw new Error(error.error || 'Error al crear la reserva');
  }

  const responseData = await response.json();

  // Guardar token y datos de usuario en localStorage (auto-login)
  localStorage.setItem('token', responseData.token);
  localStorage.setItem('user', JSON.stringify({
    id: responseData.user_id,
    username: responseData.username,
    email: responseData.email,
    rol: responseData.rol,
    rol_display: responseData.rol_display,
    nombre_completo: responseData.nombre_completo
  }));

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
 * @param {Object} params - {fecha: 'YYYY-MM-DD' | 'today', estado: string}
 * @returns {Array} - Lista de reservas
 */
export async function getReservas({ fecha, estado } = {}) {
  const params = new URLSearchParams();

  if (fecha === 'today') {
    params.append('date', 'today');
  } else if (fecha) {
    params.append('fecha_reserva', fecha);
  }

  if (estado && estado !== 'TODOS') {
    params.append('estado', estado.toLowerCase());
  }

  const url = `${API_BASE_URL}/reservas/?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Error al obtener reservas');
  }

  const data = await response.json();

  // Transformar datos del backend al formato que espera el frontend
  return data.map(reserva => ({
    id: reserva.id,
    cliente: reserva.cliente_nombre || reserva.cliente_username,
    mesa: `M${String(reserva.mesa_numero).padStart(2, '0')}`,
    fecha: reserva.fecha_reserva,
    hora: formatearHora24(reserva.hora_inicio),
    personas: reserva.num_personas,
    estado: reserva.estado.toUpperCase(),
  }));
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
 * Obtener todas las mesas
 * @param {Object} params - {estado: string} (opcional)
 * @returns {Array} - Lista de mesas
 */
export async function getMesas({ estado } = {}) {
  const params = new URLSearchParams();
  if (estado) params.append('estado', estado);

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
