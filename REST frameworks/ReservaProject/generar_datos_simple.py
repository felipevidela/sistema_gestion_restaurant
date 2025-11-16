#!/usr/bin/env python
"""
Script simple para generar reservas de ejemplo
Uso: python generar_datos_simple.py
"""
import os
import sys
import django
import random
from datetime import date, datetime, timedelta

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ReservaProject.settings')
django.setup()

from django.contrib.auth.models import User
from mainApp.models import Mesa, Perfil, Reserva

def generar_rut_valido(numero):
    """Genera un RUT chileno válido"""
    suma = 0
    multiplicador = 2

    for digit in reversed(str(numero)):
        suma += int(digit) * multiplicador
        multiplicador = multiplicador + 1 if multiplicador < 7 else 2

    resto = suma % 11
    dv = str(11 - resto) if resto != 0 else '0'
    if dv == '10':
        dv = 'K'

    return f'{numero}-{dv}'

print('🎲 Generando datos de ejemplo...\n')

# Nombres y apellidos chilenos
nombres = ['Juan', 'María', 'Pedro', 'Ana', 'Luis', 'Carolina', 'Diego', 'Francisca',
           'Andrés', 'Javiera', 'Felipe', 'Catalina', 'Sebastián', 'Valentina', 'Matías',
           'Sofía', 'Tomás', 'Martina', 'Benjamín', 'Isidora', 'Nicolás', 'Amanda']

apellidos = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
             'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes']

# 1. Crear 40 usuarios
print('👤 Creando usuarios...')
usuarios_creados = []

for i in range(40):
    nombre = random.choice(nombres)
    apellido = random.choice(apellidos)
    username = f'{nombre.lower()}.{apellido.lower()}.ej{i}'
    email = f'{username}@ejemplo.com'

    rut_numero = random.randint(10000000, 25999999)
    rut = generar_rut_valido(rut_numero)
    telefono = f'+569{random.randint(10000000, 99999999)}'

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password='Demo123!'
        )

        Perfil.objects.update_or_create(
            user=user,
            defaults={
                'rol': 'cliente',
                'nombre_completo': f'{nombre} {apellido}',
                'rut': rut,
                'telefono': telefono,
                'email': email
            }
        )

        usuarios_creados.append(user)
        if (i + 1) % 10 == 0:
            print(f'  ✓ {i + 1}/40 usuarios')

    except Exception as e:
        print(f'  ⚠ Error creando usuario {username}: {str(e)}')

print(f'✓ {len(usuarios_creados)} usuarios creados\n')

# 2. Obtener mesas
mesas = list(Mesa.objects.all())
print(f'🪑 {len(mesas)} mesas disponibles\n')

# 3. Generar reservas
print('📅 Generando reservas...')

horarios_almuerzo = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30']
horarios_cena = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00']

fecha_inicio = date.today()
fecha_fin = date(2025, 12, 31)
reservas_creadas = 0

fecha_actual = fecha_inicio
dias_procesados = 0

while fecha_actual <= fecha_fin:
    es_fin_de_semana = fecha_actual.weekday() >= 5
    num_reservas_hoy = random.randint(6, 14 if es_fin_de_semana else 10)

    for _ in range(num_reservas_hoy):
        usuario = random.choice(usuarios_creados)
        mesa = random.choice(mesas)

        max_personas = min(mesa.capacidad, 8)
        min_personas = max(1, mesa.capacidad // 2)
        num_personas = random.randint(min_personas, max_personas)

        if random.random() < 0.65:
            hora_str = random.choice(horarios_cena)
        else:
            hora_str = random.choice(horarios_almuerzo)

        hora_inicio = datetime.strptime(hora_str, '%H:%M').time()

        # Determinar estado
        if fecha_actual < date.today():
            estado = random.choices(['completada', 'cancelada'], weights=[85, 15])[0]
        elif fecha_actual == date.today():
            estado = random.choices(['pendiente', 'confirmada'], weights=[30, 70])[0]
        else:
            estados = ['pendiente', 'confirmada', 'completada', 'cancelada']
            pesos = [15, 60, 20, 5]
            estado = random.choices(estados, weights=pesos)[0]

        # Verificar si ya existe reserva en esa mesa/hora
        existe = Reserva.objects.filter(
            mesa=mesa,
            fecha_reserva=fecha_actual,
            hora_inicio=hora_inicio,
            estado__in=['pendiente', 'confirmada']
        ).exists()

        if existe:
            continue

        try:
            Reserva.objects.create(
                cliente=usuario,
                mesa=mesa,
                fecha_reserva=fecha_actual,
                hora_inicio=hora_inicio,
                num_personas=num_personas,
                estado=estado,
                notas=''
            )
            reservas_creadas += 1
        except Exception as e:
            continue

    fecha_actual += timedelta(days=1)
    dias_procesados += 1

    if dias_procesados % 7 == 0:
        print(f'  ✓ {dias_procesados} días, {reservas_creadas} reservas')

print(f'✓ {reservas_creadas} reservas creadas\n')

print('✅ ¡Completado!')
print(f'   Usuarios: {len(usuarios_creados)}')
print(f'   Reservas: {reservas_creadas}')
