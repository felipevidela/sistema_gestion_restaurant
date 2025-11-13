# 🔧 Solución Rápida para Railway Deployment

## ⚠️ Problema

Railway no puede detectar cómo construir la aplicación porque el proyecto tiene una estructura de carpetas compleja.

## ✅ Solución Implementada

He agregado los siguientes archivos en la **raíz del repositorio** para que Railway pueda detectar y construir correctamente:

### Archivos Creados

1. **`nixpacks.toml`** - Configuración de Nixpacks para Railway
2. **`railway.json`** - Configuración específica de Railway
3. **`Procfile`** - Define los procesos web y release
4. **`requirements.txt`** - Dependencias de Python (copiado desde subfolder)
5. **`runtime.txt`** - Versión de Python
6. **`build.sh`** - Script que construye el frontend React

---

## 🚀 Instrucciones para Railway

### Paso 1: Eliminar Root Directory (IMPORTANTE)

En tu servicio de Railway:

1. Ve a **"Settings"**
2. Busca **"Root Directory"**
3. Si dice `REST frameworks/ReservaProject`, **bórralo** (déjalo vacío)
4. Guarda los cambios

### Paso 2: Verificar Variables de Entorno

Asegúrate de que tienes estas variables configuradas:

```bash
DJANGO_SECRET_KEY=3l1(l_*c_m(ml)e@zxf@1sg7i=tsj$g_s#nghlh(*=ldqkm1yy
FIELD_ENCRYPTION_KEY=okcgCpPIrFup7fdfanH-_wuUjZ0cnpMK-oXvFACdR0A=
DEBUG=False
ALLOWED_HOSTS=tu-dominio.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Paso 3: Verificar Builder

1. Ve a **"Settings"**
2. En **"Builder"**, asegúrate de que está seleccionado **"Nixpacks"**
3. Si dice "Dockerfile", cámbialo a "Nixpacks"

### Paso 4: Redesplegar

1. Ve a **"Deployments"**
2. Haz clic en **"Deploy"** o **"Redeploy"**
3. Espera 5-10 minutos (el primer build es más lento)

---

## 📝 Lo que Hace el Build

El archivo `nixpacks.toml` ejecuta estos pasos:

1. **Setup**: Instala Node.js 18 y Python 3.13
2. **Install**:
   - Instala dependencias de React (`npm install`)
   - Instala dependencias de Django (`pip install`)
3. **Build**:
   - Construye el frontend React (`npm run build`)
   - Recolecta archivos estáticos de Django (`collectstatic`)
4. **Start**:
   - Ejecuta migraciones de Django
   - Inicia Gunicorn con el WSGI de Django

---

## 🔍 Verificar el Build

### Durante el Build

En los logs deberías ver:

```
✓ Detected providers: python, nodejs
✓ Installing Node.js 18.x
✓ Installing Python 3.13
✓ Building frontend React...
✓ Collecting static files...
✓ Running migrations...
✓ Starting gunicorn...
```

### Errores Comunes

#### Error: "npm: command not found"

**Causa**: Nixpacks no detectó que necesitas Node.js

**Solución**: El `nixpacks.toml` debería solucionarlo. Si persiste, verifica que el archivo esté en la raíz.

#### Error: "No module named 'gunicorn'"

**Causa**: Las dependencias de Python no se instalaron

**Solución**: Verifica que `requirements.txt` está en la raíz y contiene `gunicorn==23.0.0`

#### Error: "python: command not found"

**Causa**: Railway no detectó Python correctamente

**Solución**: Verifica que `runtime.txt` está en la raíz con el contenido `python-3.13.1`

#### Error: "npm run build failed"

**Causa**: El frontend no se pudo construir

**Solución**:
1. Verifica que la carpeta `Reservas` existe
2. Verifica que `Reservas/package.json` existe
3. Revisa los logs para ver el error específico

---

## 🎯 Estructura Final del Repositorio

```
modulo_reservas/
├── nixpacks.toml          ← Configuración de build
├── railway.json           ← Configuración de Railway
├── Procfile               ← Procesos web/release
├── requirements.txt       ← Dependencias Python
├── runtime.txt            ← Versión de Python
├── build.sh               ← Script de build del frontend
├── REST frameworks/
│   └── ReservaProject/    ← Código Django
│       ├── manage.py
│       ├── ReservaProject/
│       ├── mainApp/
│       └── ...
└── Reservas/              ← Código React
    ├── package.json
    ├── src/
    └── ...
```

---

## ✅ Verificación Final

Una vez que el deployment sea exitoso:

1. Visita tu URL: `https://tu-app.up.railway.app`
2. Deberías ver la página de login del sistema de reservas
3. La API está en: `https://tu-app.up.railway.app/api/`
4. El admin está en: `https://tu-app.up.railway.app/admin/`

---

## 📞 Si Sigue Fallando

Si después de estos cambios el build sigue fallando:

1. **Copia los logs completos** del build (desde "Detected providers" hasta el error)
2. **Verifica que todos los archivos** (`nixpacks.toml`, `Procfile`, etc.) estén en la raíz
3. **Verifica que el Root Directory** esté vacío (no `REST frameworks/ReservaProject`)
4. **Verifica las variables de entorno** (especialmente `DATABASE_URL`)

---

**Última actualización**: Noviembre 2025
