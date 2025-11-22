import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Spinner, Alert, Modal, Form } from 'react-bootstrap';
import { listarBloqueos, eliminarBloqueo, desactivarBloqueo, activarBloqueo, crearBloqueo, getMesas } from '../services/reservasApi';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal } from './ui/Modal';

export default function ListaBloqueosActivos() {
  const toast = useToast();
  const [bloqueos, setBloqueos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('activos');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, bloqueoId: null, isLoading: false });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    mesa: '',
    fecha_inicio: '',
    fecha_fin: '',
    hora_inicio: '',
    hora_fin: '',
    motivo: '',
    categoria: 'otro',
    notas: '',
    dia_completo: false
  });
  const [formErrors, setFormErrors] = useState({});

  const categorias = [
    { value: 'TODAS', label: 'Todas las categorías' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'evento_privado', label: 'Evento Privado' },
    { value: 'reparacion', label: 'Reparación' },
    { value: 'reserva_especial', label: 'Reserva Especial' },
    { value: 'otro', label: 'Otro' }
  ];

  useEffect(() => {
    cargarBloqueos();
    cargarMesas();
  }, [filtroActivo, filtroCategoria]);

  const cargarMesas = async () => {
    try {
      const data = await getMesas();
      setMesas(data);
    } catch (err) {
      console.error('Error al cargar mesas:', err);
    }
  };

  const cargarBloqueos = async () => {
    try {
      setLoading(true);
      const filters = {};

      if (filtroActivo === 'activos') {
        filters.solo_activos = true;
      } else if (filtroActivo === 'inactivos') {
        filters.activo = false;
      }

      if (filtroCategoria !== 'TODAS') {
        filters.categoria = filtroCategoria;
      }

      const data = await listarBloqueos(filters);
      setBloqueos(data);
      setError('');
    } catch (err) {
      setError('Error al cargar bloqueos: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = (bloqueoId) => {
    setDeleteModal({ isOpen: true, bloqueoId, isLoading: false });
  };

  const confirmEliminar = async () => {
    try {
      setDeleteModal(prev => ({ ...prev, isLoading: true }));
      await eliminarBloqueo(deleteModal.bloqueoId);
      await cargarBloqueos();
      toast.success('Bloqueo eliminado exitosamente');
      setDeleteModal({ isOpen: false, bloqueoId: null, isLoading: false });
    } catch (err) {
      toast.error('Error al eliminar bloqueo: ' + err.message);
      setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleToggleActivo = async (bloqueo) => {
    try {
      if (bloqueo.activo) {
        await desactivarBloqueo(bloqueo.id);
        toast.success('Bloqueo desactivado');
      } else {
        await activarBloqueo(bloqueo.id);
        toast.success('Bloqueo activado');
      }
      await cargarBloqueos();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      mesa: '',
      fecha_inicio: '',
      fecha_fin: '',
      hora_inicio: '',
      hora_fin: '',
      motivo: '',
      categoria: 'otro',
      notas: '',
      dia_completo: false
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCrearBloqueo = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      const bloqueoData = {
        mesa: parseInt(formData.mesa),
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        motivo: formData.motivo,
        categoria: formData.categoria,
        notas: formData.notas
      };

      // Solo agregar horas si no es día completo
      if (!formData.dia_completo) {
        bloqueoData.hora_inicio = formData.hora_inicio;
        bloqueoData.hora_fin = formData.hora_fin;
      }

      await crearBloqueo(bloqueoData);
      toast.success('Bloqueo creado exitosamente');
      setShowCreateModal(false);
      await cargarBloqueos();
    } catch (err) {
      toast.error('Error al crear bloqueo: ' + err.message);
      console.error(err);
    }
  };

  const formatearFecha = (fecha) => {
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatearHora = (hora) => {
    if (!hora) return 'Día completo';
    return hora.substring(0, 5);
  };

  const getCategoriaColor = (categoria) => {
    const colores = {
      mantenimiento: 'warning',
      evento_privado: 'info',
      reparacion: 'danger',
      reserva_especial: 'success',
      otro: 'secondary'
    };
    return colores[categoria] || 'secondary';
  };

  if (loading && bloqueos.length === 0) {
    return (
      <Container fluid>
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Cargando bloqueos...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Bloqueos de Mesas</h2>
        <div className="d-flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
          >
            <i className="bi bi-plus-circle me-1"></i>
            Crear Bloqueo
          </Button>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={cargarBloqueos}
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
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {/* Filtros */}
      <Row className="mb-4">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Estado</Form.Label>
            <Form.Select value={filtroActivo} onChange={(e) => setFiltroActivo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Categoría</Form.Label>
            <Form.Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              {categorias.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {/* Tabla de Bloqueos */}
      {bloqueos.length === 0 ? (
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          No hay bloqueos {filtroActivo === 'activos' ? 'activos' : filtroActivo === 'inactivos' ? 'inactivos' : ''}.
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Body>
            <div className="table-responsive">
              <Table hover>
                <thead className="table-light">
                  <tr>
                    <th>Mesa</th>
                    <th>Fecha Inicio</th>
                    <th>Fecha Fin</th>
                    <th>Horario</th>
                    <th>Motivo</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bloqueos.map(bloqueo => (
                    <tr key={bloqueo.id}>
                      <td>
                        <strong>Mesa {bloqueo.mesa_numero}</strong>
                      </td>
                      <td>{formatearFecha(bloqueo.fecha_inicio)}</td>
                      <td>{formatearFecha(bloqueo.fecha_fin)}</td>
                      <td>
                        {bloqueo.hora_inicio ? (
                          <small>{formatearHora(bloqueo.hora_inicio)} - {formatearHora(bloqueo.hora_fin)}</small>
                        ) : (
                          <Badge bg="info">Día completo</Badge>
                        )}
                      </td>
                      <td>{bloqueo.motivo}</td>
                      <td>
                        <Badge bg={getCategoriaColor(bloqueo.categoria)}>
                          {bloqueo.categoria_display}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={bloqueo.activo ? 'success' : 'secondary'}>
                          {bloqueo.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            size="sm"
                            variant={bloqueo.activo ? 'warning' : 'success'}
                            onClick={() => handleToggleActivo(bloqueo)}
                          >
                            <i className={`bi ${bloqueo.activo ? 'bi-pause' : 'bi-play'} me-1`}></i>
                            {bloqueo.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleEliminar(bloqueo.id)}
                          >
                            <i className="bi bi-trash me-1"></i>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Modal para crear bloqueo */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-lock me-2"></i>
            Crear Bloqueo de Mesa
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCrearBloqueo}>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label>Mesa <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="mesa"
                    value={formData.mesa}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Seleccionar mesa...</option>
                    {mesas.map(mesa => (
                      <option key={mesa.id} value={mesa.id}>
                        Mesa {mesa.numero} (Capacidad: {mesa.capacidad})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label>Categoría <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleFormChange}
                    required
                  >
                    {categorias.filter(c => c.value !== 'TODAS').map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label>Fecha Inicio <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    name="fecha_inicio"
                    value={formData.fecha_inicio}
                    onChange={handleFormChange}
                    required
                  />
                </Form.Group>
              </Col>

              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label>Fecha Fin <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    name="fecha_fin"
                    value={formData.fecha_fin}
                    onChange={handleFormChange}
                    required
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Check
                  type="checkbox"
                  name="dia_completo"
                  label="Bloqueo de día completo (no especificar horario)"
                  checked={formData.dia_completo}
                  onChange={handleFormChange}
                />
              </Col>

              {!formData.dia_completo && (
                <>
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label>Hora Inicio <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        type="time"
                        name="hora_inicio"
                        value={formData.hora_inicio}
                        onChange={handleFormChange}
                        required={!formData.dia_completo}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label>Hora Fin <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        type="time"
                        name="hora_fin"
                        value={formData.hora_fin}
                        onChange={handleFormChange}
                        required={!formData.dia_completo}
                      />
                    </Form.Group>
                  </Col>
                </>
              )}

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label>Motivo <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    name="motivo"
                    value={formData.motivo}
                    onChange={handleFormChange}
                    placeholder="Ej: Mantenimiento programado, Evento privado..."
                    maxLength={200}
                    required
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="mb-3">
                <Form.Group>
                  <Form.Label>Notas (opcional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="notas"
                    value={formData.notas}
                    onChange={handleFormChange}
                    placeholder="Información adicional sobre el bloqueo..."
                    maxLength={500}
                  />
                  <Form.Text className="text-muted">
                    Máximo 500 caracteres
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                <i className="bi bi-check-circle me-1"></i>
                Crear Bloqueo
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal de confirmación para eliminar */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, bloqueoId: null, isLoading: false })}
        onConfirm={confirmEliminar}
        title="Eliminar Bloqueo"
        message="¿Está seguro que desea eliminar este bloqueo? Esta acción no se puede deshacer."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </Container>
  );
}
