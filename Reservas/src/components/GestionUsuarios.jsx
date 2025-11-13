import { useState, useEffect } from 'react';
import { listarUsuarios, cambiarRolUsuario } from '../services/reservasApi';

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [nuevoRol, setNuevoRol] = useState('');

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const data = await listarUsuarios();
      setUsuarios(data);
      setError('');
    } catch (err) {
      setError('Error al cargar usuarios: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarRol = async (userId) => {
    if (!nuevoRol) {
      alert('Por favor seleccione un rol');
      return;
    }

    if (!confirm('¿Está seguro que desea cambiar el rol de este usuario?')) {
      return;
    }

    try {
      await cambiarRolUsuario({ userId, nuevoRol });
      await cargarUsuarios();
      setUsuarioEditando(null);
      setNuevoRol('');
      alert('Rol actualizado correctamente');
    } catch (err) {
      alert('Error al cambiar rol: ' + err.message);
    }
  };

  const getRolBadgeClass = (rol) => {
    const badges = {
      admin: 'bg-danger',
      cajero: 'bg-primary',
      mesero: 'bg-info',
      cliente: 'bg-secondary'
    };
    return badges[rol] || 'bg-secondary';
  };

  const getRolIcon = (rol) => {
    const iconos = {
      admin: 'bi-shield-fill-check',
      cajero: 'bi-cash-coin',
      mesero: 'bi-person-badge',
      cliente: 'bi-person'
    };
    return iconos[rol] || 'bi-person';
  };

  const usuariosFiltrados = filtroRol === 'TODOS'
    ? usuarios
    : usuarios.filter(u => u.rol === filtroRol.toLowerCase());

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Nunca';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Gestión de Usuarios</h2>
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={cargarUsuarios}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Estadísticas */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-danger">
            <div className="card-body text-center">
              <i className="bi bi-shield-fill-check fs-3 text-danger"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'admin').length}</h5>
              <small className="text-muted">Administradores</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-primary">
            <div className="card-body text-center">
              <i className="bi bi-cash-coin fs-3 text-primary"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'cajero').length}</h5>
              <small className="text-muted">Cajeros</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-info">
            <div className="card-body text-center">
              <i className="bi bi-person-badge fs-3 text-info"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'mesero').length}</h5>
              <small className="text-muted">Meseros</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-secondary">
            <div className="card-body text-center">
              <i className="bi bi-person fs-3 text-secondary"></i>
              <h5 className="mt-2">{usuarios.filter(u => u.rol === 'cliente').length}</h5>
              <small className="text-muted">Clientes</small>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4">
        <div className="btn-group" role="group">
          {['TODOS', 'ADMIN', 'CAJERO', 'MESERO', 'CLIENTE'].map(rol => (
            <button
              key={rol}
              type="button"
              className={`btn ${filtroRol === rol ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFiltroRol(rol)}
            >
              {rol}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Usuarios */}
      {usuariosFiltrados.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No hay usuarios {filtroRol !== 'TODOS' ? `con rol ${filtroRol.toLowerCase()}` : ''}.
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Nombre Completo</th>
                    <th>Rol</th>
                    <th>Fecha Registro</th>
                    <th>Último Login</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map(usuario => (
                    <tr key={usuario.id}>
                      <td>{usuario.id}</td>
                      <td>
                        <i className={`bi ${getRolIcon(usuario.rol)} me-2`}></i>
                        <strong>{usuario.username}</strong>
                      </td>
                      <td>{usuario.email}</td>
                      <td>{usuario.nombre_completo || <em className="text-muted">-</em>}</td>
                      <td>
                        <span className={`badge ${getRolBadgeClass(usuario.rol)}`}>
                          {usuario.rol_display}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatearFecha(usuario.fecha_registro)}
                        </small>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatearFecha(usuario.last_login)}
                        </small>
                      </td>
                      <td>
                        {usuarioEditando === usuario.id ? (
                          <div className="d-flex gap-2 align-items-center">
                            <select
                              className="form-select form-select-sm"
                              value={nuevoRol}
                              onChange={(e) => setNuevoRol(e.target.value)}
                              style={{ width: '120px' }}
                            >
                              <option value="">Seleccionar...</option>
                              <option value="admin">Administrador</option>
                              <option value="cajero">Cajero</option>
                              <option value="mesero">Mesero</option>
                              <option value="cliente">Cliente</option>
                            </select>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleCambiarRol(usuario.id)}
                            >
                              <i className="bi bi-check-lg"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setUsuarioEditando(null);
                                setNuevoRol('');
                              }}
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setUsuarioEditando(usuario.id);
                              setNuevoRol(usuario.rol);
                            }}
                          >
                            <i className="bi bi-pencil me-1"></i>
                            Cambiar Rol
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Información de Roles */}
      <div className="card mt-4">
        <div className="card-body">
          <h6 className="card-title">Información de Roles:</h6>
          <div className="row">
            <div className="col-md-3">
              <span className="badge bg-danger me-2">ADMINISTRADOR</span>
              <small className="text-muted d-block">Acceso completo al sistema</small>
            </div>
            <div className="col-md-3">
              <span className="badge bg-primary me-2">CAJERO</span>
              <small className="text-muted d-block">Gestiona reservas y visualiza estados</small>
            </div>
            <div className="col-md-3">
              <span className="badge bg-info me-2">MESERO</span>
              <small className="text-muted d-block">Consulta mesas y reservas</small>
            </div>
            <div className="col-md-3">
              <span className="badge bg-secondary me-2">CLIENTE</span>
              <small className="text-muted d-block">Crea y ve sus propias reservas</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
