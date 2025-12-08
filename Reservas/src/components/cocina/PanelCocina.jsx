import { useState, useEffect, useCallback } from 'react';
import {
  Container, Row, Col, Card, Badge, Button, Spinner, Alert,
  ButtonGroup, Modal
} from 'react-bootstrap';
import {
  getColaCocina, getPedidosUrgentes, cambiarEstadoPedido,
  ESTADOS_PEDIDO, puedeTransicionar
} from '../../services/cocinaApi';
import { useCocinaWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../contexts/AuthContext';

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

  // WebSocket para actualizaciones en tiempo real
  const { isConnected, connectionStatus } = useCocinaWebSocket({
    enabled: true,
    onPedidoCreado: (data) => {
      // Agregar nuevo pedido a la cola
      cargarPedidos();
    },
    onPedidoActualizado: (data) => {
      // Actualizar pedido en la lista
      setPedidos(prev => prev.map(p =>
        p.id === data.id ? { ...p, ...data } : p
      ));
    }
  });

  // Cargar pedidos
  const cargarPedidos = useCallback(async () => {
    try {
      setError(null);
      const data = await getColaCocina();
      setPedidos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
    // Refrescar cada 30 segundos como fallback
    const interval = setInterval(cargarPedidos, 30000);
    return () => clearInterval(interval);
  }, [cargarPedidos]);

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

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Cargando cola de cocina...</p>
      </div>
    );
  }

  return (
    <Container fluid>
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
            <Badge bg={isConnected ? 'success' : 'secondary'}>
              <i className={`bi bi-${isConnected ? 'wifi' : 'wifi-off'} me-1`}></i>
              {isConnected ? 'Conectado' : connectionStatus}
            </Badge>
            <small className="text-muted">
              Última actualización: {new Date().toLocaleTimeString('es-CL')}
            </small>
          </div>
        </div>
        <Button variant="outline-primary" onClick={cargarPedidos}>
          <i className="bi bi-arrow-clockwise me-1"></i>
          Actualizar
        </Button>
      </div>

      {/* Resumen */}
      <Row className="mb-4">
        <Col xs={6} md={3} lg={2}>
          <Card
            className={`text-center cursor-pointer ${filtro === 'urgentes' ? 'border-danger border-2' : ''}`}
            onClick={() => setFiltro(filtro === 'urgentes' ? 'todos' : 'urgentes')}
            style={{ cursor: 'pointer' }}
          >
            <Card.Body className="py-3">
              <div className="h3 mb-0 text-danger">{contadores.urgentes}</div>
              <small className="text-muted">Urgentes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card
            className={`text-center ${filtro === 'creados' ? 'border-secondary border-2' : ''}`}
            onClick={() => setFiltro(filtro === 'creados' ? 'todos' : 'creados')}
            style={{ cursor: 'pointer' }}
          >
            <Card.Body className="py-3">
              <div className="h3 mb-0 text-secondary">{contadores.creados}</div>
              <small className="text-muted">Pendientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card
            className={`text-center ${filtro === 'en_preparacion' ? 'border-warning border-2' : ''}`}
            onClick={() => setFiltro(filtro === 'en_preparacion' ? 'todos' : 'en_preparacion')}
            style={{ cursor: 'pointer' }}
          >
            <Card.Body className="py-3">
              <div className="h3 mb-0 text-warning">{contadores.en_preparacion}</div>
              <small className="text-muted">En Preparación</small>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3} lg={2}>
          <Card className="text-center">
            <Card.Body className="py-3">
              <div className="h3 mb-0 text-success">{contadores.listos}</div>
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

            return (
              <Col key={pedido.id}>
                <Card
                  className={`h-100 shadow-sm ${esUrgente ? 'border-danger border-2' : ''}`}
                >
                  {/* Header del pedido */}
                  <Card.Header className={`bg-${estado.color} text-white d-flex justify-content-between align-items-center`}>
                    <div>
                      <strong>Mesa {pedido.mesa_numero}</strong>
                      <Badge bg="light" text="dark" className="ms-2">
                        #{pedido.id}
                      </Badge>
                    </div>
                    <Badge bg="light" text="dark">
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
