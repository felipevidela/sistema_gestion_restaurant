# Sistema Integral de Gestión de Restaurante

Plataforma web completa para gestionar reservas, mesas, menú, stock de ingredientes, pedidos y panel de cocina. El backend está construido en Django + Django REST Framework con WebSockets (Channels/Daphne); el frontend en React con actualización en tiempo real.

## Arquitectura

### Backend
- **Django 5.1** + Django REST Framework
- **Django Channels** + **Daphne** para WebSockets en tiempo real
- **PostgreSQL** como base de datos
- **WhiteNoise** para servir archivos estáticos
- Autenticación basada en tokens (DRF Token Authentication + WebSocket Token Auth)

### Frontend
- **React 19.2** - Biblioteca principal para UI
- **Vite 7.2** - Build tool y dev server
- **React Router DOM 7.9** - Enrutamiento y navegación
- **React Bootstrap 2.10** + Bootstrap 5.3 - Componentes UI y estilos
- **Context API** - Manejo de estado global (AuthContext, ToastContext)
- Consumo de API REST para toda la funcionalidad

### Despliegue
- Pensado para Railway (PostgreSQL managed)
- Scripts `start.sh` y `Procfile` incluidos
- Build de frontend servido desde `backend/static` con WhiteNoise

## Módulos principales
- **Reservas y Mesas (mainApp):** creación y gestión de reservas, validación de solapamientos, estados de mesas, bloqueos por rango de fecha y horario, roles y perfiles de usuario.
- **Menú y Stock (menuApp):** categorías, platos, ingredientes, recetas; control de stock con alertas y disponibilidad automática de platos.
- **Pedidos y Cocina (cocinaApp):** pedidos por mesa y reserva, múltiples platos por pedido, transiciones de estado controladas, descuento/reversión de stock y actualización del panel de cocina.

## Comunicación Inter-Módulos

El sistema se comunica mediante **REST API + WebSockets** con autenticación por token DRF. El Panel de Cocina usa WebSockets para actualizaciones en tiempo real de pedidos, con fallback automático a polling si la conexión falla. Todos los datos se intercambian en formato JSON.

📖 **[Ver Documentación Técnica Completa](docs/ARQUITECTURA.md)** - Arquitectura detallada, 73+ endpoints con ejemplos JSON, flujos de datos completos, transiciones de estado, modelo de datos relacional

<details>
<summary><b>Vista Rápida: Arquitectura del Sistema</b></summary>

```
┌───────────────────────┐   REST API    ┌─────────────────────┐
│    REACT FRONTEND     │ ◄───────────► │   DJANGO BACKEND    │
│      (Vite 7.2)       │  Token Auth   │ (Django 5.1+Daphne) │
│                       │               │                     │
│  Services:            │               │  Módulos:           │
│  - reservasApi        │──────────────►│  - mainApp          │
│  - menuApi            │──────────────►│  - menuApp          │
│  - cocinaApi          │──────────────►│  - cocinaApp        │
│                       │               │                     │
│  WebSocket (Cocina):  │  ws://        │  Channels Consumer  │
│  - Tiempo real        │ ◄───────────► │  - /ws/cocina/cola/ │
│  - Fallback polling   │               │                     │
│                       │               │  PostgreSQL DB      │
└───────────────────────┘               └─────────────────────┘
```

**Módulos Backend:**
- **mainApp** (~40 endpoints) - Reservas, mesas, autenticación, perfiles, bloqueos
- **menuApp** (~20 endpoints) - Menú, categorías, platos, ingredientes, recetas, stock
- **cocinaApp** (~15 endpoints) - Pedidos, estados de cocina, cola, estadísticas, cancelaciones

**Características de Comunicación:**
- Autenticación: `Authorization: Token {token}` en headers REST, query param `?token=` en WebSocket
- WebSocket: Tiempo real en Panel de Cocina (`/ws/cocina/cola/`) con fallback automático a polling
- Paginación: Endpoints retornan `{count, next, previous, results}`
- Transacciones atómicas: Stock se descuenta/revierte con `F()` para integridad
- Auditoría: Cancelaciones registran usuario, motivo, fecha y snapshots JSON

**Flujos Documentados:**
1. Ciclo completo de un pedido (6 pasos: llegada → toma → preparación → entrega → cancelación)
2. Reserva con usuario invitado (registro público → token 48h → activación opcional)
3. Control de stock e inventario (creación receta → verificación → descuento → reversión)

</details>

## Endpoints destacados (prefix `/api/`)
- Autenticación: `/login/`, `/register/`, `/register-and-reserve/`, `/activar-cuenta/`.
- Reservas y mesas: `/reservas/`, `/consultar-mesas/`, `/horas-disponibles/`, `/bloqueos/`.
- Menú: `/menu/categorias/`, `/menu/platos/`, `/menu/ingredientes/`.
- Cocina: `/cocina/pedidos/`, `/cocina/cola/`.
- WebSocket: `/ws/cocina/cola/?token={token}` (tiempo real para cola de pedidos).

## Puesta en marcha backend (desarrollo)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configurar entorno (ejemplo local con SQLite)
export DATABASE_URL=sqlite:///db.sqlite3
export DEBUG=True

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Puesta en marcha frontend (desarrollo)
```bash
cd frontend
npm install
npm run dev  # Vite en 5173 por defecto
```

## Testing
- Pytest: `cd backend && pytest`
- Nota: define `DATABASE_URL` a una base local antes de correr tests para evitar conectar a Railway.

## Despliegue
- Variables clave: `DATABASE_URL`, `DJANGO_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`.
- El build de frontend se sirve con WhiteNoise desde `backend/static` y `frontend/dist` (ver `config/settings.py`).

## Scripts útiles
- `start.sh` / `redeploy.sh` / `build.sh`: flujos de arranque y despliegue.
- `manage.py shell` snippet en `backend/README.md` para generar mesas demo.

## Seguridad y validaciones
- Tokens de autenticación DRF, control de roles por permiso personalizado.
- Validación de solapamientos de reservas y bloqueos, límite de capacidad y horario de apertura/cierre.
- Manejo de stock transaccional en pedidos; reversión al cancelar.

## Estructura
```
backend/   # Django + DRF
frontend/  # React + Vite
docs/      # Documentación adicional
```
