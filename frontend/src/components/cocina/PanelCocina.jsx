import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Container, Row, Col, Card, Badge, Button, Spinner, Alert,
  ButtonGroup, Modal, Form
} from 'react-bootstrap';
import {
  getColaCocina, getPedidosUrgentes, cambiarEstadoPedido, cancelarPedido,
  ESTADOS_PEDIDO
} from '../../services/cocinaApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WebSocketStatus } from '../common/WebSocketStatus';
import ModalCancelarPedido from './ModalCancelarPedido';

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
  .spin {
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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
  const toast = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    estados: ['CREADO', 'URGENTE', 'EN_PREPARACION'], // Array de estados
    mesa: null,
    ultimas_horas: null,
    ordering: 'urgente_primero' // Default: ordenamiento urgentes primero (se hace en frontend)
  });
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Estados para modal de cancelación
  const [showModalCancelar, setShowModalCancelar] = useState(false);
  const [pedidoACancelar, setPedidoACancelar] = useState(null);

  // Estado propio para WebSocket (evita flicker del badge)
  const [wsEstado, setWsEstado] = useState('conectando'); // 'conectando' | 'conectado' | 'fallback'
  const hasShownWsErrorRef = useRef(false);

  // Cargar pedidos
  const cargarPedidos = useCallback(async () => {
    try {
      setError(null);
      const data = await getColaCocina({
        estados: filtros.estados,
        mesa: filtros.mesa,
        ultimas_horas: filtros.ultimas_horas,
        // Solo enviar ordering si no es 'urgente_primero' (ese se hace en frontend)
        ordering: filtros.ordering === 'urgente_primero' ? null : filtros.ordering
      });
      setPedidos(data || []);
      setLastUpdateTime(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtros]);

  // Actualización manual con feedback
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarPedidos();
  }, [cargarPedidos]);

  // NUEVO: Handler de mensajes WebSocket (DECLARAR PRIMERO)
  const handleWebSocketMessage = useCallback((data) => {
    const { event, pedido } = data;

    switch (event) {
      case 'creado':
        if (['CREADO', 'URGENTE', 'EN_PREPARACION'].includes(pedido.estado)) {
          setPedidos(prev => {
            const existe = prev.some(p => p.id === pedido.id);
            if (existe) return prev;
            return [pedido, ...prev];
          });
          toast.info(`Nuevo pedido #${pedido.id}`, { autoClose: 3000 });
        }
        break;

      case 'actualizado':
        setPedidos(prev => {
          if (!['CREADO', 'URGENTE', 'EN_PREPARACION'].includes(pedido.estado)) {
            return prev.filter(p => p.id !== pedido.id);
          }

          const index = prev.findIndex(p => p.id === pedido.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = pedido;
            return updated;
          }

          return [pedido, ...prev];
        });
        break;

      case 'cancelado':
        setPedidos(prev => prev.filter(p => p.id !== pedido.id));
        toast.warning(`Pedido #${pedido.id} cancelado`, { autoClose: 3000 });
        break;
    }
  }, [toast]);

  // Memoizar callbacks de WebSocket para evitar reconexiones innecesarias
  const handleWsConnect = useCallback(() => {
    setWsEstado('conectado');
    hasShownWsErrorRef.current = false; // Reset al reconectar
    toast.success('Tiempo real activado', { autoClose: 2000 });
  }, [toast]);

  const handleWsError = useCallback((err) => {
    // Solo mostrar toast la primera vez
    if (!hasShownWsErrorRef.current) {
      toast.warning('Usando modo fallback', { autoClose: 3000 });
      hasShownWsErrorRef.current = true;
    }
    setWsEstado('fallback');
  }, [toast]);

  // WebSocket (DECLARAR DESPUÉS del handler)
  const { isConnected: wsConnected, error: wsError } = useWebSocket(
    '/ws/cocina/cola/',
    {
      onMessage: handleWebSocketMessage,
      onConnect: handleWsConnect,
      onError: handleWsError,
    }
  );

  // MODIFICADO: useEffect con lógica híbrida (WS + polling fallback)
  useEffect(() => {
    cargarPedidos(); // Carga inicial

    // Polling solo si WS desconectado
    let interval = null;
    if (!wsConnected) {
      console.log('[PanelCocina] Usando polling fallback');
      interval = setInterval(cargarPedidos, 90000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cargarPedidos, wsConnected]);

  // Cambiar estado de pedido
  const handleCambiarEstado = async (pedido, nuevoEstado) => {
    // Guardar estado anterior para rollback
    const estadoAnterior = pedido.estado;

    try {
      setProcesando(pedido.id);

      // Actualización optimista: actualizar UI inmediatamente
      setPedidos(prevPedidos =>
        prevPedidos.map(p =>
          p.id === pedido.id ? { ...p, estado: nuevoEstado } : p
        )
      );

      // Llamada al backend en segundo plano
      await cambiarEstadoPedido(pedido.id, nuevoEstado);
      toast.success(`Estado actualizado a ${ESTADOS_PEDIDO[nuevoEstado].label}`);

    } catch (err) {
      // Rollback en caso de error
      setPedidos(prevPedidos =>
        prevPedidos.map(p =>
          p.id === pedido.id ? { ...p, estado: estadoAnterior } : p
        )
      );
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  };

  // Solicitar cancelación (abre modal)
  const handleSolicitarCancelacion = (pedido) => {
    setPedidoACancelar(pedido);
    setShowModalCancelar(true);
  };

  // Confirmar cancelación con motivo
  const handleCancelar = async (pedidoId, motivo) => {
    // Guardar pedido para rollback
    const pedidoAnterior = pedidos.find(p => p.id === pedidoId);

    try {
      // Actualización optimista: remover pedido de la lista inmediatamente
      setPedidos(prevPedidos => prevPedidos.filter(p => p.id !== pedidoId));

      // Llamada al backend en segundo plano
      await cancelarPedido(pedidoId, motivo);
      toast.success('Pedido cancelado exitosamente');

    } catch (err) {
      // Rollback en caso de error
      if (pedidoAnterior) {
        setPedidos(prevPedidos => [...prevPedidos, pedidoAnterior]);
      }
      toast.error(`Error al cancelar: ${err.message}`);
      throw err; // Re-lanzar para que el modal lo maneje
    }
  };

  // Ordenar: urgentes primero si es el ordenamiento seleccionado, sino backend ya ordenó
  const pedidosOrdenados = useMemo(() => {
    // Si el ordenamiento es "urgente_primero", hacerlo en frontend
    if (filtros.ordering === 'urgente_primero') {
      return [...pedidos].sort((a, b) => {
        if (a.estado === 'URGENTE' && b.estado !== 'URGENTE') return -1;
        if (b.estado === 'URGENTE' && a.estado !== 'URGENTE') return 1;
        return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
      });
    }
    // Backend ya ordenó
    return pedidos;
  }, [pedidos, filtros.ordering]);

  // Calcular tiempo transcurrido
  const calcularTiempo = (fecha) => {
    const minutos = Math.floor((new Date() - new Date(fecha)) / 60000);
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return `${horas}h ${minutos % 60}m`;
  };

  // Contadores (memoizados para evitar recálculos en cada render)
  const contadores = useMemo(() => ({
    total: pedidos.length,
    urgentes: pedidos.filter(p => p.estado === 'URGENTE').length,
    creados: pedidos.filter(p => p.estado === 'CREADO').length,
    en_preparacion: pedidos.filter(p => p.estado === 'EN_PREPARACION').length,
    listos: pedidos.filter(p => p.estado === 'LISTO').length,
  }), [pedidos]);

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
        <div className="d-flex align-items-center">
          <h3 className="mb-0">
            <i className="bi bi-fire me-2 text-danger"></i>
            Panel de Cocina
          </h3>
          <WebSocketStatus wsEstado={wsEstado} className="ms-3" />
        </div>
        <Button
          variant="outline-primary"
          onClick={handleManualRefresh}
          disabled={refreshing}
        >
          <i className={`bi bi-arrow-clockwise me-1 ${refreshing ? 'spin' : ''}`}></i>
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      {/* Barra de Filtros */}
      <Row className="mb-3">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Row className="align-items-end g-3">
                {/* Filtros por Estado */}
                <Col xs={12} md={6}>
                  <small className="text-muted d-block mb-2">Filtrar por estado:</small>
                  <ButtonGroup size="sm">
                    <Button
                      variant={filtros.estados.length === 3 ? 'primary' : 'outline-primary'}
                      onClick={() => setFiltros({...filtros, estados: ['CREADO', 'URGENTE', 'EN_PREPARACION']})}
                    >
                      Todos <Badge bg="light" text="dark">{contadores.total}</Badge>
                    </Button>
                    <Button
                      variant={filtros.estados.includes('URGENTE') && filtros.estados.length === 1 ? 'danger' : 'outline-danger'}
                      onClick={() => setFiltros({...filtros, estados: ['URGENTE']})}
                    >
                      Urgentes <Badge bg="light" text="dark">{contadores.urgentes}</Badge>
                    </Button>
                    <Button
                      variant={filtros.estados.includes('EN_PREPARACION') && filtros.estados.length === 1 ? 'warning' : 'outline-warning'}
                      onClick={() => setFiltros({...filtros, estados: ['EN_PREPARACION']})}
                    >
                      En Prep. <Badge bg="light" text="dark">{contadores.en_preparacion}</Badge>
                    </Button>
                    <Button
                      variant={filtros.estados.includes('CREADO') && filtros.estados.length === 1 ? 'secondary' : 'outline-secondary'}
                      onClick={() => setFiltros({...filtros, estados: ['CREADO']})}
                    >
                      Pendientes <Badge bg="light" text="dark">{contadores.creados}</Badge>
                    </Button>
                  </ButtonGroup>
                </Col>

                {/* Filtro por Mesa */}
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small text-muted mb-1">Mesa:</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filtros.mesa || ''}
                      onChange={(e) => setFiltros({...filtros, mesa: e.target.value || null})}
                    >
                      <option value="">Todas</option>
                      {/* Filtrar pedidos que tienen mesa_numero antes de crear el Set */}
                      {Array.from(
                        new Set(
                          pedidos
                            .filter(p => p.mesa_numero && p.mesa) // Solo pedidos con mesa válida
                            .map(p => p.mesa_numero)
                        )
                      )
                        .sort((a, b) => a - b)
                        .map(num => (
                          <option key={num} value={pedidos.find(p => p.mesa_numero === num)?.mesa}>
                            Mesa {num}
                          </option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                {/* Filtro por Tiempo */}
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small text-muted mb-1">Período:</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filtros.ultimas_horas || ''}
                      onChange={(e) => setFiltros({...filtros, ultimas_horas: e.target.value || null})}
                    >
                      <option value="">Todo el día</option>
                      <option value="1">Última hora</option>
                      <option value="3">Últimas 3h</option>
                      <option value="6">Últimas 6h</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                {/* Ordenamiento */}
                <Col xs={6} md={2}>
                  <Form.Group>
                    <Form.Label className="small text-muted mb-1">Ordenar:</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filtros.ordering || 'urgente_primero'}
                      onChange={(e) => setFiltros({...filtros, ordering: e.target.value || null})}
                    >
                      <option value="urgente_primero">Urgentes 1º</option>
                      <option value="-fecha_creacion">Más recientes</option>
                      <option value="fecha_creacion">Más antiguos</option>
                      <option value="mesa__numero">Mesa (asc)</option>
                      <option value="-mesa__numero">Mesa (desc)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Botón Limpiar Filtros */}
              <Row className="mt-2">
                <Col className="text-end">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-muted"
                    onClick={() => setFiltros({
                      estados: ['CREADO', 'URGENTE', 'EN_PREPARACION'],
                      mesa: null,
                      ultimas_horas: null,
                      ordering: 'urgente_primero'
                    })}
                  >
                    <i className="bi bi-x-circle me-1"></i>
                    Limpiar filtros
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Resumen con iconos */}
      <Row className="mb-4">
        <Col xs={6} md={3} lg={2}>
          <Card className="text-center summary-card">
            <Card.Body className="py-3">
              <i className="bi bi-exclamation-triangle text-danger d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
              <div className="h3 mb-0 text-danger contador-animado" key={contadores.urgentes}>{contadores.urgentes}</div>
              <small className="text-muted">Urgentes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card className="text-center summary-card">
            <Card.Body className="py-3">
              <i className="bi bi-hourglass-split text-secondary d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
              <div className="h3 mb-0 text-secondary contador-animado" key={contadores.creados}>{contadores.creados}</div>
              <small className="text-muted">Pendientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card className="text-center summary-card">
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

                        // Si es cancelación, usar modal especial
                        if (transicion === 'CANCELADO') {
                          return (
                            <Button
                              key={transicion}
                              variant="outline-danger"
                              size="sm"
                              disabled={procesando === pedido.id}
                              onClick={() => handleSolicitarCancelacion(pedido)}
                            >
                              <i className="bi bi-x-circle me-1"></i>
                              Cancelar
                            </Button>
                          );
                        }

                        // Otras transiciones normales
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

      {/* Modal de cancelación */}
      <ModalCancelarPedido
        show={showModalCancelar}
        onHide={() => setShowModalCancelar(false)}
        pedido={pedidoACancelar}
        onCancelar={handleCancelar}
      />
    </Container>
  );
}

export default PanelCocina;
