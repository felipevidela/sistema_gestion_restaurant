import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Row, Col, Card, Badge, Button, Spinner, Alert,
  ButtonGroup, Modal, OverlayTrigger, Tooltip
} from 'react-bootstrap';
import {
  getColaCocina, getPedidosUrgentes, cambiarEstadoPedido,
  ESTADOS_PEDIDO, puedeTransicionar
} from '../../services/cocinaApi';
import { useCocinaWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../contexts/AuthContext';

// Estilos CSS para animaciones del panel de cocina
const styles = `
  .pedido-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    will-change: transform;
  }
  .pedido-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
  }
  .pedido-urgente {
    animation: pulseUrgente 1.5s ease-in-out infinite;
    will-change: transform, box-shadow;
  }
  @keyframes pulseUrgente {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
    }
  }
  .timer-urgente {
    font-weight: bold;
    animation: timerPulse 1s ease-in-out infinite;
  }
  @keyframes timerPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .connection-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.5rem;
    transition: background-color 0.2s ease;
  }
  .connection-indicator:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  .connection-dot {
    font-size: 0.6rem;
    transition: color 0.3s ease;
  }
  .connection-dot-success { color: #198754; }
  .connection-dot-warning { color: #ffc107; }
  .connection-dot-danger { color: #dc3545; }
  .connection-dot-secondary { color: #6c757d; }
  .contador-animado {
    display: inline-block;
    transition: transform 0.3s ease;
  }
  .contador-animado.changed {
    animation: counterBounce 0.3s ease;
  }
  @keyframes counterBounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
  .summary-card {
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .summary-card:hover {
    transform: translateY(-2px);
  }
  .estado-transition {
    animation: fadeInScale 0.3s ease;
  }
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
`;

/**
 * Panel de cocina con cola de pedidos en tiempo real
 */
function PanelCocina() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todos'); // todos, urgentes, en_preparacion
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const disconnectionTimerRef = useRef(null);

  // WebSocket para actualizaciones en tiempo real
  const { isConnected, connectionStatus } = useCocinaWebSocket({
    enabled: true,
    onPedidoCreado: async (data) => {
      // Agregar nuevo pedido a la cola
      await cargarPedidos();
      setLastUpdateTime(new Date());
    },
    onPedidoActualizado: (data) => {
      // Actualizar pedido en la lista
      setPedidos(prev => prev.map(p =>
        p.id === data.id ? { ...p, ...data } : p
      ));
      setLastUpdateTime(new Date());
    }
  });

  // Cargar pedidos
  const cargarPedidos = useCallback(async () => {
    try {
      setError(null);
      const data = await getColaCocina({ horas_recientes: 3 });
      setPedidos(data || []);
      setLastUpdateTime(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();

    // Solo polling si WebSocket NO conectado
    let interval;
    if (!isConnected) {
      interval = setInterval(cargarPedidos, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cargarPedidos, isConnected]);

  // Timer para mostrar indicador solo después de 10s de desconexión
  useEffect(() => {
    // Si está conectado, ocultar inmediatamente y cancelar timer
    if (isConnected) {
      setShowConnectionStatus(false);
      if (disconnectionTimerRef.current) {
        clearTimeout(disconnectionTimerRef.current);
        disconnectionTimerRef.current = null;
      }
      return;
    }

    // Si está desconectado y no hay timer activo, iniciar uno
    if (!isConnected && !disconnectionTimerRef.current) {
      disconnectionTimerRef.current = setTimeout(() => {
        setShowConnectionStatus(true);
      }, 10000); // 10 segundos
    }

    // Cleanup: cancelar timer al desmontar
    return () => {
      if (disconnectionTimerRef.current) {
        clearTimeout(disconnectionTimerRef.current);
        disconnectionTimerRef.current = null;
      }
    };
  }, [isConnected]);

  // Cambiar estado de pedido
  const handleCambiarEstado = async (pedido, nuevoEstado) => {
    if (!puedeTransicionar(user?.rol, pedido.estado, nuevoEstado)) {
      setError(`No tienes permiso para cambiar a ${ESTADOS_PEDIDO[nuevoEstado].label}`);
      return;
    }

    try {
      setProcesando(pedido.id);
      await cambiarEstadoPedido(pedido.id, nuevoEstado);
      await cargarPedidos();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  };

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro === 'urgentes') return p.estado === 'URGENTE';
    if (filtro === 'en_preparacion') return p.estado === 'EN_PREPARACION';
    if (filtro === 'creados') return p.estado === 'CREADO';
    return true;
  });

  // Ordenar: urgentes primero, luego por fecha
  const pedidosOrdenados = [...pedidosFiltrados].sort((a, b) => {
    if (a.estado === 'URGENTE' && b.estado !== 'URGENTE') return -1;
    if (b.estado === 'URGENTE' && a.estado !== 'URGENTE') return 1;
    return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
  });

  // Calcular tiempo transcurrido
  const calcularTiempo = (fecha) => {
    const minutos = Math.floor((new Date() - new Date(fecha)) / 60000);
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return `${horas}h ${minutos % 60}m`;
  };

  // Contadores
  const contadores = {
    total: pedidos.length,
    urgentes: pedidos.filter(p => p.estado === 'URGENTE').length,
    creados: pedidos.filter(p => p.estado === 'CREADO').length,
    en_preparacion: pedidos.filter(p => p.estado === 'EN_PREPARACION').length,
    listos: pedidos.filter(p => p.estado === 'LISTO').length,
  };

  const getStatusMessage = (status, isConnectedFlag) => {
    if (isConnectedFlag || status === 'connected') return 'Conectado';

    switch (status) {
      case 'connecting':
        return 'Conectando...';
      case 'authenticating':
        return 'Autenticando...';
      case 'reconnecting':
        return 'Reconectando...';
      case 'auth_failed':
        return 'Autenticación fallida';
      case 'no_auth':
        return 'Sin autenticación';
      case 'auth_timeout':
        return 'Autenticación expirada';
      case 'connection_failed':
        return 'Sin conexión';
      case 'max_retries_exceeded':
        return 'Conexión perdida';
      case 'error':
        return 'Error de conexión';
      case 'disconnected':
        return 'Desconectado';
      default:
        return 'Estado desconocido';
    }
  };

  const getStatusColor = (status, isConnectedFlag) => {
    if (isConnectedFlag || status === 'connected') return 'success';
    if (['connecting', 'authenticating', 'reconnecting'].includes(status)) return 'warning';
    if (['auth_failed', 'no_auth'].includes(status)) return 'secondary';
    if (['connection_failed', 'max_retries_exceeded', 'error', 'disconnected', 'auth_timeout'].includes(status)) return 'danger';
    return 'secondary';
  };

  const getTooltipContent = (status, isConnectedFlag, lastUpdate) => {
    const message = getStatusMessage(status, isConnectedFlag);
    const descriptions = {
      connected: 'Recibiendo actualizaciones en vivo.',
      connecting: 'Intentando establecer conexión...',
      authenticating: 'Verificando credenciales...',
      reconnecting: 'Intentando reconectar automáticamente...',
      auth_failed: 'No se pudo validar tu sesión.',
      no_auth: 'No hay token disponible para conectar.',
      auth_timeout: 'La sesión expiró, vuelve a iniciar.',
      connection_failed: 'No se pudo contactar al servidor.',
      max_retries_exceeded: 'Se agotaron los intentos de reconexión.',
      error: 'Ocurrió un error inesperado.',
      disconnected: 'El socket está desconectado.',
      default: 'Monitoreando estado de conexión.'
    };
    const lastUpdateLabel = lastUpdate
      ? new Date(lastUpdate).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Sin datos';

    return (
      <div>
        <div className="fw-bold mb-1">{message}</div>
        <div className="small">
          {descriptions[status] || descriptions.default}
        </div>
        <div className="small text-muted mt-1">
          Última actualización: {lastUpdateLabel}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Cargando cola de cocina...</p>
      </div>
    );
  }

  // Determinar si el tiempo es urgente (más de 15 min)
  const esTiempoUrgente = (fecha) => {
    const minutos = Math.floor((new Date() - new Date(fecha)) / 60000);
    return minutos > 15;
  };

  return (
    <Container fluid>
      {/* Inyectar estilos CSS */}
      <style>{styles}</style>

      {/* Alertas */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            <i className="bi bi-fire me-2 text-danger"></i>
            Panel de Cocina
          </h3>
          <div className="d-flex align-items-center gap-2">
            {showConnectionStatus && (
              <>
                <OverlayTrigger
                  placement="bottom"
                  delay={{ show: 200, hide: 100 }}
                  overlay={
                    <Tooltip id="connection-status-tooltip">
                      {getTooltipContent(connectionStatus, isConnected, lastUpdateTime)}
                    </Tooltip>
                  }
                >
                  <div
                    className="connection-indicator d-inline-flex align-items-center"
                    style={{ cursor: 'help' }}
                  >
                    <i className={`bi bi-circle-fill connection-dot connection-dot-${getStatusColor(connectionStatus, isConnected)} me-1`}></i>
                    <small className="text-muted">
                      {getStatusMessage(connectionStatus, isConnected)}
                    </small>
                  </div>
                </OverlayTrigger>
                <small className="text-muted">
                  Última actualización: {new Date(lastUpdateTime).toLocaleTimeString('es-CL')}
                </small>
              </>
            )}
          </div>
        </div>
        <Button variant="outline-primary" onClick={cargarPedidos}>
          <i className="bi bi-arrow-clockwise me-1"></i>
          Actualizar
        </Button>
      </div>

      {/* Resumen con iconos */}
      <Row className="mb-4">
        <Col xs={6} md={3} lg={2}>
          <Card
            className={`text-center summary-card ${filtro === 'urgentes' ? 'border-danger border-2' : ''}`}
            onClick={() => setFiltro(filtro === 'urgentes' ? 'todos' : 'urgentes')}
            style={{ cursor: 'pointer' }}
          >
            <Card.Body className="py-3">
              <i className="bi bi-exclamation-triangle text-danger d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
              <div className="h3 mb-0 text-danger contador-animado" key={contadores.urgentes}>{contadores.urgentes}</div>
              <small className="text-muted">Urgentes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card
            className={`text-center summary-card ${filtro === 'creados' ? 'border-secondary border-2' : ''}`}
            onClick={() => setFiltro(filtro === 'creados' ? 'todos' : 'creados')}
            style={{ cursor: 'pointer' }}
          >
            <Card.Body className="py-3">
              <i className="bi bi-hourglass-split text-secondary d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
              <div className="h3 mb-0 text-secondary contador-animado" key={contadores.creados}>{contadores.creados}</div>
              <small className="text-muted">Pendientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card
            className={`text-center summary-card ${filtro === 'en_preparacion' ? 'border-warning border-2' : ''}`}
            onClick={() => setFiltro(filtro === 'en_preparacion' ? 'todos' : 'en_preparacion')}
            style={{ cursor: 'pointer' }}
          >
            <Card.Body className="py-3">
              <i className="bi bi-fire text-warning d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
              <div className="h3 mb-0 text-warning contador-animado" key={contadores.en_preparacion}>{contadores.en_preparacion}</div>
              <small className="text-muted">En Preparación</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card className="text-center summary-card">
            <Card.Body className="py-3">
              <i className="bi bi-check-circle text-success d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
              <div className="h3 mb-0 text-success contador-animado" key={contadores.listos}>{contadores.listos}</div>
              <small className="text-muted">Listos</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Cola de pedidos */}
      {pedidosOrdenados.length === 0 ? (
        <Alert variant="info" className="text-center">
          <i className="bi bi-inbox me-2"></i>
          No hay pedidos pendientes en la cola
        </Alert>
      ) : (
        <Row xs={1} md={2} lg={3} xl={4} className="g-3">
          {pedidosOrdenados.map(pedido => {
            const estado = ESTADOS_PEDIDO[pedido.estado];
            const tiempoTranscurrido = calcularTiempo(pedido.fecha_creacion);
            const esUrgente = pedido.estado === 'URGENTE';
            const tiempoEsUrgente = esTiempoUrgente(pedido.fecha_creacion);

            return (
              <Col key={pedido.id}>
                <Card
                  className={`h-100 shadow-sm pedido-card estado-transition ${esUrgente ? 'border-danger border-2 pedido-urgente' : ''}`}
                >
                  {/* Header del pedido */}
                  <Card.Header className={`bg-${estado.color} text-white d-flex justify-content-between align-items-center`}>
                    <div>
                      <strong>Mesa {pedido.mesa_numero}</strong>
                      <Badge bg="light" text="dark" className="ms-2">
                        #{pedido.id}
                      </Badge>
                    </div>
                    <Badge
                      bg={tiempoEsUrgente ? 'danger' : 'light'}
                      text={tiempoEsUrgente ? 'white' : 'dark'}
                      className={tiempoEsUrgente ? 'timer-urgente' : ''}
                      style={{ fontSize: tiempoEsUrgente ? '0.9rem' : undefined }}
                    >
                      <i className="bi bi-clock me-1"></i>
                      {tiempoTranscurrido}
                    </Badge>
                  </Card.Header>

                  <Card.Body>
                    {/* Estado actual */}
                    <div className="mb-3">
                      <Badge bg={estado.color} className="me-2">
                        <i className={`${estado.icon} me-1`}></i>
                        {estado.label}
                      </Badge>
                    </div>

                    {/* Detalles del pedido */}
                    <ul className="list-unstyled mb-3">
                      {pedido.detalles?.map((detalle, idx) => (
                        <li key={idx} className="mb-1">
                          <strong>{detalle.cantidad}x</strong> {detalle.plato_nombre}
                          {detalle.notas_especiales && (
                            <small className="text-muted d-block ms-3">
                              <i className="bi bi-chat-left-text me-1"></i>
                              {detalle.notas_especiales}
                            </small>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Notas del pedido */}
                    {pedido.notas && (
                      <Alert variant="light" className="py-2 mb-3">
                        <small>
                          <i className="bi bi-sticky me-1"></i>
                          {pedido.notas}
                        </small>
                      </Alert>
                    )}

                    {/* Acciones */}
                    <div className="d-flex flex-wrap gap-2">
                      {pedido.transiciones_permitidas?.map(transicion => {
                        const estadoDestino = ESTADOS_PEDIDO[transicion];
                        const puedeCambiar = puedeTransicionar(user?.rol, pedido.estado, transicion);

                        if (!puedeCambiar) return null;

                        return (
                          <Button
                            key={transicion}
                            variant={`outline-${estadoDestino.color}`}
                            size="sm"
                            disabled={procesando === pedido.id}
                            onClick={() => handleCambiarEstado(pedido, transicion)}
                          >
                            {procesando === pedido.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <i className={`${estadoDestino.icon} me-1`}></i>
                                {estadoDestino.label}
                              </>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </Card.Body>

                  {/* Footer con info adicional */}
                  <Card.Footer className="bg-transparent small text-muted">
                    <div className="d-flex justify-content-between">
                      <span>
                        <i className="bi bi-clock-history me-1"></i>
                        {new Date(pedido.fecha_creacion).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span>
                        Total: ${Number(pedido.total || 0).toLocaleString('es-CL')}
                      </span>
                    </div>
                  </Card.Footer>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Filtro activo */}
      {filtro !== 'todos' && (
        <div className="text-center mt-3">
          <Button
            variant="link"
            className="text-muted"
            onClick={() => setFiltro('todos')}
          >
            <i className="bi bi-x-circle me-1"></i>
            Quitar filtro - Ver todos los pedidos
          </Button>
        </div>
      )}
    </Container>
  );
}

export default PanelCocina;
