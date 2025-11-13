# Sistema de Reservas de Restaurante

Sistema de gestión de reservas para restaurante desarrollado con Django REST Framework y React.

## 🚀 Tecnologías Utilizadas

### Backend
- **Django 5.2.7** - Framework web
- **Django REST Framework 3.16.1** - API REST
- **PostgreSQL** - Base de datos
- **django-encrypted-model-fields 0.6.5** - Encriptación de campos sensibles
- **django-cors-headers 4.6.0** - CORS para frontend
- **django-filter 24.3** - Filtrado de consultas
- **cryptography 46.0.3** - Librería de encriptación (Fernet)

### Frontend
- **React 19.2.0** - Framework UI
- **Vite 7.2.2** - Build tool
- **Bootstrap 5** - Estilos
- **Bootstrap Icons** - Iconos

## 📋 Requisitos Previos

- Python 3.13+
- PostgreSQL
- Node.js 18+
- npm

## 🔧 Instalación

### Instalación en Windows

#### 1. Requisitos Previos en Windows

1. **Instalar Python 3.13+**:
   - Descargar desde [python.org](https://www.python.org/downloads/)
   - Durante la instalación, marcar "Add Python to PATH"
   - Verificar instalación: `python --version`

2. **Instalar PostgreSQL**:
   - Descargar desde [postgresql.org](https://www.postgresql.org/download/windows/)
   - Durante la instalación, recordar la contraseña del usuario `postgres`
   - Agregar PostgreSQL al PATH del sistema (normalmente: `C:\Program Files\PostgreSQL\16\bin`)

3. **Instalar Node.js 18+**:
   - Descargar desde [nodejs.org](https://nodejs.org/)
   - Instalar con opciones por defecto
   - Verificar instalación: `node --version` y `npm --version`

4. **Instalar Git** (opcional, para clonar el repositorio):
   - Descargar desde [git-scm.com](https://git-scm.com/download/win)

#### 2. Configurar Backend (Django) en Windows

Abrir **PowerShell** o **CMD** y ejecutar:

```powershell
# Navegar al directorio del proyecto
cd "REST frameworks\ReservaProject"

# Crear entorno virtual (recomendado)
python -m venv venv

# Activar entorno virtual
.\venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Crear base de datos PostgreSQL
# Abrir psql (usar la contraseña configurada durante la instalación)
psql -U postgres

# Dentro de psql, ejecutar:
# CREATE DATABASE reservas_db;
# \q

# Configurar variables de entorno
copy .env.example .env
# Editar .env con Notepad o tu editor preferido:
# - SECRET_KEY
# - FIELD_ENCRYPTION_KEY
# - Credenciales de PostgreSQL (DATABASE_USER, DATABASE_PASSWORD)

# Ejecutar migraciones
python manage.py makemigrations
python manage.py migrate

# Crear superusuario (opcional)
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver
```

> **Nota**: Si hay problemas con `psycopg2-binary`, instalar manualmente: `pip install psycopg2-binary`

El servidor estará disponible en: `http://localhost:8000`

#### 3. Configurar Frontend (React) en Windows

En una nueva terminal PowerShell/CMD:

```powershell
# Navegar al directorio del frontend
cd Reservas

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

#### Comandos útiles para Windows

```powershell
# Ver procesos en puerto 8000
netstat -ano | findstr :8000

# Matar proceso por PID (reemplazar <PID> con el número obtenido)
taskkill /PID <PID> /F

# Desactivar entorno virtual
deactivate
```

---

### Instalación en macOS/Linux

#### 1. Configurar Backend (Django)

```bash
cd "REST frameworks/ReservaProject"

# Instalar dependencias
pip3 install -r requirements.txt

# Crear base de datos PostgreSQL
createdb reservas_db

# Configurar variables de entorno locales
cp .env.example .env
# Edita .env con tus claves reales (SECRET_KEY, FIELD_ENCRYPTION_KEY y credenciales de DB)

# Ejecutar migraciones
python3 manage.py makemigrations
python3 manage.py migrate

# Crear superusuario (opcional)
python3 manage.py createsuperuser

# Iniciar servidor
python3 manage.py runserver
```

> Nota: `.env` está ignorado por Git. Usa `.env.example` como base y nunca subas tus credenciales reales.

El servidor estará disponible en: `http://localhost:8000`

#### 2. Configurar Frontend (React)

```bash
cd Reservas

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará disponible en: `http://localhost:5173` (o puerto asignado por Vite)

## 🗄️ Estructura de la Base de Datos

### Modelos Principales

#### **User** (Django auth)
- Modelo de autenticación de Django
- Campos: username, email, password

#### **Perfil**
- Extiende User con información adicional
- **Campos**:
  - `rol`: admin | cajero | mesero | cliente
  - `nombre_completo`: Nombre completo del usuario
  - `rut`: RUT (encriptado con Fernet)
  - `telefono`: Teléfono (encriptado con Fernet)
  - `email`: Email adicional

#### **Mesa**
- **Campos**:
  - `numero`: Número de mesa (único)
  - `capacidad`: Capacidad de personas
  - `estado`: disponible | reservada | ocupada | limpieza

#### **Reserva**
- **Campos**:
  - `cliente`: FK a User
  - `mesa`: FK a Mesa
  - `fecha_reserva`: Fecha de la reserva
  - `hora_inicio`: Hora de inicio (formato 24hrs)
  - `hora_fin`: Hora de finalización (formato 24hrs)
  - `num_personas`: Número de personas
  - `estado`: pendiente | activa | completada | cancelada
  - `notas`: Notas adicionales

## 🔐 Seguridad y Encriptación

### Campos Encriptados

El sistema utiliza **django-encrypted-model-fields** con **Fernet (AES-128)** para encriptar datos sensibles:

- **RUT del usuario**
- **Teléfono del usuario**

**Configuración en `settings.py`:**
```python
# Clave de encriptación (debe estar en variable de entorno en producción)
FIELD_ENCRYPTION_KEY = os.environ.get(
    'FIELD_ENCRYPTION_KEY',
    '4GmvO9dDiZCcJ-B1PglnW5nwn5pkQK3E5jYU-F517W0='
)
```

**Generar nueva clave de encriptación:**
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

⚠️ **IMPORTANTE**: En producción, la clave DEBE estar en una variable de entorno y NUNCA en el código.

### Autenticación

- **Token-based authentication** con Django REST Framework
- Permisos basados en roles (admin, cajero, mesero, cliente)

## 📡 API Endpoints

### Autenticación

```
POST   /api/login/          - Login de usuario
POST   /api/register/       - Registro de usuario
GET    /api/perfil/         - Obtener perfil del usuario actual
```

### Mesas

```
GET    /api/mesas/          - Listar mesas (admin/cajero/mesero)
GET    /api/consultar-mesas/ - Consultar mesas disponibles (todos)
PATCH  /api/mesas/{id}/     - Actualizar mesa (admin)
```

### Reservas

```
GET    /api/reservas/                    - Listar reservas
POST   /api/reservas/                    - Crear reserva
GET    /api/reservas/{id}/               - Detalle de reserva
PATCH  /api/reservas/{id}/cambiar_estado/ - Cambiar estado
DELETE /api/reservas/{id}/               - Eliminar reserva
```

**Filtros disponibles:**
- `?fecha_reserva=YYYY-MM-DD` - Filtrar por fecha
- `?estado=pendiente|activa|completada|cancelada` - Filtrar por estado
- `?date=today` - Reservas del día actual

### Usuarios (Solo Admin)

```
GET    /api/usuarios/                    - Listar usuarios
PATCH  /api/usuarios/{id}/cambiar-rol/   - Cambiar rol de usuario
```

## ✅ Validaciones Implementadas

### Frontend (React)

- Login: campos vacíos, mínimo 3 caracteres usuario, mínimo 4 caracteres password
- Reserva: formato hora 24hrs (HH:MM), fecha no pasada, hora fin > hora inicio
- Reserva: capacidad de mesa no excedida
- Todos los campos obligatorios validados

### Backend (Django)

- **Modelo Reserva**:
  - Hora fin > hora inicio
  - Fecha no puede ser en el pasado
  - Capacidad de mesa no excedida
  - Mínimo 1 persona
  - **No solapamiento de horarios** (misma mesa, misma fecha)

- **Serializers**:
  - Validación de todos los campos del modelo
  - Mensajes de error personalizados en español

## 👥 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **Cliente** | Ver y crear sus propias reservas |
| **Mesero** | Ver reservas del día, gestionar estados de mesas |
| **Cajero** | Ver y gestionar todas las reservas, cambiar estados |
| **Admin** | Acceso completo: usuarios, mesas, reservas |

## 🎨 Características del Frontend

### Componentes Principales

- **LoginForm**: Autenticación de usuarios
- **FormularioReserva**: Crear nuevas reservas (clientes)
- **MisReservas**: Ver reservas propias (clientes)
- **PanelReservas**: Ver todas las reservas (cajero/admin)
- **GestionMesas**: Gestionar estados de mesas (mesero/admin)
- **GestionUsuarios**: Gestionar usuarios y roles (admin)

### Navegación por Rol

La interfaz se adapta según el rol del usuario:

- **Cliente**: Mis Reservas | Nueva Reserva
- **Mesero**: Reservas del Día | Gestión de Mesas
- **Cajero**: Reservas del Día | Gestión de Mesas | Panel de Reservas
- **Admin**: Todo lo anterior + Gestión de Usuarios

## 🕐 Formato de Horas

El sistema usa **formato militar de 24 horas** (estándar chileno):
- Input: `14:30` (no AM/PM)
- Display: `14:30 hrs`
- Backend: `14:30:00`

## 🔄 Estados del Sistema

### Estados de Mesa
- **disponible**: Mesa lista para uso
- **reservada**: Mesa con reserva confirmada
- **ocupada**: Mesa actualmente ocupada
- **limpieza**: Mesa en proceso de limpieza

### Estados de Reserva
- **pendiente**: Reserva confirmada, esperando llegada
- **activa**: Cliente ha llegado, mesa ocupada
- **completada**: Reserva finalizada
- **cancelada**: Reserva cancelada

## 🔧 Configuración CORS

El backend permite conexiones desde:
- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`

Para agregar más orígenes, editar `CORS_ALLOWED_ORIGINS` en `settings.py`.

## 📝 Datos de Prueba

### Usuarios por defecto (si fueron creados)

```python
# Ejecutar en shell de Django: python3 manage.py shell

from django.contrib.auth.models import User
from mainApp.models import Perfil

# Cliente
user1 = User.objects.create_user(username='cliente1', password='cliente123')
Perfil.objects.create(user=user1, rol='cliente', nombre_completo='Cliente Uno')

# Mesero
user2 = User.objects.create_user(username='mesero1', password='mesero123')
Perfil.objects.create(user=user2, rol='mesero', nombre_completo='Mesero Uno')

# Cajero
user3 = User.objects.create_user(username='cajero1', password='cajero123')
Perfil.objects.create(user=user3, rol='cajero', nombre_completo='Cajero Uno')

# Admin
user4 = User.objects.create_user(username='admin', password='admin123', is_staff=True, is_superuser=True)
Perfil.objects.create(user=user4, rol='admin', nombre_completo='Administrador')
```

## 🚨 Problemas Comunes

### Error de encriptación al iniciar

```
django.core.exceptions.ImproperlyConfigured: FIELD_ENCRYPTION_KEY defined incorrectly
```

**Solución**: Verifica que `.env` contenga una clave válida (32 bytes base64):
```bash
FIELD_ENCRYPTION_KEY=4GmvO9dDiZCcJ-B1PglnW5nwn5pkQK3E5jYU-F517W0=
```
Si necesitas una nueva clave, genera una con `from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())`.

### Puerto 8000 ya en uso

```bash
# Matar proceso en puerto 8000
lsof -ti:8000 | xargs kill -9
```

### CORS errors en frontend

Verificar que el puerto del frontend esté en `CORS_ALLOWED_ORIGINS` en `settings.py`.

## 📦 Dependencias Completas

### Backend (`requirements.txt`)

```
Django==5.2.7
djangorestframework==3.16.1
psycopg2-binary==2.9.10
django-encrypted-model-fields==0.6.5
django-cors-headers==4.6.0
django-filter==24.3
cryptography==46.0.3
```

### Frontend (`package.json`)

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "bootstrap": "^5.3.0",
    "bootstrap-icons": "^1.11.0"
  },
  "devDependencies": {
    "vite": "^7.2.2",
    "@vitejs/plugin-react": "^4.3.4"
  }
}
```

## 📄 Licencia

Este proyecto fue desarrollado como parte del Sprint 3 del módulo de reservas.

## 👨‍💻 Desarrolladores

- Equipo de desarrollo Sprint 3
- Implementación de encriptación y validaciones: Claude Code

---

**Última actualización**: Noviembre 2025
