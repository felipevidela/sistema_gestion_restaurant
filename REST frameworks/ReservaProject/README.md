# Sistema de Reservas de Restaurante

Sistema de gestión de reservas para restaurante desarrollado con Django REST Framework y React.

## 📸 Capturas de Pantalla

### Panel de Reservas del Día
![Panel de Reservas](../../docs/screenshots/screenshot-01.png)

### Gestión de Mesas
![Gestión de Mesas](../../docs/screenshots/screenshot-02.png)

### Formulario de Nueva Reserva
![Nueva Reserva](../../docs/screenshots/screenshot-03.png)

### Gestión de Usuarios (Admin)
![Gestión de Usuarios](../../docs/screenshots/screenshot-04.png)

### Vista de Mis Reservas (Cliente)
![Mis Reservas](../../docs/screenshots/screenshot-05.png)

### Reserva Pública (Sin autenticación)
![Reserva Pública](../../docs/screenshots/screenshot-06.png)

### Panel de Administración
![Panel Admin](../../docs/screenshots/screenshot-07.png)

### Login
![Login](../../docs/screenshots/screenshot-08.png)

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

### Instalación en Windows (Paso a Paso)

Esta guía te llevará desde cero hasta tener el sistema funcionando en Windows.

#### Paso 1: Instalar Python 3.13+

