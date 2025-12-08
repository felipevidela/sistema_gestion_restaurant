from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from mainApp.models import Perfil, Mesa, Reserva
from datetime import date, time, timedelta
import random


class Command(BaseCommand):
    help = 'Crea datos de demostración equilibrados con horas disponibles y saturadas'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limpiar',
            action='store_true',
            help='Elimina todas las reservas existentes antes de crear nuevas',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('='*70))
        self.stdout.write(self.style.WARNING('CREANDO DATOS DE DEMOSTRACIÓN EQUILIBRADOS'))
        self.stdout.write(self.style.WARNING('='*70))

        # Limpiar reservas si se especifica
        if options['limpiar']:
            self.stdout.write(self.style.WARNING('\nEliminando reservas existentes...'))
            count = Reserva.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'✓ {count} reservas eliminadas'))

        # Asegurar que existen las mesas (solo 6 mesas)
        self.stdout.write(self.style.SUCCESS('\nVerificando mesas...'))
        mesas_data = [
            {'numero': 1, 'capacidad': 2},
            {'numero': 2, 'capacidad': 2},
            {'numero': 3, 'capacidad': 4},
            {'numero': 4, 'capacidad': 4},
            {'numero': 5, 'capacidad': 6},
            {'numero': 6, 'capacidad': 8},
        ]

        mesas = []
        for mesa_data in mesas_data:
            mesa, created = Mesa.objects.get_or_create(
                numero=mesa_data['numero'],
                defaults={'capacidad': mesa_data['capacidad'], 'estado': 'disponible'}
            )
            mesas.append(mesa)
            status = 'Creada' if created else 'Verificada'
            self.stdout.write(f'  ✓ Mesa {mesa.numero} (Cap: {mesa.capacidad}) - {status}')

        # Crear usuarios de demostración
        self.stdout.write(self.style.SUCCESS('\nCreando/verificando usuarios de demostración...'))
        nombres = [
            ('Juan', 'Pérez'), ('Ana', 'Torres'), ('Luis', 'Morales'),
            ('Carmen', 'Silva'), ('Diego', 'Rojas'), ('Valentina', 'Muñoz'),
            ('Sebastián', 'Vargas'), ('Francisca', 'Contreras'), ('Matías', 'Herrera'),
            ('Sofía', 'Castro'), ('Nicolás', 'Reyes'), ('Catalina', 'Fuentes'),
            ('Felipe', 'Núñez'), ('Isabella', 'Flores'), ('Tomás', 'Mendoza'),
            ('Martina', 'Parra'), ('Agustín', 'Soto'), ('Emilia', 'Vega'),
            ('Vicente', 'Ortiz'), ('Josefa', 'Guzmán')
        ]

        clientes = []
        for i, (nombre, apellido) in enumerate(nombres, 1):
            username = f'demo{i}'
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@demo.com',
                    'first_name': nombre,
                    'last_name': apellido,
                }
            )

            if created:
                user.set_password('demo123')
                user.save()

            # Crear o verificar perfil
            perfil, _ = Perfil.objects.get_or_create(
                user=user,
                defaults={
                    'rol': 'cliente',
                    'nombre_completo': f'{nombre} {apellido}',
                    'rut': f'{10000000+i}-{random.randint(0,9)}',
                    'telefono': f'+569{random.randint(10000000,99999999)}',
                    'email': f'{username}@demo.com',
                }
            )

            clientes.append(user)
            if created:
                self.stdout.write(f'  ✓ Usuario: {username} ({nombre} {apellido}) - Password: demo123')

        self.stdout.write(self.style.SUCCESS(f'\n✓ Total {len(clientes)} usuarios de demostración listos'))

        # Generar reservas para los próximos 7 días
        self.stdout.write(self.style.SUCCESS('\nGenerando reservas de demostración...'))

        # Horarios disponibles (12:00 a 21:30, cada 30 min)
        horarios_inicio = []
        hora = 12
        minuto = 0
        while hora < 22 or (hora == 21 and minuto <= 30):
            horarios_inicio.append(time(hora, minuto))
            minuto += 30
            if minuto >= 60:
                minuto = 0
                hora += 1

        # Notas variadas para las reservas
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

        hoy = date.today()
        reservas_creadas = 0
        reservas_por_dia = {}

        for dia_offset in range(7):
            fecha = hoy + timedelta(days=dia_offset)
            reservas_dia = []

            self.stdout.write(f'\n  Procesando {fecha.strftime("%d/%m/%Y")}...')

            # Definir distribución de ocupación por horario
            distribucion_ocupacion = self._calcular_distribucion_ocupacion(horarios_inicio)

            for hora_inicio in horarios_inicio:
                # Determinar cuántas mesas reservar en este horario
                num_mesas_a_reservar = distribucion_ocupacion.get(hora_inicio, 0)

                if num_mesas_a_reservar == 0:
                    continue

                # Obtener mesas disponibles para este horario
                mesas_disponibles = self._obtener_mesas_disponibles(
                    mesas, fecha, hora_inicio, reservas_dia
                )

                # Limitar al número de mesas que queremos reservar
                mesas_a_usar = random.sample(
                    mesas_disponibles,
                    min(num_mesas_a_reservar, len(mesas_disponibles))
                )

                # Crear reservas para cada mesa seleccionada
                for mesa in mesas_a_usar:
                    cliente = random.choice(clientes)
                    num_personas = random.randint(1, mesa.capacidad)

                    # Calcular hora_fin (2 horas después)
                    hora_fin = self._calcular_hora_fin(hora_inicio)

                    # Determinar estado según la fecha
                    if dia_offset == 0:  # Hoy
                        # Mezcla de activas y completadas
                        if hora_inicio < time(17, 0):
                            estado = random.choice(['completada', 'completada', 'activa'])
                        else:
                            estado = 'activa'
                    else:  # Días futuros
                        estado = random.choice(['pendiente'] * 19 + ['cancelada'])

                    notas = random.choice(notas_posibles)

                    try:
                        reserva = Reserva.objects.create(
                            cliente=cliente,
                            mesa=mesa,
                            fecha_reserva=fecha,
                            hora_inicio=hora_inicio,
                            hora_fin=hora_fin,
                            num_personas=num_personas,
                            estado=estado,
                            notas=notas
                        )
                        reservas_dia.append(reserva)
                        reservas_creadas += 1
                    except Exception as e:
                        self.stdout.write(
                            self.style.WARNING(
                                f'    ⚠ Error creando reserva: {str(e)}'
                            )
                        )

            reservas_por_dia[fecha] = len(reservas_dia)
            self.stdout.write(
                self.style.SUCCESS(
                    f'    ✓ {len(reservas_dia)} reservas creadas'
                )
            )

        # Resumen final
        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('✓ DATOS DE DEMOSTRACIÓN CREADOS EXITOSAMENTE'))
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(f'\nTotal de reservas creadas: {reservas_creadas}')
        self.stdout.write('\nDistribución por día:')
        for fecha, cantidad in reservas_por_dia.items():
            self.stdout.write(f'  • {fecha.strftime("%d/%m/%Y")}: {cantidad} reservas')

        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('CARACTERÍSTICAS DE LOS DATOS:'))
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write('  • 6 mesas totales (capacidades: 2, 2, 4, 4, 6, 8)')
        self.stdout.write('  • Horarios pico (13:00-14:00, 20:00-21:00): 100% ocupación (6/6 mesas)')
        self.stdout.write('  • Horarios medios: 60-75% ocupación (4-5 mesas)')
        self.stdout.write('  • Horarios valle: 25-40% ocupación (2-3 mesas)')
        self.stdout.write('  • Mezcla de estados: pendiente, activa, completada, cancelada')
        self.stdout.write('\nCredenciales de acceso:')
        self.stdout.write('  • Usuarios demo: demo1, demo2, ... demo20')
        self.stdout.write('  • Password: demo123')
        self.stdout.write(self.style.SUCCESS('='*70))

    def _calcular_distribucion_ocupacion(self, horarios):
        """
        Calcula cuántas mesas deben estar ocupadas en cada horario
        para lograr una distribución equilibrada (6 mesas totales).
        """
        distribucion = {}

        for hora in horarios:
            # Horarios pico (100% ocupación - 6 mesas)
            if (time(13, 0) <= hora <= time(14, 0)) or (time(20, 0) <= hora <= time(21, 0)):
                num_mesas = 6
            # Horarios medios (60-75% ocupación - 4-5 mesas)
            elif (time(12, 0) <= hora < time(13, 0)) or \
                 (time(14, 0) < hora < time(16, 0)) or \
                 (time(19, 0) <= hora < time(20, 0)) or \
                 (time(21, 0) < hora <= time(21, 30)):
                num_mesas = random.randint(4, 5)
            # Horarios valle (25-40% ocupación - 2-3 mesas)
            else:
                num_mesas = random.randint(2, 3)

            distribucion[hora] = num_mesas

        return distribucion

    def _obtener_mesas_disponibles(self, todas_mesas, fecha, hora_inicio, reservas_dia):
        """
        Obtiene las mesas que están disponibles en un horario específico,
        considerando las reservas ya creadas para ese día.
        """
        hora_fin = self._calcular_hora_fin(hora_inicio)
        mesas_disponibles = list(todas_mesas)

        # Filtrar mesas que ya tienen reserva que se solapa
        for reserva in reservas_dia:
            # Verificar solapamiento
            if (hora_inicio < reserva.hora_fin and hora_fin > reserva.hora_inicio):
                if reserva.mesa in mesas_disponibles:
                    mesas_disponibles.remove(reserva.mesa)

        return mesas_disponibles

    def _calcular_hora_fin(self, hora_inicio):
        """
        Calcula la hora de fin sumando 2 horas a la hora de inicio.
        """
        dt_inicio = timedelta(hours=hora_inicio.hour, minutes=hora_inicio.minute)
        dt_fin = dt_inicio + timedelta(hours=2)

        horas = int(dt_fin.total_seconds() // 3600)
        minutos = int((dt_fin.total_seconds() % 3600) // 60)

        return time(horas, minutos)
