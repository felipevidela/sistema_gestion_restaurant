# 🔧 Troubleshooting Docker Build en Railway

## Cambios Aplicados al Dockerfile

He corregido varios problemas en el Dockerfile:

### 1. ✅ Sintaxis Correcta para Rutas con Espacios

**Antes (INCORRECTO):**
```dockerfile
COPY "REST frameworks/ReservaProject/" ./ReservaProject/
```

**Ahora (CORRECTO):**
```dockerfile
COPY ["REST frameworks/ReservaProject/", "./ReservaProject/"]
```

Docker requiere sintaxis JSON para rutas con espacios.

### 2. ✅ Variables de Entorno Optimizadas

```dockerfile
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
```

Esto previene problemas con logs y archivos .pyc.

### 3. ✅ Instalación de GCC

```dockerfile
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc
```

GCC es necesario para compilar algunas dependencias de Python (como psycopg2).

### 4. ✅ Mejor Manejo del PORT

```dockerfile
--bind 0.0.0.0:${PORT:-8000}
```

Usa la variable PORT de Railway, con fallback a 8000.

### 5. ✅ npm ci con Fallback

```dockerfile
RUN npm ci --only=production || npm install
```

Intenta npm ci primero (más rápido), si falla usa npm install.

### 6. ✅ Collectstatic Movido al CMD

Ahora `collectstatic` se ejecuta al iniciar, no durante el build. Esto evita errores si faltan variables de entorno durante el build.

---

## 📊 Qué Esperar en los Logs

### ✅ Build Exitoso

Si el Dockerfile funciona, verás:

```
#1 [internal] load build definition from Dockerfile
#2 [internal] load .dockerignore
#3 [frontend-builder 1/7] FROM docker.io/library/node:18-alpine
#4 [frontend-builder 2/7] WORKDIR /app/frontend
#5 [frontend-builder 3/7] COPY Reservas/package*.json ./
#6 [frontend-builder 4/7] RUN npm ci --only=production || npm install
   npm WARN using --force Recommended protections disabled.
   added 312 packages in 8s
#7 [frontend-builder 5/7] COPY Reservas/ ./
#8 [frontend-builder 6/7] RUN npm run build
   > reservas@0.0.0 build
   > vite build
   vite v7.2.2 building for production...
   ✓ 42 modules transformed.
   dist/index.html                   0.45 kB
   dist/assets/index-abc123.css      12.34 kB
   dist/assets/index-def456.js       234.56 kB
   ✓ built in 4.21s
#9 [stage-1 1/9] FROM docker.io/library/python:3.13-slim
#10 [stage-1 3/9] RUN apt-get update && apt-get install -y postgresql-client gcc
   Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]
   ...
   Setting up gcc (4:12.2.0-3) ...
#11 [stage-1 5/9] COPY requirements.txt .
#12 [stage-1 6/9] RUN pip install --no-cache-dir -r requirements.txt
   Collecting Django==5.2.7
   Downloading Django-5.2.7-py3-none-any.whl (8.3 MB)
   ...
   Successfully installed Django-5.2.7 djangorestframework-3.16.1 ...
#13 [stage-1 7/9] COPY ["REST frameworks/ReservaProject/", "./ReservaProject/"]
#14 [stage-1 8/9] COPY --from=frontend-builder /app/frontend/dist ./Reservas/dist/
#15 [stage-1 9/9] RUN mkdir -p staticfiles
#16 exporting to image
#17 exporting layers
#18 writing image sha256:abc123def456...
✓ Build complete!

Starting deployment...
Running migrations:
  No migrations to apply.
Collecting static files...
42 static files copied to 'staticfiles'.
[2025-11-13 12:00:00 +0000] [1] [INFO] Starting gunicorn 23.0.0
[2025-11-13 12:00:00 +0000] [1] [INFO] Listening at: http://0.0.0.0:8000
[2025-11-13 12:00:00 +0000] [8] [INFO] Booting worker with pid: 8
✓ Deployment successful!
```

---

