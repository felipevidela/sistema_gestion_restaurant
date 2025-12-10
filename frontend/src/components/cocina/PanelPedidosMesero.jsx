import { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Badge, Button, Spinner, Alert, Form, InputGroup, Tabs, Tab, Pagination } from 'react-bootstrap';
import { getPedidos, getPedidosListos, getPedidosEntregados, cambiarEstadoPedido, ESTADOS_PEDIDO } from '../../services/cocinaApi';
import { useToast } from '../../contexts/ToastContext';

function PanelPedidosMesero() {
  const toast = useToast();

  // Estado de tabs
  const [tabActivo, setTabActivo] = useState('listos');

  // Estado de pedidos
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(null);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  // Búsqueda y ordenamiento
  const [busqueda, setBusqueda] = useState('');
  const [ordenamiento, setOrdenamiento] = useState('');

  // Contadores para badges
  const [contadores, setContadores] = useState({
    pendientes: 0,
    en_preparacion: 0,
    listos: 0,
    entregados: 0
  });

  // Timestamp de última actualización
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());

  // Cargar pedidos según tab activo
  const cargarPedidos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let data = null;

      switch (tabActivo) {
        case 'listos':
          data = await getPedidosListos({
            page,
            page_size: pageSize,
            busqueda: busqueda || undefined,
            ordering: ordenamiento || undefined
          });
          break;

        case 'pendientes':
          const pedidosPendientes = await getPedidos({ estado: 'CREADO' });
          data = {
            results: pedidosPendientes,
            count: pedidosPendientes.length
          };
          break;

        case 'en_preparacion':
          const pedidosEnPrep = await getPedidos({ estado: 'EN_PREPARACION' });
          data = {
            results: pedidosEnPrep,
            count: pedidosEnPrep.length
          };
          break;

        case 'entregados':
          data = await getPedidosEntregados({
            page,
            page_size: pageSize,
            busqueda: busqueda || undefined,
            ordering: ordenamiento || undefined
          });
          break;

        default:
          data = { results: [], count: 0 };
      }

      setPedidos(data.results || []);
      setTotalCount(data.count || 0);
      setHasNext(!!data.next);
      setHasPrevious(!!data.previous);

    } catch (err) {
      setError(err.message);
      toast.error(`Error al cargar pedidos: ${err.message}`);
    } finally {
      setLoading(false);
      setLastUpdateTime(new Date());
    }
  }, [tabActivo, page, pageSize, busqueda, ordenamiento, toast]);

  // Cargar contadores
  const cargarContadores = useCallback(async () => {
    try {
      const [pendientes, enPrep, listos, entregados] = await Promise.all([
        getPedidos({ estado: 'CREADO' }),
        getPedidos({ estado: 'EN_PREPARACION' }),
        getPedidosListos({ page_size: 1 }),
        getPedidosEntregados({ page_size: 1 })
      ]);

      setContadores({
        pendientes: pendientes.length,
        en_preparacion: enPrep.length,
        listos: listos.count || 0,
        entregados: entregados.count || 0
      });
    } catch (err) {
      console.error('Error al cargar contadores:', err);
    }
  }, []);

  // Marcar como ENTREGADO
  const handleEntregar = async (pedidoId) => {
    try {
      setProcesando(pedidoId);
      await cambiarEstadoPedido(pedidoId, 'ENTREGADO');
      toast.success('Pedido marcado como entregado');
      await cargarPedidos();
      await cargarContadores();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setProcesando(null);
    }
  };

  // Calcular tiempo desde listo (en minutos)
  const calcularTiempoListo = (pedido) => {
    if (!pedido.fecha_listo) return null;
    return pedido.tiempo_desde_listo;
  };

  // Determinar si un pedido está demorado (>10min en LISTO)
  const estaDemorado = (pedido) => {
    const tiempo = calcularTiempoListo(pedido);
    return tiempo !== null && tiempo > 10;
  };

  // Formatear tiempo
  const formatearTiempo = (minutos) => {
    if (minutos === null || minutos === undefined) return '-';
    if (minutos < 60) return `${minutos}m`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  // Efecto: Cargar pedidos al cambiar tab, page, búsqueda, ordenamiento
  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  // Efecto: Cargar contadores inicialmente y cada 30s
  useEffect(() => {
    cargarContadores();
    const interval = setInterval(cargarContadores, 30000);
    return () => clearInterval(interval);
  }, [cargarContadores]);

  // Efecto: Polling de pedidos cada 30s (solo para tabs que requieren actualización frecuente)
  useEffect(() => {
    // Polling solo para tabs 'listos' y 'entregados' (requieren actualización frecuente)
    if (tabActivo === 'listos' || tabActivo === 'entregados') {
      const interval = setInterval(cargarPedidos, 30000); // 30 segundos
      return () => clearInterval(interval);
    }
  }, [tabActivo, cargarPedidos]);

  // Efecto: Actualizar inmediatamente cuando el usuario vuelve al tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Usuario volvió al tab, actualizar inmediatamente
        cargarPedidos();
        cargarContadores();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cargarPedidos, cargarContadores]);

  // Reset pagination cuando cambia tab o búsqueda
  useEffect(() => {
    setPage(1);
  }, [tabActivo, busqueda]);

  // Opciones de ordenamiento por tab
  const opcionesOrdenamiento = useMemo(() => {
    switch (tabActivo) {
      case 'listos':
        return [
          { value: 'fecha_listo', label: 'Más antiguos primero' },
          { value: '-fecha_listo', label: 'Más recientes primero' },
          { value: 'mesa__numero', label: 'Mesa (ascendente)' },
          { value: '-mesa__numero', label: 'Mesa (descendente)' }
        ];
      case 'entregados':
        return [
          { value: '-fecha_entregado', label: 'Más recientes primero' },
          { value: 'fecha_entregado', label: 'Más antiguos primero' },
          { value: 'mesa__numero', label: 'Mesa (ascendente)' },
          { value: '-mesa__numero', label: 'Mesa (descendente)' }
        ];
      default:
        return [];
    }
  }, [tabActivo]);

  // Paginación - calcular total de páginas
  const totalPages = Math.ceil(totalCount / pageSize);

  // Paginación - renderizar items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <Pagination.Item
            key={i}
            active={i === page}
            onClick={() => setPage(i)}
          >
            {i}
          </Pagination.Item>
        );
      }
    } else {
      items.push(
        <Pagination.Item
          key={1}
          active={1 === page}
          onClick={() => setPage(1)}
        >
          1
        </Pagination.Item>
      );

      if (page > 3) {
        items.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <Pagination.Item
            key={i}
            active={i === page}
            onClick={() => setPage(i)}
          >
            {i}
          </Pagination.Item>
        );
      }

      if (page < totalPages - 2) {
        items.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
      }

      items.push(
        <Pagination.Item
          key={totalPages}
          active={totalPages === page}
          onClick={() => setPage(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    return items;
  };

  // Renderizar tarjeta de pedido
  const renderPedidoCard = (pedido) => {
    const estadoInfo = ESTADOS_PEDIDO[pedido.estado] || ESTADOS_PEDIDO.CREADO;
    const demorado = estaDemorado(pedido);
    const tiempoListo = calcularTiempoListo(pedido);

    return (
      <Card key={pedido.id} className="mb-3 shadow-sm">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={2}>
              <h5 className="mb-0">
                <Badge bg="primary">Pedido #{pedido.id}</Badge>
              </h5>
              <small className="text-muted">Mesa {pedido.mesa_numero}</small>
            </Col>

            <Col md={2}>
              <Badge bg={estadoInfo.color} className="d-flex align-items-center justify-content-center p-2">
                <i className={`bi ${estadoInfo.icon} me-1`}></i>
                {estadoInfo.label}
              </Badge>
            </Col>

            <Col md={3}>
              {tabActivo === 'listos' && tiempoListo !== null && (
                <div>
                  <small className="text-muted d-block">Tiempo en LISTO:</small>
                  <Badge bg={demorado ? 'danger' : 'secondary'}>
                    {formatearTiempo(tiempoListo)}
                  </Badge>
                  {demorado && (
                    <small className="text-danger d-block">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Esperando más de 10 minutos
                    </small>
                  )}
                </div>
              )}

              {tabActivo === 'entregados' && pedido.tiempo_total !== null && (
                <div>
                  <small className="text-muted d-block">Tiempo total:</small>
                  <Badge bg="info">{formatearTiempo(pedido.tiempo_total)}</Badge>
                </div>
              )}
            </Col>

            <Col md={3}>
              {pedido.detalles && pedido.detalles.length > 0 && (
                <div>
                  <small className="text-muted d-block">Platos ({pedido.detalles.length}):</small>
                  <small>
                    {pedido.detalles.slice(0, 2).map(d => d.plato_nombre).join(', ')}
                    {pedido.detalles.length > 2 && '...'}
                  </small>
                </div>
              )}
            </Col>

            <Col md={2} className="text-end">
              {tabActivo === 'listos' && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleEntregar(pedido.id)}
                  disabled={procesando === pedido.id}
                >
                  {procesando === pedido.id ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        className="me-1"
                      />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-1"></i>
                      Entregar
                    </>
                  )}
                </Button>
              )}
            </Col>
          </Row>

          {pedido.notas && (
            <Row className="mt-2">
              <Col>
                <small className="text-muted">
                  <i className="bi bi-chat-left-text me-1"></i>
                  {pedido.notas}
                </small>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>
    );
  };

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h2>
            <i className="bi bi-receipt me-2"></i>
            Gestión de Pedidos - Mesero
          </h2>
        </Col>
        <Col className="text-end d-flex align-items-center justify-content-end">
          <small className="text-muted">
            <i className="bi bi-arrow-clockwise me-1"></i>
            Última actualización: {lastUpdateTime.toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </small>
        </Col>
      </Row>

      {/* Barra de búsqueda y ordenamiento */}
      <Row className="mb-3">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Buscar por mesa, cliente o ID..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <Button
                variant="outline-secondary"
                onClick={() => setBusqueda('')}
              >
                <i className="bi bi-x-lg"></i>
              </Button>
            )}
          </InputGroup>
        </Col>

        {opcionesOrdenamiento.length > 0 && (
          <Col md={6}>
            <Form.Select
              value={ordenamiento}
              onChange={(e) => setOrdenamiento(e.target.value)}
            >
              <option value="">Ordenar por...</option>
              {opcionesOrdenamiento.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </Form.Select>
          </Col>
        )}
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={tabActivo}
        onSelect={(k) => setTabActivo(k)}
        className="mb-3"
      >
        <Tab
          eventKey="listos"
          title={
            <span>
              <i className="bi bi-check-lg me-1"></i>
              Listos
              {contadores.listos > 0 && (
                <Badge bg="success" className="ms-2">{contadores.listos}</Badge>
              )}
            </span>
          }
        >
          {/* Contenido se renderiza abajo */}
        </Tab>

        <Tab
          eventKey="pendientes"
          title={
            <span>
              <i className="bi bi-clock me-1"></i>
              Pendientes
              {contadores.pendientes > 0 && (
                <Badge bg="secondary" className="ms-2">{contadores.pendientes}</Badge>
              )}
            </span>
          }
        >
          {/* Contenido se renderiza abajo */}
        </Tab>

        <Tab
          eventKey="en_preparacion"
          title={
            <span>
              <i className="bi bi-fire me-1"></i>
              En Preparación
              {contadores.en_preparacion > 0 && (
                <Badge bg="warning" className="ms-2">{contadores.en_preparacion}</Badge>
              )}
            </span>
          }
        >
          {/* Contenido se renderiza abajo */}
        </Tab>

        <Tab
          eventKey="entregados"
          title={
            <span>
              <i className="bi bi-check-circle me-1"></i>
              Entregados Hoy
              {contadores.entregados > 0 && (
                <Badge bg="info" className="ms-2">{contadores.entregados}</Badge>
              )}
            </span>
          }
        >
          {/* Contenido se renderiza abajo */}
        </Tab>
      </Tabs>

      {/* Contenido del tab activo */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Cargando pedidos...</p>
        </div>
      ) : pedidos.length === 0 ? (
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          No hay pedidos en este estado.
        </Alert>
      ) : (
        <>
          <div className="mb-3">
            {pedidos.map(pedido => renderPedidoCard(pedido))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <Row>
              <Col className="d-flex justify-content-center">
                <Pagination>
                  <Pagination.First
                    onClick={() => setPage(1)}
                    disabled={!hasPrevious}
                  />
                  <Pagination.Prev
                    onClick={() => setPage(page - 1)}
                    disabled={!hasPrevious}
                  />

                  {renderPaginationItems()}

                  <Pagination.Next
                    onClick={() => setPage(page + 1)}
                    disabled={!hasNext}
                  />
                  <Pagination.Last
                    onClick={() => setPage(totalPages)}
                    disabled={!hasNext}
                  />
                </Pagination>
              </Col>
            </Row>
          )}

          {/* Información de paginación */}
          {totalCount > 0 && (
            <Row>
              <Col className="text-center text-muted">
                <small>
                  Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} de {totalCount} pedidos
                </small>
              </Col>
            </Row>
          )}
        </>
      )}
    </Container>
  );
}

export default PanelPedidosMesero;
