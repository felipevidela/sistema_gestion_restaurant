from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from mainApp.models import Perfil, Mesa, Reserva
from datetime import date, time, timedelta


class Command(BaseCommand):
    help = 'Pobla la base de datos con datos de prueba: usuarios, mesas y reservas'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Eliminando datos existentes...'))

        # Eliminar datos existentes (opcional)
        # Reserva.objects.all().delete()
        # Mesa.objects.all().delete()
        # User.objects.filter(is_superuser=False).delete()

        self.stdout.write(self.style.SUCCESS('Creando usuarios de prueba...'))

        # Crear usuarios con diferentes roles
        users_data = [
            {
                'username': 'admin',
                'password': 'admin123',
                'email': 'admin@reservas.com',
                'first_name': 'Administrador',
                'last_name': 'Sistema',
                'rol': 'admin',
                'nombre_completo': 'Administrador del Sistema',
                'rut': '11111111-1',
                'telefono': '+56912345678',
            },
            {
                'username': 'cajero1',
                'password': 'cajero123',
                'email': 'cajero1@reservas.com',
                'first_name': 'María',
                'last_name': 'González',
                'rol': 'cajero',
                'nombre_completo': 'María González',
                'rut': '22222222-2',
                'telefono': '+56923456789',
            },
            {
                'username': 'cajero2',
                'password': 'cajero123',
                'email': 'cajero2@reservas.com',
                'first_name': 'Pedro',
                'last_name': 'Ramírez',
                'rol': 'cajero',
                'nombre_completo': 'Pedro Ramírez',
                'rut': '33333333-3',
                'telefono': '+56934567890',
            },
            {
                'username': 'mesero1',
                'password': 'mesero123',
                'email': 'mesero1@reservas.com',
                'first_name': 'Carlos',
                'last_name': 'Soto',
                'rol': 'mesero',
                'nombre_completo': 'Carlos Soto',
                'rut': '44444444-4',
                'telefono': '+56945678901',
            },
            {
                'username': 'cliente1',
                'password': 'cliente123',
                'email': 'cliente1@example.com',
                'first_name': 'Juan',
                'last_name': 'Pérez',
                'rol': 'cliente',
                'nombre_completo': 'Juan Pérez López',
                'rut': '55555555-5',
                'telefono': '+56956789012',
            },
            {
                'username': 'cliente2',
                'password': 'cliente123',
                'email': 'cliente2@example.com',
                'first_name': 'Ana',
                'last_name': 'Torres',
                'rol': 'cliente',
                'nombre_completo': 'Ana Torres Martínez',
                'rut': '66666666-6',
                'telefono': '+56967890123',
            },
            {
                'username': 'cliente3',
                'password': 'cliente123',
                'email': 'cliente3@example.com',
                'first_name': 'Luis',
                'last_name': 'Morales',
                'rol': 'cliente',
                'nombre_completo': 'Luis Morales Fernández',
                'rut': '77777777-7',
                'telefono': '+56978901234',
            },
        ]

        usuarios_creados = {}
        for user_data in users_data:
            # Crear o actualizar usuario
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={
                    'email': user_data['email'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                }
            )

            if created:
                user.set_password(user_data['password'])
                user.save()

            # Crear o actualizar perfil
            perfil, created = Perfil.objects.get_or_create(
                user=user,
                defaults={
                    'rol': user_data['rol'],
                    'nombre_completo': user_data['nombre_completo'],
                    'rut': user_data['rut'],
                    'telefono': user_data['telefono'],
                    'email': user_data['email'],
                }
            )

            if not created:
                perfil.rol = user_data['rol']
                perfil.nombre_completo = user_data['nombre_completo']
                perfil.rut = user_data['rut']
                perfil.telefono = user_data['telefono']
                perfil.email = user_data['email']
                perfil.save()

            usuarios_creados[user_data['username']] = user

            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Usuario: {user.username} ({perfil.get_rol_display()}) - Password: {user_data["password"]}'
                )
            )

        # Crear mesas (solo 6 mesas)
        self.stdout.write(self.style.SUCCESS('\nCreando mesas...'))
        mesas_data = [
            {'numero': 1, 'capacidad': 2, 'estado': 'disponible'},
            {'numero': 2, 'capacidad': 2, 'estado': 'disponible'},
            {'numero': 3, 'capacidad': 4, 'estado': 'disponible'},
            {'numero': 4, 'capacidad': 4, 'estado': 'disponible'},
            {'numero': 5, 'capacidad': 6, 'estado': 'disponible'},
            {'numero': 6, 'capacidad': 8, 'estado': 'disponible'},
        ]

        mesas_creadas = []
        for mesa_data in mesas_data:
            mesa, created = Mesa.objects.get_or_create(
                numero=mesa_data['numero'],
                defaults={
                    'capacidad': mesa_data['capacidad'],
                    'estado': mesa_data['estado'],
                }
            )
            mesas_creadas.append(mesa)
            status = 'Creada' if created else 'Ya existía'
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Mesa {mesa.numero} (Cap: {mesa.capacidad}) - {status}'
                )
            )

        # Crear reservas de ejemplo
        self.stdout.write(self.style.SUCCESS('\nCreando reservas de ejemplo...'))

        hoy = date.today()
        mañana = hoy + timedelta(days=1)

        reservas_data = [
            {
                'cliente': usuarios_creados['cliente1'],
                'mesa': mesas_creadas[0],  # Mesa 1
                'fecha_reserva': hoy,
                'hora_inicio': time(13, 0),
                'hora_fin': time(14, 30),
                'num_personas': 2,
                'estado': 'activa',
                'notas': 'Mesa cerca de la ventana',
            },
            {
                'cliente': usuarios_creados['cliente2'],
                'mesa': mesas_creadas[2],  # Mesa 3
                'fecha_reserva': hoy,
                'hora_inicio': time(13, 30),
                'hora_fin': time(15, 0),
                'num_personas': 4,
                'estado': 'pendiente',
                'notas': 'Cumpleaños - necesita torta',
            },
            {
                'cliente': usuarios_creados['cliente3'],
                'mesa': mesas_creadas[4],  # Mesa 5
                'fecha_reserva': hoy,
                'hora_inicio': time(14, 0),
                'hora_fin': time(15, 30),
                'num_personas': 3,
                'estado': 'pendiente',
                'notas': '',
            },
            {
                'cliente': usuarios_creados['cliente1'],
                'mesa': mesas_creadas[5],  # Mesa 6
                'fecha_reserva': mañana,
                'hora_inicio': time(19, 0),
                'hora_fin': time(21, 0),
                'num_personas': 6,
                'estado': 'pendiente',
                'notas': 'Cena de empresa',
            },
            {
                'cliente': usuarios_creados['cliente2'],
                'mesa': mesas_creadas[1],  # Mesa 2
                'fecha_reserva': mañana,
                'hora_inicio': time(20, 0),
                'hora_fin': time(22, 0),
                'num_personas': 2,
                'estado': 'pendiente',
                'notas': 'Aniversario',
            },
        ]

        for reserva_data in reservas_data:
            try:
                reserva, created = Reserva.objects.get_or_create(
                    cliente=reserva_data['cliente'],
                    mesa=reserva_data['mesa'],
                    fecha_reserva=reserva_data['fecha_reserva'],
                    hora_inicio=reserva_data['hora_inicio'],
                    defaults={
                        'hora_fin': reserva_data['hora_fin'],
                        'num_personas': reserva_data['num_personas'],
                        'estado': reserva_data['estado'],
                        'notas': reserva_data['notas'],
                    }
                )

                # Actualizar estado de la mesa
                if reserva.estado == 'activa':
                    reserva.mesa.estado = 'ocupada'
                elif reserva.estado == 'pendiente':
                    reserva.mesa.estado = 'reservada'

                reserva.mesa.save()

                status = 'Creada' if created else 'Ya existía'
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Reserva: {reserva.cliente.username} - Mesa {reserva.mesa.numero} - '
                        f'{reserva.fecha_reserva} a las {reserva.hora_inicio} ({reserva.get_estado_display()}) - {status}'
                    )
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Error al crear reserva: {str(e)}'
                    )
                )

        self.stdout.write(self.style.SUCCESS('\n' + '='*60))
        self.stdout.write(self.style.SUCCESS('¡Datos de prueba creados exitosamente!'))
        self.stdout.write(self.style.SUCCESS('='*60))
        self.stdout.write(self.style.SUCCESS('\nCredenciales de acceso:'))
        self.stdout.write(self.style.SUCCESS('  Admin:   admin / admin123'))
        self.stdout.write(self.style.SUCCESS('  Cajero:  cajero1 / cajero123'))
        self.stdout.write(self.style.SUCCESS('  Mesero:  mesero1 / mesero123'))
        self.stdout.write(self.style.SUCCESS('  Cliente: cliente1 / cliente123'))
        self.stdout.write(self.style.SUCCESS('='*60))
