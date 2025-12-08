import './Skeleton.css';

/**
 * Componente Skeleton para estados de carga
 * Muestra placeholders animados mientras se carga el contenido
 */

/**
 * Skeleton básico - línea de texto o bloque
 */
export function Skeleton({ width = '100%', height = '1rem', className = '', variant = 'text' }) {
  const styles = {
    width,
    height: variant === 'text' ? height : width,
  };

  return (
    <div
      className={`skeleton ${variant === 'circle' ? 'skeleton-circle' : ''} ${className}`}
      style={styles}
      aria-busy="true"
      aria-label="Cargando..."
    />
  );
}

/**
 * Skeleton para tarjetas de reserva
 */
export function ReservaSkeleton() {
  return (
    <div className="col-md-6 col-lg-4 mb-3">
      <div className="card h-100 shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <Skeleton width="60%" height="1.5rem" />
          <Skeleton width="80px" height="24px" />
        </div>
        <div className="card-body">
          <div className="mb-2">
            <Skeleton width="90%" />
          </div>
          <div className="mb-2">
            <Skeleton width="70%" />
          </div>
          <div className="mb-2">
            <Skeleton width="50%" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton para tabla de reservas
 */
export function TableSkeleton({ rows = 5 }) {
  return (
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
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index}>
              <td><Skeleton width="20px" /></td>
              <td><Skeleton width="120px" /></td>
              <td><Skeleton width="80px" /></td>
              <td><Skeleton width="60px" /></td>
              <td><Skeleton width="30px" /></td>
              <td><Skeleton width="90px" height="24px" /></td>
              <td className="text-end"><Skeleton width="100px" height="32px" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton para formulario
 */
export function FormSkeleton({ fields = 4 }) {
  return (
    <div>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="mb-3">
          <Skeleton width="120px" height="1rem" className="mb-2" />
          <Skeleton width="100%" height="38px" />
        </div>
      ))}
      <Skeleton width="150px" height="38px" />
    </div>
  );
}

/**
 * Skeleton para tarjetas de estadísticas
 */
export function StatCardSkeleton() {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <Skeleton width="60%" className="mb-2" />
        <Skeleton width="40%" height="2rem" />
      </div>
    </div>
  );
}

/**
 * Skeleton para lista de mesas
 */
export function MesaSkeleton() {
  return (
    <div className="col-md-6 col-lg-4 mb-3">
      <div className="card">
        <div className="card-body text-center">
          <Skeleton width="80%" height="1.5rem" className="mx-auto mb-2" />
          <Skeleton width="120px" height="24px" className="mx-auto mb-2" />
          <Skeleton width="60%" className="mx-auto" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton genérico para contenido
 */
export function ContentSkeleton({ lines = 3 }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? '80%' : '100%'}
          className="mb-2"
        />
      ))}
    </div>
  );
}

/**
 * Skeleton para perfil de usuario
 */
export function ProfileSkeleton() {
  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex align-items-center mb-4">
          <Skeleton width="80px" height="80px" variant="circle" className="me-3" />
          <div className="flex-grow-1">
            <Skeleton width="200px" height="1.5rem" className="mb-2" />
            <Skeleton width="150px" />
          </div>
        </div>
        <div className="mb-3">
          <Skeleton width="100px" className="mb-2" />
          <Skeleton width="100%" height="38px" />
        </div>
        <div className="mb-3">
          <Skeleton width="100px" className="mb-2" />
          <Skeleton width="100%" height="38px" />
        </div>
        <Skeleton width="120px" height="38px" />
      </div>
    </div>
  );
}

export default Skeleton;
