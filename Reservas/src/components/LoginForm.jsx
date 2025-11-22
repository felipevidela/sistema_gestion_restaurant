import { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
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
    <Container>
      <Row className="justify-content-center align-items-center min-vh-100">
        <Col md={6} lg={5}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h3 className="fw-bold text-primary">Sistema de Reservas</h3>
                <p className="text-muted">
                  {modo === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
                </p>
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
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label htmlFor="password">Contraseña</Form.Label>
                    <div style={{ position: 'relative' }}>
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={loginData.password}
                        onChange={handleLoginChange}
                        required
                        style={{ paddingRight: '70px' }}
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '40px',
                          top: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#6c757d',
                          zIndex: 10
                        }}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        role="button"
                        tabIndex="-1"
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                            <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                            <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                          </svg>
                        )}
                      </span>
                    </div>
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
                        <div style={{ position: 'relative' }}>
                          <Form.Control
                            type={showPassword ? "text" : "password"}
                            id="register-password"
                            name="password"
                            value={registerData.password}
                            onChange={handleRegisterChange}
                            isInvalid={!!validationErrors.password}
                            required
                            style={{ paddingRight: '70px' }}
                          />
                          <span
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              position: 'absolute',
                              right: '40px',
                              top: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: '#6c757d',
                              zIndex: 10
                            }}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            role="button"
                            tabIndex="-1"
                          >
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                                <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                              </svg>
                            )}
                          </span>
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.password}
                          </Form.Control.Feedback>
                        </div>
                        <Form.Text className="text-muted">Mínimo 8 caracteres</Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={6} className="mb-3">
                      <Form.Group>
                        <Form.Label htmlFor="password_confirm">
                          Confirmar Contraseña <span className="text-danger">*</span>
                        </Form.Label>
                        <div style={{ position: 'relative' }}>
                          <Form.Control
                            type={showPasswordConfirm ? "text" : "password"}
                            id="password_confirm"
                            name="password_confirm"
                            value={registerData.password_confirm}
                            onChange={handleRegisterChange}
                            isInvalid={!!validationErrors.password_confirm}
                            required
                            style={{ paddingRight: '70px' }}
                          />
                          <span
                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                            style={{
                              position: 'absolute',
                              right: '40px',
                              top: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              color: '#6c757d',
                              zIndex: 10
                            }}
                            aria-label={showPasswordConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                            role="button"
                            tabIndex="-1"
                          >
                            {showPasswordConfirm ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                                <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                              </svg>
                            )}
                          </span>
                          <Form.Control.Feedback type="invalid">
                            {validationErrors.password_confirm}
                          </Form.Control.Feedback>
                        </div>
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
    </Container>
  );
}
