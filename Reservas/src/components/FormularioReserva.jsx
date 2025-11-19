import { useState, useEffect } from 'react';
import { getMesas, getHorasDisponibles, createReserva } from '../services/reservasApi';
import { validarSeleccionMesa } from '../utils/validaciones';
import { useFormValidation } from '../hooks/useFormValidation';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../utils/errorMessages';
import { FormSkeleton } from './ui/Skeleton';
import ModalConfirmacionReserva from './ui/ModalConfirmacionReserva';

export default function FormularioReserva({ onReservaCreada }) {
  const toast = useToast();
  const [mesas, setMesas] = useState([]);
  const [loadingMesas, setLoadingMesas] = useState(true);
  const [loadingHoras, setLoadingHoras] = useState(false);
  const [horasDisponibles, setHorasDisponibles] = useState([]);
  const [horasNoDisponibles, setHorasNoDisponibles] = useState([]);
  const [horasInfo, setHorasInfo] = useState([]); // Nueva estructura: [{hora, mesas_disponibles}]
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [datosReservaConfirmada, setDatosReservaConfirmada] = useState(null);

  // Reglas de validación
  const validationRules = {
    mesa: (value) => {
      if (!value) return 'Debe seleccionar una mesa';
      const validacion = validarSeleccionMesa(value, mesas);
      return validacion.valido ? null : validacion.mensaje;
    },
    fecha_reserva: (value) => {
      if (!value) return 'Debe seleccionar una fecha';
      const fechaHoy = new Date().toISOString().split('T')[0];
      if (value < fechaHoy) return 'No se pueden crear reservas para fechas pasadas';
      return null;
    },
    hora_inicio: (value) => {
      if (!value) return 'Debe seleccionar una hora';
      if (horasNoDisponibles.includes(value)) {
        return 'Esta hora ya no está disponible';
      }
      return null;
    },
    num_personas: (value, allValues) => {
      if (!value || value < 1) return 'Debe especificar al menos 1 persona';
      if (allValues.mesa) {
        const mesaSeleccionada = mesas.find(m => m.id === parseInt(allValues.mesa));
        if (mesaSeleccionada && parseInt(value) > mesaSeleccionada.capacidad) {
          return `La mesa seleccionada tiene capacidad para ${mesaSeleccionada.capacidad} personas`;
        }
      }
      return null;
    }
  };

  // Hook de validación de formulario
  const {
    values: formData,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    getFieldError
  } = useFormValidation(
    {
      mesa: '',
      fecha_reserva: '',
      hora_inicio: '',
      num_personas: '',
      notas: ''
    },
    validationRules,
    300
  );

  // Cargar mesas disponibles al montar el componente
  useEffect(() => {
    cargarMesas();
  }, []);

  // Cargar horas disponibles - solo cuando AMBOS campos estén tocados
  useEffect(() => {
    // Solo buscar si AMBOS campos tienen valor Y han sido tocados por el usuario
    const ambosCompletos = formData.fecha_reserva && formData.num_personas;
    const ambosInteractuados = touched.fecha_reserva && touched.num_personas;

    if (ambosCompletos && ambosInteractuados) {
      cargarHorasDisponibles();
    } else {
      setHorasDisponibles([]);
      setHorasNoDisponibles([]);
      setHorasInfo([]);
    }
  }, [formData.fecha_reserva, formData.num_personas, touched.fecha_reserva, touched.num_personas]);

  // Recargar mesas cuando cambia fecha u hora
  useEffect(() => {
    if (formData.fecha_reserva && formData.hora_inicio) {
      cargarMesasDisponibles();
    }
  }, [formData.fecha_reserva, formData.hora_inicio]);

  const cargarMesas = async () => {
    try {
      setLoadingMesas(true);
      const data = await getMesas();
      setMesas(data);
    } catch (err) {
      console.error('Error al cargar mesas:', err);
      toast.error('Error al cargar mesas');
    } finally {
      setLoadingMesas(false);
    }
  };

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

      // Si la hora seleccionada ya no está disponible, limpiarla
      if (formData.hora_inicio && data.horas_no_disponibles?.includes(formData.hora_inicio)) {
        setFieldValue('hora_inicio', '');
        toast.warning('La hora seleccionada ya no está disponible. Por favor seleccione otra.');
      }
    } catch (err) {
      console.error('Error al cargar horas disponibles:', err);
      // En caso de error, fallback a todas las horas
      setHorasDisponibles([]);
      setHorasNoDisponibles([]);
    } finally {
      setLoadingHoras(false);
    }
  };

  const cargarMesasDisponibles = async () => {
    try {
      const data = await getMesas({
        fecha: formData.fecha_reserva,
        hora: formData.hora_inicio
      });
      setMesas(data);

      // Si la mesa seleccionada ya no está disponible, limpiar selección
      if (formData.mesa && !data.find(m => m.id === parseInt(formData.mesa))) {
        setFieldValue('mesa', '');
        toast.warning('La mesa seleccionada ya no está disponible para esta fecha y hora. Por favor seleccione otra.');
      }
    } catch (err) {
      console.error('Error al cargar mesas disponibles:', err);
      // En caso de error, mostrar todas las mesas
      cargarMesas();
    }
  };

  // Obtener la capacidad de la mesa seleccionada
  const getMesaCapacidad = () => {
    if (!formData.mesa) return 20; // default max
    const mesaSeleccionada = mesas.find(m => m.id === parseInt(formData.mesa));
    return mesaSeleccionada ? mesaSeleccionada.capacidad : 20;
  };

  // Manejar cierre del modal de confirmación
  const handleCloseModalConfirmacion = () => {
    setMostrarModalConfirmacion(false);

    // Notificar al componente padre después de cerrar
    setTimeout(() => {
      if (onReservaCreada && window._nuevaReserva) {
        try {
          onReservaCreada(window._nuevaReserva);
          window._nuevaReserva = null;
        } catch (notifyErr) {
          console.error('Error al notificar componente padre:', notifyErr);
        }
      }
    }, 300);
  };

  // Manejar el submit usando el hook de validación
  const onSubmit = handleSubmit(async (values) => {
    try {
      // FIX #25 (MODERADO): Revalidar disponibilidad antes de submit
      const mesasDisponiblesActuales = await getMesas({
        fecha: values.fecha_reserva,
        hora: values.hora_inicio
      });
      const mesaAunDisponible = mesasDisponiblesActuales.find(m => m.id === parseInt(values.mesa));

      if (!mesaAunDisponible) {
        toast.error('Lo sentimos, la mesa seleccionada ya no está disponible. Por favor seleccione otra mesa.');
        await cargarMesasDisponibles();
        return;
      }

      // Crear la reserva
      const reservaData = {
        mesa: parseInt(values.mesa),
        fecha_reserva: values.fecha_reserva,
        hora_inicio: values.hora_inicio,
        num_personas: parseInt(values.num_personas),
        notas: values.notas
      };

      console.log('Enviando reserva:', reservaData);

      const nuevaReserva = await createReserva(reservaData);

      // Preparar datos para el modal (nota: usuarios registrados ya tienen perfil cargado)
      const datosReserva = {
        id: nuevaReserva.id,
        mesa_numero: nuevaReserva.mesa_numero || nuevaReserva.mesa,
        mesa_capacidad: values.num_personas,
        fecha_reserva: nuevaReserva.fecha_reserva,
        hora_inicio: nuevaReserva.hora_inicio,
        hora_fin: nuevaReserva.hora_fin,
        num_personas: nuevaReserva.num_personas
      };

      // Abrir modal de confirmación
      setDatosReservaConfirmada(datosReserva);
      setMostrarModalConfirmacion(true);

      toast.success('¡Reserva creada exitosamente!');

      // Recargar mesas
      try {
        await cargarMesas();
      } catch (reloadErr) {
        console.error('Error al recargar mesas:', reloadErr);
      }

      // Guardar para callback posterior
      window._nuevaReserva = nuevaReserva;
    } catch (err) {
      console.error('Error completo:', err);
      const errorMsg = formatErrorMessage(err);
      toast.error(errorMsg);
      throw err;
    }
  });

  // Obtener fecha mínima (hoy)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
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

  // Mostrar skeleton mientras cargan las mesas
  if (loadingMesas) {
    return (
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Nueva Reserva</h5>
        </div>
        <div className="card-body">
          <FormSkeleton fields={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">Nueva Reserva</h5>
      </div>
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <div className="row">
            {/* Seleccionar Mesa */}
            <div className="col-md-6 mb-3">
              <label htmlFor="mesa" className="form-label">Mesa *</label>
              <select
                id="mesa"
                name="mesa"
                className={`form-select ${getFieldError('mesa') ? 'is-invalid' : touched.mesa ? 'is-valid' : ''}`}
                value={formData.mesa}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              >
                <option value="">Seleccione una mesa</option>
                {mesas.map(mesa => (
                  <option key={mesa.id} value={mesa.id}>
                    Mesa {mesa.numero} - Capacidad: {mesa.capacidad} personas ({mesa.estado})
                  </option>
                ))}
              </select>
              {getFieldError('mesa') && (
                <div className="invalid-feedback d-block">
                  {getFieldError('mesa')}
                </div>
              )}
            </div>

            {/* Número de Personas */}
            <div className="col-md-6 mb-3">
              <label htmlFor="num_personas" className="form-label">Número de Personas *</label>
              <input
                type="number"
                id="num_personas"
                name="num_personas"
                className={`form-control ${getFieldError('num_personas') ? 'is-invalid' : touched.num_personas ? 'is-valid' : ''}`}
                value={formData.num_personas}
                onChange={handleChange}
                onBlur={handleBlur}
                min="1"
                max={getMesaCapacidad()}
                required
              />
              {getFieldError('num_personas') && (
                <div className="invalid-feedback d-block">
                  {getFieldError('num_personas')}
                </div>
              )}
              {formData.mesa && !getFieldError('num_personas') && (
                <small className="text-muted">
                  Capacidad máxima de la mesa: {getMesaCapacidad()} personas
                </small>
              )}
            </div>

            {/* Fecha de Reserva */}
            <div className="col-md-6 mb-3">
              <label htmlFor="fecha_reserva" className="form-label">Fecha *</label>
              <input
                type="date"
                id="fecha_reserva"
                name="fecha_reserva"
                className={`form-control ${getFieldError('fecha_reserva') ? 'is-invalid' : touched.fecha_reserva ? 'is-valid' : ''}`}
                value={formData.fecha_reserva}
                onChange={handleChange}
                onBlur={handleBlur}
                min={getMinDate()}
                required
              />
              {getFieldError('fecha_reserva') && (
                <div className="invalid-feedback d-block">
                  {getFieldError('fecha_reserva')}
                </div>
              )}
            </div>

            {/* Hora de la Reserva */}
            <div className="col-md-6 mb-3">
              <label htmlFor="hora_inicio" className="form-label">Hora de la Reserva *</label>
              {loadingHoras ? (
                <div className="form-control text-center">
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Consultando disponibilidad...
                </div>
              ) : (
                <>
                  <select
                    id="hora_inicio"
                    name="hora_inicio"
                    className={`form-select ${getFieldError('hora_inicio') ? 'is-invalid' : touched.hora_inicio ? 'is-valid' : ''}`}
                    value={formData.hora_inicio}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={!formData.fecha_reserva || !formData.num_personas}
                    required
                  >
                    <option value="">
                      {formData.fecha_reserva && formData.num_personas ? 'Seleccione una hora' : 'Primero seleccione fecha y número de personas'}
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
                    <div className="invalid-feedback d-block">
                      {getFieldError('hora_inicio')}
                    </div>
                  )}
                </>
              )}
              <small className="text-info d-block mt-1">
                <i className="bi bi-info-circle me-1"></i>
                La reserva tendrá una duración de 2 horas
              </small>
              {formData.fecha_reserva && formData.num_personas && horasDisponibles.length === 0 && horasNoDisponibles.length > 0 && !loadingHoras && (
                <small className="text-warning d-block mt-1">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  No hay horarios disponibles para esta fecha y número de personas. Intente con otra fecha.
                </small>
              )}
            </div>

            {/* Notas */}
            <div className="col-12 mb-3">
              <label htmlFor="notas" className="form-label">Notas o Requerimientos Especiales</label>
              <textarea
                id="notas"
                name="notas"
                className="form-control"
                rows="3"
                value={formData.notas}
                onChange={handleChange}
                placeholder="Ej: Celebración de cumpleaños, restricciones alimentarias, etc."
              ></textarea>
            </div>
          </div>

          <div className="d-grid gap-2">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Creando reserva...
                </>
              ) : (
                'Crear Reserva'
              )}
            </button>
          </div>

          <small className="text-muted d-block mt-2">
            * Campos obligatorios
          </small>
        </form>
      </div>

      {/* Modal de Confirmación */}
      <ModalConfirmacionReserva
        isOpen={mostrarModalConfirmacion}
        onClose={handleCloseModalConfirmacion}
        reservaData={datosReservaConfirmada}
        clienteData={null} // Para usuarios registrados, no mostramos datos del cliente
        esInvitado={false}
      />
    </div>
  );
}
