/**
 * Diccionario de mensajes de error amigables
 * Traduce errores técnicos del backend a mensajes comprensibles para el usuario
 */

const ERROR_MESSAGES = {
  // Errores de reservas
  'La mesa seleccionada no está disponible': {
    message: 'La mesa que seleccionó ya no está disponible para esta fecha y hora.',
    suggestion: 'Por favor, seleccione otra mesa u horario.',
  },
  'No se pueden crear reservas para fechas pasadas': {
    message: 'No se pueden crear reservas en el pasado.',
    suggestion: 'Seleccione una fecha futura.',
  },
  'La mesa no tiene capacidad suficiente': {
    message: 'La mesa seleccionada no tiene capacidad para la cantidad de personas.',
    suggestion: 'Elija una mesa más grande o reduzca el número de personas.',
  },
  'Ya existe una reserva': {
    message: 'Ya existe una reserva para esta mesa en el horario seleccionado.',
    suggestion: 'Seleccione otro horario o mesa.',
  },

  // Errores de autenticación
  'Invalid credentials': {
    message: 'Usuario o contraseña incorrectos.',
    suggestion: 'Verifique sus credenciales e intente nuevamente.',
  },
  'Token inválido': {
    message: 'Su sesión ha expirado.',
    suggestion: 'Por favor, inicie sesión nuevamente.',
  },
  'No tiene permisos': {
    message: 'No tiene permisos para realizar esta acción.',
    suggestion: 'Contacte al administrador si necesita acceso.',
  },

  // Errores de validación
  'Este campo es requerido': {
    message: 'Por favor, complete todos los campos obligatorios.',
    suggestion: 'Los campos marcados con * son requeridos.',
  },
  'Formato de email inválido': {
    message: 'El formato del email no es válido.',
    suggestion: 'Ejemplo: usuario@ejemplo.com',
  },
  'La contraseña debe tener al menos 8 caracteres': {
    message: 'La contraseña es muy corta.',
    suggestion: 'Use al menos 8 caracteres.',
  },
  'Las contraseñas no coinciden': {
    message: 'Las contraseñas ingresadas no coinciden.',
    suggestion: 'Verifique que ambas contraseñas sean idénticas.',
  },
  'username: Ya existe un usuario con este nombre': {
    message: 'Este correo ya está asociado a una cuenta.',
    suggestion: 'Inicia sesión con tu cuenta o utiliza otro correo.',
  },
  'Este correo ya está registrado': {
    message: 'Este correo ya se encuentra registrado.',
    suggestion: 'Inicia sesión con tu cuenta o utiliza otro correo.',
  },
  'Este correo ya tiene una reserva registrada': {
    message: 'Ya existe una reserva con este correo.',
    suggestion: 'Revisa tu email para gestionar la reserva existente o utiliza otro correo.',
  },
  'El RUT ingresado ya se encuentra registrado': {
    message: 'El RUT ingresado ya fue utilizado.',
    suggestion: 'Si ya tienes una cuenta, inicia sesión; de lo contrario usa otro RUT.',
  },
  'El RUT ingresado no coincide con tu cuenta existente': {
    message: 'El RUT ingresado no coincide con tu cuenta existente.',
    suggestion: 'Verifica tus datos o contacta al administrador si necesitas actualizar tu información.',
  },
  'duplicate key value violates unique constraint': {
    message: 'Algunos datos ya estaban registrados (correo o RUT duplicados).',
    suggestion: 'Verifica que el correo y el RUT no estén en uso o inicia sesión con tu cuenta.',
  },

  // Errores de red
  'Network Error': {
    message: 'Error de conexión.',
    suggestion: 'Verifique su conexión a internet e intente nuevamente.',
  },
  'Failed to fetch': {
    message: 'No se pudo conectar con el servidor.',
    suggestion: 'Verifique su conexión a internet. Si el problema persiste, contacte soporte.',
  },
  'timeout': {
    message: 'La solicitud tardó demasiado tiempo.',
    suggestion: 'Intente nuevamente en unos momentos.',
  },

  // Errores de servidor
  'Internal Server Error': {
    message: 'Ocurrió un error en el servidor.',
    suggestion: 'Intente nuevamente. Si el problema persiste, contacte soporte.',
  },
  'Service Unavailable': {
    message: 'El servicio no está disponible temporalmente.',
    suggestion: 'Intente nuevamente en unos minutos.',
  },
};

/**
 * Obtiene un mensaje de error amigable
 * @param {string|Error} error - Error a traducir
 * @returns {Object} - { message: string, suggestion: string }
 */
export function getErrorMessage(error) {
  // Si es un objeto Error, extraer el mensaje
  const errorText = error?.message || error?.toString() || error;

  // Buscar coincidencia exacta
  if (ERROR_MESSAGES[errorText]) {
    return ERROR_MESSAGES[errorText];
  }

  // Buscar coincidencia parcial (contiene)
  const partialMatch = Object.keys(ERROR_MESSAGES).find((key) =>
    errorText.includes(key)
  );

  if (partialMatch) {
    return ERROR_MESSAGES[partialMatch];
  }

  // Mensaje genérico si no hay coincidencia
  return {
    message: errorText || 'Ocurrió un error inesperado.',
    suggestion: 'Si el problema persiste, contacte soporte técnico.',
  };
}

/**
 * Formatea un error para mostrar al usuario
 * @param {string|Error} error - Error a formatear
 * @returns {string} - Mensaje formateado
 */
export function formatErrorMessage(error) {
  const { message, suggestion } = getErrorMessage(error);
  return suggestion ? `${message} ${suggestion}` : message;
}

/**
 * Detecta el tipo de error según el código de status HTTP
 * @param {number} status - Código de status HTTP
 * @returns {string} - Tipo de error
 */
export function getErrorTypeFromStatus(status) {
  if (status >= 500) return 'server';
  if (status >= 400) return 'client';
  if (status >= 300) return 'redirect';
  return 'unknown';
}

/**
 * Parsea errores de respuesta del backend Django
 * @param {Object} response - Respuesta del backend
 * @returns {string} - Mensaje de error parseado
 */
export function parseBackendError(response) {
  // Si tiene detail (formato estándar DRF)
  if (response.detail) {
    return response.detail;
  }

  // Si tiene error (formato custom)
  if (response.error) {
    return response.error;
  }

  // Si tiene errores de validación por campo
  if (typeof response === 'object' && !Array.isArray(response)) {
    const errors = [];
    for (const [field, messages] of Object.entries(response)) {
      const fieldErrors = Array.isArray(messages) ? messages : [messages];
      errors.push(`${field}: ${fieldErrors.join(', ')}`);
    }
    if (errors.length > 0) {
      return errors.join('\n');
    }
  }

  // Si es un array de errores
  if (Array.isArray(response)) {
    return response.join('\n');
  }

  return 'Error desconocido';
}

export default ERROR_MESSAGES;
