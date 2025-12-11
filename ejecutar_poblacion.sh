#!/bin/bash
# Script para ejecutar el comando de población en Railway

echo "🚀 Ejecutando comando de población de datos..."
cd backend
python manage.py poblar_railway_seguro --verbose

echo "✅ Comando completado"
