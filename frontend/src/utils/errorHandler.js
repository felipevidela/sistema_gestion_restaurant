/**
 * FIX #26 (MODERADO): Manejo de errores consistente en frontend
 *
 * Utilidad centralizada para el manejo de errores que:
 * - Parsea mensajes de error del backend
 * - Maneja errores de red
 * - Proporciona mensajes amigables al usuario
 * - Formatee los errores de forma consistente
 */

/**
 * Parsear respuesta de error del backend
 * @param {Response} response - Respuesta HTTP del fetch
 * @returns {Promise<string>} - Mensaje de error formateado
 */
export async function parseBackendError(response) {
  try {
    const errorData = await response.json();

    // Caso 1: Error con campo 'error' o 'message'
    if (errorData.error) {
      return errorData.error;
    }
    if (errorData.message) {
      return errorData.message;
    }
    if (errorData.detail) {
      return errorData.detail;
    }

    // Caso 2: Errores de validación por campo (objeto con campos y mensajes)
    if (typeof errorData === 'object' && !Array.isArray(errorData)) {
      const errorMessages = Object.entries(errorData)
        .map(([field, messages]) => {
          const fieldName = field === 'non_field_errors' ? 'Error' : field;
          const messageText = Array.isArray(messages) ? messages.join(', ') : messages;
          return `${fieldName}: ${messageText}`;
        })
        .join('\n');

      if (errorMessages) {
        return errorMessages;
      }
    }

    // Caso 3: Error serializado como JSON
    return JSON.stringify(errorData);
  } catch (err) {
    // Si no se puede parsear como JSON, retornar texto plano
    try {
      return await response.text();
    } catch {
      return 'Error desconocido del servidor';
    }
  }
}

/**
 * Formatear mensaje de error para mostrar al usuario
 * @param {Error|string} error - Error capturado o mensaje de error
 * @param {string} operacion - Nombre de la operación que falló (ej: "crear reserva")
 * @returns {string} - Mensaje de error formateado y amigable
 */
export function formatErrorMessage(error, operacion = 'completar la operación') {
  // Si es un objeto Error con mensaje
  if (error instanceof Error) {
    // Errores de red
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      return `Error de conexión. Por favor verifique su conexión a internet e intente nuevamente.`;
    }

    // Errores de timeout
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return `La operación tardó demasiado tiempo. Por favor intente nuevamente.`;
    }

    // Error con mensaje personalizado
    if (error.message) {
      return error.message;
    }
  }

  // Si es un string
  if (typeof error === 'string') {
    return error;
  }

  // Fallback genérico
  return `Error al ${operacion}. Por favor intente nuevamente.`;
}

/**
 * Manejar error de forma consistente
 * @param {Error|Response|string} error - Error capturado
 * @param {string} operacion - Nombre de la operación que falló
 * @param {Function} setError - Función para establecer el mensaje de error en el estado
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.showAlert - Mostrar alert() además de setError
 * @param {Function} options.onError - Callback adicional al manejar error
 */
export async function handleError(error, operacion, setError, options = {}) {
  const { showAlert = false, onError } = options;

  let errorMessage;

  // Si es una Response de fetch
  if (error instanceof Response) {
    errorMessage = await parseBackendError(error);
  } else {
    errorMessage = formatErrorMessage(error, operacion);
  }

  // Log para debugging
  console.error(`Error en ${operacion}:`, error);

  // Establecer mensaje de error en el estado
  if (setError && typeof setError === 'function') {
    setError(errorMessage);
  }

  // Mostrar alert si está habilitado
  if (showAlert) {
    alert(`Error al ${operacion}: ${errorMessage}`);
  }

  // Ejecutar callback adicional si existe
  if (onError && typeof onError === 'function') {
    onError(errorMessage, error);
  }

  return errorMessage;
}

/**
 * Wrapper para operaciones asíncronas con manejo de errores centralizado
 * @param {Function} asyncFn - Función asíncrona a ejecutar
 * @param {string} operacion - Nombre de la operación
 * @param {Object} errorHandlers - Manejadores de error
 * @param {Function} errorHandlers.setError - Función para establecer error en estado
 * @param {Function} errorHandlers.setLoading - Función para establecer loading en estado
 * @param {Function} errorHandlers.onSuccess - Callback al completar exitosamente
 * @param {Function} errorHandlers.onError - Callback al ocurrir error
 * @returns {Promise<any>} - Resultado de la operación
 */
export async function executeWithErrorHandling(asyncFn, operacion, errorHandlers = {}) {
  const { setError, setLoading, onSuccess, onError } = errorHandlers;

  try {
    if (setLoading) setLoading(true);
    if (setError) setError('');

    const result = await asyncFn();

    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    const errorMessage = await handleError(error, operacion, setError, { onError });
    throw new Error(errorMessage);
  } finally {
    if (setLoading) setLoading(false);
  }
}

/**
 * Validar respuesta HTTP y lanzar error si no es exitosa
 * @param {Response} response - Respuesta de fetch
 * @returns {Promise<Response>} - Respuesta si es exitosa
 * @throws {Error} - Error con mensaje parseado del backend
 */
export async function validateResponse(response) {
  if (!response.ok) {
    const errorMessage = await parseBackendError(response);
    throw new Error(errorMessage);
  }
  return response;
}

/**
 * Tipos de errores comunes y sus mensajes amigables
 */
export const ERROR_TYPES = {
  NETWORK: 'Error de conexión a internet',
  TIMEOUT: 'La operación tardó demasiado tiempo',
  UNAUTHORIZED: 'No tiene permisos para realizar esta acción',
  NOT_FOUND: 'El recurso solicitado no existe',
  VALIDATION: 'Los datos ingresados no son válidos',
  SERVER: 'Error interno del servidor',
  UNKNOWN: 'Error desconocido'
};

/**
 * Detectar tipo de error
 * @param {Error|Response} error - Error capturado
 * @returns {string} - Tipo de error (uno de ERROR_TYPES)
 */
export function detectErrorType(error) {
  if (error instanceof Response) {
    if (error.status === 401 || error.status === 403) return ERROR_TYPES.UNAUTHORIZED;
    if (error.status === 404) return ERROR_TYPES.NOT_FOUND;
    if (error.status === 400) return ERROR_TYPES.VALIDATION;
    if (error.status >= 500) return ERROR_TYPES.SERVER;
  }

  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return ERROR_TYPES.NETWORK;
    }
    if (error.message.includes('timeout')) {
      return ERROR_TYPES.TIMEOUT;
    }
  }

  return ERROR_TYPES.UNKNOWN;
}
