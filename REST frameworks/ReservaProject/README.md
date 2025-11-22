# 🍽️ Sistema de Reservas de Restaurante

**Proyecto Universitario - Sistema de Gestión de Reservas**

Sistema web completo para gestionar reservas de un restaurante, desarrollado con Django REST Framework (backend) y React (frontend).

---

## 📚 Descripción del Proyecto

Este sistema permite a un restaurante gestionar sus reservas de forma eficiente con las siguientes funcionalidades:

- **Reservas públicas**: Los clientes pueden hacer reservas sin necesidad de crear cuenta
- **Sistema de usuarios**: Opción de crear cuenta para gestionar múltiples reservas
- **Gestión de mesas**: Control de disponibilidad y estados de las mesas
- **Bloqueos de mesas**: Sistema administrativo para bloquear mesas por mantenimiento, eventos o reparaciones
- **Roles de usuario**: Cliente, Mesero, Cajero y Administrador
- **Validación de horarios**: Prevención de solapamientos y reservas duplicadas

---

## 🚀 Tecnologías Utilizadas

### Backend
- **Django 5.2.7** - Framework web de Python
- **Django REST Framework** - Para crear la API REST
- **PostgreSQL** - Base de datos
- **Token Authentication** - Sistema de autenticación

### Frontend
- **React 19** - Librería de JavaScript para interfaces
- **Vite** - Herramienta de desarrollo rápida
- **React Bootstrap 5** - Componentes de Bootstrap para React
- **Bootstrap 5** - Framework CSS para estilos
- **React Router** - Navegación entre páginas

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- Python 3.13 o superior
- PostgreSQL
- Node.js 18 o superior
- npm (viene con Node.js)

---

## 🔧 Instalación y Configuración

### Paso 1: Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd modulo_reservas
```

### Paso 2: Configurar el Backend (Django)

```bash
# Navegar a la carpeta del backend
cd "REST frameworks/ReservaProject"

# Instalar dependencias de Python
pip3 install -r requirements.txt

# Crear base de datos PostgreSQL
createdb reservas_db

# Ejecutar migraciones
python3 manage.py migrate

# (Opcional) Crear un superusuario para acceder al admin
python3 manage.py createsuperuser

# Iniciar el servidor de desarrollo
python3 manage.py runserver
```

El servidor backend estará disponible en: **http://localhost:8000**

### Paso 3: Configurar el Frontend (React)

En una **nueva terminal**:

```bash
# Navegar a la carpeta del frontend
cd Reservas

# Instalar dependencias de Node
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

El frontend estará disponible en: **http://localhost:5173**

---

## 🎯 Funcionalidades Principales

### 1. Reservas sin Cuenta (Invitados)

Los clientes pueden hacer reservas sin crear cuenta:
- Completan un formulario con sus datos
- Reciben un email con un link único para gestionar su reserva
- Pueden cancelar su reserva con el link
- Opción de activar cuenta después

### 2. Reservas con Cuenta (Usuarios Registrados)

Los usuarios pueden crear una cuenta para:
- Ver todas sus reservas en un solo lugar
- Crear nuevas reservas más rápidamente
- Editar o cancelar reservas fácilmente
- No necesitan links de acceso

### 3. Panel de Administración (Staff)

Diferentes niveles de acceso según el rol:

- **Mesero**: Ver reservas del día, gestionar mesas
- **Cajero**: Ver y gestionar todas las reservas
- **Administrador**: Acceso completo al sistema, incluyendo gestión de bloqueos

### 4. Bloqueos de Mesas (Solo Administradores)

Los administradores pueden bloquear mesas para:
- **Mantenimiento programado**: Reparaciones, limpieza profunda
- **Eventos privados**: Reservas especiales, eventos corporativos
- **Reparaciones urgentes**: Bloqueo temporal por daños
- **Otros motivos**: Cualquier situación que requiera bloquear una mesa

