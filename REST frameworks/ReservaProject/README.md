# Sistema Integral de Gestión de Restaurante

Sistema web completo para la gestión integral de un restaurante, incluyendo reservas, mesas, menú, stock de ingredientes, pedidos y cocina en tiempo real.

---

## Descripción General

Este sistema permite gestionar todas las operaciones de un restaurante desde una única plataforma:

| Módulo | Descripción |
|--------|-------------|
| **Reservas** | Gestión de reservas públicas y con cuenta, validación de horarios |
| **Mesas** | Control de disponibilidad, estados y bloqueos temporales |
| **Menú** | Catálogo de platos con categorías, precios e imágenes |
| **Stock** | Inventario de ingredientes con alertas de stock mínimo |
| **Pedidos** | Creación de pedidos asociados a mesas con múltiples platos |
| **Cocina** | Panel en tiempo real con WebSockets para gestión de pedidos |

---

## Tecnologías

### Backend
- Django 5.2.7
- Django REST Framework 3.16.1
- Django Channels 4.0.0 (WebSockets)
- PostgreSQL (Railway)
- Redis (para WebSockets)

### Frontend
- React 19
- Vite 7
- React Bootstrap 5
- WebSockets nativos

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend React                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Reservas │ │  Mesas   │ │   Menú   │ │ Pedidos  │ │ Cocina │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Django REST API                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐│
│  │ mainApp  │ │ menuApp  │ │cocinaApp │ │ Django Channels (WS) ││
│  │ Reservas │ │  Platos  │ │ Pedidos  │ │   Tiempo Real        ││
│  │  Mesas   │ │  Stock   │ │  Cola    │ │                      ││
│  │ Usuarios │ │ Recetas  │ │          │ │                      ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + Redis                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Módulos del Sistema

### 1. Reservas

**Funcionalidades:**
- Reservas públicas sin necesidad de cuenta
- Reservas con cuenta de usuario
- Validación automática de solapamientos
- Turnos de 2 horas
- Email de confirmación con link de acceso
- Activación de cuenta desde reserva de invitado

**Estados de Reserva:**
`pendiente` → `activa` → `completada` / `cancelada`

### 2. Mesas

**Funcionalidades:**
- CRUD de mesas con capacidad
- Estados dinámicos (disponible, reservada, ocupada, limpieza)
- Sistema de bloqueos temporales (mantenimiento, eventos, reparaciones)
- Bloqueos por rango de fechas o día completo

**Estados de Mesa:**
`disponible` | `reservada` | `ocupada` | `limpieza`

### 3. Menú

**Funcionalidades:**
- Categorías de platos (Entradas, Platos Principales, Postres, etc.)
- Platos con precio, descripción, imagen y tiempo de preparación
- Recetas que vinculan platos con ingredientes
- Verificación automática de disponibilidad según stock

**Modelos:**
```
CategoriaMenu → Plato → Receta → Ingrediente
```

### 4. Stock de Ingredientes

**Funcionalidades:**
- Inventario de ingredientes con unidades de medida
- Stock mínimo configurable por ingrediente
- Alertas de stock bajo
- Descuento automático al crear pedidos
- Reversión de stock al cancelar pedidos

**Operaciones atómicas:** Usa `F()` de Django para evitar race conditions.

### 5. Pedidos

**Funcionalidades:**
- Crear pedidos asociados a mesas
- Múltiples platos por pedido con cantidades
- Notas especiales por plato
- Precio snapshot (guarda precio al momento del pedido)
- Validación de stock antes de confirmar

**Estados de Pedido:**
```
CREADO → EN_PREPARACION → LISTO → ENTREGADO
   ↓           ↓            ↓
   └───────────┴────────────┴──→ CANCELADO

También: CREADO → URGENTE → EN_PREPARACION...
```

### 6. Panel de Cocina

**Funcionalidades:**
- Cola de pedidos en tiempo real (WebSockets)
- Filtros por estado (urgentes, en preparación, listos)
- Cambio de estado con un clic
- Tiempo transcurrido por pedido
- Reconexión automática de WebSocket

---

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **Cliente** | Ver menú, hacer reservas, ver sus reservas |
| **Mesero** | Reservas del día, gestión de mesas, crear pedidos, ver cocina |
| **Cajero** | Todo de mesero + todas las reservas, crear pedidos |
| **Admin** | Acceso completo: usuarios, mesas, menú, stock, bloqueos, cocina |

---

## Instalación

### Requisitos
- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis (para WebSockets en producción)

### Backend

```bash
cd "REST frameworks/ReservaProject"

# Instalar dependencias
pip3 install -r requirements.txt

# Configurar variable de entorno
export DATABASE_URL="postgresql://usuario:password@host:puerto/basedatos"

# Ejecutar migraciones
python3 manage.py migrate

# Crear superusuario
python3 manage.py createsuperuser

# Iniciar servidor
python3 manage.py runserver
```

### Frontend

