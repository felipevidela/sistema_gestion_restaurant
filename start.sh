#!/bin/bash
# Script de inicio para Railway

# Detectar si estamos en el directorio raíz o ya en backend
if [ -d "backend" ]; then
    BASE_DIR="."
    BACKEND_DIR="backend"
else
    BASE_DIR=".."
    BACKEND_DIR="."
fi

echo "Ejecutando migraciones..."
cd "$BACKEND_DIR"
python manage.py migrate --noinput

echo "Recopilando archivos estáticos (incluye frontend/dist)..."
python manage.py collectstatic --noinput

# TEMPORAL - Poblar base de datos con datos de prueba (REMOVER DESPUÉS DE EJECUTAR UNA VEZ)
echo "🚀 Poblando base de datos con datos de prueba..."
python manage.py poblar_railway_seguro --verbose || echo "⚠️  Error al poblar datos (ignorando...)"
# FIN TEMPORAL

echo "Iniciando servidor Daphne (ASGI para WebSockets)..."
daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application
