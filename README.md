# Sistema de Gestión de Reservas - Restaurante

**Proyecto Académico - INACAP Chile**
Sistema completo de gestión de reservas para restaurantes con backend Django REST Framework y frontend React.

## Descripción del Proyecto

Este sistema fue desarrollado como proyecto académico para la asignatura de Desarrollo de Aplicaciones Web. Implementa un sistema completo de gestión de reservas para restaurantes, utilizando tecnologías modernas y aplicando buenas prácticas de desarrollo de software.

## Características Principales

### Funcionalidades del Sistema

- Sistema de autenticación basado en tokens
- Control de acceso por roles (Administrador, Cajero, Mesero y Cliente)
- Encriptación de datos sensibles (RUT y teléfono)
- Gestión completa de reservas con validación de disponibilidad
- Administración de mesas con control de estados
- Interfaz responsive adaptada para dispositivos móviles
- API REST completa con filtros y permisos
- Sistema de soft delete para recuperación de datos
- Sistema de auditoría y registro de operaciones
- Optimización de rendimiento con cache y paginación
- Validaciones exhaustivas y protección CSRF

## Mejoras Implementadas

El sistema incluye 43 mejoras que garantizan robustez, seguridad y buena experiencia de usuario.

### Backend - 31 mejoras

**Validaciones Críticas:**
- Prevención de solapamiento de horarios en reservas
- Validación de capacidad de mesas
- Validación de horarios de negocio (12:00 - 23:00)
- Validación de fechas y horas pasadas
- Unicidad de RUT y email en perfiles

**Seguridad:**
- Encriptación de datos sensibles (RUT, teléfono) usando Fernet (AES-128)
- Validación de SECRET_KEY en producción
- Configuración CSRF completa
- Límite de caracteres en campos de texto
- Constraints a nivel de base de datos

**Rendimiento:**
- Paginación de resultados (50 por página)
- Índices compuestos en base de datos
- Sistema de cache (5 minutos)
- Optimización de consultas

**Auditoría y Logs:**
- Sistema de logging con archivos rotativos
- Registro de operaciones críticas
- Logs separados: general y auditoría
- Logs de creación y cambio de estado

**Recuperación de Datos:**
- Soft delete en reservas
- Métodos de restauración
- Historial de eliminaciones

**Documentación:**
- Documentación completa de endpoints
- Ejemplos de filtros y ordenamiento
- Especificación de permisos

### Frontend - 12 mejoras

**Validación y UX:**
- Revalidación de disponibilidad antes de confirmar
- Validación de selección de mesa
- Mensajes de error claros y consistentes
- Transacciones atómicas con rollback en caso de error

**Diseño y UI:**
- Modal de detalle de reserva con diseño moderno
- Timeline visual de estados con iconos descriptivos
- Sistema de diseño con variables CSS personalizadas
- Botones de contacto optimizados
- Layout responsive para tablets y móviles
- Componentes compactos y profesionales
- Corrección de overlapping en controles de filtros
- Efectos hover optimizados

## Tecnologías Utilizadas

### Backend
- **Django** 5.2.7
- **Django REST Framework** 3.16.1
- **PostgreSQL** - Base de datos relacional
- **django-encrypted-model-fields** 0.6.5 - Encriptación Fernet
- **django-cors-headers** - CORS para React
- **django-filter** - Filtros avanzados
- **cryptography** 46.0.3 - Algoritmo de encriptación

