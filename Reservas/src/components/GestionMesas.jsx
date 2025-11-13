import { useState, useEffect } from 'react';
import { getMesas, updateEstadoMesa } from '../services/reservasApi';

export default function GestionMesas() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [mesaEditando, setMesaEditando] = useState(null);

  useEffect(() => {
    cargarMesas();
    // Auto-actualizar cada 30 segundos
    const interval = setInterval(cargarMesas, 30000);
    return () => clearInterval(interval);
  }, []);

  const cargarMesas = async () => {
    try {
      setLoading(true);
      const data = await getMesas();
      setMesas(data);
      setError('');
    } catch (err) {
      setError('Error al cargar mesas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (mesaId, nuevoEstado) => {
    try {
      await updateEstadoMesa({ id: mesaId, nuevoEstado });
      await cargarMesas();
      setMesaEditando(null);
      alert('Estado de la mesa actualizado correctamente');
    } catch (err) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  const getEstadoColor = (estado) => {
    const colores = {
      disponible: 'success',
      reservada: 'warning',
      ocupada: 'danger',
      limpieza: 'info'
    };
    return colores[estado] || 'secondary';
  };

  const getEstadoIcon = (estado) => {
    const iconos = {
      disponible: 'bi-check-circle',
      reservada: 'bi-clock',
      ocupada: 'bi-people-fill',
      limpieza: 'bi-droplet'
    };
    return iconos[estado] || 'bi-question-circle';
  };

  const mesasFiltradas = filtroEstado === 'TODOS'
    ? mesas
    : mesas.filter(m => m.estado === filtroEstado.toLowerCase());

  if (loading && mesas.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando mesas...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Gestión de Mesas</h2>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={cargarMesas}
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
          <button
            type="button"
            className={`btn ${filtroEstado === 'TODOS' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setFiltroEstado('TODOS')}
          >
            TODOS
          </button>
          <button
            type="button"
            className={`btn ${filtroEstado === 'DISPONIBLE' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setFiltroEstado('DISPONIBLE')}
          >
            DISPONIBLE
          </button>
          <button
            type="button"
            className={`btn ${filtroEstado === 'RESERVADA' ? 'btn-warning' : 'btn-outline-warning'}`}
            onClick={() => setFiltroEstado('RESERVADA')}
          >
            RESERVADA
          </button>
          <button
            type="button"
            className={`btn ${filtroEstado === 'OCUPADA' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setFiltroEstado('OCUPADA')}
          >
            OCUPADA
          </button>
          <button
            type="button"
            className={`btn ${filtroEstado === 'LIMPIEZA' ? 'btn-info' : 'btn-outline-info'}`}
            onClick={() => setFiltroEstado('LIMPIEZA')}
          >
            EN LIMPIEZA
          </button>
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-success">
            <div className="card-body text-center">
              <h5 className="text-success">{mesas.filter(m => m.estado === 'disponible').length}</h5>
              <small className="text-muted">Disponibles</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-warning">
            <div className="card-body text-center">
              <h5 className="text-warning">{mesas.filter(m => m.estado === 'reservada').length}</h5>
              <small className="text-muted">Reservadas</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-danger">
            <div className="card-body text-center">
              <h5 className="text-danger">{mesas.filter(m => m.estado === 'ocupada').length}</h5>
              <small className="text-muted">Ocupadas</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-info">
            <div className="card-body text-center">
              <h5 className="text-info">{mesas.filter(m => m.estado === 'limpieza').length}</h5>
              <small className="text-muted">En Limpieza</small>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Mesas */}
      {mesasFiltradas.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No hay mesas {filtroEstado !== 'TODOS' ? `en estado ${filtroEstado.toLowerCase()}` : ''}.
        </div>
      ) : (
        <div className="row">
          {mesasFiltradas.map(mesa => (
            <div key={mesa.id} className="col-md-6 col-lg-4 col-xl-3 mb-3">
              <div className={`card h-100 shadow-sm border-${getEstadoColor(mesa.estado)}`}>
                <div className={`card-header bg-${getEstadoColor(mesa.estado)} text-white d-flex justify-content-between align-items-center`}>
                  <h5 className="mb-0">
                    <i className={`bi ${getEstadoIcon(mesa.estado)} me-2`}></i>
                    Mesa {mesa.numero}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="mb-2">
                    <i className="bi bi-people me-2 text-primary"></i>
                    <strong>Capacidad:</strong> {mesa.capacidad} personas
                  </div>
                  <div className="mb-3">
                    <i className="bi bi-info-circle me-2 text-primary"></i>
                    <strong>Estado:</strong>{' '}
                    <span className={`badge bg-${getEstadoColor(mesa.estado)}`}>
                      {mesa.estado.toUpperCase()}
                    </span>
                  </div>

                  {mesaEditando === mesa.id ? (
                    <div>
                      <p className="mb-2"><strong>Cambiar estado a:</strong></p>
                      <div className="d-grid gap-2">
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleCambiarEstado(mesa.id, 'disponible')}
                          disabled={mesa.estado === 'disponible'}
                        >
                          Disponible
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleCambiarEstado(mesa.id, 'reservada')}
                          disabled={mesa.estado === 'reservada'}
                        >
                          Reservada
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleCambiarEstado(mesa.id, 'ocupada')}
                          disabled={mesa.estado === 'ocupada'}
                        >
                          Ocupada
                        </button>
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => handleCambiarEstado(mesa.id, 'limpieza')}
                          disabled={mesa.estado === 'limpieza'}
                        >
                          En Limpieza
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setMesaEditando(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="d-grid">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setMesaEditando(mesa.id)}
                      >
                        <i className="bi bi-pencil me-1"></i>
                        Cambiar Estado
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leyenda de Estados */}
      <div className="card mt-4">
        <div className="card-body">
          <h6 className="card-title">Leyenda de Estados:</h6>
          <div className="row">
            <div className="col-md-3">
              <span className="badge bg-success me-2">DISPONIBLE</span>
              <small className="text-muted">Mesa lista para uso</small>
            </div>
            <div className="col-md-3">
              <span className="badge bg-warning me-2">RESERVADA</span>
              <small className="text-muted">Mesa con reserva confirmada</small>
            </div>
            <div className="col-md-3">
              <span className="badge bg-danger me-2">OCUPADA</span>
              <small className="text-muted">Mesa ocupada actualmente</small>
            </div>
            <div className="col-md-3">
              <span className="badge bg-info me-2">EN LIMPIEZA</span>
              <small className="text-muted">Mesa siendo limpiada</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
