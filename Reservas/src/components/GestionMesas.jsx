import { useState, useEffect } from 'react';
import { Tabs, Tab, Badge } from 'react-bootstrap';
import { getMesas, updateEstadoMesa, getReservas, listarBloqueos } from '../services/reservasApi';
import { handleError } from '../utils/errorHandler';
import Modal from './ui/Modal';
import ListaBloqueosActivos from './ListaBloqueosActivos';

export default function GestionMesas() {
  const [activeTab, setActiveTab] = useState('gestion');
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [mesaEditando, setMesaEditando] = useState(null);
  const [success, setSuccess] = useState('');

  // Nuevos estados para filtro de fecha
  const [fechaFiltro, setFechaFiltro] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaFiltro, setHoraFiltro] = useState('');
  const [reservasPorFecha, setReservasPorFecha] = useState([]);
  const [bloqueosPorFecha, setBloqueosPorFecha] = useState([]);
  const [bloqueosHoy, setBloqueosHoy] = useState([]); // Bloqueos activos HOY (fecha/hora actual)
  const [mostrarDisponibilidad, setMostrarDisponibilidad] = useState(true);

  // Estado para modal de detalle de reserva
  const [detalleModal, setDetalleModal] = useState({ isOpen: false, reserva: null });

  useEffect(() => {
    cargarMesas();
    // Auto-actualizar cada 30 segundos
    const interval = setInterval(cargarMesas, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cargar reservas y bloqueos cuando cambia la fecha
  useEffect(() => {
    if (mostrarDisponibilidad) {
      cargarReservasPorFecha();
      cargarBloqueosPorFecha();
    }
  }, [fechaFiltro, mostrarDisponibilidad]);

  // Cargar bloqueos activos HOY y actualizar cada 30 segundos
  useEffect(() => {
    cargarBloqueosHoy();
    const interval = setInterval(cargarBloqueosHoy, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  const cargarMesas = async () => {
    try {
      setLoading(true);
      const data = await getMesas({ fecha: mostrarDisponibilidad ? fechaFiltro : undefined, hora: mostrarDisponibilidad ? horaFiltro : undefined });
      setMesas(data);
      setError('');
    } catch (err) {
      setError('Error al cargar mesas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cargarReservasPorFecha = async () => {
    try {
      const reservas = await getReservas({ fecha: fechaFiltro });
      const filtradasPorHora = horaFiltro
        ? reservas.filter(r => r.hora && r.hora.startsWith(horaFiltro))
        : reservas;
      setReservasPorFecha(filtradasPorHora);
    } catch (err) {
      console.error('Error al cargar reservas:', err);
      setReservasPorFecha([]);
    }
  };

  const cargarBloqueosPorFecha = async () => {
    try {
      const bloqueos = await listarBloqueos({ activos_en_fecha: fechaFiltro });
      setBloqueosPorFecha(Array.isArray(bloqueos) ? bloqueos : []);
    } catch (err) {
      console.error('Error al cargar bloqueos:', err);
      setBloqueosPorFecha([]);
    }
  };

  const cargarBloqueosHoy = async () => {
    try {
      const fechaHoy = new Date().toISOString().slice(0, 10);
      const bloqueos = await listarBloqueos({ activos_en_fecha: fechaHoy, solo_activos: true });
      setBloqueosHoy(Array.isArray(bloqueos) ? bloqueos : []);
    } catch (err) {
      console.error('Error al cargar bloqueos activos hoy:', err);
      setBloqueosHoy([]);
    }
  };

  const handleCambiarEstado = async (mesaId, nuevoEstado) => {
    // FIX #34 (MENOR): Transacciones atómicas en frontend
    // Guardar estado anterior en caso de fallo
    const estadoAnteriorMesas = [...mesas];
    const mesaAnterior = mesas.find(m => m.id === mesaId);

    // Si hay reservas en la fecha/hora seleccionada, advertir antes de liberar/ocupar
    if (mostrarDisponibilidad && (nuevoEstado === 'disponible' || nuevoEstado === 'ocupada')) {
      const reservasMesa = getReservasMesa(mesaAnterior?.numero || mesaId);
      if (reservasMesa.length > 0) {
        const hayChoqueHora = horaFiltro
          ? reservasMesa.some(r => r.hora && r.hora.startsWith(horaFiltro))
          : true;
        if (hayChoqueHora) {
          const continuar = window.confirm(
            `Esta mesa tiene reservas para ${fechaFiltro}${horaFiltro ? ` a las ${horaFiltro}` : ''}. ¿Seguro desea marcarla como ${nuevoEstado}?`
          );
          if (!continuar) return;
        }
      }
    }

    try {
      // Paso 1: Actualizar estado en el backend (operación crítica)
      await updateEstadoMesa({ id: mesaId, nuevoEstado });

      // Paso 2: Solo si el paso 1 fue exitoso, recargar mesas
      try {
        await cargarMesas();
      } catch (reloadErr) {
        // Si falla la recarga, restaurar estado anterior visualmente
        console.error('Error al recargar mesas, restaurando vista anterior:', reloadErr);
        setMesas(estadoAnteriorMesas);
        // Mostrar warning pero considerar la operación exitosa
        setSuccess('Estado actualizado, pero hubo un error al recargar. Actualice la página manualmente.');
        setTimeout(() => setSuccess(''), 5000);
      }

      // Paso 3: Solo si todo fue exitoso, limpiar UI
      setMesaEditando(null);

      // FIX #26 (MODERADO): Manejo de errores consistente - usar setSuccess en lugar de alert
      if (!success) { // Solo mostrar si no se mostró el warning anterior
        setSuccess('Estado de la mesa actualizado correctamente');
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      // Si falla la actualización principal, restaurar estado visual anterior
      setMesas(estadoAnteriorMesas);
      // FIX #26 (MODERADO): Manejo de errores consistente
      await handleError(err, 'actualizar estado de la mesa', setError);
    }
  };

  const getEstadoColor = (estado) => {
    const colores = {
      disponible: 'success',
      reservada: 'warning',
      ocupada: 'danger',
      limpieza: 'info'
    };
    return colores[estado] || 'secondary';
  };

  const getEstadoIcon = (estado) => {
    const iconos = {
      disponible: 'bi-check-circle',
      reservada: 'bi-clock',
      ocupada: 'bi-people-fill',
      limpieza: 'bi-droplet'
    };
    return iconos[estado] || 'bi-question-circle';
  };

  // Función para obtener reservas de una mesa en la fecha seleccionada
  const getReservasMesa = (numeroMesa) => {
    if (!mostrarDisponibilidad) return [];
    const mesaFormatted = `M${String(numeroMesa).padStart(2, '0')}`;
    return reservasPorFecha.filter(r => r.mesa === mesaFormatted);
  };

  // Función para verificar si una mesa tiene reservas en la fecha
  const tieneReservas = (numeroMesa) => {
    return getReservasMesa(numeroMesa).length > 0;
  };

  // Función para obtener bloqueos de una mesa en la fecha seleccionada
  const getBloqueosMesa = (numeroMesa) => {
    if (!mostrarDisponibilidad) return [];
    return bloqueosPorFecha.filter(b => b.mesa_numero === numeroMesa);
  };

  // Función para verificar si una mesa tiene bloqueos en la fecha
  const tieneBloqueos = (numeroMesa) => {
    return getBloqueosMesa(numeroMesa).length > 0;
  };

  // Función para verificar si una mesa está bloqueada en una hora específica
  const estaBloqueadaEnHora = (numeroMesa, hora) => {
    const bloqueos = getBloqueosMesa(numeroMesa);
    if (!hora || bloqueos.length === 0) return bloqueos.length > 0;

    return bloqueos.some(bloqueo => {
      // Si el bloqueo es de día completo, está bloqueada
      if (!bloqueo.hora_inicio || !bloqueo.hora_fin) return true;

      // Verificar si la hora está dentro del rango del bloqueo
      return hora >= bloqueo.hora_inicio.substring(0, 5) && hora <= bloqueo.hora_fin.substring(0, 5);
    });
  };

  // Función para verificar si una mesa está bloqueada (en la fecha/hora que se está visualizando)
  const estaBloqueada = (numeroMesa) => {
    // Si el modo de disponibilidad está activo, usar la fecha/hora filtrada
    if (mostrarDisponibilidad) {
      // Usar la función existente que ya verifica bloqueos en la fecha filtrada
      if (horaFiltro) {
        return estaBloqueadaEnHora(numeroMesa, horaFiltro);
      } else {
        return tieneBloqueos(numeroMesa);
      }
    }

    // Si no hay filtro de disponibilidad, verificar con fecha/hora actual del sistema
    const ahora = new Date();
    const fechaActual = ahora.toISOString().slice(0, 10);
    const horaActual = ahora.toTimeString().slice(0, 5);

    return bloqueosHoy.some(bloqueo => {
      // Verificar que el bloqueo esté activo
      if (!bloqueo.activo) return false;

      // Verificar que sea de esta mesa
      if (bloqueo.mesa_numero !== numeroMesa) return false;

      // Verificar que la fecha actual esté dentro del rango
      if (bloqueo.fecha_inicio > fechaActual || bloqueo.fecha_fin < fechaActual) {
        return false;
      }

      // Si es bloqueo de día completo, está bloqueada
      if (!bloqueo.hora_inicio || !bloqueo.hora_fin) return true;

      // Verificar que la hora actual esté dentro del rango
      const horaInicio = bloqueo.hora_inicio.substring(0, 5);
      const horaFin = bloqueo.hora_fin.substring(0, 5);
      return horaActual >= horaInicio && horaActual <= horaFin;
    });
  };

  // Función para obtener color de estado con prioridad de bloqueo
  const getEstadoColorConBloqueo = (mesa) => {
    // Prioridad 1: Si está bloqueada (en la fecha/hora visualizada), color de bloqueo
    if (estaBloqueada(mesa.numero)) {
      return 'danger'; // Rojo para indicar bloqueo activo
    }

    // Prioridad 2: Color del estado normal
    return getEstadoColor(mesa.estado);
  };

  // Función para obtener icono de estado con prioridad de bloqueo
  const getEstadoIconConBloqueo = (mesa) => {
    // Prioridad 1: Si está bloqueada (en la fecha/hora visualizada), icono de candado
    if (estaBloqueada(mesa.numero)) {
      return 'bi-lock-fill';
    }

    // Prioridad 2: Icono del estado normal
    return getEstadoIcon(mesa.estado);
  };

  // Función para formatear hora a formato militar 24 horas (HH:MM)
  const formatearHora = (hora) => {
    if (!hora) return '';
    return hora.substring(0, 5);
  };

  // Función para formatear fecha corta
  const formatearFechaCorta = (fechaStr) => {
    if (!fechaStr) return '';
    return new Date(`${fechaStr}T00:00:00`).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handler para abrir modal de detalle de reserva
  const handleVerDetalleReserva = (reserva) => {
    setDetalleModal({ isOpen: true, reserva });
  };

  const mesasFiltradas = filtroEstado === 'TODOS'
    ? mesas
    : mesas.filter(m => m.estado === filtroEstado.toLowerCase());

  if (loading && mesas.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando mesas...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <p className="text-muted text-uppercase small mb-1">Piso y disponibilidad</p>
          <h2 className="mb-0">Gestión de Mesas</h2>
          <small className="text-muted">Controla estados, bloqueos y reservas activas en un panel.</small>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Badge bg="success" className="rounded-pill text-uppercase">Activas</Badge>
          <Badge bg="danger" className="rounded-pill text-uppercase">Bloqueos</Badge>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4 modern-tabs"
      >
        <Tab eventKey="gestion" title={<><i className="bi bi-grid-3x3 me-2"></i>Gestión de Mesas</>}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
            <div className="d-flex flex-wrap gap-2">
              <div className="badge bg-light text-dark border">
                <i className="bi bi-calendar-check me-1"></i>
                {new Date(fechaFiltro + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              {horaFiltro && (
                <div className="badge bg-info text-white">
                  <i className="bi bi-clock me-1"></i>
                  {horaFiltro}
                </div>
              )}
            </div>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={cargarMesas}
              disabled={loading}
              aria-label="Actualizar mesas"
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Actualizando...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Actualizar
                </>
              )}
            </button>
          </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      {/* Filtros */}
      <div className="card border-0 shadow-sm mb-4 glass-panel">
        <div className="card-body">
          <div className="row g-3">
            {/* Filtro de Estado */}
            <div className="col-12">
              <label className="form-label small fw-bold">Filtrar por Estado Actual:</label>
              <div className="d-flex flex-wrap gap-2">
                {['TODOS','DISPONIBLE','RESERVADA','OCUPADA','LIMPIEZA'].map(estado => {
                  const tones = {
                    TODOS: 'secondary',
                    DISPONIBLE: 'success',
                    RESERVADA: 'warning',
                    OCUPADA: 'danger',
                    LIMPIEZA: 'info'
                  };
                  return (
                    <button
                      key={estado}
                      type="button"
                      className={`filter-chip ${filtroEstado === estado ? 'filter-chip--active' : ''}`}
                      onClick={() => setFiltroEstado(estado)}
                      aria-label={`Filtrar ${estado.toLowerCase()}`}
                    >
                      <i className={`bi ${
                        estado === 'DISPONIBLE' ? 'bi-check-circle' :
                        estado === 'RESERVADA' ? 'bi-clock' :
                        estado === 'OCUPADA' ? 'bi-people-fill' :
                        estado === 'LIMPIEZA' ? 'bi-droplet' : 'bi-ui-checks'
                      } me-1 text-${tones[estado]}`}></i>
                      {estado}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle para mostrar disponibilidad */}
            <div className="col-12 border-top pt-3">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="toggleDisponibilidad"
                    checked={mostrarDisponibilidad}
                    onChange={(e) => setMostrarDisponibilidad(e.target.checked)}
                  />
                  <label className="form-check-label fw-bold" htmlFor="toggleDisponibilidad">
                    <i className="bi bi-calendar3 me-2"></i>
                    Ver disponibilidad por fecha/hora
                  </label>
                </div>
                {mostrarDisponibilidad && (
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="badge rounded-pill bg-light text-dark">
                      <i className="bi bi-calendar-check me-1"></i>
                      {new Date(fechaFiltro + 'T00:00:00').toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                    {horaFiltro && (
                      <span className="badge rounded-pill bg-info text-white">
                        <i className="bi bi-clock me-1"></i>
                        {horaFiltro}
                      </span>
                    )}
                    <button
                      className="btn btn-link btn-sm text-decoration-none"
                      onClick={() => {
                        setHoraFiltro('');
                        setFechaFiltro(new Date().toISOString().slice(0, 10));
                      }}
                    >
                      Limpiar filtros de tiempo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Filtro de Fecha y Hora */}
            {mostrarDisponibilidad && (
              <>
                <div className="col-md-6">
                  <label htmlFor="fechaFiltro" className="form-label small">
                    Fecha a consultar:
                  </label>
                  <input
                    type="date"
                    id="fechaFiltro"
                    className="form-control"
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label htmlFor="horaFiltro" className="form-label small">
                    Hora (opcional):
                  </label>
                  <input
                    type="time"
                    id="horaFiltro"
                    className="form-control"
                    value={horaFiltro}
                    onChange={(e) => setHoraFiltro(e.target.value)}
                  />
                  <small className="text-muted">
                    Filtra reservas y disponibilidad en una hora específica
                  </small>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="row mb-4 g-3">
        {[
          { label: 'Disponibles', color: 'success', value: mesas.filter(m => m.estado === 'disponible').length, icon: 'bi-check-circle' },
          { label: 'Reservadas', color: 'warning', value: mesas.filter(m => m.estado === 'reservada').length, icon: 'bi-clock-history' },
          { label: 'Ocupadas', color: 'danger', value: mesas.filter(m => m.estado === 'ocupada').length, icon: 'bi-people-fill' },
          { label: 'Limpieza', color: 'info', value: mesas.filter(m => m.estado === 'limpieza').length, icon: 'bi-droplet' }
        ].map(card => (
          <div className="col-6 col-md-3" key={card.label}>
            <div className="card border-0 shadow-sm resumen-card">
              <div className="card-body d-flex align-items-center gap-3">
                <div className={`resumen-card__icon text-${card.color}`}>
                  <i className={`bi ${card.icon}`}></i>
                </div>
                <div>
                  <span className="text-muted small d-block">{card.label}</span>
                  <span className={`h4 mb-0 fw-bold text-${card.color}`}>{card.value}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {mostrarDisponibilidad && bloqueosPorFecha.length > 0 && (
          <div className="col-12 col-md-6">
            <div className="card border-danger bg-danger bg-opacity-10 shadow-sm h-100">
              <div className="card-body d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <div className="resumen-card__icon text-danger">
                    <i className="bi bi-lock-fill"></i>
                  </div>
                  <div>
                    <span className="text-danger small d-block">Bloqueos en fecha</span>
                    <span className="h5 mb-0 text-danger fw-bold">{bloqueosPorFecha.length} mesa(s)</span>
                  </div>
                </div>
                <div className="text-end">
                  <small className="text-danger">
                    {new Date(fechaFiltro + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </small>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Mesas */}
      {mesasFiltradas.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No hay mesas {filtroEstado !== 'TODOS' ? `en estado ${filtroEstado.toLowerCase()}` : ''}.
        </div>
      ) : (
        <div className="row g-3">
          {mesasFiltradas.map(mesa => (
            <div key={mesa.id} className="col-md-6 col-lg-4 col-xl-3">
              <div className={`card h-100 shadow-sm mesa-card mesa-card--${getEstadoColorConBloqueo(mesa)}`}>
                <div className="card-body p-3 d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="small text-muted">Mesa</div>
                      <h5 className="mb-0">#{mesa.numero}</h5>
                    </div>
                    <span className={`badge bg-${getEstadoColorConBloqueo(mesa)}`}>
                      {estaBloqueada(mesa.numero) ? 'BLOQUEADA' : mesa.estado.toUpperCase()}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="mesa-icon"><i className="bi bi-people"></i></span>
                    <div>
                      <small className="text-muted d-block">Capacidad</small>
                      <strong>{mesa.capacidad} personas</strong>
                    </div>
                  </div>
                  {mostrarDisponibilidad && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="mesa-icon mesa-icon--calendar"><i className="bi bi-calendar3"></i></span>
                      <div>
                        <small className="text-muted d-block">Fecha</small>
                        <strong>{new Date(fechaFiltro + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</strong>
                        {horaFiltro && <div className="text-muted small">{horaFiltro}</div>}
                      </div>
                    </div>
                  )}

                  {/* Mostrar bloqueos si está activo el modo de disponibilidad */}
                  {mostrarDisponibilidad && (() => {
                    const bloqueos = getBloqueosMesa(mesa.numero);
                    const bloqueadaEnHora = horaFiltro ? estaBloqueadaEnHora(mesa.numero, horaFiltro) : bloqueos.length > 0;

                    return bloqueos.length > 0 && bloqueadaEnHora ? (
                      <div className="mb-3 border-top pt-2">
                        <div className="alert alert-danger py-2 mb-2 small">
                          <i className="bi bi-lock-fill me-2"></i>
                          <strong>Mesa Bloqueada</strong>
                        </div>
                        <div className="list-group list-group-flush small">
                          {bloqueos.map((bloqueo, idx) => (
                            <div
                              key={idx}
                              className="list-group-item px-0 py-2 border-0 bg-light"
                            >
                              <div className="d-flex align-items-start justify-content-between">
                                <div>
                                  <i className="bi bi-calendar-x text-danger me-1"></i>
                                  <strong className="text-danger">
                                    {bloqueo.hora_inicio && bloqueo.hora_fin
                                      ? `${formatearHora(bloqueo.hora_inicio)} - ${formatearHora(bloqueo.hora_fin)}`
                                      : 'Día completo'
                                    }
                                  </strong>
                                  <div className="text-muted mt-1" style={{ fontSize: '0.85em' }}>
                                    <i className="bi bi-info-circle me-1"></i>
                                    {bloqueo.motivo}
                                  </div>
                                  {bloqueo.fecha_inicio !== bloqueo.fecha_fin && (
                                    <div className="text-muted mt-1" style={{ fontSize: '0.8em' }}>
                                      <i className="bi bi-calendar-range me-1"></i>
                                      Hasta {new Date(bloqueo.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                    </div>
                                  )}
                                </div>
                                <span className={`badge bg-danger`}>
                                  {bloqueo.categoria_display}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Mostrar reservas si está activo el modo de disponibilidad */}
                  {mostrarDisponibilidad && (
                    <div className="mb-3">
                      {(() => {
                        const reservas = getReservasMesa(mesa.numero);
                        const hayReservaEnHora = horaFiltro
                          ? reservas.some(r => r.hora && r.hora.startsWith(horaFiltro))
                          : reservas.length > 0;
                        return reservas.length > 0 ? (
                          <div className="mesa-reservas">
                            <div className="d-flex align-items-center justify-content-between">
                              <div className="d-flex align-items-center gap-2">
                                <span className="mesa-icon mesa-icon--warning"><i className="bi bi-calendar-event"></i></span>
                                <div>
                                  <small className="text-muted d-block">Reservas</small>
                                  <strong>{reservas.length} reserva(s)</strong>
                                </div>
                              </div>
                              <span className="badge bg-light text-muted border">{horaFiltro || 'Todo el día'}</span>
                            </div>
                            <div className="list-group list-group-flush small mt-2">
                              {reservas.map((reserva, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="list-group-item list-group-item-action px-0 py-1 border-0"
                                  onClick={() => handleVerDetalleReserva(reserva)}
                                  title="Ver detalle de reserva"
                                >
                                  <i className="bi bi-clock text-muted me-1"></i>
                                  <strong>{reserva.hora}</strong> - {reserva.personas} pers.
                                  <span className={`badge ms-1 bg-${
                                    reserva.estado === 'ACTIVA' ? 'success' :
                                    reserva.estado === 'PENDIENTE' ? 'warning' :
                                    reserva.estado === 'COMPLETADA' ? 'info' : 'secondary'
                                  }`}>{reserva.estado}</span>
                                  <i className="bi bi-eye ms-2 text-primary small"></i>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className={`alert ${hayReservaEnHora ? 'alert-warning' : 'alert-success'} py-2 mb-0 small`}>
                            <i className="bi bi-check-circle me-1"></i>
                            {hayReservaEnHora ? 'Reservas fuera de la hora seleccionada' : 'Sin reservas para esta fecha'}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {mesaEditando === mesa.id ? (
                    <div>
                      {estaBloqueada(mesa.numero) ? (
                        <div className="alert alert-danger py-2 mb-2 small">
                          <i className="bi bi-lock-fill me-2"></i>
                          <strong>Mesa bloqueada.</strong> No se puede cambiar el estado mientras esté activo el bloqueo.
                        </div>
                      ) : (
                        <>
                          <p className="mb-2"><strong>Cambiar estado a:</strong></p>
                          <div className="d-grid gap-2">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleCambiarEstado(mesa.id, 'disponible')}
                              disabled={mesa.estado === 'disponible'}
                            >
                              Disponible
                            </button>
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => handleCambiarEstado(mesa.id, 'reservada')}
                              disabled={mesa.estado === 'reservada'}
                            >
                              Reservada
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleCambiarEstado(mesa.id, 'ocupada')}
                              disabled={mesa.estado === 'ocupada'}
                            >
                              Ocupada
                            </button>
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => handleCambiarEstado(mesa.id, 'limpieza')}
                              disabled={mesa.estado === 'limpieza'}
                            >
                              En Limpieza
                            </button>
                          </div>
                        </>
                      )}
                      <div className="d-grid mt-2">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setMesaEditando(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="d-grid mt-auto">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setMesaEditando(mesa.id)}
                        disabled={estaBloqueada(mesa.numero)}
                      >
                        <i className="bi bi-pencil me-1"></i>
                        Cambiar Estado
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

          {/* Leyenda de Estados */}
          <div className="card mt-4">
            <div className="card-body">
              <h6 className="card-title">Leyenda de Estados:</h6>
              <div className="row">
                <div className="col-md-3">
                  <span className="badge bg-success me-2">DISPONIBLE</span>
                  <small className="text-muted">Mesa lista para uso</small>
                </div>
                <div className="col-md-3">
                  <span className="badge bg-warning me-2">RESERVADA</span>
                  <small className="text-muted">Mesa con reserva confirmada</small>
                </div>
                <div className="col-md-3">
                  <span className="badge bg-danger me-2">OCUPADA</span>
                  <small className="text-muted">Mesa ocupada actualmente</small>
                </div>
                <div className="col-md-3">
                  <span className="badge bg-info me-2">EN LIMPIEZA</span>
                  <small className="text-muted">Mesa siendo limpiada</small>
                </div>
              </div>
            </div>
          </div>
        </Tab>

        <Tab eventKey="bloqueos" title={<><i className="bi bi-lock me-2"></i>Bloqueos de Mesas</>}>
          <ListaBloqueosActivos />
        </Tab>
      </Tabs>

      {detalleModal.reserva && (
        <Modal
          isOpen={detalleModal.isOpen}
          onClose={() => setDetalleModal({ isOpen: false, reserva: null })}
          title={null}
          size="xl"
        >
          <div className="reserva-detalle-content">
            {/* Hero con degradado */}
            <div className="modal-hero-gradient">
              <h3 className="mb-0">{detalleModal.reserva.cliente}</h3>
              <div className="hero-badges">
                <span className="hero-badge">
                  <i className="bi bi-table"></i>
                  Mesa {detalleModal.reserva.mesa}
                </span>
                <span className="hero-badge">
                  <i className="bi bi-calendar3"></i>
                  {new Date(detalleModal.reserva.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
                <span className="hero-badge">
                  <i className="bi bi-clock"></i>
                  {formatearHora(detalleModal.reserva.hora)} hrs
                </span>
                <span className="hero-badge">
                  <i className="bi bi-people-fill"></i>
                  {detalleModal.reserva.personas} {detalleModal.reserva.personas === 1 ? 'persona' : 'personas'}
                </span>
              </div>
            </div>

            {/* Timeline de estados */}
            <div className="timeline-container">
              <div className={`timeline-step ${['ACTIVA', 'COMPLETADA', 'CANCELADA'].includes(detalleModal.reserva.estado) ? 'completed' : ''}`}>
                <div className="timeline-step-icon">
                  <i className="bi bi-plus-circle-fill"></i>
                </div>
                <span className="timeline-step-label">Creada</span>
              </div>

              <div className={`timeline-step ${['ACTIVA', 'COMPLETADA'].includes(detalleModal.reserva.estado) ? 'completed' : detalleModal.reserva.estado === 'PENDIENTE' ? 'current' : ''}`}>
                <div className="timeline-step-icon">
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <span className="timeline-step-label">Confirmada</span>
              </div>

              <div className={`timeline-step ${
                detalleModal.reserva.estado === 'ACTIVA' ? 'current' :
                detalleModal.reserva.estado === 'COMPLETADA' ? 'completed' :
                detalleModal.reserva.estado === 'CANCELADA' ? 'current' : ''
              }`}>
                <div className="timeline-step-icon">
                  <i className={`bi ${
                    detalleModal.reserva.estado === 'COMPLETADA' ? 'bi-star-fill' :
                    detalleModal.reserva.estado === 'CANCELADA' ? 'bi-x-circle-fill' :
                    'bi-lightning-charge-fill'
                  }`}></i>
                </div>
                <span className="timeline-step-label">
                  {detalleModal.reserva.estado === 'CANCELADA' ? 'Cancelada' :
                   detalleModal.reserva.estado === 'COMPLETADA' ? 'Completada' : 'Activa'}
                </span>
              </div>
            </div>

            {/* Información de contacto */}
            <div className="card compact-card mb-3">
              <div className="card-body">
                <div className="section-title mb-3">
                  <div className="d-flex align-items-center gap-2 flex-grow-1">
                    <span className="icon-circle bg-primary-subtle text-primary">
                      <i className="bi bi-person-badge-fill"></i>
                    </span>
                    <div>
                      <p className="card-kicker text-uppercase mb-1">Contacto</p>
                      <h6 className="mb-0">Información del Cliente</h6>
                    </div>
                  </div>

                  {/* Botones de contacto inline */}
                  {(detalleModal.reserva.cliente_telefono || detalleModal.reserva.cliente_email) && (
                    <div className="d-flex gap-2">
                      {detalleModal.reserva.cliente_telefono && (
                        <a
                          href={`tel:${detalleModal.reserva.cliente_telefono}`}
                          className="btn btn-outline-success btn-sm"
                          title="Llamar"
                        >
                          <i className="bi bi-telephone-fill"></i>
                          <span className="d-none d-lg-inline ms-1">Llamar</span>
                        </a>
                      )}
                      {detalleModal.reserva.cliente_email && (
                        <a
                          href={`mailto:${detalleModal.reserva.cliente_email}`}
                          className="btn btn-outline-primary btn-sm"
                          title="Enviar email"
                        >
                          <i className="bi bi-envelope-fill"></i>
                          <span className="d-none d-lg-inline ms-1">Email</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Información visible de contacto */}
                {detalleModal.reserva.cliente_telefono && (
                  <div className="info-row">
                    <span className="info-label">Teléfono</span>
                    <span className="info-value text-end">
                      <i className="bi bi-telephone me-1"></i>
                      {detalleModal.reserva.cliente_telefono}
                    </span>
                  </div>
                )}

                {detalleModal.reserva.cliente_email && (
                  <div className="info-row">
                    <span className="info-label">Email</span>
                    <span className="info-value text-end text-break">
                      <i className="bi bi-envelope me-1"></i>
                      {detalleModal.reserva.cliente_email}
                    </span>
                  </div>
                )}

                {detalleModal.reserva.cliente_rut && (
                  <div className="info-row mb-0">
                    <span className="info-label">RUT</span>
                    <span className="info-value">
                      <span className="badge-soft">{detalleModal.reserva.cliente_rut}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notas Especiales */}
            {detalleModal.reserva.notas && (
              <div className="note-card">
                <div className="d-flex align-items-start gap-3">
                  <i className="bi bi-chat-left-quote-fill fs-4"></i>
                  <div>
                    <p className="mb-1 fw-semibold text-warning-emphasis">Notas y Requerimientos</p>
                    <p className="mb-0 fst-italic text-body">{detalleModal.reserva.notas}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="d-flex justify-content-between align-items-center pt-3 mt-3 border-top reserva-actions">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setDetalleModal({ isOpen: false, reserva: null })}
              >
                <i className="bi bi-x-circle me-2"></i>
                Cerrar
              </button>

              <div className="d-flex gap-2">
                {(rolActual === "cajero" || rolActual === "admin") && (
                  <div className="dropdown">
                    <button
                      className="btn btn-outline-primary dropdown-toggle"
                      type="button"
                      data-bs-toggle="dropdown"
                    >
                      Cambiar Estado
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      {[
                        { label: "ACTIVA", value: "activa", icon: "bi-check-circle", color: "success" },
                        { label: "PENDIENTE", value: "pendiente", icon: "bi-clock", color: "warning" },
                        { label: "COMPLETADA", value: "completada", icon: "bi-check-all", color: "info" },
                        { label: "CANCELADA", value: "cancelada", icon: "bi-x-circle", color: "danger" }
                      ]
                        .filter(e => e.label !== detalleModal.reserva.estado)
                        .map(estado => (
                          <li key={estado.value}>
                            <button
                              className="dropdown-item d-flex align-items-center"
                              onClick={() => {
                                setDetalleModal({ isOpen: false, reserva: null });
                                handleCambiarEstado(detalleModal.reserva.id, estado.value);
                              }}
                            >
                              <i className={`bi ${estado.icon} me-2 text-${estado.color}`}></i>
                              Cambiar a {estado.label}
                            </button>
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                )}

                {(rolActual === "admin" || rolActual === "cajero") && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAbrirModalEdicion(detalleModal.reserva)}
                    disabled={loadingEdit}
                  >
                    {loadingEdit ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Cargando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-pencil-square me-2"></i>
                        Editar Reserva
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
