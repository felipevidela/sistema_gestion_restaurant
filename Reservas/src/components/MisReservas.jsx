import { useState, useEffect } from 'react';
import { getReservas, updateEstadoReserva, cancelarReserva } from '../services/reservasApi';

export default function MisReservas() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  useEffect(() => {
    cargarReservas();
    // Auto-actualizar cada 30 segundos
    const interval = setInterval(cargarReservas, 30000);
    return () => clearInterval(interval);
  }, [filtroEstado]);

  const cargarReservas = async () => {
    try {
      setLoading(true);
      const data = await getReservas({
        estado: filtroEstado !== 'TODOS' ? filtroEstado : undefined
      });
      setReservas(data);
      setError('');
    } catch (err) {
      setError('Error al cargar reservas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarReserva = async (reservaId) => {
    if (!confirm('¿Está seguro que desea cancelar esta reserva?')) {
      return;
    }

    try {
      await updateEstadoReserva({ id: reservaId, nuevoEstado: 'cancelada' });
      await cargarReservas();
      alert('Reserva cancelada exitosamente');
    } catch (err) {
      alert('Error al cancelar la reserva: ' + err.message);
    }
  };

  const getEstadoBadgeClass = (estado) => {
    const badges = {
      PENDIENTE: 'bg-warning',
      ACTIVA: 'bg-success',
      COMPLETADA: 'bg-secondary',
      CANCELADA: 'bg-danger'
    };
    return badges[estado] || 'bg-secondary';
  };

  const formatearFecha = (fecha) => {
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  if (loading && reservas.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando reservas...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Mis Reservas</h2>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={cargarReservas}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-1"></span>
              Actualizando...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Actualizar
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4">
        <div className="btn-group" role="group">
          {['TODOS', 'PENDIENTE', 'ACTIVA', 'COMPLETADA', 'CANCELADA'].map(estado => (
            <button
              key={estado}
              type="button"
              className={`btn ${filtroEstado === estado ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFiltroEstado(estado)}
            >
              {estado}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Reservas */}
      {reservas.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No tiene reservas {filtroEstado !== 'TODOS' ? `en estado ${filtroEstado.toLowerCase()}` : ''}.
        </div>
      ) : (
        <div className="row">
          {reservas.map(reserva => (
            <div key={reserva.id} className="col-md-6 col-lg-4 mb-3">
              <div className="card h-100 shadow-sm">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{reserva.mesa}</h5>
                  <span className={`badge ${getEstadoBadgeClass(reserva.estado)}`}>
                    {reserva.estado}
                  </span>
                </div>
                <div className="card-body">
                  <div className="mb-2">
                    <i className="bi bi-calendar3 me-2 text-primary"></i>
                    <strong>Fecha:</strong> {formatearFecha(reserva.fecha)}
                  </div>
                  <div className="mb-2">
                    <i className="bi bi-clock me-2 text-primary"></i>
                    <strong>Hora:</strong> {reserva.hora}
                  </div>
                  <div className="mb-2">
                    <i className="bi bi-people me-2 text-primary"></i>
                    <strong>Personas:</strong> {reserva.personas}
                  </div>
                </div>
                {reserva.estado === 'PENDIENTE' && (
                  <div className="card-footer bg-transparent">
                    <button
                      className="btn btn-sm btn-outline-danger w-100"
                      onClick={() => handleCancelarReserva(reserva.id)}
                    >
                      <i className="bi bi-x-circle me-1"></i>
                      Cancelar Reserva
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leyenda de Estados */}
      <div className="card mt-4">
        <div className="card-body">
          <h6 className="card-title">Leyenda de Estados:</h6>
          <div className="d-flex flex-wrap gap-3">
            <div>
              <span className="badge bg-warning me-2">PENDIENTE</span>
              <small>Reserva confirmada, esperando llegada</small>
            </div>
            <div>
              <span className="badge bg-success me-2">ACTIVA</span>
              <small>Mesa ocupada actualmente</small>
            </div>
            <div>
              <span className="badge bg-secondary me-2">COMPLETADA</span>
              <small>Reserva finalizada</small>
            </div>
            <div>
              <span className="badge bg-danger me-2">CANCELADA</span>
              <small>Reserva cancelada</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
