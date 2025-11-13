# Dockerfile para Railway - Sistema de Reservas
# Backend Django + Frontend React en una sola imagen

# Etapa 1: Build del Frontend React
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY Reservas/package*.json ./
RUN npm install
COPY Reservas/ ./
RUN npm run build

# Etapa 2: Aplicación Django + Frontend compilado
FROM python:3.13-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements.txt e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de Django
COPY "REST frameworks/ReservaProject/" ./ReservaProject/

# Copiar frontend compilado desde la etapa anterior
COPY --from=frontend-builder /app/frontend/dist ./Reservas/dist/

# Cambiar al directorio de Django
WORKDIR /app/ReservaProject

# Recolectar archivos estáticos
RUN python manage.py collectstatic --noinput || echo "Collectstatic failed, continuing..."

# Exponer puerto
EXPOSE 8000

# Comando de inicio
CMD python manage.py migrate && \
    gunicorn ReservaProject.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --log-file -