### Frontend
- **React** 19.2.0
- **Vite** 7.2.2
- **Bootstrap** 5.3.3
- **Bootstrap Icons** 1.11.x
- Sistema de diseño personalizado con variables CSS

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
modulo_reservas/
├── Sprint 3/
│   ├── REST frameworks/ReservaProject/  # Backend Django
│   │   ├── mainApp/
│   │   │   ├── models.py                 # Modelos: Perfil, Mesa, Reserva
│   │   │   ├── serializers.py            # Serializers REST
│   │   │   ├── views.py                  # Endpoints API
│   │   │   ├── permissions.py            # Permisos personalizados
│   │   │   ├── signals.py                # Señales para crear perfil
│   │   │   ├── admin.py                  # Panel de administración
│   │   │   └── management/commands/
│   │   │       └── poblar_datos.py       # Script de datos de prueba
│   │   ├── ReservaProject/
│   │   │   ├── settings.py               # Configuración
│   │   │   └── urls.py                   # Rutas de la API
│   │   └── requirements.txt              # Dependencias Python
│   │
│   └── Reservas/                         # Frontend React
│       ├── src/
│       │   ├── components/               # Componentes React
│       │   ├── services/                 # Cliente API REST
│       │   ├── contexts/                 # Context API
│       │   ├── utils/                    # Utilidades
│       │   ├── App.jsx                   # Componente principal
│       │   └── main.jsx                  # Entry point
│       └── package.json                  # Dependencias Node
└── docs/                                 # Documentación
```

## API Endpoints

### Autenticación

- `POST /api/login/` - Iniciar sesión
- `POST /api/register/` - Registrar nuevo usuario
- `GET /api/perfil/` - Obtener perfil del usuario autenticado
- `PATCH /api/perfil/actualizar/` - Actualizar perfil

### Mesas

- `GET /api/mesas/` - Listar todas las mesas
- `POST /api/mesas/` - Crear mesa (solo Admin)
- `GET /api/mesas/{id}/` - Detalle de mesa
- `PUT /api/mesas/{id}/` - Actualizar mesa (solo Admin)
- `DELETE /api/mesas/{id}/` - Eliminar mesa (solo Admin)
- `GET /api/consultar-mesas/?estado=disponible` - Consultar mesas con filtro

### Reservas

- `GET /api/reservas/` - Listar reservas (con filtros)
- `POST /api/reservas/` - Crear reserva
- `GET /api/reservas/{id}/` - Detalle de reserva
- `PATCH /api/reservas/{id}/` - Actualizar reserva (Admin/Cajero)
- `DELETE /api/reservas/{id}/` - Eliminar reserva (Admin/Cajero)
- `PATCH /api/reservas/{id}/cambiar_estado/` - Cambiar estado de reserva

## Sistema de Permisos por Rol

| Funcionalidad              | Admin | Cajero | Mesero | Cliente |
|----------------------------|-------|--------|--------|---------|
| Ver todas las reservas     | Si    | Si     | Si     | No      |
| Ver propias reservas       | Si    | Si     | Si     | Si      |
| Crear reservas             | Si    | Si     | No     | Si      |
| Cambiar estado de reservas | Si    | Si     | No     | No      |
| Eliminar reservas          | Si    | Si     | No     | No      |
| CRUD de mesas              | Si    | No     | No     | No      |
| Consultar mesas            | Si    | Si     | Si     | No      |
| Asignar roles              | Si    | No     | No     | No      |

## Seguridad Implementada

### Encriptación de Datos Sensibles

Los campos `rut` y `telefono` del modelo `Perfil` están encriptados usando **django-encrypted-model-fields** con el algoritmo **Fernet (AES-128)**.

- Los datos se cifran automáticamente antes de guardar en la base de datos
- En PostgreSQL se almacenan con el formato: `gAAAAAB...` (encriptados)
- La API desencripta automáticamente al consultar los datos
- Solo el dueño del perfil o un administrador pueden ver los datos descifrados
- **IMPORTANTE**: En producción, usar variables de entorno para la clave de encriptación

### Autenticación por Token

- Tokens de sesión seguros con Django REST Framework
- Los tokens se guardan en `localStorage` en el frontend
- Todas las peticiones API incluyen el token en el header `Authorization: Token <token>`

### Validaciones Implementadas

**Backend:**
- Solapamiento de horarios (evita reservas duplicadas)
- Capacidad de mesas (validación de número de personas)
- Horarios de negocio (12:00 - 23:00)
- Fechas y horas pasadas (no permite reservas antiguas)
- Unicidad de RUT y email
- Constraints en base de datos (num_personas entre 1 y 50)
- Validación de SECRET_KEY en producción

**Frontend:**
- Revalidación de disponibilidad antes de confirmar
- Validación de formularios en tiempo real
- Manejo de errores consistente
- Validación de selección de mesa
- Validación de transiciones de estado válidas

### Sistema de Auditoría

El sistema registra todas las operaciones críticas:

- **Logs generales**: `logs/reservas.log` (10 MB, 5 backups)
- **Logs de auditoría**: `logs/audit.log` (10 MB, 10 backups)

Eventos registrados:
- `RESERVA_CREADA`: Usuario, mesa, fecha, hora, personas
- `ESTADO_CAMBIADO`: Reserva, usuario, estado anterior/nuevo

### Soft Delete

Las reservas eliminadas no se borran permanentemente, permitiendo su recuperación.

### Sistema de Cache

- Cache en memoria para desarrollo
- 1000 entradas máximo
- Timeout de 5 minutos
- Preparado para Redis en producción

## Panel de Administración Django

Accede al panel de administración en **http://localhost:8000/admin/**

Funcionalidades disponibles:
- Gestionar usuarios y perfiles
- Asignar roles manualmente
- Ver y editar mesas y reservas
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

Proyecto Académico - INACAP Chile
Asignatura: Desarrollo de Aplicaciones Web

## Licencia

Este proyecto es parte del trabajo académico para INACAP Chile.
Desarrollado con fines educativos.

---

**Nota**: Este proyecto fue desarrollado como parte de la evaluación académica y tiene fines exclusivamente educativos.