```bash
cd Reservas

# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Producción
npm run build
```

---

## Endpoints de la API

### Autenticación
```
POST /api/login/                      Iniciar sesión
POST /api/register-and-reserve/       Registrar y reservar
POST /api/activar-cuenta/             Activar cuenta
```

### Reservas
```
GET  /api/reservas/                   Listar reservas
POST /api/reservas/                   Crear reserva
GET  /api/horas-disponibles/          Horarios disponibles
```

### Mesas
```
GET  /api/mesas/                      Listar mesas
GET  /api/mesas/?fecha=&hora=         Mesas disponibles
```

### Bloqueos (Admin)
```
GET    /api/bloqueos/                 Listar bloqueos
POST   /api/bloqueos/                 Crear bloqueo
PATCH  /api/bloqueos/{id}/            Actualizar
DELETE /api/bloqueos/{id}/            Eliminar
```

### Menú
```
GET  /api/menu/categorias/            Listar categorías
GET  /api/menu/platos/                Listar platos
GET  /api/menu/platos/?disponible=true Platos disponibles
POST /api/menu/platos/                Crear plato (admin)
```

### Ingredientes/Stock (Admin)
```
GET  /api/menu/ingredientes/          Listar ingredientes
GET  /api/menu/ingredientes/?bajo_stock=true  Bajo stock mínimo
POST /api/menu/ingredientes/          Crear ingrediente
PATCH /api/menu/ingredientes/{id}/    Actualizar stock
```

### Cocina/Pedidos
```
GET  /api/cocina/pedidos/             Listar pedidos
POST /api/cocina/pedidos/             Crear pedido
GET  /api/cocina/cola/                Cola de cocina (activos)
POST /api/cocina/pedidos/{id}/estado/ Cambiar estado
```

### WebSocket
```
WS /ws/cocina/                        Notificaciones tiempo real
```

---

## Estructura del Proyecto

```
modulo_reservas/
├── REST frameworks/ReservaProject/   # Backend Django
│   ├── mainApp/                      # Reservas, mesas, usuarios
│   ├── menuApp/                      # Menú, ingredientes, recetas
│   ├── cocinaApp/                    # Pedidos, cola de cocina
│   └── ReservaProject/               # Configuración Django
│
└── Reservas/                         # Frontend React
    └── src/
        ├── components/
        │   ├── menu/                 # MenuPublico, GestionMenu, GestionStock
        │   └── cocina/               # PanelCocina, CrearPedido
        ├── services/                 # APIs (menuApi, cocinaApi)
        └── hooks/                    # useWebSocket
```

---

## Flujo de Operación Típico

```
1. Cliente hace reserva → Reserva confirmada
                              ↓
2. Cliente llega → Mesero cambia reserva a "activa"
                              ↓
3. Mesero crea pedido desde la mesa
                              ↓
4. Pedido aparece en Panel de Cocina (WebSocket)
                              ↓
5. Cocina cambia estado: EN_PREPARACION → LISTO
                              ↓
6. Mesero entrega → ENTREGADO
                              ↓
7. Stock se descuenta automáticamente
   Platos sin stock se marcan como no disponibles
```

---

## Validaciones Implementadas

### Reservas
- Fecha no puede ser pasada
- No permite solapamiento de horarios
- Capacidad de mesa respetada
- Mesas bloqueadas no disponibles

### Pedidos
- Stock validado antes de crear
- Transiciones de estado controladas
- Precio guardado como snapshot

### Stock
- Descuento atómico con `select_for_update()`
- Reversión completa al cancelar
- Actualización automática de disponibilidad de platos

---

## Seguridad

- Datos sensibles encriptados (RUT, teléfono)
- Autenticación por token
- Permisos por rol en cada endpoint
- CORS configurado para frontend

---

## Despliegue en Railway

El sistema está configurado para desplegarse en Railway:

```
DATABASE_URL=postgresql://...        # PostgreSQL de Railway
REDIS_URL=redis://...                # Redis para WebSockets
FIELD_ENCRYPTION_KEY=...             # Clave de encriptación
```

---

## Comandos Útiles

```bash
# Generar mesas de ejemplo
python3 manage.py shell -c "
from mainApp.models import Mesa
for i in range(1, 7):
    Mesa.objects.get_or_create(numero=i, defaults={'capacidad': 4})
"

# Ejecutar tests
python3 manage.py test cocinaApp.tests

# Ver migraciones pendientes
python3 manage.py showmigrations
```

---

## Integración de Repositorios Externos

Este sistema integra funcionalidades de múltiples repositorios, adaptándolas a una arquitectura unificada con Django + React.

