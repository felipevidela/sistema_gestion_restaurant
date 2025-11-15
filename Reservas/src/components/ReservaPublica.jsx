import { useState, useEffect } from 'react';
import { getMesas, registerAndReserve, getHorasDisponibles } from '../services/reservasApi';
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
import { useFormValidation } from '../hooks/useFormValidation';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../utils/errorMessages';
import { FormSkeleton } from './ui/Skeleton';

export default function ReservaPublica({ onReservaExitosa }) {
  const toast = useToast();
  const [mesas, setMesas] = useState([]);
  const [loadingMesas, setLoadingMesas] = useState(false);
  const [loadingHoras, setLoadingHoras] = useState(false);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [horasNoDisponibles, setHorasNoDisponibles] = useState([]);
  const [horasInfo, setHorasInfo] = useState([]); // Nueva estructura: [{hora, mesas_disponibles}]
  const [mostrarDatosPersonales, setMostrarDatosPersonales] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Reglas de validación
  const validationRules = {
    fecha_reserva: (value) => {
      if (!value) return 'La fecha es requerida';
      const fechaHoy = new Date().toISOString().split('T')[0];
      if (value < fechaHoy) return 'No se pueden crear reservas para fechas pasadas';
      return null;
    },
    hora_inicio: (value) => {
      if (!value) return 'La hora es requerida';
      if (horasNoDisponibles.includes(value)) return 'Esta hora ya no está disponible';
      return null;
    },
    num_personas: (value) => {
      if (!value || value < 1) return 'Debe indicar al menos 1 persona';
      return null;
    },
    mesa: (value) => {
      if (!value) return 'Debe seleccionar una mesa';
      const validacion = validarSeleccionMesa(value, mesas);
      return validacion.valido ? null : validacion.mensaje;
    },
    nombre: (value) => (!value?.trim() ? 'El nombre es requerido' : null),
    apellido: (value) => (!value?.trim() ? 'El apellido es requerido' : null),
    email: (value) => {
      const val = validarEmail(value);
      return val.valido ? null : val.mensaje;
    },
    rut: (value) => {
      const val = validarRUT(value);
      return val.valido ? null : val.mensaje;
    },
    telefono: (value) => {
      const val = validarTelefono(value);
      return val.valido ? null : val.mensaje;
    },
    password: (value) => {
      const val = validarPassword(value);
      return val.valido ? null : val.mensaje;
    },
    password_confirm: (value, allValues) => {
      const val = validarPasswordConfirm(allValues.password, value);
      return val.valido ? null : val.mensaje;
    }
  };

  // Hook de validación
  const {
    values: formData,
    errors,
    touched,
    isSubmitting,
    handleChange: baseHandleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    getFieldError
  } = useFormValidation(
    {
      fecha_reserva: '',
      hora_inicio: '',
      num_personas: 1,
      mesa: '',
      notas: '',
      nombre: '',
      apellido: '',
      telefono: '',
      rut: '',
      email: '',
      password: '',
      password_confirm: ''
    },
    validationRules,
    300
  );

  // Handle change personalizado para formateo
  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Formatear RUT y teléfono
    if (name === 'rut' && value) {
      processedValue = formatearRUT(value);
    }
    if (name === 'telefono' && value) {
      processedValue = formatearTelefono(value);
    }

    // Crear evento sintético con valor procesado
    const syntheticEvent = {
      target: {
        name,
        value: processedValue,
        type: e.target.type
      }
    };

    baseHandleChange(syntheticEvent);

    // Mostrar datos personales al seleccionar mesa
    if (name === 'mesa' && value) {
      setMostrarDatosPersonales(true);
    }
  };

  // Cargar horas disponibles
  useEffect(() => {
    if (formData.fecha_reserva && formData.num_personas) {
      cargarHorasDisponibles();
    } else {
      setHorasDisponibles([]);
      setHorasNoDisponibles([]);
    }
  }, [formData.fecha_reserva, formData.num_personas]);

  // Cargar mesas cuando hay fecha, hora y personas
  useEffect(() => {
    if (formData.fecha_reserva && formData.hora_inicio && formData.num_personas) {
      cargarMesasDisponibles();
    }
  }, [formData.fecha_reserva, formData.hora_inicio, formData.num_personas]);

  const cargarHorasDisponibles = async () => {
    try {
      setLoadingHoras(true);
      const data = await getHorasDisponibles({
        fecha: formData.fecha_reserva,
        personas: formData.num_personas
      });

      console.log('📅 DEBUG - Horas disponibles:', data);
      console.log('✅ Horas disponibles:', data.horas_disponibles?.length || 0, 'horas');
      console.log('❌ Horas NO disponibles:', data.horas_no_disponibles?.length || 0, 'horas', data.horas_no_disponibles);

      setHorasDisponibles(data.horas_disponibles || []);
      setHorasNoDisponibles(data.horas_no_disponibles || []);
      setHorasInfo(data.horas || []); // Guardar nueva estructura con cantidad de mesas

      if (formData.hora_inicio && data.horas_no_disponibles?.includes(formData.hora_inicio)) {
        setFieldValue('hora_inicio', '');
        toast.warning('La hora seleccionada ya no está disponible. Por favor seleccione otra.');
      }
    } catch (err) {
      console.error('Error al cargar horas disponibles:', err);
      setHorasDisponibles([]);
      setHorasNoDisponibles([]);
    } finally {
      setLoadingHoras(false);
    }
  };

  const cargarMesasDisponibles = async () => {
    try {
      setLoadingMesas(true);
      const data = await getMesas({
        fecha: formData.fecha_reserva,
        hora: formData.hora_inicio
      });
      const mesasFiltradas = data.filter(m => m.capacidad >= formData.num_personas);
      setMesas(mesasFiltradas);

      if (formData.mesa && !mesasFiltradas.find(m => m.id === parseInt(formData.mesa))) {
        setFieldValue('mesa', '');
        toast.warning('La mesa seleccionada ya no está disponible para esta fecha y hora. Por favor seleccione otra.');
      }
    } catch (err) {
      console.error('Error al cargar mesas:', err);
    } finally {
      setLoadingMesas(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Revalidar disponibilidad
      const mesasDisponiblesActuales = await getMesas({
        fecha: values.fecha_reserva,
        hora: values.hora_inicio
      });
      const mesasFiltradas = mesasDisponiblesActuales.filter(m => m.capacidad >= values.num_personas);
      const mesaAunDisponible = mesasFiltradas.find(m => m.id === parseInt(values.mesa));

      if (!mesaAunDisponible) {
        toast.error('Lo sentimos, la mesa seleccionada ya no está disponible. Por favor seleccione otra mesa.');
        await cargarMesasDisponibles();
        return;
      }

      // Registrar y reservar
      const result = await registerAndReserve(values);

      toast.success(`¡Reserva confirmada! Mesa ${result.reserva.mesa_numero} para el ${result.reserva.fecha_reserva}`);

      setTimeout(() => {
        if (onReservaExitosa) {
          try {
            onReservaExitosa(result);
          } catch (redirectErr) {
            console.error('Error al redirigir:', redirectErr);
          }
        }
      }, 2000);
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      toast.error(errorMsg);
      throw err;
    }
  });

  const getFechaMinima = () => new Date().toISOString().split('T')[0];

  const generarOpcionesHora = () => {
    const opciones = [];
    for (let hora = 12; hora <= 21; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 30) {
        const horaStr = String(hora).padStart(2, '0');
        const minutoStr = String(minuto).padStart(2, '0');
        opciones.push(`${horaStr}:${minutoStr}`);
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

              <form onSubmit={onSubmit}>
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
                        className={`form-control ${getFieldError('fecha_reserva') ? 'is-invalid' : touched.fecha_reserva ? 'is-valid' : ''}`}
                        id="fecha_reserva"
                        name="fecha_reserva"
                        value={formData.fecha_reserva}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        min={getFechaMinima()}
                        required
                      />
                      {getFieldError('fecha_reserva') && (
                        <div className="invalid-feedback d-block">{getFieldError('fecha_reserva')}</div>
                      )}
                    </div>

                    <div className="col-md-6 mb-3">
                      <label htmlFor="num_personas" className="form-label">
                        Número de Personas <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className={`form-control ${getFieldError('num_personas') ? 'is-invalid' : touched.num_personas ? 'is-valid' : ''}`}
                        id="num_personas"
                        name="num_personas"
                        value={formData.num_personas}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        min="1"
                        max="20"
                        required
                      />
                      {getFieldError('num_personas') && (
                        <div className="invalid-feedback d-block">{getFieldError('num_personas')}</div>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="hora_inicio" className="form-label">
                      Hora de la Reserva <span className="text-danger">*</span>
                    </label>
                    {loadingHoras ? (
                      <div className="text-center py-2">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Consultando disponibilidad...
                      </div>
                    ) : (
                      <>
                        <select
                          className={`form-select ${getFieldError('hora_inicio') ? 'is-invalid' : touched.hora_inicio ? 'is-valid' : ''}`}
                          id="hora_inicio"
                          name="hora_inicio"
                          value={formData.hora_inicio}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                          disabled={!formData.fecha_reserva}
                        >
                          <option value="">
                            {formData.fecha_reserva ? 'Seleccione una hora' : 'Primero seleccione una fecha'}
                          </option>
                          {horasInfo.length > 0 ? (
                            // Usar la nueva estructura con cantidad de mesas
                            horasInfo.map(({ hora, mesas_disponibles }) => {
                              const estaDisponible = mesas_disponibles > 0;
                              return (
                                <option key={hora} value={hora} disabled={!estaDisponible}>
                                  {hora} hrs - {estaDisponible
                                    ? `${mesas_disponibles} ${mesas_disponibles === 1 ? 'mesa disponible' : 'mesas disponibles'}`
                                    : 'No disponible'
                                  }
                                </option>
                              );
                            })
                          ) : (
                            // Fallback a la estructura antigua
                            generarOpcionesHora().map(hora => {
                              const estaDisponible = !horasNoDisponibles.includes(hora);
                              return (
                                <option key={hora} value={hora} disabled={!estaDisponible}>
                                  {hora} hrs {!estaDisponible ? '(No disponible)' : ''}
                                </option>
                              );
                            })
                          )}
                        </select>
                        {getFieldError('hora_inicio') && (
                          <div className="invalid-feedback d-block">{getFieldError('hora_inicio')}</div>
                        )}
                      </>
                    )}
                    <small className="text-info d-block mt-1">
                      <i className="bi bi-info-circle me-1"></i>
                      La reserva tendrá una duración de 2 horas
                    </small>
                    {formData.fecha_reserva && horasDisponibles.length === 0 && horasNoDisponibles.length > 0 && !loadingHoras && (
                      <small className="text-warning d-block mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        No hay horarios disponibles para esta fecha. Intente con otra fecha.
                      </small>
                    )}
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
                      <>
                        <select
                          className={`form-select ${getFieldError('mesa') ? 'is-invalid' : touched.mesa ? 'is-valid' : ''}`}
                          id="mesa"
                          name="mesa"
                          value={formData.mesa}
                          onChange={handleChange}
                          onBlur={handleBlur}
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
                        {getFieldError('mesa') && (
                          <div className="invalid-feedback d-block">{getFieldError('mesa')}</div>
                        )}
                      </>
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

                {/* Sección 2: Datos Personales */}
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
                          className={`form-control ${getFieldError('nombre') ? 'is-invalid' : touched.nombre ? 'is-valid' : ''}`}
                          id="nombre"
                          name="nombre"
                          value={formData.nombre}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                        />
                        {getFieldError('nombre') && (
                          <div className="invalid-feedback d-block">{getFieldError('nombre')}</div>
                        )}
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="apellido" className="form-label">
                          Apellido <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${getFieldError('apellido') ? 'is-invalid' : touched.apellido ? 'is-valid' : ''}`}
                          id="apellido"
                          name="apellido"
                          value={formData.apellido}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                        />
                        {getFieldError('apellido') && (
                          <div className="invalid-feedback d-block">{getFieldError('apellido')}</div>
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
                          className={`form-control ${getFieldError('telefono') ? 'is-invalid' : touched.telefono ? 'is-valid' : ''}`}
                          id="telefono"
                          name="telefono"
                          value={formData.telefono}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="+56 9 1234 5678"
                          required
                        />
                        {getFieldError('telefono') && (
                          <div className="invalid-feedback d-block">{getFieldError('telefono')}</div>
                        )}
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="rut" className="form-label">
                          RUT <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className={`form-control ${getFieldError('rut') ? 'is-invalid' : touched.rut ? 'is-valid' : ''}`}
                          id="rut"
                          name="rut"
                          value={formData.rut}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="12.345.678-9"
                          required
                        />
                        {getFieldError('rut') && (
                          <div className="invalid-feedback d-block">{getFieldError('rut')}</div>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-control ${getFieldError('email') ? 'is-invalid' : touched.email ? 'is-valid' : ''}`}
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                      />
                      {getFieldError('email') && (
                        <div className="invalid-feedback d-block">{getFieldError('email')}</div>
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
                            className={`form-control ${getFieldError('password') ? 'is-invalid' : touched.password ? 'is-valid' : ''}`}
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                            style={{ paddingRight: '40px' }}
                          />
                          <span
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '10px',
                              cursor: 'pointer',
                              color: '#6c757d'
                            }}
                            role="button"
                            tabIndex="-1"
                          >
                            <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                          </span>
                        </div>
                        {getFieldError('password') && (
                          <div className="invalid-feedback d-block">{getFieldError('password')}</div>
                        )}
                        <small className="text-muted">Mínimo 8 caracteres</small>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label htmlFor="password_confirm" className="form-label">
                          Confirmar Contraseña <span className="text-danger">*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPasswordConfirm ? "text" : "password"}
                            className={`form-control ${getFieldError('password_confirm') ? 'is-invalid' : touched.password_confirm ? 'is-valid' : ''}`}
                            id="password_confirm"
                            name="password_confirm"
                            value={formData.password_confirm}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                            style={{ paddingRight: '40px' }}
                          />
                          <span
                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '10px',
                              cursor: 'pointer',
                              color: '#6c757d'
                            }}
                            role="button"
                            tabIndex="-1"
                          >
                            <i className={`bi bi-eye${showPasswordConfirm ? '-slash' : ''}`}></i>
                          </span>
                        </div>
                        {getFieldError('password_confirm') && (
                          <div className="invalid-feedback d-block">{getFieldError('password_confirm')}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="d-grid">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={isSubmitting || !mostrarDatosPersonales}
                  >
                    {isSubmitting ? (
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
