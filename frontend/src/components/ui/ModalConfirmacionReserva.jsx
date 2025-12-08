import Modal from './Modal';

/**
 * Modal de Confirmación de Reserva
 * Muestra todos los detalles de la reserva recién creada
 *
 * @param {boolean} isOpen - Controla si el modal está visible
 * @param {function} onClose - Callback al cerrar el modal
 * @param {object} reservaData - Datos de la reserva (id, mesa, fecha, hora, etc.)
 * @param {object} clienteData - Datos del cliente (nombre, email, teléfono)
 * @param {boolean} esInvitado - Si es un usuario invitado o registrado
 * @param {number} reservasCount - FIX #231: Número total de reservas del usuario
 * @param {boolean} isAdditionalReservation - FIX #231: Si es una reserva adicional (no la primera)
 */
export default function ModalConfirmacionReserva({
  isOpen,
  onClose,
  reservaData,
  clienteData,
  esInvitado = false,
  reservasCount = 1,
  isAdditionalReservation = false
}) {
  if (!reservaData) {
    console.error('❌ Modal: reservaData is null/undefined', { isOpen, reservaData });
    return null;
  }

  console.log('🎨 Modal rendering with:', { isOpen, reservaData, clienteData, esInvitado });

  // Formatear fecha a formato legible
  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const diaSemana = diasSemana[fecha.getDay()];
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();

    return `${diaSemana} ${dia} de ${mes} de ${año}`;
  };

  // Formatear hora (eliminar segundos si existen)
  const formatearHora = (horaStr) => {
    if (!horaStr) return '';
    return horaStr.substring(0, 5); // "14:00:00" -> "14:00"
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="md"
      closeOnBackdrop={false}
    >
      <div className="text-center">
        {/* Icono de éxito */}
        <div className="mb-4">
          <div
            className="rounded-circle bg-success d-inline-flex align-items-center justify-content-center"
            style={{ width: '80px', height: '80px' }}
          >
            <i className="bi bi-check-lg text-white" style={{ fontSize: '48px' }}></i>
          </div>
        </div>

        {/* Título - FIX #231: Mensaje personalizado para reservas adicionales */}
        <h3 className="fw-bold text-success mb-2">
          {isAdditionalReservation ? '¡Reserva Agregada!' : '¡Reserva Confirmada!'}
        </h3>
        <p className="text-muted mb-4">
          {isAdditionalReservation
            ? `Ahora tienes ${reservasCount} ${reservasCount === 1 ? 'reserva' : 'reservas'} activas`
            : 'Tu reserva ha sido creada exitosamente'}
        </p>
      </div>

      {/* Número de Confirmación */}
      <div className="alert alert-info mb-4">
        <div className="d-flex align-items-center justify-content-center">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Número de Confirmación: #{reservaData.id || reservaData.reserva_id}</strong>
        </div>
      </div>

      {/* Detalles de la Reserva */}
      <div className="border rounded p-3 mb-4">
        <h6 className="fw-bold mb-3">
          <i className="bi bi-calendar-check me-2 text-primary"></i>
          Detalles de la Reserva
        </h6>

        <div className="row g-3">
          {/* Mesa */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-table me-2"></i>Mesa:
              </span>
              <strong>Mesa {reservaData.mesa_numero || reservaData.mesa} - Capacidad {reservaData.mesa_capacidad || reservaData.num_personas} personas</strong>
            </div>
          </div>

          {/* Fecha */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-calendar3 me-2"></i>Fecha:
              </span>
              <strong>{formatearFecha(reservaData.fecha_reserva)}</strong>
            </div>
          </div>

          {/* Horario */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-clock me-2"></i>Horario:
              </span>
              <strong>
                {formatearHora(reservaData.hora_inicio)} - {formatearHora(reservaData.hora_fin)}
                <span className="text-muted ms-2">(2 horas)</span>
              </strong>
            </div>
          </div>

          {/* Número de personas */}
          <div className="col-12">
            <div className="d-flex justify-content-between">
              <span className="text-muted">
                <i className="bi bi-people me-2"></i>Personas:
              </span>
              <strong>{reservaData.num_personas} {reservaData.num_personas === 1 ? 'persona' : 'personas'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Datos del Cliente */}
      {clienteData && (
        <div className="border rounded p-3 mb-4">
          <h6 className="fw-bold mb-3">
            <i className="bi bi-person me-2 text-primary"></i>
            Reserva a nombre de
          </h6>

          <div className="row g-2">
            <div className="col-12">
              <div className="d-flex align-items-start">
                <i className="bi bi-person-circle me-2 text-muted mt-1"></i>
                <div>
                  <small className="text-muted d-block">Nombre</small>
                  <strong>{clienteData.nombre} {clienteData.apellido}</strong>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="d-flex align-items-start">
                <i className="bi bi-envelope me-2 text-muted mt-1"></i>
                <div>
                  <small className="text-muted d-block">Email</small>
                  <strong>{clienteData.email}</strong>
                </div>
              </div>
            </div>
            {clienteData.telefono && (
              <div className="col-12">
                <div className="d-flex align-items-start">
                  <i className="bi bi-telephone me-2 text-muted mt-1"></i>
                  <div>
                    <small className="text-muted d-block">Teléfono</small>
                    <strong>{clienteData.telefono}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensaje sobre el email */}
      <div className="alert alert-light border mb-4">
        <div className="d-flex align-items-start">
          <i className="bi bi-envelope-check text-primary me-2 mt-1" style={{ fontSize: '20px' }}></i>
          <div>
            <strong className="d-block mb-1">Confirmación por Email</strong>
            <small className="text-muted">
              {esInvitado
                ? 'Recibirás un correo electrónico con un link para gestionar tu reserva.'
                : 'Recibirás un correo electrónico con la confirmación de tu reserva.'}
            </small>
          </div>
        </div>
      </div>

      {/* Botón Cerrar */}
      <div className="d-grid">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onClose}
        >
          <i className="bi bi-check-circle me-2"></i>
          Entendido
        </button>
      </div>
    </Modal>
  );
}
