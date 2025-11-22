# 🔒 Sistema de Bloqueo de Mesas - Documentación Técnica

## Descripción General

El sistema de bloqueo de mesas permite a los administradores bloquear temporalmente mesas del restaurante para mantenimiento, eventos privados, reparaciones u otros motivos. Las mesas bloqueadas no aparecen como disponibles en el sistema de reservas.

---

## Modelo de Datos

### BloqueoMesa (`models.py:288-485`)

```python
class BloqueoMesa(models.Model):
    mesa = ForeignKey(Mesa)                  # Mesa a bloquear
    fecha_inicio = DateField()               # Fecha de inicio del bloqueo
    fecha_fin = DateField()                  # Fecha de fin del bloqueo
    hora_inicio = TimeField(null=True)       # Hora inicio (opcional)
    hora_fin = TimeField(null=True)          # Hora fin (opcional)
    motivo = CharField(max_length=200)       # Motivo del bloqueo
    categoria = CharField(choices=...)       # Categoría del bloqueo
    notas = TextField(max_length=500)        # Notas adicionales
    usuario_creador = ForeignKey(User)       # Usuario que creó el bloqueo
    tipo_recurrencia = CharField(...)        # Tipo de recurrencia
    activo = BooleanField(default=True)      # Estado del bloqueo
    created_at = DateTimeField()
    updated_at = DateTimeField()
```

### Categorías Disponibles

- `mantenimiento`: Mantenimiento programado
- `evento_privado`: Evento privado
- `reparacion`: Reparación
- `reserva_especial`: Reserva especial
- `otro`: Otro motivo

### Tipos de Recurrencia

- `ninguna`: Sin recurrencia (bloqueo único)
- `diaria`: Recurrencia diaria
- `semanal`: Recurrencia semanal
- `mensual`: Recurrencia mensual

---

## Validaciones del Modelo

### Validaciones Automáticas

1. **Fechas**:
   - `fecha_fin` debe ser posterior o igual a `fecha_inicio`
   - No se permiten bloqueos en fechas pasadas

2. **Horarios**:
   - Si se especifica `hora_inicio`, debe especificarse `hora_fin` y viceversa
   - `hora_fin` debe ser posterior a `hora_inicio`
   - Los horarios deben estar dentro del horario de operación (12:00 - 23:00)

3. **Solapamientos**:
   - No se permiten bloqueos que se solapen con otros bloqueos activos de la misma mesa
   - Se valida tanto el solapamiento de fechas como de horarios

### Método Auxiliar

```python
def esta_activo_en_fecha_hora(self, fecha, hora_inicio=None, hora_fin=None):
    """Verifica si el bloqueo está activo en una fecha/hora específica"""
```

---

## API REST Endpoints

### Autenticación Requerida

Todos los endpoints requieren autenticación mediante Token. Solo los administradores tienen acceso completo.

### Endpoints Disponibles

#### 1. Listar Bloqueos
```http
GET /api/bloqueos/
```

**Permisos**: Usuarios autenticados (lectura), Administradores (todos)

**Parámetros de consulta**:
- `mesa_numero`: Número de mesa (ej: `?mesa_numero=5`)
- `activo`: true/false (ej: `?activo=true`)
- `categoria`: Categoría del bloqueo (ej: `?categoria=mantenimiento`)
- `solo_activos`: true (ej: `?solo_activos=true`)
- `activos_en_fecha`: YYYY-MM-DD (ej: `?activos_en_fecha=2025-11-25`)

**Respuesta**:
```json
[
  {
    "id": 1,
    "mesa": 5,
    "mesa_numero": 5,
    "fecha_inicio": "2025-11-25",
    "fecha_fin": "2025-11-27",
    "hora_inicio": "14:00:00",
    "hora_fin": "18:00:00",
    "motivo": "Mantenimiento programado",
    "categoria": "mantenimiento",
    "categoria_display": "Mantenimiento",
    "notas": "Cambio de tapicería",
    "activo": true
  }
]
```

#### 2. Crear Bloqueo
```http
POST /api/bloqueos/
```

**Permisos**: Solo administradores

**Body**:
```json
{
  "mesa": 5,
  "fecha_inicio": "2025-11-25",
  "fecha_fin": "2025-11-27",
  "hora_inicio": "14:00",
  "hora_fin": "18:00",
  "motivo": "Mantenimiento programado",
  "categoria": "mantenimiento",
  "notas": "Cambio de tapicería"
}
```

