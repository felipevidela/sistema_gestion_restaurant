#!/usr/bin/env python
"""
Script para crear un superusuario admin si no existe
Uso: python crear_superuser.py
"""
import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ReservaProject.settings')
django.setup()

from django.contrib.auth.models import User
from mainApp.models import Perfil

def crear_superuser():
    """Crear superusuario admin si no existe"""

    username = 'admin'
    email = 'admin@reservas.com'
    password = 'admin123456'  # Cambiar después del primer login

    if User.objects.filter(username=username).exists():
        print(f'○ Usuario "{username}" ya existe')
        user = User.objects.get(username=username)
        print(f'  Email: {user.email}')
        print(f'  Es superuser: {user.is_superuser}')
        print(f'  Es staff: {user.is_staff}')
        return

    # Crear superusuario
    user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password
    )

    # Crear perfil con rol admin
    perfil, created = Perfil.objects.get_or_create(
        user=user,
        defaults={
            'rol': 'admin',
            'nombre_completo': 'Administrador del Sistema'
        }
    )

    print(f'✓ Superusuario creado exitosamente')
    print(f'  Username: {username}')
    print(f'  Email: {email}')
    print(f'  Password: {password}')
    print(f'  Rol: {perfil.get_rol_display()}')
    print(f'\n⚠️  IMPORTANTE: Cambia la contraseña después del primer login')
    print(f'  Panel admin: https://moduloreservas-production.up.railway.app/admin/')

if __name__ == '__main__':
    print('Creando superusuario admin...\n')
    crear_superuser()
