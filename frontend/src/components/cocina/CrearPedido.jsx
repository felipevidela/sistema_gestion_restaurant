import { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Table, Button, Form, Badge,
  Spinner, Alert, Modal, InputGroup, ListGroup, ButtonGroup
} from 'react-bootstrap';
import { crearPedido } from '../../services/cocinaApi';
import { getCategorias, getPlatos } from '../../services/menuApi';
import { getMesas } from '../../services/reservasApi';

// Estilos CSS para animaciones
const styles = `
  .plato-card {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .plato-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1) !important;
  }
  .plato-card.en-carrito {
    border-color: #198754 !important;
    border-width: 2px !important;
    background-color: rgba(25, 135, 84, 0.05);
  }
  .badge-cantidad {
    animation: bounce 0.3s ease;
    font-size: 0.9rem !important;
    padding: 0.4em 0.7em !important;
  }
  @keyframes bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
  .carrito-sticky {
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    border: 2px solid #dee2e6;
  }
  .empty-cart-icon {
    animation: float 3s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .item-enter {
    animation: slideIn 0.2s ease;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
`;

/**
 * Componente para crear nuevos pedidos
 * Permite seleccionar mesa, platos y enviar a cocina
 */
function CrearPedido({ mesaPreseleccionada = null, reservaPreseleccionada = null, onPedidoCreado }) {
  // Estados de datos
  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados del formulario
  const [mesaSeleccionada, setMesaSeleccionada] = useState(mesaPreseleccionada);
  const [carrito, setCarrito] = useState([]); // [{plato, cantidad, notas}]
  const [notasPedido, setNotasPedido] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Estados de UI
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [showConfirmacion, setShowConfirmacion] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const [mesasData, categoriasData, platosData] = await Promise.all([
        getMesas(),
        getCategorias(true),
        getPlatos({ disponible: true, activo: true })
      ]);

      setMesas(mesasData || []);
      setCategorias(categoriasData || []);
      setPlatos(platosData || []);

      if ((categoriasData || []).length > 0) {
        setCategoriaActiva(categoriasData[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Agregar plato al carrito
  const agregarAlCarrito = (plato) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.plato.id === plato.id);
      if (existente) {
        return prev.map(item =>
          item.plato.id === plato.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { plato, cantidad: 1, notas: '' }];
    });
  };

  // Quitar plato del carrito
  const quitarDelCarrito = (platoId) => {
    setCarrito(prev => prev.filter(item => item.plato.id !== platoId));
  };

  // Cambiar cantidad
  const cambiarCantidad = (platoId, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      quitarDelCarrito(platoId);
      return;
    }
    setCarrito(prev => prev.map(item =>
      item.plato.id === platoId
        ? { ...item, cantidad: nuevaCantidad }
        : item
    ));
  };

  // Cambiar notas de un item
  const cambiarNotasItem = (platoId, notas) => {
    setCarrito(prev => prev.map(item =>
      item.plato.id === platoId
        ? { ...item, notas }
        : item
    ));
  };

  // Calcular total
  const calcularTotal = () => {
    return carrito.reduce((sum, item) =>
      sum + (parseFloat(item.plato.precio) * item.cantidad), 0
    );
  };

  // Enviar pedido
  const handleEnviarPedido = async () => {
    if (!mesaSeleccionada) {
      setError('Debes seleccionar una mesa');
      return;
    }
    if (carrito.length === 0) {
      setError('El pedido debe tener al menos un plato');
      return;
    }

    try {
      setEnviando(true);
      setError(null);

      const pedidoData = {
        mesa: mesaSeleccionada,
        reserva: reservaPreseleccionada || null,
        notas: notasPedido,
        detalles: carrito.map(item => ({
          plato: item.plato.id,
          cantidad: item.cantidad,
          notas: item.notas
        }))
      };

      console.log('📤 Enviando pedido:', pedidoData);

      const resultado = await crearPedido(pedidoData);

      console.log('✅ Pedido creado exitosamente:', resultado);

      setSuccess(`Pedido #${resultado.id} creado exitosamente`);
      setShowConfirmacion(false);

      // Limpiar formulario
      setCarrito([]);
      setNotasPedido('');
      if (!mesaPreseleccionada) {
        setMesaSeleccionada(null);
      }

      // Callback
      onPedidoCreado?.(resultado);

    } catch (err) {
      console.error('❌ Error al crear pedido:', err);
      console.error('Stack trace:', err.stack);
      setError(err.message);
      setShowConfirmacion(false);
    } finally {
      setEnviando(false);
    }
  };

  // Filtrar platos
  const platosFiltrados = (platos || []).filter(p => {
    const matchCategoria = !categoriaActiva || p.categoria === categoriaActiva;
    const matchBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCategoria && matchBusqueda;
  });

  // Limpiar mensajes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Cargando...</p>
      </div>
    );
  }

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
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          <i className="bi bi-check-circle me-2"></i>
          {success}
        </Alert>
      )}

      <Row>
        {/* Columna izquierda: Menú */}
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-book me-2"></i>
                  Seleccionar Platos
                </h5>
                <InputGroup style={{ width: '250px' }}>
                  <InputGroup.Text>
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Buscar plato..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </InputGroup>
              </div>
            </Card.Header>

            {/* Categorías */}
            <Card.Body className="border-bottom py-2">
              <div className="d-flex gap-2 flex-wrap">
                {categorias.map(cat => (
                  <Button
                    key={cat.id}
                    variant={categoriaActiva === cat.id ? 'primary' : 'outline-primary'}
                    size="sm"
                    onClick={() => setCategoriaActiva(cat.id)}
                  >
                    {cat.nombre}
                  </Button>
                ))}
              </div>
            </Card.Body>

            {/* Grid de platos */}
            <Card.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <Row xs={2} md={3} lg={4} className="g-3">
                {platosFiltrados.map(plato => {
                  const enCarrito = carrito.find(item => item.plato.id === plato.id);

                  return (
                    <Col key={plato.id}>
                      <Card
                        className={`h-100 plato-card ${enCarrito ? 'en-carrito' : ''}`}
                        onClick={() => agregarAlCarrito(plato)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Card.Body className="p-2 text-center position-relative">
                          {/* Badge de cantidad superpuesto */}
                          {enCarrito && (
                            <Badge
                              bg="success"
                              className="position-absolute badge-cantidad"
                              style={{ top: '-8px', right: '-8px' }}
                              key={enCarrito.cantidad}
                            >
                              x{enCarrito.cantidad}
                            </Badge>
                          )}
                          <div className="mb-2">
                            {plato.imagen ? (
                              <img
                                src={plato.imagen}
                                alt={plato.nombre}
                                className="rounded"
                                loading="lazy"
                                style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                className="bg-light rounded d-flex align-items-center justify-content-center mx-auto"
                                style={{ width: '60px', height: '60px' }}
                              >
                                <i className="bi bi-egg-fried text-muted"></i>
                              </div>
                            )}
                          </div>
                          <div className="fw-medium small">{plato.nombre}</div>
                          <div className="text-primary fw-bold">
                            ${Number(plato.precio).toLocaleString('es-CL')}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })}
              </Row>

              {platosFiltrados.length === 0 && (
                <div className="text-center text-muted py-5">
                  No se encontraron platos
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Columna derecha: Carrito */}
        <Col lg={4}>
          <Card className="sticky-top carrito-sticky" style={{ top: '20px' }}>
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-cart3 me-2"></i>
                Pedido Actual
                {carrito.length > 0 && (
                  <Badge bg="light" text="primary" className="ms-2 badge-cantidad" key={carrito.reduce((sum, item) => sum + item.cantidad, 0)}>
                    {carrito.reduce((sum, item) => sum + item.cantidad, 0)} items
                  </Badge>
                )}
              </h5>
            </Card.Header>

            <Card.Body>
              {/* Selección de mesa */}
              <Form.Group className="mb-3">
                <Form.Label>
                  <i className="bi bi-grid-3x3 me-1"></i>
                  Mesa
                </Form.Label>
                <Form.Select
                  value={mesaSeleccionada || ''}
                  onChange={(e) => setMesaSeleccionada(Number(e.target.value) || null)}
                  disabled={!!mesaPreseleccionada}
                >
                  <option value="">Seleccionar mesa...</option>
                  {mesas.map(mesa => (
                    <option key={mesa.id} value={mesa.id}>
                      Mesa {mesa.numero} (Cap. {mesa.capacidad})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Items del carrito */}
              {carrito.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-cart3 empty-cart-icon" style={{ fontSize: '4rem', opacity: 0.5 }}></i>
                  <p className="mt-3 mb-1 fw-medium">Carrito vacío</p>
                  <small>Haz clic en los platos para agregarlos</small>
                </div>
              ) : (
                <ListGroup variant="flush" className="mb-3">
                  {carrito.map(item => (
                    <ListGroup.Item key={item.plato.id} className="px-0 item-enter">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="fw-medium">{item.plato.nombre}</div>
                          <div className="small text-muted">
                            ${Number(item.plato.precio).toLocaleString('es-CL')} c/u
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold text-primary">
                            ${(parseFloat(item.plato.precio) * item.cantidad).toLocaleString('es-CL')}
                          </div>
                        </div>
                      </div>

                      {/* Controles de cantidad */}
                      <div className="d-flex align-items-center gap-2 mt-2">
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              cambiarCantidad(item.plato.id, item.cantidad - 1);
                            }}
                          >
                            <i className="bi bi-dash"></i>
                          </Button>
                          <Button variant="outline-secondary" disabled>
                            {item.cantidad}
                          </Button>
                          <Button
                            variant="outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              cambiarCantidad(item.plato.id, item.cantidad + 1);
                            }}
                          >
                            <i className="bi bi-plus"></i>
                          </Button>
                        </ButtonGroup>

                        <Form.Control
                          size="sm"
                          placeholder="Notas..."
                          value={item.notas}
                          onChange={(e) => cambiarNotasItem(item.plato.id, e.target.value)}
                          className="flex-grow-1"
                        />

                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => quitarDelCarrito(item.plato.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}

              {/* Notas generales */}
              {carrito.length > 0 && (
                <Form.Group className="mb-3">
                  <Form.Label className="small">Notas del pedido</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Instrucciones especiales..."
                    value={notasPedido}
                    onChange={(e) => setNotasPedido(e.target.value)}
                  />
                </Form.Group>
              )}
            </Card.Body>

            {/* Footer con total y botón enviar */}
            {carrito.length > 0 && (
              <Card.Footer>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="h5 mb-0">Total:</span>
                  <span className="h4 mb-0 text-primary fw-bold">
                    ${calcularTotal().toLocaleString('es-CL')}
                  </span>
                </div>
                <Button
                  variant="success"
                  size="lg"
                  className="w-100"
                  onClick={() => setShowConfirmacion(true)}
                  disabled={!mesaSeleccionada || carrito.length === 0}
                >
                  <i className="bi bi-send me-2"></i>
                  Enviar a Cocina
                </Button>
              </Card.Footer>
            )}
          </Card>
        </Col>
      </Row>

      {/* Modal de confirmación */}
      <Modal show={showConfirmacion} onHide={() => setShowConfirmacion(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Pedido</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>Mesa:</strong> {mesas.find(m => m.id === mesaSeleccionada)?.numero}
          </p>
          <Table size="sm">
            <thead>
              <tr>
                <th>Plato</th>
                <th className="text-center">Cant.</th>
                <th className="text-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {carrito.map(item => (
                <tr key={item.plato.id}>
                  <td>
                    {item.plato.nombre}
                    {item.notas && (
                      <small className="text-muted d-block">{item.notas}</small>
                    )}
                  </td>
                  <td className="text-center">{item.cantidad}</td>
                  <td className="text-end">
                    ${(parseFloat(item.plato.precio) * item.cantidad).toLocaleString('es-CL')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan={2}>Total</td>
                <td className="text-end">${calcularTotal().toLocaleString('es-CL')}</td>
              </tr>
            </tfoot>
          </Table>
          {notasPedido && (
            <Alert variant="info" className="mb-0">
              <small><strong>Notas:</strong> {notasPedido}</small>
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmacion(false)}>
            Cancelar
          </Button>
          <Button
            variant="success"
            onClick={handleEnviarPedido}
            disabled={enviando}
          >
            {enviando ? (
              <>
                <Spinner size="sm" className="me-2" />
                Enviando...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2"></i>
                Confirmar Pedido
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default CrearPedido;
