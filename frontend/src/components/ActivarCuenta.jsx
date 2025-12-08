import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verificarTokenInvitado, activarCuentaInvitado } from '../services/reservasApi';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { validarPassword, validarPasswordConfirm } from '../utils/validaciones';

export default function ActivarCuenta() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [tokenValido, setTokenValido] = useState(false);
  const [email, setEmail] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    password: '',
    password_confirm: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  useEffect(() => {
    verificarToken();
  }, [token]);

  const verificarToken = async () => {
    try {
      setLoading(true);
      const data = await verificarTokenInvitado(token);

      if (!data.valido) {
        setError('Token inválido o expirado');
        setTokenValido(false);
        return;
      }

      if (!data.es_invitado || data.token_usado) {
        setError('Esta cuenta ya ha sido activada');
        setTokenValido(false);
        return;
      }

      setTokenValido(true);
      setEmail(data.email);
      setNombreCompleto(data.nombre_completo);
    } catch (err) {
      console.error('Error al verificar token:', err);
      setError(err.message || 'Error al verificar el token');
      setTokenValido(false);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Limpiar error del campo modificado
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validar password
    const passwordValidation = validarPassword(formData.password);
    if (!passwordValidation.valido) {
      newErrors.password = passwordValidation.mensaje;
    }

    // Validar confirmación
    const confirmValidation = validarPasswordConfirm(formData.password, formData.password_confirm);
    if (!confirmValidation.valido) {
      newErrors.password_confirm = confirmValidation.mensaje;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setVerificando(true);

      const result = await activarCuentaInvitado({
        token,
        password: formData.password,
        password_confirm: formData.password_confirm
      });

      toast.success('¡Cuenta activada exitosamente! Bienvenido 🎉');

      // Auto-login usando el token retornado
      if (result.token) {
        // Guardar token en localStorage
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify({
          id: result.user_id,
          username: result.username,
          email: result.email,
          rol: result.rol,
          rol_display: result.rol_display,
          nombre_completo: result.nombre_completo
        }));

        // Redirigir al dashboard después de 1 segundo
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      }
    } catch (err) {
      console.error('Error al activar cuenta:', err);
      toast.error(err.message || 'Error al activar la cuenta');
    } finally {
      setVerificando(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Verificando...</span>
            </div>
            <p className="mt-3">Verificando tu link de activación...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tokenValido) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card border-danger">
              <div className="card-body text-center py-5">
                <i className="bi bi-exclamation-triangle text-danger" style={{ fontSize: '3rem' }}></i>
                <h3 className="mt-3 text-danger">No se puede activar la cuenta</h3>
                <p className="text-muted">{error}</p>
                <div className="mt-4">
                  <button
                    className="btn btn-primary me-2"
                    onClick={() => navigate('/login')}
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Ir al Login
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/')}
                  >
                    <i className="bi bi-house me-2"></i>
                    Ir al inicio
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <i className="bi bi-person-check-fill text-primary" style={{ fontSize: '3rem' }}></i>
                <h2 className="fw-bold text-primary mt-2">Activar tu Cuenta</h2>
                <p className="text-muted">¡Último paso! Crea tu contraseña</p>
              </div>

              <div className="alert alert-info mb-4">
                <strong>Hola, {nombreCompleto}!</strong>
                <p className="mb-0 mt-2">
                  Estás a punto de activar tu cuenta para <strong>{email}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    Contraseña <span className="text-danger">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        cursor: 'pointer',
                        color: '#6c757d'
                      }}
                      role="button"
                      tabIndex="-1"
                    >
                      <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                    </span>
                  </div>
                  {errors.password && (
                    <div className="invalid-feedback d-block">{errors.password}</div>
                  )}
                  <small className="text-muted">
                    Mínimo 8 caracteres, incluye mayúscula, minúscula, número y carácter especial
                  </small>
                </div>

                <div className="mb-4">
                  <label htmlFor="password_confirm" className="form-label">
                    Confirmar Contraseña <span className="text-danger">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPasswordConfirm ? "text" : "password"}
                      className={`form-control ${errors.password_confirm ? 'is-invalid' : ''}`}
                      id="password_confirm"
                      name="password_confirm"
                      value={formData.password_confirm}
                      onChange={handleChange}
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <span
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        cursor: 'pointer',
                        color: '#6c757d'
                      }}
                      role="button"
                      tabIndex="-1"
                    >
                      <i className={`bi bi-eye${showPasswordConfirm ? '-slash' : ''}`}></i>
                    </span>
                  </div>
                  {errors.password_confirm && (
                    <div className="invalid-feedback d-block">{errors.password_confirm}</div>
                  )}
                </div>

                <div className="alert alert-success">
                  <strong>Con tu cuenta podrás:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Ver todas tus reservas en un solo lugar</li>
                    <li>Modificar o cancelar reservas fácilmente</li>
                    <li>Crear nuevas reservas más rápido</li>
                    <li>Recibir recordatorios de tus reservas</li>
                  </ul>
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={verificando}
                  >
                    {verificando ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Activando cuenta...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Activar mi cuenta
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/')}
                    disabled={verificando}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
