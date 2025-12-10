# Arquitectura y Comunicación Inter-Módulos

> Documentación técnica exhaustiva del Sistema Integral de Gestión de Restaurante

**Última actualización:** Diciembre 2025
**Versión del sistema:** 1.0

---

## Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Módulos y Responsabilidades](#módulos-y-responsabilidades)
3. [Comunicación Frontend ↔ Backend](#comunicación-frontend--backend)
4. [Flujos de Datos por Caso de Uso](#flujos-de-datos-por-caso-de-uso)
5. [Endpoints por Módulo](#endpoints-por-módulo)
6. [Transiciones de Estado](#transiciones-de-estado)
7. [Modelo de Datos Relacional](#modelo-de-datos-relacional)
8. [Manejo de Errores](#manejo-de-errores)
9. [Paginación](#paginación)

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│              SISTEMA DE GESTIÓN DE RESTAURANTE              │
│                   Arquitectura REST Pura                     │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────┐   REST API    ┌─────────────────────┐
│    REACT FRONTEND     │ ◄───────────► │   DJANGO BACKEND    │
│      (Vite 7.2)       │  Token Auth   │    (Django 5.1)     │
│                       │               │                     │
│  ┌─────────────────┐  │               │  ┌───────────────┐  │
│  │  AuthContext    │  │               │  │   mainApp     │  │
│  │  ToastContext   │  │               │  │  (Reservas)   │  │
│  └─────────────────┘  │               │  │               │  │
│                       │               │  │ - Perfil      │  │
│  ┌─────────────────┐  │               │  │ - Mesa        │  │
│  │   Services:     │  │               │  │ - Reserva     │  │
│  │                 │  │               │  │ - BloqueoMesa │  │
│  │ - reservasApi   │──┼───────────────┼─►└───────────────┘  │
│  │ - menuApi       │──┼───────────────┼─►┌───────────────┐  │
│  │ - cocinaApi     │──┼───────────────┼─►│   menuApp     │  │
│  └─────────────────┘  │               │  │   (Menú)      │  │
│                       │               │  │               │  │
│  ┌─────────────────┐  │               │  │ - Categoria   │  │
│  │  Componentes:   │  │               │  │ - Ingrediente │  │
│  │                 │  │               │  │ - Plato       │  │
│  │ - PanelCocina   │  │               │  │ - Receta      │  │
│  │ - PanelMesero   │  │               │  └───────────────┘  │
│  │ - PanelReservas │  │               │  ┌───────────────┐  │
│  │ - GestionMenu   │  │               │  │  cocinaApp    │  │
│  │ - GestionStock  │  │               │  │  (Pedidos)    │  │
│  └─────────────────┘  │               │  │               │  │
│                       │               │  │ - Pedido      │  │
│  Actualización:       │               │  │ - DetallePed. │  │
│  - Polling: 30-60s    │               │  │ - Cancelación │  │
│  - Manual: Botones    │               │  └───────────────┘  │
│                       │               │                     │
│                       │               │   PostgreSQL DB     │
└───────────────────────┘               └─────────────────────┘

COMUNICACIÓN:
✅ REST API pura (73+ endpoints)
✅ Autenticación: DRF Token Authentication
✅ NO WebSockets (polling manual y automático)
✅ JSON para todas las requests/responses
```

---

## Módulos y Responsabilidades

### mainApp - Gestión de Reservas y Usuarios

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Autenticación, perfiles de usuario, reservas, mesas y bloqueos |
| **Modelos** | `Perfil`, `Mesa`, `Reserva`, `BloqueoMesa` |
| **Endpoints** | ~40 endpoints REST |
| **Responsabilidades** | - Sistema de autenticación (login, register, tokens)<br>- Gestión de perfiles con roles (admin, cajero, mesero, cliente)<br>- CRUD de mesas y consulta de disponibilidad<br>- CRUD de reservas con validación de horarios<br>- Bloqueos de mesa por mantenimiento/eventos<br>- Usuarios invitados con tokens de activación (48h) |
| **Frontend Consumer** | `reservasApi.js` |
| **Rutas Base** | `/api/login/`, `/api/register/`, `/api/reservas/`, `/api/mesas/`, `/api/bloqueos/` |

### menuApp - Gestión de Menú e Inventario

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Menú de platos, ingredientes, recetas y control de stock |
| **Modelos** | `CategoriaMenu`, `Ingrediente`, `Plato`, `Receta` |
| **Endpoints** | ~20 endpoints REST |
| **Responsabilidades** | - CRUD de categorías de menú<br>- CRUD de ingredientes con stock y alertas<br>- CRUD de platos con precio y tiempo de preparación<br>- Gestión de recetas (M2M plato-ingrediente con cantidades)<br>- Verificación de disponibilidad por stock<br>- Ajuste manual de inventario |
| **Frontend Consumer** | `menuApi.js` |
| **Rutas Base** | `/api/menu/categorias/`, `/api/menu/platos/`, `/api/menu/ingredientes/`, `/api/menu/recetas/` |

### cocinaApp - Gestión de Pedidos y Cocina

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Pedidos, estados de cocina, estadísticas y auditoría de cancelaciones |
| **Modelos** | `Pedido`, `DetallePedido`, `PedidoCancelacion` |
| **Endpoints** | ~15 endpoints REST |
| **Responsabilidades** | - CRUD de pedidos con múltiples platos<br>- Máquina de estados (CREADO → URGENTE → EN_PREPARACION → LISTO → ENTREGADO → CANCELADO)<br>- Cola de cocina en tiempo "real" (polling)<br>- Descuento/reversión transaccional de stock<br>- Auditoría de cancelaciones (quién, cuándo, por qué)<br>- Estadísticas de cocina y tiempos |
| **Frontend Consumer** | `cocinaApi.js` |
| **Rutas Base** | `/api/cocina/pedidos/`, `/api/cocina/cola/`, `/api/cocina/estadisticas/` |

---

## Comunicación Frontend ↔ Backend

### Autenticación y Gestión de Tokens

#### Obtención de Token

**Endpoint:** `POST /api/login/`

**Request:**
```json
{
  "username": "cliente@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "user_id": 5,
  "username": "cliente@example.com",
  "email": "cliente@example.com",
  "rol": "cliente",
  "rol_display": "Cliente",
  "nombre_completo": "Juan Pérez"
}
```

#### Uso del Token en Requests

Todas las requests autenticadas incluyen el header:

```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Token a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
}
```

#### Almacenamiento en Frontend

```javascript
// En localStorage (persistente entre sesiones)
localStorage.setItem('token', 'a1b2c3d4e5f6g7h8...');
localStorage.setItem('user', JSON.stringify({
  user_id: 5,
  username: 'cliente@example.com',
  rol: 'cliente',
  nombre_completo: 'Juan Pérez'
}));

// Función auxiliar en services
function getAuthToken() {
  return localStorage.getItem('token');
}

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Token ${token}` })
  };
}
```

### Actualización de Datos (Sin WebSockets)

#### Polling Automático

```javascript
// Ejemplo: PanelCocina.jsx
useEffect(() => {
  cargarPedidos(); // Carga inicial

  const interval = setInterval(() => {
    cargarPedidos(); // Actualización cada 60 segundos
  }, 60000);

  return () => clearInterval(interval); // Cleanup
}, [cargarPedidos]);
```

#### Intervalos por Componente

| Componente | Intervalo | Endpoint(s) Consultado(s) |
|------------|-----------|---------------------------|
| **PanelCocina** | 60 segundos | `GET /api/cocina/cola/` |
| **PanelPedidosMesero** | 30 segundos | `GET /api/cocina/pedidos/listos/`, contadores |
| **PanelReservas** | 30 segundos (opcional) | `GET /api/reservas/` (solo día actual) |
| **MisReservas** | 30 segundos (opcional) | `GET /api/reservas/` (solo día actual) |

#### Actualización Manual

Todos los paneles incluyen botón "Actualizar" que invoca la función de carga de datos inmediatamente:

```javascript
<Button onClick={cargarPedidos}>
  <i className="bi bi-arrow-clockwise"></i> Actualizar
</Button>
```

---

## Flujos de Datos por Caso de Uso

### Caso 1: Ciclo Completo de un Pedido

```
┌────────────────────────────────────────────────────────────────────┐
│                 FLUJO COMPLETO: PEDIDO                              │
└────────────────────────────────────────────────────────────────────┘

1️⃣  CLIENTE LLEGA AL RESTAURANTE
    ├─► Mesero consulta mesas disponibles
    └─► GET /api/consultar-mesas/?fecha=2025-12-25&hora=12:00

        Response:
        [
          {
            "id": 3,
            "numero": 3,
            "capacidad": 4,
            "estado": "disponible",
            "ubicacion": "Terraza"
          }
        ]

2️⃣  CREAR RESERVA (OPCIONAL)
    ├─► Si el cliente quiere asegurar la mesa
    └─► POST /api/reservas/
        Headers: Authorization: Token ...

        Request:
        {
          "mesa": 3,
          "fecha_reserva": "2025-12-25",
          "hora_inicio": "12:00",
          "hora_fin": "14:00",
          "num_personas": 4,
          "notas": "Sin mariscos"
        }

        Response:
        {
          "id": 25,
          "cliente_nombre_completo": "Juan Pérez",
          "mesa_numero": 3,
          "estado": "pendiente",
          "fecha_reserva": "2025-12-25",
          ...
        }

3️⃣  TOMAR PEDIDO
    ├─► Mesero consulta platos disponibles
    ├─► GET /api/menu/platos/?disponible=true
    │
    │   Response:
    │   [
    │     {
    │       "id": 10,
    │       "nombre": "Salmon Grillado",
    │       "precio": 15500,
    │       "disponible": true
    │     }
    │   ]
    │
    └─► Mesero crea el pedido
        POST /api/cocina/pedidos/
        Headers: Authorization: Token ...

        Request:
        {
          "mesa": 5,
          "reserva": 12,
          "notas": "Sin picante",
          "detalles": [
            {
              "plato": 10,
              "cantidad": 2,
              "notas": "Término medio"
            },
            {
              "plato": 15,
              "cantidad": 1
            }
          ]
        }

        ┌──────────────────────────────────────────────────┐
        │ BACKEND (Transacción Atómica):                   │
        │ 1. Crear Pedido (estado: CREADO)                 │
        │ 2. Crear DetallePedido para cada plato           │
        │ 3. Por cada plato:                               │
        │    - Obtener receta (ingredientes + cantidades)  │
        │    - Validar stock suficiente                    │
        │    - Descontar stock (F() para atomicidad)       │
        │ 4. Actualizar disponibilidad de platos           │
        │ 5. Si falla: Rollback completo                   │
        └──────────────────────────────────────────────────┘

        Response:
        {
          "id": 45,
          "mesa_numero": 5,
          "estado": "CREADO",
          "total": 43500,
          "detalles": [
            {
              "plato_nombre": "Salmon Grillado",
              "cantidad": 2,
              "precio_unitario": 15500,
              "subtotal": 31000
            },
            {
              "plato_nombre": "Ensalada César",
              "cantidad": 1,
              "precio_unitario": 12500,
              "subtotal": 12500
            }
          ],
          "fecha_creacion": "2025-12-10T14:30:00Z"
        }

4️⃣  COCINA PREPARA
    ├─► Cocinero ve cola de pedidos
    ├─► GET /api/cocina/cola/
    │
    │   Response:
    │   [
    │     {
    │       "id": 45,
    │       "estado": "CREADO",
    │       "mesa_numero": 5,
    │       "tiempo_desde_creacion": 2,
    │       "detalles": [...]
    │     }
    │   ]
    │
    ├─► (Opcional) Marca como URGENTE
    ├─► POST /api/cocina/pedidos/45/estado/
    │   Request: { "estado": "URGENTE" }
    │
    ├─► Inicia preparación
    ├─► POST /api/cocina/pedidos/45/estado/
    │   Request: { "estado": "EN_PREPARACION" }
    │
    └─► Termina preparación
        POST /api/cocina/pedidos/45/estado/
        Request: { "estado": "LISTO" }

        Response:
        {
          "id": 45,
          "estado": "LISTO",
          "fecha_listo": "2025-12-10T14:45:00Z",
          "tiempo_desde_creacion": 15,
          "transiciones_permitidas": ["ENTREGADO", "CANCELADO"]
        }

5️⃣  MESERO ENTREGA
    ├─► Mesero consulta pedidos listos
    ├─► GET /api/cocina/pedidos/listos/
    │
    │   Response (paginado):
    │   {
    │     "count": 5,
    │     "results": [
    │       {
    │         "id": 45,
    │         "estado": "LISTO",
    │         "mesa_numero": 5,
    │         "cliente_nombre": "Juan Pérez",
    │         "tiempo_desde_listo": 5,
    │         "detalles": [...]
    │       }
    │     ]
    │   }
    │
    └─► Marca como entregado
        POST /api/cocina/pedidos/45/estado/
        Request: { "estado": "ENTREGADO" }

        Response:
        {
          "id": 45,
          "estado": "ENTREGADO",
          "fecha_entregado": "2025-12-10T14:50:00Z",
          "tiempo_total": 20
        }

6️⃣  CANCELACIÓN (SI APLICA)
    └─► POST /api/cocina/pedidos/45/estado/
        Headers: Authorization: Token ...

        Request:
        {
          "estado": "CANCELADO",
          "motivo": "Cliente solicitó cancelación por tiempo de espera excesivo"
        }

        ┌──────────────────────────────────────────────────┐
        │ BACKEND (Transacción Atómica):                   │
        │ 1. Validar transición a CANCELADO                │
        │ 2. Validar motivo (≥10 caracteres)               │
        │ 3. Revertir stock de cada ingrediente            │
        │ 4. Cambiar estado a CANCELADO                    │
        │ 5. Crear PedidoCancelacion (auditoría):          │
        │    - Usuario que canceló                         │
        │    - Fecha y hora                                │
        │    - Motivo                                      │
        │    - Snapshot de productos (texto + JSON)       │
        │ 6. Actualizar disponibilidad de platos           │
        └──────────────────────────────────────────────────┘

        Response:
        {
          "id": 45,
          "estado": "CANCELADO",
          "cancelacion": {
            "cancelado_por_nombre": "María López",
            "fecha_cancelacion": "2025-12-10T15:00:00Z",
            "motivo": "Cliente solicitó cancelación por tiempo de espera excesivo",
            "mesa_numero": 5,
            "total_pedido": 43500,
            "productos_resumen": "2x Salmon Grillado, 1x Ensalada César",
            "productos_detalle": [
              {
                "plato_id": 10,
                "plato_nombre": "Salmon Grillado",
                "cantidad": 2,
                "precio_unitario": 15500,
                "subtotal": 31000
              }
            ]
          }
        }
```

### Caso 2: Reserva con Usuario Invitado

```
┌────────────────────────────────────────────────────────────────────┐
│         FLUJO: RESERVA CON USUARIO INVITADO (SIN CUENTA)            │
└────────────────────────────────────────────────────────────────────┘

1️⃣  CLIENTE REGISTRA Y RESERVA (ENDPOINT PÚBLICO)
    └─► POST /api/register-and-reserve/
        (Sin autenticación - público)

        Request:
        {
          "email": "nuevo@example.com",
          "nombre": "Ana",
          "apellido": "García",
          "rut": "12.345.678-9",
          "telefono": "+56912345678",
          "mesa": 3,
          "fecha_reserva": "2025-12-15",
          "hora_inicio": "12:00",
          "num_personas": 4,
          "notas": "Vegetariano"
        }

        ┌──────────────────────────────────────────────────┐
        │ BACKEND (Transacción Atómica):                   │
        │ 1. Crear User con password random                │
        │ 2. Crear Perfil:                                 │
        │    - es_invitado = True                          │
        │    - token_activacion = random(64 chars)         │
        │    - token_expira = now() + 48 horas             │
        │    - Encriptar RUT y teléfono                    │
        │ 3. Crear Reserva vinculada al User               │
        │ 4. Enviar email con token (simulado en dev)      │
        └──────────────────────────────────────────────────┘

        Response:
        {
          "user": {
            "id": 15,
            "username": "nuevo@example.com",
            "email": "nuevo@example.com"
          },
          "reserva": {
            "id": 30,
            "mesa_numero": 3,
            "fecha_reserva": "2025-12-15",
            "hora_inicio": "12:00",
            "estado": "pendiente"
          },
          "token_activacion": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
          "mensaje": "Reserva creada. Se envió email con enlace de activación."
        }

2️⃣  CLIENTE CONSULTA RESERVA (SIN LOGIN)
    └─► GET /api/reserva-invitado/{token}/
        (Sin autenticación - token en URL)

        Response:
        {
          "id": 30,
          "cliente_nombre_completo": "Ana García",
          "cliente_email": "nuevo@example.com",
          "cliente_telefono": "+56912345678",
          "mesa_numero": 3,
          "fecha_reserva": "2025-12-15",
          "hora_inicio": "12:00",
          "hora_fin": "14:00",
          "num_personas": 4,
          "estado": "pendiente",
          "notas": "Vegetariano",
          "token_valido_hasta": "2025-12-12T12:00:00Z"
        }

3️⃣  CLIENTE CANCELA RESERVA (SIN LOGIN)
    └─► DELETE /api/reserva-invitado/{token}/cancelar/
        (Sin autenticación - token en URL)

        Response:
        {
          "mensaje": "Reserva cancelada exitosamente",
          "reserva_cancelada": {
            "id": 30,
            "estado": "cancelada"
          }
        }

4️⃣  CLIENTE ACTIVA CUENTA (OPCIONAL)
    └─► POST /api/activar-cuenta/
        (Sin autenticación)

        Request:
        {
          "token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
          "password": "NewSecure123!@",
          "password_confirm": "NewSecure123!@"
        }

        Validación de Password:
        - Mínimo 8 caracteres
        - Al menos 1 mayúscula
        - Al menos 1 minúscula
        - Al menos 1 dígito
        - Al menos 1 carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)

        ┌──────────────────────────────────────────────────┐
        │ BACKEND:                                         │
        │ 1. Validar token (no expirado, no usado)         │
        │ 2. Validar password strength                     │
        │ 3. Actualizar User:                              │
        │    - set_password(password)                      │
        │ 4. Actualizar Perfil:                            │
        │    - token_usado = True                          │
        │    - es_invitado = False                         │
        │ 5. Generar token de autenticación DRF            │
        └──────────────────────────────────────────────────┘

        Response:
        {
          "mensaje": "Cuenta activada exitosamente",
          "token": "xyz789abc456def123...",
          "user": {
            "user_id": 15,
            "username": "nuevo@example.com",
            "rol": "cliente",
            "nombre_completo": "Ana García"
          }
        }
```

### Caso 3: Control de Stock e Inventario

```
┌────────────────────────────────────────────────────────────────────┐
│             FLUJO: GESTIÓN DE STOCK E INVENTARIO                    │
└────────────────────────────────────────────────────────────────────┘

1️⃣  ADMIN CREA PLATO CON RECETA
    ├─► Crear plato
    ├─► POST /api/menu/platos/
    │   Headers: Authorization: Token ... (admin)
    │
    │   Request:
    │   {
    │     "nombre": "Pasta Carbonara",
    │     "descripcion": "Pasta con salsa cremosa",
    │     "precio": 12500,
    │     "categoria": 2,
    │     "tiempo_preparacion": 15
    │   }
    │
    │   Response:
    │   {
    │     "id": 20,
    │     "nombre": "Pasta Carbonara",
    │     "precio": 12500,
    │     "disponible": true,
    │     "recetas": []
    │   }
    │
    └─► Agregar ingredientes a la receta

        POST /api/menu/platos/20/receta/
        Request: { "ingrediente": 5, "cantidad_requerida": 200 }
        (5 = Pasta, 200 gramos)

        POST /api/menu/platos/20/receta/
        Request: { "ingrediente": 8, "cantidad_requerida": 50 }
        (8 = Queso, 50 gramos)

        POST /api/menu/platos/20/receta/
        Request: { "ingrediente": 12, "cantidad_requerida": 100 }
        (12 = Crema, 100 ml)

2️⃣  VERIFICACIÓN DE DISPONIBILIDAD (AUTOMÁTICA)
    └─► GET /api/menu/platos/20/

        ┌──────────────────────────────────────────────────┐
        │ BACKEND ejecuta Plato.verificar_disponibilidad():│
        │                                                  │
        │ FOR receta IN plato.recetas.all():               │
        │     ingrediente = receta.ingrediente             │
        │     cantidad_req = receta.cantidad_requerida     │
        │     stock = ingrediente.cantidad_disponible      │
        │                                                  │
        │     IF stock < cantidad_req:                     │
        │         return False  # NO disponible            │
        │                                                  │
        │ return True  # Todos los ingredientes OK         │
        └──────────────────────────────────────────────────┘

        Response:
        {
          "id": 20,
          "nombre": "Pasta Carbonara",
          "disponible": true,
          "recetas": [
            {
              "ingrediente": {
                "id": 5,
                "nombre": "Pasta",
                "cantidad_disponible": 5000
              },
              "cantidad_requerida": 200
            },
            {
              "ingrediente": {
                "id": 8,
                "nombre": "Queso",
                "cantidad_disponible": 1500
              },
              "cantidad_requerida": 50
            },
            {
              "ingrediente": {
                "id": 12,
                "nombre": "Crema",
                "cantidad_disponible": 2000
              },
              "cantidad_requerida": 100
            }
          ]
        }

3️⃣  CREAR PEDIDO → DESCUENTA STOCK
    └─► POST /api/cocina/pedidos/

        Request:
        {
          "mesa": 5,
          "detalles": [
            {
              "plato": 20,
              "cantidad": 3
            }
          ]
        }

        ┌──────────────────────────────────────────────────┐
        │ BACKEND (Transacción Atómica con F()):           │
        │                                                  │
        │ @transaction.atomic                              │
        │ def crear_pedido_con_detalles():                 │
        │     pedido = Pedido.objects.create(...)          │
        │                                                  │
        │     FOR detalle IN detalles_data:                │
        │         plato = detalle['plato']                 │
        │         cantidad_pedida = detalle['cantidad']    │
        │                                                  │
        │         FOR receta IN plato.recetas.all():       │
        │             ingrediente = receta.ingrediente     │
        │             cantidad_necesaria =                 │
        │                 receta.cantidad_requerida ×      │
        │                 cantidad_pedida                  │
        │                                                  │
        │             # Validar stock                      │
        │             IF ingrediente.stock < cantidad_nec: │
        │                 raise ValidationError(           │
        │                     "Stock insuficiente"         │
        │                 )                                │
        │                                                  │
        │             # Descontar con F() (atomicidad)     │
        │             Ingrediente.objects.filter(          │
        │                 pk=ingrediente.pk                │
        │             ).update(                            │
        │                 cantidad_disponible=F(           │
        │                     'cantidad_disponible'        │
        │                 ) - cantidad_necesaria           │
        │             )                                    │
        │                                                  │
        │         DetallePedido.objects.create(...)        │
        │                                                  │
        │     # Actualizar disponibilidad de platos        │
        │     actualizar_disponibilidad_platos(pedido)     │
        │                                                  │
        │     return pedido                                │
        │                                                  │
        │ SI FALLA: Rollback automático (transaction)      │
        └──────────────────────────────────────────────────┘

        DESCUENTO REAL:
        - Pasta: 200g × 3 = 600g  → 5000 - 600 = 4400g
        - Queso: 50g × 3 = 150g   → 1500 - 150 = 1350g
        - Crema: 100ml × 3 = 300ml → 2000 - 300 = 1700ml

4️⃣  CANCELAR PEDIDO → REVIERTE STOCK
    └─► POST /api/cocina/pedidos/45/estado/

        Request:
        {
          "estado": "CANCELADO",
          "motivo": "Cliente cambió de opinión"
        }

        ┌──────────────────────────────────────────────────┐
        │ BACKEND (Transacción Atómica):                   │
        │                                                  │
        │ @transaction.atomic                              │
        │ def cancelar_pedido(pedido, usuario, motivo):    │
        │     # Revertir stock                             │
        │     FOR detalle IN pedido.detalles.all():        │
        │         FOR receta IN detalle.plato.recetas:     │
        │             cantidad_a_revertir =                │
        │                 receta.cantidad_requerida ×      │
        │                 detalle.cantidad                 │
        │                                                  │
        │             Ingrediente.objects.filter(          │
        │                 pk=receta.ingrediente_id         │
        │             ).update(                            │
        │                 cantidad_disponible=F(           │
        │                     'cantidad_disponible'        │
        │                 ) + cantidad_a_revertir          │
        │             )                                    │
        │                                                  │
        │     pedido.estado = 'CANCELADO'                  │
        │     pedido.save()                                │
        │                                                  │
        │     # Crear auditoría                            │
        │     PedidoCancelacion.objects.create(            │
        │         pedido=pedido,                           │
        │         cancelado_por=usuario,                   │
        │         motivo=motivo,                           │
        │         productos_detalle=[...]  # JSON          │
        │     )                                            │
        │                                                  │
        │     # Actualizar disponibilidad                  │
        │     actualizar_disponibilidad_platos(pedido)     │
        └──────────────────────────────────────────────────┘

        REVERSIÓN REAL:
        - Pasta: +600g  → 4400 + 600 = 5000g
        - Queso: +150g  → 1350 + 150 = 1500g
        - Crema: +300ml → 1700 + 300 = 2000ml

5️⃣  AJUSTAR STOCK MANUALMENTE
    └─► PATCH /api/menu/ingredientes/5/ajustar_stock/
        Headers: Authorization: Token ... (admin)

        Request:
        {
          "cantidad": 500
        }

        BACKEND:
        - Suma 500 a cantidad_disponible
        - Valida que resultado ≥ 0
        - Actualiza disponibilidad de platos que usan este ingrediente

        Response:
        {
          "id": 5,
          "nombre": "Pasta",
          "cantidad_disponible": 5500,
          "stock_minimo": 1000,
          "bajo_stock": false
        }

6️⃣  ALERTAS DE BAJO STOCK
    └─► GET /api/menu/ingredientes/bajo_minimo/
        Headers: Authorization: Token ...

        Response:
        [
          {
            "id": 12,
            "nombre": "Crema",
            "cantidad_disponible": 500,
            "stock_minimo": 1000,
            "unidad_medida": "ml",
            "bajo_stock": true
          },
          {
            "id": 15,
            "nombre": "Tomate",
            "cantidad_disponible": 200,
            "stock_minimo": 500,
            "unidad_medida": "gr",
            "bajo_stock": true
          }
        ]
```

---

## Endpoints por Módulo

### mainApp - Autenticación y Reservas

#### Autenticación

**Login**
```
POST /api/login/
Permission: AllowAny (público)
Rate Limit: 10 intentos/hora

Request:
{
  "username": "email@example.com",
  "password": "SecurePass123"
}

Response (200):
{
  "token": "abc123...",
  "user_id": 5,
  "username": "email@example.com",
  "rol": "cliente",
  "nombre_completo": "Juan Pérez"
}

Response (400):
{
  "error": "Credenciales inválidas"
}
```

**Register**
```
POST /api/register/
Permission: AllowAny (público)
Rate Limit: 5 intentos/hora

Request:
{
  "email": "nuevo@example.com",
  "username": "nuevo_usuario",
  "password": "SecurePass123!@",
  "password_confirm": "SecurePass123!@",
  "nombre": "Juan",
  "apellido": "Pérez",
  "rut": "12.345.678-9",
  "telefono": "+56912345678"
}

Response (201):
{
  "token": "xyz789...",
  "user": { "id": 10, "username": "nuevo_usuario", ... }
}
```

**Register and Reserve (Combo)**
```
POST /api/register-and-reserve/
Permission: AllowAny (público)
Rate Limit: 5 intentos/hora

Request:
{
  // Datos de usuario
  "email": "nuevo@example.com",
  "nombre": "Ana",
  "apellido": "García",
  "rut": "12.345.678-9",
  "telefono": "+56912345678",

  // Datos de reserva
  "mesa": 3,
  "fecha_reserva": "2025-12-15",
  "hora_inicio": "12:00",
  "num_personas": 4,
  "notas": "Vegetariano"
}

Response (201):
{
  "user": { "id": 15, "email": "nuevo@example.com", ... },
  "reserva": { "id": 30, "mesa_numero": 3, ... },
  "token_activacion": "abc123..."
}
```

#### Gestión de Perfil

**Get Profile**
```
GET /api/perfil/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Response (200):
{
  "id": 5,
  "user_id": 10,
  "rol": "cliente",
  "nombre_completo": "Juan Pérez",
  "rut": "12.345.678-9",
  "telefono": "+56912345678",
  "email": "juan@example.com",
  "es_invitado": false
}
```

**Update Profile**
```
PATCH /api/perfil/actualizar/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Request:
{
  "nombre": "Juan Carlos",
  "apellido": "Pérez",
  "telefono": "+56987654321"
}

Response (200):
{
  "mensaje": "Perfil actualizado exitosamente",
  "perfil": { ... }
}
```

#### Gestión de Mesas

**List Tables**
```
GET /api/mesas/
Permission: AllowAny

Response (200):
[
  {
    "id": 1,
    "numero": 1,
    "capacidad": 4,
    "estado": "disponible",
    "ubicacion": "Interior"
  },
  {
    "id": 2,
    "numero": 2,
    "capacidad": 6,
    "estado": "reservada",
    "ubicacion": "Terraza"
  }
]
```

**Consult Available Tables**
```
GET /api/consultar-mesas/?fecha=2025-12-25&hora=12:00
Permission: AllowAny

Response (200):
[
  {
    "id": 3,
    "numero": 3,
    "capacidad": 4,
    "estado": "disponible",
    "ubicacion": "Terraza"
  }
]

# Filtra por:
# - estado
# - fecha + hora (excluye con reservas o bloqueos)
```

**Available Hours**
```
GET /api/horas-disponibles/?fecha=2025-12-25&personas=4
Permission: AllowAny

Response (200):
{
  "fecha": "2025-12-25",
  "personas": 4,
  "horas": [
    { "hora": "12:00", "mesas_disponibles": 5 },
    { "hora": "12:30", "mesas_disponibles": 3 },
    { "hora": "13:00", "mesas_disponibles": 0 }
  ],
  "horas_disponibles": ["12:00", "12:30"],
  "horas_no_disponibles": ["13:00"],
  "total_horas": 20,
  "disponibles": 2,
  "no_disponibles": 18
}

# Rango: 12:00 - 21:00 en intervalos de 30 minutos
```

#### Gestión de Reservas

**List Reservations**
```
GET /api/reservas/
Permission: IsAuthenticated
Headers: Authorization: Token ...
Pagination: 50/page

Query Params:
- estado: pendiente|activa|completada|cancelada
- fecha_reserva: YYYY-MM-DD
- fecha_reserva__gte: YYYY-MM-DD
- fecha_reserva__lte: YYYY-MM-DD
- mesa: número de mesa
- search: busca en username, nombre, email
- date=today: solo de hoy
- ordering: fecha_reserva|-fecha_reserva|hora_inicio

Response (200):
{
  "count": 25,
  "next": "http://.../api/reservas/?page=2",
  "previous": null,
  "results": [
    {
      "id": 25,
      "cliente_nombre_completo": "Juan Pérez",
      "cliente_email": "juan@example.com",
      "mesa_numero": 3,
      "fecha_reserva": "2025-12-25",
      "hora_inicio": "12:00",
      "hora_fin": "14:00",
      "num_personas": 4,
      "estado": "pendiente",
      "notas": "Sin mariscos"
    }
  ]
}
```

**Create Reservation**
```
POST /api/reservas/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Request:
{
  "mesa": 3,
  "fecha_reserva": "2025-12-25",
  "hora_inicio": "12:00",
  "hora_fin": "14:00",
  "num_personas": 4,
  "notas": "Sin mariscos"
}

Response (201):
{
  "id": 25,
  "cliente_nombre_completo": "Juan Pérez",
  "mesa_numero": 3,
  "estado": "pendiente",
  ...
}

# Validaciones:
# - Fecha no en el pasado
# - Horario 12:00-21:00
# - Sin solapamiento con otras reservas
# - Sin conflicto con bloqueos
# - Capacidad de mesa ≥ num_personas
```

**Change Reservation State**
```
PATCH /api/reservas/25/cambiar_estado/
Permission: IsAdminOrCajero
Headers: Authorization: Token ...

Request:
{
  "estado": "activa"
}

Response (200):
{
  "id": 25,
  "estado": "activa",
  ...
}

# Transiciones válidas:
# pendiente → confirmada, cancelada
# confirmada → activa, cancelada
# activa → completada, cancelada
# completada, cancelada → (final)
```

#### Gestión de Bloqueos

**List Blocks**
```
GET /api/bloqueos/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Query Params:
- mesa__numero: número de mesa
- activo: true|false
- categoria: mantenimiento|evento_privado|reparacion|etc
- solo_activos=true
- activos_en_fecha=2025-12-25

Response (200):
[
  {
    "id": 10,
    "mesa_numero": 5,
    "fecha_inicio": "2025-12-20",
    "fecha_fin": "2025-12-20",
    "hora_inicio": "12:00",
    "hora_fin": "15:00",
    "motivo": "Mantenimiento preventivo",
    "categoria": "mantenimiento",
    "activo": true
  }
]
```

**Create Block**
```
POST /api/bloqueos/
Permission: IsAdministrador
Headers: Authorization: Token ...

Request:
{
  "mesa": 5,
  "fecha_inicio": "2025-12-20",
  "fecha_fin": "2025-12-20",
  "hora_inicio": "12:00",
  "hora_fin": "15:00",
  "motivo": "Mantenimiento preventivo",
  "categoria": "mantenimiento",
  "notas": "Cambio de manteles",
  "activo": true
}

Response (201):
{
  "id": 10,
  ...
}

# Si hora_inicio=null y hora_fin=null → bloqueo de día completo
```

**Deactivate/Activate Block**
```
POST /api/bloqueos/10/desactivar/
POST /api/bloqueos/10/activar/
Permission: IsAdministrador
Headers: Authorization: Token ...

Response (200):
{
  "mensaje": "Bloqueo desactivado exitosamente",
  "bloqueo": { "id": 10, "activo": false, ... }
}
```

---

### menuApp - Menú e Inventario

#### Categorías de Menú

**List Categories**
```
GET /api/menu/categorias/
Permission: IsAuthenticatedOrReadOnly

Query Params:
- activa: true|false

Response (200):
[
  {
    "id": 1,
    "nombre": "Entradas",
    "descripcion": "Platos de entrada",
    "activa": true,
    "orden": 1
  },
  {
    "id": 2,
    "nombre": "Platos Fuertes",
    "descripcion": "Platos principales",
    "activa": true,
    "orden": 2
  }
]
```

**Create Category**
```
POST /api/menu/categorias/
Permission: IsAuthenticated + IsAdministrador
Headers: Authorization: Token ...

Request:
{
  "nombre": "Postres",
  "descripcion": "Postres caseros",
  "activa": true,
  "orden": 3
}

Response (201):
{
  "id": 3,
  "nombre": "Postres",
  ...
}
```

#### Ingredientes

**List Ingredients**
```
GET /api/menu/ingredientes/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Query Params:
- activo: true|false
- bajo_stock: true|false

Response (200):
[
  {
    "id": 5,
    "nombre": "Pasta",
    "descripcion": "Pasta fresca",
    "unidad_medida": "gr",
    "cantidad_disponible": 5000,
    "stock_minimo": 1000,
    "precio_unitario": 10.50,
    "activo": true,
    "bajo_stock": false
  }
]
```

**Low Stock Alert**
```
GET /api/menu/ingredientes/bajo_minimo/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Response (200):
[
  {
    "id": 12,
    "nombre": "Crema",
    "cantidad_disponible": 500,
    "stock_minimo": 1000,
    "bajo_stock": true
  }
]
```

**Adjust Stock**
```
PATCH /api/menu/ingredientes/5/ajustar_stock/
Permission: IsAuthenticated + IsAdministrador
Headers: Authorization: Token ...

Request:
{
  "cantidad": 500
}

# cantidad puede ser positiva (agregar) o negativa (quitar)

Response (200):
{
  "id": 5,
  "nombre": "Pasta",
  "cantidad_disponible": 5500,
  ...
}
```

#### Platos

**List Dishes**
```
GET /api/menu/platos/
Permission: IsAuthenticatedOrReadOnly

Query Params:
- categoria: ID de categoría
- disponible: true|false
- activo: true|false

Response (200):
[
  {
    "id": 10,
    "nombre": "Salmon Grillado",
    "descripcion": "Salmon fresco a la parrilla",
    "precio": 15500,
    "categoria": 2,
    "categoria_nombre": "Platos Fuertes",
    "disponible": true,
    "imagen": "/media/platos/salmon.jpg",
    "tiempo_preparacion": 20,
    "activo": true,
    "recetas": [
      {
        "id": 15,
        "ingrediente": {
          "id": 8,
          "nombre": "Salmon",
          "cantidad_disponible": 3000
        },
        "cantidad_requerida": 300
      }
    ]
  }
]
```

**Get Dish Recipe**
```
GET /api/menu/platos/10/receta/
Permission: IsAuthenticatedOrReadOnly

Response (200):
[
  {
    "id": 15,
    "ingrediente": {
      "id": 8,
      "nombre": "Salmon",
      "unidad_medida": "gr",
      "cantidad_disponible": 3000
    },
    "cantidad_requerida": 300
  },
  {
    "id": 16,
    "ingrediente": {
      "id": 12,
      "nombre": "Limón",
      "unidad_medida": "un",
      "cantidad_disponible": 50
    },
    "cantidad_requerida": 1
  }
]
```

**Add Ingredient to Recipe**
```
POST /api/menu/platos/10/receta/
Permission: IsAdministrador
Headers: Authorization: Token ...

Request:
{
  "ingrediente": 8,
  "cantidad_requerida": 300
}

Response (201):
{
  "id": 15,
  "ingrediente": {
    "id": 8,
    "nombre": "Salmon"
  },
  "cantidad_requerida": 300
}
```

**Available Dishes**
```
GET /api/menu/platos/disponibilidad/
Permission: IsAuthenticatedOrReadOnly

Response (200):
[
  {
    "id": 10,
    "nombre": "Salmon Grillado",
    "disponible": true
  },
  {
    "id": 15,
    "nombre": "Ensalada César",
    "disponible": true
  }
]

# Solo retorna platos con stock suficiente en todos los ingredientes
```

---

### cocinaApp - Pedidos y Cocina

#### Gestión de Pedidos

**List Orders**
```
GET /api/cocina/pedidos/
Permission: IsAuthenticated
Headers: Authorization: Token ...
Pagination: 20/page

Query Params:
- estado: CREADO|URGENTE|EN_PREPARACION|LISTO|ENTREGADO|CANCELADO
- mesa: número de mesa
- fecha: YYYY-MM-DD

Response (200):
{
  "count": 45,
  "results": [
    {
      "id": 45,
      "mesa_numero": 5,
      "estado": "CREADO",
      "total": 43500,
      "fecha_creacion": "2025-12-10T14:30:00Z",
      "detalles": [
        {
          "plato_nombre": "Salmon Grillado",
          "cantidad": 2,
          "precio_unitario": 15500,
          "subtotal": 31000
        }
      ]
    }
  ]
}
```

**Create Order**
```
POST /api/cocina/pedidos/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Request:
{
  "mesa": 5,
  "reserva": 12,
  "notas": "Sin picante",
  "detalles": [
    {
      "plato": 10,
      "cantidad": 2,
      "notas": "Término medio"
    },
    {
      "plato": 15,
      "cantidad": 1
    }
  ]
}

Response (201):
{
  "id": 45,
  "mesa_numero": 5,
  "estado": "CREADO",
  "total": 43500,
  "detalles": [...]
}

# Backend:
# - Crea pedido en transacción atómica
# - Valida stock de ingredientes
# - Descuenta stock con F() para atomicidad
# - Si falla: Rollback completo
```

**Change Order State**
```
POST /api/cocina/pedidos/45/estado/
Permission: IsAuthenticated (validado por rol)
Headers: Authorization: Token ...

Request:
{
  "estado": "LISTO"
}

Response (200):
{
  "id": 45,
  "estado": "LISTO",
  "fecha_listo": "2025-12-10T14:45:00Z",
  "transiciones_permitidas": ["ENTREGADO", "CANCELADO"]
}

# Roles y transiciones permitidas:
# - cocinero: CREADO→EN_PREPARACION|URGENTE, EN_PREPARACION→LISTO
# - mesero: LISTO→ENTREGADO, CREADO→CANCELADO
# - cajero/admin: todas las transiciones
```

**Cancel Order with Audit**
```
POST /api/cocina/pedidos/45/estado/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Request:
{
  "estado": "CANCELADO",
  "motivo": "Cliente solicitó cancelación por tiempo de espera excesivo"
}

# Validación:
# - Si se proporciona usuario (auth), motivo es OBLIGATORIO
# - Motivo debe tener ≥10 caracteres

Response (200):
{
  "id": 45,
  "estado": "CANCELADO",
  "cancelacion": {
    "cancelado_por_nombre": "María López",
    "fecha_cancelacion": "2025-12-10T15:00:00Z",
    "motivo": "Cliente solicitó cancelación por tiempo de espera excesivo",
    "mesa_numero": 5,
    "total_pedido": 43500,
    "productos_resumen": "2x Salmon Grillado, 1x Ensalada César",
    "productos_detalle": [
      {
        "plato_id": 10,
        "plato_nombre": "Salmon Grillado",
        "cantidad": 2,
        "precio_unitario": 15500,
        "subtotal": 31000
      }
    ]
  }
}

# Backend:
# - Revierte stock de ingredientes
# - Crea PedidoCancelacion (auditoría)
# - Actualiza disponibilidad de platos
```

#### Cola de Cocina

**Get Kitchen Queue**
```
GET /api/cocina/cola/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Query Params:
- horas_recientes=N (opcional)

Response (200):
[
  {
    "id": 45,
    "estado": "URGENTE",
    "mesa_numero": 5,
    "tiempo_desde_creacion": 25,
    "detalles": [...]
  },
  {
    "id": 46,
    "estado": "EN_PREPARACION",
    "mesa_numero": 8,
    "tiempo_desde_creacion": 15,
    "detalles": [...]
  },
  {
    "id": 47,
    "estado": "CREADO",
    "mesa_numero": 3,
    "tiempo_desde_creacion": 5,
    "detalles": [...]
  }
]

# Filtros automáticos:
# - estado IN (CREADO, URGENTE, EN_PREPARACION)
# - Ordenamiento: URGENTE primero, luego por fecha_creacion
```

**Get Urgent Orders**
```
GET /api/cocina/cola/urgentes/
Permission: IsAuthenticated
Headers: Authorization: Token ...

Response (200):
[
  {
    "id": 45,
    "estado": "URGENTE",
    "mesa_numero": 5,
    "tiempo_desde_creacion": 25,
    "detalles": [...]
  }
]
```

#### Pedidos por Estado

**Ready Orders (For Waiters)**
```
GET /api/cocina/pedidos/listos/
Permission: IsAuthenticated
Headers: Authorization: Token ...
Pagination: 20/page

Query Params:
- mesa: número de mesa
- busqueda: busca por ID, mesa, cliente
- ordering: fecha_listo|-fecha_listo|mesa__numero|-mesa__numero

Response (200):
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 45,
      "estado": "LISTO",
      "mesa_numero": 5,
      "cliente_nombre": "Juan Pérez",
      "tiempo_desde_listo": 5,
      "detalles": [...]
    }
  ]
}
```

**Delivered Orders**
```
GET /api/cocina/pedidos/entregados/
Permission: IsAuthenticated
Headers: Authorization: Token ...
Pagination: 20/page

Query Params:
- fecha: YYYY-MM-DD (default=today)
- mesa: número de mesa
- busqueda: busca por ID, mesa, cliente
- ordering: fecha_entregado|-fecha_entregado

Response (200):
{
  "count": 12,
  "results": [
    {
      "id": 43,
      "estado": "ENTREGADO",
      "mesa_numero": 3,
      "fecha_entregado": "2025-12-10T13:45:00Z",
      "tiempo_total": 18,
      "detalles": [...]
    }
  ]
}
```

**Cancelled Orders**
```
GET /api/cocina/pedidos/cancelados/
Permission: IsAuthenticated
Headers: Authorization: Token ...
Pagination: 20/page

Query Params:
- periodo: hoy|semana|mes (default=semana)
- fecha: YYYY-MM-DD
- usuario: ID del usuario que canceló
- busqueda: busca por ID, mesa, cliente, motivo
- ordering: cancelacion__fecha_cancelacion|-cancelacion__fecha_cancelacion

Response (200):
{
  "count": 8,
  "results": [
    {
      "id": 45,
      "estado": "CANCELADO",
      "mesa_numero": 5,
      "cancelacion": {
        "cancelado_por_nombre": "María López",
        "fecha_cancelacion": "2025-12-10T15:00:00Z",
        "motivo": "Cliente solicitó cancelación por tiempo de espera excesivo",
        ...
      }
    }
  ]
}
```

#### Estadísticas

**Kitchen Statistics**
```
GET /api/cocina/estadisticas/
Permission: IsAuthenticated + IsAdminOrCajero
Headers: Authorization: Token ...

Response (200):
{
  "fecha": "2025-12-10",
  "total_pedidos": 45,
  "por_estado": {
    "CREADO": 5,
    "URGENTE": 2,
    "EN_PREPARACION": 8,
    "LISTO": 15,
    "ENTREGADO": 12,
    "CANCELADO": 3
  },
  "pedidos_pendientes": 7,
  "pedidos_en_preparacion": 8,
  "pedidos_listos": 15,
  "pedidos_entregados": 12,
  "pedidos_cancelados": 3
}
```

**Cancellation Statistics**
```
GET /api/cocina/estadisticas/cancelaciones/
Permission: IsAuthenticated + IsAdminOrCajero
Headers: Authorization: Token ...

Query Params:
- periodo: dia|semana|mes (default=dia)

Response (200):
{
  "periodo": "semana",
  "fecha_inicio": "2025-12-04",
  "fecha_fin": "2025-12-10",
  "total_cancelados": 8,
  "por_usuario": [
    {
      "cancelado_por__username": "maria.lopez",
      "cancelado_por__perfil__nombre_completo": "María López",
      "count": 5
    },
    {
      "cancelado_por__username": "admin",
      "cancelado_por__perfil__nombre_completo": "Juan Admin",
      "count": 3
    }
  ],
  "motivos_sample": [
    "Cliente solicitó cancelación por tiempo de espera excesivo",
    "Ingredientes no disponibles",
    "Error en el pedido"
  ],
  "motivos_total": 8
}
```

---

## Transiciones de Estado

### Pedido - Máquina de Estados

```
┌─────────────────────────────────────────────────────────────┐
│              ESTADOS DE PEDIDO (EstadoPedido)                │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────┐
                    │ CREADO  │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐      │     ┌────▼────────────┐
         │URGENTE │      │     │EN_PREPARACION   │
         └────┬───┘      │     └────┬────────────┘
              │          │          │
              └──────────┼──────────┘
                         │
                    ┌────▼────┐
                    │  LISTO  │
                    └────┬────┘
                         │
                  ┌──────▼──────┐
                  │  ENTREGADO  │
                  │   (FINAL)   │
                  └─────────────┘

                     Desde cualquier estado (excepto ENTREGADO, CANCELADO):
                                    │
                              ┌─────▼──────┐
                              │  CANCELADO │
                              │   (FINAL)  │
                              └────────────┘

TRANSICIONES VÁLIDAS POR ROL:

┌──────────────┬────────────────────────────────────────────────┐
│    ROL       │           TRANSICIONES PERMITIDAS              │
├──────────────┼────────────────────────────────────────────────┤
│  cocinero    │ - CREADO → EN_PREPARACION, URGENTE             │
│              │ - URGENTE → EN_PREPARACION                     │
│              │ - EN_PREPARACION → LISTO                       │
├──────────────┼────────────────────────────────────────────────┤
│   mesero     │ - LISTO → ENTREGADO                            │
│              │ - CREADO → CANCELADO                           │
├──────────────┼────────────────────────────────────────────────┤
│   cajero     │ - Todas las transiciones (control total)       │
├──────────────┼────────────────────────────────────────────────┤
│    admin     │ - Todas las transiciones (control total)       │
└──────────────┴────────────────────────────────────────────────┘

CONSTANTE EN BACKEND:
TRANSICIONES_VALIDAS = {
    'CREADO': ['EN_PREPARACION', 'URGENTE', 'CANCELADO'],
    'URGENTE': ['EN_PREPARACION', 'CANCELADO'],
    'EN_PREPARACION': ['LISTO', 'CANCELADO'],
    'LISTO': ['ENTREGADO', 'CANCELADO'],
    'ENTREGADO': [],
    'CANCELADO': []
}
```

### Reserva - Máquina de Estados

```
┌─────────────────────────────────────────────────────────────┐
│             ESTADOS DE RESERVA (EstadoReserva)               │
└─────────────────────────────────────────────────────────────┘

     ┌───────────┐
     │ pendiente │
     └─────┬─────┘
           │
    ┌──────┼──────┐
    │      │      │
┌───▼────┐ │  ┌───▼──────┐
│cancelada│ │  │confirmada│
│(FINAL) │ │  └───┬──────┘
└────────┘ │      │
           │  ┌───┼────┐
           │  │   │    │
           │┌─▼─┐ │ ┌──▼────┐
           ││cancelada│ │activa │
           │└────────┘ │ └──┬───┘
           │           │    │
           │           │ ┌──┼──────┐
           │           │ │  │      │
           │           │┌▼─┐│  ┌───▼──────┐
           │           ││cancelada│ │completada│
           │           │└────────┘  │ (FINAL)  │
           │           │            └──────────┘
           │           │
           └───────────┘

TRANSICIONES VÁLIDAS:
- pendiente    → confirmada, cancelada
- confirmada   → activa, cancelada
- activa       → completada, cancelada
- completada   → (estado final, sin transiciones)
- cancelada    → (estado final, sin transiciones)

PERMISOS:
- Cliente: Solo puede cancelar sus propias reservas
- Admin/Cajero: Puede usar endpoint cambiar_estado
```

---

## Modelo de Datos Relacional

```
┌─────────────────────────────────────────────────────────────┐
│                  DIAGRAMA DE RELACIONES                      │
└─────────────────────────────────────────────────────────────┘

User (Django Auth)
  │
  ├─► Perfil (OneToOne, CASCADE)
  │    └─ rol, rut (encrypted), telefono (encrypted),
  │       es_invitado, token_activacion
  │
  ├─► Reserva (FK: cliente, CASCADE)
  │    │
  │    └─► Mesa (FK, CASCADE)
  │         │
  │         └─► Pedido (FK: reserva, SET_NULL)
  │              │
  │              ├─► DetallePedido (FK: pedido, CASCADE)
  │              │    │
  │              │    └─► Plato (FK, PROTECT)
  │              │
  │              └─► PedidoCancelacion (OneToOne, CASCADE)
  │                   └─ FK: cancelado_por (User, SET_NULL)
  │
  ├─► Pedido (FK: cliente, SET_NULL)
  │    │
  │    └─► Mesa (FK, PROTECT)
  │
  └─► BloqueoMesa (FK: usuario_creador, SET_NULL)
       │
       └─► Mesa (FK, CASCADE)

Mesa
  ├─► Reserva (reverse: reservas, 1-to-Many)
  ├─► Pedido (reverse: pedidos, 1-to-Many)
  └─► BloqueoMesa (reverse: bloqueos, 1-to-Many)

Plato
  ├─► CategoriaMenu (FK, PROTECT)
  ├─► Receta (M2M explícito via Receta model, CASCADE)
  │    │
  │    └─► Ingrediente (FK, PROTECT)
  └─► DetallePedido (reverse, 1-to-Many, PROTECT)

┌─────────────────────────────────────────────────────────────┐
│                  CASCADAS Y PROTECCIONES                     │
└─────────────────────────────────────────────────────────────┘

CASCADE (Elimina en cascada):
  - User deleted → Perfil deleted
  - Pedido deleted → DetallePedido deleted
  - Pedido deleted → PedidoCancelacion deleted
  - Mesa deleted → Reserva deleted
  - Mesa deleted → Pedido deleted
  - Mesa deleted → BloqueoMesa deleted
  - Plato deleted → Receta deleted

SET_NULL (Establece NULL):
  - User deleted → Pedido.cliente = NULL
  - User deleted → BloqueoMesa.usuario_creador = NULL
  - User deleted → PedidoCancelacion.cancelado_por = NULL
  - Reserva deleted → Pedido.reserva = NULL

PROTECT (Previene eliminación):
  - CategoriaMenu → No se puede eliminar si tiene Platos
  - Ingrediente → No se puede eliminar si tiene Recetas
  - Plato → No se puede eliminar si tiene DetallePedidos
  - Mesa → No se puede eliminar si tiene Pedidos activos
```

---

## Manejo de Errores

### Formato de Error Estándar

**Estructura de Response de Error (400/500):**
```json
{
  "detail": "Mensaje de error principal",
  "error": "Tipo de error específico",
  "detalles": {
    "campo1": ["Error de validación específico"],
    "campo2": ["Otro error"]
  }
}
```

### Tipos de Error Detectados (Frontend)

```javascript
// Definido en frontend/src/utils/errorHandler.js
ERROR_TYPES = {
  NETWORK: 'Error de conexión a internet',
  TIMEOUT: 'La operación tardó demasiado tiempo',
  UNAUTHORIZED: 'No tiene permisos para realizar esta acción',
  NOT_FOUND: 'El recurso solicitado no existe',
  VALIDATION: 'Los datos ingresados no son válidos',
  SERVER: 'Error interno del servidor',
  UNKNOWN: 'Error desconocido'
}
```

### Configuración de Timeout

```javascript
// Default: 30 segundos (temporal durante optimización backend)
const DEFAULT_TIMEOUT = 30000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La solicitud está tardando demasiado. Intenta nuevamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Ejemplo de Manejo de Errores

```javascript
// En componente React
try {
  const pedido = await crearPedido({
    mesa: 5,
    detalles: [{ plato: 10, cantidad: 2 }]
  });
  toast.success('Pedido creado exitosamente');
  navigate('/cocina');
} catch (error) {
  // Error parseado automáticamente por handleResponse()
  console.error('Error al crear pedido:', error);
  toast.error(`Error: ${error.message}`);
  // Frontend recibe mensaje limpio del backend
}
```

**Ejemplos de Errores Comunes:**

```json
// Stock insuficiente
{
  "detail": "Stock insuficiente de Salmon. Disponible: 200, Necesario: 600"
}

// Validación de transición de estado
{
  "detail": "Transición inválida: LISTO → EN_PREPARACION"
}

// Motivo de cancelación muy corto
{
  "detail": "El motivo de cancelación debe tener al menos 10 caracteres"
}

// Solapamiento de reservas
{
  "detail": "Ya existe una reserva para esta mesa en el horario seleccionado"
}
```

---

## Paginación

### Endpoints Paginados

Los siguientes endpoints retornan respuestas paginadas:
- `GET /api/cocina/pedidos/listos/`
- `GET /api/cocina/pedidos/entregados/`
- `GET /api/cocina/pedidos/cancelados/`
- `GET /api/reservas/`

### Estructura de Respuesta Paginada

```json
{
  "count": 45,
  "next": "http://localhost:8000/api/cocina/pedidos/listos/?page=2",
  "previous": null,
  "results": [
    { "id": 45, "estado": "LISTO", ... },
    { "id": 46, "estado": "LISTO", ... },
    { "id": 47, "estado": "LISTO", ... }
  ]
}
```

**Campos:**
- `count` (int): Total de resultados disponibles
- `next` (string|null): URL de la siguiente página (null si es la última)
- `previous` (string|null): URL de la página anterior (null si es la primera)
- `results` (array): Array de objetos de la página actual

### Parámetros de Query

- `page=2` - Número de página (default: 1)
- `page_size=20` - Items por página (default: 20)

**Ejemplo:**
```
GET /api/cocina/pedidos/listos/?page=2&page_size=10
```

### Uso en Frontend

```javascript
// Ejemplo completo: PanelPedidosMesero.jsx
import { useState, useEffect } from 'react';
import { getPedidosListos } from '../../services/cocinaApi';

function PanelPedidosMesero() {
  const [pedidos, setPedidos] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    cargarPedidos();
  }, [page]);

  async function cargarPedidos() {
    const data = await getPedidosListos({
      page,
      page_size: pageSize,
      ordering: '-fecha_listo'
    });

    setPedidos(data.results || []);
    setTotalCount(data.count || 0);
    setHasNext(!!data.next);
    setHasPrevious(!!data.previous);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      {/* Lista de pedidos */}
      {pedidos.map(pedido => (
        <PedidoCard key={pedido.id} pedido={pedido} />
      ))}

      {/* Controles de paginación */}
      <Pagination>
        <Pagination.Prev
          disabled={!hasPrevious}
          onClick={() => setPage(page - 1)}
        />
        <Pagination.Item active>{page}</Pagination.Item>
        <Pagination.Next
          disabled={!hasNext}
          onClick={() => setPage(page + 1)}
        />
      </Pagination>

      {/* Info */}
      <p>Mostrando {pedidos.length} de {totalCount} pedidos (Página {page} de {totalPages})</p>
    </div>
  );
}
```

---

## Notas Finales

### Actualización de la Documentación

Esta documentación debe actualizarse cuando:
- Se agreguen nuevos endpoints
- Se modifiquen estructuras de datos
- Se cambien transiciones de estado
- Se agreguen nuevos módulos o modelos

### Tecnologías Clave

**Backend:**
- Django 5.1 + Django REST Framework
- PostgreSQL (producción) / SQLite (desarrollo)
- DRF Token Authentication
- WhiteNoise para archivos estáticos

**Frontend:**
- React 19.2 + Vite 7.2
- React Router DOM 7.9
- React Bootstrap 2.10 + Bootstrap 5.3
- Context API (AuthContext, ToastContext)

### Características Importantes

✅ **REST API Pura** - Sin WebSockets, actualización por polling
✅ **Autenticación por Token** - DRF Token Authentication
✅ **Transacciones Atómicas** - Uso de `@transaction.atomic` y `F()` para integridad
✅ **Auditoría Completa** - PedidoCancelacion con snapshots JSON
✅ **Control de Stock** - Descuento/reversión transaccional de ingredientes
✅ **Soft Delete** - Reserva usa soft delete con manager personalizado
✅ **Encriptación** - RUT y teléfono encriptados en Perfil
✅ **Usuarios Invitados** - Sistema de tokens de activación (48 horas)
✅ **Validaciones Robustas** - Validación de horarios, capacidad, stock, transiciones de estado

---

**Fecha de última actualización:** Diciembre 2025
**Versión:** 1.0
**Mantenido por:** Equipo de Desarrollo
