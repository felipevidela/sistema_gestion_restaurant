import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Alert, Nav, Button, Placeholder } from 'react-bootstrap';
import { getCategorias, getPlatos } from '../../services/menuApi';

// Estilos CSS para animaciones y mejoras visuales
const styles = `
  .menu-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .menu-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
  }
  .menu-card-enter {
    animation: fadeInUp 0.4s ease forwards;
  }
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .badge-agotado {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 0.85rem;
    padding: 0.5em 0.8em;
    z-index: 1;
  }
  .img-container {
    position: relative;
    overflow: hidden;
  }
  .skeleton-card {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

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

      setCategorias(categoriasData || []);
      setPlatos(platosData || []);

      // Seleccionar primera categoría por defecto
      if ((categoriasData || []).length > 0) {
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

  // Skeleton loader para estado de carga
  if (loading) {
    return (
      <Container fluid className="py-4">
        <style>{styles}</style>
        <div className="text-center mb-4">
          <Placeholder as="h2" animation="glow">
            <Placeholder xs={4} />
          </Placeholder>
        </div>
        <Row xs={1} md={2} lg={3} xl={4} className="g-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Col key={i}>
              <Card className="h-100">
                <div className="skeleton-card" style={{ height: '180px' }} />
                <Card.Body>
                  <Placeholder as={Card.Title} animation="glow">
                    <Placeholder xs={8} />
                  </Placeholder>
                  <Placeholder as={Card.Text} animation="glow">
                    <Placeholder xs={12} />
                    <Placeholder xs={10} />
                  </Placeholder>
                  <Placeholder.Button variant="primary" xs={4} />
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
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
      {/* Inyectar estilos CSS */}
      <style>{styles}</style>

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
          {platosFiltrados.map((plato, index) => (
            <Col key={plato.id}>
              <Card
                className="h-100 shadow-sm menu-card menu-card-enter"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Contenedor de imagen con badge de agotado */}
                <div className="img-container">
                  {!plato.disponible && (
                    <Badge bg="danger" className="badge-agotado">
                      <i className="bi bi-x-circle me-1"></i>
                      Agotado
                    </Badge>
                  )}
                  {plato.imagen ? (
                    <Card.Img
                      variant="top"
                      src={plato.imagen}
                      alt={plato.nombre}
                      loading="lazy"
                      style={{
                        height: '180px',
                        objectFit: 'cover',
                        filter: !plato.disponible ? 'grayscale(50%)' : 'none'
                      }}
                    />
                  ) : (
                    <div
                      className="bg-light d-flex align-items-center justify-content-center"
                      style={{
                        height: '180px',
                        filter: !plato.disponible ? 'grayscale(50%)' : 'none'
                      }}
                    >
                      <i className="bi bi-egg-fried text-muted" style={{ fontSize: '4rem' }}></i>
                    </div>
                  )}
                </div>

                <Card.Body className="d-flex flex-column">
                  <Card.Title className="mb-2 fw-semibold">
                    {plato.nombre}
                  </Card.Title>

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

                    {modoSeleccion && (
                      <Button
                        variant={plato.disponible ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => plato.disponible && onAgregarPlato?.(plato)}
                        disabled={!plato.disponible}
                        title={!plato.disponible ? 'Plato no disponible' : 'Agregar al pedido'}
                      >
                        <i className={`bi ${plato.disponible ? 'bi-plus-lg' : 'bi-x-lg'}`}></i>
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
