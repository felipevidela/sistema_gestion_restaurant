import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Navbar, Container, Nav, Tab, Tabs, Spinner, Alert, Badge, Button } from 'react-bootstrap';
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
        { id: 'todas-reservas', label: 'Todas las Reservas', icon: 'bi-list-check' },
        { id: 'nueva-reserva', label: 'Nueva Reserva', icon: 'bi-plus-circle' }
      ],
      admin: [
        { id: 'reservas-dia', label: 'Reservas del Día', icon: 'bi-calendar-day' },
        { id: 'nueva-reserva', label: 'Nueva Reserva', icon: 'bi-plus-circle' },
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
        // Al crear reserva, redirigir según el rol
        const onReservaCreada = () => {
          if (user?.rol === 'cliente') {
            setActiveTab('mis-reservas');
          } else {
            setActiveTab('reservas-dia');
          }
        };
        return <FormularioReserva onReservaCreada={onReservaCreada} />;
      case 'mi-perfil':
        return <MiPerfil />;
      case 'reservas-dia':
        return <PanelReservas user={user} onLogout={handleLogout} setActiveTab={setActiveTab} />;
      case 'todas-reservas':
        return <PanelReservas user={user} onLogout={handleLogout} showAllReservations={true} setActiveTab={setActiveTab} />;
      case 'gestion-mesas':
        return <GestionMesas />;
      case 'gestion-usuarios':
        return <GestionUsuarios />;
      default:
        return <Alert variant="warning">Sección no encontrada</Alert>;
    }
  };

  // Mostrar spinner mientras se verifica la autenticación desde localStorage
  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <Spinner animation="border" variant="primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
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
        <Navbar bg="white" className="shadow-sm">
          <Container fluid>
            <Navbar.Brand className="mb-0 h1">
              <i className="bi bi-calendar-check me-2 text-primary"></i>
              Sistema de Reservas
            </Navbar.Brand>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setShowLogin(true)}
            >
              <i className="bi bi-box-arrow-in-right me-1"></i>
              Iniciar Sesión
            </Button>
          </Container>
        </Navbar>

        {/* Formulario de Reserva Pública */}
        <ReservaPublica onReservaExitosa={handleReservaExitosa} />
      </div>
    );
  }

  // Vista logueada (staff o cliente)
  const tabs = getTabs();
  const todayLabel = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Panel';

  return (
    <div className="bg-light min-vh-100">
      {/* Header */}
      <Navbar bg="primary" variant="dark" className="shadow-sm app-navbar">
        <Container fluid>
          <Navbar.Brand className="mb-0 h1">
            <i className="bi bi-calendar-check me-2"></i>
            Sistema de Reservas
          </Navbar.Brand>
          <div className="d-flex align-items-center text-white">
            <div className="me-3">
              <i className="bi bi-person-circle me-2"></i>
              <strong>{user?.username}</strong>
              <Badge bg="light" text="primary" className="ms-2">
                {user?.rol_display}
              </Badge>
            </div>
            <Button
              variant="outline-light"
              size="sm"
              onClick={handleLogout}
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Salir
            </Button>
          </div>
        </Container>
      </Navbar>

      {/* Hero bar */}
      <div className="app-hero">
        <Container fluid>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            <div>
              <div className="text-white-50 small text-uppercase mb-1">Hoy</div>
              <h2 className="text-white fw-semibold mb-1">{todayLabel}</h2>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <Badge bg="light" text="primary" className="rounded-pill">
                  {user?.rol_display}
                </Badge>
                <span className="text-white-50 small">
                  Vista actual: <span className="text-white fw-semibold">{activeTabLabel}</span>
                </span>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <div className="app-hero__card">
                <div className="small text-white-50">Usuario</div>
                <div className="text-white fw-semibold">{user?.username}</div>
              </div>
              <div className="app-hero__card">
                <div className="small text-white-50">Pestañas habilitadas</div>
                <div className="text-white fw-semibold">{tabs.length}</div>
              </div>
              <div className="app-hero__card">
                <div className="small text-white-50">Sesión</div>
                <div className="text-white fw-semibold">Activa</div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-bottom">
        <Container fluid>
          <Nav variant="tabs" className="border-0" activeKey={activeTab}>
            {tabs.map(tab => (
              <Nav.Item key={tab.id}>
                <Nav.Link
                  eventKey={tab.id}
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
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        </Container>
      </div>

      {/* Tab Content */}
      <Container fluid className="py-4">
        {renderTabContent()}
      </Container>
    </div>
  );
}

export default App;
