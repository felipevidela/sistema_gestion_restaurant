import { useState, useEffect } from 'react';
import { createReserva, getMesas } from '../services/reservasApi';
import { validarSeleccionMesa } from '../utils/validaciones';

export default function FormularioReserva({ onReservaCreada }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    mesa: '',
    fecha_reserva: '',
    hora_inicio: '',
    num_personas: 1,
    notas: ''
  });

  // Cargar mesas disponibles al montar el componente
  useEffect(() => {
    cargarMesas();
  }, []);

  // Recargar mesas cuando cambia fecha u hora
  useEffect(() => {
    if (formData.fecha_reserva && formData.hora_inicio) {
      cargarMesasDisponibles();
    }
  }, [formData.fecha_reserva, formData.hora_inicio]);

  const cargarMesas = async () => {
    try {
      const data = await getMesas();
      setMesas(data);
    } catch (err) {
      console.error('Error al cargar mesas:', err);
      setError('Error al cargar mesas');
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
        setFormData(prev => ({ ...prev, mesa: '' }));
        setError('La mesa seleccionada ya no está disponible para esta fecha y hora. Por favor seleccione otra.');
      }
    } catch (err) {
      console.error('Error al cargar mesas disponibles:', err);
      // En caso de error, mostrar todas las mesas
      cargarMesas();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpiar mensajes al escribir
    setError('');
    setSuccess('');
  };

  // Obtener la capacidad de la mesa seleccionada
  const getMesaCapacidad = () => {
    if (!formData.mesa) return 20; // default max
    const mesaSeleccionada = mesas.find(m => m.id === parseInt(formData.mesa));
    return mesaSeleccionada ? mesaSeleccionada.capacidad : 20;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validar campos requeridos
      if (!formData.mesa || !formData.fecha_reserva || !formData.hora_inicio) {
        setError('Por favor complete todos los campos obligatorios');
        setLoading(false);
        return;
      }

      // Validar que la fecha no sea en el pasado
      const fechaHoy = new Date().toISOString().split('T')[0];
      if (formData.fecha_reserva < fechaHoy) {
        setError('No se pueden crear reservas para fechas pasadas');
        setLoading(false);
        return;
      }

      // FIX #31 (MENOR): Validación de selección de mesa
      const validacionMesa = validarSeleccionMesa(formData.mesa, mesas);
      if (!validacionMesa.valido) {
        setError(validacionMesa.mensaje);
        setLoading(false);
        return;
      }

      // Validar capacidad de la mesa
      const mesaSeleccionada = mesas.find(m => m.id === parseInt(formData.mesa));
      if (mesaSeleccionada && parseInt(formData.num_personas) > mesaSeleccionada.capacidad) {
        setError(`La mesa ${mesaSeleccionada.numero} tiene capacidad para ${mesaSeleccionada.capacidad} personas. No puede reservar para ${formData.num_personas} personas.`);
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
        const mesaAunDisponible = mesasDisponiblesActuales.find(m => m.id === parseInt(formData.mesa));

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
      // Guardar datos del formulario por si necesitamos restaurar
      const formDataBackup = { ...formData };

      try {
        // Paso 1: Crear la reserva (operación crítica)
        const reservaData = {
          mesa: parseInt(formData.mesa),
          fecha_reserva: formData.fecha_reserva,
          hora_inicio: formData.hora_inicio,
          num_personas: parseInt(formData.num_personas),
          notas: formData.notas
        };

        console.log('Enviando reserva:', reservaData);
        const nuevaReserva = await createReserva(reservaData);

        // Paso 2: Solo si la creación fue exitosa, ejecutar operaciones post-creación
        setSuccess('¡Reserva creada exitosamente!');

        // Paso 3: Limpiar formulario solo después de éxito
        setFormData({
          mesa: '',
          fecha_reserva: '',
          hora_inicio: '',
          num_personas: 1,
          notas: ''
        });

        // Paso 4: Recargar mesas (no crítico, puede fallar)
        try {
          await cargarMesas();
        } catch (reloadErr) {
          console.error('Error al recargar mesas, pero reserva creada exitosamente:', reloadErr);
          // No afecta el éxito de la operación principal
        }

        // Paso 5: Notificar al componente padre (solo si todo fue exitoso)
        if (onReservaCreada) {
          try {
            onReservaCreada(nuevaReserva);
          } catch (notifyErr) {
            console.error('Error al notificar componente padre:', notifyErr);
            // No afecta el éxito de la operación principal
          }
        }
      } catch (createErr) {
        // Si falla la creación, re-lanzar el error para que sea capturado por el catch externo
        throw createErr;
      }

    } catch (err) {
      console.error('Error completo:', err);
      setError(err.message || 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">Nueva Reserva</h5>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            {error}
            <button type="button" className="btn-close" onClick={() => setError('')}></button>
          </div>
        )}

        {success && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            {success}
            <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row">
            {/* Seleccionar Mesa */}
            <div className="col-md-6 mb-3">
              <label htmlFor="mesa" className="form-label">Mesa *</label>
              <select
                id="mesa"
                name="mesa"
                className="form-select"
                value={formData.mesa}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione una mesa</option>
                {mesas.map(mesa => (
                  <option key={mesa.id} value={mesa.id}>
                    Mesa {mesa.numero} - Capacidad: {mesa.capacidad} personas ({mesa.estado})
                  </option>
                ))}
              </select>
            </div>

            {/* Número de Personas */}
            <div className="col-md-6 mb-3">
              <label htmlFor="num_personas" className="form-label">Número de Personas *</label>
              <input
                type="number"
                id="num_personas"
                name="num_personas"
                className="form-control"
                value={formData.num_personas}
                onChange={handleChange}
                min="1"
                max={getMesaCapacidad()}
                required
              />
              {formData.mesa && (
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
                className="form-control"
                value={formData.fecha_reserva}
                onChange={handleChange}
                min={getMinDate()}
                required
              />
            </div>

            {/* Hora de la Reserva */}
            <div className="col-md-6 mb-3">
              <label htmlFor="hora_inicio" className="form-label">Hora de la Reserva *</label>
              <select
                id="hora_inicio"
                name="hora_inicio"
                className="form-select"
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
              <small className="text-info d-block mt-1">
                <i className="bi bi-info-circle me-1"></i>
                La reserva tendrá una duración de 2 horas
              </small>
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
              disabled={loading}
            >
              {loading ? (
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
    </div>
  );
}
