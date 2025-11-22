import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Button, ButtonGroup, Alert, Spinner, Table, Badge, Form, Pagination } from 'react-bootstrap';
import { listarUsuarios, cambiarRolUsuario } from '../services/reservasApi';

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [nuevoRol, setNuevoRol] = useState('');

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const data = await listarUsuarios();
      setUsuarios(data);
      setError('');
    } catch (err) {
      setError('Error al cargar usuarios: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarRol = async (userId) => {
    if (!nuevoRol) {
      alert('Por favor seleccione un rol');
      return;
    }

    if (!confirm('¿Está seguro que desea cambiar el rol de este usuario?')) {
      return;
    }

    try {
      await cambiarRolUsuario({ userId, nuevoRol });
      await cargarUsuarios();
      setUsuarioEditando(null);
      setNuevoRol('');
      alert('Rol actualizado correctamente');
    } catch (err) {
      alert('Error al cambiar rol: ' + err.message);
    }
  };

  const getRolBadgeClass = (rol) => {
    const badges = {
      admin: 'bg-danger',
      cajero: 'bg-primary',
      mesero: 'bg-info',
      cliente: 'bg-secondary'
    };
    return badges[rol] || 'bg-secondary';
  };

  const getRolIcon = (rol) => {
    const iconos = {
      admin: 'bi-shield-fill-check',
      cajero: 'bi-cash-coin',
      mesero: 'bi-person-badge',
      cliente: 'bi-person'
    };
    return iconos[rol] || 'bi-person';
  };

  const usuariosFiltrados = filtroRol === 'TODOS'
    ? usuarios
    : usuarios.filter(u => u.rol === filtroRol.toLowerCase());

  // Lógica de paginación
  const totalPages = Math.ceil(usuariosFiltrados.length / itemsPerPage);
  const usuariosPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return usuariosFiltrados.slice(startIndex, endIndex);
  }, [usuariosFiltrados, currentPage, itemsPerPage]);

  // Reset a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroRol]);

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Nunca';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="mt-2">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Gestión de Usuarios</h2>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={cargarUsuarios}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Estadísticas */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-danger">
            <Card.Body className="text-center">
              <i className="bi bi-shield-fill-check fs-3 text-danger"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'admin').length}</h5>
              <small className="text-muted">Administradores</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-primary">
            <Card.Body className="text-center">
              <i className="bi bi-cash-coin fs-3 text-primary"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'cajero').length}</h5>
              <small className="text-muted">Cajeros</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-info">
            <Card.Body className="text-center">
              <i className="bi bi-person-badge fs-3 text-info"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'mesero').length}</h5>
              <small className="text-muted">Meseros</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-secondary">
            <Card.Body className="text-center">
              <i className="bi bi-person fs-3 text-secondary"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'cliente').length}</h5>
              <small className="text-muted">Clientes</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtros y Controles */}
      <Row className="mb-4 align-items-center">
        <Col md={8}>
          <ButtonGroup>
            {['TODOS', 'ADMIN', 'CAJERO', 'MESERO', 'CLIENTE'].map(rol => (
              <Button
                key={rol}
                variant={filtroRol === rol ? 'primary' : 'outline-primary'}
                onClick={() => setFiltroRol(rol)}
              >
                {rol}
              </Button>
            ))}
          </ButtonGroup>
        </Col>
        <Col md={4}>
          <div className="d-flex align-items-center justify-content-end">
            <Form.Label htmlFor="itemsPerPage" className="me-2 small text-nowrap mb-0">
              Items por página:
            </Form.Label>
            <Form.Select
              id="itemsPerPage"
              size="sm"
              style={{ width: '80px' }}
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Form.Select>
          </div>
        </Col>
      </Row>

      {/* Tabla de Usuarios */}
      {usuariosFiltrados.length === 0 ? (
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          No hay usuarios {filtroRol !== 'TODOS' ? `con rol ${filtroRol.toLowerCase()}` : ''}.
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Body>
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Nombre Completo</th>
                    <th>Rol</th>
                    <th>Fecha Registro</th>
                    <th>Último Login</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosPaginados.map(usuario => (
                    <tr key={usuario.id}>
                      <td>{usuario.id}</td>
                      <td>
                        <i className={`bi ${getRolIcon(usuario.rol)} me-2`}></i>
                        <strong>{usuario.username}</strong>
                      </td>
                      <td>{usuario.email}</td>
                      <td>{usuario.nombre_completo || <em className="text-muted">-</em>}</td>
                      <td>
                        <Badge bg="" className={getRolBadgeClass(usuario.rol)}>
                          {usuario.rol_display}
                        </Badge>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatearFecha(usuario.fecha_registro)}
                        </small>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatearFecha(usuario.last_login)}
                        </small>
                      </td>
                      <td>
                        {usuarioEditando === usuario.id ? (
                          <div className="d-flex gap-2 align-items-center">
                            <Form.Select
                              size="sm"
                              value={nuevoRol}
                              onChange={(e) => setNuevoRol(e.target.value)}
                              style={{ width: '120px' }}
                            >
                              <option value="">Seleccionar...</option>
                              <option value="admin">Administrador</option>
                              <option value="cajero">Cajero</option>
                              <option value="mesero">Mesero</option>
                              <option value="cliente">Cliente</option>
                            </Form.Select>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleCambiarRol(usuario.id)}
                            >
                              <i className="bi bi-check-lg"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setUsuarioEditando(null);
                                setNuevoRol('');
                              }}
                            >
                              <i className="bi bi-x-lg"></i>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => {
                              setUsuarioEditando(usuario.id);
                              setNuevoRol(usuario.rol);
                            }}
                          >
                            <i className="bi bi-pencil me-1"></i>
                            Cambiar Rol
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                <div className="text-muted small">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, usuariosFiltrados.length)} de {usuariosFiltrados.length} usuarios
                </div>
                <Pagination size="sm" className="mb-0">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Pagination.Item
                        key={pageNum}
                        active={currentPage === pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Pagination.Item>
                    );
                  })}
                </Pagination>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Información de Roles */}
      <Card className="mt-4">
        <Card.Body>
          <Card.Title as="h6">Información de Roles:</Card.Title>
          <Row>
            <Col md={3}>
              <Badge bg="danger" className="me-2">ADMINISTRADOR</Badge>
              <small className="text-muted d-block">Acceso completo al sistema</small>
            </Col>
            <Col md={3}>
              <Badge bg="primary" className="me-2">CAJERO</Badge>
              <small className="text-muted d-block">Gestiona reservas y visualiza estados</small>
            </Col>
            <Col md={3}>
              <Badge bg="info" className="me-2">MESERO</Badge>
              <small className="text-muted d-block">Consulta mesas y reservas</small>
            </Col>
            <Col md={3}>
              <Badge bg="secondary" className="me-2">CLIENTE</Badge>
              <small className="text-muted d-block">Crea y ve sus propias reservas</small>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}
