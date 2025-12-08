import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verReservaInvitado, cancelarReservaInvitado } from '../services/reservasApi';
import { useToast } from '../contexts/ToastContext';

export default function AccesoReservaInvitado() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [reserva, setReserva] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [puedeActivarCuenta, setPuedeActivarCuenta] = useState(false);
  const [error, setError] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  useEffect(() => {
    cargarReserva();
  }, [token]);

  const cargarReserva = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await verReservaInvitado(token);

      setReserva(data.reserva);
      setCliente(data.cliente);
      setPuedeActivarCuenta(data.puede_activar_cuenta);
    } catch (err) {
      console.error('Error al cargar reserva:', err);
      setError(err.message || 'Error al cargar la reserva');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarReserva = async () => {
    try {
      setCancelando(true);
      await cancelarReservaInvitado(token);

      toast.success('Reserva cancelada exitosamente');

      setTimeout(() => {
        navigate('/reserva');
      }, 2000);
    } catch (err) {
      console.error('Error al cancelar reserva:', err);
      toast.error(err.message || 'Error al cancelar la reserva');
    } finally {
      setCancelando(false);
      setMostrarConfirmacion(false);
    }
  };

  const handleActivarCuenta = () => {
    navigate(`/activar-cuenta/${token}`);
  };

  if (loading) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="mt-3">Cargando información de tu reserva...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card border-danger">
              <div className="card-body text-center py-5">
                <i className="bi bi-exclamation-triangle text-danger" style={{ fontSize: '3rem' }}></i>
                <h3 className="mt-3 text-danger">Error al cargar la reserva</h3>
                <p className="text-muted">{error}</p>
                {error.includes('expirado') && (
                  <small className="text-muted d-block mt-2">
                    Los links de acceso son válidos por 48 horas. Si necesitas ayuda, contacta al restaurante.
                  </small>
                )}
                <div className="mt-4">
                  <button
                    className="btn btn-primary me-2"
                    onClick={() => navigate('/reserva')}
                  >
                    <i className="bi bi-calendar-plus me-2"></i>
                    Hacer nueva reserva
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/')}
                  >
                    <i className="bi bi-house me-2"></i>
                    Ir al inicio
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          {/* Banner de activación de cuenta */}
          {puedeActivarCuenta && (
            <div className="alert alert-info mb-4" role="alert">
              <div className="d-flex align-items-center">
                <i className="bi bi-star-fill me-3" style={{ fontSize: '2rem' }}></i>
                <div className="flex-grow-1">
                  <h5 className="alert-heading mb-1">¡Crea tu cuenta!</h5>
                  <p className="mb-2">Gestiona todas tus reservas fácilmente</p>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleActivarCuenta}
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Activar mi cuenta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detalles de la reserva */}
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }}></i>
                <h2 className="fw-bold text-success mt-2">Reserva Confirmada</h2>
                <p className="text-muted">Detalles de tu reserva</p>
              </div>

              <div className="border-top pt-4">
                <h5 className="mb-3">📅 Información de la Reserva</h5>

                <div className="row mb-3">
                  <div className="col-6">
                    <strong>Mesa:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {reserva.mesa_numero}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <strong>Fecha:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {new Date(reserva.fecha_reserva).toLocaleDateString('es-CL')}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <strong>Hora:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {reserva.hora_inicio} - {reserva.hora_fin}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <strong>Personas:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {reserva.num_personas}
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-6">
                    <strong>Estado:</strong>
                  </div>
                  <div className="col-6 text-end">
                    <span className={`badge bg-${reserva.estado === 'activa' ? 'success' : 'warning'}`}>
                      {reserva.estado}
                    </span>
                  </div>
                </div>

                {reserva.notas && (
                  <div className="row mb-3">
                    <div className="col-12">
                      <strong>Notas:</strong>
                      <p className="text-muted mb-0 mt-1">{reserva.notas}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-top pt-4 mt-4">
                <h5 className="mb-3">👤 Datos del Cliente</h5>

                <div className="row mb-2">
                  <div className="col-6">
                    <strong>Nombre:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {cliente.nombre_completo}
                  </div>
                </div>

                <div className="row mb-2">
                  <div className="col-6">
                    <strong>Email:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {cliente.email}
                  </div>
                </div>

                <div className="row mb-2">
                  <div className="col-6">
                    <strong>Teléfono:</strong>
                  </div>
                  <div className="col-6 text-end">
                    {cliente.telefono}
                  </div>
                </div>
              </div>

              <div className="d-grid gap-2 mt-4">
                {!mostrarConfirmacion ? (
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => setMostrarConfirmacion(true)}
                    disabled={reserva.estado === 'cancelada'}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Cancelar Reserva
                  </button>
                ) : (
                  <div className="alert alert-warning">
                    <p className="mb-2">¿Estás seguro que deseas cancelar esta reserva?</p>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-danger flex-grow-1"
                        onClick={handleCancelarReserva}
                        disabled={cancelando}
                      >
                        {cancelando ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Cancelando...
                          </>
                        ) : (
                          'Sí, cancelar'
                        )}
                      </button>
                      <button
                        className="btn btn-secondary flex-grow-1"
                        onClick={() => setMostrarConfirmacion(false)}
                        disabled={cancelando}
                      >
                        No, mantener
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-outline-primary"
                  onClick={() => navigate('/reserva')}
                >
                  <i className="bi bi-calendar-plus me-2"></i>
                  Hacer otra reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
