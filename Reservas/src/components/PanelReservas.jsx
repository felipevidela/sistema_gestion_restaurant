import { useEffect, useMemo, useState, useRef } from "react";
import {
    getReservas,
    updateEstadoReserva,
    updateReserva,
    getMesas,
    getHorasDisponibles
} from "../services/reservasApi";
import Modal, { ConfirmModal } from "./ui/Modal";
import { useToast } from "../contexts/ToastContext";
import { formatErrorMessage } from "../utils/errorMessages";
import CalendarioMensual from "./CalendarioMensual";

function PanelReservas({ user, onLogout, showAllReservations = false }) {
    // Usar el rol real del usuario autenticado
    const rolActual = user?.rol || "cliente";
    const toast = useToast();
    const isBrowser = typeof window !== 'undefined';
    const FILTERS_STORAGE_KEY = showAllReservations ? 'panelReservas_all_filters' : 'panelReservas_filters';

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
        if (!isBrowser) return null;
        try {
            const saved = sessionStorage.getItem(FILTERS_STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    };

    const savedFilters = loadFiltersFromStorage();

    const [fecha, setFecha] = useState(() =>
        savedFilters?.fecha !== undefined
            ? savedFilters.fecha
            : (showAllReservations ? '' : new Date().toISOString().slice(0, 10))
    );
    const defaultFechaInicio = () => {
        const today = new Date();
        today.setDate(today.getDate() - 30);
        return today.toISOString().slice(0, 10);
    };

    const [fechaInicio, setFechaInicio] = useState(() =>
        savedFilters?.fechaInicio !== undefined
            ? savedFilters.fechaInicio
            : (showAllReservations ? defaultFechaInicio() : '')
    );
    const [fechaFin, setFechaFin] = useState(savedFilters?.fechaFin || '');
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
    const [isMobileView, setIsMobileView] = useState(false);

    // Calendar view state
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

    // Edit modal state
    const [editModal, setEditModal] = useState({ isOpen: false, reserva: null });
    const [formData, setFormData] = useState({
        fecha_reserva: '',
        hora_inicio: '',
        mesa: '',
        num_personas: 1,
        notas: ''
    });
    const [mesasDisponibles, setMesasDisponibles] = useState([]);
    const [horasDisponibles, setHorasDisponibles] = useState([]);
    const [loadingEdit, setLoadingEdit] = useState(false);

    // Función para cargar reservas (reutilizable)
    const cargarReservas = async () => {
        try {
            setLoading(true);
            setError("");
            const filtros = {};
            if (showAllReservations) {
                if (fechaInicio) filtros.fecha_inicio = fechaInicio;
                if (fechaFin) filtros.fecha_fin = fechaFin;
            } else if (fecha) {
                filtros.fecha = fecha;
            }
            const data = await getReservas(filtros);
            setReservas(data);
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar las reservas.");
        } finally {
            setLoading(false);
        }
    };

    // Cargar reservas al cambiar filtros relevantes
    useEffect(() => {
        cargarReservas();
        setCurrentPage(1); // Reset to first page on date change
    }, [fecha, fechaInicio, fechaFin, showAllReservations]);

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
        if (!isBrowser) return;
        const filters = {
            fecha,
            estadoFiltro,
            busqueda,
            searchHora,
            searchPersonasMin,
            searchPersonasMax,
            fechaInicio,
            fechaFin,
            itemsPerPage,
            sortField,
            sortDirection
        };
        sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    }, [fecha, fechaInicio, fechaFin, estadoFiltro, busqueda, searchHora, searchPersonasMin, searchPersonasMax, itemsPerPage, sortField, sortDirection, isBrowser, FILTERS_STORAGE_KEY]);

    // Handle window resize for mobile view
    useEffect(() => {
        if (!isBrowser) return;
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isBrowser]);

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
        setFecha(showAllReservations ? '' : new Date().toISOString().split('T')[0]);
        setFechaInicio(showAllReservations ? defaultFechaInicio() : '');
        setFechaFin('');
        setEstadoFiltro("TODOS");
        setBusqueda("");
        setSearchHora("");
        setSearchPersonasMin("");
        setSearchPersonasMax("");
        setSortField(null);
        setSortDirection('asc');
        setCurrentPage(1);
    };

    // Date navigation functions
    const navegarFecha = (dias) => {
        const fechaActual = fecha ? new Date(fecha) : new Date();
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

    // Abrir modal de edición con los datos de la reserva
    async function handleAbrirModalEdicion(reserva) {
        try {
            // Extraer el número de mesa del formato "M01" -> 1
            const numeroMesa = parseInt(reserva.mesa.substring(1));

            // Cargar mesas disponibles
            const mesas = await getMesas();
            setMesasDisponibles(mesas);

            // Inicializar el formulario con los datos actuales de la reserva
            const formInitial = {
                fecha_reserva: reserva.fecha,
                hora_inicio: reserva.hora,
                mesa: numeroMesa,
                num_personas: reserva.personas,
                notas: reserva.notas || ''
            };
            setFormData(formInitial);

            // Cargar horas disponibles para la fecha y personas actuales
            await handleCargarHorasDisponibles(reserva.fecha, reserva.personas);

            // Abrir modal
            setEditModal({ isOpen: true, reserva });
            setDetalleModal({ isOpen: false, reserva: null });
        } catch (err) {
            console.error('Error al abrir modal de edición:', err);
            toast.error('Error al cargar datos para edición');
        }
    }

    // Cargar horas disponibles cuando cambia fecha o número de personas
    async function handleCargarHorasDisponibles(fecha, personas) {
        try {
            const data = await getHorasDisponibles({ fecha, personas });
            setHorasDisponibles(data.horas_disponibles || []);
        } catch (err) {
            console.error('Error al cargar horas disponibles:', err);
            setHorasDisponibles([]);
        }
    }

    // Guardar cambios de la reserva
    async function handleEditarReserva(e) {
        e.preventDefault();

        try {
            setLoadingEdit(true);

            // Preparar datos para enviar al backend
            const reservaData = {
                mesa: formData.mesa,
                fecha_reserva: formData.fecha_reserva,
                hora_inicio: formData.hora_inicio,
                num_personas: formData.num_personas,
                notas: formData.notas
            };

            await updateReserva({
                id: editModal.reserva.id,
                reservaData
            });

            // Recargar reservas para actualizar la lista
            await cargarReservas();

            // Cerrar modal y mostrar mensaje de éxito
            setEditModal({ isOpen: false, reserva: null });
            toast.success('Reserva actualizada correctamente');
        } catch (err) {
            console.error('Error al actualizar reserva:', err);
            const errorMsg = formatErrorMessage(err);
            toast.error(errorMsg);
        } finally {
            setLoadingEdit(false);
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

    const panelTitle = showAllReservations ? 'Todas las reservas' : 'Panel de reservas';
    const panelSubtitle = showAllReservations
        ? 'Analiza el historial completo usando rangos de fechas personalizados.'
        : 'Reservas activas, pendientes y canceladas del día.';
    const fechaLegible = fecha
        ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : 'Sin filtro de fecha';
    const rangoLegible = fechaInicio || fechaFin
        ? `${fechaInicio || 'inicio'} → ${fechaFin || 'sin fin'}`
        : 'Sin rango';
    const handleLimpiarRango = () => {
        setFechaInicio(defaultFechaInicio());
        setFechaFin('');
    };
    const resumenTarjetas = useMemo(() => ([
        {
            label: 'Reservas activas',
            value: resumen.activas,
            icon: 'bi-rocket-takeoff',
            tone: 'primary'
        },
        {
            label: 'Pendientes por confirmar',
            value: resumen.pendientes,
            icon: 'bi-hourglass-split',
            tone: 'warning'
        },
        {
            label: 'Canceladas',
            value: resumen.canceladas,
            icon: 'bi-x-octagon',
            tone: 'danger'
        },
    ]), [resumen]);

    return (
        <div className="container py-4">
            {/* Título y información de usuario */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1 fw-semibold">{panelTitle}</h1>
                    <p className="text-muted mb-0">
                        {panelSubtitle}
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
                {resumenTarjetas.map(card => (
                    <div className="col-md-4" key={card.label}>
                        <div className="card border-0 shadow-sm resumen-card">
                            <div className="card-body d-flex align-items-center gap-3">
                                <div className={`resumen-card__icon text-${card.tone}`}>
                                    <i className={`bi ${card.icon}`}></i>
                                </div>
                                <div>
                                    <span className="text-muted small d-block">{card.label}</span>
                                    <span className="h4 mb-0 fw-bold">{card.value}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros de fecha, estado y búsqueda */}
            <div className="card border-0 shadow-sm mb-4 panel-controls">
                <div className="card-body">
                    {/* Date Navigation and View Toggle */}
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 pb-3 border-bottom gap-3">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            {!showAllReservations ? (
                                <>
                                    <button
                                        className="btn btn-outline-secondary btn-sm"
                                        onClick={() => navegarFecha(-1)}
                                        title="Día anterior"
                                        aria-label="Día anterior"
                                    >
                                        ‹
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
                                        aria-label="Día siguiente"
                                    >
                                        ›
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
                                </>
                            ) : (
                                <span className="text-muted small">
                                    Mostrando todas las reservas. Usa los filtros para acotar.
                                </span>
                            )}
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
                        {!showAllReservations ? (
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
                                    {fechaLegible}
                                </small>
                            </div>
                        ) : (
                            <>
                                <div className="col-md-3">
                                    <label
                                        htmlFor="filtro-fecha-inicio"
                                        className="form-label small"
                                    >
                                        Desde
                                    </label>
                                    <input
                                        type="date"
                                        id="filtro-fecha-inicio"
                                        className="form-control form-control-sm"
                                        value={fechaInicio}
                                        onChange={(e) => setFechaInicio(e.target.value)}
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label
                                        htmlFor="filtro-fecha-fin"
                                        className="form-label small"
                                    >
                                        Hasta
                                    </label>
                                    <input
                                        type="date"
                                        id="filtro-fecha-fin"
                                        className="form-control form-control-sm"
                                        value={fechaFin}
                                        min={fechaInicio || undefined}
                                        onChange={(e) => setFechaFin(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

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

                    {showAllReservations && (
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                            <span className="badge rounded-pill badge-soft-primary">
                                <i className="bi bi-calendar-range me-1"></i>
                                {rangoLegible}
                            </span>
                            {(fechaInicio || fechaFin) && (
                                <button className="btn btn-link btn-sm p-0" onClick={handleLimpiarRango}>
                                    Limpiar rango
                                </button>
                            )}
                        </div>
                    )}

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
                                </ul>
                            </nav>
                        </div>
                    )}
                        </>
                    )}
                </div>
            </div>

            {/* Modal de detalle de reserva - Diseño Mejorado */}
            {detalleModal.reserva && (
                <Modal
                    isOpen={detalleModal.isOpen}
                    onClose={() => setDetalleModal({ isOpen: false, reserva: null })}
                    title={
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 w-100">
                            <div>
                                <span className="fw-semibold d-block">Reserva #{detalleModal.reserva.id}</span>
                                <small className="text-muted">Detalle completo del cliente y su mesa</small>
                            </div>
                            <span className={`estado-chip estado-chip--${(detalleModal.reserva.estado || '').toLowerCase()}`}>
                                <i className={`bi ${{
                                    ACTIVA: 'bi-lightning-charge-fill',
                                    PENDIENTE: 'bi-clock-history',
                                    COMPLETADA: 'bi-check2-circle',
                                    CANCELADA: 'bi-x-octagon-fill'
                                }[detalleModal.reserva.estado] || 'bi-info-circle'} me-2`}></i>
                                {detalleModal.reserva.estado}
                            </span>
                        </div>
                    }
                    size="xl"
                >
                    <div className="reserva-detalle-content">
                        {/* Header visual con resumen rápido */}
                        <div className="reserva-header-summary mb-4 p-4 bg-light rounded-3">
                            <div className="row g-3 text-center">
                                <div className="col-md-3">
                                    <div className="summary-item">
                                        <i className="bi bi-calendar3 fs-2 text-primary mb-2 d-block"></i>
                                        <div className="small text-muted">Fecha</div>
                                        <div className="fw-bold">
                                            {new Date(detalleModal.reserva.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                                                day: 'numeric',
                                                month: 'short'
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="summary-item">
                                        <i className="bi bi-clock fs-2 text-primary mb-2 d-block"></i>
                                        <div className="small text-muted">Horario</div>
                                        <div className="fw-bold">{formatearHora(detalleModal.reserva.hora)}</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="summary-item">
                                        <i className="bi bi-table fs-2 text-primary mb-2 d-block"></i>
                                        <div className="small text-muted">Mesa</div>
                                        <div className="fw-bold">{detalleModal.reserva.mesa}</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="summary-item">
                                        <i className="bi bi-people fs-2 text-primary mb-2 d-block"></i>
                                        <div className="small text-muted">Personas</div>
                                        <div className="fw-bold">{detalleModal.reserva.personas}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="row g-4">
                            {/* Información del Cliente - Card */}
                            <div className="col-lg-6">
                                <div className="card h-100 border-0 shadow-sm">
                                    <div className="card-header bg-primary bg-gradient text-white">
                                        <h6 className="mb-0">
                                            <i className="bi bi-person-circle me-2"></i>
                                            Información del Cliente
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="info-item mb-3">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-person-fill text-primary me-2 fs-5"></i>
                                                <span className="small text-muted">Nombre completo</span>
                                            </div>
                                            <div className="ps-4 fw-semibold">{detalleModal.reserva.cliente}</div>
                                        </div>

                                        {detalleModal.reserva.cliente_telefono && (
                                            <div className="info-item mb-3">
                                                <div className="d-flex align-items-center mb-2">
                                                    <i className="bi bi-telephone-fill text-success me-2 fs-5"></i>
                                                    <span className="small text-muted">Teléfono</span>
                                                </div>
                                                <div className="ps-4">
                                                    <a
                                                        href={`tel:${detalleModal.reserva.cliente_telefono}`}
                                                        className="text-decoration-none fw-semibold text-success d-inline-flex align-items-center text-break"
                                                        >
                                                        {detalleModal.reserva.cliente_telefono}
                                                        <i className="bi bi-box-arrow-up-right ms-2 small"></i>
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {detalleModal.reserva.cliente_email && (
                                            <div className="info-item mb-3">
                                                <div className="d-flex align-items-center mb-2">
                                                    <i className="bi bi-envelope-fill text-info me-2 fs-5"></i>
                                                    <span className="small text-muted">Email</span>
                                                </div>
                                                <div className="ps-4">
                                                    <a
                                                        href={`mailto:${detalleModal.reserva.cliente_email}`}
                                                        className="text-decoration-none fw-semibold text-info d-inline-flex align-items-center text-break"
                                                    >
                                                        {detalleModal.reserva.cliente_email}
                                                        <i className="bi bi-box-arrow-up-right ms-2 small"></i>
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {detalleModal.reserva.cliente_rut && (
                                            <div className="info-item">
                                                <div className="d-flex align-items-center mb-2">
                                                    <i className="bi bi-card-text text-secondary me-2 fs-5"></i>
                                                    <span className="small text-muted">RUT</span>
                                                </div>
                                                <div className="ps-4 fw-semibold font-monospace">{detalleModal.reserva.cliente_rut}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Detalles de la Reserva - Card */}
                            <div className="col-lg-6">
                                <div className="card h-100 border-0 shadow-sm">
                                    <div className="card-header bg-success bg-gradient text-white">
                                        <h6 className="mb-0">
                                            <i className="bi bi-calendar-check me-2"></i>
                                            Detalles de la Reserva
                                        </h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="info-item mb-3">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-calendar3 text-primary me-2 fs-5"></i>
                                                <span className="small text-muted">Fecha completa</span>
                                            </div>
                                            <div className="ps-4 fw-semibold">
                                                {new Date(detalleModal.reserva.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </div>

                                        <div className="info-item mb-3">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-clock-fill text-warning me-2 fs-5"></i>
                                                <span className="small text-muted">Horario de reserva</span>
                                            </div>
                                            <div className="ps-4">
                                                <span className="badge bg-warning text-dark fs-6 px-3 py-2">
                                                    {formatearHora(detalleModal.reserva.hora)} hrs
                                                    {detalleModal.reserva.hora_fin && ` - ${formatearHora(detalleModal.reserva.hora_fin)} hrs`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="info-item mb-3">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-table text-info me-2 fs-5"></i>
                                                <span className="small text-muted">Mesa asignada</span>
                                            </div>
                                            <div className="ps-4">
                                                <span className="badge bg-info fs-6 px-3 py-2">{detalleModal.reserva.mesa}</span>
                                            </div>
                                        </div>

                                        <div className="info-item">
                                            <div className="d-flex align-items-center mb-2">
                                                <i className="bi bi-people-fill text-success me-2 fs-5"></i>
                                                <span className="small text-muted">Número de comensales</span>
                                            </div>
                                            <div className="ps-4 fw-semibold">
                                                {detalleModal.reserva.personas} {detalleModal.reserva.personas === 1 ? 'persona' : 'personas'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notas Especiales - Full Width Card */}
                        {detalleModal.reserva.notas && (
                            <div className="mt-4">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-header bg-warning bg-opacity-10 border-warning">
                                        <h6 className="mb-0 text-warning-emphasis">
                                            <i className="bi bi-chat-left-text-fill me-2"></i>
                                            Notas y Requerimientos Especiales
                                        </h6>
                                    </div>
                                    <div className="card-body bg-warning bg-opacity-10">
                                        <div className="d-flex align-items-start">
                                            <i className="bi bi-quote text-warning-emphasis me-3 fs-3"></i>
                                            <p className="mb-0 fst-italic">{detalleModal.reserva.notas}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Acciones */}
                        <div className="d-flex justify-content-between align-items-center pt-4 mt-4 border-top">
                            <button
                                className="btn btn-lg btn-outline-secondary"
                                onClick={() => setDetalleModal({ isOpen: false, reserva: null })}
                            >
                                <i className="bi bi-x-circle me-2"></i>
                                Cerrar
                            </button>

                            <div className="d-flex gap-2">
                                {/* Cambiar Estado (solo para Cajero) */}
                                {rolActual === "cajero" && (
                                    <div className="dropdown">
                                        <button
                                            className="btn btn-lg btn-outline-primary dropdown-toggle"
                                            type="button"
                                            data-bs-toggle="dropdown"
                                        >
                                            <i className="bi bi-arrow-left-right me-2"></i>
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
                                        className="btn btn-lg btn-primary"
                                        onClick={() => handleAbrirModalEdicion(detalleModal.reserva)}
                                    >
                                        <i className="bi bi-pencil-square me-2"></i>
                                        Editar Reserva
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                </Modal>
            )}

            {/* Modal de edición de reserva */}
            {editModal.reserva && (
                <Modal
                    isOpen={editModal.isOpen}
                    onClose={() => setEditModal({ isOpen: false, reserva: null })}
                    title={`Editar Reserva #${editModal.reserva.id}`}
                    size="lg"
                >
                    <form onSubmit={handleEditarReserva}>
                        <div className="row g-3">
                            {/* Fecha */}
                            <div className="col-md-6">
                                <label htmlFor="edit-fecha" className="form-label fw-semibold">
                                    Fecha <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="date"
                                    className="form-control"
                                    id="edit-fecha"
                                    value={formData.fecha_reserva}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                    onChange={(e) => {
                                        setFormData({ ...formData, fecha_reserva: e.target.value, hora_inicio: '' });
                                        handleCargarHorasDisponibles(e.target.value, formData.num_personas);
                                    }}
                                />
                            </div>

                            {/* Número de Personas */}
                            <div className="col-md-6">
                                <label htmlFor="edit-personas" className="form-label fw-semibold">
                                    Número de Personas <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="edit-personas"
                                    value={formData.num_personas}
                                    min="1"
                                    max="50"
                                    required
                                    onChange={(e) => {
                                        setFormData({ ...formData, num_personas: parseInt(e.target.value), hora_inicio: '' });
                                        if (formData.fecha_reserva) {
                                            handleCargarHorasDisponibles(formData.fecha_reserva, parseInt(e.target.value));
                                        }
                                    }}
                                />
                            </div>

                            {/* Hora */}
                            <div className="col-md-6">
                                <label htmlFor="edit-hora" className="form-label fw-semibold">
                                    Hora de la Reserva <span className="text-danger">*</span>
                                </label>
                                <select
                                    className="form-select"
                                    id="edit-hora"
                                    value={formData.hora_inicio}
                                    required
                                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                                >
                                    <option value="">Seleccione una hora</option>
                                    {horasDisponibles.map((hora) => (
                                        <option key={hora} value={hora}>
                                            {hora} hrs
                                        </option>
                                    ))}
                                </select>
                                {horasDisponibles.length === 0 && formData.fecha_reserva && (
                                    <div className="form-text text-warning">
                                        <i className="bi bi-exclamation-triangle me-1"></i>
                                        No hay horas disponibles para esta fecha y número de personas
                                    </div>
                                )}
                            </div>

                            {/* Mesa */}
                            <div className="col-md-6">
                                <label htmlFor="edit-mesa" className="form-label fw-semibold">
                                    Mesa <span className="text-danger">*</span>
                                </label>
                                <select
                                    className="form-select"
                                    id="edit-mesa"
                                    value={formData.mesa}
                                    required
                                    onChange={(e) => setFormData({ ...formData, mesa: parseInt(e.target.value) })}
                                >
                                    <option value="">Seleccione una mesa</option>
                                    {mesasDisponibles
                                        .filter((mesa) => mesa.capacidad >= formData.num_personas)
                                        .map((mesa) => (
                                            <option key={mesa.id} value={mesa.numero}>
                                                Mesa {mesa.numero} (Capacidad: {mesa.capacidad} personas)
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* Notas */}
                            <div className="col-12">
                                <label htmlFor="edit-notas" className="form-label fw-semibold">
                                    Notas Especiales
                                </label>
                                <textarea
                                    className="form-control"
                                    id="edit-notas"
                                    rows="3"
                                    placeholder="Ej: Alergia a los frutos secos, silla para bebé, etc."
                                    value={formData.notas}
                                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setEditModal({ isOpen: false, reserva: null })}
                                disabled={loadingEdit}
                            >
                                <i className="bi bi-x-circle me-2"></i>
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loadingEdit || horasDisponibles.length === 0}
                            >
                                {loadingEdit ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-lg me-2"></i>
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
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
