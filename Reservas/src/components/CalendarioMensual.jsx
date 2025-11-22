import { useState, useEffect, useMemo } from 'react';
import { getReservas } from '../services/reservasApi';

export default function CalendarioMensual({ fechaSeleccionada, onDiaClick, onCrearReserva }) {
    const [mesActual, setMesActual] = useState(() => {
        const fecha = new Date(fechaSeleccionada + 'T00:00:00');
        return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    });

    const [reservasPorDia, setReservasPorDia] = useState({});
    const [loading, setLoading] = useState(false);

    // Update mesActual when fechaSeleccionada changes
    useEffect(() => {
        const fecha = new Date(fechaSeleccionada + 'T00:00:00');
        const nuevoMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        if (nuevoMes.getTime() !== mesActual.getTime()) {
            setMesActual(nuevoMes);
        }
    }, [fechaSeleccionada]);

    // Cargar reservas del mes
    useEffect(() => {
        cargarReservasMes();
    }, [mesActual]);

    const cargarReservasMes = async () => {
        setLoading(true);
        try {
            const primerDia = new Date(mesActual);
            const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
            const fechaInicio = primerDia.toISOString().split('T')[0];
            const fechaFin = ultimoDia.toISOString().split('T')[0];

            const reservasMes = await getReservas(
                { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
                { fetchAllPages: true }
            );

            const agrupadas = reservasMes.reduce((acc, reserva) => {
                if (!acc[reserva.fecha]) {
                    acc[reserva.fecha] = [];
                }
                acc[reserva.fecha].push(reserva);
                return acc;
            }, {});

            setReservasPorDia(agrupadas);
        } catch (err) {
            console.error('Error al cargar reservas del mes:', err);
            setReservasPorDia({});
        } finally {
            setLoading(false);
        }
    };

    const navegarMes = (offset) => {
        setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + offset, 1));
    };

    const irAMesActual = () => {
        const hoy = new Date();
        setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    };

    // Generar días del calendario
    const diasCalendario = useMemo(() => {
        const primerDia = new Date(mesActual);
        const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);

        // Ajustar para que la semana empiece en Lunes (1) en lugar de Domingo (0)
        const primerDiaSemana = primerDia.getDay();
        const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

        const dias = [];

        // Días del mes anterior (grises)
        for (let i = offset - 1; i >= 0; i--) {
            const dia = new Date(primerDia);
            dia.setDate(dia.getDate() - i - 1);
            dias.push({
                fecha: dia,
                esOtroMes: true,
                fechaStr: dia.toISOString().split('T')[0]
            });
        }

        // Días del mes actual
        for (let d = 1; d <= ultimoDia.getDate(); d++) {
            const dia = new Date(mesActual.getFullYear(), mesActual.getMonth(), d);
            dias.push({
                fecha: dia,
                esOtroMes: false,
                fechaStr: dia.toISOString().split('T')[0]
            });
        }

        // Días del siguiente mes (grises)
        const diasMostrados = dias.length;
        const diasFaltantes = Math.ceil(diasMostrados / 7) * 7 - diasMostrados;
        for (let i = 1; i <= diasFaltantes; i++) {
            const dia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, i);
            dias.push({
                fecha: dia,
                esOtroMes: true,
                fechaStr: dia.toISOString().split('T')[0]
            });
        }

        return dias;
    }, [mesActual]);

    // Calcular nivel de ocupación de un día
    const getNivelOcupacion = (fechaStr) => {
        const reservas = reservasPorDia[fechaStr] || [];
        const total = reservas.filter(r => r.estado === 'ACTIVA' || r.estado === 'PENDIENTE').length;

        if (total === 0) return 'none';
        if (total <= 5) return 'low';
        if (total <= 15) return 'medium';
        return 'high';
    };

    const esHoy = (fechaStr) => {
        const hoy = new Date().toISOString().split('T')[0];
        return fechaStr === hoy;
    };

    const esFechaSeleccionada = (fechaStr) => {
        return fechaStr === fechaSeleccionada;
    };

    return (
        <div className="calendario-mensual">
            {/* Header con navegación */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                    {mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </h5>
                <div className="btn-group btn-group-sm">
                    <button
                        className="btn btn-outline-secondary"
                        onClick={() => navegarMes(-1)}
                        title="Mes anterior"
                    >
                        <i className="bi bi-chevron-left"></i>
                    </button>
                    <button
                        className="btn btn-outline-primary"
                        onClick={irAMesActual}
                    >
                        Hoy
                    </button>
                    <button
                        className="btn btn-outline-secondary"
                        onClick={() => navegarMes(1)}
                        title="Mes siguiente"
                    >
                        <i className="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Cargando...</span>
                    </div>
                </div>
            )}

            {/* Calendario */}
            <div className="calendar-grid">
                {/* Días de la semana */}
                <div className="calendar-header">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
                        <div key={dia} className="calendar-day-name">
                            {dia}
                        </div>
                    ))}
                </div>

                {/* Días del mes */}
                <div className="calendar-days">
                    {diasCalendario.map((dia, index) => {
                        const nivelOcupacion = getNivelOcupacion(dia.fechaStr);
                        const reservasDelDia = reservasPorDia[dia.fechaStr] || [];
                        const totalReservas = reservasDelDia.filter(
                            r => r.estado === 'ACTIVA' || r.estado === 'PENDIENTE'
                        ).length;
                        const dotCount = Math.min(3, Math.max(0, Math.ceil(totalReservas / 6)));

                        return (
                            <div className="calendar-cell" key={index}>
                                <button
                                    className={`calendar-day
                                        ${dia.esOtroMes ? 'other-month' : ''}
                                        ${esHoy(dia.fechaStr) ? 'today' : ''}
                                        ${esFechaSeleccionada(dia.fechaStr) ? 'selected' : ''}
                                        ${nivelOcupacion !== 'none' ? `occupied-${nivelOcupacion}` : ''}
                                    `}
                                    onClick={() => onDiaClick(dia.fechaStr)}
                                    disabled={dia.esOtroMes}
                                    title={!dia.esOtroMes && totalReservas > 0 ? `${totalReservas} reservas activas/pendientes` : undefined}
                                >
                                    <span className="day-number">{dia.fecha.getDate()}</span>
                                    {!dia.esOtroMes && totalReservas > 0 && (
                                        <span className="reservas-badge">{totalReservas}</span>
                                    )}
                                    {!dia.esOtroMes && dotCount > 0 && (
                                        <div className="calendar-dots mt-1">
                                            {Array.from({ length: dotCount }).map((_, dotIndex) => (
                                                <span key={dotIndex} className="calendar-dot"></span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                                {!dia.esOtroMes && totalReservas > 0 && (
                                    <div className="calendar-popover">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <strong>{totalReservas} reserva(s)</strong>
                                            {onCrearReserva && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    type="button"
                                                    onClick={() => onCrearReserva(dia.fechaStr)}
                                                >
                                                    Crear
                                                </button>
                                            )}
                                        </div>
                                        <div className="small text-muted">
                                            Ocupación {nivelOcupacion === 'high' ? 'alta' : nivelOcupacion === 'medium' ? 'media' : 'baja'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Leyenda */}
            <div className="calendar-legend mt-3 d-flex justify-content-center gap-3 flex-wrap">
                <div className="d-flex align-items-center gap-1">
                    <div className="legend-box occupied-low"></div>
                    <small className="text-muted">Baja (1-5)</small>
                </div>
                <div className="d-flex align-items-center gap-1">
                    <div className="legend-box occupied-medium"></div>
                    <small className="text-muted">Media (6-15)</small>
                </div>
                <div className="d-flex align-items-center gap-1">
                    <div className="legend-box occupied-high"></div>
                    <small className="text-muted">Alta (16+)</small>
                </div>
            </div>

            <style jsx>{`
                .calendar-grid {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 1px solid #dee2e6;
                    max-width: 100%;
                }

                .calendar-header {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                }

                .calendar-day-name {
                    padding: 12px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: #495057;
                }

                .calendar-days {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: #dee2e6;
                    width: 100%;
                }

                .calendar-cell {
                    position: relative;
                    min-width: 0;
                }

                .calendar-day {
                    position: relative;
                    aspect-ratio: 1;
                    min-height: 80px;
                    padding: 8px;
                    background: white;
                    border: none;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .calendar-day:hover:not(:disabled) {
                    background: #e9ecef;
                    transform: scale(1.02);
                    z-index: 1;
                }

                .calendar-day.other-month {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .calendar-day.today {
                    background: #e7f3ff;
                    font-weight: bold;
                }

                .calendar-day.today .day-number {
                    color: #0d6efd;
                }

                .calendar-day.selected {
                    background: #0d6efd;
                    color: white;
                }

                .calendar-day.selected .day-number,
                .calendar-day.selected .reservas-badge {
                    color: white;
                }

                .calendar-cell:hover .calendar-popover {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }

                .calendar-popover {
                    position: absolute;
                    z-index: 2;
                    top: 8px;
                    right: 4px;
                    background: #fff;
                    border: 1px solid #dee2e6;
                    border-radius: 0.75rem;
                    padding: 0.75rem;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
                    width: 200px;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(6px);
                    transition: all 0.15s ease;
                }

                .calendar-day.occupied-low {
                    background: #d1ecf1;
                }

                .calendar-day.occupied-medium {
                    background: #fff3cd;
                }

                .calendar-day.occupied-high {
                    background: #f8d7da;
                }

                .day-number {
                    font-size: 1.1rem;
                    font-weight: 500;
                }

                .reservas-badge {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    background: #6c757d;
                    color: white;
                    border-radius: 10px;
                    padding: 2px 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .calendar-day.occupied-low .reservas-badge {
                    background: #0dcaf0;
                }

                .calendar-day.occupied-medium .reservas-badge {
                    background: #ffc107;
                }

                .calendar-day.occupied-high .reservas-badge {
                    background: #dc3545;
                }

                .legend-box {
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: 1px solid #dee2e6;
                }

                .calendar-dots {
                    display: inline-flex;
                    gap: 4px;
                }

                .calendar-dot {
                    width: 8px;
                    height: 8px;
                    background: #0d6efd;
                    border-radius: 999px;
                    opacity: 0.75;
                }

                @media (max-width: 768px) {
                    .calendar-day {
                        min-height: 60px;
                        padding: 4px;
                    }

                    .day-number {
                        font-size: 0.9rem;
                    }

                    .calendar-day-name {
                        padding: 8px 4px;
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
}