### Repositorio 1: Menú y Stock de Ingredientes
**Fuente:** [github.com/F0b10n269/-Men-y-Stock-de-Ingredientes](https://github.com/F0b10n269/-Men-y-Stock-de-Ingredientes)

| Funcionalidad Original | Adaptación Realizada |
|------------------------|---------------------|
| Modelo `Ingrediente` básico | Extendido con `stock_minimo`, `precio_unitario`, propiedad `bajo_stock` |
| Modelo `Plato` simple | Agregado `tiempo_preparacion`, `imagen`, FK a `CategoriaMenu` |
| Relación plato-ingrediente | Implementado como modelo `Receta` con `cantidad_requerida` |
| Sin gestión de stock | Descuento atómico con `F()` y `select_for_update()` |
| Sin disponibilidad automática | Método `verificar_disponibilidad()` en Plato |

**Archivos creados en menuApp:**
- `models.py` - CategoriaMenu, Ingrediente, Plato, Receta
- `serializers.py` - Serializers con campos calculados
- `views.py` - ViewSets con filtros django-filter
- `filters.py` - IngredienteFilter, PlatoFilter

### Repositorio 2: Módulo de Cocina (appPedidos)
**Fuente:** [github.com/lizcalizaya/Modulo-4---repositorio-restaurante](https://github.com/lizcalizaya/Modulo-4---repositorio-restaurante)

| Funcionalidad Original | Adaptación Realizada |
|------------------------|---------------------|
| Estados básicos de pedido | Agregado estado `URGENTE`, transiciones controladas |
| Sin relación con mesas reales | FK a `mainApp.Mesa` (obligatoria) |
| Sin relación con reservas | FK a `mainApp.Reserva` (opcional) |
| Pedido con un solo plato | Modelo `DetallePedido` para múltiples platos |
| Sin precio histórico | Campo `precio_unitario` snapshot en DetallePedido |
| Sin WebSockets | Implementado Django Channels para tiempo real |
| Sin integración con stock | Servicio `PedidoService` con descuento/reversión atómico |

**Archivos creados en cocinaApp:**
- `models.py` - Pedido, DetallePedido, EstadoPedido, TRANSICIONES_VALIDAS
- `services.py` - PedidoService con lógica transaccional
- `consumers.py` - CocinaConsumer para WebSockets
- `routing.py` - Rutas WebSocket

### Repositorio 3: Gestor de Pedidos
**Fuente:** [github.com/Zhertx/Restaurant_Gestor_de_pedidos](https://github.com/Zhertx/Restaurant_Gestor_de_pedidos)

| Funcionalidad Original | Estado |
|------------------------|--------|
| CRUD de pedidos | Ya implementado en cocinaApp (más robusto) |
| Estados CREADO → CERRADO | Ya implementado con más estados |
| Mocks de stock | Reemplazado por integración real con menuApp |
| UI Django templates | Reemplazado por frontend React |
| UUID como PK | Mantenido Integer autoincrement |

**Resultado:** No se requirió integración adicional. La funcionalidad ya existía de forma más completa.

### Resumen de Integración

```
Repositorio Original          →  Sistema Integrado
─────────────────────────────────────────────────────
Menú y Stock (repo 1)         →  menuApp/
  - Ingredientes simples      →  Ingredientes con stock mínimo
  - Platos básicos            →  Platos con categorías y recetas
  - Sin stock dinámico        →  Descuento atómico F()

Cocina appPedidos (repo 2)    →  cocinaApp/
  - Pedido simple             →  Pedido + DetallePedido
  - Sin tiempo real           →  WebSockets con Channels
  - Sin integración           →  FK a Mesa, Reserva, User

Gestor de Pedidos (repo 3)    →  (No integrado)
  - Funcionalidad duplicada   →  Ya existía en cocinaApp
```

### Frontend React Integrado

Componentes creados para las nuevas funcionalidades:

```
src/components/
├── menu/
│   ├── MenuPublico.jsx      # Vista del menú para clientes
│   ├── GestionMenu.jsx      # Admin: CRUD de platos y categorías
│   └── GestionStock.jsx     # Admin: inventario de ingredientes
└── cocina/
    ├── PanelCocina.jsx      # Cola de pedidos en tiempo real
    └── CrearPedido.jsx      # Crear pedido desde mesa

src/services/
├── menuApi.js               # API de menú e ingredientes
└── cocinaApi.js             # API de pedidos + estados

src/hooks/
└── useWebSocket.js          # Hook para conexión WebSocket
```

---

## Changelog

### Diciembre 2024
- Integración de repositorios externos (Menú, Stock, Cocina)
- Sistema de menú con categorías y platos
- Gestión de ingredientes y stock con alertas
- Recetas (relación plato-ingrediente con cantidades)
- Pedidos con múltiples detalles y precio snapshot
- Panel de cocina en tiempo real (WebSockets)
- Descuento/reversión automático de stock
- Frontend React para menú, stock y cocina

### Noviembre 2024
- Sistema de bloqueo de mesas
- Bloqueos por rango de fechas
- Categorización de bloqueos

### Octubre 2024
- Sistema base de reservas
- Gestión de mesas
- Roles de usuario
- Frontend React

---

**Proyecto Universitario** - Ingeniería de Software
