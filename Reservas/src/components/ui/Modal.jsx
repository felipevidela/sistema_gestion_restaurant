import Modal from 'react-bootstrap/Modal';

/**
 * Componente Modal reutilizable usando React Bootstrap
 * @param {boolean} isOpen - Controla si el modal está visible
 * @param {function} onClose - Callback al cerrar el modal
 * @param {string} title - Título del modal
 * @param {node} children - Contenido del modal
 * @param {string} size - Tamaño del modal: 'sm', 'lg', 'xl' (md es el default)
 * @param {boolean} closeOnBackdrop - Si true, cierra al hacer click fuera del modal
 */
export default function CustomModal({
  isOpen,
  onClose,
  title,
  children,
  size,
  closeOnBackdrop = true,
}) {
  return (
    <Modal
      show={isOpen}
      onHide={onClose}
      backdrop={closeOnBackdrop ? true : 'static'}
      keyboard={true}
      centered
      size={size === 'md' ? undefined : size}
    >
      {title && (
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
      )}
      <Modal.Body>{children}</Modal.Body>
    </Modal>
  );
}

/**
 * Modal de Confirmación
 * Variante del Modal específica para confirmaciones
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Está seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmVariant = 'primary',
  isLoading = false,
}) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={title} size="sm" closeOnBackdrop={!isLoading}>
      <div className="mb-4">
        <p className="mb-0">{message}</p>
      </div>

      <div className="d-flex gap-2 justify-content-end">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={`btn btn-${confirmVariant}`}
          onClick={handleConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Procesando...
            </>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </CustomModal>
  );
}
