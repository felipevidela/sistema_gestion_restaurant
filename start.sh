#!/bin/bash
# Script de inicio para Railway

echo "Ejecutando migraciones..."
python manage.py migrate --noinput

echo "Recopilando archivos estáticos..."
python manage.py collectstatic --noinput

echo "Iniciando servidor Daphne (ASGI para WebSockets)..."
daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application
