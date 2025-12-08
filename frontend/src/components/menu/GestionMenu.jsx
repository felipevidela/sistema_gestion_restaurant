import { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Table, Button, Modal, Form,
  Badge, Spinner, Alert, InputGroup, Tabs, Tab
} from 'react-bootstrap';
import {
  getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  getPlatos, crearPlato, actualizarPlato, eliminarPlato,
  getIngredientes, getRecetaPlato, agregarIngredienteReceta, eliminarReceta
} from '../../services/menuApi';

/**
 * Panel de administración del menú
 * Permite gestionar categorías, platos y recetas
 */
function GestionMenu() {
  // Estados de datos
  const [categorias, setCategorias] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados de modales
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [showPlatoModal, setShowPlatoModal] = useState(false);
  const [showRecetaModal, setShowRecetaModal] = useState(false);

  // Estados de edición
  const [categoriaEditar, setCategoriaEditar] = useState(null);
  const [platoEditar, setPlatoEditar] = useState(null);
  const [platoReceta, setPlatoReceta] = useState(null);
  const [recetaActual, setRecetaActual] = useState([]);

  // Tab activo
  const [activeTab, setActiveTab] = useState('platos');

  // Cargar datos al montar
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, plts, ings] = await Promise.all([
        getCategorias(false),
        getPlatos(),
        getIngredientes()
      ]);
      setCategorias(cats);
      setPlatos(plts);
      setIngredientes(ings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CATEGORÍAS ====================

  const handleGuardarCategoria = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      nombre: formData.get('nombre'),
      descripcion: formData.get('descripcion'),
      activa: formData.get('activa') === 'on',
      orden: parseInt(formData.get('orden')) || 0
    };

    try {
      if (categoriaEditar) {
        await actualizarCategoria(categoriaEditar.id, data);
        setSuccess('Categoría actualizada');
      } else {
        await crearCategoria(data);
        setSuccess('Categoría creada');
      }
      setShowCategoriaModal(false);
      setCategoriaEditar(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminarCategoria = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await eliminarCategoria(id);
      setSuccess('Categoría eliminada');
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  // ==================== PLATOS ====================

  const handleGuardarPlato = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      nombre: formData.get('nombre'),
      descripcion: formData.get('descripcion'),
      precio: parseFloat(formData.get('precio')),
      categoria: parseInt(formData.get('categoria')),
      tiempo_preparacion: parseInt(formData.get('tiempo_preparacion')) || 15,
      disponible: formData.get('disponible') === 'on',
      activo: formData.get('activo') === 'on'
    };

    try {
      if (platoEditar) {
        await actualizarPlato(platoEditar.id, data);
        setSuccess('Plato actualizado');
      } else {
        await crearPlato(data);
        setSuccess('Plato creado');
      }
      setShowPlatoModal(false);
      setPlatoEditar(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminarPlato = async (id) => {
    if (!confirm('¿Eliminar este plato?')) return;
    try {
      await eliminarPlato(id);
      setSuccess('Plato eliminado');
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  // ==================== RECETAS ====================

  const handleVerReceta = async (plato) => {
    try {
      setPlatoReceta(plato);
      const receta = await getRecetaPlato(plato.id);
      setRecetaActual(receta);
      setShowRecetaModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAgregarIngrediente = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      ingrediente: parseInt(formData.get('ingrediente')),
      cantidad_requerida: parseFloat(formData.get('cantidad'))
    };

    try {
      await agregarIngredienteReceta(platoReceta.id, data);
      const receta = await getRecetaPlato(platoReceta.id);
      setRecetaActual(receta);
      setSuccess('Ingrediente agregado a la receta');
      e.target.reset();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminarIngredienteReceta = async (recetaId) => {
    try {
      await eliminarReceta(recetaId);
      const receta = await getRecetaPlato(platoReceta.id);
      setRecetaActual(receta);
      setSuccess('Ingrediente eliminado de la receta');
    } catch (err) {
      setError(err.message);
    }
  };

  // Limpiar mensajes
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Cargando menú...</p>
      </div>
    );
  }

  return (
    <Container fluid>
      {/* Alertas */}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Título */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">
          <i className="bi bi-journal-text me-2"></i>
          Gestión del Menú
        </h3>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
        {/* TAB: PLATOS */}
        <Tab eventKey="platos" title={<><i className="bi bi-egg-fried me-1"></i> Platos</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Platos del Menú ({platos.length})</span>
              <Button size="sm" onClick={() => { setPlatoEditar(null); setShowPlatoModal(true); }}>
                <i className="bi bi-plus-lg me-1"></i> Nuevo Plato
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Tiempo</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {platos.map(plato => (
                    <tr key={plato.id}>
                      <td className="fw-medium">{plato.nombre}</td>
                      <td>{plato.categoria_nombre}</td>
                      <td>${Number(plato.precio).toLocaleString('es-CL')}</td>
                      <td>{plato.tiempo_preparacion} min</td>
                      <td>
                        {plato.disponible ? (
                          <Badge bg="success">Disponible</Badge>
                        ) : (
                          <Badge bg="secondary">No disponible</Badge>
                        )}
                        {!plato.activo && <Badge bg="dark" className="ms-1">Inactivo</Badge>}
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-info"
                          size="sm"
                          className="me-1"
                          onClick={() => handleVerReceta(plato)}
                          title="Ver receta"
                        >
                          <i className="bi bi-list-check"></i>
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1"
                          onClick={() => { setPlatoEditar(plato); setShowPlatoModal(true); }}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleEliminarPlato(plato.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* TAB: CATEGORÍAS */}
        <Tab eventKey="categorias" title={<><i className="bi bi-folder me-1"></i> Categorías</>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Categorías ({categorias.length})</span>
              <Button size="sm" onClick={() => { setCategoriaEditar(null); setShowCategoriaModal(true); }}>
                <i className="bi bi-plus-lg me-1"></i> Nueva Categoría
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Orden</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Platos</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.sort((a, b) => a.orden - b.orden).map(cat => (
                    <tr key={cat.id}>
                      <td>{cat.orden}</td>
                      <td className="fw-medium">{cat.nombre}</td>
                      <td className="text-muted small">{cat.descripcion || '-'}</td>
                      <td>
                        <Badge bg="light" text="dark">
                          {platos.filter(p => p.categoria === cat.id).length}
                        </Badge>
                      </td>
                      <td>
                        {cat.activa ? (
                          <Badge bg="success">Activa</Badge>
                        ) : (
                          <Badge bg="secondary">Inactiva</Badge>
                        )}
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1"
                          onClick={() => { setCategoriaEditar(cat); setShowCategoriaModal(true); }}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleEliminarCategoria(cat.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* MODAL: CATEGORÍA */}
      <Modal show={showCategoriaModal} onHide={() => setShowCategoriaModal(false)}>
        <Form onSubmit={handleGuardarCategoria}>
          <Modal.Header closeButton>
            <Modal.Title>
              {categoriaEditar ? 'Editar Categoría' : 'Nueva Categoría'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                name="nombre"
                defaultValue={categoriaEditar?.nombre}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                name="descripcion"
                rows={2}
                defaultValue={categoriaEditar?.descripcion}
              />
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Orden</Form.Label>
                  <Form.Control
                    type="number"
                    name="orden"
                    defaultValue={categoriaEditar?.orden || 0}
                  />
                </Form.Group>
              </Col>
              <Col className="d-flex align-items-end">
                <Form.Check
                  type="switch"
                  name="activa"
                  label="Activa"
                  defaultChecked={categoriaEditar?.activa !== false}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCategoriaModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL: PLATO */}
      <Modal show={showPlatoModal} onHide={() => setShowPlatoModal(false)} size="lg">
        <Form onSubmit={handleGuardarPlato}>
          <Modal.Header closeButton>
            <Modal.Title>
              {platoEditar ? 'Editar Plato' : 'Nuevo Plato'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre</Form.Label>
                  <Form.Control
                    name="nombre"
                    defaultValue={platoEditar?.nombre}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoría</Form.Label>
                  <Form.Select name="categoria" defaultValue={platoEditar?.categoria} required>
                    <option value="">Seleccionar...</option>
                    {categorias.filter(c => c.activa).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                name="descripcion"
                rows={2}
                defaultValue={platoEditar?.descripcion}
              />
            </Form.Group>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Precio ($)</Form.Label>
                  <Form.Control
                    type="number"
                    name="precio"
                    step="1"
                    min="0"
                    defaultValue={platoEditar?.precio}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Tiempo prep. (min)</Form.Label>
                  <Form.Control
                    type="number"
                    name="tiempo_preparacion"
                    min="1"
                    defaultValue={platoEditar?.tiempo_preparacion || 15}
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex flex-column justify-content-end pb-3">
                <Form.Check
                  type="switch"
                  name="disponible"
                  label="Disponible"
                  defaultChecked={platoEditar?.disponible !== false}
                  className="mb-2"
                />
                <Form.Check
                  type="switch"
                  name="activo"
                  label="Activo"
                  defaultChecked={platoEditar?.activo !== false}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPlatoModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL: RECETA */}
      <Modal show={showRecetaModal} onHide={() => setShowRecetaModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Receta: {platoReceta?.nombre}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Lista de ingredientes actuales */}
          {recetaActual.length > 0 ? (
            <Table size="sm" className="mb-4">
              <thead className="table-light">
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recetaActual.map(item => (
                  <tr key={item.id}>
                    <td>{item.ingrediente_nombre}</td>
                    <td>{item.cantidad_requerida} {item.unidad_medida}</td>
                    <td className="text-end">
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleEliminarIngredienteReceta(item.id)}
                      >
                        <i className="bi bi-x"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="info" className="mb-4">
              Este plato no tiene ingredientes asignados
            </Alert>
          )}

          {/* Agregar ingrediente */}
          <Card bg="light">
            <Card.Body>
              <Card.Title className="h6">Agregar Ingrediente</Card.Title>
              <Form onSubmit={handleAgregarIngrediente}>
                <Row className="align-items-end">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Ingrediente</Form.Label>
                      <Form.Select name="ingrediente" required>
                        <option value="">Seleccionar...</option>
                        {ingredientes
                          .filter(i => i.activo && !recetaActual.some(r => r.ingrediente === i.id))
                          .map(ing => (
                            <option key={ing.id} value={ing.id}>
                              {ing.nombre} ({ing.unidad_medida})
                            </option>
                          ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Cantidad</Form.Label>
                      <Form.Control
                        type="number"
                        name="cantidad"
                        step="0.001"
                        min="0.001"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Button type="submit" variant="primary" className="w-100">
                      <i className="bi bi-plus-lg"></i>
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRecetaModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default GestionMenu;
