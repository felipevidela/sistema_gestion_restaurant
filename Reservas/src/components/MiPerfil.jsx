import { useState, useEffect } from 'react';
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
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
    try {
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
    setEditMode(false);
    setError('');
    setSuccess('');
    setValidationErrors({});
    cargarPerfil();
  };

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-person-circle me-2"></i>
                Mi Perfil
              </h5>
            </div>
            <div className="card-body p-4">
              {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                  <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
              )}

              {success && (
                <div className="alert alert-success alert-dismissible fade show" role="alert">
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                  <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
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
                      value={formData.nombre}
                      onChange={handleChange}
                      disabled={!editMode}
                      required
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
                      value={formData.apellido}
                      onChange={handleChange}
                      disabled={!editMode}
                      required
                    />
                    {validationErrors.apellido && (
                      <div className="invalid-feedback">{validationErrors.apellido}</div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    value={formData.email}
                    disabled
                  />
                  <small className="text-muted">El email no se puede modificar</small>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="telefono" className="form-label">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      className={`form-control ${validationErrors.telefono ? 'is-invalid' : ''}`}
                      id="telefono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="+56 9 1234 5678"
                      disabled={!editMode}
                    />
                    {validationErrors.telefono && (
                      <div className="invalid-feedback">{validationErrors.telefono}</div>
                    )}
                  </div>

                  <div className="col-md-6 mb-3">
                    <label htmlFor="rut" className="form-label">
                      RUT
                    </label>
                    <input
                      type="text"
                      className={`form-control ${validationErrors.rut ? 'is-invalid' : ''}`}
                      id="rut"
                      name="rut"
                      value={formData.rut}
                      onChange={handleChange}
                      placeholder="12.345.678-9"
                      disabled={!editMode}
                    />
                    {validationErrors.rut && (
                      <div className="invalid-feedback">{validationErrors.rut}</div>
                    )}
                  </div>
                </div>

                <div className="d-flex gap-2 mt-4">
                  {!editMode ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setEditMode(true)}
                    >
                      <i className="bi bi-pencil me-2"></i>
                      Editar Perfil
                    </button>
                  ) : (
                    <>
                      <button
                        type="submit"
                        className="btn btn-success"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check-circle me-2"></i>
                            Guardar Cambios
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCancelar}
                        disabled={loading}
                      >
                        <i className="bi bi-x-circle me-2"></i>
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </form>

              <div className="mt-4 pt-4 border-top">
                <h6 className="text-muted">Información de la cuenta</h6>
                <div className="row">
                  <div className="col-md-6">
                    <small className="text-muted d-block">Usuario:</small>
                    <strong>{user?.username}</strong>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted d-block">Rol:</small>
                    <span className="badge bg-primary">{user?.rol_display}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
