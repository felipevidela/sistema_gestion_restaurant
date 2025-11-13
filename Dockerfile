# Dockerfile para Railway - Sistema de Reservas
# Backend Django + Frontend React en una sola imagen

# Etapa 1: Build del Frontend React
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar package.json y package-lock.json
COPY Reservas/package*.json ./

# Instalar dependencias
RUN npm ci --only=production || npm install

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

# Copiar código de Django (sin comillas, Docker maneja los espacios)
COPY ["REST frameworks/ReservaProject/", "./ReservaProject/"]

# Copiar frontend compilado desde la etapa anterior
COPY --from=frontend-builder /app/frontend/dist ./Reservas/dist/

# Cambiar al directorio de Django
WORKDIR /app/ReservaProject

# Crear directorio para archivos estáticos
RUN mkdir -p staticfiles

# Exponer puerto (Railway usa variable PORT)
EXPOSE 8000

# Script de inicio
CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    gunicorn ReservaProject.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 4 \
    --worker-class sync \
    --log-file - \
    --access-logfile - \
    --error-logfile - \
    --log-level info
