import { useState, useEffect } from 'react';
import PanelReservas from "./components/PanelReservas";
import LoginForm from "./components/LoginForm";
import FormularioReserva from "./components/FormularioReserva";
import MisReservas from "./components/MisReservas";
import GestionMesas from "./components/GestionMesas";
import GestionUsuarios from "./components/GestionUsuarios";
import { getCurrentUser, isAuthenticated, logout } from './services/reservasApi';

function App() {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('reservas-dia');

  // Verificar si hay una sesión activa al cargar
  useEffect(() => {
    if (isAuthenticated()) {
      const currentUser = getCurrentUser();
      setUser(currentUser);
      setIsLoggedIn(true);
      // Establecer tab inicial según el rol
      setActiveTab(getDefaultTab(currentUser.rol));
    }
  }, []);

  const getDefaultTab = (rol) => {
    if (rol === 'cliente') return 'mis-reservas';
    return 'reservas-dia';
  };

  const handleLoginSuccess = (userData) => {
    const newUser = {
      id: userData.user_id,
      username: userData.username,
      email: userData.email,
      rol: userData.rol,
      rol_display: userData.rol_display,
      nombre_completo: userData.nombre_completo
    };
    setUser(newUser);
    setIsLoggedIn(true);
    setActiveTab(getDefaultTab(userData.rol));
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setIsLoggedIn(false);
    setActiveTab('reservas-dia');
  };

  // Configuración de tabs según rol
  const getTabs = () => {
    if (!user) return [];

    const tabs = {
      cliente: [
        { id: 'mis-reservas', label: 'Mis Reservas', icon: 'bi-list-ul' },
        { id: 'nueva-reserva', label: 'Nueva Reserva', icon: 'bi-plus-circle' }
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

  if (!isLoggedIn) {
    return (
      <div className="bg-light min-vh-100">
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

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
