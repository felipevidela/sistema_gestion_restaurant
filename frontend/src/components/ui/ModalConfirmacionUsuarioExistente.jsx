import Modal from './Modal';

/**
 * Modal de Confirmación de Usuario Existente
 * Muestra cuando un usuario intenta hacer una segunda reserva
 * y solicita confirmación para agregar la reserva a su perfil existente
 *
 * @param {boolean} isOpen - Controla si el modal está visible
 * @param {function} onClose - Callback al cerrar/cancelar el modal
 * @param {function} onConfirm - Callback al confirmar agregar la reserva
 * @param {object} userData - Datos del usuario existente (nombre, email, etc.)
 * @param {number} reservasCount - Número de reservas actuales del usuario
 */
export default function ModalConfirmacionUsuarioExistente({
  isOpen,
  onClose,
  onConfirm,
  userData,
  reservasCount = 0
}) {
  if (!userData) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="md"
      closeOnBackdrop={false}
    >
      <div className="text-center">
        {/* Icono de información */}
        <div className="mb-4">
          <div
            className="rounded-circle bg-info d-inline-flex align-items-center justify-content-center"
            style={{ width: '80px', height: '80px' }}
          >
            <i className="bi bi-person-check-fill text-white" style={{ fontSize: '48px' }}></i>
          </div>
        </div>

        {/* Título */}
        <h3 className="fw-bold text-dark mb-2">¡Ya tienes una cuenta!</h3>
        <p className="text-muted mb-4">
          Encontramos una cuenta registrada con este correo electrónico
        </p>
      </div>

      {/* Información del usuario */}
      <div className="border rounded p-3 mb-4">
        <h6 className="fw-bold mb-3">
          <i className="bi bi-person-circle me-2 text-primary"></i>
          Tu cuenta
        </h6>

        <div className="row g-3">
          {/* Nombre */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-person me-2"></i>Nombre:
              </span>
              <strong>{userData.nombre_completo}</strong>
            </div>
          </div>

          {/* Email */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-envelope me-2"></i>Email:
              </span>
              <strong>{userData.email}</strong>
            </div>
          </div>

          {/* Reservas actuales */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-calendar-check me-2"></i>Reservas actuales:
              </span>
              <strong>{reservasCount} {reservasCount === 1 ? 'reserva' : 'reservas'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Pregunta de confirmación */}
      <div className="alert alert-warning mb-4">
        <div className="d-flex align-items-start">
          <i className="bi bi-question-circle me-2 mt-1"></i>
          <div>
            <strong>¿Deseas agregar esta nueva reserva a tu perfil?</strong>
            <p className="mb-0 mt-1 small">
              {userData.es_invitado
                ? 'La nueva reserva se agregará a tus reservas existentes.'
                : 'Podrás ver todas tus reservas en tu panel de control.'}
            </p>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="d-flex gap-2 justify-content-end">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onClose}
        >
          <i className="bi bi-x-circle me-2"></i>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
        >
          <i className="bi bi-check-circle me-2"></i>
          Sí, confirmar
        </button>
      </div>
    </Modal>
  );
}
