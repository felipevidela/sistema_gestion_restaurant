#!/bin/bash
# Script de inicio para Railway

echo "Ejecutando migraciones..."
cd /app/backend && python manage.py migrate --noinput

echo "Recopilando archivos estáticos..."
cd /app/backend && python manage.py collectstatic --noinput

echo "Iniciando servidor Gunicorn..."
cd /app/backend && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 4 --log-file - --log-level info
