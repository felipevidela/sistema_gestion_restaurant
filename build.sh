#!/bin/bash

echo "Iniciando build del proyecto..."

# Construir el frontend React
echo "Construyendo frontend React..."
cd frontend
npm install
npm run build
cd ..

echo "Build completado exitosamente!"
