#!/usr/bin/env python3
"""
Script para extender datos de demostración del 22 de noviembre al 31 de diciembre de 2025
"""
import os
import sys
import django
from datetime import date, time, timedelta
import random

# Configurar Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ReservaProject.settings')
django.setup()

from mainApp.models import Mesa, Reserva
from django.contrib.auth.models import User

def calcular_hora_fin(hora_inicio):
    """Calcula la hora de fin sumando 2 horas"""
    dt_inicio = timedelta(hours=hora_inicio.hour, minutes=hora_inicio.minute)
    dt_fin = dt_inicio + timedelta(hours=2)
    horas = int(dt_fin.total_seconds() // 3600)
    minutos = int((dt_fin.total_seconds() % 3600) // 60)
    return time(horas, minutos)

def calcular_distribucion_ocupacion(hora):
    """Calcula cuántas mesas deben estar ocupadas en cada horario"""
    # Horarios pico (100% ocupación - 8 mesas)
    if (time(13, 0) <= hora <= time(14, 0)) or (time(20, 0) <= hora <= time(21, 0)):
        return 8
    # Horarios medios (60-75% ocupación - 5-6 mesas)
    elif (time(12, 0) <= hora < time(13, 0)) or \
         (time(14, 0) < hora < time(16, 0)) or \
         (time(19, 0) <= hora < time(20, 0)) or \
         (time(21, 0) < hora <= time(21, 30)):
        return random.randint(5, 6)
    # Horarios valle (25-40% ocupación - 2-3 mesas)
    else:
        return random.randint(2, 3)

def obtener_mesas_disponibles(todas_mesas, fecha, hora_inicio, reservas_dia):
    """Obtiene las mesas disponibles en un horario específico"""
    hora_fin = calcular_hora_fin(hora_inicio)
    mesas_disponibles = list(todas_mesas)

    for reserva in reservas_dia:
        # Verificar solapamiento
        if (hora_inicio < reserva.hora_fin and hora_fin > reserva.hora_inicio):
            if reserva.mesa in mesas_disponibles:
                mesas_disponibles.remove(reserva.mesa)

    return mesas_disponibles

def main():
    print("="*70)
    print("EXTENDIENDO DATOS DE DEMOSTRACIÓN")
    print("Del 22/11/2025 al 31/12/2025")
    print("="*70)

    # Obtener todas las mesas
    mesas = list(Mesa.objects.all().order_by('numero'))
    print(f"\n✓ {len(mesas)} mesas encontradas")

    # Obtener usuarios clientes
    clientes = list(User.objects.filter(perfil__rol='cliente'))
    print(f"✓ {len(clientes)} usuarios clientes encontrados")

    if not clientes:
        print("❌ Error: No hay usuarios clientes. Ejecuta primero crear_datos_demo")
        return

    # Generar horarios (12:00 a 21:30, cada 30 min)
    horarios_inicio = []
    for hora in range(12, 22):
        for minuto in [0, 30]:
            horarios_inicio.append(time(hora, minuto))

    # Notas variadas
    notas_posibles = [
        '', '', '',  # Mayoría sin notas
        'Cumpleaños',
        'Aniversario',
        'Cena de empresa',
        'Mesa cerca de la ventana',
        'Celebración especial',
        'Necesita silla para bebé',
        'Ambiente tranquilo preferido',
    ]

    # Fechas a procesar
    fecha_inicio = date(2025, 11, 22)
    fecha_fin = date(2025, 12, 31)

    total_reservas = 0
    fecha_actual = fecha_inicio

    print(f"\nGenerando reservas...\n")

    while fecha_actual <= fecha_fin:
        reservas_dia = []

        for hora_inicio in horarios_inicio:
            # Determinar cuántas mesas reservar
            num_mesas_a_reservar = calcular_distribucion_ocupacion(hora_inicio)

            if num_mesas_a_reservar == 0:
                continue

            # Obtener mesas disponibles
            mesas_disponibles = obtener_mesas_disponibles(
                mesas, fecha_actual, hora_inicio, reservas_dia
            )

            # Limitar al número de mesas que queremos reservar
            mesas_a_usar = random.sample(
                mesas_disponibles,
                min(num_mesas_a_reservar, len(mesas_disponibles))
            )

            # Crear reservas
            for mesa in mesas_a_usar:
                cliente = random.choice(clientes)
                num_personas = random.randint(1, mesa.capacidad)
                hora_fin = calcular_hora_fin(hora_inicio)

                # Determinar estado según la fecha
                hoy = date.today()
                if fecha_actual == hoy:
                    if hora_inicio < time(17, 0):
                        estado = random.choice(['completada', 'completada', 'activa'])
                    else:
                        estado = 'activa'
                elif fecha_actual < hoy:
                    estado = random.choice(['completada'] * 18 + ['cancelada'])
                else:  # Fecha futura
                    estado = random.choice(['pendiente'] * 19 + ['cancelada'])

                notas = random.choice(notas_posibles)

                try:
                    reserva = Reserva.objects.create(
                        cliente=cliente,
                        mesa=mesa,
                        fecha_reserva=fecha_actual,
                        hora_inicio=hora_inicio,
                        hora_fin=hora_fin,
                        num_personas=num_personas,
                        estado=estado,
                        notas=notas
                    )
                    reservas_dia.append(reserva)
                except Exception as e:
                    pass  # Silenciar errores de reservas duplicadas

        total_reservas += len(reservas_dia)
        print(f"  ✓ {fecha_actual.strftime('%d/%m/%Y')}: {len(reservas_dia)} reservas")

        fecha_actual += timedelta(days=1)

    print(f"\n{'='*70}")
    print(f"✓ DATOS EXTENDIDOS EXITOSAMENTE")
    print(f"{'='*70}")
    print(f"Total de reservas nuevas creadas: {total_reservas}")
    print(f"Período: 22/11/2025 - 31/12/2025")
    print(f"{'='*70}\n")

if __name__ == '__main__':
    main()
