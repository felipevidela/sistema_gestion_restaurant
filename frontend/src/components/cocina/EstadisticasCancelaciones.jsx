import { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Badge, Spinner, Alert,
  Form, Table, ListGroup
} from 'react-bootstrap';
import { getEstadisticasCancelaciones } from '../../services/cocinaApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

/**
 * Panel de estadísticas de cancelaciones
 * Solo accesible para admin y cajero
 */
function EstadisticasCancelaciones() {
  const { user } = useAuth();
  const toast = useToast();

  const [periodo, setPeriodo] = useState('semana');
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar estadísticas
  useEffect(() => {
    cargarEstadisticas();
  }, [periodo]);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEstadisticasCancelaciones(periodo);
      setEstadisticas(data);
    } catch (err) {
      setError(err.message);
      toast.error(`Error al cargar estadísticas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Verificar permisos (solo admin/cajero)
  if (user && !['admin', 'cajero'].includes(user.rol)) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          <strong>Acceso Denegado</strong>
          <p className="mb-0 mt-2">
            Esta sección es solo para administradores y cajeros.
          </p>
        </Alert>
      </Container>
    );
  }

  if (loading && !estadisticas) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Cargando estadísticas...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h2>
            <i className="bi bi-graph-up me-2"></i>
            Estadísticas de Cancelaciones
          </h2>
          <p className="text-muted mb-0">
            Análisis de pedidos cancelados y motivos de cancelación
          </p>
        </Col>
        <Col xs="auto">
          <Form.Group>
            <Form.Label className="small text-muted mb-1">Período:</Form.Label>
            <Form.Select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="dia">Hoy</option>
              <option value="semana">Última Semana</option>
              <option value="mes">Último Mes</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {estadisticas && (
        <>
          {/* Tarjetas de resumen */}
          <Row className="mb-4">
            {/* Total cancelados */}
            <Col md={4}>
              <Card className="text-center shadow-sm">
                <Card.Body>
                  <i className="bi bi-x-circle text-danger d-block mb-2" style={{ fontSize: '2rem' }}></i>
                  <h2 className="mb-0 text-danger">{estadisticas.total_cancelados}</h2>
                  <small className="text-muted">Total Cancelados</small>
                  <div className="small text-muted mt-2">
                    {new Date(estadisticas.fecha_inicio).toLocaleDateString('es-CL')} - {new Date(estadisticas.fecha_fin).toLocaleDateString('es-CL')}
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Total usuarios */}
            <Col md={4}>
              <Card className="text-center shadow-sm">
                <Card.Body>
                  <i className="bi bi-people text-primary d-block mb-2" style={{ fontSize: '2rem' }}></i>
                  <h2 className="mb-0 text-primary">{estadisticas.por_usuario?.length || 0}</h2>
                  <small className="text-muted">Usuarios que Cancelaron</small>
                </Card.Body>
              </Card>
            </Col>

            {/* Total motivos */}
            <Col md={4}>
              <Card className="text-center shadow-sm">
                <Card.Body>
                  <i className="bi bi-chat-left-text text-warning d-block mb-2" style={{ fontSize: '2rem' }}></i>
                  <h2 className="mb-0 text-warning">{estadisticas.motivos_total || 0}</h2>
                  <small className="text-muted">Motivos Registrados</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Sección de datos */}
          <Row>
            {/* Tabla de usuarios */}
            <Col md={6} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header className="bg-primary text-white">
                  <i className="bi bi-people me-2"></i>
                  Cancelaciones por Usuario
                </Card.Header>
                <Card.Body className="p-0">
                  {estadisticas.por_usuario && estadisticas.por_usuario.length > 0 ? (
                    <Table striped hover className="mb-0">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Nombre</th>
                          <th className="text-end">Cancelaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estadisticas.por_usuario.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <i className="bi bi-person me-1"></i>
                              {item.cancelado_por__username}
                            </td>
                            <td className="text-muted small">
                              {item.cancelado_por__perfil__nombre_completo || '-'}
                            </td>
                            <td className="text-end">
                              <Badge bg="danger">{item.count}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="p-4 text-center text-muted">
                      <i className="bi bi-inbox me-2"></i>
                      No hay datos para este período
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Lista de motivos */}
            <Col md={6} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header className="bg-warning text-dark">
                  <i className="bi bi-chat-left-quote me-2"></i>
                  Motivos Recientes (Máx 20)
                </Card.Header>
                <Card.Body className="p-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {estadisticas.motivos_sample && estadisticas.motivos_sample.length > 0 ? (
                    <ListGroup variant="flush">
                      {estadisticas.motivos_sample.map((motivo, index) => (
                        <ListGroup.Item key={index}>
                          <small className="text-muted me-2">#{index + 1}</small>
                          {motivo}
                          {motivo.length >= 100 && (
                            <Badge bg="secondary" className="ms-2" pill>truncado</Badge>
                          )}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  ) : (
                    <div className="p-4 text-center text-muted">
                      <i className="bi bi-chat-left me-2"></i>
                      No hay motivos registrados
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Info adicional */}
          {estadisticas.total_cancelados === 0 && (
            <Alert variant="success" className="text-center">
              <i className="bi bi-check-circle me-2"></i>
              ¡Excelente! No hay pedidos cancelados en este período.
            </Alert>
          )}
        </>
      )}
    </Container>
  );
}

export default EstadisticasCancelaciones;