**Nota**:
- El campo `usuario_creador` se asigna automáticamente al usuario autenticado
- Para bloqueos de día completo, omitir `hora_inicio` y `hora_fin`

#### 3. Ver Detalle
```http
GET /api/bloqueos/:id/
```

#### 4. Actualizar Bloqueo
```http
PATCH /api/bloqueos/:id/
```

**Permisos**: Solo administradores

#### 5. Eliminar Bloqueo
```http
DELETE /api/bloqueos/:id/
```

**Permisos**: Solo administradores

#### 6. Desactivar Bloqueo
```http
POST /api/bloqueos/:id/desactivar/
```

**Permisos**: Solo administradores

Desactiva el bloqueo sin eliminarlo de la base de datos.

#### 7. Activar Bloqueo
```http
POST /api/bloqueos/:id/activar/
```

**Permisos**: Solo administradores

Reactiva un bloqueo previamente desactivado. Valida que no haya solapamientos antes de activar.

#### 8. Bloqueos Activos Hoy
```http
GET /api/bloqueos/activos-hoy/
```

Retorna todos los bloqueos activos para la fecha actual.

---

## Integración con Sistema de Reservas

### Modificaciones en ConsultaMesasView

El endpoint de consulta de mesas (`/api/consultar-mesas/`) ahora excluye automáticamente las mesas bloqueadas:

```python
# Obtener mesas bloqueadas en la fecha/hora consultada
mesas_bloqueadas_ids = BloqueoMesa.objects.filter(
    activo=True,
    fecha_inicio__lte=fecha,
    fecha_fin__gte=fecha
).filter(
    Q(hora_inicio__isnull=True) |  # Bloqueo de día completo
    (Q(hora_inicio__lt=hora_fin) & Q(hora_fin__gt=hora_inicio))
).values_list('mesa_id', flat=True)

# Excluir mesas bloqueadas
mesas = mesas.exclude(id__in=mesas_bloqueadas_ids)
```

### Modificaciones en ConsultarHorasDisponiblesView

El endpoint de horas disponibles (`/api/horas-disponibles/`) considera los bloqueos al calcular disponibilidad:

- Las horas con mesas bloqueadas muestran menor cantidad de mesas disponibles
- Si todas las mesas disponibles están bloqueadas, la hora no aparece como disponible

---

## Frontend - Componente React

### ListaBloqueosActivos.jsx

Componente principal para gestión de bloqueos.

**Ubicación**: `src/components/ListaBloqueosActivos.jsx`

**Características**:
- Listado de bloqueos con paginación
- Filtros por estado y categoría
- Modal para crear nuevos bloqueos
- Acciones: Activar, Desactivar, Eliminar
- Validación en tiempo real
- Integración con Toast para notificaciones

**Acceso**: Pestaña "Bloqueos de Mesas" (solo administradores)

### Funciones de API

**Ubicación**: `src/services/reservasApi.js:662-837`

```javascript
// Funciones disponibles
listarBloqueos(filters)
obtenerBloqueo(bloqueoId)
crearBloqueo(bloqueoData)
actualizarBloqueo(bloqueoId, bloqueoData)
eliminarBloqueo(bloqueoId)
desactivarBloqueo(bloqueoId)
activarBloqueo(bloqueoId)
obtenerBloqueosActivosHoy()
```

---

## Ejemplos de Uso

### Ejemplo 1: Bloquear mesa por mantenimiento (día completo)

```bash
curl -X POST http://localhost:8000/api/bloqueos/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mesa": 5,
    "fecha_inicio": "2025-12-01",
    "fecha_fin": "2025-12-01",
    "motivo": "Limpieza profunda",
    "categoria": "mantenimiento",
    "notas": "Limpieza anual programada"
  }'
```

### Ejemplo 2: Bloquear mesa por evento privado (horario específico)

```bash
curl -X POST http://localhost:8000/api/bloqueos/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mesa": 10,
    "fecha_inicio": "2025-12-15",
    "fecha_fin": "2025-12-15",
    "hora_inicio": "19:00",
    "hora_fin": "23:00",
    "motivo": "Cena de empresa",
    "categoria": "evento_privado",
    "notas": "Empresa XYZ - 12 personas"
  }'
```

### Ejemplo 3: Listar bloqueos activos

```bash
curl http://localhost:8000/api/bloqueos/?solo_activos=true \
  -H "Authorization: Token YOUR_TOKEN"
```

### Ejemplo 4: Desactivar un bloqueo

