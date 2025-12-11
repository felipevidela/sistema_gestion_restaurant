import { useState, useEffect, useMemo } from 'react';
import {
  Container, Row, Col, Card, Table, Button, Modal, Form,
  Badge, Spinner, Alert, InputGroup, ProgressBar, OverlayTrigger, Tooltip
} from 'react-bootstrap';
import {
  getIngredientes, crearIngrediente, actualizarIngrediente,
  eliminarIngrediente, getIngredientesBajoStock
} from '../../services/menuApi';

// Estilos CSS para animaciones
const styles = `
  .stock-card {
    transition: transform 0.2s ease;
  }
  .stock-card:hover {
    transform: translateY(-2px);
  }
  .pulse-alert {
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .progress-animated {
    transition: width 0.5s ease;
  }
  .modal-section {
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 16px;
    background: linear-gradient(145deg, #ffffff, #f8f9fb);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
  }
  .field-hint {
    font-size: 0.85rem;
    color: #6c757d;
  }
  .pill-muted {
    background: #f1f3f5;
    color: #495057;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
  }
`;

const UNIDADES_MEDIDA = [
  { value: 'gr', label: 'Gramos (gr)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'un', label: 'Unidades (un)' },
  { value: 'lt', label: 'Litros (lt)' },
  { value: 'ml', label: 'Mililitros (ml)' },
];

// Evita duplicados cuando el backend retorna el mismo ingrediente varias veces
const dedupeById = (items = []) => Array.from(new Map(items.map(item => [item.id, item])).values());

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
  const [ajusteTipo, setAjusteTipo] = useState('agregar');
  const [ajusteCantidad, setAjusteCantidad] = useState('');

  // Modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Filtros
  const [filtro, setFiltro] = useState('todos'); // todos, bajo_stock, sin_stock, activos

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
      setIngredientes(dedupeById(ings || []));
      setIngredientesBajoStock(dedupeById(bajos || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar ingredientes bajo stock excluyendo los que tienen 0 stock
  const ingredientesBajoStockSinCero = useMemo(
    () => dedupeById(ingredientesBajoStock).filter(i => parseFloat(i.cantidad_disponible) > 0),
    [ingredientesBajoStock]
  );

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
        const ingredienteActualizado = await actualizarIngrediente(ingredienteEditar.id, data);
        // Actualización optimista: actualizar en la lista inmediatamente
        setIngredientes(ingredientes.map(i => i.id === ingredienteActualizado.id ? ingredienteActualizado : i));
        // Actualizar también la lista de bajo stock si aplica
        const bajosActualizada = ingredienteActualizado.bajo_stock
          ? ingredientesBajoStock.some(i => i.id === ingredienteActualizado.id)
            ? ingredientesBajoStock.map(i => i.id === ingredienteActualizado.id ? ingredienteActualizado : i)
            : [...ingredientesBajoStock, ingredienteActualizado]
          : ingredientesBajoStock.filter(i => i.id !== ingredienteActualizado.id);
        setIngredientesBajoStock(dedupeById(bajosActualizada));
        setSuccess('Ingrediente actualizado');
      } else {
        const nuevoIngrediente = await crearIngrediente(data);
        // Actualización optimista: agregar inmediatamente
        setIngredientes([...ingredientes, nuevoIngrediente]);
        // Si está bajo stock, agregarlo también a esa lista
        if (nuevoIngrediente.bajo_stock) {
          setIngredientesBajoStock(dedupeById([...ingredientesBajoStock, nuevoIngrediente]));
        }
        setSuccess('Ingrediente creado');
      }
      setShowModal(false);
      setIngredienteEditar(null);
    } catch (err) {
      setError(err.message);
      // En caso de error, recargar para asegurar consistencia
      await cargarDatos();
    }
  };

  // Mostrar modal de confirmación
  const showConfirm = (message, onConfirm) => {
    setConfirmAction({ message, onConfirm });
    setShowConfirmModal(true);
  };

  // Eliminar ingrediente
  const handleEliminar = (id, nombre) => {
    showConfirm(`¿Eliminar el ingrediente "${nombre}"?`, async () => {
      try {
        await eliminarIngrediente(id);
        // Actualización optimista: eliminar inmediatamente
        setIngredientes(ingredientes.filter(i => i.id !== id));
        setIngredientesBajoStock(ingredientesBajoStock.filter(i => i.id !== id));
        setSuccess('Ingrediente eliminado');
      } catch (err) {
        setError(err.message);
        // En caso de error, recargar para asegurar consistencia
        await cargarDatos();
      }
    });
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
      const ingredienteActualizado = await actualizarIngrediente(ingredienteAjuste.id, {
        cantidad_disponible: nuevaCantidad
      });

      // Actualización optimista: actualizar inmediatamente
      setIngredientes(ingredientes.map(i =>
        i.id === ingredienteActualizado.id ? ingredienteActualizado : i
      ));

      // Actualizar lista de bajo stock según el nuevo estado
      const bajosActualizada = ingredienteActualizado.bajo_stock
        ? ingredientesBajoStock.some(i => i.id === ingredienteActualizado.id)
          ? ingredientesBajoStock.map(i => i.id === ingredienteActualizado.id ? ingredienteActualizado : i)
          : [...ingredientesBajoStock, ingredienteActualizado]
        : ingredientesBajoStock.filter(i => i.id !== ingredienteActualizado.id);
      setIngredientesBajoStock(dedupeById(bajosActualizada));

      setSuccess(`Stock actualizado: ${ingredienteAjuste.nombre}`);
      setShowAjusteModal(false);
      setIngredienteAjuste(null);
    } catch (err) {
      setError(err.message);
      // En caso de error, recargar para asegurar consistencia
      await cargarDatos();
    }
  };

  // Filtrar ingredientes
  const ingredientesFiltrados = (() => {
    if (filtro === 'sin_stock') {
      return ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0);
    }
    if (filtro === 'bajo_stock') {
      // Usar array dedicado del endpoint /bajo_minimo/ para consistencia con contador
      return ingredientesBajoStockSinCero;
    }
    if (filtro === 'activos') {
      return ingredientes.filter(i => i.activo);
    }
    return ingredientes;
  })();

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
      {/* Inyectar estilos */}
      <style>{styles}</style>

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

      {/* Resumen con iconos */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm stock-card">
            <Card.Body>
              <i className="bi bi-archive text-primary" style={{ fontSize: '1.5rem' }}></i>
              <div className="h2 mb-0 text-primary">{ingredientes.length.toLocaleString('es-CL')}</div>
              <small className="text-muted">Total Ingredientes</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm stock-card">
            <Card.Body>
              <i className="bi bi-check-circle text-success" style={{ fontSize: '1.5rem' }}></i>
              <div className="h2 mb-0 text-success">
                {ingredientes.filter(i => i.activo).length.toLocaleString('es-CL')}
              </div>
              <small className="text-muted">Activos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm stock-card">
            <Card.Body>
              <i className="bi bi-exclamation-triangle text-danger" style={{ fontSize: '1.5rem' }}></i>
              <div className="h2 mb-0 text-danger">
                {ingredientesBajoStockSinCero.length.toLocaleString('es-CL')}
              </div>
              <small className="text-muted">Bajo Stock</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-0 shadow-sm stock-card">
            <Card.Body>
              <i className="bi bi-x-circle text-warning" style={{ fontSize: '1.5rem' }}></i>
              <div className="h2 mb-0 text-warning">
                {ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length.toLocaleString('es-CL')}
              </div>
              <small className="text-muted">Sin Stock</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Alerta de bajo stock con animación */}
      {(ingredientesBajoStockSinCero.length > 0 ||
        ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length > 0) && (
        <Alert variant="warning" className="mb-4 pulse-alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {ingredientesBajoStockSinCero.length > 0 && (
            <>
              <strong>{ingredientesBajoStockSinCero.length} ingredientes</strong> con bajo stock
              {ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length > 0 && ', '}
            </>
          )}
          {ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length > 0 && (
            <>
              <strong>{ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length}</strong> sin stock
            </>
          )}
          {ingredientesBajoStockSinCero.length > 0 && (
            <>
              : {ingredientesBajoStockSinCero.slice(0, 3).map(i => i.nombre).join(', ')}
              {ingredientesBajoStockSinCero.length > 3 && ` y ${ingredientesBajoStockSinCero.length - 3} más`}
            </>
          )}
        </Alert>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <Card.Body className="py-2">
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant={filtro === 'todos' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setFiltro('todos')}
            >
              Todos ({ingredientes.length})
            </Button>
            <Button
              variant={filtro === 'sin_stock' ? 'warning' : 'outline-warning'}
              size="sm"
              onClick={() => setFiltro('sin_stock')}
            >
              Sin Stock ({ingredientes.filter(i => parseFloat(i.cantidad_disponible) === 0).length})
            </Button>
            <Button
              variant={filtro === 'bajo_stock' ? 'danger' : 'outline-danger'}
              size="sm"
              onClick={() => setFiltro('bajo_stock')}
            >
              Bajo Stock ({ingredientesBajoStockSinCero.length})
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
                        className="progress-animated"
                        style={{ height: '8px' }}
                      />
                      <small className="text-muted">{porcentaje.toFixed(0)}% del mínimo</small>
                    </td>
                    <td>
                      {parseFloat(ing.stock_minimo).toFixed(2)} {ing.unidad_medida}
                    </td>
                    <td>${Number(ing.precio_unitario).toLocaleString('es-CL')}</td>
                    <td>
                      {parseFloat(ing.cantidad_disponible) === 0 ? (
                        <Badge bg="warning">Sin Stock</Badge>
                      ) : ing.bajo_stock ? (
                        <Badge bg="danger">Bajo Stock</Badge>
                      ) : ing.activo ? (
                        <Badge bg="success">OK</Badge>
                      ) : (
                        <Badge bg="secondary">Inactivo</Badge>
                      )}
                    </td>
                    <td className="text-end">
                      <OverlayTrigger placement="top" overlay={<Tooltip>Ajustar stock</Tooltip>}>
                        <Button
                          variant="outline-success"
                          size="sm"
                          className="me-1"
                          onClick={() => {
                            setIngredienteAjuste(ing);
                            setAjusteTipo('agregar');
                            setAjusteCantidad('');
                            setShowAjusteModal(true);
                          }}
                        >
                          <i className="bi bi-plus-slash-minus"></i>
                        </Button>
                      </OverlayTrigger>
                      <OverlayTrigger placement="top" overlay={<Tooltip>Editar ingrediente</Tooltip>}>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1"
                          onClick={() => { setIngredienteEditar(ing); setShowModal(true); }}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                      </OverlayTrigger>
                      <OverlayTrigger placement="top" overlay={<Tooltip>Eliminar ingrediente</Tooltip>}>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleEliminar(ing.id, ing.nombre)}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </OverlayTrigger>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* MODAL: Crear/Editar Ingrediente */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" fullscreen="sm-down">
        <Form onSubmit={handleGuardar}>
          <Modal.Header closeButton className="flex-wrap">
            <Modal.Title className="me-auto">
              <i className="bi bi-archive me-2"></i>
              {ingredienteEditar ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
            </Modal.Title>
            <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
              <span className="pill-muted d-none d-sm-inline">
                {ingredienteEditar ? 'Modo edición' : 'Creación rápida'}
              </span>
              {ingredienteEditar && (
                <Badge bg={ingredienteEditar.activo === false ? 'secondary' : 'success'}>
                  {ingredienteEditar.activo === false ? 'Inactivo' : 'Activo'}
                </Badge>
              )}
            </div>
          </Modal.Header>
          <Modal.Body className="bg-light">
            <Row className="gy-3">
              <Col xs={12} lg={8}>
                <div className="modal-section h-100">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Nombre</Form.Label>
                    <Form.Control
                      name="nombre"
                      defaultValue={ingredienteEditar?.nombre}
                      placeholder="Ej: Tomate, Filete de res..."
                      required
                    />
                    <div className="field-hint mt-1">Nombre legible que usarán cocina y menú.</div>
                  </Form.Group>
                  <Form.Group className="mb-0">
                    <Form.Label className="fw-semibold">Descripción</Form.Label>
                    <Form.Control
                      as="textarea"
                      name="descripcion"
                      rows={2}
                      defaultValue={ingredienteEditar?.descripcion}
                      placeholder="Notas opcionales para compras o preparación."
                    />
                  </Form.Group>
                </div>
              </Col>
              <Col xs={12} lg={4}>
                <div className="modal-section h-100">
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Unidad de Medida</Form.Label>
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
                  <Form.Check
                    type="switch"
                    name="activo"
                    label="Ingrediente activo"
                    defaultChecked={ingredienteEditar?.activo !== false}
                  />
                  <div className="field-hint mt-2">
                    Desactiva para ocultarlo en recetas y compras.
                  </div>
                </div>
              </Col>
            </Row>

            <Row className="gy-3 mt-1">
              <Col xs={12} sm={6} lg={4}>
                <div className="modal-section">
                  <Form.Label className="fw-semibold">Cantidad Disponible</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      name="cantidad_disponible"
                      step="0.001"
                      min="0"
                      defaultValue={ingredienteEditar?.cantidad_disponible || 0}
                      required
                    />
                    <InputGroup.Text>
                      {ingredienteEditar?.unidad_medida || 'un'}
                    </InputGroup.Text>
                  </InputGroup>
                  <div className="field-hint mt-1">Cantidad actual en bodega.</div>
                </div>
              </Col>
              <Col xs={12} sm={6} lg={4}>
                <div className="modal-section">
                  <Form.Label className="fw-semibold">Stock Mínimo</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="number"
                      name="stock_minimo"
                      step="0.001"
                      min="0"
                      defaultValue={ingredienteEditar?.stock_minimo || 0}
                      required
                    />
                    <InputGroup.Text>
                      {ingredienteEditar?.unidad_medida || 'un'}
                    </InputGroup.Text>
                  </InputGroup>
                  <div className="field-hint mt-1">Umbral para alertas de reposición.</div>
                </div>
              </Col>
              <Col xs={12} sm={12} lg={4}>
                <div className="modal-section">
                  <Form.Label className="fw-semibold">Precio Unitario ($)</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>$</InputGroup.Text>
                    <Form.Control
                      type="number"
                      name="precio_unitario"
                      step="1"
                      min="0"
                      defaultValue={ingredienteEditar?.precio_unitario || 0}
                      required
                    />
                  </InputGroup>
                  <div className="field-hint mt-1">Costo base para valorización.</div>
                </div>
              </Col>
            </Row>
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

      {/* MODAL: Ajuste Rápido de Stock con Preview */}
      <Modal show={showAjusteModal} onHide={() => setShowAjusteModal(false)}>
        <Form onSubmit={handleAjusteStock}>
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="bi bi-plus-slash-minus me-2"></i>
              Ajustar Stock: {ingredienteAjuste?.nombre}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="mb-3">
              <i className="bi bi-box me-2"></i>
              Stock actual: <strong>{parseFloat(ingredienteAjuste?.cantidad_disponible || 0).toFixed(2)} {ingredienteAjuste?.unidad_medida}</strong>
            </Alert>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tipo de Ajuste</Form.Label>
                  <Form.Select
                    name="tipo"
                    value={ajusteTipo}
                    onChange={(e) => setAjusteTipo(e.target.value)}
                    required
                  >
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
                    value={ajusteCantidad}
                    onChange={(e) => setAjusteCantidad(e.target.value)}
                    step="0.001"
                    min="0.001"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            {/* Preview del nuevo stock */}
            {ajusteCantidad && parseFloat(ajusteCantidad) > 0 && (
              <Alert
                variant={
                  ajusteTipo === 'restar' &&
                  parseFloat(ingredienteAjuste?.cantidad_disponible || 0) - parseFloat(ajusteCantidad) < 0
                    ? 'danger'
                    : 'success'
                }
                className="mb-0"
              >
                <i className={`bi ${ajusteTipo === 'agregar' ? 'bi-arrow-up' : 'bi-arrow-down'} me-2`}></i>
                Nuevo stock: <strong>
                  {ajusteTipo === 'agregar'
                    ? (parseFloat(ingredienteAjuste?.cantidad_disponible || 0) + parseFloat(ajusteCantidad)).toFixed(2)
                    : (parseFloat(ingredienteAjuste?.cantidad_disponible || 0) - parseFloat(ajusteCantidad)).toFixed(2)
                  } {ingredienteAjuste?.unidad_medida}
                </strong>
                {ajusteTipo === 'restar' &&
                 parseFloat(ingredienteAjuste?.cantidad_disponible || 0) - parseFloat(ajusteCantidad) < 0 && (
                  <div className="small mt-1 text-danger">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    La cantidad no puede ser negativa
                  </div>
                )}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAjusteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={
                ajusteTipo === 'restar' &&
                parseFloat(ingredienteAjuste?.cantidad_disponible || 0) - parseFloat(ajusteCantidad || 0) < 0
              }
            >
              <i className="bi bi-check-lg me-1"></i>
              Aplicar Ajuste
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* MODAL: Confirmación de eliminación */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-exclamation-triangle text-warning me-2"></i>
            Confirmar acción
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{confirmAction?.message}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setShowConfirmModal(false);
              confirmAction?.onConfirm?.();
            }}
          >
            <i className="bi bi-trash me-1"></i>
            Eliminar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default GestionStock;
