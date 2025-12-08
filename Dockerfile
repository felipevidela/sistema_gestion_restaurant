# Dockerfile para Railway - Sistema de Reservas
# Backend Django + Frontend React en una sola imagen

# Etapa 1: Build del Frontend React
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar package.json y package-lock.json
COPY frontend/package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para vite)
RUN npm ci || npm install

# Copiar código del frontend
COPY frontend/ ./

# Construir frontend
RUN npm run build

# Etapa 2: Aplicación Django + Frontend compilado
FROM python:3.13-slim

# Variables de entorno para Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Necesitamos que /app esté en PYTHONPATH para imports
ENV PYTHONPATH="/app/backend"

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar y instalar dependencias de Python
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Invalidar cache para forzar rebuild con código actualizado
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

# Copiar código de Django
COPY backend/ ./backend/

# Crear directorio para frontend y copiar archivos compilados
RUN mkdir -p ./frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist/

# Cambiar al directorio de Django
WORKDIR /app/backend

# Crear directorios para archivos estáticos
RUN mkdir -p staticfiles static

# Exponer puerto (Railway usa variable PORT)
EXPOSE 8000

# Script de inicio por defecto
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--log-file", "-", "--log-level", "info"]
