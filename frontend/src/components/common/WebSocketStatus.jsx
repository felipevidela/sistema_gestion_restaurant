import { Badge } from 'react-bootstrap';

export function WebSocketStatus({ wsEstado, className = '' }) {
  if (wsEstado === 'conectando') {
    return (
      <Badge bg="secondary" className={className}>
        <span className="spinner-border spinner-border-sm me-1"></span>
        Conectando...
      </Badge>
    );
  }

  if (wsEstado === 'conectado') {
    return (
      <Badge bg="success" className={className}>
        <i className="bi bi-wifi me-1"></i>
        Tiempo Real
      </Badge>
    );
  }

  // wsEstado === 'fallback'
  return (
    <Badge bg="warning" className={className}>
      <i className="bi bi-exclamation-triangle me-1"></i>
      Modo Fallback
    </Badge>
  );
}
