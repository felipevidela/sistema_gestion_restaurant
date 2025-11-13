# Sistema de Gestión de Reservas - Restaurante

Sistema completo de gestión de reservas para restaurantes con backend Django REST Framework y frontend React.

## Características

- 🔐 **Sistema de autenticación** con tokens
- 👥 **Control de roles**: Administrador, Cajero, Mesero y Cliente
- 🔒 **Encriptación de datos sensibles**: RUT y teléfono cifrados
- 📅 **Gestión de reservas** con validación de disponibilidad
- 🪑 **Gestión de mesas** con estados
- 🎨 **Interfaz moderna** con React y Bootstrap 5
- 🔄 **API REST completa** con filtros y permisos

## Tecnologías Utilizadas

### Backend
- Django 5.2.7
- Django REST Framework 3.16.1
- PostgreSQL
- django-encrypted-model-fields 0.6.5 (encriptación Fernet) ✅
- django-cors-headers (CORS para React)
- django-filter (filtros avanzados)
- cryptography 46.0.3 (algoritmo de encriptación)

### Frontend
- React 19.2.0
- Vite 7.2.2
- Bootstrap 5.3.3

## Requisitos Previos

- Python 3.10 o superior
- Node.js 18 o superior
- PostgreSQL 14 o superior
- pip y npm instalados

## Instalación

### 1. Configurar PostgreSQL

```bash
# Iniciar PostgreSQL (macOS con Homebrew)
brew services start postgresql

# Crear la base de datos
createdb reservas_db

# O si tienes un usuario postgres específico:
psql -U postgres -c "CREATE DATABASE reservas_db;"
```

**Nota**: Si usas un usuario/password diferente de `postgres/postgres`, edita el archivo `ReservaProject/settings.py` en la sección `DATABASES`.

### 2. Instalar y configurar el Backend

```bash
# Navegar a la carpeta del proyecto Django
cd "Sprint 3/REST frameworks/ReservaProject"

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# En macOS/Linux:
source venv/bin/activate
# En Windows:
# venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Crear migraciones y aplicarlas
python manage.py makemigrations
python manage.py migrate

# Crear superusuario (opcional, ya que el script pobla_datos crea un admin)
python manage.py createsuperuser

# Poblar la base de datos con datos de prueba
python manage.py poblar_datos

# Iniciar el servidor
python manage.py runserver
```

El backend estará disponible en: **http://localhost:8000**

### 3. Instalar y configurar el Frontend

```bash
# Abrir una nueva terminal
# Navegar a la carpeta del frontend
cd "Sprint 3/Reservas"

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

El frontend estará disponible en: **http://localhost:5173**

## Credenciales de Prueba

Después de ejecutar `python manage.py poblar_datos`, tendrás acceso a estos usuarios:

| Usuario    | Contraseña  | Rol            | Descripción                              |
|------------|-------------|----------------|------------------------------------------|
| `admin`    | `admin123`  | Administrador  | Acceso completo al sistema              |
| `cajero1`  | `cajero123` | Cajero         | Gestiona reservas y visualiza estados   |
| `mesero1`  | `mesero123` | Mesero         | Consulta mesas y reservas               |
| `cliente1` | `cliente123`| Cliente        | Crea y ve sus propias reservas          |

## Estructura del Proyecto

```
Sprint 3/
├── REST frameworks/ReservaProject/  # Backend Django
│   ├── mainApp/
│   │   ├── models.py                 # Modelos: Perfil, Mesa, Reserva
│   │   ├── serializers.py            # Serializers REST
│   │   ├── views.py                  # Endpoints API
│   │   ├── permissions.py            # Permisos personalizados
│   │   ├── signals.py                # Señales para crear perfil
│   │   ├── admin.py                  # Panel de administración
│   │   └── management/commands/
│   │       └── poblar_datos.py       # Script de datos de prueba
│   ├── ReservaProject/
│   │   ├── settings.py               # Configuración (PostgreSQL, CORS, etc.)
│   │   └── urls.py                   # Rutas de la API
│   └── requirements.txt              # Dependencias Python
│
└── Reservas/                         # Frontend React
    ├── src/
    │   ├── components/
    │   │   ├── LoginForm.jsx         # Formulario de login
    │   │   └── PanelReservas.jsx     # Panel principal
    │   ├── services/
    │   │   └── reservasApi.js        # Cliente API REST
    │   ├── App.jsx                   # Componente principal
    │   └── main.jsx                  # Entry point
    └── package.json                  # Dependencias Node
