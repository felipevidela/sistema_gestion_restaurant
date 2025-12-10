#!/bin/bash
# Script de inicio para Railway

echo "Construyendo frontend..."
cd frontend && npm install && npm run build && cd ..

echo "Copiando build del frontend a staticfiles..."
mkdir -p backend/staticfiles
cp -r frontend/dist backend/staticfiles/

echo "Ejecutando migraciones..."
cd backend && python manage.py migrate --noinput

echo "Recopilando archivos estáticos..."
python manage.py collectstatic --noinput

echo "Iniciando servidor Daphne (ASGI para WebSockets)..."
daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application
