import { useState, useCallback, useEffect, useRef } from 'react';
import { getReservas, createReserva, updateEstadoReserva } from '../services/reservasApi';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../utils/errorMessages';

/**
 * Hook para gestión de reservas
 * Centraliza toda la lógica de obtención, creación y actualización de reservas
 *
 * @param {Object} options - Opciones de configuración
 * @param {Object} options.filters - Filtros iniciales (fecha, estado, etc.)
 * @param {boolean} options.autoLoad - Cargar automáticamente al montar (default: true)
 * @param {number} options.refreshInterval - Intervalo de auto-refresh en ms (0 = deshabilitado)
 *
 * @example
 * const { reservas, loading, error, refresh, createNew, updateEstado } = useReservas({
 *   filters: { fecha: '2024-01-15' },
 *   autoLoad: true,
 *   refreshInterval: 30000 // 30 segundos
 * });
 */
export function useReservas({
  filters: initialFilters = {},
  autoLoad = true,
  refreshInterval = 0,
} = {}) {
  const toast = useToast();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  // Ref para controlar el intervalo de auto-refresh
  const intervalRef = useRef(null);

  /**
   * Obtiene reservas del servidor
   */
  const fetchReservas = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }
        setError(null);

        const data = await getReservas(filters);
        setReservas(data);
        return data;
      } catch (err) {
        const errorMsg = formatErrorMessage(err);
        setError(errorMsg);
        console.error('Error al cargar reservas:', err);
        return [];
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [filters]
  );

  /**
   * Actualiza filtros y recarga reservas
   */
  const updateFilters = useCallback((newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  /**
   * Refresca las reservas manualmente
   */
  const refresh = useCallback(
    async (silent = false) => {
      return await fetchReservas(!silent);
    },
    [fetchReservas]
  );

  /**
   * Crea una nueva reserva
   */
  const createNew = useCallback(
    async (reservaData) => {
      try {
        setLoading(true);
        setError(null);

        const nuevaReserva = await createReserva(reservaData);

        // Agregar la nueva reserva al estado local
        setReservas((prev) => [...prev, nuevaReserva]);

        toast.success('Reserva creada exitosamente');
        return nuevaReserva;
      } catch (err) {
        const errorMsg = formatErrorMessage(err);
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  /**
   * Actualiza el estado de una reserva
   */
  const updateEstado = useCallback(
    async (reservaId, nuevoEstado) => {
      try {
        setError(null);

        await updateEstadoReserva({ id: reservaId, nuevoEstado });

        // Actualizar el estado local
        setReservas((prev) =>
          prev.map((r) =>
            r.id === reservaId ? { ...r, estado: nuevoEstado.toUpperCase() } : r
          )
        );

        toast.success('Estado de la reserva actualizado correctamente');
        return true;
      } catch (err) {
        const errorMsg = formatErrorMessage(err);
        setError(errorMsg);
        toast.error(errorMsg);
        throw err;
      }
    },
    [toast]
  );

  /**
   * Cancela una reserva (atajo para updateEstado)
   */
  const cancelReserva = useCallback(
    async (reservaId) => {
      return await updateEstado(reservaId, 'cancelada');
    },
    [updateEstado]
  );

  /**
   * Elimina una reserva del estado local (útil después de eliminar en servidor)
   */
  const removeReserva = useCallback((reservaId) => {
    setReservas((prev) => prev.filter((r) => r.id !== reservaId));
  }, []);

  /**
   * Filtra reservas localmente por estado
   */
  const filterByEstado = useCallback(
    (estado) => {
      if (estado === 'TODOS') {
        return reservas;
      }
      return reservas.filter((r) => r.estado === estado);
    },
    [reservas]
  );

  /**
   * Filtra reservas localmente por búsqueda de texto
   */
  const searchReservas = useCallback(
    (searchTerm) => {
      if (!searchTerm) return reservas;

      const term = searchTerm.toLowerCase();
      return reservas.filter(
        (r) =>
          r.cliente?.toLowerCase().includes(term) ||
          r.mesa?.toLowerCase().includes(term) ||
          r.fecha?.includes(term)
      );
    },
    [reservas]
  );

  /**
   * Obtiene estadísticas de las reservas
   */
  const getStats = useCallback(() => {
    const activas = reservas.filter((r) => r.estado === 'ACTIVA').length;
    const pendientes = reservas.filter((r) => r.estado === 'PENDIENTE').length;
    const completadas = reservas.filter((r) => r.estado === 'COMPLETADA').length;
    const canceladas = reservas.filter((r) => r.estado === 'CANCELADA').length;

    return {
      total: reservas.length,
      activas,
      pendientes,
      completadas,
      canceladas,
    };
  }, [reservas]);

  // Auto-load al montar el componente
  useEffect(() => {
    if (autoLoad) {
      fetchReservas();
    }
  }, [autoLoad, fetchReservas]);

  // Configurar auto-refresh si está habilitado
  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchReservas(false); // Silent refresh
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshInterval, fetchReservas]);

  // Recargar cuando cambien los filtros
  useEffect(() => {
    if (autoLoad) {
      fetchReservas();
    }
  }, [filters, autoLoad, fetchReservas]);

  return {
    // Estado
    reservas,
    loading,
    error,
    filters,

    // Acciones
    refresh,
    updateFilters,
    createNew,
    updateEstado,
    cancelReserva,
    removeReserva,

    // Utilidades
    filterByEstado,
    searchReservas,
    getStats,
  };
}

export default useReservas;
