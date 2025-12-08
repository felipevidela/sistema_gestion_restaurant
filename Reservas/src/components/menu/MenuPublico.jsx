import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Alert, Nav, Button } from 'react-bootstrap';
import { getCategorias, getPlatos } from '../../services/menuApi';

/**
 * Vista pública del menú del restaurante
 * Muestra platos organizados por categoría
 */
function MenuPublico({ onAgregarPlato, modoSeleccion = false }) {
  const [categorias, setCategorias] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar datos al montar
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const [categoriasData, platosData] = await Promise.all([
        getCategorias(true),
        getPlatos({ disponible: true, activo: true })
      ]);

      setCategorias(categoriasData);
      setPlatos(platosData);

      // Seleccionar primera categoría por defecto
      if (categoriasData.length > 0) {
        setCategoriaActiva(categoriasData[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar platos por categoría activa
  const platosFiltrados = categoriaActiva
    ? platos.filter(p => p.categoria === categoriaActiva)
    : platos;

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Cargando menú...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-3">
        <Alert.Heading>Error al cargar el menú</Alert.Heading>
        <p>{error}</p>
        <Button variant="outline-danger" onClick={cargarDatos}>
          Reintentar
        </Button>
      </Alert>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Título */}
      <div className="text-center mb-4">
        <h2 className="fw-bold">
          <i className="bi bi-book me-2"></i>
          Nuestro Menú
        </h2>
        <p className="text-muted">Descubre nuestra selección de platos</p>
      </div>

      {/* Navegación por categorías */}
      <Nav
        variant="pills"
        className="justify-content-center mb-4 flex-wrap gap-2"
        activeKey={categoriaActiva}
        onSelect={(k) => setCategoriaActiva(Number(k))}
      >
        {categorias.map(cat => (
          <Nav.Item key={cat.id}>
            <Nav.Link
              eventKey={cat.id}
              className="rounded-pill px-4"
            >
              {cat.nombre}
              <Badge bg="light" text="dark" className="ms-2">
                {platos.filter(p => p.categoria === cat.id).length}
              </Badge>
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {/* Grid de platos */}
      {platosFiltrados.length === 0 ? (
        <Alert variant="info" className="text-center">
          No hay platos disponibles en esta categoría
        </Alert>
      ) : (
        <Row xs={1} md={2} lg={3} xl={4} className="g-4">
          {platosFiltrados.map(plato => (
            <Col key={plato.id}>
              <Card className="h-100 shadow-sm hover-shadow">
                {/* Imagen del plato */}
                {plato.imagen ? (
                  <Card.Img
                    variant="top"
                    src={plato.imagen}
                    alt={plato.nombre}
                    style={{ height: '180px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="bg-light d-flex align-items-center justify-content-center"
                    style={{ height: '180px' }}
                  >
                    <i className="bi bi-egg-fried text-muted" style={{ fontSize: '4rem' }}></i>
                  </div>
                )}

                <Card.Body className="d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <Card.Title className="mb-0 fw-semibold">
                      {plato.nombre}
                    </Card.Title>
                    {!plato.disponible && (
                      <Badge bg="secondary">Agotado</Badge>
                    )}
                  </div>

                  <Card.Text className="text-muted small flex-grow-1">
                    {plato.descripcion || 'Delicioso plato preparado con ingredientes frescos'}
                  </Card.Text>

                  <div className="d-flex justify-content-between align-items-center mt-auto">
                    <div>
                      <span className="h5 mb-0 text-primary fw-bold">
                        ${Number(plato.precio).toLocaleString('es-CL')}
                      </span>
                      {plato.tiempo_preparacion && (
                        <small className="text-muted ms-2">
                          <i className="bi bi-clock me-1"></i>
                          {plato.tiempo_preparacion} min
                        </small>
                      )}
                    </div>

                    {modoSeleccion && plato.disponible && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onAgregarPlato?.(plato)}
                      >
                        <i className="bi bi-plus-lg"></i>
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Información adicional */}
      <div className="text-center mt-5 text-muted">
        <small>
          <i className="bi bi-info-circle me-1"></i>
          Los precios incluyen IVA. Disponibilidad sujeta a stock.
        </small>
      </div>
    </Container>
  );
}

export default MenuPublico;
