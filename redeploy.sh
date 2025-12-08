#!/bin/bash
# Script para forzar Railway a redesplegar

echo "Forzando Railway a redesplegar..."

# Crear commit vacío
git commit --allow-empty -m "Trigger Railway redeploy"

# Pushear a GitHub
git push origin main

echo "Commit vacío pusheado. Railway debería iniciar el deployment automáticamente."
echo "Ve a Railway Dashboard para monitorear el progreso."
