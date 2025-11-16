#!/usr/bin/env python
"""
Management command para generar reservas de ejemplo hasta el 31 de diciembre.
Uso: python manage.py generar_reservas_ejemplo [--usuarios N] [--reservas-por-dia N]
"""
import random
from datetime import date, datetime, timedelta, time
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from mainApp.models import Mesa, Perfil, Reserva


class Command(BaseCommand):
    help = 'Genera reservas de ejemplo con usuarios ficticios hasta el 31 de diciembre'

    def add_arguments(self, parser):
        parser.add_argument(
            '--usuarios',
            type=int,
            default=40,
            help='Número de usuarios ficticios a crear (default: 40)'
        )
        parser.add_argument(
            '--reservas-por-dia',
            type=int,
            default=8,
            help='Número promedio de reservas por día (default: 8)'
        )
        parser.add_argument(
            '--desde',
            type=str,
            default=None,
            help='Fecha de inicio (YYYY-MM-DD). Default: hoy'
        )

    def handle(self, *args, **options):
        num_usuarios = options['usuarios']
        reservas_por_dia = options['reservas_por_dia']

        # Determinar rango de fechas
        if options['desde']:
            fecha_inicio = datetime.strptime(options['desde'], '%Y-%m-%d').date()
        else:
            fecha_inicio = date.today()

        fecha_fin = date(2025, 12, 31)

        self.stdout.write(self.style.WARNING(
            f'\n🎲 Generando datos de ejemplo para el sistema de reservas...\n'
        ))
        self.stdout.write(f'📅 Rango: {fecha_inicio} → {fecha_fin}')
        self.stdout.write(f'👥 Usuarios a crear: {num_usuarios}')
        self.stdout.write(f'📊 Reservas por día (promedio): {reservas_por_dia}\n')

        try:
            with transaction.atomic():
                # 1. Crear usuarios ficticios
                usuarios_creados = self.crear_usuarios_ficticios(num_usuarios)

                # 2. Generar reservas
                reservas_creadas = self.generar_reservas(
                    usuarios_creados,
                    fecha_inicio,
                    fecha_fin,
                    reservas_por_dia
                )

                self.stdout.write(self.style.SUCCESS(
                    f'\n✅ Proceso completado exitosamente!'
                ))
                self.stdout.write(f'   Usuarios creados: {len(usuarios_creados)}')
                self.stdout.write(f'   Reservas creadas: {reservas_creadas}')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error: {str(e)}'))
            raise

    def crear_usuarios_ficticios(self, cantidad):
        """Crea usuarios ficticios con datos chilenos realistas"""

        nombres = [
            'Juan', 'María', 'Pedro', 'Ana', 'Luis', 'Carolina', 'Diego', 'Francisca',
            'Andrés', 'Javiera', 'Felipe', 'Catalina', 'Sebastián', 'Valentina', 'Matías',
            'Sofía', 'Tomás', 'Martina', 'Benjamín', 'Isidora', 'Nicolás', 'Amanda',
            'Cristóbal', 'Florencia', 'Vicente', 'Antonia', 'Joaquín', 'Emilia', 'Agustín',
            'Trinidad', 'Maximiliano', 'Constanza', 'Ignacio', 'Gabriela', 'Martín', 'Josefa'
        ]

        apellidos = [
            'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
            'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández',
            'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Ramírez',
            'Reyes', 'Álvarez', 'Fernández', 'Carrasco', 'Gutiérrez', 'Vargas', 'Núñez'
        ]

        self.stdout.write('👤 Creando usuarios ficticios...')

        usuarios_creados = []

        for i in range(cantidad):
            nombre = random.choice(nombres)
            apellido = random.choice(apellidos)
            username = f'{nombre.lower()}.{apellido.lower()}{i}'
            email = f'{username}@ejemplo.com'

            # Generar RUT válido
            rut_numero = random.randint(10000000, 25999999)
            rut = self.generar_rut_valido(rut_numero)

            # Generar teléfono chileno
            telefono = f'+569{random.randint(10000000, 99999999)}'

            # Crear usuario
            try:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password='Demo123!'  # Contraseña por defecto para demos
                )

                # Crear perfil
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
                    self.stdout.write(f'   ✓ {i + 1}/{cantidad} usuarios creados...')

            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'   ⚠ Usuario {username} ya existe, omitiendo...')
                )

        self.stdout.write(self.style.SUCCESS(f'   ✓ {len(usuarios_creados)} usuarios creados\n'))
        return usuarios_creados

    def generar_rut_valido(self, numero):
        """Genera un RUT chileno válido con dígito verificador correcto"""
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

    def generar_reservas(self, usuarios, fecha_inicio, fecha_fin, reservas_por_dia):
        """Genera reservas distribuidas en el rango de fechas"""

        self.stdout.write('📅 Generando reservas...')

        # Obtener todas las mesas
        mesas = list(Mesa.objects.all())
        if not mesas:
            raise Exception('No hay mesas en el sistema. Ejecuta crear_mesas.py primero.')

        # Horarios disponibles
        horarios_almuerzo = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30']
        horarios_cena = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00']

        # Estados posibles
        estados_posibles = ['pendiente', 'confirmada', 'completada', 'cancelada']
        pesos_estados = [15, 60, 20, 5]  # % de cada estado

        reservas_creadas = 0
        fecha_actual = fecha_inicio

        while fecha_actual <= fecha_fin:
            # Más reservas en fines de semana
            es_fin_de_semana = fecha_actual.weekday() >= 5  # 5=sábado, 6=domingo
            num_reservas_hoy = random.randint(
                reservas_por_dia - 2,
                reservas_por_dia + (6 if es_fin_de_semana else 2)
            )

            for _ in range(num_reservas_hoy):
                # Seleccionar usuario aleatorio
                usuario = random.choice(usuarios)

                # Seleccionar mesa aleatoria
                mesa = random.choice(mesas)

                # Número de personas (ajustado a la capacidad de la mesa)
                max_personas = min(mesa.capacidad, 8)
                min_personas = max(1, mesa.capacidad // 2)
                num_personas = random.randint(min_personas, max_personas)

                # Seleccionar horario (más cenas que almuerzos)
                if random.random() < 0.65:  # 65% cenas
                    hora_str = random.choice(horarios_cena)
                else:  # 35% almuerzos
                    hora_str = random.choice(horarios_almuerzo)

                hora_inicio = datetime.strptime(hora_str, '%H:%M').time()

                # Determinar estado según la fecha
                if fecha_actual < date.today():
                    # Reservas pasadas: completadas o canceladas
                    estado = random.choices(['completada', 'cancelada'], weights=[85, 15])[0]
                elif fecha_actual == date.today():
                    # Hoy: pendiente o confirmada
                    estado = random.choices(['pendiente', 'confirmada'], weights=[30, 70])[0]
                else:
                    # Futuras: según distribución normal
                    estado = random.choices(estados_posibles, weights=pesos_estados)[0]

                # Notas opcionales (10% de probabilidad)
                notas = ''
                if random.random() < 0.1:
                    notas_posibles = [
                        'Celebración de cumpleaños',
                        'Aniversario',
                        'Cena de negocios',
                        'Ventana preferida',
                        'Mesa tranquila',
                        'Alérgico a mariscos',
                        'Vegetariano',
                        'Primera vez en el restaurante'
                    ]
                    notas = random.choice(notas_posibles)

                # Verificar disponibilidad (evitar solapamientos en la misma mesa/hora)
                reserva_existente = Reserva.objects.filter(
                    mesa=mesa,
                    fecha_reserva=fecha_actual,
                    hora_inicio=hora_inicio,
                    estado__in=['pendiente', 'confirmada']
                ).exists()

                if reserva_existente:
                    continue  # Saltar esta reserva para evitar solapamiento

                # Crear reserva
                try:
                    Reserva.objects.create(
                        cliente=usuario,
                        mesa=mesa,
                        fecha_reserva=fecha_actual,
                        hora_inicio=hora_inicio,
                        num_personas=num_personas,
                        estado=estado,
                        notas=notas
                    )
                    reservas_creadas += 1

                except Exception as e:
                    # Si hay error, continuar con la siguiente
                    continue

            # Avanzar al siguiente día
            fecha_actual += timedelta(days=1)

            # Mostrar progreso cada semana
            if (fecha_actual - fecha_inicio).days % 7 == 0:
                dias_procesados = (fecha_actual - fecha_inicio).days
                self.stdout.write(f'   ✓ {dias_procesados} días procesados, {reservas_creadas} reservas creadas...')

        self.stdout.write(self.style.SUCCESS(
            f'   ✓ {reservas_creadas} reservas creadas\n'
        ))

        return reservas_creadas
