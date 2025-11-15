import { useEffect, useMemo, useState, useRef } from "react";
import { getReservas, updateEstadoReserva } from "../services/reservasApi";
import Modal, { ConfirmModal } from "./ui/Modal";
import { useToast } from "../contexts/ToastContext";
import { formatErrorMessage } from "../utils/errorMessages";
import CalendarioMensual from "./CalendarioMensual";

function PanelReservas({ user, onLogout }) {
    // Usar el rol real del usuario autenticado
    const rolActual = user?.rol || "cliente";
    const toast = useToast();

    const [reservas, setReservas] = useState([]);
    const [detalleModal, setDetalleModal] = useState({ isOpen: false, reserva: null });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    // Load filters from sessionStorage
    const loadFiltersFromStorage = () => {
        try {
            const saved = sessionStorage.getItem('panelReservas_filters');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    };

    const savedFilters = loadFiltersFromStorage();

    const [fecha, setFecha] = useState(() =>
        savedFilters?.fecha || new Date().toISOString().slice(0, 10)
    );
    const [estadoFiltro, setEstadoFiltro] = useState(savedFilters?.estadoFiltro || "TODOS");
    const [busqueda, setBusqueda] = useState(savedFilters?.busqueda || "");

    // Advanced search state
    const [searchHora, setSearchHora] = useState(savedFilters?.searchHora || "");
    const [searchPersonasMin, setSearchPersonasMin] = useState(savedFilters?.searchPersonasMin || "");
    const [searchPersonasMax, setSearchPersonasMax] = useState(savedFilters?.searchPersonasMax || "");
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(savedFilters?.itemsPerPage || 10);

    // Auto-refresh state
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30); // seconds
    const intervalRef = useRef(null);

    // Sorting state
    const [sortField, setSortField] = useState(savedFilters?.sortField || null);
    const [sortDirection, setSortDirection] = useState(savedFilters?.sortDirection || 'asc');

    // Loading states
    const [loading, setLoading] = useState(false);
    const [loadingRows, setLoadingRows] = useState({}); // Track loading per row
    const [error, setError] = useState("");

    // Mobile view state
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    // Calendar view state
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [reservasMes, setReservasMes] = useState({}); // {date: [reservas]} for calendar view

    // Función para cargar reservas (reutilizable)
    const cargarReservas = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await getReservas({ fecha });
            setReservas(data);
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar las reservas.");
        } finally {
            setLoading(false);
        }
    };

    // Cargar reservas al cambiar fecha
    useEffect(() => {
        cargarReservas();
        setCurrentPage(1); // Reset to first page on date change
    }, [fecha]);

    // Auto-refresh effect
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                cargarReservas();
            }, refreshInterval * 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRefresh, refreshInterval, fecha]);

    // Save filters to sessionStorage
    useEffect(() => {
        const filters = {
            fecha,
            estadoFiltro,
            busqueda,
            searchHora,
            searchPersonasMin,
            searchPersonasMax,
            itemsPerPage,
            sortField,
            sortDirection
        };
        sessionStorage.setItem('panelReservas_filters', JSON.stringify(filters));
    }, [fecha, estadoFiltro, busqueda, searchHora, searchPersonasMin, searchPersonasMax, itemsPerPage, sortField, sortDirection]);

    // Handle window resize for mobile view
    useEffect(() => {
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Filtro por estado, texto y búsqueda avanzada
    const reservasFiltradas = useMemo(() => {
        let filtered = reservas.filter((r) => {
            const coincideEstado =
                estadoFiltro === "TODOS" || r.estado === estadoFiltro;

            const texto = busqueda.toLowerCase();
            const coincideBusqueda =
                !texto ||
                r.cliente.toLowerCase().includes(texto) ||
                r.mesa.toLowerCase().includes(texto);

            // Advanced search filters
            const coincideHora = !searchHora || (r.hora && r.hora.includes(searchHora));

            const coincidePersonasMin = !searchPersonasMin ||
                (r.personas && r.personas >= parseInt(searchPersonasMin));

            const coincidePersonasMax = !searchPersonasMax ||
                (r.personas && r.personas <= parseInt(searchPersonasMax));

            return coincideEstado && coincideBusqueda && coincideHora &&
                   coincidePersonasMin && coincidePersonasMax;
        });

        // Apply sorting
        if (sortField) {
            filtered.sort((a, b) => {
                let aVal = a[sortField];
                let bVal = b[sortField];

                // Special handling for hora (time)
                if (sortField === 'hora') {
                    aVal = aVal || '00:00';
                    bVal = bVal || '00:00';
                }

                // Special handling for personas (numeric)
                if (sortField === 'personas') {
                    aVal = parseInt(aVal) || 0;
                    bVal = parseInt(bVal) || 0;
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [reservas, estadoFiltro, busqueda, searchHora, searchPersonasMin, searchPersonasMax, sortField, sortDirection]);

    // Pagination logic
    const totalPages = Math.ceil(reservasFiltradas.length / itemsPerPage);
    const reservasPaginadas = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return reservasFiltradas.slice(startIndex, endIndex);
    }, [reservasFiltradas, currentPage, itemsPerPage]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [estadoFiltro, busqueda, searchHora, searchPersonasMin, searchPersonasMax]);

    // Function to handle column sorting
    const handleSort = (field) => {
        if (sortField === field) {
            // Toggle direction
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New field, start with ascending
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Function to clear all filters
    const clearAllFilters = () => {
        setEstadoFiltro("TODOS");
        setBusqueda("");
        setSearchHora("");
        setSearchPersonasMin("");
        setSearchPersonasMax("");
        setSortField(null);
        setSortDirection('asc');
    };

    // Date navigation functions
    const navegarFecha = (dias) => {
        const fechaActual = new Date(fecha);
        fechaActual.setDate(fechaActual.getDate() + dias);
        setFecha(fechaActual.toISOString().split('T')[0]);
    };

    const irAHoy = () => {
        setFecha(new Date().toISOString().split('T')[0]);
    };

    const irAManana = () => {
        navegarFecha(1);
    };

    const irAEstaSemana = () => {
        // Ir al lunes de esta semana
        const hoy = new Date();
        const dia = hoy.getDay();
        const diff = dia === 0 ? -6 : 1 - dia; // Si es domingo, retroceder 6 días
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() + diff);
        setFecha(lunes.toISOString().split('T')[0]);
    };

    // Handle calendar day click
    const handleDiaClick = (fechaStr) => {
        setFecha(fechaStr);
        setViewMode('list'); // Switch to list view to show details
    };

    // resumen por estado
    const resumen = useMemo(() => {
        const activas = reservasFiltradas.filter(
            (r) => r.estado === "ACTIVA"
        ).length;
        const pendientes = reservasFiltradas.filter(
            (r) => r.estado === "PENDIENTE"
        ).length;
        const canceladas = reservasFiltradas.filter(
            (r) => r.estado === "CANCELADA"
        ).length;

        return { activas, pendientes, canceladas };
    }, [reservasFiltradas]);

    // Formatear hora a formato militar 24 horas (HH:MM)
    function formatearHora(hora) {
        if (!hora) return '';
        // Quitar segundos si los hay (HH:MM:SS -> HH:MM)
        return hora.substring(0, 5);
    }

    async function handleCambiarEstado(id, nuevoEstado, requiresConfirmation = false) {
        // Destructive actions require confirmation
        const estadosDestructivos = ['cancelada', 'completada'];
        const needsConfirmation = requiresConfirmation || estadosDestructivos.includes(nuevoEstado.toLowerCase());

        const ejecutarCambio = async () => {
            try {
                // Set loading for this specific row
                setLoadingRows(prev => ({ ...prev, [id]: true }));
                setError("");

                await updateEstadoReserva({ id, nuevoEstado });

                setReservas((prev) =>
                    prev.map((r) =>
                        r.id === id ? { ...r, estado: nuevoEstado } : r
                    )
                );

                toast.success('Estado de la reserva actualizado correctamente');
            } catch (err) {
                console.error(err);
                const errorMsg = formatErrorMessage(err);
                setError(errorMsg);
                toast.error(errorMsg);
            } finally {
                // Remove loading for this row
                setLoadingRows(prev => {
                    const newState = { ...prev };
                    delete newState[id];
                    return newState;
                });
            }
        };

        if (needsConfirmation) {
            const mensajesConfirmacion = {
                cancelada: '¿Está seguro de que desea cancelar esta reserva? Esta acción no se puede deshacer.',
                completada: '¿Confirma que esta reserva ha sido completada? Esto marcará la reserva como finalizada.'
            };

            setConfirmModal({
                isOpen: true,
                title: `Confirmar cambio a ${nuevoEstado.toUpperCase()}`,
                message: mensajesConfirmacion[nuevoEstado.toLowerCase()] || '¿Está seguro de realizar este cambio?',
                onConfirm: async () => {
                    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
                    await ejecutarCambio();
                }
            });
        } else {
            await ejecutarCambio();
        }
    }


    function renderAcciones(reserva) {
        const isLoading = loadingRows[reserva.id];

        // Admin
        if (rolActual === "admin") {
            return (
                <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setDetalleModal({ isOpen: true, reserva })}
                    disabled={isLoading}
                >
                    <i className="bi bi-eye me-1"></i>
                    Ver detalle
                </button>
            );
        }

        // Cajero - Dropdown menu para cambiar estados
        if (rolActual === "cajero") {
            const estados = [
                { label: "ACTIVA", value: "activa", icon: "bi-check-circle", color: "success" },
                { label: "PENDIENTE", value: "pendiente", icon: "bi-clock", color: "warning" },
                { label: "COMPLETADA", value: "completada", icon: "bi-check-all", color: "info" },
                { label: "CANCELADA", value: "cancelada", icon: "bi-x-circle", color: "danger" }
            ];

            const estadosDisponibles = estados.filter((e) => e.label !== reserva.estado);

            if (isLoading) {
                return (
                    <button className="btn btn-outline-primary btn-sm" disabled>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Procesando...
                    </button>
                );
            }

            return (
                <div className="dropdown">
                    <button
                        className="btn btn-outline-primary btn-sm dropdown-toggle"
                        type="button"
                        id={`dropdown-${reserva.id}`}
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        <i className="bi bi-gear me-1"></i>
                        Acciones
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end" aria-labelledby={`dropdown-${reserva.id}`}>
                        {estadosDisponibles.map((estado) => (
                            <li key={estado.value}>
                                <button
                                    className="dropdown-item"
                                    onClick={() => handleCambiarEstado(reserva.id, estado.value)}
                                >
                                    <i className={`bi ${estado.icon} me-2 text-${estado.color}`}></i>
                                    Cambiar a {estado.label}
                                </button>
                            </li>
                        ))}
                        <li><hr className="dropdown-divider" /></li>
                        <li>
                            <button
                                className="dropdown-item"
                                onClick={() => setDetalleModal({ isOpen: true, reserva })}
                            >
                                <i className="bi bi-eye me-2"></i>
                                Ver detalle
                            </button>
                        </li>
                    </ul>
                </div>
            );
        }

        return null;
    }

    return (
        <div className="container py-4">
            {/* Título y información de usuario */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1 fw-semibold">Panel de reservas</h1>
                    <p className="text-muted mb-0">
                        Reservas activas, pendientes y canceladas del día.
                    </p>
                </div>

                <div className="d-flex align-items-center gap-3">
                    <div className="text-end">
                        <div className="fw-semibold">{user?.nombre_completo || user?.username}</div>
                        <small className="text-muted">{user?.rol_display}</small>
                    </div>
                    <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={onLogout}
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Resumen de cantidades por estado */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <span className="text-muted small">Reservas activas</span>
                            <span className="h4 mb-0 d-block">
                                {resumen.activas}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <span className="text-muted small">Reservas pendientes</span>
                            <span className="h4 mb-0 d-block">
                                {resumen.pendientes}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <span className="text-muted small">Reservas canceladas</span>
                            <span className="h4 mb-0 d-block">
                                {resumen.canceladas}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros de fecha, estado y búsqueda */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    {/* Date Navigation and View Toggle */}
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => navegarFecha(-1)}
                                title="Día anterior"
                            >
                                <i className="bi bi-chevron-left"></i>
                            </button>
                            <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={irAHoy}
                            >
                                <i className="bi bi-calendar-check me-1"></i>
                                Hoy
                            </button>
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => navegarFecha(1)}
                                title="Día siguiente"
                            >
                                <i className="bi bi-chevron-right"></i>
                            </button>
                            <div className="vr"></div>
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={irAManana}
                            >
                                Mañana
                            </button>
                            <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={irAEstaSemana}
                            >
                                Esta Semana
                            </button>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="btn-group btn-group-sm" role="group">
                            <button
                                type="button"
                                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setViewMode('list')}
                            >
                                <i className="bi bi-list-ul me-1"></i>
                                Lista
                            </button>
                            <button
                                type="button"
                                className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setViewMode('calendar')}
                            >
                                <i className="bi bi-calendar3 me-1"></i>
                                Calendario
                            </button>
                        </div>
                    </div>

                    <div className="row g-3 mb-3">
                        <div className="col-md-3">
                            <label
                                htmlFor="filtro-fecha"
                                className="form-label small"
                            >
                                Fecha
                            </label>
                            <input
                                type="date"
                                id="filtro-fecha"
                                className="form-control form-control-sm"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                            />
                            <small className="text-muted">
                                {new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </small>
                        </div>

                        <div className="col-md-3">
                            <label
                                htmlFor="filtro-estado"
                                className="form-label small"
                            >
                                Estado
                            </label>
                            <select
                                id="filtro-estado"
                                className="form-select form-select-sm"
                                value={estadoFiltro}
                                onChange={(e) => setEstadoFiltro(e.target.value)}
                            >
                                <option value="TODOS">Todos</option>
                                <option value="ACTIVA">Activa</option>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="CANCELADA">Cancelada</option>
                                <option value="COMPLETADA">Completada</option>
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label
                                htmlFor="filtro-busqueda"
                                className="form-label small"
                            >
                                Buscar (cliente / mesa)
                            </label>
                            <input
                                type="text"
                                id="filtro-busqueda"
                                className="form-control form-control-sm"
                                placeholder="Ej: Juan, Mesa 5"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>

                        <div className="col-md-3">
                            <label
                                htmlFor="items-per-page"
                                className="form-label small"
                            >
                                Items por página
                            </label>
                            <select
                                id="items-per-page"
                                className="form-select form-select-sm"
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            >
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                    </div>

                    {/* Auto-refresh controls */}
                    <div className="d-flex align-items-center gap-3 pt-2 border-top">
                        <div className="form-check form-switch mb-0">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="auto-refresh-toggle"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                            <label className="form-check-label small" htmlFor="auto-refresh-toggle">
                                <i className="bi bi-arrow-clockwise me-1"></i>
                                Auto-actualizar
                            </label>
                        </div>
                        {autoRefresh && (
                            <div className="d-flex align-items-center gap-2">
                                <label htmlFor="refresh-interval" className="small mb-0">
                                    Intervalo:
                                </label>
                                <select
                                    id="refresh-interval"
                                    className="form-select form-select-sm"
                                    style={{ width: '100px' }}
                                    value={refreshInterval}
                                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                >
                                    <option value="15">15 seg</option>
                                    <option value="30">30 seg</option>
                                    <option value="60">1 min</option>
                                    <option value="120">2 min</option>
                                </select>
                            </div>
                        )}
                        <button
                            className="btn btn-outline-secondary btn-sm ms-auto"
                            onClick={cargarReservas}
                            disabled={loading}
                        >
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Actualizar ahora
                        </button>
                    </div>

                    {/* Advanced Search Toggle */}
                    <div className="pt-3 border-top mt-3">
                        <button
                            className="btn btn-link btn-sm text-decoration-none p-0"
                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        >
                            <i className={`bi bi-${showAdvancedSearch ? 'chevron-up' : 'chevron-down'} me-1`}></i>
                            Búsqueda avanzada
                        </button>

                        {showAdvancedSearch && (
                            <div className="row g-3 mt-2">
                                <div className="col-md-3">
                                    <label htmlFor="search-hora" className="form-label small">
                                        Hora
                                    </label>
                                    <input
                                        type="time"
                                        id="search-hora"
                                        className="form-control form-control-sm"
                                        value={searchHora}
                                        onChange={(e) => setSearchHora(e.target.value)}
                                    />
                                    <small className="text-muted">Busca por hora de reserva</small>
                                </div>

                                <div className="col-md-3">
                                    <label htmlFor="search-personas-min" className="form-label small">
                                        Personas (mínimo)
                                    </label>
                                    <input
                                        type="number"
                                        id="search-personas-min"
                                        className="form-control form-control-sm"
                                        min="1"
                                        value={searchPersonasMin}
                                        onChange={(e) => setSearchPersonasMin(e.target.value)}
                                        placeholder="Ej: 2"
                                    />
                                </div>

                                <div className="col-md-3">
                                    <label htmlFor="search-personas-max" className="form-label small">
                                        Personas (máximo)
                                    </label>
                                    <input
                                        type="number"
                                        id="search-personas-max"
                                        className="form-control form-control-sm"
                                        min="1"
                                        value={searchPersonasMax}
                                        onChange={(e) => setSearchPersonasMax(e.target.value)}
                                        placeholder="Ej: 8"
                                    />
                                </div>

                                <div className="col-md-3 d-flex align-items-end">
                                    <button
                                        className="btn btn-outline-danger btn-sm w-100"
                                        onClick={clearAllFilters}
                                    >
                                        <i className="bi bi-x-circle me-1"></i>
                                        Limpiar filtros
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabla de reservas */}
            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h2 className="h6 mb-0">Reservas del día</h2>
                        <div className="d-flex align-items-center gap-2">
                            {loading && (
                                <div className="spinner-border spinner-border-sm text-primary" role="status">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                            )}
                            <span className="text-muted small">
                                {reservasFiltradas.length} reserva(s) encontrada(s)
                                {totalPages > 1 && ` - Página ${currentPage} de ${totalPages}`}
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger py-2 small">{error}</div>
                    )}

                    {/* Calendar View */}
                    {viewMode === 'calendar' ? (
                        <CalendarioMensual
                            fechaSeleccionada={fecha}
                            onDiaClick={handleDiaClick}
                        />
                    ) : (
                        /* List View */
                        <>
                            {/* Mobile card view */}
                            {isMobileView ? (
                        <div className="d-block d-md-none">
                            {reservasPaginadas.map((reserva, index) => {
                                const numeroGlobal = (currentPage - 1) * itemsPerPage + index + 1;
                                const isLoading = loadingRows[reserva.id];
                                return (
                                    <div key={reserva.id} className="card mb-2 shadow-sm">
                                        <div className="card-body p-3">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <h6 className="mb-0">{reserva.cliente}</h6>
                                                    <small className="text-muted">#{numeroGlobal}</small>
                                                </div>
                                                <span className={`estado-badge estado-${reserva.estado}`}>
                                                    {reserva.estado}
                                                </span>
                                            </div>
                                            <div className="row g-2 mb-2">
                                                <div className="col-6">
                                                    <small className="text-muted d-block">Mesa</small>
                                                    <strong>{reserva.mesa}</strong>
                                                </div>
                                                <div className="col-6">
                                                    <small className="text-muted d-block">Hora</small>
                                                    <strong>{formatearHora(reserva.hora)} hrs</strong>
                                                </div>
                                                <div className="col-6">
                                                    <small className="text-muted d-block">Personas</small>
                                                    <strong>{reserva.personas}</strong>
                                                </div>
                                            </div>
                                            <div className="d-flex justify-content-end">
                                                {isLoading ? (
                                                    <button className="btn btn-outline-primary btn-sm" disabled>
                                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                                        Procesando...
                                                    </button>
                                                ) : (
                                                    renderAcciones(reserva)
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Desktop table view */
                        <div className="table-responsive d-none d-md-block">
                            <table className="table table-hover align-middle">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th
                                            role="button"
                                            onClick={() => handleSort('cliente')}
                                            className="user-select-none"
                                        >
                                            Cliente
                                            {sortField === 'cliente' && (
                                                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                            )}
                                        </th>
                                        <th
                                            role="button"
                                            onClick={() => handleSort('mesa')}
                                            className="user-select-none"
                                        >
                                            Mesa
                                            {sortField === 'mesa' && (
                                                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                            )}
                                        </th>
                                        <th
                                            role="button"
                                            onClick={() => handleSort('hora')}
                                            className="user-select-none"
                                        >
                                            Hora
                                            {sortField === 'hora' && (
                                                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                            )}
                                        </th>
                                        <th
                                            role="button"
                                            onClick={() => handleSort('personas')}
                                            className="user-select-none"
                                        >
                                            Personas
                                            {sortField === 'personas' && (
                                                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                            )}
                                        </th>
                                        <th
                                            role="button"
                                            onClick={() => handleSort('estado')}
                                            className="user-select-none"
                                        >
                                            Estado
                                            {sortField === 'estado' && (
                                                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                            )}
                                        </th>
                                        <th className="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reservasPaginadas.map((reserva, index) => {
                                    const numeroGlobal = (currentPage - 1) * itemsPerPage + index + 1;
                                    return (
                                        <tr key={reserva.id}>
                                            <td>{numeroGlobal}</td>
                                            <td>{reserva.cliente}</td>
                                            <td>{reserva.mesa}</td>
                                            <td>{formatearHora(reserva.hora)} hrs</td>
                                            <td>{reserva.personas}</td>
                                            <td>
                                                <span
                                                    className={`estado-badge estado-${reserva.estado}`}
                                                >
                                                    {reserva.estado}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                {renderAcciones(reserva)}
                                            </td>
                                        </tr>
                                    );
                                })}

                                    {reservasFiltradas.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="7" className="text-center text-muted py-4">
                                                No hay reservas para los filtros seleccionados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Empty state for mobile */}
                    {isMobileView && reservasFiltradas.length === 0 && !loading && (
                        <div className="text-center text-muted py-4">
                            <i className="bi bi-inbox display-4 d-block mb-2"></i>
                            <p>No hay reservas para los filtros seleccionados.</p>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                            <div className="text-muted small">
                                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, reservasFiltradas.length)} de {reservasFiltradas.length} reservas
                            </div>
                            <nav aria-label="Paginación de reservas">
                                <ul className="pagination pagination-sm mb-0">
                                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                        >
                                            <i className="bi bi-chevron-double-left"></i>
                                        </button>
                                    </li>
                                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => setCurrentPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <i className="bi bi-chevron-left"></i>
                                        </button>
                                    </li>

                                    {/* Page numbers */}
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        return (
                                            <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                                <button
                                                    className="page-link"
                                                    onClick={() => setCurrentPage(pageNum)}
                                                >
                                                    {pageNum}
                                                </button>
                                            </li>
                                        );
                                    })}

                                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => setCurrentPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        >
                                            <i className="bi bi-chevron-right"></i>
                                        </button>
                                    </li>
                                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                        >
                                            <i className="bi bi-chevron-double-right"></i>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal de detalle de reserva */}
            {detalleModal.reserva && (
                <Modal
                    isOpen={detalleModal.isOpen}
                    onClose={() => setDetalleModal({ isOpen: false, reserva: null })}
                    title={`Detalle de Reserva #${detalleModal.reserva.id}`}
                    size="lg"
                >
                    {/* Header con estado */}
                    <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                        <h6 className="mb-0">Información de la Reserva</h6>
                        <span className={`estado-badge estado-${detalleModal.reserva.estado}`}>
                            {detalleModal.reserva.estado}
                        </span>
                    </div>

                    <div className="row">
                        {/* Información del Cliente */}
                        <div className="col-md-6 mb-4">
                            <h6 className="text-primary mb-3">
                                <i className="bi bi-person-circle me-2"></i>
                                Datos del Cliente
                            </h6>
                            <div className="mb-2">
                                <strong className="text-muted small">Nombre:</strong>
                                <p className="mb-1">{detalleModal.reserva.cliente}</p>
                            </div>
                            {detalleModal.reserva.cliente_telefono && (
                                <div className="mb-2">
                                    <strong className="text-muted small">Teléfono:</strong>
                                    <p className="mb-1">
                                        <a href={`tel:${detalleModal.reserva.cliente_telefono}`} className="text-decoration-none">
                                            <i className="bi bi-telephone me-1"></i>
                                            {detalleModal.reserva.cliente_telefono}
                                        </a>
                                    </p>
                                </div>
                            )}
                            {detalleModal.reserva.cliente_email && (
                                <div className="mb-2">
                                    <strong className="text-muted small">Email:</strong>
                                    <p className="mb-1">
                                        <a href={`mailto:${detalleModal.reserva.cliente_email}`} className="text-decoration-none">
                                            <i className="bi bi-envelope me-1"></i>
                                            {detalleModal.reserva.cliente_email}
                                        </a>
                                    </p>
                                </div>
                            )}
                            {detalleModal.reserva.cliente_rut && (
                                <div className="mb-2">
                                    <strong className="text-muted small">RUT:</strong>
                                    <p className="mb-1">{detalleModal.reserva.cliente_rut}</p>
                                </div>
                            )}
                        </div>

                        {/* Información de la Reserva */}
                        <div className="col-md-6 mb-4">
                            <h6 className="text-primary mb-3">
                                <i className="bi bi-calendar-event me-2"></i>
                                Detalles de la Reserva
                            </h6>
                            <div className="mb-2">
                                <strong className="text-muted small">Mesa:</strong>
                                <p className="mb-1">{detalleModal.reserva.mesa}</p>
                            </div>
                            <div className="mb-2">
                                <strong className="text-muted small">Fecha:</strong>
                                <p className="mb-1">
                                    <i className="bi bi-calendar3 me-1"></i>
                                    {new Date(detalleModal.reserva.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="mb-2">
                                <strong className="text-muted small">Hora:</strong>
                                <p className="mb-1">
                                    <i className="bi bi-clock me-1"></i>
                                    {formatearHora(detalleModal.reserva.hora)} hrs
                                    {detalleModal.reserva.hora_fin && ` - ${formatearHora(detalleModal.reserva.hora_fin)} hrs`}
                                </p>
                            </div>
                            <div className="mb-2">
                                <strong className="text-muted small">Personas:</strong>
                                <p className="mb-1">
                                    <i className="bi bi-people me-1"></i>
                                    {detalleModal.reserva.personas} {detalleModal.reserva.personas === 1 ? 'persona' : 'personas'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notas */}
                    {detalleModal.reserva.notas && (
                        <div className="mb-4">
                            <h6 className="text-primary mb-2">
                                <i className="bi bi-chat-left-text me-2"></i>
                                Notas Especiales
                            </h6>
                            <div className="alert alert-info py-2 mb-0">
                                {detalleModal.reserva.notas}
                            </div>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() => setDetalleModal({ isOpen: false, reserva: null })}
                        >
                            Cerrar
                        </button>

                        <div className="d-flex gap-2">
                            {/* Cambiar Estado (solo para Cajero) */}
                            {rolActual === "cajero" && (
                                <div className="dropdown">
                                    <button
                                        className="btn btn-outline-primary dropdown-toggle"
                                        type="button"
                                        data-bs-toggle="dropdown"
                                    >
                                        <i className="bi bi-arrow-left-right me-1"></i>
                                        Cambiar Estado
                                    </button>
                                    <ul className="dropdown-menu">
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
                                                        className="dropdown-item"
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

                            {/* Botón Editar (para Admin y Cajero) */}
                            {(rolActual === "admin" || rolActual === "cajero") && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        // TODO: Implementar modal de edición
                                        toast.info('Función de edición en desarrollo');
                                        setDetalleModal({ isOpen: false, reserva: null });
                                    }}
                                >
                                    <i className="bi bi-pencil me-1"></i>
                                    Editar Reserva
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de confirmación */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
            />
        </div>
    );
}

export default PanelReservas;
