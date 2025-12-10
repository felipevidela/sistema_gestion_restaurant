import { useState } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * Modal para cancelar pedido con motivo obligatorio
 * Valida que el motivo tenga al menos 10 caracteres
 */
function ModalCancelarPedido({ show, onHide, pedido, onCancelar }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación frontend (igual a backend)
    if (motivo.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    try {
      setProcesando(true);
      setError('');
      await onCancelar(pedido.id, motivo.trim());

      // Limpiar y cerrar
      setMotivo('');
      onHide();
    } catch (err) {
      setError(err.message || 'Error al cancelar el pedido');
    } finally {
      setProcesando(false);
    }
  };

  const handleClose = () => {
    if (!procesando) {
      setMotivo('');
      setError('');
      onHide();
    }
  };

  const caracteresRestantes = 500 - motivo.length;
  const esValido = motivo.trim().length >= 10;

  return (
    <Modal show={show} onHide={handleClose} centered backdrop={procesando ? 'static' : true}>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton={!procesando}>
          <Modal.Title>
            <i className="bi bi-x-circle text-danger me-2"></i>
            Cancelar Pedido #{pedido?.id}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}

          {/* Info del pedido */}
          <Alert variant="warning" className="mb-3">
            <div className="d-flex align-items-center">
              <i className="bi bi-info-circle me-2"></i>
              <div>
                <strong>Mesa {pedido?.mesa_numero}</strong>
                {pedido?.cliente_nombre && (
                  <div className="small text-muted">{pedido.cliente_nombre}</div>
                )}
                {pedido?.detalles && pedido.detalles.length > 0 && (
                  <div className="small mt-1">
                    {pedido.detalles.length} plato{pedido.detalles.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </Alert>

          {/* Campo motivo */}
          <Form.Group>
            <Form.Label className="fw-semibold">
              Motivo de cancelación <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Cliente solicitó cancelación por tiempo de espera excesivo..."
              required
              disabled={procesando}
              maxLength={500}
              className={motivo.length > 0 && !esValido ? 'is-invalid' : ''}
            />
            <div className="d-flex justify-content-between mt-1">
              <Form.Text className={esValido ? 'text-success' : 'text-muted'}>
                {esValido ? (
                  <>
                    <i className="bi bi-check-circle me-1"></i>
                    Motivo válido
                  </>
                ) : (
                  <>
                    Mínimo 10 caracteres (actual: {motivo.trim().length})
                  </>
                )}
              </Form.Text>
              <Form.Text className={caracteresRestantes < 50 ? 'text-warning' : 'text-muted'}>
                {caracteresRestantes} caracteres restantes
              </Form.Text>
            </div>
          </Form.Group>

          {/* Advertencia */}
          <Alert variant="info" className="mb-0 mt-3">
            <small>
              <i className="bi bi-lightbulb me-1"></i>
              <strong>Nota:</strong> Esta acción no se puede deshacer.
              El pedido se marcará como CANCELADO y se revertirá el stock de los ingredientes.
            </small>
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={procesando}
          >
            <i className="bi bi-arrow-left me-1"></i>
            Volver
          </Button>
          <Button
            variant="danger"
            type="submit"
            disabled={!esValido || procesando}
          >
            {procesando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Cancelando...
              </>
            ) : (
              <>
                <i className="bi bi-x-circle me-1"></i>
                Confirmar Cancelación
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

ModalCancelarPedido.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  pedido: PropTypes.shape({
    id: PropTypes.number,
    mesa_numero: PropTypes.number,
    cliente_nombre: PropTypes.string,
    detalles: PropTypes.array
  }),
  onCancelar: PropTypes.func.isRequired
};

export default ModalCancelarPedido;
