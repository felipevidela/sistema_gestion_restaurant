import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

/**
 * Hook para usar el sistema de notificaciones
 * @returns {Object} - { showToast, success, error, info, warning }
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return context;
}

/**
 * Provider del sistema de notificaciones
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Agregar un nuevo toast
   * @param {string} message - Mensaje a mostrar
   * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duración en ms (0 = no auto-cerrar)
   */
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remover después de la duración especificada
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Métodos de conveniencia
  const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message, duration = 6000) => showToast(message, 'error', duration), [showToast]);
  const warning = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]);
  const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast]);

  const value = {
    showToast,
    success,
    error,
    warning,
    info,
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Contenedor de toasts
 */
function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="position-fixed top-0 end-0 p-3"
      style={{ zIndex: 9999 }}
    >
      <div className="d-flex flex-column gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={() => onRemove(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Componente Toast individual
 */
function Toast({ toast, onClose }) {
  const { message, type } = toast;

  // Configuración de iconos y colores por tipo
  const config = {
    success: {
      bgClass: 'bg-success',
      icon: 'bi-check-circle-fill',
      title: 'Éxito',
    },
    error: {
      bgClass: 'bg-danger',
      icon: 'bi-exclamation-circle-fill',
      title: 'Error',
    },
    warning: {
      bgClass: 'bg-warning',
      icon: 'bi-exclamation-triangle-fill',
      title: 'Advertencia',
    },
    info: {
      bgClass: 'bg-info',
      icon: 'bi-info-circle-fill',
      title: 'Información',
    },
  };

  const { bgClass, icon, title } = config[type] || config.info;

  return (
    <div
      className="toast show toast-animated"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        minWidth: '300px',
        maxWidth: '400px',
      }}
    >
      <div className={`toast-header ${bgClass} text-white`}>
        <i className={`bi ${icon} me-2`}></i>
        <strong className="me-auto">{title}</strong>
        <button
          type="button"
          className="btn-close btn-close-white"
          onClick={onClose}
          aria-label="Cerrar"
        ></button>
      </div>
      <div className="toast-body">
        {message}
      </div>
    </div>
  );
}
