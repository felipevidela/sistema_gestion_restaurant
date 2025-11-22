import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { register } from '../services/reservasApi';
import { useAuth } from '../contexts/AuthContext';
import {
  validarUsername,
  validarPassword,
  validarPasswordConfirm,
  validarEmail,
  validarRUT,
  validarTelefono,
  formatearRUT,
  formatearTelefono
} from '../utils/validaciones';

export default function LoginForm({ onLoginSuccess }) {
  const { login: authLogin } = useAuth();
  const [modo, setModo] = useState('login'); // 'login' o 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para mostrar/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Estados para login
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  // Estados para registro
  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    nombre: '',
    apellido: '',
    rut: '',
    telefono: '',
    email_perfil: ''
  });

  // Errores de validación en tiempo real
  const [validationErrors, setValidationErrors] = useState({});

  // Manejar cambios en formulario de login
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  // Manejar cambios en formulario de registro con validación en tiempo real
  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Formatear RUT mientras se escribe
    if (name === 'rut' && value) {
      processedValue = formatearRUT(value);
    }

    // Formatear teléfono mientras se escribe
    if (name === 'telefono' && value) {
      processedValue = formatearTelefono(value);
    }

    setRegisterData(prev => ({ ...prev, [name]: processedValue }));
    setError('');

    // Validar campo en tiempo real
    validateField(name, processedValue);
  };

  // Validar campo individual
  const validateField = (name, value) => {
    let validation = { valido: true, mensaje: '' };

    switch (name) {
      case 'username':
        validation = validarUsername(value);
        break;
      case 'password':
        validation = validarPassword(value);
        break;
      case 'password_confirm':
        validation = validarPasswordConfirm(registerData.password, value);
        break;
      case 'email':
        validation = validarEmail(value);
        break;
      case 'rut':
        validation = validarRUT(value);
        break;
      case 'telefono':
        validation = validarTelefono(value);
        break;
      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [name]: validation.valido ? '' : validation.mensaje
    }));
  };

  // Validar todo el formulario de registro
  const validateRegisterForm = () => {
    const errors = {};

    const usernameVal = validarUsername(registerData.username);
    if (!usernameVal.valido) errors.username = usernameVal.mensaje;

    const emailVal = validarEmail(registerData.email);
    if (!emailVal.valido) errors.email = emailVal.mensaje;

    const passwordVal = validarPassword(registerData.password);
    if (!passwordVal.valido) errors.password = passwordVal.mensaje;

    const passwordConfirmVal = validarPasswordConfirm(registerData.password, registerData.password_confirm);
    if (!passwordConfirmVal.valido) errors.password_confirm = passwordConfirmVal.mensaje;

    if (!registerData.nombre || registerData.nombre.trim() === '') {
      errors.nombre = 'El nombre es requerido';
    }

    if (!registerData.apellido || registerData.apellido.trim() === '') {
      errors.apellido = 'El apellido es requerido';
    }

    const rutVal = validarRUT(registerData.rut);
    if (!rutVal.valido) errors.rut = rutVal.mensaje;

    const telefonoVal = validarTelefono(registerData.telefono);
    if (!telefonoVal.valido) errors.telefono = telefonoVal.mensaje;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Manejar submit de login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validaciones básicas
    if (!loginData.username || !loginData.password) {
      setError('Por favor ingrese usuario y contraseña');
      setLoading(false);
      return;
    }

    if (loginData.username.trim().length < 3) {
      setError('El usuario debe tener al menos 3 caracteres');
      setLoading(false);
      return;
    }

    if (loginData.password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      setLoading(false);
      return;
    }

    try {
      // Usar el método login del AuthContext
      const userData = await authLogin(loginData);
      console.log('Login exitoso:', userData);

      if (onLoginSuccess) {
        onLoginSuccess(userData);
      }
    } catch (err) {
      // Mostrar mensaje de error más descriptivo
      const errorMessage = err.message || 'Error al iniciar sesión';

      // Si el error contiene "Credenciales inválidas", mostrar mensaje más amigable
      if (errorMessage.toLowerCase().includes('credenciales') ||
          errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('401')) {
        setError('Usuario o contraseña incorrectos. Por favor verifica tus datos e intenta nuevamente.');
      } else {
        setError(errorMessage);
      }

      console.error('Error en login:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manejar submit de registro
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validar formulario
    if (!validateRegisterForm()) {
      setError('Por favor corrija los errores en el formulario');
      setLoading(false);
      return;
    }

    try {
      const userData = await register(registerData);
      console.log('Registro exitoso:', userData);
      setSuccess('¡Registro exitoso! Redirigiendo...');

      // Auto-login después del registro
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        }
      }, 1500);
    } catch (err) {
      setError(err.message || 'Error al registrar usuario');
      console.error('Error en registro:', err);
    } finally {
      setLoading(false);
    }
  };

  // Alternar entre login y registro
  const toggleModo = () => {
    setModo(modo === 'login' ? 'register' : 'login');
    setError('');
    setSuccess('');
    setValidationErrors({});
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center align-items-center min-vh-100">
        <Col lg={10}>
          <Row className="g-4 align-items-stretch">
            <Col lg={5}>
              <div className="auth-hero h-100 rounded-4 shadow-sm p-4">
                <div className="auth-hero__pill text-uppercase small">Plataforma</div>
                <h3 className="text-white fw-bold mt-3">Gestiona tus reservas sin fricción</h3>
                <p className="text-white-50 mb-4">
                  Centraliza tus turnos, confirma asistentes y da una bienvenida más rápida a tus clientes.
                </p>
                <ul className="list-unstyled auth-checklist mb-4">
                    <li><i className="bi bi-check-circle-fill me-2"></i>Confirmaciones en segundos</li>
                    <li><i className="bi bi-check-circle-fill me-2"></i>Visión diaria y mensual</li>
                    <li><i className="bi bi-check-circle-fill me-2"></i>Usuarios y roles listos</li>
                </ul>
                <div className="d-flex align-items-center gap-2 text-white-50 small">
                  <i className="bi bi-shield-lock"></i> Datos protegidos y sesión segura
                </div>
              </div>
            </Col>
            <Col lg={7}>
              <Card className="shadow auth-card h-100 border-0">
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                    <div>
                      <h3 className="fw-bold text-primary mb-0">Sistema de Reservas</h3>
                      <small className="text-muted">
                        {modo === 'login' ? 'Ingresa para gestionar tus reservas' : 'Crea tu cuenta y reserva en minutos'}
                      </small>
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                      <Button
                        type="button"
                        variant={modo === 'login' ? 'primary' : 'outline-primary'}
                        onClick={() => setModo('login')}
                      >
                        Ingresar
                      </Button>
                      <Button
                        type="button"
                        variant={modo === 'register' ? 'success' : 'outline-success'}
                        onClick={() => setModo('register')}
                      >
                        Registrarse
                      </Button>
                    </div>
                  </div>

                  {/* Mensajes de error y éxito */}
                  {error && (
                    <Alert variant="danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {error.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </Alert>
                  )}

                  {success && (
                    <Alert variant="success">
                      <i className="bi bi-check-circle me-2"></i>
                      {success}
                    </Alert>
                  )}

                  {/* FORMULARIO DE LOGIN */}
                  {modo === 'login' && (
                    <Form onSubmit={handleLoginSubmit}>
                      <Form.Group className="mb-3">
                        <Form.Label htmlFor="username">Email o Usuario</Form.Label>
                        <InputGroup>
                          <InputGroup.Text><i className="bi bi-person"></i></InputGroup.Text>
                          <Form.Control
                            type="text"
                            id="username"
                            name="username"
                            value={loginData.username}
                            onChange={handleLoginChange}
                            placeholder="tu@email.com o usuario"
                            required
                            autoFocus
                          />
                        </InputGroup>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label htmlFor="password">Contraseña</Form.Label>
                        <InputGroup>
                          <InputGroup.Text><i className="bi bi-lock"></i></InputGroup.Text>
                          <Form.Control
                            type={showPassword ? "text" : "password"}
                            id="password"
                            name="password"
                            value={loginData.password}
                            onChange={handleLoginChange}
                            required
                          />
                          <Button
                            variant="outline-secondary"
                            onClick={() => setShowPassword(!showPassword)}
                            type="button"
                          >
                            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                          </Button>
                        </InputGroup>
                      </Form.Group>

                      <div className="d-grid mb-3">
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Iniciando sesión...
                            </>
                          ) : (
                            'Iniciar Sesión'
                          )}
                        </Button>
                      </div>

                      <div className="text-center">
                        <Button
                          variant="link"
                          className="text-decoration-none"
                          onClick={toggleModo}
                        >
                          ¿No tienes cuenta? Regístrate aquí
                        </Button>
                      </div>
                    </Form>
                  )}

                  {/* FORMULARIO DE REGISTRO */}
                  {modo === 'register' && (
                    <Form onSubmit={handleRegisterSubmit}>
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
                              value={registerData.nombre}
                              onChange={handleRegisterChange}
                              isInvalid={!!validationErrors.nombre}
                              required
                              autoFocus
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
                              value={registerData.apellido}
                              onChange={handleRegisterChange}
                              isInvalid={!!validationErrors.apellido}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.apellido}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </Row>

                      <Row>
                        <Col md={6} className="mb-3">
                          <Form.Group>
                            <Form.Label htmlFor="telefono">
                              Teléfono <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              id="telefono"
                              name="telefono"
                              value={registerData.telefono}
                              onChange={handleRegisterChange}
                              placeholder="+56 9 1234 5678"
                              isInvalid={!!validationErrors.telefono}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.telefono}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col md={6} className="mb-3">
                          <Form.Group>
                            <Form.Label htmlFor="rut">
                              RUT <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              id="rut"
                              name="rut"
                              value={registerData.rut}
                              onChange={handleRegisterChange}
                              placeholder="12.345.678-9"
                              isInvalid={!!validationErrors.rut}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.rut}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </Row>

                      <Row>
                        <Col md={6} className="mb-3">
                          <Form.Group>
                            <Form.Label htmlFor="register-username">
                              Usuario <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              id="register-username"
                              name="username"
                              value={registerData.username}
                              onChange={handleRegisterChange}
                              isInvalid={!!validationErrors.username}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.username}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col md={6} className="mb-3">
                          <Form.Group>
                            <Form.Label htmlFor="register-email">
                              Email <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                              type="email"
                              id="register-email"
                              name="email"
                              value={registerData.email}
                              onChange={handleRegisterChange}
                              isInvalid={!!validationErrors.email}
                              required
                            />
                            <Form.Control.Feedback type="invalid">
                              {validationErrors.email}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </Row>

                      <Row>
                        <Col md={6} className="mb-3">
                          <Form.Group>
                            <Form.Label htmlFor="register-password">
                              Contraseña <span className="text-danger">*</span>
                            </Form.Label>
                            <InputGroup>
                              <InputGroup.Text><i className="bi bi-shield-lock"></i></InputGroup.Text>
                              <Form.Control
                                type={showPassword ? "text" : "password"}
                                id="register-password"
                                name="password"
                                value={registerData.password}
                                onChange={handleRegisterChange}
                                isInvalid={!!validationErrors.password}
                                required
                              />
                              <Button
                                variant="outline-secondary"
                                onClick={() => setShowPassword(!showPassword)}
                                type="button"
                              >
                                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                              </Button>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.password}
                              </Form.Control.Feedback>
                            </InputGroup>
                            <Form.Text className="text-muted">Mínimo 8 caracteres</Form.Text>
                          </Form.Group>
                        </Col>

                        <Col md={6} className="mb-3">
                          <Form.Group>
                            <Form.Label htmlFor="password_confirm">
                              Confirmar Contraseña <span className="text-danger">*</span>
                            </Form.Label>
                            <InputGroup>
                              <InputGroup.Text><i className="bi bi-lock-fill"></i></InputGroup.Text>
                              <Form.Control
                                type={showPasswordConfirm ? "text" : "password"}
                                id="password_confirm"
                                name="password_confirm"
                                value={registerData.password_confirm}
                                onChange={handleRegisterChange}
                                isInvalid={!!validationErrors.password_confirm}
                                required
                              />
                              <Button
                                variant="outline-secondary"
                                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                type="button"
                              >
                                <i className={`bi ${showPasswordConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                              </Button>
                              <Form.Control.Feedback type="invalid">
                                {validationErrors.password_confirm}
                              </Form.Control.Feedback>
                            </InputGroup>
                          </Form.Group>
                        </Col>
                      </Row>

                      <div className="d-grid mb-3">
                        <Button
                          type="submit"
                          variant="success"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Registrando...
                            </>
                          ) : (
                            'Crear Cuenta'
                          )}
                        </Button>
                      </div>

                      <div className="text-center">
                        <Button
                          variant="link"
                          className="text-decoration-none"
                          onClick={toggleModo}
                        >
                          ¿Ya tienes cuenta? Inicia sesión
                        </Button>
                      </div>
                    </Form>
                  )}

                  <div className="mt-3 text-center">
                    <small className="text-muted">
                      Sistema de Gestión de Reservas - Restaurante
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
}
