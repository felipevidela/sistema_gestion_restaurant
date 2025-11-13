import { useEffect, useMemo, useState } from "react";
import { getReservas, updateEstadoReserva } from "../services/reservasApi";

function PanelReservas({ user, onLogout }) {
    // Usar el rol real del usuario autenticado
    const rolActual = user?.rol || "cliente";

    const [reservas, setReservas] = useState([]);

    const [fecha, setFecha] = useState(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
    const [busqueda, setBusqueda] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Cargar reservas con los datos en ReservaApi
    useEffect(() => {
        async function cargar() {
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
        }

        cargar();
    }, [fecha]);

    // Filtro por estado y texto 
    const reservasFiltradas = useMemo(() => {
        return reservas.filter((r) => {
            const coincideEstado =
                estadoFiltro === "TODOS" || r.estado === estadoFiltro;

            const texto = busqueda.toLowerCase();
            const coincideBusqueda =
                !texto ||
                r.cliente.toLowerCase().includes(texto) ||
                r.mesa.toLowerCase().includes(texto);

            return coincideEstado && coincideBusqueda;
        });
    }, [reservas, estadoFiltro, busqueda]);

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

    async function handleCambiarEstado(id, nuevoEstado) {
        try {
            setLoading(true);
            setError("");

            await updateEstadoReserva({ id, nuevoEstado });

            setReservas((prev) =>
                prev.map((r) =>
                    r.id === id ? { ...r, estado: nuevoEstado } : r
                )
            );
        } catch (err) {
            console.error(err);
            setError("No se pudo actualizar el estado de la reserva.");
        } finally {
            setLoading(false);
        }
    }

    
    function renderAcciones(reserva) {
        // Admin
        if (rolActual === "admin") {
            return (
                <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() =>
                        alert(
                            `Detalle de reserva #${reserva.id}\nCliente: ${reserva.cliente}\nMesa: ${reserva.mesa}\nHora: ${reserva.hora}`
                        )
                    }
                >
                    Ver detalle
                </button>
            );
        }

        // Cajero - Mostrar botones para cambiar estados
        if (rolActual === "cajero") {
            const estados = [
                { label: "ACTIVA", value: "activa" },
                { label: "PENDIENTE", value: "pendiente" },
                { label: "COMPLETADA", value: "completada" },
                { label: "CANCELADA", value: "cancelada" }
            ];
            return estados
                .filter((e) => e.label !== reserva.estado)
                .map((estado) => (
                    <button
                        key={estado.value}
                        className="btn btn-outline-primary btn-sm me-1"
                        onClick={() => handleCambiarEstado(reserva.id, estado.value)}
                    >
                        {estado.label}
                    </button>
                ));
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
                    <div className="row g-3">
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
                    </div>
                </div>
            </div>

            {/* Tabla de reservas */}
            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h2 className="h6 mb-0">Reservas del día</h2>
                        <span className="text-muted small">
                            {reservasFiltradas.length} reserva(s) encontrada(s)
                        </span>
                    </div>

                    {error && (
                        <div className="alert alert-danger py-2 small">{error}</div>
                    )}

                    {loading && (
                        <div className="text-muted small mb-2">
                            Cargando reservas...
                        </div>
                    )}

                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Cliente</th>
                                    <th>Mesa</th>
                                    <th>Hora</th>
                                    <th>Personas</th>
                                    <th>Estado</th>
                                    <th className="text-end">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reservasFiltradas.map((reserva, index) => (
                                    <tr key={reserva.id}>
                                        <td>{index + 1}</td>
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
                                ))}

                                {reservasFiltradas.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="7" className="text-center text-muted">
                                            No hay reservas para los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PanelReservas;