```

## API Endpoints

### Autenticación

- `POST /api/login/` - Iniciar sesión
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```

- `POST /api/register/` - Registrar nuevo usuario
- `GET /api/perfil/` - Obtener perfil del usuario autenticado

### Mesas

- `GET /api/mesas/` - Listar todas las mesas
- `POST /api/mesas/` - Crear mesa (solo Admin)
- `GET /api/mesas/{id}/` - Detalle de mesa
- `PUT /api/mesas/{id}/` - Actualizar mesa (solo Admin)
- `DELETE /api/mesas/{id}/` - Eliminar mesa (solo Admin)
- `GET /api/consultar-mesas/?estado=disponible` - Consultar mesas con filtro

### Reservas

- `GET /api/reservas/` - Listar reservas
  - Filtros disponibles: `?date=today`, `?fecha_reserva=2025-11-12`, `?estado=activa`
- `POST /api/reservas/` - Crear reserva
- `GET /api/reservas/{id}/` - Detalle de reserva
- `PATCH /api/reservas/{id}/` - Actualizar reserva (Admin/Cajero)
- `DELETE /api/reservas/{id}/` - Eliminar reserva (Admin/Cajero)
- `PATCH /api/reservas/{id}/cambiar_estado/` - Cambiar estado de reserva
  ```json
  {
    "estado": "activa"
  }
  ```

## Sistema de Permisos por Rol

| Funcionalidad              | Admin | Cajero | Mesero | Cliente |
|----------------------------|-------|--------|--------|---------|
| Ver todas las reservas     | ✅    | ✅     | ✅     | ❌      |
| Ver propias reservas       | ✅    | ✅     | ✅     | ✅      |
| Crear reservas             | ✅    | ✅     | ❌     | ✅      |
| Cambiar estado de reservas | ✅    | ✅     | ❌     | ❌      |
| Eliminar reservas          | ✅    | ✅     | ❌     | ❌      |
| CRUD de mesas              | ✅    | ❌     | ❌     | ❌      |
| Consultar mesas            | ✅    | ✅     | ✅     | ❌      |
| Asignar roles              | ✅    | ❌     | ❌     | ❌      |

## Seguridad Implementada

### Encriptación de Datos Sensibles ✅

Los campos `rut` y `telefono` del modelo `Perfil` están **encriptados** usando **django-encrypted-model-fields** con el algoritmo **Fernet (AES-128)**.

- Los datos se cifran **automáticamente** antes de guardar en la base de datos
- En PostgreSQL se almacenan con el formato: `gAAAAAB...` (encriptados)
- La API desencripta automáticamente al consultar los datos
- Solo el dueño del perfil o un administrador pueden ver los datos descifrados
- La configuración de claves está en `settings.py` (`FIELD_ENCRYPTION_KEY`)
- **IMPORTANTE**: En producción, usar variables de entorno para la clave de encriptación

### Autenticación por Token

- Tokens de sesión seguros con Django REST Framework
- Los tokens se guardan en `localStorage` en el frontend
- Todas las peticiones API incluyen el token en el header `Authorization: Token <token>`

### Validaciones

- Validación de solapamiento de horarios en reservas
- Validación de disponibilidad de mesas
- Permisos a nivel de endpoint y objeto
- Manejo seguro de contraseñas con hashing

## Panel de Administración Django

Accede al panel de administración en **http://localhost:8000/admin/**

Desde aquí puedes:
- Gestionar usuarios y perfiles
- Asignar roles manualmente
- Ver/editar mesas y reservas
- Verificar que los datos sensibles están encriptados

## Desarrollo

### Ejecutar tests

```bash
cd "Sprint 3/REST frameworks/ReservaProject"
python manage.py test
```

### Crear migraciones después de cambios en modelos

```bash
python manage.py makemigrations
python manage.py migrate
```

### Limpiar base de datos y volver a poblar

```bash
# Eliminar base de datos
dropdb reservas_db

# Crear nueva
createdb reservas_db

# Aplicar migraciones
python manage.py migrate

# Poblar datos
python manage.py poblar_datos
```

## Autores

**Sprint 3 - Equipo de Desarrollo**

- Implementación de backend Django REST
- Desarrollo de frontend React
- Integración de sistemas

## Licencia

Este proyecto es parte de para INACAP Chile.


