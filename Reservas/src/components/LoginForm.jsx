import { useState } from 'react';
import { login, register } from '../services/reservasApi';
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
      const userData = await login(loginData);
      console.log('Login exitoso:', userData);

      if (onLoginSuccess) {
        onLoginSuccess(userData);
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
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
    <div className="container">
      <div className="row justify-content-center align-items-center min-vh-100">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <h3 className="fw-bold text-primary">Sistema de Reservas</h3>
                <p className="text-muted">
                  {modo === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
                </p>
              </div>

              {/* Mensajes de error y éxito */}
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}

              {success && (
                <div className="alert alert-success" role="alert">
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                </div>
              )}

              {/* FORMULARIO DE LOGIN */}
              {modo === 'login' && (
                <form onSubmit={handleLoginSubmit}>
                  <div className="mb-3">
                    <label htmlFor="username" className="form-label">
                      Email o Usuario
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="username"
                      name="username"
                      value={loginData.username}
                      onChange={handleLoginChange}
                      placeholder="tu@email.com o usuario"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      Contraseña
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-control"
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
                  </div>

                  <div className="d-grid mb-3">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Iniciando sesión...
                        </>
                      ) : (
                        'Iniciar Sesión'
                      )}
                    </button>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      className="btn btn-link text-decoration-none"
                      onClick={toggleModo}
                    >
                      ¿No tienes cuenta? Regístrate aquí
                    </button>
                  </div>
                </form>
              )}

              {/* FORMULARIO DE REGISTRO */}
              {modo === 'register' && (
                <form onSubmit={handleRegisterSubmit}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="nombre" className="form-label">
                        Nombre <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control ${validationErrors.nombre ? 'is-invalid' : ''}`}
                        id="nombre"
                        name="nombre"
                        value={registerData.nombre}
                        onChange={handleRegisterChange}
                        required
                        autoFocus
                      />
                      {validationErrors.nombre && (
                        <div className="invalid-feedback">{validationErrors.nombre}</div>
                      )}
                    </div>

                    <div className="col-md-6 mb-3">
                      <label htmlFor="apellido" className="form-label">
                        Apellido <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control ${validationErrors.apellido ? 'is-invalid' : ''}`}
                        id="apellido"
                        name="apellido"
                        value={registerData.apellido}
                        onChange={handleRegisterChange}
                        required
                      />
                      {validationErrors.apellido && (
                        <div className="invalid-feedback">{validationErrors.apellido}</div>
                      )}
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="telefono" className="form-label">
                        Teléfono <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control ${validationErrors.telefono ? 'is-invalid' : ''}`}
                        id="telefono"
                        name="telefono"
                        value={registerData.telefono}
                        onChange={handleRegisterChange}
                        placeholder="+56 9 1234 5678"
                        required
                      />
                      {validationErrors.telefono && (
                        <div className="invalid-feedback">{validationErrors.telefono}</div>
                      )}
                    </div>

                    <div className="col-md-6 mb-3">
                      <label htmlFor="rut" className="form-label">
                        RUT <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control ${validationErrors.rut ? 'is-invalid' : ''}`}
                        id="rut"
                        name="rut"
                        value={registerData.rut}
                        onChange={handleRegisterChange}
                        placeholder="12.345.678-9"
                        required
                      />
                      {validationErrors.rut && (
                        <div className="invalid-feedback">{validationErrors.rut}</div>
                      )}
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="register-username" className="form-label">
                        Usuario <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-control ${validationErrors.username ? 'is-invalid' : ''}`}
                        id="register-username"
                        name="username"
                        value={registerData.username}
                        onChange={handleRegisterChange}
                        required
                      />
                      {validationErrors.username && (
                        <div className="invalid-feedback">{validationErrors.username}</div>
                      )}
                    </div>

                    <div className="col-md-6 mb-3">
                      <label htmlFor="register-email" className="form-label">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                        id="register-email"
                        name="email"
                        value={registerData.email}
                        onChange={handleRegisterChange}
                        required
                      />
                      {validationErrors.email && (
                        <div className="invalid-feedback">{validationErrors.email}</div>
                      )}
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="register-password" className="form-label">
                        Contraseña <span className="text-danger">*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          className={`form-control ${validationErrors.password ? 'is-invalid' : ''}`}
                          id="register-password"
                          name="password"
                          value={registerData.password}
                          onChange={handleRegisterChange}
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
                        {validationErrors.password && (
                          <div className="invalid-feedback">{validationErrors.password}</div>
                        )}
                      </div>
                      <small className="text-muted">Mínimo 8 caracteres</small>
                    </div>

                    <div className="col-md-6 mb-3">
                      <label htmlFor="password_confirm" className="form-label">
                        Confirmar Contraseña <span className="text-danger">*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPasswordConfirm ? "text" : "password"}
                          className={`form-control ${validationErrors.password_confirm ? 'is-invalid' : ''}`}
                          id="password_confirm"
                          name="password_confirm"
                          value={registerData.password_confirm}
                          onChange={handleRegisterChange}
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
                        {validationErrors.password_confirm && (
                          <div className="invalid-feedback">{validationErrors.password_confirm}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="d-grid mb-3">
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Registrando...
                        </>
                      ) : (
                        'Crear Cuenta'
                      )}
                    </button>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      className="btn btn-link text-decoration-none"
                      onClick={toggleModo}
                    >
                      ¿Ya tienes cuenta? Inicia sesión
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-3 text-center">
                <small className="text-muted">
                  Sistema de Gestión de Reservas - Restaurante
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
