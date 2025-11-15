"""
Management command para agregar teléfono y RUT a perfiles que no los tienen.

Genera datos de contacto aleatorios (teléfono y RUT chilenos) para perfiles sin estos campos.

Uso:
    python manage.py completar_datos_contacto              # Actualizar perfiles
    python manage.py completar_datos_contacto --dry-run    # Solo mostrar cambios
"""

from django.core.management.base import BaseCommand
from mainApp.models import Perfil
import random


class Command(BaseCommand):
    help = 'Completa teléfono y RUT en perfiles que no los tienen'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra qué cambios se harían sin ejecutarlos',
        )

    def generar_telefono_chileno(self):
        """Genera un número de teléfono chileno válido"""
        # Formato: +56 9 XXXX XXXX (móvil chileno)
        numero = ''.join([str(random.randint(0, 9)) for _ in range(8)])
        return f"+569{numero}"

    def generar_rut_chileno(self):
        """Genera un RUT chileno válido"""
        # Generar número base (7-8 dígitos)
        numero = random.randint(5000000, 25000000)

        # Calcular dígito verificador
        suma = 0
        multiplicador = 2
        for digit in reversed(str(numero)):
            suma += int(digit) * multiplicador
            multiplicador = multiplicador + 1 if multiplicador < 7 else 2

        resto = suma % 11
        dv = str(11 - resto) if resto != 0 else '0'
        if dv == '10':
            dv = 'K'

        # Formatear: XXXXXXXX-X
        return f"{numero}-{dv}"

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        self.stdout.write(self.style.SUCCESS('=' * 70))
        if dry_run:
            self.stdout.write(self.style.WARNING('MODO DRY-RUN: No se realizarán cambios reales'))
        else:
            self.stdout.write(self.style.SUCCESS('Completando datos de contacto...'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        # Encontrar perfiles sin teléfono o RUT
        perfiles_sin_telefono = Perfil.objects.filter(telefono__in=['', None])
        perfiles_sin_rut = Perfil.objects.filter(rut__isnull=True)

        # Combinar ambos querysets (usar union o filter)
        perfiles_incompletos = Perfil.objects.filter(
            telefono__in=['', None]
        ) | Perfil.objects.filter(
            rut__isnull=True
        )

        perfiles_incompletos = perfiles_incompletos.distinct()

        total_perfiles = perfiles_incompletos.count()

        if total_perfiles == 0:
            self.stdout.write(self.style.SUCCESS('\n✓ Todos los perfiles tienen datos de contacto completos'))
            return

        self.stdout.write(f'\nEncontrados {total_perfiles} perfil(es) con datos incompletos\n')

        contador_actualizados = 0

        for perfil in perfiles_incompletos:
            username = perfil.user.username
            nombre = perfil.nombre_completo or username
            rol = perfil.get_rol_display()

            cambios = []

            # Generar teléfono si no tiene
            if not perfil.telefono or perfil.telefono == '':
                nuevo_telefono = self.generar_telefono_chileno()
                cambios.append(f"Tel: {nuevo_telefono}")
                if not dry_run:
                    perfil.telefono = nuevo_telefono

            # Generar RUT si no tiene
            if not perfil.rut:
                nuevo_rut = self.generar_rut_chileno()
                cambios.append(f"RUT: {nuevo_rut}")
                if not dry_run:
                    perfil.rut = nuevo_rut

            if cambios:
                cambios_str = " | ".join(cambios)
                if dry_run:
                    self.stdout.write(
                        f"  [{rol}] {nombre:30s} -> {self.style.SUCCESS(cambios_str)}"
                    )
                else:
                    perfil.save()
                    contador_actualizados += 1
                    self.stdout.write(
                        f"  ✓ [{rol}] {nombre:30s} -> {self.style.SUCCESS(cambios_str)}"
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
