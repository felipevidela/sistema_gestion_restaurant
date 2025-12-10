# Sistema Integral de Gestión de Restaurante

Plataforma web completa para gestionar reservas, mesas, menú, stock de ingredientes, pedidos y panel de cocina. El backend está construido en Django + Django REST Framework; el frontend en React (Vite) con actualización manual y automática cada 60 segundos.

## Arquitectura
- Backend: Django 5 + DRF (WSGI con Gunicorn), PostgreSQL, WhiteNoise para estáticos.
- Frontend: React 19 con Vite, consumo de API REST para toda la funcionalidad.
- Despliegue pensado para Railway (PostgreSQL); scripts `start.sh` y `Procfile` incluidos.

## Módulos principales
- **Reservas y Mesas (mainApp):** creación y gestión de reservas, validación de solapamientos, estados de mesas, bloqueos por rango de fecha y horario, roles y perfiles de usuario.
- **Menú y Stock (menuApp):** categorías, platos, ingredientes, recetas; control de stock con alertas y disponibilidad automática de platos.
- **Pedidos y Cocina (cocinaApp):** pedidos por mesa y reserva, múltiples platos por pedido, transiciones de estado controladas, descuento/reversión de stock y actualización del panel de cocina.

## Endpoints destacados (prefix `/api/`)
- Autenticación: `/login/`, `/register/`, `/register-and-reserve/`, `/activar-cuenta/`.
- Reservas y mesas: `/reservas/`, `/consultar-mesas/`, `/horas-disponibles/`, `/bloqueos/`.
- Menú: `/menu/categorias/`, `/menu/platos/`, `/menu/ingredientes/`.
- Cocina: `/cocina/pedidos/`, `/cocina/cola/`.

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
