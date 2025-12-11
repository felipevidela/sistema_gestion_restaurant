import { Badge } from 'react-bootstrap';

export function WebSocketStatus({ isConnected, error, className = '' }) {
  if (error) {
    return (
      <Badge bg="danger" className={className} title={error}>
        <i className="bi bi-wifi-off me-1"></i>
        Error
      </Badge>
    );
  }

  if (!isConnected) {
    return (
      <Badge bg="warning" className={className}>
        <span className="spinner-border spinner-border-sm me-1"></span>
        Conectando...
      </Badge>
    );
  }

  return (
    <Badge bg="success" className={className}>
      <i className="bi bi-wifi me-1"></i>
      Tiempo Real
    </Badge>
  );
}
