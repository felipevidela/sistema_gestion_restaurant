import { useState, useEffect } from 'react';
import { createReserva, getMesas } from '../services/reservasApi';

export default function FormularioReserva({ onReservaCreada }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    mesa: '',
    fecha_reserva: '',
    hora_inicio: '',
    hora_fin: '',
    num_personas: 1,
    notas: ''
  });

  // Cargar mesas disponibles al montar el componente
  useEffect(() => {
    cargarMesas();
  }, []);

  const cargarMesas = async () => {
    try {
      const data = await getMesas({ estado: 'disponible' });
      setMesas(data);
    } catch (err) {
      console.error('Error al cargar mesas:', err);
      // Si no hay mesas disponibles, cargar todas
      try {
        const todasMesas = await getMesas();
        setMesas(todasMesas);
      } catch (e) {
        setError('Error al cargar mesas');
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validar campos requeridos
      if (!formData.mesa || !formData.fecha_reserva || !formData.hora_inicio || !formData.hora_fin) {
        setError('Por favor complete todos los campos obligatorios');
        setLoading(false);
        return;
      }

      // Validar que hora_fin sea mayor que hora_inicio
      if (formData.hora_fin <= formData.hora_inicio) {
        setError('La hora de fin debe ser posterior a la hora de inicio');
        setLoading(false);
        return;
      }

      // Crear la reserva
      await createReserva({
        mesa: parseInt(formData.mesa),
        fecha_reserva: formData.fecha_reserva,
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        num_personas: parseInt(formData.num_personas),
        notas: formData.notas
      });

      setSuccess('¡Reserva creada exitosamente!');

      // Limpiar formulario
      setFormData({
        mesa: '',
        fecha_reserva: '',
        hora_inicio: '',
        hora_fin: '',
        num_personas: 1,
        notas: ''
      });

      // Recargar mesas
      cargarMesas();

      // Notificar al componente padre
      if (onReservaCreada) {
        onReservaCreada();
      }

    } catch (err) {
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
                max="20"
                required
              />
            </div>

            {/* Fecha de Reserva */}
            <div className="col-md-4 mb-3">
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

            {/* Hora de Inicio */}
            <div className="col-md-4 mb-3">
              <label htmlFor="hora_inicio" className="form-label">Hora de Inicio *</label>
              <input
                type="time"
                id="hora_inicio"
                name="hora_inicio"
                className="form-control"
                value={formData.hora_inicio}
                onChange={handleChange}
                required
              />
            </div>

            {/* Hora de Fin */}
            <div className="col-md-4 mb-3">
              <label htmlFor="hora_fin" className="form-label">Hora de Fin *</label>
              <input
                type="time"
                id="hora_fin"
                name="hora_fin"
                className="form-control"
                value={formData.hora_fin}
                onChange={handleChange}
                required
              />
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
