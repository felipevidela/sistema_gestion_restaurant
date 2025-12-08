import { useState, useEffect } from 'react';
import {
  Container, Row, Col, Card, Table, Button, Modal, Form,
  Badge, Spinner, Alert, InputGroup, ProgressBar
} from 'react-bootstrap';
import {
  getIngredientes, crearIngrediente, actualizarIngrediente,
  eliminarIngrediente, getIngredientesBajoStock
} from '../../services/menuApi';

const UNIDADES_MEDIDA = [
  { value: 'gr', label: 'Gramos (gr)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'un', label: 'Unidades (un)' },
  { value: 'lt', label: 'Litros (lt)' },
  { value: 'ml', label: 'Mililitros (ml)' },
];

/**
 * Panel de gestión de stock de ingredientes
 */
function GestionStock() {
  const [ingredientes, setIngredientes] = useState([]);
  const [ingredientesBajoStock, setIngredientesBajoStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [ingredienteEditar, setIngredienteEditar] = useState(null);

  // Modal de ajuste rápido de stock
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [ingredienteAjuste, setIngredienteAjuste] = useState(null);

  // Filtros
  const [filtro, setFiltro] = useState('todos'); // todos, bajo_stock, activos

  // Cargar datos
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ings, bajos] = await Promise.all([
        getIngredientes(),
        getIngredientesBajoStock()
      ]);
      setIngredientes(ings);
      setIngredientesBajoStock(bajos);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Guardar ingrediente
  const handleGuardar = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      nombre: formData.get('nombre'),
      descripcion: formData.get('descripcion'),
      unidad_medida: formData.get('unidad_medida'),
      cantidad_disponible: parseFloat(formData.get('cantidad_disponible')),
      stock_minimo: parseFloat(formData.get('stock_minimo')),
      precio_unitario: parseFloat(formData.get('precio_unitario')),
      activo: formData.get('activo') === 'on'
    };

    try {
      if (ingredienteEditar) {
        await actualizarIngrediente(ingredienteEditar.id, data);
        setSuccess('Ingrediente actualizado');
      } else {
        await crearIngrediente(data);
        setSuccess('Ingrediente creado');
      }
      setShowModal(false);
      setIngredienteEditar(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  // Eliminar ingrediente
  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este ingrediente?')) return;
    try {
      await eliminarIngrediente(id);
      setSuccess('Ingrediente eliminado');
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  // Ajuste rápido de stock
  const handleAjusteStock = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tipo = formData.get('tipo');
    const cantidad = parseFloat(formData.get('cantidad'));

    let nuevaCantidad;
    if (tipo === 'agregar') {
      nuevaCantidad = parseFloat(ingredienteAjuste.cantidad_disponible) + cantidad;
    } else {
      nuevaCantidad = parseFloat(ingredienteAjuste.cantidad_disponible) - cantidad;
    }

    if (nuevaCantidad < 0) {
      setError('La cantidad no puede ser negativa');
      return;
    }

    try {
      await actualizarIngrediente(ingredienteAjuste.id, {
        cantidad_disponible: nuevaCantidad
      });
      setSuccess(`Stock actualizado: ${ingredienteAjuste.nombre}`);
      setShowAjusteModal(false);
      setIngredienteAjuste(null);
      cargarDatos();
    } catch (err) {
      setError(err.message);
    }
  };

  // Filtrar ingredientes
  const ingredientesFiltrados = ingredientes.filter(ing => {
    if (filtro === 'bajo_stock') return ing.bajo_stock;
    if (filtro === 'activos') return ing.activo;
    return true;
  });

  // Calcular porcentaje de stock
  const calcularPorcentajeStock = (ing) => {
    if (ing.stock_minimo === 0) return 100;
    const porcentaje = (parseFloat(ing.cantidad_disponible) / parseFloat(ing.stock_minimo)) * 100;
    return Math.min(porcentaje, 100);
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
        <p className="mt-3 text-muted">Cargando inventario...</p>
      </div>
    );
  }

  return (
    <Container fluid>
      {/* Alertas */}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">
          <i className="bi bi-box-seam me-2"></i>
          Gestión de Stock
        </h3>
        <Button onClick={() => { setIngredienteEditar(null); setShowModal(true); }}>
          <i className="bi bi-plus-lg me-1"></i> Nuevo Ingrediente
        </Button>
      </div>

      {/* Resumen */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="h2 mb-0 text-primary">{ingredientes.length}</div>
              <small className="text-muted">Total Ingredientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="h2 mb-0 text-success">
                {ingredientes.filter(i => i.activo).length}
              </div>
              <small className="text-muted">Activos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="h2 mb-0 text-danger">
                {ingredientesBajoStock.length}
              </div>
              <small className="text-muted">Bajo Stock</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm">
            <Card.Body>
              <div className="h2 mb-0 text-warning">
                {ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length}
              </div>
              <small className="text-muted">Sin Stock</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Alerta de bajo stock */}
      {ingredientesBajoStock.length > 0 && (
        <Alert variant="warning" className="mb-4">
          <i className="bi bi-exclamation-triangle me-2"></i>
          <strong>{ingredientesBajoStock.length} ingredientes</strong> tienen stock por debajo del mínimo:
          {' '}
          {ingredientesBajoStock.slice(0, 3).map(i => i.nombre).join(', ')}
          {ingredientesBajoStock.length > 3 && ` y ${ingredientesBajoStock.length - 3} más`}
        </Alert>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <Card.Body className="py-2">
          <div className="d-flex gap-2">
            <Button
              variant={filtro === 'todos' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setFiltro('todos')}
            >
              Todos ({ingredientes.length})
            </Button>
            <Button
              variant={filtro === 'bajo_stock' ? 'danger' : 'outline-danger'}
              size="sm"
              onClick={() => setFiltro('bajo_stock')}
            >
              Bajo Stock ({ingredientesBajoStock.length})
            </Button>
            <Button
              variant={filtro === 'activos' ? 'success' : 'outline-success'}
              size="sm"
              onClick={() => setFiltro('activos')}
            >
              Activos ({ingredientes.filter(i => i.activo).length})
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Tabla de ingredientes */}
      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Ingrediente</th>
                <th>Stock Actual</th>
                <th style={{ width: '200px' }}>Nivel</th>
                <th>Stock Mínimo</th>
                <th>Precio Unit.</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingredientesFiltrados.map(ing => {
                const porcentaje = calcularPorcentajeStock(ing);
                const colorBarra = ing.bajo_stock ? 'danger' : porcentaje < 50 ? 'warning' : 'success';

                return (
                  <tr key={ing.id}>
                    <td>
                      <div className="fw-medium">{ing.nombre}</div>
                      {ing.descripcion && (
                        <small className="text-muted">{ing.descripcion}</small>
                      )}
                    </td>
                    <td className="fw-semibold">
                      {parseFloat(ing.cantidad_disponible).toFixed(2)} {ing.unidad_medida}
                    </td>
                    <td>
                      <ProgressBar
                        now={porcentaje}
                        variant={colorBarra}
                        style={{ height: '8px' }}
                      />
                      <small className="text-muted">{porcentaje.toFixed(0)}% del mínimo</small>
                    </td>
                    <td>
                      {parseFloat(ing.stock_minimo).toFixed(2)} {ing.unidad_medida}
                    </td>
                    <td>${Number(ing.precio_unitario).toLocaleString('es-CL')}</td>
                    <td>
                      {ing.bajo_stock ? (
                        <Badge bg="danger">Bajo Stock</Badge>
                      ) : ing.activo ? (
                        <Badge bg="success">OK</Badge>
                      ) : (
                        <Badge bg="secondary">Inactivo</Badge>
                      )}
                    </td>
                    <td className="text-end">
                      <Button
                        variant="outline-success"
                        size="sm"
                        className="me-1"
                        onClick={() => { setIngredienteAjuste(ing); setShowAjusteModal(true); }}
                        title="Ajustar stock"
                      >
                        <i className="bi bi-plus-slash-minus"></i>
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-1"
                        onClick={() => { setIngredienteEditar(ing); setShowModal(true); }}
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleEliminar(ing.id)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* MODAL: Crear/Editar Ingrediente */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Form onSubmit={handleGuardar}>
          <Modal.Header closeButton>
            <Modal.Title>
              {ingredienteEditar ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre</Form.Label>
                  <Form.Control
                    name="nombre"
                    defaultValue={ingredienteEditar?.nombre}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Unidad de Medida</Form.Label>
                  <Form.Select
                    name="unidad_medida"
                    defaultValue={ingredienteEditar?.unidad_medida || 'un'}
                    required
                  >
                    {UNIDADES_MEDIDA.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
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
                defaultValue={ingredienteEditar?.descripcion}
              />
            </Form.Group>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Cantidad Disponible</Form.Label>
                  <Form.Control
                    type="number"
                    name="cantidad_disponible"
                    step="0.001"
                    min="0"
                    defaultValue={ingredienteEditar?.cantidad_disponible || 0}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Stock Mínimo</Form.Label>
                  <Form.Control
                    type="number"
                    name="stock_minimo"
                    step="0.001"
                    min="0"
                    defaultValue={ingredienteEditar?.stock_minimo || 0}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Precio Unitario ($)</Form.Label>
                  <Form.Control
                    type="number"
                    name="precio_unitario"
                    step="1"
                    min="0"
                    defaultValue={ingredienteEditar?.precio_unitario || 0}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Check
              type="switch"
              name="activo"
              label="Ingrediente activo"
              defaultChecked={ingredienteEditar?.activo !== false}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL: Ajuste Rápido de Stock */}
      <Modal show={showAjusteModal} onHide={() => setShowAjusteModal(false)}>
        <Form onSubmit={handleAjusteStock}>
          <Modal.Header closeButton>
            <Modal.Title>
              Ajustar Stock: {ingredienteAjuste?.nombre}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              Stock actual: <strong>{ingredienteAjuste?.cantidad_disponible} {ingredienteAjuste?.unidad_medida}</strong>
            </Alert>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tipo de Ajuste</Form.Label>
                  <Form.Select name="tipo" required>
                    <option value="agregar">Agregar stock</option>
                    <option value="restar">Restar stock</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Cantidad ({ingredienteAjuste?.unidad_medida})</Form.Label>
                  <Form.Control
                    type="number"
                    name="cantidad"
                    step="0.001"
                    min="0.001"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAjusteModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Aplicar Ajuste
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default GestionStock;
