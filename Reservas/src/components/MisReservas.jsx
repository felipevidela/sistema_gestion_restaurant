import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, ButtonGroup, Alert, Badge, Spinner } from 'react-bootstrap';
import { getReservas, updateEstadoReserva } from '../services/reservasApi';
import { ConfirmModal } from './ui/Modal';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../utils/errorMessages';
import { ReservaSkeleton } from './ui/Skeleton';

export default function MisReservas() {
  const toast = useToast();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [cancelModal, setCancelModal] = useState({ isOpen: false, reservaId: null, isLoading: false });

  const cargarReservas = useCallback(async () => {
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
  }, [filtroEstado]);

  useEffect(() => {
    cargarReservas();
    // Auto-actualizar cada 30 segundos
    const interval = setInterval(cargarReservas, 30000);
    return () => clearInterval(interval);
  }, [cargarReservas]);

  const handleCancelarReserva = (reservaId) => {
    setCancelModal({ isOpen: true, reservaId, isLoading: false });
  };

  const confirmCancelarReserva = async () => {
    try {
      setCancelModal(prev => ({ ...prev, isLoading: true }));
      await updateEstadoReserva({ id: cancelModal.reservaId, nuevoEstado: 'cancelada' });
      await cargarReservas();
      toast.success('Reserva cancelada exitosamente');
      setCancelModal({ isOpen: false, reservaId: null, isLoading: false });
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      toast.error(errorMsg);
      setCancelModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const estadoTag = (estado) => {
    const base = (estado || '').toLowerCase();
    return `estado-chip estado-chip--${base}`;
  };
  const estadoIconos = {
    PENDIENTE: 'bi-clock-history',
    ACTIVA: 'bi-lightning-charge-fill',
    COMPLETADA: 'bi-check2-circle',
    CANCELADA: 'bi-x-octagon-fill'
  };

  const formatearFecha = (fecha) => {
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatearHora = (hora) => {
    // Asegurar formato 24 horas HH:MM (quitar segundos si los hay)
    if (!hora) return '';
    return hora.substring(0, 5);
  };

  if (loading && reservas.length === 0) {
    return (
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Mis Reservas</h2>
        </div>
        <div className="mb-4">
          <ButtonGroup>
            {['TODOS', 'PENDIENTE', 'ACTIVA', 'COMPLETADA', 'CANCELADA'].map(estado => (
              <Button
                key={estado}
                variant="outline-primary"
                disabled
              >
                {estado}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <Row>
          {[1, 2, 3].map(i => (
            <ReservaSkeleton key={i} />
          ))}
        </Row>
      </Container>
    );
  }

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Mis Reservas</h2>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={cargarReservas}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              Actualizando...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Actualizar
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filtros */}
      <div className="mb-4">
        <ButtonGroup>
          {['TODOS', 'PENDIENTE', 'ACTIVA', 'COMPLETADA', 'CANCELADA'].map(estado => (
            <Button
              key={estado}
              variant={filtroEstado === estado ? 'primary' : 'outline-primary'}
              onClick={() => setFiltroEstado(estado)}
            >
              {estado}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* Lista de Reservas */}
      {reservas.length === 0 ? (
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          No tiene reservas {filtroEstado !== 'TODOS' ? `en estado ${filtroEstado.toLowerCase()}` : ''}.
        </Alert>
      ) : (
        <Row>
          {reservas.map(reserva => (
            <Col key={reserva.id} md={6} lg={4} className="mb-3">
              <Card className="h-100 shadow-sm reserva-card">
                <Card.Body className="d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <p className="text-muted small mb-1">Mesa</p>
                      <h5 className="mb-0">{reserva.mesa}</h5>
                    </div>
                    <span className={estadoTag(reserva.estado)}>
                      <i className={`bi ${estadoIconos[reserva.estado] || 'bi-info-circle'} me-2`}></i>
                      {reserva.estado}
                    </span>
                  </div>

                  <div className="reserva-card__timeline">
                    <div className="reserva-card__timeline-icon">
                      <i className="bi bi-calendar3"></i>
                    </div>
                    <div>
                      <p className="mb-0 fw-semibold">{formatearFecha(reserva.fecha)}</p>
                      <small className="text-muted">Fecha reservada</small>
                    </div>
                  </div>

                  <div className="reserva-card__timeline">
                    <div className="reserva-card__timeline-icon text-primary">
                      <i className="bi bi-clock-history"></i>
                    </div>
                    <div>
                      <p className="mb-0 fw-semibold">{formatearHora(reserva.hora)} hrs</p>
                      <small className="text-muted">Horario estimado</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 mt-3">
                    <Badge pill bg="" className="badge-soft-primary">
                      <i className="bi bi-people-fill me-1"></i>
                      {reserva.personas} {reserva.personas === 1 ? 'persona' : 'personas'}
                    </Badge>
                    <Badge pill bg="light" text="muted">
                      ID #{reserva.id}
                    </Badge>
                  </div>

                  {reserva.estado === 'PENDIENTE' ? (
                    <div className="mt-auto pt-3">
                      <Button
                        variant=""
                        className="btn-soft-danger w-100"
                        onClick={() => handleCancelarReserva(reserva.id)}
                      >
                        <i className="bi bi-x-circle me-2"></i>
                        Cancelar Reserva
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-auto pt-3 text-muted small">
                      Última actualización: {formatearFecha(reserva.fecha)}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Leyenda de Estados */}
      <Card className="mt-4">
        <Card.Body>
          <Card.Title as="h6">Leyenda de Estados:</Card.Title>
          <div className="d-flex flex-wrap gap-3">
            <div>
              <Badge bg="warning" className="me-2">PENDIENTE</Badge>
              <small>Reserva confirmada, esperando llegada</small>
            </div>
            <div>
              <Badge bg="success" className="me-2">ACTIVA</Badge>
              <small>Mesa ocupada actualmente</small>
            </div>
            <div>
              <Badge bg="secondary" className="me-2">COMPLETADA</Badge>
              <small>Reserva finalizada</small>
            </div>
            <div>
              <Badge bg="danger" className="me-2">CANCELADA</Badge>
              <small>Reserva cancelada</small>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Modal de confirmación para cancelar reserva */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, reservaId: null, isLoading: false })}
        onConfirm={confirmCancelarReserva}
        title="Cancelar Reserva"
        message="¿Está seguro que desea cancelar esta reserva? Esta acción no se puede deshacer."
        confirmText="Sí, cancelar"
        cancelText="No, mantener"
        confirmVariant="danger"
        isLoading={cancelModal.isLoading}
      />
    </Container>
  );
}