**Características de los bloqueos**:
- Bloqueos por rango de fechas
- Bloqueos de día completo o por horario específico
- Categorización (mantenimiento, evento privado, reparación, etc.)
- Motivo y notas descriptivas
- Activación/desactivación sin eliminación
- Las mesas bloqueadas NO aparecen como disponibles para reservas

---

## 📊 Estructura de la Base de Datos

### Modelos Principales

#### Mesa
- Número de mesa
- Capacidad (número de personas)
- Estado (disponible, reservada, ocupada, limpieza)

#### Reserva
- Cliente (usuario)
- Mesa asignada
- Fecha y hora (inicio y fin)
- Número de personas
- Estado (pendiente, activa, completada, cancelada)
- Notas adicionales

#### Perfil de Usuario
- Rol (cliente, mesero, cajero, admin)
- Datos personales (RUT y teléfono encriptados)
- Información de contacto

#### Bloqueo de Mesa
- Mesa bloqueada
- Rango de fechas (inicio y fin)
- Horario específico (opcional, día completo si no se especifica)
- Motivo del bloqueo
- Categoría (mantenimiento, evento privado, reparación, reserva especial, otro)
- Notas adicionales
- Usuario que creó el bloqueo
- Estado activo/inactivo

---

## 🔐 Seguridad

El sistema implementa varias medidas de seguridad:

- **Encriptación**: Los datos sensibles (RUT, teléfono) se encriptan en la base de datos
- **Autenticación por token**: Sistema seguro de inicio de sesión
- **Validación de datos**: En frontend y backend
- **Prevención de solapamientos**: No permite reservas duplicadas

---

## 🎨 Uso del Sistema

### Para Clientes (Vista Pública)

1. Abre http://localhost:5173
2. Completa el formulario de reserva
3. Opcional: Marca "Quiero crear una cuenta" para acceso completo
4. Recibirás un email de confirmación

### Para Staff (Vista Interna)

1. Haz clic en "Iniciar Sesión"
2. Ingresa tus credenciales
3. Accede a las funciones según tu rol

---

## 📱 Endpoints de la API

### Autenticación
```
POST /api/login/                    - Iniciar sesión
POST /api/register-and-reserve/     - Registrar y reservar
POST /api/activar-cuenta/           - Activar cuenta de invitado
```

### Reservas
```
GET  /api/reservas/                 - Listar reservas
POST /api/reservas/                 - Crear reserva
GET  /api/horas-disponibles/        - Ver horarios disponibles
GET  /api/reserva-invitado/:token/  - Ver reserva con token
```

### Mesas
```
GET  /api/mesas/                    - Listar mesas
GET  /api/mesas/?fecha=&hora=       - Mesas disponibles
```

### Bloqueos (Solo Administradores)
```
GET    /api/bloqueos/                      - Listar bloqueos
POST   /api/bloqueos/                      - Crear bloqueo
GET    /api/bloqueos/:id/                  - Ver detalle de bloqueo
PATCH  /api/bloqueos/:id/                  - Actualizar bloqueo
DELETE /api/bloqueos/:id/                  - Eliminar bloqueo
POST   /api/bloqueos/:id/activar/          - Activar bloqueo
POST   /api/bloqueos/:id/desactivar/       - Desactivar bloqueo
GET    /api/bloqueos/activos-hoy/          - Bloqueos activos para hoy
```

