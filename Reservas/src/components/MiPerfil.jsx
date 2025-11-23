import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, Spinner } from 'react-bootstrap';
import { getCurrentUser, getPerfil, updatePerfil } from '../services/reservasApi';
import {
  validarRUT,
  validarTelefono,
  formatearRUT,
  formatearTelefono
} from '../utils/validaciones';

export default function MiPerfil() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);

  console.log('MiPerfil renderizado, editMode:', editMode);

  const user = getCurrentUser();

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    rut: '',
    email: user?.email || ''
  });

  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    console.log('MiPerfil montado - cargando perfil');
    cargarPerfil();

    return () => {
      console.log('MiPerfil desmontado');
    };
  }, []);

  // Rastrear cambios en editMode
  useEffect(() => {
    console.log('🔄 editMode cambió a:', editMode);
    console.trace('Stack trace del cambio de editMode');
  }, [editMode]);

  const cargarPerfil = async () => {
    try {
      console.log('cargarPerfil llamado');
      setError('');
      setSuccess('');

      // Obtener datos del perfil desde el backend
      const perfilData = await getPerfil();

      // Separar nombre completo en nombre y apellido
      const partes = perfilData.nombre_completo ? perfilData.nombre_completo.split(' ') : ['', ''];
      const nombre = partes[0] || '';
      const apellido = partes.slice(1).join(' ') || '';

      setFormData({
        nombre: nombre,
        apellido: apellido,
        telefono: perfilData.telefono || '',
        rut: perfilData.rut || '',
        email: perfilData.email || ''
      });
    } catch (err) {
      setError('Error al cargar el perfil');
      console.error('Error al cargar perfil:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Campo ${name} cambiado a: ${value}, editMode: ${editMode}`);
    let processedValue = value;

    // Formatear RUT y teléfono mientras se escribe
    if (name === 'rut' && value) {
      processedValue = formatearRUT(value);
    }
    if (name === 'telefono' && value) {
      processedValue = formatearTelefono(value);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    setError('');

    // Validar campo en tiempo real si estamos en modo edición
    if (editMode) {
      validateField(name, processedValue);
    }
  };

  const validateField = (name, value) => {
    let validation = { valido: true, mensaje: '' };

    switch (name) {
      case 'rut':
        if (value) validation = validarRUT(value);
        break;
      case 'telefono':
        if (value) validation = validarTelefono(value);
        break;
      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [name]: validation.valido ? '' : validation.mensaje
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.nombre || formData.nombre.trim() === '') {
      errors.nombre = 'El nombre es requerido';
    }

    if (!formData.apellido || formData.apellido.trim() === '') {
      errors.apellido = 'El apellido es requerido';
    }

    if (formData.rut) {
      const rutVal = validarRUT(formData.rut);
      if (!rutVal.valido) errors.rut = rutVal.mensaje;
    }

    if (formData.telefono) {
      const telefonoVal = validarTelefono(formData.telefono);
      if (!telefonoVal.valido) errors.telefono = telefonoVal.mensaje;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setError('Por favor corrija los errores en el formulario');
      return;
    }

    setLoading(true);

    try {
      // Llamar al backend para actualizar el perfil
      const response = await updatePerfil({
        nombre: formData.nombre,
        apellido: formData.apellido,
        telefono: formData.telefono,
        rut: formData.rut
      });

      setSuccess(response.message || 'Perfil actualizado exitosamente');
      setEditMode(false);

      // Recargar el perfil para obtener los datos actualizados
      await cargarPerfil();

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al actualizar el perfil');
      console.error('Error al guardar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = () => {
    console.log('handleCancelar llamado');
    setEditMode(false);
    setError('');
    setSuccess('');
    setValidationErrors({});
    cargarPerfil();
  };

  return (
    <Container fluid className="py-4">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-person-circle me-2"></i>
                  Mi Perfil
                </h5>
                {editMode && (
                  <Badge bg="warning" text="dark">
                    <i className="bi bi-pencil-fill me-1"></i>
                    Modo Edición
                  </Badge>
                )}
              </div>
            </Card.Header>
            <Card.Body className="p-4">
              {error && (
                <Alert variant="danger" dismissible onClose={() => setError('')}>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert variant="success" dismissible onClose={() => setSuccess('')}>
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label htmlFor="nombre">
                        Nombre <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        id="nombre"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        disabled={!editMode}
                        isInvalid={!!validationErrors.nombre}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.nombre}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label htmlFor="apellido">
                        Apellido <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        id="apellido"
                        name="apellido"
                        value={formData.apellido}
                        onChange={handleChange}
                        disabled={!editMode}
                        isInvalid={!!validationErrors.apellido}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.apellido}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="email">Email</Form.Label>
                  <Form.Control
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    disabled
                  />
                  <Form.Text className="text-muted">
                    El email no se puede modificar
                  </Form.Text>
                </Form.Group>

                <Row>
                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label htmlFor="telefono">Teléfono</Form.Label>
                      <Form.Control
                        type="text"
                        id="telefono"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        placeholder="+56 9 1234 5678"
                        disabled={!editMode}
                        isInvalid={!!validationErrors.telefono}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.telefono}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>

                  <Col md={6} className="mb-3">
                    <Form.Group>
                      <Form.Label htmlFor="rut">RUT</Form.Label>
                      <Form.Control
                        type="text"
                        id="rut"
                        name="rut"
                        value={formData.rut}
                        onChange={handleChange}
                        placeholder="12.345.678-9"
                        disabled={!editMode}
                        isInvalid={!!validationErrors.rut}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.rut}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2 mt-4">
                  {!editMode ? (
                    <Button
                      variant="primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('=== CLICK EN EDITAR PERFIL ===');
                        console.log('editMode antes:', editMode);
                        setEditMode(true);
                        console.log('setEditMode(true) ejecutado');
                        setTimeout(() => {
                          console.log('editMode después (100ms):', editMode);
                        }, 100);
                      }}
                      type="button"
                    >
                      <i className="bi bi-pencil me-2"></i>
                      Editar Perfil
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="submit"
                        variant="success"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check-circle me-2"></i>
                            Guardar Cambios
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleCancelar}
                        disabled={loading}
                      >
                        <i className="bi bi-x-circle me-2"></i>
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </Form>

              <div className="mt-4 pt-4 border-top">
                <h6 className="text-muted">Información de la cuenta</h6>
                <Row>
                  <Col md={6}>
                    <small className="text-muted d-block">Usuario:</small>
                    <strong>{user?.username}</strong>
                  </Col>
                  <Col md={6}>
                    <small className="text-muted d-block">Rol:</small>
                    <Badge bg="primary">{user?.rol_display}</Badge>
                  </Col>
                </Row>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
