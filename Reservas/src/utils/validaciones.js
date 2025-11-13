/**
 * Utilidades de validación para formularios
 */

/**
 * Validar formato y dígito verificador del RUT chileno
 * @param {string} rut - RUT a validar (puede incluir puntos y guión)
 * @returns {Object} - {valido: boolean, mensaje: string}
 */
export function validarRUT(rut) {
  if (!rut || rut.trim() === '') {
    return { valido: false, mensaje: 'El RUT es requerido' };
  }

  // Limpiar RUT (quitar puntos, guiones y espacios)
  const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').replace(/\s/g, '').toUpperCase();

  if (rutLimpio.length < 2) {
    return { valido: false, mensaje: 'RUT inválido: demasiado corto' };
  }

  // Separar número y dígito verificador
  const numero = rutLimpio.slice(0, -1);
  const dvIngresado = rutLimpio.slice(-1);

  // Validar que el número sea numérico
  if (!/^\d+$/.test(numero)) {
    return { valido: false, mensaje: 'RUT inválido: debe contener solo números' };
  }

  // Calcular dígito verificador
  let suma = 0;
  let multiplicador = 2;

  for (let i = numero.length - 1; i >= 0; i--) {
    suma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador < 7 ? multiplicador + 1 : 2;
  }

  const resto = suma % 11;
  let dvCalculado = (11 - resto).toString();

  if (dvCalculado === '11') {
    dvCalculado = '0';
  } else if (dvCalculado === '10') {
    dvCalculado = 'K';
  }

  // Comparar dígitos verificadores
  if (dvIngresado !== dvCalculado) {
    return {
      valido: false,
      mensaje: `RUT inválido: dígito verificador incorrecto. Debería ser ${dvCalculado}`
    };
  }

  return { valido: true, mensaje: '' };
}

/**
 * Formatear RUT mientras se escribe (agrega puntos y guión)
 * @param {string} rut - RUT sin formato
 * @returns {string} - RUT formateado (ej: 12.345.678-9)
 */
export function formatearRUT(rut) {
  // Limpiar el RUT
  const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').replace(/\s/g, '').toUpperCase();

  if (rutLimpio.length <= 1) {
    return rutLimpio;
  }

  // Separar número y dígito verificador
  const numero = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  // Agregar puntos cada 3 dígitos desde la derecha
  const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${numeroFormateado}-${dv}`;
}

/**
 * Validar formato de teléfono chileno
 * @param {string} telefono - Teléfono a validar
 * @returns {Object} - {valido: boolean, mensaje: string}
 */
export function validarTelefono(telefono) {
  if (!telefono || telefono.trim() === '') {
    return { valido: false, mensaje: 'El teléfono es requerido' };
  }

  // Limpiar teléfono (quitar espacios, guiones y paréntesis)
  const telefonoLimpio = telefono.replace(/\s/g, '').replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');

  // Patrón para teléfono móvil chileno
  // Acepta: +56912345678, 56912345678, 912345678, 9 1234 5678
  const patronMovil = /^(\+?56)?9\d{8}$/;

  if (!patronMovil.test(telefonoLimpio)) {
    return {
      valido: false,
      mensaje: 'Formato de teléfono inválido. Use formato: +56912345678 o 912345678'
    };
  }

  return { valido: true, mensaje: '' };
}

/**
 * Formatear teléfono mientras se escribe
 * @param {string} telefono - Teléfono sin formato
 * @returns {string} - Teléfono formateado (ej: +56 9 1234 5678)
 */
export function formatearTelefono(telefono) {
  // Limpiar el teléfono
  let telefonoLimpio = telefono.replace(/\s/g, '').replace(/-/g, '').replace(/\+/g, '');

  // Si comienza con 56, asumimos que es código de país
  if (telefonoLimpio.startsWith('56')) {
    telefonoLimpio = telefonoLimpio.slice(2);
  }

  // Si no comienza con 9, no es móvil válido
  if (!telefonoLimpio.startsWith('9')) {
    return telefono;
  }

  // Limitar a 9 dígitos
  telefonoLimpio = telefonoLimpio.slice(0, 9);

  // Formatear: +56 9 1234 5678
  if (telefonoLimpio.length <= 1) {
    return `+56 ${telefonoLimpio}`;
  } else if (telefonoLimpio.length <= 5) {
    return `+56 ${telefonoLimpio[0]} ${telefonoLimpio.slice(1)}`;
  } else {
    return `+56 ${telefonoLimpio[0]} ${telefonoLimpio.slice(1, 5)} ${telefonoLimpio.slice(5)}`;
  }
}

/**
 * Validar contraseña
 * @param {string} password - Contraseña a validar
 * @returns {Object} - {valido: boolean, mensaje: string}
 */
export function validarPassword(password) {
  if (!password || password.trim() === '') {
    return { valido: false, mensaje: 'La contraseña es requerida' };
  }

  if (password.length < 8) {
    return { valido: false, mensaje: 'La contraseña debe tener al menos 8 caracteres' };
  }

  return { valido: true, mensaje: '' };
}

/**
 * Validar que las contraseñas coincidan
 * @param {string} password - Contraseña
 * @param {string} passwordConfirm - Confirmación de contraseña
 * @returns {Object} - {valido: boolean, mensaje: string}
 */
export function validarPasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm || passwordConfirm.trim() === '') {
    return { valido: false, mensaje: 'Debe confirmar la contraseña' };
  }

  if (password !== passwordConfirm) {
    return { valido: false, mensaje: 'Las contraseñas no coinciden' };
  }

  return { valido: true, mensaje: '' };
}

/**
 * Validar email
 * @param {string} email - Email a validar
 * @returns {Object} - {valido: boolean, mensaje: string}
 */
export function validarEmail(email) {
  if (!email || email.trim() === '') {
    return { valido: false, mensaje: 'El email es requerido' };
  }

  const patronEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!patronEmail.test(email)) {
    return { valido: false, mensaje: 'Formato de email inválido' };
  }

  return { valido: true, mensaje: '' };
}

/**
 * Validar username
 * @param {string} username - Username a validar
 * @returns {Object} - {valido: boolean, mensaje: string}
 */
export function validarUsername(username) {
  if (!username || username.trim() === '') {
    return { valido: false, mensaje: 'El nombre de usuario es requerido' };
  }

  if (username.length < 3) {
    return { valido: false, mensaje: 'El nombre de usuario debe tener al menos 3 caracteres' };
  }

  return { valido: true, mensaje: '' };
}
