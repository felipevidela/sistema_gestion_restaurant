"""
Management command para poblar Railway con datos de prueba realistas.
Agrega datos SIN borrar ni modificar los existentes.

Uso:
    python manage.py poblar_railway_seguro
    python manage.py poblar_railway_seguro --dry-run --verbose
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction
from django.db import models
from datetime import timedelta, time, datetime
from decimal import Decimal
import random

from mainApp.models import Mesa, Perfil, Reserva
from menuApp.models import CategoriaMenu, Ingrediente, Plato, Receta
from cocinaApp.models import Pedido, DetallePedido, PedidoCancelacion, EstadoPedido


class DryRunException(Exception):
    """Excepción para rollback en modo dry-run"""
    pass


class Command(BaseCommand):
    help = 'Poblar Railway con datos de prueba SIN borrar datos existentes'

    # Motivos de cancelación realistas
    MOTIVOS_CANCELACION = [
        "Cliente solicitó cancelación por tiempo de espera excesivo en cocina",
        "Error en el pedido - platos equivocados fueron registrados en el sistema",
        "Cliente cambió de opinión después de realizar el pedido original",
        "Ingredientes no disponibles para completar todos los platos solicitados",
        "Cliente tuvo que retirarse urgentemente del restaurante por emergencia",
        "Pedido duplicado creado por error en el sistema de gestión",
        "Cliente no satisfecho con tiempo estimado de preparación informado",
        "Mesa se marchó sin esperar el pedido que había solicitado",
        "Restricciones dietéticas del cliente no pueden ser cumplidas correctamente",
        "Problema con sistema de pago - cliente no pudo completar la transacción",
        "Reserva cancelada por el cliente después de haber ordenado platos",
        "Platos ya no están disponibles en el menú según actualización reciente",
        "Cliente prefirió ordenar desde el menú de delivery en lugar de comer aquí",
        "Errores de comunicación entre mesero y cliente sobre el contenido del pedido",
        "Tiempo de espera superó las expectativas razonables del cliente insatisfecho",
        "Mesa asignada incorrectamente - grupo se trasladó a otra ubicación del local",
        "Cliente alérgico a ingredientes que no pueden ser removidos del plato",
        "Cierre anticipado de cocina por problemas técnicos en equipamiento crítico",
        "Cliente canceló después de verificar precios y considerar su presupuesto",
        "Pedido realizado en mesa equivocada por confusión del personal",
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simular sin guardar cambios (rollback automático)'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Mostrar información detallada'
        )

    def handle(self, *args, **options):
        self.verbose = options.get('verbose', False)
        self.dry_run = options.get('dry_run', False)

        if self.dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  MODO DRY-RUN ACTIVADO - Los cambios NO se guardarán\n'))

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('POBLAR RAILWAY CON DATOS DE PRUEBA REALISTAS'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        # Validación inicial
        self.mostrar_estado_actual()

        # Confirmación
        if not self.dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  Esta operación agregará datos a la base de datos.'))
            self.stdout.write(self.style.WARNING('⚠️  NO se borrarán datos existentes.\n'))

        # Ejecución con transaction.atomic()
        try:
            with transaction.atomic():
                # Crear datos en orden correcto (respetando dependencias)
                self.stdout.write(self.style.SUCCESS('\n🚀 Iniciando creación de datos...\n'))

                usuarios = self.crear_usuarios_demo()
                mesas = self.verificar_o_crear_mesas()
                categorias = self.crear_categorias_menu()
                ingredientes = self.crear_ingredientes_con_stock()
                platos = self.crear_platos_variados(categorias)
                self.crear_recetas_platos(platos, ingredientes)
                reservas = self.crear_reservas_semana(usuarios, mesas)
                self.actualizar_estados_mesas(mesas, reservas)
                self.crear_pedidos_activos(mesas, platos, usuarios)
                self.crear_pedidos_entregados(mesas, platos, usuarios)
                self.crear_pedidos_cancelados(mesas, platos, usuarios)

                # Rollback en dry-run
                if self.dry_run:
                    raise DryRunException()

        except DryRunException:
            self.stdout.write(self.style.WARNING('\n✅ DRY RUN COMPLETADO - Todos los cambios fueron revertidos'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ ERROR CRÍTICO: {str(e)}'))
            raise

        # Resumen final
        if not self.dry_run:
            self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
            self.stdout.write(self.style.SUCCESS('✅ PROCESO COMPLETADO EXITOSAMENTE'))
            self.stdout.write(self.style.SUCCESS('=' * 70))
            self.mostrar_resumen_final()

    def mostrar_estado_actual(self):
        """Mostrar el estado actual de la base de datos"""
        self.stdout.write(self.style.SUCCESS('\n📊 Estado actual de la base de datos:\n'))
        self.stdout.write(f'  • Usuarios: {User.objects.count()}')
        self.stdout.write(f'  • Mesas: {Mesa.objects.count()}')
        self.stdout.write(f'  • Categorías: {CategoriaMenu.objects.count()}')
        self.stdout.write(f'  • Ingredientes: {Ingrediente.objects.count()}')
        self.stdout.write(f'  • Platos: {Plato.objects.count()}')
        self.stdout.write(f'  • Recetas: {Receta.objects.count()}')
        self.stdout.write(f'  • Reservas: {Reserva.objects.count()}')
        self.stdout.write(f'  • Pedidos: {Pedido.objects.count()}')
        self.stdout.write(f'  • Cancelaciones: {PedidoCancelacion.objects.count()}\n')

    def crear_usuarios_demo(self):
        """Crear usuarios de demostración (get_or_create para no duplicar)"""
        self.stdout.write(self.style.HTTP_INFO('📝 Creando usuarios de demostración...'))

        usuarios_creados = []
        usuarios_data = [
            {'username': 'demo_cliente_1', 'password': 'demo123', 'rol': 'cliente', 'nombre': 'Cliente Demo 1', 'email': 'cliente1@demo.com'},
            {'username': 'demo_cliente_2', 'password': 'demo123', 'rol': 'cliente', 'nombre': 'Cliente Demo 2', 'email': 'cliente2@demo.com'},
            {'username': 'demo_cliente_3', 'password': 'demo123', 'rol': 'cliente', 'nombre': 'Cliente Demo 3', 'email': 'cliente3@demo.com'},
            {'username': 'demo_cliente_4', 'password': 'demo123', 'rol': 'cliente', 'nombre': 'Cliente Demo 4', 'email': 'cliente4@demo.com'},
            {'username': 'demo_cliente_5', 'password': 'demo123', 'rol': 'cliente', 'nombre': 'Cliente Demo 5', 'email': 'cliente5@demo.com'},
            {'username': 'demo_mesero_1', 'password': 'demo123', 'rol': 'mesero', 'nombre': 'Mesero Demo 1', 'email': 'mesero1@demo.com'},
        ]

        for data in usuarios_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'email': data['email'],
                    'is_active': True
                }
            )
            if created:
                user.set_password(data['password'])
                user.save()

                # Crear perfil
                Perfil.objects.get_or_create(
                    user=user,
                    defaults={
                        'rol': data['rol'],
                        'nombre_completo': data['nombre'],
                        'email': data['email']
                    }
                )

                usuarios_creados.append(user)
                if self.verbose:
                    self.stdout.write(f'  ✓ Usuario creado: {user.username} ({data["rol"]})')

        # Obtener todos los usuarios activos para usar en otros métodos
        todos_usuarios = list(User.objects.filter(is_active=True).exclude(username='AnonymousUser'))

        self.stdout.write(self.style.SUCCESS(f'  ✅ {len(usuarios_creados)} usuarios nuevos creados'))
        self.stdout.write(f'  📊 Total usuarios disponibles: {len(todos_usuarios)}\n')

        return todos_usuarios

    def verificar_o_crear_mesas(self):
        """Verificar que existan mesas, crear si faltan"""
        self.stdout.write(self.style.HTTP_INFO('🪑 Verificando mesas...'))

        mesas_esperadas = [
            {'numero': 1, 'capacidad': 2},
            {'numero': 2, 'capacidad': 4},
            {'numero': 3, 'capacidad': 4},
            {'numero': 4, 'capacidad': 6},
            {'numero': 5, 'capacidad': 6},
            {'numero': 6, 'capacidad': 8},
        ]

        mesas_creadas = 0
        for data in mesas_esperadas:
            mesa, created = Mesa.objects.get_or_create(
                numero=data['numero'],
                defaults={'capacidad': data['capacidad'], 'estado': 'disponible'}
            )
            if created:
                mesas_creadas += 1
                if self.verbose:
                    self.stdout.write(f'  ✓ Mesa {mesa.numero} creada (capacidad: {mesa.capacidad})')

        mesas = list(Mesa.objects.all())
        self.stdout.write(self.style.SUCCESS(f'  ✅ {mesas_creadas} mesas nuevas creadas'))
        self.stdout.write(f'  📊 Total mesas disponibles: {len(mesas)}\n')

        return mesas

    def crear_categorias_menu(self):
        """Crear categorías del menú"""
        self.stdout.write(self.style.HTTP_INFO('📋 Creando categorías del menú...'))

        categorias_data = [
            {'nombre': 'Entradas', 'descripcion': 'Platos de entrada y aperitivos', 'orden': 1},
            {'nombre': 'Principales', 'descripcion': 'Platos principales del menú', 'orden': 2},
            {'nombre': 'Postres', 'descripcion': 'Postres y dulces', 'orden': 3},
            {'nombre': 'Bebidas', 'descripcion': 'Bebidas y refrescos', 'orden': 4},
        ]

        categorias_creadas = []
        for data in categorias_data:
            categoria, created = CategoriaMenu.objects.get_or_create(
                nombre=data['nombre'],
                defaults={
                    'descripcion': data['descripcion'],
                    'orden': data['orden'],
                    'activa': True
                }
            )
            categorias_creadas.append(categoria)
            if created and self.verbose:
                self.stdout.write(f'  ✓ Categoría creada: {categoria.nombre}')

        self.stdout.write(self.style.SUCCESS(f'  ✅ {len(categorias_creadas)} categorías verificadas\n'))

        return categorias_creadas

    def crear_ingredientes_con_stock(self):
        """Crear ingredientes con stock variado (normal, bajo, agotado)"""
        self.stdout.write(self.style.HTTP_INFO('🥘 Creando ingredientes con stock variado...'))

        ingredientes_data = [
            # Stock normal (60%)
            {'nombre': 'Salmón fresco', 'cantidad': 15.5, 'stock_min': 3.0, 'unidad': 'kg', 'precio': 12000},
            {'nombre': 'Arroz arborio', 'cantidad': 25.0, 'stock_min': 5.0, 'unidad': 'kg', 'precio': 3500},
            {'nombre': 'Queso parmesano', 'cantidad': 8.0, 'stock_min': 2.0, 'unidad': 'kg', 'precio': 15000},
            {'nombre': 'Carne de res premium', 'cantidad': 12.0, 'stock_min': 3.0, 'unidad': 'kg', 'precio': 18000},
            {'nombre': 'Pollo orgánico', 'cantidad': 20.0, 'stock_min': 5.0, 'unidad': 'kg', 'precio': 8500},
            {'nombre': 'Pasta fresca', 'cantidad': 15.0, 'stock_min': 3.0, 'unidad': 'kg', 'precio': 5000},
            {'nombre': 'Tomate cherry', 'cantidad': 8.0, 'stock_min': 2.0, 'unidad': 'kg', 'precio': 3000},
            {'nombre': 'Lechuga hidropónica', 'cantidad': 10.0, 'stock_min': 2.0, 'unidad': 'kg', 'precio': 2500},
            {'nombre': 'Papas frescas', 'cantidad': 30.0, 'stock_min': 8.0, 'unidad': 'kg', 'precio': 1500},
            {'nombre': 'Mantequilla', 'cantidad': 6.0, 'stock_min': 1.5, 'unidad': 'kg', 'precio': 7000},
            {'nombre': 'Crema de leche', 'cantidad': 8.0, 'stock_min': 2.0, 'unidad': 'lt', 'precio': 4500},
            {'nombre': 'Vino blanco para cocinar', 'cantidad': 5.0, 'stock_min': 1.0, 'unidad': 'lt', 'precio': 8000},
            {'nombre': 'Aceite de oliva extra virgen', 'cantidad': 4.0, 'stock_min': 1.0, 'unidad': 'lt', 'precio': 12000},
            {'nombre': 'Sal de mar', 'cantidad': 5.0, 'stock_min': 1.0, 'unidad': 'kg', 'precio': 2000},
            {'nombre': 'Pimienta negra', 'cantidad': 2.0, 'stock_min': 0.5, 'unidad': 'kg', 'precio': 8000},
            {'nombre': 'Ajo fresco', 'cantidad': 3.0, 'stock_min': 0.8, 'unidad': 'kg', 'precio': 4000},
            {'nombre': 'Cebolla', 'cantidad': 12.0, 'stock_min': 3.0, 'unidad': 'kg', 'precio': 1200},
            {'nombre': 'Limones', 'cantidad': 5.0, 'stock_min': 1.0, 'unidad': 'kg', 'precio': 2000},
            {'nombre': 'Chocolate oscuro 70%', 'cantidad': 4.0, 'stock_min': 1.0, 'unidad': 'kg', 'precio': 15000},
            {'nombre': 'Azúcar refinada', 'cantidad': 10.0, 'stock_min': 2.0, 'unidad': 'kg', 'precio': 1500},
            {'nombre': 'Harina integral', 'cantidad': 15.0, 'stock_min': 4.0, 'unidad': 'kg', 'precio': 2000},
            {'nombre': 'Huevos orgánicos', 'cantidad': 120.0, 'stock_min': 30.0, 'unidad': 'un', 'precio': 250},

            # Bajo stock (30%)
            {'nombre': 'Hongos portobello', 'cantidad': 1.2, 'stock_min': 2.0, 'unidad': 'kg', 'precio': 8500},
            {'nombre': 'Aceite de trufa', 'cantidad': 0.08, 'stock_min': 0.15, 'unidad': 'lt', 'precio': 45000},
            {'nombre': 'Alcaparras', 'cantidad': 0.3, 'stock_min': 0.5, 'unidad': 'kg', 'precio': 12000},
            {'nombre': 'Azafrán español', 'cantidad': 0.02, 'stock_min': 0.05, 'unidad': 'kg', 'precio': 180000},
            {'nombre': 'Langostinos', 'cantidad': 1.5, 'stock_min': 2.5, 'unidad': 'kg', 'precio': 22000},
            {'nombre': 'Queso roquefort', 'cantidad': 0.8, 'stock_min': 1.2, 'unidad': 'kg', 'precio': 18000},
            {'nombre': 'Espárragos verdes', 'cantidad': 1.0, 'stock_min': 1.5, 'unidad': 'kg', 'precio': 9000},
            {'nombre': 'Vainilla natural', 'cantidad': 0.05, 'stock_min': 0.1, 'unidad': 'kg', 'precio': 95000},
            {'nombre': 'Almendras laminadas', 'cantidad': 0.6, 'stock_min': 1.0, 'unidad': 'kg', 'precio': 12000},

            # Stock agotado (10%)
            {'nombre': 'Caviar', 'cantidad': 0.0, 'stock_min': 0.1, 'unidad': 'kg', 'precio': 180000},
            {'nombre': 'Foie gras', 'cantidad': 0.0, 'stock_min': 0.5, 'unidad': 'kg', 'precio': 95000},
            {'nombre': 'Trufa negra', 'cantidad': 0.0, 'stock_min': 0.05, 'unidad': 'kg', 'precio': 250000},
            {'nombre': 'Cordero lechal', 'cantidad': 0.0, 'stock_min': 2.0, 'unidad': 'kg', 'precio': 28000},
        ]

        ingredientes_creados = []
        bajo_stock_count = 0
        agotados_count = 0

        for data in ingredientes_data:
            ingrediente = Ingrediente.objects.create(
                nombre=data['nombre'],
                cantidad_disponible=Decimal(str(data['cantidad'])),
                stock_minimo=Decimal(str(data['stock_min'])),
                unidad_medida=data['unidad'],
                precio_unitario=Decimal(str(data['precio'])),
                activo=True
            )
            ingredientes_creados.append(ingrediente)

            # Contabilizar estados
            if ingrediente.cantidad_disponible == 0:
                agotados_count += 1
                if self.verbose:
                    self.stdout.write(f'  ⚠️  AGOTADO: {ingrediente.nombre}')
            elif ingrediente.bajo_stock:
                bajo_stock_count += 1
                if self.verbose:
                    self.stdout.write(f'  ⚠️  BAJO STOCK: {ingrediente.nombre}')

        self.stdout.write(self.style.SUCCESS(f'  ✅ {len(ingredientes_creados)} ingredientes creados'))
        self.stdout.write(f'  📊 Stock normal: {len(ingredientes_creados) - bajo_stock_count - agotados_count}')
        self.stdout.write(f'  ⚠️  Bajo stock: {bajo_stock_count}')
        self.stdout.write(f'  ❌ Agotados: {agotados_count}\n')

        return ingredientes_creados

    def crear_platos_variados(self, categorias):
        """Crear platos del menú (70% disponibles, 30% no disponibles)"""
        self.stdout.write(self.style.HTTP_INFO('🍽️  Creando platos del menú...'))

        # Organizar categorías por nombre para fácil acceso
        cats = {cat.nombre: cat for cat in categorias}

        platos_data = [
            # Entradas
            {'nombre': 'Carpaccio de Res con Rúcula', 'precio': 12500, 'categoria': 'Entradas', 'tiempo': 10, 'disponible': True},
            {'nombre': 'Ceviche Mixto de Pescado', 'precio': 11000, 'categoria': 'Entradas', 'tiempo': 15, 'disponible': True},
            {'nombre': 'Tabla de Quesos Premium', 'precio': 14500, 'categoria': 'Entradas', 'tiempo': 5, 'disponible': True},
            {'nombre': 'Ensalada César con Pollo', 'precio': 9500, 'categoria': 'Entradas', 'tiempo': 12, 'disponible': True},
            {'nombre': 'Sopa de Langostinos', 'precio': 13000, 'categoria': 'Entradas', 'tiempo': 20, 'disponible': False},

            # Principales
            {'nombre': 'Salmón Grillado con Espárragos', 'precio': 18500, 'categoria': 'Principales', 'tiempo': 25, 'disponible': True},
            {'nombre': 'Filete Wellington con Salsa Oporto', 'precio': 24500, 'categoria': 'Principales', 'tiempo': 35, 'disponible': True},
            {'nombre': 'Risotto de Hongos Portobello', 'precio': 14500, 'categoria': 'Principales', 'tiempo': 30, 'disponible': False},
            {'nombre': 'Paella Valenciana Tradicional', 'precio': 16500, 'categoria': 'Principales', 'tiempo': 40, 'disponible': True},
            {'nombre': 'Cordero al Romero con Papas', 'precio': 22000, 'categoria': 'Principales', 'tiempo': 35, 'disponible': False},
            {'nombre': 'Pasta Carbonara Clásica', 'precio': 12000, 'categoria': 'Principales', 'tiempo': 20, 'disponible': True},
            {'nombre': 'Pollo al Curry con Arroz Basmati', 'precio': 13500, 'categoria': 'Principales', 'tiempo': 25, 'disponible': True},
            {'nombre': 'Lasagna Bolognesa Casera', 'precio': 14000, 'categoria': 'Principales', 'tiempo': 30, 'disponible': True},
            {'nombre': 'Filete de Res a la Pimienta', 'precio': 21000, 'categoria': 'Principales', 'tiempo': 30, 'disponible': True},
            {'nombre': 'Cazuela de Mariscos', 'precio': 19500, 'categoria': 'Principales', 'tiempo': 35, 'disponible': True},
            {'nombre': 'Tagliatelle con Trufa Negra', 'precio': 26000, 'categoria': 'Principales', 'tiempo': 25, 'disponible': False},

            # Postres
            {'nombre': 'Tiramisú Italiano Clásico', 'precio': 6500, 'categoria': 'Postres', 'tiempo': 8, 'disponible': True},
            {'nombre': 'Crème Brûlée de Vainilla', 'precio': 7000, 'categoria': 'Postres', 'tiempo': 10, 'disponible': True},
            {'nombre': 'Cheesecake de Frutos Rojos', 'precio': 6800, 'categoria': 'Postres', 'tiempo': 8, 'disponible': True},
            {'nombre': 'Volován de Chocolate Belga', 'precio': 7500, 'categoria': 'Postres', 'tiempo': 12, 'disponible': True},
            {'nombre': 'Tarta de Limón Merengada', 'precio': 6200, 'categoria': 'Postres', 'tiempo': 10, 'disponible': True},
            {'nombre': 'Profiteroles con Helado', 'precio': 6900, 'categoria': 'Postres', 'tiempo': 12, 'disponible': True},
            {'nombre': 'Panna Cotta con Frutos del Bosque', 'precio': 6500, 'categoria': 'Postres', 'tiempo': 8, 'disponible': False},

            # Bebidas
            {'nombre': 'Limonada Natural de Menta', 'precio': 3500, 'categoria': 'Bebidas', 'tiempo': 5, 'disponible': True},
            {'nombre': 'Jugo Tropical Mixto', 'precio': 4000, 'categoria': 'Bebidas', 'tiempo': 5, 'disponible': True},
            {'nombre': 'Té Helado de Durazno', 'precio': 3200, 'categoria': 'Bebidas', 'tiempo': 3, 'disponible': True},
            {'nombre': 'Smoothie de Frutos Rojos', 'precio': 4500, 'categoria': 'Bebidas', 'tiempo': 5, 'disponible': True},
            {'nombre': 'Agua Mineral con Gas', 'precio': 2500, 'categoria': 'Bebidas', 'tiempo': 2, 'disponible': True},
        ]

        platos_creados = []
        disponibles = 0
        no_disponibles = 0

        for data in platos_data:
            plato = Plato.objects.create(
                nombre=data['nombre'],
                precio=Decimal(str(data['precio'])),
                categoria=cats[data['categoria']],
                tiempo_preparacion=data['tiempo'],
                disponible=data['disponible'],
                activo=True
            )
            platos_creados.append(plato)

            if plato.disponible:
                disponibles += 1
            else:
                no_disponibles += 1
                if self.verbose:
                    self.stdout.write(f'  ⚠️  NO DISPONIBLE: {plato.nombre}')

        self.stdout.write(self.style.SUCCESS(f'  ✅ {len(platos_creados)} platos creados'))
        self.stdout.write(f'  📊 Disponibles: {disponibles}')
        self.stdout.write(f'  ⚠️  No disponibles: {no_disponibles}\n')

        return platos_creados

    def crear_recetas_platos(self, platos, ingredientes):
        """Crear recetas (relaciones plato-ingrediente)"""
        self.stdout.write(self.style.HTTP_INFO('📖 Creando recetas (plato-ingrediente)...'))

        # Organizar ingredientes por nombre para fácil acceso
        ings = {ing.nombre: ing for ing in ingredientes}

        # Recetas realistas (simplificadas para demo)
        recetas_data = [
            # Carpaccio de Res
            ('Carpaccio de Res con Rúcula', [
                ('Carne de res premium', 0.15),
                ('Aceite de oliva extra virgen', 0.02),
                ('Queso parmesano', 0.03),
                ('Lechuga hidropónica', 0.05),
            ]),
            # Salmón Grillado
            ('Salmón Grillado con Espárragos', [
                ('Salmón fresco', 0.25),
                ('Espárragos verdes', 0.15),
                ('Mantequilla', 0.02),
                ('Limones', 0.05),
            ]),
            # Risotto de Hongos
            ('Risotto de Hongos Portobello', [
                ('Arroz arborio', 0.15),
                ('Hongos portobello', 0.12),
                ('Queso parmesano', 0.05),
                ('Mantequilla', 0.03),
                ('Vino blanco para cocinar', 0.1),
            ]),
            # Pasta Carbonara
            ('Pasta Carbonara Clásica', [
                ('Pasta fresca', 0.2),
                ('Huevos orgánicos', 2.0),
                ('Queso parmesano', 0.05),
                ('Pimienta negra', 0.005),
            ]),
            # Tiramisú
            ('Tiramisú Italiano Clásico', [
                ('Queso parmesano', 0.15),  # Mascarpone (usamos parmesano como placeholder)
                ('Huevos orgánicos', 3.0),
                ('Azúcar refinada', 0.08),
                ('Chocolate oscuro 70%', 0.02),
            ]),
            # Filete Wellington
            ('Filete Wellington con Salsa Oporto', [
                ('Carne de res premium', 0.3),
                ('Hongos portobello', 0.1),
                ('Harina integral', 0.15),
                ('Huevos orgánicos', 1.0),
                ('Mantequilla', 0.05),
            ]),
        ]

        recetas_creadas = 0
        for plato_nombre, ingredientes_lista in recetas_data:
            # Buscar el plato
            plato = next((p for p in platos if p.nombre == plato_nombre), None)
            if not plato:
                continue

            for ing_nombre, cantidad in ingredientes_lista:
                if ing_nombre in ings:
                    Receta.objects.create(
                        plato=plato,
                        ingrediente=ings[ing_nombre],
                        cantidad_requerida=Decimal(str(cantidad))
                    )
                    recetas_creadas += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ {recetas_creadas} recetas creadas\n'))

    def crear_reservas_semana(self, usuarios, mesas):
        """Crear reservas distribuidas en 7 días"""
        self.stdout.write(self.style.HTTP_INFO('📅 Creando reservas de la semana...'))

        hoy = timezone.now().date()
        reservas_creadas = []

        # Horarios disponibles (cada 30 min de 12:00 a 21:00)
        horarios = [
            time(12, 0), time(12, 30), time(13, 0), time(13, 30),
            time(14, 0), time(14, 30), time(15, 0), time(15, 30),
            time(16, 0), time(16, 30), time(17, 0), time(17, 30),
            time(18, 0), time(18, 30), time(19, 0), time(19, 30),
            time(20, 0), time(20, 30), time(21, 0)
        ]

        # Distribución por día según el plan
        distribucion = [
            # HOY (día 0)
            {'pendiente': 2, 'confirmada': 3, 'activa': 2, 'completada': 5, 'cancelada': 1},
            # MAÑANA (día 1)
            {'pendiente': 4, 'confirmada': 3, 'cancelada': 1},
            # Días +2 a +6
            {'pendiente': 4, 'confirmada': 1, 'cancelada': 0},
            {'pendiente': 4, 'confirmada': 1, 'cancelada': 0},
            {'pendiente': 4, 'confirmada': 1, 'cancelada': 1},
            {'pendiente': 4, 'confirmada': 1, 'cancelada': 0},
            {'pendiente': 4, 'confirmada': 1, 'cancelada': 1},
        ]

        for dia_offset in range(7):
            fecha = hoy + timedelta(days=dia_offset)
            estados_dia = distribucion[dia_offset]

            for estado, cantidad in estados_dia.items():
                for _ in range(cantidad):
                    # Intentar crear reserva
                    intentos = 0
                    max_intentos = 20

                    while intentos < max_intentos:
                        try:
                            mesa = random.choice(mesas)
                            cliente = random.choice(usuarios)
                            hora_inicio = random.choice(horarios)
                            num_personas = random.randint(1, mesa.capacidad)

                            # Validar disponibilidad básica
                            if self.mesa_disponible(mesa, fecha, hora_inicio):
                                reserva = Reserva.objects.create(
                                    cliente=cliente,
                                    mesa=mesa,
                                    fecha_reserva=fecha,
                                    hora_inicio=hora_inicio,
                                    num_personas=num_personas,
                                    estado=estado,
                                    notas=f"Reserva de prueba - {estado}"
                                )
                                reservas_creadas.append(reserva)
                                break
                        except Exception:
                            pass

                        intentos += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ {len(reservas_creadas)} reservas creadas'))

        # Mostrar distribución por estado
        from django.db.models import Count
        estados = Reserva.objects.values('estado').annotate(count=Count('id'))
        for item in estados:
            self.stdout.write(f'    • {item["estado"]}: {item["count"]}')
        self.stdout.write('')

        return reservas_creadas

    def mesa_disponible(self, mesa, fecha, hora_inicio):
        """Verificar si una mesa está disponible en una fecha y hora"""
        from datetime import datetime

        # Calcular hora_fin (2 horas después)
        dt_inicio = datetime.combine(datetime.today(), hora_inicio)
        dt_fin = dt_inicio + timedelta(hours=2)
        hora_fin = dt_fin.time()

        # Verificar solapamiento con otras reservas
        reservas_conflicto = Reserva.objects.filter(
            mesa=mesa,
            fecha_reserva=fecha,
            estado__in=['pendiente', 'confirmada', 'activa']
        )

        for reserva in reservas_conflicto:
            if hora_inicio < reserva.hora_fin and hora_fin > reserva.hora_inicio:
                return False

        return True

    def actualizar_estados_mesas(self, mesas, reservas):
        """Actualizar estados de mesas según reservas activas"""
        self.stdout.write(self.style.HTTP_INFO('🔄 Actualizando estados de mesas...'))

        hoy = timezone.now().date()

        # Resetear todas a disponible
        for mesa in mesas:
            mesa.estado = 'disponible'

        # Actualizar según reservas activas de hoy
        reservas_hoy = [r for r in reservas if r.fecha_reserva == hoy]

        for reserva in reservas_hoy:
            if reserva.estado == 'activa':
                reserva.mesa.estado = 'ocupada'
            elif reserva.estado == 'confirmada':
                reserva.mesa.estado = 'reservada'
            elif reserva.estado == 'completada':
                # Algunas en limpieza
                if random.random() > 0.7:
                    reserva.mesa.estado = 'limpieza'

        # Guardar cambios
        for mesa in mesas:
            mesa.save()

        # Mostrar distribución
        estados = {}
        for mesa in mesas:
            estados[mesa.estado] = estados.get(mesa.estado, 0) + 1

        for estado, count in estados.items():
            self.stdout.write(f'  • {estado}: {count}')
        self.stdout.write('')

    def crear_pedidos_activos(self, mesas, platos, usuarios):
        """Crear pedidos en estados activos (CREADO, URGENTE, EN_PREPARACION, LISTO)"""
        self.stdout.write(self.style.HTTP_INFO('🍳 Creando pedidos activos...'))

        platos_disponibles = [p for p in platos if p.disponible]

        estados_cantidad = {
            EstadoPedido.CREADO: 8,
            EstadoPedido.URGENTE: 5,
            EstadoPedido.EN_PREPARACION: 10,
            EstadoPedido.LISTO: 7,
        }

        pedidos_creados = 0
        for estado, cantidad in estados_cantidad.items():
            for _ in range(cantidad):
                # Crear pedido de hoy
                horas_atras = random.randint(0, 6)
                fecha_creacion = timezone.now() - timedelta(hours=horas_atras)

                mesa = random.choice(mesas)
                cliente = random.choice(usuarios) if random.random() > 0.3 else None

                pedido = Pedido.objects.create(
                    mesa=mesa,
                    cliente=cliente,
                    estado=estado,
                    fecha_creacion=fecha_creacion
                )

                # Agregar platos (1-3 por pedido)
                num_platos = random.randint(1, 3)
                for _ in range(num_platos):
                    plato = random.choice(platos_disponibles)
                    cantidad = random.randint(1, 2)

                    DetallePedido.objects.create(
                        pedido=pedido,
                        plato=plato,
                        cantidad=cantidad,
                        precio_unitario=plato.precio
                    )

                # Actualizar timestamp si está LISTO
                if estado == EstadoPedido.LISTO:
                    pedido.fecha_listo = timezone.now() - timedelta(minutes=random.randint(5, 30))
                    pedido.save()

                pedidos_creados += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ {pedidos_creados} pedidos activos creados\n'))

    def crear_pedidos_entregados(self, mesas, platos, usuarios):
        """Crear pedidos entregados (15 HOY + 5 días anteriores)"""
        self.stdout.write(self.style.HTTP_INFO('✅ Creando pedidos entregados...'))

        platos_disponibles = [p for p in platos if p.disponible]
        pedidos_creados = 0

        # 15 pedidos entregados HOY
        for _ in range(15):
            horas_atras = random.randint(1, 8)
            fecha_creacion = timezone.now() - timedelta(hours=horas_atras)
            fecha_listo = fecha_creacion + timedelta(minutes=random.randint(15, 45))
            fecha_entregado = fecha_listo + timedelta(minutes=random.randint(2, 10))

            mesa = random.choice(mesas)
            cliente = random.choice(usuarios) if random.random() > 0.2 else None

            pedido = Pedido.objects.create(
                mesa=mesa,
                cliente=cliente,
                estado=EstadoPedido.ENTREGADO,
                fecha_creacion=fecha_creacion,
                fecha_listo=fecha_listo,
                fecha_entregado=fecha_entregado
            )

            # Agregar platos
            num_platos = random.randint(1, 4)
            for _ in range(num_platos):
                plato = random.choice(platos_disponibles)
                cantidad = random.randint(1, 3)

                DetallePedido.objects.create(
                    pedido=pedido,
                    plato=plato,
                    cantidad=cantidad,
                    precio_unitario=plato.precio
                )

            pedidos_creados += 1

        # 5 pedidos entregados en días anteriores
        for _ in range(5):
            dias_atras = random.randint(1, 6)
            horas_atras = random.randint(0, 12)
            fecha_creacion = timezone.now() - timedelta(days=dias_atras, hours=horas_atras)
            fecha_listo = fecha_creacion + timedelta(minutes=random.randint(20, 50))
            fecha_entregado = fecha_listo + timedelta(minutes=random.randint(3, 15))

            mesa = random.choice(mesas)
            cliente = random.choice(usuarios) if random.random() > 0.2 else None

            pedido = Pedido.objects.create(
                mesa=mesa,
                cliente=cliente,
                estado=EstadoPedido.ENTREGADO,
                fecha_creacion=fecha_creacion,
                fecha_listo=fecha_listo,
                fecha_entregado=fecha_entregado
            )

            # Agregar platos
            num_platos = random.randint(1, 4)
            for _ in range(num_platos):
                plato = random.choice(platos_disponibles)
                cantidad = random.randint(1, 3)

                DetallePedido.objects.create(
                    pedido=pedido,
                    plato=plato,
                    cantidad=cantidad,
                    precio_unitario=plato.precio
                )

            pedidos_creados += 1

        hoy = timezone.now().date()
        entregados_hoy = Pedido.objects.filter(
            estado=EstadoPedido.ENTREGADO,
            fecha_entregado__date=hoy
        ).count()

        self.stdout.write(self.style.SUCCESS(f'  ✅ {pedidos_creados} pedidos entregados creados'))
        self.stdout.write(f'  📊 Entregados HOY: {entregados_hoy}\n')

    def crear_pedidos_cancelados(self, mesas, platos, usuarios):
        """Crear pedidos cancelados con auditoría completa (12+)"""
        self.stdout.write(self.style.HTTP_INFO('❌ Creando pedidos cancelados con auditoría...'))

        platos_disponibles = [p for p in platos if p.disponible]

        # Usuarios staff para cancelar
        usuarios_staff = [u for u in usuarios if hasattr(u, 'perfil') and u.perfil.rol in ['admin', 'cajero', 'mesero']]
        if not usuarios_staff:
            usuarios_staff = usuarios  # Fallback

        pedidos_cancelados = 0

        for i in range(12):
            # Fecha en últimos 7 días
            dias_atras = random.randint(0, 7)
            horas_atras = random.randint(0, 12)
            fecha_creacion = timezone.now() - timedelta(days=dias_atras, hours=horas_atras)
            fecha_cancelacion = fecha_creacion + timedelta(minutes=random.randint(5, 30))

            mesa = random.choice(mesas)
            cliente = random.choice(usuarios) if random.random() > 0.2 else None

            # Crear pedido
            pedido = Pedido.objects.create(
                mesa=mesa,
                cliente=cliente,
                estado=EstadoPedido.CANCELADO,
                fecha_creacion=fecha_creacion
            )

            # Agregar platos (1-4)
            num_platos = random.randint(1, 4)
            productos_detalle = []
            productos_resumen_parts = []
            total = Decimal('0.00')

            for _ in range(num_platos):
                plato = random.choice(platos_disponibles)
                cantidad = random.randint(1, 3)

                detalle = DetallePedido.objects.create(
                    pedido=pedido,
                    plato=plato,
                    cantidad=cantidad,
                    precio_unitario=plato.precio
                )

                total += detalle.subtotal
                productos_detalle.append({
                    'plato_id': plato.id,
                    'plato_nombre': plato.nombre,
                    'cantidad': cantidad,
                    'precio_unitario': float(plato.precio),
                    'subtotal': float(detalle.subtotal)
                })
                productos_resumen_parts.append(f"{cantidad}x {plato.nombre}")

            productos_resumen = ', '.join(productos_resumen_parts)[:500]

            # Cliente nombre
            cliente_nombre = ''
            if cliente and hasattr(cliente, 'perfil'):
                cliente_nombre = cliente.perfil.nombre_completo

            # Crear auditoría
            PedidoCancelacion.objects.create(
                pedido=pedido,
                cancelado_por=random.choice(usuarios_staff),
                motivo=random.choice(self.MOTIVOS_CANCELACION),
                mesa_numero=mesa.numero,
                cliente_nombre=cliente_nombre,
                total_pedido=total,
                productos_resumen=productos_resumen,
                productos_detalle=productos_detalle,
                fecha_cancelacion=fecha_cancelacion
            )

            pedidos_cancelados += 1

        self.stdout.write(self.style.SUCCESS(f'  ✅ {pedidos_cancelados} pedidos cancelados creados'))
        self.stdout.write(f'  📊 Auditorías: {PedidoCancelacion.objects.count()}\n')

    def mostrar_resumen_final(self):
        """Mostrar resumen final de datos creados"""
        self.stdout.write('\n📊 Resumen final de la base de datos:\n')

        # Usuarios
        self.stdout.write(f'  • Total usuarios: {User.objects.count()}')

        # Mesas
        self.stdout.write(f'  • Total mesas: {Mesa.objects.count()}')
        for estado, _ in Mesa.ESTADO_CHOICES:
            count = Mesa.objects.filter(estado=estado).count()
            self.stdout.write(f'    - {estado}: {count}')

        # Menú
        self.stdout.write(f'\n  • Categorías: {CategoriaMenu.objects.count()}')
        self.stdout.write(f'  • Ingredientes: {Ingrediente.objects.count()}')
        bajo_stock = Ingrediente.objects.filter(cantidad_disponible__lt=models.F('stock_minimo')).count()
        agotados = Ingrediente.objects.filter(cantidad_disponible=0).count()
        self.stdout.write(f'    - Bajo stock: {bajo_stock}')
        self.stdout.write(f'    - Agotados: {agotados}')
        self.stdout.write(f'  • Platos: {Plato.objects.count()}')
        self.stdout.write(f'    - Disponibles: {Plato.objects.filter(disponible=True).count()}')
        self.stdout.write(f'    - No disponibles: {Plato.objects.filter(disponible=False).count()}')
        self.stdout.write(f'  • Recetas: {Receta.objects.count()}')

        # Reservas
        self.stdout.write(f'\n  • Total reservas: {Reserva.objects.count()}')
        for estado, _ in Reserva.ESTADO_CHOICES:
            count = Reserva.objects.filter(estado=estado).count()
            self.stdout.write(f'    - {estado}: {count}')

        # Pedidos
        self.stdout.write(f'\n  • Total pedidos: {Pedido.objects.count()}')
        for estado in [EstadoPedido.CREADO, EstadoPedido.URGENTE, EstadoPedido.EN_PREPARACION,
                       EstadoPedido.LISTO, EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO]:
            count = Pedido.objects.filter(estado=estado).count()
            self.stdout.write(f'    - {estado}: {count}')

        # Pedidos entregados HOY
        hoy = timezone.now().date()
        entregados_hoy = Pedido.objects.filter(
            estado=EstadoPedido.ENTREGADO,
            fecha_entregado__date=hoy
        ).count()
        self.stdout.write(f'\n  • Pedidos entregados HOY: {entregados_hoy}')

        # Cancelaciones
        self.stdout.write(f'  • Total cancelaciones auditadas: {PedidoCancelacion.objects.count()}')

        self.stdout.write('')
