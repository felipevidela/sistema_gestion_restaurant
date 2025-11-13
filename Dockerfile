# Dockerfile para Railway - Sistema de Reservas
# Backend Django + Frontend React en una sola imagen

# Etapa 1: Build del Frontend React
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar package.json y package-lock.json
COPY Reservas/package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para vite)
RUN npm ci || npm install

# Copiar código del frontend
COPY Reservas/ ./

# Construir frontend
RUN npm run build

# Etapa 2: Aplicación Django + Frontend compilado
FROM python:3.13-slim

# Variables de entorno para Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar y instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Invalidar cache para forzar rebuild con código actualizado
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

# Copiar código de Django (sin comillas, Docker maneja los espacios)
COPY ["REST frameworks/ReservaProject/", "./ReservaProject/"]

# Crear directorio para frontend y copiar archivos compilados
RUN mkdir -p ./Reservas
COPY --from=frontend-builder /app/frontend/dist ./Reservas/dist/

# Cambiar al directorio de Django
WORKDIR /app/ReservaProject

# Crear directorio para archivos estáticos
RUN mkdir -p staticfiles

# Exponer puerto (Railway usa variable PORT)
EXPOSE 8000

# Script de inicio
CMD echo "=== Running migrations ===" && \
    python manage.py migrate --noinput && \
    echo "=== Collecting static files ===" && \
    python manage.py collectstatic --noinput && \
    echo "=== Listing /app structure ===" && \
    ls -la /app/ && \
    echo "=== Listing /app/Reservas ===" && \
    ls -la /app/Reservas/ 2>&1 || echo "Reservas directory not found!" && \
    echo "=== Starting gunicorn ===" && \
    gunicorn ReservaProject.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 4 \
    --worker-class sync \
    --log-file - \
    --access-logfile - \
    --error-logfile - \
    --log-level info