```bash
curl -X POST http://localhost:8000/api/bloqueos/5/desactivar/ \
  -H "Authorization: Token YOUR_TOKEN"
```

---

## Casos de Uso Comunes

### 1. Mantenimiento Programado
Un administrador necesita bloquear la mesa 5 para mantenimiento el 15 de diciembre:

1. Acceder a "Bloqueos de Mesas"
2. Click en "Crear Bloqueo"
3. Seleccionar Mesa 5
4. Fecha inicio y fin: 2025-12-15
5. Marcar "Bloqueo de día completo"
6. Categoría: Mantenimiento
7. Motivo: "Reparación de silla rota"
8. Guardar

**Resultado**: La mesa 5 no aparecerá como disponible para el 15 de diciembre.

### 2. Evento Privado
Un cliente quiere reservar toda una zona para un evento:

1. Crear múltiples bloqueos para las mesas de la zona
2. Especificar horario del evento (ej: 20:00 - 23:00)
3. Categoría: Evento Privado
4. Motivo: "Cumpleaños corporativo"

**Resultado**: Las mesas bloqueadas no estarán disponibles solo en ese horario.

### 3. Reparación Urgente
Una mesa se daña durante el servicio:

1. Crear bloqueo inmediato desde la fecha actual
2. Categoría: Reparación
3. Fecha fin: Estimada de finalización de reparación
4. Día completo si no se sabe cuándo estará lista

---

## Consideraciones Técnicas

### Base de Datos

**Índices creados**:
- `(mesa, fecha_inicio, fecha_fin)`: Búsquedas de bloqueos por mesa
- `(activo)`: Filtrado por estado
- `(categoria)`: Filtrado por categoría

**Ordering por defecto**: `-fecha_inicio, -hora_inicio` (más recientes primero)

### Performance

- Uso de `select_related()` y `prefetch_related()` en queries
- Serializer compacto para listados (`BloqueoMesaListSerializer`)
- Serializer completo para detalles (`BloqueoMesaSerializer`)

### Seguridad

- Permisos estrictos: Solo administradores pueden crear/modificar/eliminar
- Todos los usuarios autenticados pueden ver bloqueos
- Validación en backend y frontend
- Usuario creador registrado automáticamente

---

## Troubleshooting

### Problema: No puedo crear un bloqueo

**Posibles causas**:
1. No tienes permisos de administrador
2. Hay un bloqueo que se solapa en esas fechas/horas
3. Las fechas están en el pasado
4. Los horarios están fuera del rango permitido (12:00-23:00)

**Solución**: Verificar mensajes de error en el frontend o response de la API

### Problema: Una mesa bloqueada sigue apareciendo como disponible

**Posibles causas**:
1. El bloqueo está desactivado (`activo=False`)
2. Las fechas/horas del bloqueo no coinciden con la búsqueda
3. Cache del navegador

**Solución**:
- Verificar que el bloqueo esté activo
- Revisar fechas y horarios del bloqueo
- Refrescar el caché

---

## Testing

### Crear Bloqueo de Prueba

```python
from mainApp.models import BloqueoMesa, Mesa, User
from datetime import date, time

# Obtener mesa y usuario
mesa = Mesa.objects.get(numero=5)
admin = User.objects.get(username='admin')

# Crear bloqueo
bloqueo = BloqueoMesa.objects.create(
    mesa=mesa,
    fecha_inicio=date(2025, 12, 1),
    fecha_fin=date(2025, 12, 1),
    hora_inicio=time(14, 0),
    hora_fin=time(18, 0),
    motivo="Prueba de bloqueo",
    categoria="mantenimiento",
    usuario_creador=admin
)
```

### Verificar Integración

1. Crear un bloqueo para una fecha específica
2. Intentar hacer una reserva en esa fecha/hora
3. Verificar que la mesa NO aparezca como disponible

---

## Roadmap Futuro

Posibles mejoras para versiones futuras:

- [ ] Soporte real para recurrencias (actualmente solo definido en modelo)
- [ ] Notificaciones automáticas antes de que expire un bloqueo
- [ ] Dashboard con estadísticas de bloqueos
- [ ] Exportar lista de bloqueos a PDF/Excel
- [ ] Bloqueo masivo de múltiples mesas simultáneamente
- [ ] Historial de cambios en bloqueos
- [ ] Calendario visual con bloqueos y reservas integrados

---

**Documento creado**: Noviembre 2025
**Versión**: 1.0
