"""
Management command para actualizar perfiles sin nombre_completo.

Genera nombres completos aleatorios en español para todos los perfiles
que tienen el campo nombre_completo vacío.

Uso:
    python manage.py actualizar_nombres_completos              # Actualizar perfiles
    python manage.py actualizar_nombres_completos --dry-run    # Solo mostrar cambios
"""

from django.core.management.base import BaseCommand
from mainApp.models import Perfil
import random


class Command(BaseCommand):
    help = 'Actualiza perfiles sin nombre_completo con nombres aleatorios en español'

    # Listas de nombres y apellidos comunes en español/Chile
    NOMBRES_MASCULINOS = [
        'Juan', 'Carlos', 'Luis', 'Jorge', 'Miguel', 'Pedro', 'José',
        'Francisco', 'Antonio', 'Manuel', 'Diego', 'Javier', 'Fernando',
        'Andrés', 'Pablo', 'Ricardo', 'Sergio', 'Alejandro', 'Roberto',
        'Mauricio', 'Rodrigo', 'Cristian', 'Sebastián', 'Felipe', 'Gonzalo'
    ]

    NOMBRES_FEMENINOS = [
        'Ana', 'María', 'Carmen', 'Isabel', 'Patricia', 'Laura', 'Sofía',
        'Valentina', 'Camila', 'Catalina', 'Francisca', 'Javiera', 'Carolina',
        'Andrea', 'Daniela', 'Constanza', 'Fernanda', 'Gabriela', 'Marcela',
        'Alejandra', 'Claudia', 'Paola', 'Verónica', 'Beatriz', 'Rosa'
    ]

    APELLIDOS = [
        'González', 'Pérez', 'Torres', 'Silva', 'Morales', 'Rodríguez',
        'García', 'Martínez', 'López', 'Hernández', 'Díaz', 'Muñoz',
        'Rojas', 'Contreras', 'Soto', 'Fuentes', 'Sepúlveda', 'Valenzuela',
        'Espinoza', 'Reyes', 'Vargas', 'Castillo', 'Núñez', 'Ramírez',
        'Gutiérrez', 'Cortés', 'Vera', 'Poblete', 'Jiménez', 'Flores',
        'Sandoval', 'Cárdenas', 'Riquelme', 'Santana', 'Medina', 'Vega'
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra qué cambios se harían sin ejecutarlos',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        self.stdout.write(self.style.SUCCESS('=' * 70))
        if dry_run:
            self.stdout.write(self.style.WARNING('MODO DRY-RUN: No se realizarán cambios reales'))
        else:
            self.stdout.write(self.style.SUCCESS('Actualizando nombres completos...'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        # Encontrar perfiles sin nombre_completo (vacío o None)
        perfiles_sin_nombre = Perfil.objects.filter(
            nombre_completo__isnull=True
        ) | Perfil.objects.filter(
            nombre_completo=''
        )

        total_perfiles = perfiles_sin_nombre.count()

        if total_perfiles == 0:
            self.stdout.write(self.style.SUCCESS('\n✓ Todos los perfiles ya tienen nombre_completo'))
            return

        self.stdout.write(f'\nEncontrados {total_perfiles} perfil(es) sin nombre_completo\n')

        contador_actualizados = 0

        for perfil in perfiles_sin_nombre:
            # Generar nombre aleatorio
            # Alternar entre nombres masculinos y femeninos
            if random.choice([True, False]):
                nombre = random.choice(self.NOMBRES_MASCULINOS)
            else:
                nombre = random.choice(self.NOMBRES_FEMENINOS)

            # Generar apellido compuesto ocasionalmente
            if random.random() < 0.3:  # 30% de probabilidad de apellido compuesto
                apellido = f"{random.choice(self.APELLIDOS)} {random.choice(self.APELLIDOS)}"
            else:
                apellido = random.choice(self.APELLIDOS)

            nombre_completo = f"{nombre} {apellido}"

            # Mostrar información
            username = perfil.user.username
            rol = perfil.get_rol_display()

            if dry_run:
                self.stdout.write(
                    f"  [{rol}] {username:20s} -> {self.style.SUCCESS(nombre_completo)}"
                )
            else:
                perfil.nombre_completo = nombre_completo
                perfil.save()
                contador_actualizados += 1
                self.stdout.write(
                    f"  ✓ [{rol}] {username:20s} -> {self.style.SUCCESS(nombre_completo)}"
                )

        # Resumen final
        self.stdout.write('\n' + '=' * 70)
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'\nDRY-RUN: Se actualizarían {total_perfiles} perfil(es)')
            )
            self.stdout.write(
                self.style.WARNING('Ejecuta sin --dry-run para aplicar los cambios')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'\n✓ Actualizados {contador_actualizados} perfil(es) exitosamente')
            )

        self.stdout.write(self.style.SUCCESS('=' * 70 + '\n'))