1. Ve a [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. Descarga la última versión de Python 3.13+ para Windows
3. **MUY IMPORTANTE**: Durante la instalación, marca la casilla **"Add Python to PATH"** antes de hacer clic en "Install Now"
4. Completa la instalación
5. Abre **PowerShell** o **CMD** y verifica la instalación:
   ```powershell
   python --version
   ```
   Debería mostrar: `Python 3.13.x`

6. Verifica que pip esté instalado:
   ```powershell
   pip --version
   ```

#### Paso 2: Instalar PostgreSQL

1. Ve a [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Descarga el instalador de PostgreSQL (versión 16 recomendada)
3. Ejecuta el instalador y sigue estos pasos:
   - **Puerto**: Deja el puerto por defecto (5432)
   - **Contraseña**: Elige una contraseña para el usuario `postgres` y **anótala** (la necesitarás después)
   - **Locale**: Deja la configuración regional por defecto
   - Instala todos los componentes (PostgreSQL Server, pgAdmin, Command Line Tools)

4. **Agregar PostgreSQL al PATH**:
   - Abre "Variables de entorno" en Windows (busca "variables de entorno" en el menú inicio)
   - En "Variables del sistema", busca la variable "Path" y haz clic en "Editar"
   - Haz clic en "Nuevo" y agrega: `C:\Program Files\PostgreSQL\16\bin`
   - Haz clic en "Aceptar" para guardar

5. Abre una **nueva** terminal PowerShell/CMD y verifica la instalación:
   ```powershell
   psql --version
   ```
   Debería mostrar la versión de PostgreSQL instalada

#### Paso 3: Crear la Base de Datos

1. Abre PowerShell o CMD
2. Conéctate a PostgreSQL (usa la contraseña que configuraste):
   ```powershell
   psql -U postgres
   ```
   Si te pide contraseña, ingresa la que configuraste durante la instalación

3. Dentro de psql (verás el prompt `postgres=#`), ejecuta:
   ```sql
   CREATE DATABASE reservas_db;
   ```

4. Verifica que la base de datos se creó:
   ```sql
   \l
   ```
   Deberías ver `reservas_db` en la lista

5. Sal de psql:
   ```sql
   \q
   ```

#### Paso 4: Instalar Node.js y npm

1. Ve a [https://nodejs.org/](https://nodejs.org/)
2. Descarga la versión LTS (Long Term Support) - actualmente Node.js 20+
3. Ejecuta el instalador con las opciones por defecto
4. Completa la instalación
5. Abre una **nueva** terminal PowerShell/CMD y verifica:
   ```powershell
   node --version
   npm --version
   ```

#### Paso 5: Descargar el Proyecto

Si tienes Git instalado:
```powershell
git clone https://github.com/felipevidela/modulo_reservas.git
cd modulo_reservas
```

Si no tienes Git, descarga el ZIP desde GitHub y descomprímelo.

#### Paso 6: Configurar el Backend (Django)

1. Abre PowerShell o CMD y navega a la carpeta del proyecto:
   ```powershell
   cd "C:\ruta\donde\descargaste\modulo_reservas"
   cd "REST frameworks\ReservaProject"
   ```

2. Crea un entorno virtual de Python:
   ```powershell
   python -m venv venv
   ```

3. Activa el entorno virtual:
   ```powershell
   .\venv\Scripts\activate
   ```
   Verás `(venv)` al inicio de la línea de comando

4. Instala Django y las dependencias:
   ```powershell
   pip install Django==5.2.7
   pip install djangorestframework==3.16.1
   pip install psycopg2-binary==2.9.10
   pip install django-encrypted-model-fields==0.6.5
   pip install django-cors-headers==4.6.0
   pip install django-filter==24.3
   pip install cryptography==46.0.3
   ```

   O instala todo desde el archivo requirements.txt:
   ```powershell
   pip install -r requirements.txt
   ```

5. Configura las variables de entorno:
   ```powershell
   copy .env.example .env
   ```

6. Edita el archivo `.env` con Notepad o tu editor preferido:
   ```powershell
   notepad .env
   ```

   Configura las siguientes variables:
   ```env
   SECRET_KEY=tu-clave-secreta-aqui
   FIELD_ENCRYPTION_KEY=4GmvO9dDiZCcJ-B1PglnW5nwn5pkQK3E5jYU-F517W0=
   DATABASE_NAME=reservas_db
   DATABASE_USER=postgres
   DATABASE_PASSWORD=tu-contraseña-de-postgres
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   ```

7. Ejecuta las migraciones de Django:
   ```powershell
   python manage.py makemigrations
   python manage.py migrate
   ```

8. (Opcional) Crea un superusuario para acceder al panel de admin:
   ```powershell
   python manage.py createsuperuser
   ```
   Sigue las instrucciones para crear el usuario

9. Inicia el servidor de Django:
   ```powershell
   python manage.py runserver
   ```

   Deberías ver:
   ```
   Starting development server at http://127.0.0.1:8000/
   ```

   ✅ **El backend está funcionando!** Déjalo corriendo y abre una nueva terminal para el frontend.

#### Paso 7: Configurar el Frontend (React)

1. Abre una **nueva** terminal PowerShell o CMD
2. Navega a la carpeta del frontend:
   ```powershell
   cd "C:\ruta\donde\descargaste\modulo_reservas"
   cd Reservas
   ```

3. Instala las dependencias de Node.js:
   ```powershell
   npm install
   ```
   Esto puede tomar unos minutos

4. Inicia el servidor de desarrollo:
   ```powershell
   npm run dev
   ```

   Deberías ver:
   ```
   VITE ready in XXX ms
   ➜  Local:   http://localhost:5173/
   ```

   ✅ **El frontend está funcionando!**

5. Abre tu navegador en [http://localhost:5173](http://localhost:5173)

#### 🎉 ¡Sistema Listo!

Ahora tienes:
- **Backend** corriendo en: http://localhost:8000
- **Frontend** corriendo en: http://localhost:5173
- **Base de datos** PostgreSQL configurada

#### Comandos Útiles para Windows

```powershell
# Ver qué proceso está usando el puerto 8000
netstat -ano | findstr :8000

# Matar un proceso por su PID (reemplaza <PID> con el número)
taskkill /PID <PID> /F

# Desactivar el entorno virtual de Python
deactivate

# Activar el entorno virtual (si lo cerraste)
.\venv\Scripts\activate
```

#### Problemas Comunes en Windows

**1. "python no se reconoce como comando"**
- Solución: Reinstala Python y asegúrate de marcar "Add Python to PATH"

**2. "psql no se reconoce como comando"**
- Solución: Agrega PostgreSQL al PATH (ver Paso 2, punto 4)

**3. Error al instalar psycopg2-binary**
- Solución: Instala Visual C++ Build Tools desde [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

**4. No puedo conectarme a PostgreSQL**
- Verifica que el servicio de PostgreSQL esté corriendo (busca "Servicios" en Windows)
- Verifica que la contraseña en `.env` sea correcta

**5. Puerto 8000 o 5173 ya está en uso**
- Usa los comandos de arriba para encontrar y matar el proceso

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
