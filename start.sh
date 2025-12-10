#!/bin/bash
# Script de inicio para Railway

# Detectar si estamos en el directorio raíz o ya en backend
if [ -d "backend" ]; then
    BASE_DIR="."
    BACKEND_DIR="backend"
    FRONTEND_DIR="frontend"
else
    BASE_DIR=".."
    BACKEND_DIR="."
    FRONTEND_DIR="../frontend"
fi

echo "Construyendo frontend..."
if [ -d "$FRONTEND_DIR" ]; then
    (cd "$FRONTEND_DIR" && npm install && npm run build)
else
    echo "Frontend directory not found, skipping build"
fi

echo "Ejecutando migraciones..."
cd "$BACKEND_DIR"
python manage.py migrate --noinput

echo "Recopilando archivos estáticos (incluye frontend/dist)..."
python manage.py collectstatic --noinput

echo "Iniciando servidor Gunicorn..."
gunicorn -w 4 -b 0.0.0.0:${PORT:-8000} config.wsgi:application
