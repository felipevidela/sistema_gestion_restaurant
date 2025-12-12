// API de Menú - Gestión de platos, categorías e ingredientes
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

/**
 * Manejar errores de respuesta
 */
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || `Error ${response.status}`);
  }
  const data = await response.json().catch(() => null);
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data.results;
  }
  // Para respuestas vacías (204) o sin body, devolver array vacío para evitar errores en .map()
  if (data === null) return [];
  return data;
}

// ==================== CATEGORÍAS ====================

/**
 * Listar todas las categorías del menú
 * @param {boolean} soloActivas - Filtrar solo categorías activas
 */
export async function getCategorias(soloActivas = true) {
  const params = soloActivas ? '?activa=true' : '';
  const response = await fetch(`${API_BASE_URL}/menu/categorias/${params}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Crear nueva categoría
 */
export async function crearCategoria(data) {
  const response = await fetch(`${API_BASE_URL}/menu/categorias/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Actualizar categoría
 */
export async function actualizarCategoria(id, data) {
  const response = await fetch(`${API_BASE_URL}/menu/categorias/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Eliminar categoría
 */
export async function eliminarCategoria(id) {
  const response = await fetch(`${API_BASE_URL}/menu/categorias/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al eliminar categoría');
  }
}

// ==================== PLATOS ====================

/**
 * Listar platos con filtros opcionales
 * @param {Object} filtros - { categoria, disponible, activo }
 */
export async function getPlatos(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.categoria) params.append('categoria', filtros.categoria);
  if (filtros.disponible !== undefined) params.append('disponible', filtros.disponible);
  if (filtros.activo !== undefined) params.append('activo', filtros.activo);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/menu/platos/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Obtener detalle de un plato (incluye receta)
 */
export async function getPlato(id) {
  const response = await fetch(`${API_BASE_URL}/menu/platos/${id}/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Crear nuevo plato
 */
export async function crearPlato(data) {
  const response = await fetch(`${API_BASE_URL}/menu/platos/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Actualizar plato
 */
export async function actualizarPlato(id, data) {
  const response = await fetch(`${API_BASE_URL}/menu/platos/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Eliminar plato
 */
export async function eliminarPlato(id) {
  const response = await fetch(`${API_BASE_URL}/menu/platos/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al eliminar plato');
  }
}

/**
 * Obtener receta de un plato
 */
export async function getRecetaPlato(platoId) {
  const response = await fetch(`${API_BASE_URL}/menu/platos/${platoId}/receta/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Agregar ingrediente a receta de plato
 */
export async function agregarIngredienteReceta(platoId, data) {
  const response = await fetch(`${API_BASE_URL}/menu/platos/${platoId}/receta/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

// ==================== INGREDIENTES ====================

/**
 * Listar ingredientes con filtros
 * @param {Object} filtros - { activo, bajo_stock }
 */
export async function getIngredientes(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.activo !== undefined) params.append('activo', filtros.activo);
  if (filtros.bajo_stock !== undefined) params.append('bajo_stock', filtros.bajo_stock);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/menu/ingredientes/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Obtener ingredientes con stock bajo el mínimo
 */
export async function getIngredientesBajoStock() {
  const response = await fetch(`${API_BASE_URL}/menu/ingredientes/bajo_minimo/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Listar ingredientes con paginación completa (devuelve count y punteros)
 * @param {Object} filtros - { activo, bajo_stock, page, page_size }
 * @returns {Object} - { results, count, next, previous }
 */
export async function getIngredientesPaginated(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.activo !== undefined) params.append('activo', filtros.activo);
  if (filtros.bajo_stock !== undefined) params.append('bajo_stock', filtros.bajo_stock);
  if (filtros.page) params.append('page', filtros.page);
  if (filtros.page_size) params.append('page_size', filtros.page_size);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/menu/ingredientes/${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders()
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail ||
      data.error ||
      `Error ${response.status}`
    );
  }

  return {
    results: data.results || [],
    count: data.count ?? (Array.isArray(data) ? data.length : 0),
    next: data.next || null,
    previous: data.previous || null
  };
}

/**
 * Crear nuevo ingrediente
 */
export async function crearIngrediente(data) {
  const response = await fetch(`${API_BASE_URL}/menu/ingredientes/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Actualizar ingrediente (stock, precio, etc.)
 */
export async function actualizarIngrediente(id, data) {
  const response = await fetch(`${API_BASE_URL}/menu/ingredientes/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Eliminar ingrediente
 */
export async function eliminarIngrediente(id) {
  const response = await fetch(`${API_BASE_URL}/menu/ingredientes/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al eliminar ingrediente');
  }
}

// ==================== DISPONIBILIDAD ====================

/**
 * Obtener platos disponibles según stock actual
 */
export async function getDisponibilidad() {
  const response = await fetch(`${API_BASE_URL}/menu/disponibilidad/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ==================== RECETAS ====================

/**
 * Listar todas las recetas
 */
export async function getRecetas() {
  const response = await fetch(`${API_BASE_URL}/menu/recetas/`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

/**
 * Actualizar cantidad de ingrediente en receta
 */
export async function actualizarReceta(id, data) {
  const response = await fetch(`${API_BASE_URL}/menu/recetas/${id}/`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

/**
 * Eliminar ingrediente de receta
 */
export async function eliminarReceta(id) {
  const response = await fetch(`${API_BASE_URL}/menu/recetas/${id}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al eliminar receta');
  }
}
