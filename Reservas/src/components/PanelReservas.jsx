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
import { Dropdown } from 'react-bootstrap';

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

    const initialFecha = savedFilters?.fecha !== undefined
        ? savedFilters.fecha
        : (showAllReservations ? '' : new Date().toISOString().slice(0, 10));
    const initialAutoRefresh = !showAllReservations && initialFecha === new Date().toISOString().slice(0, 10);
    const [fecha, setFecha] = useState(initialFecha);
    const defaultFechaInicio = () => {
        const today = new Date();
        today.setDate(today.getDate() - 30);
        return today.toISOString().slice(0, 10);
    };

    const initialFechaInicio = savedFilters?.fechaInicio !== undefined
        ? savedFilters.fechaInicio
        : (showAllReservations ? defaultFechaInicio() : '');
    const initialFechaFin = savedFilters?.fechaFin || '';
    const initialEstadoFiltro = savedFilters?.estadoFiltro || "TODOS";
    const initialSearchAllHistory = savedFilters?.searchAllHistory || false;

    const [fechaInicio, setFechaInicio] = useState(initialFechaInicio);
    const [fechaFin, setFechaFin] = useState(initialFechaFin);
    const [estadoFiltro, setEstadoFiltro] = useState(initialEstadoFiltro);
    const [busqueda, setBusqueda] = useState(savedFilters?.busqueda || "");

    // Advanced search state
    const [searchHora, setSearchHora] = useState(savedFilters?.searchHora || "");
    const [searchPersonasMin, setSearchPersonasMin] = useState(savedFilters?.searchPersonasMin || "");
    const [searchPersonasMax, setSearchPersonasMax] = useState(savedFilters?.searchPersonasMax || "");
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [searchAllHistory, setSearchAllHistory] = useState(initialSearchAllHistory);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(savedFilters?.itemsPerPage || 10);

    // Auto-refresh state (automático para el día actual)
    const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
    const [autoRefreshManuallyToggled, setAutoRefreshManuallyToggled] = useState(false);
    const [refreshInterval] = useState(30); // seconds - fijo en 30 segundos
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
    const [listLayout, setListLayout] = useState('table'); // 'table' or 'cards'

    // Calendar view state
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [lastUpdated, setLastUpdated] = useState(null);

    // Autocomplete state
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const autocompleteRef = useRef(null);
    const searchInputRef = useRef(null);

    // Bulk selection state
    const [selectedReservations, setSelectedReservations] = useState([]);

    // Edit modal state
    const [editModal, setEditModal] = useState({ isOpen: false, reserva: null, loading: false });
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

    // Caché de mesas para optimizar carga del modal de edición
    const [mesasCache, setMesasCache] = useState(null);
    const [mesasCacheTimestamp, setMesasCacheTimestamp] = useState(null);

    const trimmedBusqueda = busqueda.trim();
    const isSearchingByName = trimmedBusqueda !== '';
    const historialActivo = searchAllHistory && isSearchingByName && !showAllReservations;

    // Función para cargar reservas (reutilizable)
    const cargarReservas = async () => {
        try {
            setLoading(true);
            setError("");
            const filtros = {};

            // Date range mode (for showAllReservations OR when range is set in normal mode)
            if (showAllReservations || (fechaInicio || fechaFin)) {
                if (fechaInicio) filtros.fecha_inicio = fechaInicio;
                if (fechaFin) filtros.fecha_fin = fechaFin;
            } else if (fecha && !isSearchingByName) {
                // Single date mode - only if NOT searching by name and NO range set
                filtros.fecha = fecha;
            }

            if (estadoFiltro && estadoFiltro !== "TODOS") {
                filtros.estado = estadoFiltro.toLowerCase();
            }

            // Agregar búsqueda por cliente (nombre, email, username)
            if (isSearchingByName) {
                filtros.search = trimmedBusqueda;
                // Apply searchAllHistory flag when searching
                if (searchAllHistory && !showAllReservations) {
                    filtros.all = 'true';
                }
                // Otherwise backend will auto-limit to 7 days + future reservations
            }

            const data = await getReservas(filtros);
            setReservas(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar las reservas.");
        } finally {
            setLoading(false);
        }
    };

    // Función para obtener sugerencias de autocompletado
    const fetchAutocompleteSuggestions = async (searchTerm) => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }

        try {
            // Buscar reservas que coincidan con el término de búsqueda
            const filtros = {
                search: searchTerm.trim(),
                all: 'true', // Buscar en todo el historial
                page_size: 5
            };

            if (estadoFiltro && estadoFiltro !== "TODOS") {
                filtros.estado = estadoFiltro.toLowerCase();
            }

            const data = await getReservas(filtros, { fetchAllPages: false });

            // Extraer clientes únicos de las reservas
            const clientesMap = new Map();
            data.forEach(reserva => {
                const key = reserva.cliente_email || reserva.cliente;
                if (!clientesMap.has(key)) {
                    clientesMap.set(key, {
                        nombre: reserva.cliente,
                        email: reserva.cliente_email,
                        telefono: reserva.cliente_telefono
                    });
                }
            });

            const suggestions = Array.from(clientesMap.values());
            setAutocompleteSuggestions(suggestions);
            setShowAutocomplete(suggestions.length > 0);
            setSelectedSuggestionIndex(-1);
        } catch (err) {
            console.error('Error fetching autocomplete suggestions:', err);
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
        }
    };

    // Cargar reservas al cambiar filtros relevantes
    useEffect(() => {
        cargarReservas();
        setCurrentPage(1); // Reset to first page on date change
    }, [fecha, fechaInicio, fechaFin, showAllReservations, searchAllHistory, estadoFiltro]);

    // Debounced search: Esperar 300ms después de que el usuario deje de escribir
    useEffect(() => {
        const timer = setTimeout(() => {
            cargarReservas();
            setCurrentPage(1); // Reset to first page on search
        }, 300);

        return () => clearTimeout(timer);
    }, [busqueda]);

    // Debounced autocomplete: Fetch suggestions as user types
    useEffect(() => {
        const timer = setTimeout(() => {
            if (busqueda && busqueda.trim().length >= 2) {
                fetchAutocompleteSuggestions(busqueda);
            } else {
                setShowAutocomplete(false);
                setAutocompleteSuggestions([]);
            }
        }, 200); // Faster response for autocomplete

        return () => clearTimeout(timer);
    }, [busqueda]);

    // Click outside to close autocomplete
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                autocompleteRef.current &&
                !autocompleteRef.current.contains(event.target) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target)
            ) {
                setShowAutocomplete(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Pre-cargar caché de mesas al montar componente (optimización)
    useEffect(() => {
        const precargarMesas = async () => {
            try {
                const mesas = await getMesas();
                setMesasCache(mesas);
                setMesasCacheTimestamp(Date.now());
            } catch (error) {
                console.error('Error al pre-cargar mesas:', error);
                // No mostramos error al usuario, el caché es opcional
            }
        };
        precargarMesas();
    }, []); // Solo al montar

    // Auto-activar refresh para el día actual
    useEffect(() => {
        if (showAllReservations) {
            setAutoRefresh(false);
            setAutoRefreshManuallyToggled(false);
            return;
        }

        const hoy = new Date().toISOString().slice(0, 10);
        const esDiaActual = fecha === hoy;

        if (!esDiaActual) {
            setAutoRefresh(false);
            setAutoRefreshManuallyToggled(false);
        } else if (!autoRefreshManuallyToggled) {
            setAutoRefresh(true);
        }
    }, [fecha, showAllReservations, autoRefreshManuallyToggled]);

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
            searchAllHistory,
            fechaInicio,
            fechaFin,
            itemsPerPage,
            sortField,
            sortDirection
        };
        sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    }, [fecha, fechaInicio, fechaFin, estadoFiltro, busqueda, searchHora, searchPersonasMin, searchPersonasMax, searchAllHistory, itemsPerPage, sortField, sortDirection, isBrowser, FILTERS_STORAGE_KEY]);

    // Handle window resize for mobile view
    useEffect(() => {
        if (!isBrowser) return;
        const handleResize = () => {
            setIsMobileView(window.innerWidth < 992); // Cambiar de 768px (md) a 992px (lg)
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isBrowser]);

    useEffect(() => {
        if (isMobileView) {
            setListLayout('cards');
        }
    }, [isMobileView]);

    // Filtro por estado y búsqueda avanzada (búsqueda por cliente ahora en backend)
    const reservasFiltradas = useMemo(() => {
        let filtered = reservas.filter((r) => {
            const coincideEstado =
                estadoFiltro === "TODOS" || r.estado === estadoFiltro;

            // Advanced search filters
            const coincideHora = !searchHora || (r.hora && r.hora.includes(searchHora));

            const coincidePersonasMin = !searchPersonasMin ||
                (r.personas && r.personas >= parseInt(searchPersonasMin));

            const coincidePersonasMax = !searchPersonasMax ||
                (r.personas && r.personas <= parseInt(searchPersonasMax));

            return coincideEstado && coincideHora &&
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

                if (sortField === 'fecha') {
                    aVal = aVal ? new Date(`${aVal}T00:00:00`).getTime() : 0;
                    bVal = bVal ? new Date(`${bVal}T00:00:00`).getTime() : 0;
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [reservas, estadoFiltro, searchHora, searchPersonasMin, searchPersonasMax, sortField, sortDirection]);

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
        setSearchAllHistory(false);
        setSortField(null);
        setSortDirection('asc');
        setCurrentPage(1);
    };

    const toggleAutoRefresh = () => {
        setAutoRefresh(prev => !prev);
        setAutoRefreshManuallyToggled(true);
    };

    const handleSearchAllHistoryChange = (checked) => {
        setSearchAllHistory(checked);
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

    // Autocomplete handlers
    const handleSuggestionClick = (suggestion) => {
        setBusqueda(suggestion.nombre);
        setShowAutocomplete(false);
        setSelectedSuggestionIndex(-1);
    };

    const handleSearchKeyDown = (e) => {
        if (!showAutocomplete || autocompleteSuggestions.length === 0) {
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0) {
                    handleSuggestionClick(autocompleteSuggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowAutocomplete(false);
                setSelectedSuggestionIndex(-1);
                break;
            default:
                break;
        }
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

    const formatearFechaCorta = (fechaStr) => {
        if (!fechaStr) return '';
        return new Date(`${fechaStr}T00:00:00`).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

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

            // Inicializar el formulario con los datos actuales de la reserva
            const formInitial = {
                fecha_reserva: reserva.fecha,
                hora_inicio: reserva.hora,
                mesa: numeroMesa,
                num_personas: reserva.personas,
                notas: reserva.notas || ''
            };
            setFormData(formInitial);

            // 1. Abrir modal INMEDIATAMENTE con loading state
            setEditModal({ isOpen: true, reserva, loading: true });
            setDetalleModal({ isOpen: false, reserva: null });
            setLoadingEdit(true);

            // 2. Verificar caché de mesas (5 minutos de validez)
            const CACHE_VALIDITY_MS = 5 * 60 * 1000;
            const cacheValido = mesasCache && mesasCacheTimestamp &&
                (Date.now() - mesasCacheTimestamp < CACHE_VALIDITY_MS);

            // 3. Ejecutar llamadas en PARALELO para optimizar rendimiento
            const [mesasData, horasData] = await Promise.all([
                cacheValido ? Promise.resolve(mesasCache) : getMesas(),
                getHorasDisponibles({ fecha: reserva.fecha, personas: reserva.personas })
            ]);

            // 4. Actualizar caché si se cargaron mesas nuevas
            if (!cacheValido) {
                setMesasCache(mesasData);
                setMesasCacheTimestamp(Date.now());
            }

            // 5. Actualizar estados con datos cargados
            setMesasDisponibles(mesasData);
            setHorasDisponibles(horasData.horas_disponibles || []);

            // 6. Quitar loading state
            setEditModal({ isOpen: true, reserva, loading: false });
            setLoadingEdit(false);

        } catch (err) {
            console.error('Error al abrir modal de edición:', err);
            toast.error('Error al cargar datos para edición');
            setEditModal({ isOpen: false, reserva: null, loading: false });
            setLoadingEdit(false);
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

        // Admin y Cajero - Dropdown menu para cambiar estados
        if (rolActual === "admin" || rolActual === "cajero") {
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
                <Dropdown align="end">
                    <Dropdown.Toggle variant="outline-primary" size="sm" id={`dropdown-${reserva.id}`}>
                        <i className="bi bi-gear me-1"></i>
                        Acciones
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                        {estadosDisponibles.map((estado) => (
                            <Dropdown.Item
                                key={estado.value}
                                onClick={() => handleCambiarEstado(reserva.id, estado.value)}
                            >
                                <i className={`bi ${estado.icon} me-2 text-${estado.color}`}></i>
                                Cambiar a {estado.label}
                            </Dropdown.Item>
                        ))}
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={() => setDetalleModal({ isOpen: true, reserva })}>
                            <i className="bi bi-eye me-2"></i>
                            Ver detalle
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            );
        }

        return null;
    }

    // Bulk selection handlers
    const handleSelectReservation = (reservaId) => {
        setSelectedReservations(prev => {
            if (prev.includes(reservaId)) {
                return prev.filter(id => id !== reservaId);
            } else {
                return [...prev, reservaId];
            }
        });
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const allIds = reservasPaginadas.map(r => r.id);
            setSelectedReservations(allIds);
        } else {
            setSelectedReservations([]);
        }
    };

    const handleClearSelection = () => {
        setSelectedReservations([]);
    };

    // Bulk state change handler
    async function handleBulkStateChange(nuevoEstado) {
        if (selectedReservations.length === 0) return;

        const ejecutarCambioMasivo = async () => {
            const errors = [];
            let successCount = 0;

            for (const id of selectedReservations) {
                try {
                    setLoadingRows(prev => ({ ...prev, [id]: true }));
                    await updateEstadoReserva({ id, nuevoEstado });

                    setReservas((prev) =>
                        prev.map((r) =>
                            r.id === id ? { ...r, estado: nuevoEstado } : r
                        )
                    );
                    successCount++;
                } catch (err) {
                    console.error(`Error updating reservation ${id}:`, err);
                    errors.push(id);
                } finally {
                    setLoadingRows(prev => {
                        const newState = { ...prev };
                        delete newState[id];
                        return newState;
                    });
                }
            }

            // Clear selection after successful updates
            setSelectedReservations([]);

            // Show results
            if (successCount > 0) {
                toast.success(`${successCount} reserva(s) actualizada(s) a ${nuevoEstado.toUpperCase()}`);
            }
            if (errors.length > 0) {
                toast.error(`${errors.length} reserva(s) fallaron al actualizarse`);
            }
        };

        // Destructive actions require confirmation
        const estadosDestructivos = ['cancelada', 'completada'];
        if (estadosDestructivos.includes(nuevoEstado.toLowerCase())) {
            const mensajesConfirmacion = {
                cancelada: `¿Está seguro de que desea cancelar ${selectedReservations.length} reserva(s)? Esta acción no se puede deshacer.`,
                completada: `¿Confirma que desea marcar ${selectedReservations.length} reserva(s) como completadas?`
            };

            setConfirmModal({
                isOpen: true,
                title: `Confirmar cambio masivo a ${nuevoEstado.toUpperCase()}`,
                message: mensajesConfirmacion[nuevoEstado.toLowerCase()] || `¿Está seguro de cambiar ${selectedReservations.length} reserva(s)?`,
                onConfirm: async () => {
                    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
                    await ejecutarCambioMasivo();
                }
            });
        } else {
            await ejecutarCambioMasivo();
        }
    }

    // Clear selection when filters change
    useEffect(() => {
        setSelectedReservations([]);
    }, [fecha, fechaInicio, fechaFin, estadoFiltro, busqueda, currentPage]);

    function renderEstadoBadge(reserva) {
        const isLoading = loadingRows[reserva.id];

        // Para Admin y Cajero: Badge clickeable con dropdown
        if (rolActual === "admin" || rolActual === "cajero") {
            const estados = [
                { label: "ACTIVA", value: "activa", icon: "bi-check-circle", color: "success" },
                { label: "PENDIENTE", value: "pendiente", icon: "bi-clock", color: "warning" },
                { label: "COMPLETADA", value: "completada", icon: "bi-check-all", color: "info" },
                { label: "CANCELADA", value: "cancelada", icon: "bi-x-circle", color: "danger" }
            ];

            const estadosDisponibles = estados.filter((e) => e.label !== reserva.estado);

            if (isLoading) {
                return (
                    <span className={`estado-badge estado-${reserva.estado}`}>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        {reserva.estado}
                    </span>
                );
            }

            return (
                <div className="dropdown">
                    <span
                        className={`estado-badge estado-${reserva.estado}`}
                        style={{ cursor: 'pointer' }}
                        role="button"
                        id={`estado-dropdown-${reserva.id}`}
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                        title="Click para cambiar estado"
                    >
                        {reserva.estado}
                        <i className="bi bi-chevron-down ms-1" style={{ fontSize: '0.75rem' }}></i>
                    </span>
                    <ul className="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby={`estado-dropdown-${reserva.id}`}>
                        <li className="dropdown-header">Cambiar a:</li>
                        {estadosDisponibles.map((estado) => (
                            <li key={estado.value}>
                                <button
                                    className="dropdown-item d-flex align-items-center"
                                    onClick={() => handleCambiarEstado(reserva.id, estado.value)}
                                >
                                    <i className={`bi ${estado.icon} me-2 text-${estado.color}`}></i>
                                    <span>{estado.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }

        // Para otros roles: Badge simple sin interacción
        return (
            <span className={`estado-badge estado-${reserva.estado}`}>
                {reserva.estado}
            </span>
        );
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
    const isDateFilterDisabled = Boolean(fechaInicio || fechaFin || historialActivo);
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

    const estadoChips = [
        { value: 'TODOS', label: 'Todos', icon: 'bi-hypnotize', tone: 'secondary' },
        { value: 'ACTIVA', label: 'Activa', icon: 'bi-lightning-charge', tone: 'success' },
        { value: 'PENDIENTE', label: 'Pendiente', icon: 'bi-hourglass-split', tone: 'warning' },
        { value: 'CANCELADA', label: 'Cancelada', icon: 'bi-x-octagon', tone: 'danger' },
        { value: 'COMPLETADA', label: 'Completada', icon: 'bi-check2-circle', tone: 'info' }
    ];

    const searchScope = useMemo(() => {
        if (!isSearchingByName) return null;
        if (historialActivo) return 'en todo el historial';
        if (fechaInicio || fechaFin) {
            return `entre ${fechaInicio || 'inicio'} y ${fechaFin || 'hoy'}`;
        }
        if (fecha) {
            return `el ${formatearFechaCorta(fecha)}`;
        }
        return 'en los últimos 7 días';
    }, [isSearchingByName, historialActivo, fechaInicio, fechaFin, fecha]);

    const searchSummaryDescription = useMemo(() => {
        if (!isSearchingByName || !searchScope) return null;
        return `Mostrando coincidencias para "${trimmedBusqueda}" ${searchScope}`;
    }, [isSearchingByName, trimmedBusqueda, searchScope]);

    const noResultsMessage = useMemo(() => {
        if (loading || reservasFiltradas.length > 0) return null;
        if (isSearchingByName && searchScope) {
            return `Sin reservas para "${trimmedBusqueda}" ${searchScope}.`;
        }
        return 'No hay reservas que coincidan con los filtros seleccionados.';
    }, [loading, reservasFiltradas.length, isSearchingByName, trimmedBusqueda, searchScope]);

    const lastUpdatedLabel = lastUpdated
        ? lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        : null;
    const lastUpdatedText = lastUpdatedLabel
        ? `Actualizado a las ${lastUpdatedLabel}`
        : 'Aún sin actualización manual';
    const puedeCrearReserva = rolActual === 'admin' || rolActual === 'cajero' || rolActual === 'mesero';
    const tituloSeccion = viewMode === 'calendar'
        ? 'Calendario de reservas'
        : showAllReservations
            ? 'Historial de reservas'
            : 'Reservas del día';

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
            <div className="card border-0 shadow-sm mb-4 panel-controls glass-panel">
                <div className="card-body">
                    {/* Date Navigation and View Toggle */}
                    <div className="d-flex flex-column flex-md-row flex-wrap justify-content-md-between align-items-start align-items-md-center mb-3 pb-3 border-bottom gap-3">
                        <div className="d-flex align-items-center gap-2 flex-wrap w-100 w-md-auto">
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

                        <div className="d-flex flex-wrap align-items-center gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
                            <div className={`auto-refresh-pill ${autoRefresh ? 'active' : ''}`}>
                                <div className="form-check form-switch form-check-reverse small m-0">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="auto-refresh-switch"
                                        checked={autoRefresh}
                                        onChange={toggleAutoRefresh}
                                    />
                                    <label className="form-check-label" htmlFor="auto-refresh-switch">
                                        Auto-refresh {autoRefresh ? '(on)' : '(off)'}
                                    </label>
                                </div>
                                <small className="text-muted d-block">{lastUpdatedText}</small>
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

                            {viewMode === 'list' && !isMobileView && (
                                <div className="btn-group btn-group-sm" role="group">
                                    <button
                                        type="button"
                                        className={`btn ${listLayout === 'cards' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setListLayout('cards')}
                                    >
                                        <i className="bi bi-grid-3x3-gap me-1"></i>
                                        Tarjetas
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${listLayout === 'table' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setListLayout('table')}
                                    >
                                        <i className="bi bi-table me-1"></i>
                                        Tabla
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2 mb-3">
                        {estadoChips.map((chip) => (
                            <button
                                key={chip.value}
                                type="button"
                                className={`filter-chip ${estadoFiltro === chip.value ? 'filter-chip--active' : ''}`}
                                onClick={() => setEstadoFiltro(chip.value)}
                            >
                                <i className={`bi ${chip.icon} me-1`}></i>
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    <div className="row g-3 mb-3">
                        {!showAllReservations ? (
                            <div className="col-md-6 col-lg-3">
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
                                    disabled={isDateFilterDisabled}
                                    style={isDateFilterDisabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                />
                                <small className="text-muted">
                                    {historialActivo ? (
                                        <span className="text-info">
                                            <i className="bi bi-database me-1"></i>
                                            Historial completo activo (se ignoran los filtros de fecha)
                                        </span>
                                    ) : (fechaInicio || fechaFin) ? (
                                        <span className="text-warning">
                                            <i className="bi bi-info-circle me-1"></i>
                                            Rango de fechas activo (ver búsqueda avanzada)
                                        </span>
                                    ) : (
                                        fechaLegible
                                    )}
                                </small>
                            </div>
                        ) : (
                            <>
                                <div className="col-md-6 col-lg-2">
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
                                <div className="col-md-6 col-lg-2">
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

                        <div className="col-md-6 col-lg-2">
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

                        <div className={`col-md-12 ${showAllReservations ? 'col-lg-4' : 'col-lg-5'}`}>
                            <label
                                htmlFor="filtro-busqueda"
                                className="form-label small"
                            >
                                Buscar cliente
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    id="filtro-busqueda"
                                    className="form-control form-control-sm"
                                    placeholder="Buscar por nombre, email o usuario..."
                                    value={busqueda}
                                    onChange={(e) => {
                                        setBusqueda(e.target.value);
                                    }}
                                    onKeyDown={handleSearchKeyDown}
                                    onFocus={() => {
                                        if (busqueda && busqueda.trim().length >= 2 && autocompleteSuggestions.length > 0) {
                                            setShowAutocomplete(true);
                                        }
                                    }}
                                    autoComplete="off"
                                />

                                {/* Autocomplete dropdown */}
                                {showAutocomplete && autocompleteSuggestions.length > 0 && (
                                            <div
                                                ref={autocompleteRef}
                                                style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    right: 0,
                                                    backgroundColor: 'white',
                                                    border: '1px solid #dee2e6',
                                                    borderRadius: '0.25rem',
                                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                                    zIndex: 1000,
                                                    maxHeight: '400px',
                                                    overflowY: 'auto',
                                                    marginTop: '2px'
                                                }}
                                            >
                                                {autocompleteSuggestions.map((suggestion, index) => (
                                                    <div
                                                        key={index}
                                                        onClick={() => handleSuggestionClick(suggestion)}
                                                        style={{
                                                            padding: '10px 12px',
                                                            cursor: 'pointer',
                                                            backgroundColor: selectedSuggestionIndex === index ? '#e9ecef' : 'white',
                                                            borderBottom: index < autocompleteSuggestions.length - 1 ? '1px solid #f1f3f5' : 'none',
                                                            transition: 'background-color 0.15s ease'
                                                        }}
                                                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                                                    >
                                                        <div style={{ fontWeight: 500, color: '#212529', marginBottom: '2px' }}>
                                                            <i className="bi bi-person-circle me-2 text-primary"></i>
                                                            {suggestion.nombre}
                                                        </div>
                                                        {suggestion.email && (
                                                            <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                                                <i className="bi bi-envelope me-2"></i>
                                                                {suggestion.email}
                                                            </div>
                                                        )}
                                                        {suggestion.telefono && (
                                                            <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                                                <i className="bi bi-telephone me-2"></i>
                                                                {suggestion.telefono}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                            </div>
                            {/* FIX: Make search scope checkbox visible */}
                            {!showAllReservations && (
                                <div className="form-check mt-1">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="search-all-history-inline"
                                        checked={searchAllHistory}
                                        onChange={(e) => setSearchAllHistory(e.target.checked)}
                                    />
                                    <label className="form-check-label small text-muted" htmlFor="search-all-history-inline">
                                        <i className="bi bi-database me-1"></i>
                                        Buscar en todo el historial
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="col-md-6 col-lg-2">
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

                    {/* Show range badge in normal mode when date range is active */}
                    {!showAllReservations && (fechaInicio || fechaFin) && (
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-2 border-bottom">
                            <span className="badge rounded-pill badge-soft-info">
                                <i className="bi bi-funnel me-1"></i>
                                Rango activo: {fechaInicio || 'inicio'} → {fechaFin || 'hoy'}
                            </span>
                            <button
                                className="btn btn-link btn-sm p-0"
                                onClick={() => {
                                    setFechaInicio('');
                                    setFechaFin('');
                                }}
                            >
                                <i className="bi bi-x-circle me-1"></i>
                                Limpiar rango
                            </button>
        </div>
                    )}

                    {/* Manual refresh button */}
                    <div className="d-flex flex-column flex-sm-row justify-content-sm-end align-items-sm-center gap-2 pt-2 border-top">
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={cargarReservas}
                            disabled={loading}
                        >
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Actualizar ahora
                        </button>
                        <small className="text-muted">{lastUpdatedText}</small>
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
                            <div className="mt-2 p-2 bg-light rounded">
                                <div className="row g-2">
                                    {/* Global search checkbox - compact version */}
                                    {!showAllReservations && (
                                        <div className="col-12">
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="search-all-history"
                                                    checked={searchAllHistory}
                                                    onChange={(e) => handleSearchAllHistoryChange(e.target.checked)}
                                                />
                                                <label className="form-check-label small" htmlFor="search-all-history">
                                                    <i className="bi bi-database me-1"></i>
                                                    <strong>Buscar en todo el historial</strong>
                                                    <span className="text-muted ms-1">(últimos 7 días por defecto)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Date Range Filter - Compact version */}
                                    {!showAllReservations && (
                                        <>
                                            <div className="col-md-3">
                                                <label htmlFor="advanced-fecha-inicio" className="form-label small mb-1">
                                                    <i className="bi bi-calendar-range me-1"></i>Fecha desde
                                                </label>
                                                <input
                                                    type="date"
                                                    id="advanced-fecha-inicio"
                                                    className="form-control form-control-sm"
                                                    value={fechaInicio}
                                                    onChange={(e) => setFechaInicio(e.target.value)}
                                                    disabled={historialActivo}
                                                    style={historialActivo ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <label htmlFor="advanced-fecha-fin" className="form-label small mb-1">
                                                    <i className="bi bi-calendar-range me-1"></i>Fecha hasta
                                                </label>
                                                <input
                                                    type="date"
                                                    id="advanced-fecha-fin"
                                                    className="form-control form-control-sm"
                                                    value={fechaFin}
                                                    min={fechaInicio || undefined}
                                                    onChange={(e) => setFechaFin(e.target.value)}
                                                    disabled={historialActivo}
                                                    style={historialActivo ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {historialActivo && (
                                        <div className="col-12">
                                            <small className="text-info">
                                                Mientras el historial completo esté activo se ignorarán los filtros de fecha.
                                            </small>
                                        </div>
                                    )}

                                    <div className="col-md-2">
                                        <label htmlFor="search-hora" className="form-label small mb-1">
                                            <i className="bi bi-clock me-1"></i>Hora
                                        </label>
                                        <input
                                            type="time"
                                            id="search-hora"
                                            className="form-control form-control-sm"
                                            value={searchHora}
                                            onChange={(e) => setSearchHora(e.target.value)}
                                        />
                                    </div>

                                    <div className="col-md-2">
                                        <label htmlFor="search-personas-min" className="form-label small mb-1">
                                            <i className="bi bi-people me-1"></i>Pers. mín
                                        </label>
                                        <input
                                            type="number"
                                            id="search-personas-min"
                                            className="form-control form-control-sm"
                                            min="1"
                                            value={searchPersonasMin}
                                            onChange={(e) => setSearchPersonasMin(e.target.value)}
                                            placeholder="Min"
                                        />
                                    </div>

                                    <div className="col-md-2">
                                        <label htmlFor="search-personas-max" className="form-label small mb-1">
                                            <i className="bi bi-people me-1"></i>Pers. máx
                                        </label>
                                        <input
                                            type="number"
                                            id="search-personas-max"
                                            className="form-control form-control-sm"
                                            min="1"
                                            value={searchPersonasMax}
                                            onChange={(e) => setSearchPersonasMax(e.target.value)}
                                            placeholder="Max"
                                        />
                                    </div>

                                    <div className="col-12 mt-2">
                                        <button
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={clearAllFilters}
                                        >
                                            <i className="bi bi-x-circle me-1"></i>
                                            Limpiar filtros
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Actions Toolbar - Fixed at bottom when items are selected */}
            {selectedReservations.length > 0 && (rolActual === "admin" || rolActual === "cajero") && (
                <div
                    className="position-fixed bottom-0 start-50 translate-middle-x bg-primary text-white shadow-lg rounded-top-3 px-4 py-3 d-flex align-items-center gap-3"
                    style={{ zIndex: 1050, minWidth: '400px', maxWidth: '90vw' }}
                >
                    <div className="d-flex align-items-center gap-2 flex-grow-1">
                        <i className="bi bi-check-circle-fill fs-5"></i>
                        <span className="fw-semibold">
                            {selectedReservations.length} reserva(s) seleccionada(s)
                        </span>
                    </div>

                    <div className="btn-group" role="group">
                        <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={() => handleBulkStateChange('activa')}
                            title="Cambiar a ACTIVA"
                        >
                            <i className="bi bi-check-circle me-1"></i>
                            Activa
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={() => handleBulkStateChange('pendiente')}
                            title="Cambiar a PENDIENTE"
                        >
                            <i className="bi bi-clock me-1"></i>
                            Pendiente
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={() => handleBulkStateChange('completada')}
                            title="Cambiar a COMPLETADA"
                        >
                            <i className="bi bi-check-all me-1"></i>
                            Completada
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleBulkStateChange('cancelada')}
                            title="Cambiar a CANCELADA"
                        >
                            <i className="bi bi-x-circle me-1"></i>
                            Cancelar
                        </button>
                    </div>

                    <button
                        type="button"
                        className="btn btn-sm btn-outline-light"
                        onClick={handleClearSelection}
                        title="Limpiar selección"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
            )}

            {/* Tabla de reservas */}
            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-2">
                        <div>
                            <h2 className="h6 mb-0">{tituloSeccion}</h2>
                            <small className="text-muted">
                                {showAllReservations
                                    ? 'Mostrando según los filtros aplicados'
                                    : fechaLegible}
                            </small>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            {puedeCrearReserva && (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    aria-label="Crear nueva reserva"
                                    title="Crear nueva reserva"
                                    onClick={() => setActiveTab('nueva-reserva')}
                                >
                                    <i className="bi bi-plus-circle me-1"></i>
                                    Crear reserva
                                </button>
                            )}
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

                    {searchSummaryDescription && (
                        <div className="alert alert-light border-start border-primary py-2 px-3 small mb-3">
                            <i className="bi bi-search me-1"></i>
                            {searchSummaryDescription}
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-danger py-2 small">{error}</div>
                    )}

                    {noResultsMessage && (
                        <div className="alert alert-info py-2 small">{noResultsMessage}</div>
                    )}

                    {/* Calendar View */}
                    {viewMode === 'calendar' ? (
                        <CalendarioMensual
                            fechaSeleccionada={fecha}
                            onDiaClick={handleDiaClick}
                            onCrearReserva={() => puedeCrearReserva && setActiveTab('nueva-reserva')}
                        />
                    ) : (
                        /* List View */
                        <>
                            {loading ? (
                                <div className="row g-3">
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div className="col-12 col-lg-6" key={idx}>
                                            <div className="card p-3 skeleton-card">
                                                <div className="placeholder-glow">
                                                    <span className="placeholder col-4"></span>
                                                </div>
                                                <div className="placeholder-glow mt-2">
                                                    <span className="placeholder col-8"></span>
                                                </div>
                                                <div className="placeholder-glow mt-3">
                                                    <span className="placeholder col-12"></span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                (isMobileView || listLayout === 'cards') ? (
                                    <div className="row g-3">
                                        {reservasPaginadas.map((reserva, index) => {
                                            const numeroGlobal = (currentPage - 1) * itemsPerPage + index + 1;
                                            const isLoading = loadingRows[reserva.id];
                                            const isSelected = selectedReservations.includes(reserva.id);
                                            const estadoClass = (reserva.estado || '').toLowerCase();

                                            return (
                                                <div className="col-12 col-lg-6" key={reserva.id}>
                                                    <div className={`card reserva-card h-100 border-0 shadow-sm reserva-card--${estadoClass} ${isSelected ? 'reserva-card--selected' : ''}`}>
                                                        <div className="card-body p-3">
                                                            <div className="d-flex justify-content-between align-items-start">
                                                                <div className="d-flex align-items-start gap-2">
                                                                    {(rolActual === "admin" || rolActual === "cajero") && (
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input mt-1"
                                                                            checked={isSelected}
                                                                            onChange={() => handleSelectReservation(reserva.id)}
                                                                        />
                                                                    )}
                                                                    <div>
                                                                        <div className="small text-muted text-uppercase mb-1">
                                                                            #{numeroGlobal} • {formatearFechaCorta(reserva.fecha)}
                                                                        </div>
                                                                        <h6 className="mb-0">{reserva.cliente}</h6>
                                                                        {(reserva.cliente_email || reserva.cliente_telefono) && (
                                                                            <small className="text-muted">
                                                                                {reserva.cliente_email || reserva.cliente_telefono}
                                                                            </small>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {renderEstadoBadge(reserva)}
                                                            </div>

                                                            <div className="reserva-card__timeline mt-3">
                                                                <div className="timeline-point">
                                                                    <span className="timeline-dot timeline-dot--time">
                                                                        <i className="bi bi-clock"></i>
                                                                    </span>
                                                                    <div>
                                                                        <small className="text-muted d-block">Hora</small>
                                                                        <div className="fw-semibold">{formatearHora(reserva.hora)} hrs</div>
                                                                    </div>
                                                                </div>
                                                                <div className="timeline-point">
                                                                    <span className="timeline-dot timeline-dot--table">
                                                                        <i className="bi bi-table"></i>
                                                                    </span>
                                                                    <div>
                                                                        <small className="text-muted d-block">Mesa</small>
                                                                        <div className="fw-semibold">{reserva.mesa}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="timeline-point">
                                                                    <span className="timeline-dot timeline-dot--people">
                                                                        <i className="bi bi-people"></i>
                                                                    </span>
                                                                    <div>
                                                                        <small className="text-muted d-block">Personas</small>
                                                                        <div className="fw-semibold">{reserva.personas}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {reserva.notas && (
                                                                <div className="alert alert-light py-2 px-3 mb-2 border-start border-primary small bg-opacity-50">
                                                                    <i className="bi bi-chat-left-text me-2"></i>
                                                                    {reserva.notas}
                                                                </div>
                                                            )}

                                                            <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                                                                <div className="small text-muted">
                                                                    <i className="bi bi-calendar4-week me-1"></i>
                                                                    {formatearFechaCorta(reserva.fecha)} · Mesa {reserva.mesa}
                                                                </div>
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
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Desktop table view */
                                    <div className="table-responsive d-none d-lg-block" style={{ overflowX: 'auto', overflowY: 'visible' }}>
                                        <table className="table table-hover align-middle" style={{ marginBottom: 0 }}>
                                            <thead>
                                                <tr>
                                                    {(rolActual === "admin" || rolActual === "cajero") && (
                                                        <th style={{ width: '40px' }}>
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                checked={reservasPaginadas.length > 0 && selectedReservations.length === reservasPaginadas.length}
                                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                                title="Seleccionar todas las reservas en esta página"
                                                            />
                                                        </th>
                                                    )}
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
                                                        onClick={() => handleSort('fecha')}
                                                        className="user-select-none"
                                                    >
                                                        Fecha
                                                        {sortField === 'fecha' && (
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
                                                const isSelected = selectedReservations.includes(reserva.id);
                                                return (
                                                    <tr
                                                        key={reserva.id}
                                                        className={isSelected ? 'table-active' : ''}
                                                        style={{ position: 'relative', isolation: 'isolate' }}
                                                    >
                                                        {(rolActual === "admin" || rolActual === "cajero") && (
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    checked={isSelected}
                                                                    onChange={() => handleSelectReservation(reserva.id)}
                                                                />
                                                            </td>
                                                        )}
                                                        <td>{numeroGlobal}</td>
                                                        <td>{reserva.cliente}</td>
                                                        <td>{reserva.mesa}</td>
                                                        <td>{formatearFechaCorta(reserva.fecha)}</td>
                                                        <td>{formatearHora(reserva.hora)} hrs</td>
                                                        <td>{reserva.personas}</td>
                                                        <td>
                                                            {renderEstadoBadge(reserva)}
                                                        </td>
                                                        <td className="text-end">
                                                            {renderAcciones(reserva)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                                {reservasFiltradas.length === 0 && !loading && (
                                                    <tr>
                                                        <td colSpan={(rolActual === "admin" || rolActual === "cajero") ? "9" : "8"} className="text-center text-muted py-4">
                                                            No hay reservas para los filtros seleccionados.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )
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
            {/* Modal de edición de reserva */}
            {editModal.reserva && (
                <Modal
                    isOpen={editModal.isOpen}
                    onClose={() => setEditModal({ isOpen: false, reserva: null, loading: false })}
                    title={`Editar Reserva #${editModal.reserva.id}`}
                    size="lg"
                >
                    {editModal.loading ? (
                        /* Skeleton loading mientras cargan los datos */
                        <div className="p-4">
                            <div className="row g-3 placeholder-glow">
                                <div className="col-md-6">
                                    <div className="placeholder col-4 mb-2" style={{height: '20px'}}></div>
                                    <div className="placeholder col-12" style={{height: '38px'}}></div>
                                </div>
                                <div className="col-md-6">
                                    <div className="placeholder col-6 mb-2" style={{height: '20px'}}></div>
                                    <div className="placeholder col-12" style={{height: '38px'}}></div>
                                </div>
                                <div className="col-md-6">
                                    <div className="placeholder col-5 mb-2" style={{height: '20px'}}></div>
                                    <div className="placeholder col-12" style={{height: '38px'}}></div>
                                </div>
                                <div className="col-md-6">
                                    <div className="placeholder col-3 mb-2" style={{height: '20px'}}></div>
                                    <div className="placeholder col-12" style={{height: '38px'}}></div>
                                </div>
                                <div className="col-12">
                                    <div className="placeholder col-4 mb-2" style={{height: '20px'}}></div>
                                    <div className="placeholder col-12" style={{height: '80px'}}></div>
                                </div>
                            </div>
                            <div className="d-flex justify-content-center align-items-center mt-4 py-3">
                                <div className="spinner-border text-primary me-3" role="status">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                                <span className="text-muted">Cargando datos de la reserva...</span>
                            </div>
                        </div>
                    ) : (
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
                    )}
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
