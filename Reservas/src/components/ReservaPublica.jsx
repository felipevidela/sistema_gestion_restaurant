import { useState, useEffect } from 'react';
import { getMesas, registerAndReserve } from '../services/reservasApi';
import {
  validarEmail,
  validarPassword,
  validarPasswordConfirm,
  validarRUT,
  validarTelefono,
  formatearRUT,
  formatearTelefono,
  validarSeleccionMesa
} from '../utils/validaciones';

export default function ReservaPublica({ onReservaExitosa }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMesas, setLoadingMesas] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mostrarDatosPersonales, setMostrarDatosPersonales] = useState(false);

  // Estados para mostrar/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [formData, setFormData] = useState({
    // Datos de reserva
    fecha_reserva: '',
    hora_inicio: '',
    num_personas: 1,
    mesa: '',
    notas: '',
    // Datos personales
    nombre: '',
    apellido: '',
    telefono: '',
    rut: '',
    email: '',
    password: '',
    password_confirm: ''
  });

  const [validationErrors, setValidationErrors] = useState({});

  // Cargar mesas cuando se selecciona fecha, hora y personas
  useEffect(() => {
    if (formData.fecha_reserva && formData.hora_inicio && formData.num_personas) {
      cargarMesasDisponibles();
    }
  }, [formData.fecha_reserva, formData.hora_inicio, formData.num_personas]);

  const cargarMesasDisponibles = async () => {
    try {
      setLoadingMesas(true);
      // Cargar mesas disponibles para la fecha y hora específicas
      const data = await getMesas({
        fecha: formData.fecha_reserva,
        hora: formData.hora_inicio
      });
      // Filtrar mesas por capacidad
      const mesasFiltradas = data.filter(m => m.capacidad >= formData.num_personas);
      setMesas(mesasFiltradas);

      // Si la mesa seleccionada ya no está disponible, limpiar selección
      if (formData.mesa && !mesasFiltradas.find(m => m.id === parseInt(formData.mesa))) {
        setFormData(prev => ({ ...prev, mesa: '' }));
        setError('La mesa seleccionada ya no está disponible para esta fecha y hora. Por favor seleccione otra.');
      }
    } catch (err) {
      console.error('Error al cargar mesas:', err);
    } finally {
      setLoadingMesas(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Formatear RUT y teléfono mientras se escribe
    if (name === 'rut' && value) {
      processedValue = formatearRUT(value);
    }
    if (name === 'telefono' && value) {
      processedValue = formatearTelefono(value);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    setError('');

    // Validar campo en tiempo real
    if (mostrarDatosPersonales) {
      validateField(name, processedValue);
    }

    // Mostrar sección de datos personales si se selecciona una mesa
    if (name === 'mesa' && value) {
      setMostrarDatosPersonales(true);
    }
  };

  const validateField = (name, value) => {
    let validation = { valido: true, mensaje: '' };

    switch (name) {
      case 'email':
        validation = validarEmail(value);
        break;
      case 'password':
        validation = validarPassword(value);
        break;
      case 'password_confirm':
        validation = validarPasswordConfirm(formData.password, value);
        break;
      case 'rut':
        validation = validarRUT(value);
        break;
      case 'telefono':
        validation = validarTelefono(value);
        break;
      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [name]: validation.valido ? '' : validation.mensaje
    }));
  };

  const validateForm = () => {
    const errors = {};

    // Validar datos de reserva
    if (!formData.fecha_reserva) errors.fecha_reserva = 'La fecha es requerida';
    if (!formData.hora_inicio) errors.hora_inicio = 'La hora de inicio es requerida';
    if (!formData.num_personas || formData.num_personas < 1) errors.num_personas = 'Debe indicar al menos 1 persona';

    // FIX #31 (MENOR): Validación de selección de mesa
    const validacionMesa = validarSeleccionMesa(formData.mesa, mesas);
    if (!validacionMesa.valido) errors.mesa = validacionMesa.mensaje;

    // Validar datos personales
    if (!formData.nombre || formData.nombre.trim() === '') {
      errors.nombre = 'El nombre es requerido';
    }

    if (!formData.apellido || formData.apellido.trim() === '') {
      errors.apellido = 'El apellido es requerido';
    }

    const emailVal = validarEmail(formData.email);
    if (!emailVal.valido) errors.email = emailVal.mensaje;

    const rutVal = validarRUT(formData.rut);
    if (!rutVal.valido) errors.rut = rutVal.mensaje;

    const telefonoVal = validarTelefono(formData.telefono);
    if (!telefonoVal.valido) errors.telefono = telefonoVal.mensaje;

    const passwordVal = validarPassword(formData.password);
    if (!passwordVal.valido) errors.password = passwordVal.mensaje;

    const passwordConfirmVal = validarPasswordConfirm(formData.password, formData.password_confirm);
    if (!passwordConfirmVal.valido) errors.password_confirm = passwordConfirmVal.mensaje;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validar formulario
    if (!validateForm()) {
      setError('Por favor corrija los errores en el formulario');
      setLoading(false);
      return;
    }

    // FIX #25 (MODERADO): Revalidar disponibilidad antes de submit
    // Verificar que la mesa aún esté disponible justo antes de crear la reserva
    try {
      const mesasDisponiblesActuales = await getMesas({
        fecha: formData.fecha_reserva,
        hora: formData.hora_inicio
      });
      const mesasFiltradas = mesasDisponiblesActuales.filter(m => m.capacidad >= formData.num_personas);
      const mesaAunDisponible = mesasFiltradas.find(m => m.id === parseInt(formData.mesa));

      if (!mesaAunDisponible) {
        setError('Lo sentimos, la mesa seleccionada ya no está disponible para esta fecha y hora. Por favor seleccione otra mesa.');
        // Recargar mesas para mostrar las disponibles actualmente
        await cargarMesasDisponibles();
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Error al revalidar disponibilidad:', err);
      // Continuar con la creación - el backend hará la validación final
    }

    // FIX #34 (MENOR): Transacciones atómicas en frontend
    try {
      // Paso 1: Registro y reserva (operación crítica)
      const result = await registerAndReserve(formData);

      // Paso 2: Solo si fue exitoso, mostrar mensaje de éxito
      setSuccess(`¡Reserva confirmada! Mesa ${result.reserva.mesa_numero} para el ${result.reserva.fecha_reserva}`);

      // Paso 3: Esperar 2 segundos y redirigir solo si la operación fue exitosa
      setTimeout(() => {
        if (onReservaExitosa) {
          try {
            onReservaExitosa(result);
          } catch (redirectErr) {
            console.error('Error al redirigir, pero reserva creada exitosamente:', redirectErr);
            // Reserva fue creada exitosamente, solo falló la redirección
          }
        }
      }, 2000);
    } catch (err) {
      // Si falla la operación principal, no ejecutar pasos posteriores
      setError(err.message || 'Error al crear la reserva');
      console.error('Error en reserva:', err);
    } finally {
      setLoading(false);
    }
  };

  // Obtener fecha mínima (hoy)
  const getFechaMinima = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Generar opciones de hora con intervalos de 30 minutos (formato 24 horas)
  // Horario de atención: 12:00 a 23:00
  // Última reserva: 21:00 (termina a las 23:00 con duración de 2 horas)
  const generarOpcionesHora = () => {
    const opciones = [];
    for (let hora = 12; hora <= 21; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 30) {
        const horaStr = String(hora).padStart(2, '0');
        const minutoStr = String(minuto).padStart(2, '0');
        const tiempo = `${horaStr}:${minutoStr}`;
        opciones.push(tiempo);
      }
    }
    return opciones;
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <h2 className="fw-bold text-primary">Hacer tu Reserva</h2>
                <p className="text-muted">Completa los datos para reservar tu mesa</p>
              </div>

              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}

              {success && (
                <div className="alert alert-success" role="alert">
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Sección 1: Datos de la Reserva */}
                <div className="mb-4">
                  <h5 className="mb-3">1. Detalles de tu Reserva</h5>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="fecha_reserva" className="form-label">
                        Fecha <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className={`form-control ${validationErrors.fecha_reserva ? 'is-invalid' : ''}`}
                        id="fecha_reserva"
                        name="fecha_reserva"
                        value={formData.fecha_reserva}
                        onChange={handleChange}
                        min={getFechaMinima()}
                        required
                      />
                      {validationErrors.fecha_reserva && (
                        <div className="invalid-feedback">{validationErrors.fecha_reserva}</div>
                      )}
                    </div>

                    <div className="col-md-6 mb-3">
                      <label htmlFor="num_personas" className="form-label">
                        Número de Personas <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className={`form-control ${validationErrors.num_personas ? 'is-invalid' : ''}`}
                        id="num_personas"
                        name="num_personas"
                        value={formData.num_personas}
                        onChange={handleChange}
                        min="1"
                        max="20"
                        required
                      />
                      {validationErrors.num_personas && (
                        <div className="invalid-feedback">{validationErrors.num_personas}</div>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="hora_inicio" className="form-label">
                      Hora de la Reserva <span className="text-danger">*</span>
                    </label>
                    <select
                      className={`form-select ${validationErrors.hora_inicio ? 'is-invalid' : ''}`}
                      id="hora_inicio"
                      name="hora_inicio"
                      value={formData.hora_inicio}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccione una hora</option>
                      {generarOpcionesHora().map(hora => (
                        <option key={hora} value={hora}>
                          {hora} hrs
                        </option>
                      ))}
                    </select>
                    {validationErrors.hora_inicio && (
                      <div className="invalid-feedback">{validationErrors.hora_inicio}</div>
                    )}
                    <small className="text-info d-block mt-1">
                      <i className="bi bi-info-circle me-1"></i>
                      La reserva tendrá una duración de 2 horas
                    </small>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="mesa" className="form-label">
                      Seleccionar Mesa <span className="text-danger">*</span>
                    </label>
                    {loadingMesas ? (
                      <div className="text-center py-2">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Cargando mesas disponibles...
                      </div>
                    ) : (
                      <select
                        className={`form-select ${validationErrors.mesa ? 'is-invalid' : ''}`}
                        id="mesa"
                        name="mesa"
                        value={formData.mesa}
                        onChange={handleChange}
                        required
                        disabled={!formData.fecha_reserva}
                      >
                        <option value="">Seleccione una mesa</option>
                        {mesas.map(mesa => (
                          <option key={mesa.id} value={mesa.id}>
                            Mesa {mesa.numero} - Capacidad: {mesa.capacidad} personas
                          </option>
                        ))}
                      </select>
                    )}
                    {validationErrors.mesa && (
                      <div className="invalid-feedback">{validationErrors.mesa}</div>
                    )}
                    {!formData.fecha_reserva ? (
                      <small className="text-muted d-block mt-1">
                        Seleccione fecha y número de personas para ver mesas disponibles
                      </small>
                    ) : mesas.length === 0 && !loadingMesas ? (
                      <small className="text-warning d-block mt-1">
                        No hay mesas disponibles para la capacidad seleccionada
                      </small>
                    ) : null}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="notas" className="form-label">
                      Notas Adicionales (Opcional)
                    </label>
                    <textarea
                      className="form-control"
                      id="notas"
                      name="notas"
                      value={formData.notas}
                      onChange={handleChange}
                      rows="2"
                      placeholder="Ej: Preferencia de ubicación, celebración especial..."
                    ></textarea>
                  </div>
                </div>

                {/* Sección 2: Datos Personales (se muestra al seleccionar mesa) */}
                {mostrarDatosPersonales && (
                  <div className="mb-4 border-top pt-4">
                    <h5 className="mb-3">2. Tus Datos</h5>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="nombre" className="form-label">
                          Nombre <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${validationErrors.nombre ? 'is-invalid' : ''}`}
                          id="nombre"
                          name="nombre"
                          value={formData.nombre}
                          onChange={handleChange}
                          required
                        />
                        {validationErrors.nombre && (
                          <div className="invalid-feedback">{validationErrors.nombre}</div>
                        )}
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="apellido" className="form-label">
                          Apellido <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${validationErrors.apellido ? 'is-invalid' : ''}`}
                          id="apellido"
                          name="apellido"
                          value={formData.apellido}
                          onChange={handleChange}
                          required
                        />
                        {validationErrors.apellido && (
                          <div className="invalid-feedback">{validationErrors.apellido}</div>
                        )}
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="telefono" className="form-label">
                          Teléfono <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${validationErrors.telefono ? 'is-invalid' : ''}`}
                          id="telefono"
                          name="telefono"
                          value={formData.telefono}
                          onChange={handleChange}
                          placeholder="+56 9 1234 5678"
                          required
                        />
                        {validationErrors.telefono && (
                          <div className="invalid-feedback">{validationErrors.telefono}</div>
                        )}
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="rut" className="form-label">
                          RUT <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${validationErrors.rut ? 'is-invalid' : ''}`}
                          id="rut"
                          name="rut"
                          value={formData.rut}
                          onChange={handleChange}
                          placeholder="12.345.678-9"
                          required
                        />
                        {validationErrors.rut && (
                          <div className="invalid-feedback">{validationErrors.rut}</div>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                      {validationErrors.email && (
                        <div className="invalid-feedback">{validationErrors.email}</div>
                      )}
                      <small className="text-muted">Usarás tu email para gestionar tu reserva</small>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="password" className="form-label">
                          Contraseña <span className="text-danger">*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPassword ? "text" : "password"}
                            className={`form-control ${validationErrors.password ? 'is-invalid' : ''}`}
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            style={{ paddingRight: '70px' }}
                          />
                          <span
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '40px',
                              top: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: '#6c757d',
                              zIndex: 10
                            }}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            role="button"
                            tabIndex="-1"
                          >
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                                <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                              </svg>
                            )}
                          </span>
                          {validationErrors.password && (
                            <div className="invalid-feedback">{validationErrors.password}</div>
                          )}
                        </div>
                        <small className="text-muted">Mínimo 8 caracteres</small>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="password_confirm" className="form-label">
                          Confirmar Contraseña <span className="text-danger">*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPasswordConfirm ? "text" : "password"}
                            className={`form-control ${validationErrors.password_confirm ? 'is-invalid' : ''}`}
                            id="password_confirm"
                            name="password_confirm"
                            value={formData.password_confirm}
                            onChange={handleChange}
                            required
                            style={{ paddingRight: '70px' }}
                          />
                          <span
                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                            style={{
                              position: 'absolute',
                              right: '40px',
                              top: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: '#6c757d',
                              zIndex: 10
                            }}
                            aria-label={showPasswordConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                            role="button"
                            tabIndex="-1"
                          >
                            {showPasswordConfirm ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                                <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                              </svg>
                            )}
                          </span>
                          {validationErrors.password_confirm && (
                            <div className="invalid-feedback">{validationErrors.password_confirm}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="d-grid">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading || !mostrarDatosPersonales}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Confirmar Reserva
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
