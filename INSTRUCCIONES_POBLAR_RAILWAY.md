# Instrucciones para Poblar Railway con Datos de Prueba

## ✅ Código Ya Desplegado

El management command `poblar_railway_seguro.py` ya fue creado, commiteado y pusheado a Railway.

---

## 🚀 Opción 1: Ejecutar desde Dashboard de Railway (MÁS FÁCIL)

### Paso 1: Abrir Dashboard
1. Ve a https://railway.app
2. Abre tu proyecto **"miraculous-courage"**
3. Selecciona el servicio **"Sistema Gestión de Restaurant"**

### Paso 2: Abrir Terminal
1. En el dashboard, busca la pestaña o botón **"Shell"** o **"Terminal"**
2. Esto abrirá una terminal interactiva conectada a tu servicio en Railway

### Paso 3: Ejecutar Comandos

```bash
# PRIMERO: Dry-run para verificar (NO guarda cambios)
python manage.py poblar_railway_seguro --dry-run --verbose

# SI TODO ESTÁ OK: Ejecutar de verdad
python manage.py poblar_railway_seguro --verbose
```

---

## 🖥️ Opción 2: Railway CLI (Desde Tu Terminal Local)

### Requisitos
- Tener Railway CLI instalado: `npm install -g @railway/cli`
- Estar autenticado: `railway login`
- Estar en el directorio del proyecto

### Ejecutar

Abre una terminal interactiva en Railway:

```bash
# Abrir shell interactiva de Railway
railway shell

# Dentro del shell, ejecutar:
python manage.py poblar_railway_seguro --dry-run --verbose
python manage.py poblar_railway_seguro --verbose
```

---

## 🔍 Output Esperado

Deberías ver algo como:

```
⚠️  MODO DRY-RUN ACTIVADO - Los cambios NO se guardarán

======================================================================
POBLAR RAILWAY CON DATOS DE PRUEBA REALISTAS
======================================================================

📊 Estado actual de la base de datos:
  • Usuarios: 8
  • Mesas: 6
  • Categorías: 4
  • Ingredientes: 15
  • Platos: 21
  • Recetas: 35
  • Reservas: 12
  • Pedidos: 8
  • Cancelaciones: 0

🚀 Iniciando creación de datos...

📝 Creando usuarios de demostración...
  ✅ 6 usuarios nuevos creados
  📊 Total usuarios disponibles: 14

🪑 Verificando mesas...
  ✅ 0 mesas nuevas creadas
  📊 Total mesas disponibles: 6

📋 Creando categorías del menú...
  ✅ 4 categorías verificadas

🥘 Creando ingredientes con stock variado...
  ✅ 35 ingredientes creados
  📊 Stock normal: 22
  ⚠️  Bajo stock: 9
  ❌ Agotados: 4

🍽️  Creando platos del menú...
  ✅ 28 platos creados
  📊 Disponibles: 20
  ⚠️  No disponibles: 8

📖 Creando recetas (plato-ingrediente)...
  ✅ 24 recetas creadas

📅 Creando reservas de la semana...
  ✅ 48 reservas creadas
    • pendiente: 26
    • confirmada: 12
    • activa: 2
    • completada: 5
    • cancelada: 3

🔄 Actualizando estados de mesas...
  • disponible: 2
  • reservada: 2
  • ocupada: 1
  • limpieza: 1

🍳 Creando pedidos activos...
  ✅ 30 pedidos activos creados

✅ Creando pedidos entregados...
  ✅ 20 pedidos entregados creados
  📊 Entregados HOY: 15

❌ Creando pedidos cancelados con auditoría...
  ✅ 12 pedidos cancelados creados
  📊 Auditorías: 12

✅ DRY RUN COMPLETADO - Todos los cambios fueron revertidos
```

---

## ✅ Verificación Post-Ejecución

Después de ejecutar el comando REAL (sin --dry-run), verifica los datos:

```bash
python manage.py shell -c "
from django.utils import timezone
from django.contrib.auth.models import User
from mainApp.models import Reserva, Mesa
from menuApp.models import Plato, Ingrediente
from cocinaApp.models import Pedido, PedidoCancelacion

print('=== RESUMEN FINAL ===')
print(f'Usuarios: {User.objects.count()}')
print(f'Platos: {Plato.objects.count()}')
print(f'Ingredientes: {Ingrediente.objects.count()}')
print(f'Reservas: {Reserva.objects.count()}')
print(f'Pedidos: {Pedido.objects.count()}')

hoy = timezone.now().date()
print(f'\\nPedidos ENTREGADOS HOY: {Pedido.objects.filter(estado=\"ENTREGADO\", fecha_entregado__date=hoy).count()}')
print(f'Pedidos CANCELADOS: {Pedido.objects.filter(estado=\"CANCELADO\").count()}')
print(f'Cancelaciones auditadas: {PedidoCancelacion.objects.count()}')
"
```

---

## 🔐 Garantías de Seguridad

✅ **NO se borrarán datos existentes** - Solo usa `.create()` y `.get_or_create()`
✅ **Rollback automático** - Si hay error, todos los cambios se revierten
✅ **Dry-run disponible** - Prueba sin guardar cambios
✅ **Múltiples ejecuciones seguras** - Puedes ejecutarlo varias veces

---

## 📊 Datos Creados

- **6-8 usuarios demo** (clientes y mesero)
- **20-30 platos nuevos** (70% disponibles, 30% no disponibles)
- **30-40 ingredientes** con stock variado (normal, bajo, agotado)
- **40-50 reservas** distribuidas en 7 días (todos los estados)
- **50-62 pedidos totales**:
  - CREADO: 8
  - URGENTE: 5
  - EN_PREPARACION: 10
  - LISTO: 7
  - ENTREGADO: 20 (15 HOY)
  - CANCELADO: 12 (con auditoría completa)
- **Estados de mesas** actualizados según reservas

---

## ❓ Troubleshooting

### Error: "No module named 'mainApp'"
- Estás en el directorio equivocado
- Asegúrate de estar en `/app` o donde Django esté instalado

### Error: "Database connection failed"
- Verifica que estés ejecutando dentro de Railway, no localmente
- Usa `railway shell` o el dashboard de Railway

### Error: "Command not found"
- Usa `python3` en lugar de `python` si es necesario
- O verifica que Python esté instalado en el servicio

---

## 📝 Notas

- Primera ejecución puede tomar 1-2 minutos
- El comando muestra progreso detallado con --verbose
- Usa --dry-run SIEMPRE primero para verificar
- Los datos son realistas y útiles para testing

---

**Archivo del comando**: `backend/mainApp/management/commands/poblar_railway_seguro.py`
