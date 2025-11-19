import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import PanelReservas from "./components/PanelReservas";
import LoginForm from "./components/LoginForm";
import FormularioReserva from "./components/FormularioReserva";
import MisReservas from "./components/MisReservas";
import MiPerfil from "./components/MiPerfil";
import GestionMesas from "./components/GestionMesas";
import GestionUsuarios from "./components/GestionUsuarios";
import ReservaPublica from "./components/ReservaPublica";
import AccesoReservaInvitado from "./components/AccesoReservaInvitado";
import ActivarCuenta from "./components/ActivarCuenta";
import { useAuth } from './contexts/AuthContext';

const getDefaultTab = (rol) => {
  if (rol === 'cliente') return 'mis-reservas';
  return 'reservas-dia';
};

function App() {
  const { user, isAuthenticated, isLoading, logout: authLogout, registerAndLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    isAuthenticated ? getDefaultTab(user?.rol) : 'reservas-dia'
  );
  const [hasInitializedTab, setHasInitializedTab] = useState(false);

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/reserva/:token', '/activar-cuenta/:token', '/reserva', '/login'];

  useEffect(() => {
    if (isAuthenticated && user?.rol && !hasInitializedTab) {
      setActiveTab(getDefaultTab(user.rol));
      setHasInitializedTab(true);
    }

    if (!isAuthenticated && hasInitializedTab) {
      setHasInitializedTab(false);
      setActiveTab('reservas-dia');
    }
  }, [isAuthenticated, user?.rol, hasInitializedTab]);

  const handleLoginSuccess = (userData) => {
    setShowLogin(false);
    setActiveTab(getDefaultTab(userData.rol));
  };

  const handleLogout = () => {
    authLogout();
    setShowLogin(false);
    setActiveTab('reservas-dia');
  };

  const handleReservaExitosa = (result) => {
    // La reserva pública ya hace auto-login
    registerAndLogin(result);
    setShowLogin(false);
    setActiveTab(getDefaultTab(result.rol));
  };

  // Configuración de tabs según rol
  const getTabs = () => {
    if (!user) return [];

    const tabs = {
      cliente: [
        { id: 'mis-reservas', label: 'Mis Reservas', icon: 'bi-list-ul' },
        { id: 'nueva-reserva', label: 'Nueva Reserva', icon: 'bi-plus-circle' },
        { id: 'mi-perfil', label: 'Mi Perfil', icon: 'bi-person-circle' }
      ],
      mesero: [
        { id: 'reservas-dia', label: 'Reservas del Día', icon: 'bi-calendar-day' },
        { id: 'gestion-mesas', label: 'Gestión de Mesas', icon: 'bi-grid-3x3' }
      ],
      cajero: [
        { id: 'reservas-dia', label: 'Reservas del Día', icon: 'bi-calendar-day' },
        { id: 'todas-reservas', label: 'Todas las Reservas', icon: 'bi-list-check' }
      ],
      admin: [
        { id: 'reservas-dia', label: 'Reservas del Día', icon: 'bi-calendar-day' },
        { id: 'gestion-usuarios', label: 'Gestión de Usuarios', icon: 'bi-people' },
        { id: 'gestion-mesas', label: 'Gestión de Mesas', icon: 'bi-grid-3x3' }
      ]
    };

    return tabs[user.rol] || [];
  };

  // Renderizar contenido según tab activo
  const renderTabContent = () => {
    switch (activeTab) {
      case 'mis-reservas':
        return <MisReservas />;
      case 'nueva-reserva':
        return <FormularioReserva onReservaCreada={() => setActiveTab('mis-reservas')} />;
      case 'mi-perfil':
        return <MiPerfil />;
      case 'reservas-dia':
        return <PanelReservas user={user} onLogout={handleLogout} />;
      case 'todas-reservas':
        return <PanelReservas user={user} onLogout={handleLogout} showAllReservations={true} />;
      case 'gestion-mesas':
        return <GestionMesas />;
      case 'gestion-usuarios':
        return <GestionUsuarios />;
      default:
        return <div className="alert alert-warning">Sección no encontrada</div>;
    }
  };

  // Mostrar spinner mientras se verifica la autenticación desde localStorage
  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-3 text-muted">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Renderizar rutas públicas de invitados (no requieren autenticación)
  const currentPath = location.pathname;
  if (currentPath.startsWith('/reserva/') || currentPath.startsWith('/activar-cuenta/')) {
    return (
      <Routes>
        <Route path="/reserva/:token" element={<AccesoReservaInvitado />} />
        <Route path="/activar-cuenta/:token" element={<ActivarCuenta />} />
      </Routes>
    );
  }

  // Vista pública (no logueado)
  if (!isAuthenticated) {
    // Mostrar LoginForm si el usuario hizo clic en "Login"
    if (showLogin) {
      return (
        <div className="bg-light min-vh-100">
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      );
    }

    // Mostrar ReservaPublica con botón Login en la esquina
    return (
      <div className="bg-light min-vh-100">
        {/* Header con botón de Login */}
        <nav className="navbar navbar-light bg-white shadow-sm">
          <div className="container-fluid">
            <span className="navbar-brand mb-0 h1">
              <i className="bi bi-calendar-check me-2 text-primary"></i>
              Sistema de Reservas
            </span>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setShowLogin(true)}
            >
              <i className="bi bi-box-arrow-in-right me-1"></i>
              Iniciar Sesión
            </button>
          </div>
        </nav>

        {/* Formulario de Reserva Pública */}
        <ReservaPublica onReservaExitosa={handleReservaExitosa} />
      </div>
    );
  }

  // Vista logueada (staff o cliente)
  const tabs = getTabs();

  return (
    <div className="bg-light min-vh-100">
      {/* Header */}
      <nav className="navbar navbar-dark bg-primary shadow-sm">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-calendar-check me-2"></i>
            Sistema de Reservas
          </span>
          <div className="d-flex align-items-center text-white">
            <div className="me-3">
              <i className="bi bi-person-circle me-2"></i>
              <strong>{user?.username}</strong>
              <span className="badge bg-light text-primary ms-2">
                {user?.rol_display}
              </span>
            </div>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Salir
            </button>
          </div>
        </div>
      </nav>

      {/* Tabs Navigation */}
      <div className="bg-white border-bottom">
        <div className="container-fluid">
          <ul className="nav nav-tabs border-0">
            {tabs.map(tab => (
              <li key={tab.id} className="nav-item">
                <button
                  className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '3px solid #0d6efd' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === tab.id ? '#0d6efd' : '#6c757d'
                  }}
                >
                  <i className={`bi ${tab.icon} me-2`}></i>
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container-fluid py-4">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default App;