## ❌ Errores Comunes y Soluciones

### Error 1: "COPY failed: file not found"

```
#13 [stage-1 7/9] COPY ["REST frameworks/ReservaProject/", "./ReservaProject/"]
ERROR: failed to solve: failed to compute cache key: failed to calculate checksum of ref...
```

**Causa**: La carpeta no existe o el nombre es incorrecto.

**Solución**:
1. Verifica que la carpeta existe en GitHub: `REST frameworks/ReservaProject/`
2. Verifica que el `.dockerignore` no está excluyendo esa carpeta

### Error 2: "npm ERR! code ENOENT"

```
#6 [frontend-builder 4/7] RUN npm ci --only=production || npm install
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /app/frontend/package.json
```

**Causa**: No se encontró `package.json` en la carpeta Reservas.

**Solución**:
1. Verifica que existe `Reservas/package.json` en tu repositorio
2. Verifica que no está en `.dockerignore`

### Error 3: "gcc: command not found" o "error: command 'gcc' failed"

```
#12 [stage-1 6/9] RUN pip install --no-cache-dir -r requirements.txt
error: command 'gcc' failed with exit status 1
```

**Causa**: Algunas dependencias Python requieren compilación.

**Solución**: El Dockerfile actualizado ya incluye `gcc` en la instalación.

### Error 4: "collectstatic: SECRET_KEY not set"

```
CommandError: You must set settings.SECRET_KEY
```

**Causa**: La variable de entorno `DJANGO_SECRET_KEY` no está configurada en Railway.

**Solución**:
1. Ve a Railway → Variables
2. Verifica que existe `DJANGO_SECRET_KEY=3l1(l_*c_m(ml)e@zxf@1sg7i=tsj$g_s#nghlh(*=ldqkm1yy`

### Error 5: "Application failed to respond"

```
✓ Build complete!
Starting deployment...
Error: Application failed to respond within 30 seconds
```

**Causa**: Gunicorn no está escuchando en el puerto correcto o las migraciones tardan mucho.

**Solución**:
1. Verifica que el PORT está configurado en Railway (Railway lo hace automáticamente)
2. Revisa los logs de la aplicación (no del build) para ver qué está fallando
3. El Dockerfile actualizado usa `${PORT:-8000}` que debería solucionar esto

---

## 🔍 Cómo Diagnosticar el Error Actual

Para ayudarte mejor, necesito ver los logs completos. Sigue estos pasos:

### 1. Ver Logs del Build

1. En Railway, ve a **"Deployments"**
2. Haz clic en el deployment que falló
3. Haz clic en **"View Logs"** o **"Build Logs"**
4. Copia **TODO el contenido** desde el inicio hasta el error

### 2. Busca el Error Específico

Los logs mostrarán algo como:

```
#13 [stage-1 7/9] COPY ["REST frameworks/ReservaProject/", "./ReservaProject/"]
ERROR: failed to solve: failed to compute cache key...
```

O:

```
#12 [stage-1 6/9] RUN pip install --no-cache-dir -r requirements.txt
ERROR: Could not find a version that satisfies the requirement Django==5.2.7
```

### 3. Comparte los Logs

Copia desde:
- `#1 [internal] load build definition from Dockerfile`

Hasta:
- El mensaje de error completo

---

## 🧪 Probar el Dockerfile Localmente (Opcional)

Si tienes Docker instalado en tu computadora, puedes probar el build localmente:

```bash
cd "/Users/felipevidela/Desktop/modulo_reservas"

# Construir la imagen
docker build -t reservas-app .

# Si funciona, verás "Build complete!"
# Si falla, verás el error exacto
```

Esto te permitirá ver el error sin necesidad de esperar el deployment en Railway.

---

## 📞 Próximos Pasos

1. **Sube el Dockerfile corregido** (yo lo haré ahora)
2. **Redespliega en Railway**
3. **Copia los logs completos del build**
4. **Compártelos conmigo** para diagnosticar el error específico

---

**Última actualización**: Noviembre 2025
