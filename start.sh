#!/bin/bash
# Script de inicio para Railway

echo "Construyendo frontend..."
cd frontend && npm install && npm run build && cd ..

echo "Ejecutando migraciones..."
cd backend && python manage.py migrate --noinput

echo "Recopilando archivos estáticos (incluye frontend/dist)..."
python manage.py collectstatic --noinput

echo "Iniciando servidor Gunicorn..."
gunicorn -w 4 -b 0.0.0.0:${PORT:-8000} config.wsgi:application