**Filtros disponibles para /api/bloqueos/**:
- `mesa_numero`: Filtrar por número de mesa
- `activo`: true/false - Filtrar por estado
- `categoria`: Filtrar por categoría de bloqueo
- `solo_activos`: true - Solo bloqueos activos
- `activos_en_fecha`: YYYY-MM-DD - Bloqueos activos en una fecha

---

## 🧪 Datos de Prueba

### Generar Mesas de Ejemplo

```bash
python3 manage.py shell

# Dentro del shell:
from mainApp.models import Mesa

for i in range(1, 7):
    capacidad = 2 if i <= 4 else 4
    Mesa.objects.create(numero=i, capacidad=capacidad, estado='disponible')

exit()
```

### Generar Reservas de Ejemplo

```bash
python3 manage.py generar_reservas_ejemplo --reservas-por-dia 20
```

---

## 📝 Validaciones Implementadas

### Validaciones de Reserva

- ✅ Fecha no puede ser en el pasado
- ✅ Hora de fin debe ser después de hora de inicio
- ✅ No puede exceder la capacidad de la mesa
- ✅ No permite solapamiento de horarios
- ✅ Turnos de 2 horas

### Validaciones de Usuario

- ✅ RUT válido con dígito verificador
- ✅ Teléfono en formato chileno (+56 9...)
- ✅ Email válido
- ✅ Contraseña segura (mínimo 8 caracteres)

---

## 🔄 Estados del Sistema

### Estados de Mesa
- **disponible**: Mesa lista para reservar
- **reservada**: Mesa con reserva confirmada
- **ocupada**: Mesa actualmente en uso
- **limpieza**: Mesa siendo limpiada

### Estados de Reserva
- **pendiente**: Reserva confirmada, cliente aún no llega
- **activa**: Cliente ha llegado
- **completada**: Reserva finalizada
- **cancelada**: Reserva cancelada

---

## 🛠️ Comandos Útiles

### Backend (Django)

```bash
# Crear migraciones después de cambios en models.py
python3 manage.py makemigrations

# Aplicar migraciones
python3 manage.py migrate

# Acceder al shell interactivo
python3 manage.py shell

# Crear superusuario
python3 manage.py createsuperuser

# Ver todas las migraciones
python3 manage.py showmigrations
```

### Frontend (React)

```bash
# Instalar nueva dependencia
npm install <nombre-paquete>

# Compilar para producción
npm run build

# Previsualizar build de producción
npm run preview
```

---

## 📦 Estructura del Proyecto

```
modulo_reservas/
├── REST frameworks/
│   └── ReservaProject/          # Backend Django
│       ├── mainApp/             # App principal
│       │   ├── models.py        # Modelos de BD
│       │   ├── views.py         # Vistas de la API
│       │   ├── serializers.py   # Serializadores
│       │   └── urls.py          # URLs de la app
│       ├── ReservaProject/      # Configuración
│       │   ├── settings.py      # Configuración
│       │   └── urls.py          # URLs principales
│       └── manage.py            # CLI de Django
│
└── Reservas/                    # Frontend React
    ├── src/
    │   ├── components/          # Componentes React
    │   ├── contexts/            # Context API
    │   ├── services/            # Llamadas a API
    │   └── App.jsx              # Componente principal
    └── package.json             # Dependencias npm
```

---

## 🐛 Solución de Problemas Comunes

### El servidor Django no inicia
```bash
# Verificar que PostgreSQL está corriendo
pg_isready

# Verificar que la base de datos existe
psql -l | grep reservas_db
```

### Error de CORS en el frontend
Verifica que en `settings.py` esté configurado:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
```

### Error de migraciones
```bash
# Resetear migraciones (solo en desarrollo)
python3 manage.py migrate mainApp zero
python3 manage.py migrate
```

---

## 📚 Recursos de Aprendizaje

- [Documentación de Django](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [React Docs](https://react.dev/)
- [Bootstrap 5](https://getbootstrap.com/docs/5.3/)

---

## 👥 Equipo de Desarrollo

**Proyecto Universitario** - Desarrollo de Aplicaciones Web

---

## 📄 Licencia

Este proyecto es de uso educativo para el curso de Desarrollo de Aplicaciones Web.

---

**Última actualización**: Noviembre 2025

### Changelog - Noviembre 2025

#### Nueva Funcionalidad: Sistema de Bloqueo de Mesas
- ✨ Los administradores pueden bloquear mesas temporalmente
- 🔒 Soporte para bloqueos de día completo o por horario específico
- 📅 Bloqueos por rango de fechas con validación de solapamientos
- 🏷️ Categorización de bloqueos (mantenimiento, eventos, reparaciones)
- 🔄 Activación/desactivación de bloqueos sin eliminación
- ✅ Integración automática con sistema de disponibilidad de mesas
- 📱 Interfaz completa en React Bootstrap con filtros y búsqueda
