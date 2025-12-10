from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from mainApp.models import Perfil, Mesa, Reserva
from menuApp.models import CategoriaMenu, Ingrediente, Plato, Receta
from cocinaApp.models import Pedido, DetallePedido, EstadoPedido
from datetime import date, time, timedelta
from decimal import Decimal
import random


class Command(BaseCommand):
    help = 'Pobla la base de datos con MUCHOS datos: 50+ platos y 60+ pedidos en cocina'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('\n' + '='*60))
        self.stdout.write(self.style.WARNING('POBLANDO BASE DE DATOS - VERSIÓN EXTENDIDA'))
        self.stdout.write(self.style.WARNING('='*60 + '\n'))

        with transaction.atomic():
            # 1. Limpiar datos existentes
            self.limpiar_datos()

            # 2. Crear usuarios
            usuarios = self.crear_usuarios()

            # 3. Crear mesas
            mesas = self.crear_mesas()

            # 4. Crear categorías del menú
            categorias = self.crear_categorias()

            # 5. Crear ingredientes
            ingredientes = self.crear_ingredientes()

            # 6. Crear MUCHOS platos (50+)
            platos = self.crear_platos_extendidos(categorias)

            # 7. Crear recetas
            self.crear_recetas_extendidas(platos, ingredientes)

            # 8. Crear reservas
            reservas = self.crear_reservas(usuarios, mesas)

            # 9. Crear MUCHOS pedidos en cocina (60+)
            self.crear_pedidos_cocina(mesas, platos, reservas)

        self.mostrar_resumen()

    def limpiar_datos(self):
        self.stdout.write(self.style.WARNING('Limpiando datos existentes...'))

        DetallePedido.objects.all().delete()
        self.stdout.write('  - DetallePedido eliminados')

        Pedido.objects.all().delete()
        self.stdout.write('  - Pedidos eliminados')

        Reserva.objects.all().delete()
        self.stdout.write('  - Reservas eliminadas')

        Receta.objects.all().delete()
        self.stdout.write('  - Recetas eliminadas')

        Plato.objects.all().delete()
        self.stdout.write('  - Platos eliminados')

        Ingrediente.objects.all().delete()
        self.stdout.write('  - Ingredientes eliminados')

        CategoriaMenu.objects.all().delete()
        self.stdout.write('  - Categorías eliminadas')

        Mesa.objects.all().delete()
        self.stdout.write('  - Mesas eliminadas')

        Perfil.objects.all().delete()
        self.stdout.write('  - Perfiles eliminados')

        User.objects.all().delete()
        self.stdout.write('  - Usuarios eliminados')

        self.stdout.write(self.style.SUCCESS('Datos limpiados correctamente\n'))

    def crear_usuarios(self):
        self.stdout.write(self.style.HTTP_INFO('Creando usuarios...'))

        users_data = [
            # Admin
            {'username': 'admin', 'password': 'admin123', 'email': 'admin@restaurant.com',
             'first_name': 'Administrador', 'last_name': 'Sistema', 'rol': 'admin',
             'nombre_completo': 'Administrador del Sistema', 'rut': '11111111-1', 'telefono': '+56912345678'},
            # Cajeros
            {'username': 'cajero1', 'password': 'test123', 'email': 'cajero1@restaurant.com',
             'first_name': 'María', 'last_name': 'González', 'rol': 'cajero',
             'nombre_completo': 'María González', 'rut': '12222222-2', 'telefono': '+56923456789'},
            {'username': 'cajero2', 'password': 'test123', 'email': 'cajero2@restaurant.com',
             'first_name': 'Pedro', 'last_name': 'Ramírez', 'rol': 'cajero',
             'nombre_completo': 'Pedro Ramírez', 'rut': '13333333-3', 'telefono': '+56934567890'},
            # Meseros
            {'username': 'mesero1', 'password': 'test123', 'email': 'mesero1@restaurant.com',
             'first_name': 'Juan', 'last_name': 'López', 'rol': 'mesero',
             'nombre_completo': 'Juan López', 'rut': '14444444-4', 'telefono': '+56945678901'},
            {'username': 'mesero2', 'password': 'test123', 'email': 'mesero2@restaurant.com',
             'first_name': 'Ana', 'last_name': 'Martínez', 'rol': 'mesero',
             'nombre_completo': 'Ana Martínez', 'rut': '15555555-5', 'telefono': '+56956789012'},
            {'username': 'mesero3', 'password': 'test123', 'email': 'mesero3@restaurant.com',
             'first_name': 'Carlos', 'last_name': 'Fernández', 'rol': 'mesero',
             'nombre_completo': 'Carlos Fernández', 'rut': '16666666-6', 'telefono': '+56967890123'},
            # Clientes
            {'username': 'cliente1', 'password': 'test123', 'email': 'cliente1@example.com',
             'first_name': 'Roberto', 'last_name': 'Silva', 'rol': 'cliente',
             'nombre_completo': 'Roberto Silva', 'rut': '17777777-7', 'telefono': '+56978901234'},
            {'username': 'cliente2', 'password': 'test123', 'email': 'cliente2@example.com',
             'first_name': 'Carmen', 'last_name': 'Morales', 'rol': 'cliente',
             'nombre_completo': 'Carmen Morales', 'rut': '18888888-8', 'telefono': '+56989012345'},
            {'username': 'cliente3', 'password': 'test123', 'email': 'cliente3@example.com',
             'first_name': 'Diego', 'last_name': 'Torres', 'rol': 'cliente',
             'nombre_completo': 'Diego Torres', 'rut': '19999999-9', 'telefono': '+56990123456'},
            {'username': 'cliente4', 'password': 'test123', 'email': 'cliente4@example.com',
             'first_name': 'Valentina', 'last_name': 'Rojas', 'rol': 'cliente',
             'nombre_completo': 'Valentina Rojas', 'rut': '20000000-0', 'telefono': '+56901234567'},
            {'username': 'cliente5', 'password': 'test123', 'email': 'cliente5@example.com',
             'first_name': 'Sebastián', 'last_name': 'Muñoz', 'rol': 'cliente',
             'nombre_completo': 'Sebastián Muñoz', 'rut': '20111111-1', 'telefono': '+56912345670'},
            {'username': 'cliente6', 'password': 'test123', 'email': 'cliente6@example.com',
             'first_name': 'Francisca', 'last_name': 'Vargas', 'rol': 'cliente',
             'nombre_completo': 'Francisca Vargas', 'rut': '20222222-2', 'telefono': '+56923456701'},
            {'username': 'cliente7', 'password': 'test123', 'email': 'cliente7@example.com',
             'first_name': 'Matías', 'last_name': 'Cortés', 'rol': 'cliente',
             'nombre_completo': 'Matías Cortés', 'rut': '20333333-3', 'telefono': '+56934567012'},
            {'username': 'cliente8', 'password': 'test123', 'email': 'cliente8@example.com',
             'first_name': 'Javiera', 'last_name': 'Soto', 'rol': 'cliente',
             'nombre_completo': 'Javiera Soto', 'rut': '20444444-4', 'telefono': '+56945670123'},
            {'username': 'cliente9', 'password': 'test123', 'email': 'cliente9@example.com',
             'first_name': 'Tomás', 'last_name': 'Pérez', 'rol': 'cliente',
             'nombre_completo': 'Tomás Pérez', 'rut': '20555555-5', 'telefono': '+56956701234'},
        ]

        usuarios = {}
        for data in users_data:
            user = User.objects.create_user(
                username=data['username'],
                email=data['email'],
                password=data['password'],
                first_name=data['first_name'],
                last_name=data['last_name']
            )

            # El signal ya creó el perfil, solo actualizamos los campos
            perfil = user.perfil
            perfil.nombre_completo = data['nombre_completo']
            perfil.rut = data['rut']
            perfil.telefono = data['telefono']
            perfil.rol = data['rol']
            perfil.save()

            usuarios[data['rol']] = usuarios.get(data['rol'], [])
            usuarios[data['rol']].append(user)
            self.stdout.write(f"  + {user.username} ({data['rol']})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {User.objects.count()} usuarios creados\n'))
        return usuarios

    def crear_mesas(self):
        self.stdout.write(self.style.HTTP_INFO('Creando mesas...'))

        mesas_data = [
            {'numero': 1, 'capacidad': 2},
            {'numero': 2, 'capacidad': 2},
            {'numero': 3, 'capacidad': 4},
            {'numero': 4, 'capacidad': 4},
            {'numero': 5, 'capacidad': 6},
            {'numero': 6, 'capacidad': 6},
            {'numero': 7, 'capacidad': 8},
            {'numero': 8, 'capacidad': 8},
        ]

        mesas = []
        for data in mesas_data:
            mesa = Mesa.objects.create(**data)
            mesas.append(mesa)
            self.stdout.write(f"  + Mesa {mesa.numero} (capacidad: {mesa.capacidad})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(mesas)} mesas creadas\n'))
        return mesas

    def crear_categorias(self):
        self.stdout.write(self.style.HTTP_INFO('Creando categorías del menú...'))

        categorias_data = [
            {'nombre': 'Entradas', 'descripcion': 'Entradas y aperitivos', 'orden': 1},
            {'nombre': 'Platos Principales', 'descripcion': 'Platos principales', 'orden': 2},
            {'nombre': 'Ensaladas', 'descripcion': 'Ensaladas y vegetales', 'orden': 3},
            {'nombre': 'Postres', 'descripcion': 'Dulces y postres', 'orden': 4},
            {'nombre': 'Bebidas', 'descripcion': 'Bebidas y refrescos', 'orden': 5},
            {'nombre': 'Especialidades', 'descripcion': 'Platos especiales de la casa', 'orden': 6},
        ]

        categorias = {}
        for data in categorias_data:
            cat = CategoriaMenu.objects.create(**data, activa=True)
            categorias[data['nombre']] = cat
            self.stdout.write(f"  + {cat.nombre}")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(categorias)} categorías creadas\n'))
        return categorias

    def crear_ingredientes(self):
        self.stdout.write(self.style.HTTP_INFO('Creando ingredientes...'))

        ingredientes_data = [
            # Carnes y Proteínas
            {'nombre': 'Pollo', 'unidad_medida': 'kg', 'cantidad_disponible': 25, 'stock_minimo': 5, 'precio_unitario': 4500},
            {'nombre': 'Carne de Res', 'unidad_medida': 'kg', 'cantidad_disponible': 20, 'stock_minimo': 4, 'precio_unitario': 8500},
            {'nombre': 'Cerdo', 'unidad_medida': 'kg', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 5500},
            {'nombre': 'Salmón', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 15000},
            {'nombre': 'Camarones', 'unidad_medida': 'kg', 'cantidad_disponible': 8, 'stock_minimo': 2, 'precio_unitario': 12000},
            {'nombre': 'Atún', 'unidad_medida': 'kg', 'cantidad_disponible': 6, 'stock_minimo': 1, 'precio_unitario': 14000},
            {'nombre': 'Cordero', 'unidad_medida': 'kg', 'cantidad_disponible': 5, 'stock_minimo': 1, 'precio_unitario': 9500},
            # Vegetales
            {'nombre': 'Tomate', 'unidad_medida': 'kg', 'cantidad_disponible': 30, 'stock_minimo': 5, 'precio_unitario': 1200},
            {'nombre': 'Lechuga', 'unidad_medida': 'un', 'cantidad_disponible': 40, 'stock_minimo': 10, 'precio_unitario': 800},
            {'nombre': 'Cebolla', 'unidad_medida': 'kg', 'cantidad_disponible': 25, 'stock_minimo': 5, 'precio_unitario': 900},
            {'nombre': 'Zanahoria', 'unidad_medida': 'kg', 'cantidad_disponible': 20, 'stock_minimo': 4, 'precio_unitario': 700},
            {'nombre': 'Papa', 'unidad_medida': 'kg', 'cantidad_disponible': 50, 'stock_minimo': 10, 'precio_unitario': 600},
            {'nombre': 'Pimentón', 'unidad_medida': 'kg', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 1500},
            {'nombre': 'Champiñones', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 3500},
            {'nombre': 'Espárragos', 'unidad_medida': 'kg', 'cantidad_disponible': 8, 'stock_minimo': 2, 'precio_unitario': 4000},
            {'nombre': 'Brócoli', 'unidad_medida': 'kg', 'cantidad_disponible': 12, 'stock_minimo': 3, 'precio_unitario': 1800},
            # Lácteos
            {'nombre': 'Queso', 'unidad_medida': 'kg', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 6000},
            {'nombre': 'Crema', 'unidad_medida': 'lt', 'cantidad_disponible': 20, 'stock_minimo': 5, 'precio_unitario': 2500},
            {'nombre': 'Leche', 'unidad_medida': 'lt', 'cantidad_disponible': 30, 'stock_minimo': 10, 'precio_unitario': 1200},
            {'nombre': 'Mantequilla', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 4000},
            # Condimentos y básicos
            {'nombre': 'Sal', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 500},
            {'nombre': 'Aceite de Oliva', 'unidad_medida': 'lt', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 5500},
            {'nombre': 'Vinagre', 'unidad_medida': 'lt', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 1500},
            {'nombre': 'Pimienta', 'unidad_medida': 'kg', 'cantidad_disponible': 5, 'stock_minimo': 1, 'precio_unitario': 8000},
            {'nombre': 'Arroz', 'unidad_medida': 'kg', 'cantidad_disponible': 40, 'stock_minimo': 10, 'precio_unitario': 1200},
            {'nombre': 'Pasta', 'unidad_medida': 'kg', 'cantidad_disponible': 30, 'stock_minimo': 8, 'precio_unitario': 1500},
            {'nombre': 'Pan', 'unidad_medida': 'un', 'cantidad_disponible': 50, 'stock_minimo': 15, 'precio_unitario': 300},
            {'nombre': 'Harina', 'unidad_medida': 'kg', 'cantidad_disponible': 25, 'stock_minimo': 5, 'precio_unitario': 800},
            {'nombre': 'Huevos', 'unidad_medida': 'un', 'cantidad_disponible': 100, 'stock_minimo': 30, 'precio_unitario': 150},
            {'nombre': 'Azúcar', 'unidad_medida': 'kg', 'cantidad_disponible': 20, 'stock_minimo': 5, 'precio_unitario': 900},
            {'nombre': 'Chocolate', 'unidad_medida': 'kg', 'cantidad_disponible': 8, 'stock_minimo': 2, 'precio_unitario': 7000},
            {'nombre': 'Café', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 3, 'precio_unitario': 12000},
        ]

        ingredientes = {}
        for data in ingredientes_data:
            ing = Ingrediente.objects.create(
                nombre=data['nombre'],
                unidad_medida=data['unidad_medida'],
                cantidad_disponible=Decimal(str(data['cantidad_disponible'])),
                stock_minimo=Decimal(str(data['stock_minimo'])),
                precio_unitario=Decimal(str(data['precio_unitario'])),
                activo=True
            )
            ingredientes[data['nombre']] = ing
            self.stdout.write(f"  + {ing.nombre} ({ing.cantidad_disponible} {ing.unidad_medida})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(ingredientes)} ingredientes creados\n'))
        return ingredientes

    def crear_platos_extendidos(self, categorias):
        self.stdout.write(self.style.HTTP_INFO('Creando MUCHOS platos (50+)...'))

        platos_data = [
            # ENTRADAS (12 platos)
            {'nombre': 'Empanadas de Pino', 'descripcion': 'Empanadas de carne tradicionales chilenas',
             'precio': 3500, 'categoria': 'Entradas', 'tiempo_preparacion': 15},
            {'nombre': 'Empanadas de Queso', 'descripcion': 'Empanadas de queso derretido',
             'precio': 3000, 'categoria': 'Entradas', 'tiempo_preparacion': 15},
            {'nombre': 'Ceviche de Salmón', 'descripcion': 'Salmón fresco marinado con limón y cilantro',
             'precio': 6500, 'categoria': 'Entradas', 'tiempo_preparacion': 10},
            {'nombre': 'Ceviche de Camarones', 'descripcion': 'Camarones frescos en salsa de limón',
             'precio': 7500, 'categoria': 'Entradas', 'tiempo_preparacion': 10},
            {'nombre': 'Bruschetta', 'descripcion': 'Pan tostado con tomate, albahaca y aceite de oliva',
             'precio': 4500, 'categoria': 'Entradas', 'tiempo_preparacion': 8},
            {'nombre': 'Tabla de Quesos', 'descripcion': 'Selección de quesos finos con crackers',
             'precio': 8900, 'categoria': 'Entradas', 'tiempo_preparacion': 5},
            {'nombre': 'Choritos a la Parmesana', 'descripcion': 'Choritos gratinados con queso',
             'precio': 5500, 'categoria': 'Entradas', 'tiempo_preparacion': 12},
            {'nombre': 'Carpaccio de Res', 'descripcion': 'Finas láminas de carne cruda con aceite de oliva',
             'precio': 7900, 'categoria': 'Entradas', 'tiempo_preparacion': 8},
            {'nombre': 'Tartare de Atún', 'descripcion': 'Atún fresco picado con aguacate y sésamo',
             'precio': 8500, 'categoria': 'Entradas', 'tiempo_preparacion': 10},
            {'nombre': 'Ostiones a la Mantequilla', 'descripcion': 'Ostiones gratinados con mantequilla y ajo',
             'precio': 9500, 'categoria': 'Entradas', 'tiempo_preparacion': 15},
            {'nombre': 'Sopaipillas Pasadas', 'descripcion': 'Sopaipillas con chancaca',
             'precio': 2800, 'categoria': 'Entradas', 'tiempo_preparacion': 10},
            {'nombre': 'Pebre con Pan Amasado', 'descripcion': 'Pebre chileno tradicional',
             'precio': 2500, 'categoria': 'Entradas', 'tiempo_preparacion': 5},

            # PLATOS PRINCIPALES (18 platos)
            {'nombre': 'Lomo a lo Pobre', 'descripcion': 'Lomo de res con papas fritas, huevo y cebolla',
             'precio': 12500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 25},
            {'nombre': 'Churrasco a lo Pobre', 'descripcion': 'Churrasco con papas fritas y huevo frito',
             'precio': 10500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 20},
            {'nombre': 'Pollo al Horno', 'descripcion': 'Pollo asado con hierbas y papas doradas',
             'precio': 8900, 'categoria': 'Platos Principales', 'tiempo_preparacion': 30},
            {'nombre': 'Pollo a la Parmesana', 'descripcion': 'Pechuga de pollo gratinada con salsa de tomate y queso',
             'precio': 9500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 25},
            {'nombre': 'Salmón a la Parrilla', 'descripcion': 'Filete de salmón grillado con vegetales',
             'precio': 14500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 20},
            {'nombre': 'Salmón Teriyaki', 'descripcion': 'Salmón con salsa teriyaki y arroz',
             'precio': 15500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 22},
            {'nombre': 'Atún Sellado', 'descripcion': 'Atún sellado con costra de sésamo',
             'precio': 16500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 18},
            {'nombre': 'Pasta Carbonara', 'descripcion': 'Pasta con salsa cremosa, tocino y queso',
             'precio': 9500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 18},
            {'nombre': 'Pasta Alfredo con Pollo', 'descripcion': 'Fetuccini con salsa alfredo y pollo grillado',
             'precio': 10500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 20},
            {'nombre': 'Lasagna Boloñesa', 'descripcion': 'Lasagna con carne molida y queso gratinado',
             'precio': 11500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 30},
            {'nombre': 'Costillar de Cerdo', 'descripcion': 'Costillas de cerdo glaseadas con BBQ',
             'precio': 13500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 35},
            {'nombre': 'Asado de Tira', 'descripcion': 'Corte argentino a la parrilla',
             'precio': 14900, 'categoria': 'Platos Principales', 'tiempo_preparacion': 30},
            {'nombre': 'Cazuela de Vacuno', 'descripcion': 'Cazuela tradicional chilena con carne',
             'precio': 8500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 35},
            {'nombre': 'Pastel de Choclo', 'descripcion': 'Pastel de choclo con pino de carne',
             'precio': 9500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 40},
            {'nombre': 'Charquicán', 'descripcion': 'Guiso de papas con carne molida y verduras',
             'precio': 7500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 25},
            {'nombre': 'Porotos con Riendas', 'descripcion': 'Porotos con tallarines y longaniza',
             'precio': 6500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 30},
            {'nombre': 'Cordero al Palo', 'descripcion': 'Cordero asado lentamente con especias',
             'precio': 18500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 45},
            {'nombre': 'Chuletas de Cordero', 'descripcion': 'Chuletas de cordero a la parrilla',
             'precio': 17500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 25},

            # ENSALADAS (8 platos)
            {'nombre': 'Ensalada César', 'descripcion': 'Lechuga romana, crutones, queso parmesano',
             'precio': 6500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 10},
            {'nombre': 'Ensalada César con Pollo', 'descripcion': 'César clásica con pollo grillado',
             'precio': 8500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 12},
            {'nombre': 'Ensalada Mediterránea', 'descripcion': 'Mix de lechugas, tomate, aceitunas y queso feta',
             'precio': 7500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 12},
            {'nombre': 'Ensalada de Pollo', 'descripcion': 'Pollo grillado sobre mix de verdes',
             'precio': 8500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 15},
            {'nombre': 'Ensalada Chilena', 'descripcion': 'Tomate y cebolla con cilantro',
             'precio': 4500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 8},
            {'nombre': 'Ensalada Caprese', 'descripcion': 'Tomate, mozzarella y albahaca fresca',
             'precio': 6900, 'categoria': 'Ensaladas', 'tiempo_preparacion': 10},
            {'nombre': 'Ensalada de Quinoa', 'descripcion': 'Quinoa con vegetales asados y vinagreta',
             'precio': 7900, 'categoria': 'Ensaladas', 'tiempo_preparacion': 12},
            {'nombre': 'Ensalada de Salmón', 'descripcion': 'Salmón ahumado con mix de lechugas',
             'precio': 9500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 12},

            # POSTRES (8 platos)
            {'nombre': 'Tiramisú', 'descripcion': 'Clásico postre italiano con café y mascarpone',
             'precio': 5500, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Brownie con Helado', 'descripcion': 'Brownie de chocolate con helado de vainilla',
             'precio': 4900, 'categoria': 'Postres', 'tiempo_preparacion': 8},
            {'nombre': 'Crème Brûlée', 'descripcion': 'Crema de vainilla con costra de caramelo',
             'precio': 5900, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Flan Casero', 'descripcion': 'Flan de huevo con caramelo',
             'precio': 3900, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Panqueque con Manjar', 'descripcion': 'Panqueques con manjar y helado',
             'precio': 4500, 'categoria': 'Postres', 'tiempo_preparacion': 10},
            {'nombre': 'Mousse de Chocolate', 'descripcion': 'Suave mousse de chocolate oscuro',
             'precio': 4800, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Cheesecake de Frutos Rojos', 'descripcion': 'Tarta de queso con coulis de frutos rojos',
             'precio': 5500, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Sopaipillas con Manjar', 'descripcion': 'Sopaipillas dulces rellenas de manjar',
             'precio': 3500, 'categoria': 'Postres', 'tiempo_preparacion': 10},

            # BEBIDAS (10 platos)
            {'nombre': 'Limonada Natural', 'descripcion': 'Limonada recién exprimida',
             'precio': 2500, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            {'nombre': 'Limonada de Frambuesa', 'descripcion': 'Limonada con frambuesas frescas',
             'precio': 3000, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            {'nombre': 'Café Espresso', 'descripcion': 'Café espresso italiano',
             'precio': 1800, 'categoria': 'Bebidas', 'tiempo_preparacion': 2},
            {'nombre': 'Café Americano', 'descripcion': 'Café espresso con agua caliente',
             'precio': 2000, 'categoria': 'Bebidas', 'tiempo_preparacion': 2},
            {'nombre': 'Cappuccino', 'descripcion': 'Espresso con leche espumada',
             'precio': 2500, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            {'nombre': 'Jugo de Naranja', 'descripcion': 'Jugo de naranja natural',
             'precio': 2800, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            {'nombre': 'Jugo de Frambuesa', 'descripcion': 'Jugo natural de frambuesas',
             'precio': 3200, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            {'nombre': 'Coca Cola', 'descripcion': 'Coca Cola 350ml',
             'precio': 1800, 'categoria': 'Bebidas', 'tiempo_preparacion': 1},
            {'nombre': 'Sprite', 'descripcion': 'Sprite 350ml',
             'precio': 1800, 'categoria': 'Bebidas', 'tiempo_preparacion': 1},
            {'nombre': 'Agua Mineral', 'descripcion': 'Agua mineral con/sin gas',
             'precio': 1500, 'categoria': 'Bebidas', 'tiempo_preparacion': 1},

            # ESPECIALIDADES (6 platos)
            {'nombre': 'Paella Marinera', 'descripcion': 'Arroz con mariscos al estilo español',
             'precio': 16500, 'categoria': 'Especialidades', 'tiempo_preparacion': 40},
            {'nombre': 'Paella Mixta', 'descripcion': 'Paella con mariscos y carnes',
             'precio': 17500, 'categoria': 'Especialidades', 'tiempo_preparacion': 40},
            {'nombre': 'Risotto de Champiñones', 'descripcion': 'Arroz cremoso con champiñones y parmesano',
             'precio': 11500, 'categoria': 'Especialidades', 'tiempo_preparacion': 25},
            {'nombre': 'Risotto de Mariscos', 'descripcion': 'Arroz cremoso con camarones y salmón',
             'precio': 14500, 'categoria': 'Especialidades', 'tiempo_preparacion': 25},
            {'nombre': 'Filete Wellington', 'descripcion': 'Filete de res envuelto en hojaldre',
             'precio': 18500, 'categoria': 'Especialidades', 'tiempo_preparacion': 45},
            {'nombre': 'Rack de Cordero', 'descripcion': 'Rack de cordero con hierbas y reducción de vino',
             'precio': 19500, 'categoria': 'Especialidades', 'tiempo_preparacion': 35},
        ]

        platos = {}
        for data in platos_data:
            plato = Plato.objects.create(
                nombre=data['nombre'],
                descripcion=data['descripcion'],
                precio=Decimal(str(data['precio'])),
                categoria=categorias[data['categoria']],
                tiempo_preparacion=data['tiempo_preparacion'],
                disponible=True,
                activo=True
            )
            platos[data['nombre']] = plato
            self.stdout.write(f"  + {plato.nombre} (${plato.precio:,})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(platos)} platos creados\n'))
        return platos

    def crear_recetas_extendidas(self, platos, ingredientes):
        self.stdout.write(self.style.HTTP_INFO('Creando recetas REALISTAS...'))

        # Diccionario de recetas realistas: 'nombre_plato': [('ingrediente', cantidad_kg), ...]
        recetas_realistas = {
            # ENTRADAS
            'Empanadas de Pino': [('Carne de Res', 0.3), ('Cebolla', 0.1), ('Huevos', 2), ('Aceite de Oliva', 0.05), ('Harina', 0.2)],
            'Empanadas de Queso': [('Queso', 0.25), ('Harina', 0.2), ('Mantequilla', 0.05), ('Huevos', 1)],
            'Ceviche de Salmón': [('Salmón', 0.2), ('Cebolla', 0.05), ('Tomate', 0.05), ('Aceite de Oliva', 0.02)],
            'Ceviche de Camarones': [('Camarones', 0.25), ('Cebolla', 0.05), ('Tomate', 0.05), ('Aceite de Oliva', 0.02)],
            'Bruschetta': [('Pan', 2), ('Tomate', 0.15), ('Aceite de Oliva', 0.03), ('Queso', 0.05)],
            'Tabla de Quesos': [('Queso', 0.3), ('Pan', 3)],
            'Choritos a la Parmesana': [('Camarones', 0.2), ('Queso', 0.1), ('Mantequilla', 0.05), ('Pan', 1)],
            'Carpaccio de Res': [('Carne de Res', 0.15), ('Aceite de Oliva', 0.03), ('Queso', 0.03), ('Pimienta', 0.01)],
            'Tartare de Atún': [('Atún', 0.2), ('Cebolla', 0.03), ('Aceite de Oliva', 0.02), ('Huevos', 1)],
            'Ostiones a la Mantequilla': [('Camarones', 0.15), ('Mantequilla', 0.08), ('Pan', 1), ('Queso', 0.05)],
            'Sopaipillas Pasadas': [('Harina', 0.2), ('Azúcar', 0.1), ('Aceite de Oliva', 0.1)],
            'Pebre con Pan Amasado': [('Tomate', 0.1), ('Cebolla', 0.05), ('Aceite de Oliva', 0.03), ('Pan', 2)],

            # PLATOS PRINCIPALES
            'Lomo a lo Pobre': [('Carne de Res', 0.3), ('Papa', 0.25), ('Huevos', 2), ('Cebolla', 0.1), ('Aceite de Oliva', 0.05)],
            'Churrasco a lo Pobre': [('Carne de Res', 0.25), ('Papa', 0.25), ('Huevos', 2), ('Cebolla', 0.08), ('Aceite de Oliva', 0.05)],
            'Pollo al Horno': [('Pollo', 0.4), ('Papa', 0.2), ('Zanahoria', 0.1), ('Aceite de Oliva', 0.03), ('Sal', 0.01)],
            'Pollo a la Parmesana': [('Pollo', 0.3), ('Tomate', 0.15), ('Queso', 0.1), ('Pan', 1), ('Aceite de Oliva', 0.03)],
            'Salmón a la Parrilla': [('Salmón', 0.3), ('Brócoli', 0.1), ('Zanahoria', 0.08), ('Aceite de Oliva', 0.03), ('Sal', 0.01)],
            'Salmón Teriyaki': [('Salmón', 0.3), ('Arroz', 0.15), ('Cebolla', 0.05), ('Aceite de Oliva', 0.03)],
            'Atún Sellado': [('Atún', 0.3), ('Aceite de Oliva', 0.03), ('Sal', 0.01), ('Pimienta', 0.01)],
            'Pasta Carbonara': [('Pasta', 0.2), ('Cerdo', 0.1), ('Huevos', 2), ('Queso', 0.08), ('Crema', 0.1)],
            'Pasta Alfredo con Pollo': [('Pasta', 0.2), ('Pollo', 0.2), ('Crema', 0.15), ('Queso', 0.08), ('Mantequilla', 0.05)],
            'Lasagna Boloñesa': [('Pasta', 0.25), ('Carne de Res', 0.25), ('Tomate', 0.2), ('Queso', 0.15), ('Cebolla', 0.08)],
            'Costillar de Cerdo': [('Cerdo', 0.5), ('Azúcar', 0.05), ('Aceite de Oliva', 0.03), ('Sal', 0.01)],
            'Asado de Tira': [('Carne de Res', 0.4), ('Sal', 0.01), ('Pimienta', 0.01), ('Aceite de Oliva', 0.02)],
            'Cazuela de Vacuno': [('Carne de Res', 0.25), ('Papa', 0.2), ('Zanahoria', 0.1), ('Cebolla', 0.08), ('Arroz', 0.05)],
            'Pastel de Choclo': [('Carne de Res', 0.3), ('Pollo', 0.15), ('Cebolla', 0.1), ('Huevos', 2), ('Aceite de Oliva', 0.05), ('Azúcar', 0.03)],
            'Charquicán': [('Carne de Res', 0.2), ('Papa', 0.3), ('Zanahoria', 0.1), ('Cebolla', 0.08), ('Aceite de Oliva', 0.03)],
            'Porotos con Riendas': [('Pasta', 0.15), ('Cerdo', 0.15), ('Cebolla', 0.08), ('Aceite de Oliva', 0.03)],
            'Cordero al Palo': [('Cordero', 0.5), ('Sal', 0.02), ('Pimienta', 0.01), ('Aceite de Oliva', 0.03)],
            'Chuletas de Cordero': [('Cordero', 0.4), ('Sal', 0.01), ('Pimienta', 0.01), ('Aceite de Oliva', 0.03)],

            # ENSALADAS
            'Ensalada César': [('Lechuga', 3), ('Queso', 0.05), ('Pan', 1), ('Aceite de Oliva', 0.03), ('Huevos', 1)],
            'Ensalada César con Pollo': [('Lechuga', 3), ('Pollo', 0.15), ('Queso', 0.05), ('Pan', 1), ('Aceite de Oliva', 0.03)],
            'Ensalada Mediterránea': [('Lechuga', 2), ('Tomate', 0.1), ('Cebolla', 0.05), ('Queso', 0.08), ('Aceite de Oliva', 0.03)],
            'Ensalada de Pollo': [('Lechuga', 2), ('Pollo', 0.2), ('Tomate', 0.08), ('Zanahoria', 0.05), ('Aceite de Oliva', 0.03)],
            'Ensalada Chilena': [('Tomate', 0.15), ('Cebolla', 0.1), ('Aceite de Oliva', 0.02), ('Sal', 0.01)],
            'Ensalada Caprese': [('Tomate', 0.15), ('Queso', 0.1), ('Aceite de Oliva', 0.03)],
            'Ensalada de Quinoa': [('Arroz', 0.1), ('Tomate', 0.08), ('Pimentón', 0.05), ('Cebolla', 0.05), ('Aceite de Oliva', 0.03)],
            'Ensalada de Salmón': [('Lechuga', 2), ('Salmón', 0.15), ('Tomate', 0.08), ('Cebolla', 0.04), ('Aceite de Oliva', 0.03)],

            # POSTRES
            'Tiramisú': [('Café', 0.05), ('Huevos', 2), ('Queso', 0.15), ('Azúcar', 0.08), ('Chocolate', 0.05)],
            'Brownie con Helado': [('Chocolate', 0.15), ('Harina', 0.1), ('Huevos', 2), ('Azúcar', 0.12), ('Mantequilla', 0.08)],
            'Crème Brûlée': [('Crema', 0.2), ('Huevos', 3), ('Azúcar', 0.1), ('Leche', 0.05)],
            'Flan Casero': [('Huevos', 3), ('Leche', 0.25), ('Azúcar', 0.12)],
            'Panqueque con Manjar': [('Harina', 0.12), ('Leche', 0.15), ('Huevos', 2), ('Azúcar', 0.08), ('Mantequilla', 0.05)],
            'Mousse de Chocolate': [('Chocolate', 0.12), ('Crema', 0.15), ('Huevos', 2), ('Azúcar', 0.08)],
            'Cheesecake de Frutos Rojos': [('Queso', 0.25), ('Huevos', 2), ('Azúcar', 0.15), ('Mantequilla', 0.08), ('Harina', 0.05)],
            'Sopaipillas con Manjar': [('Harina', 0.2), ('Azúcar', 0.1), ('Aceite de Oliva', 0.08), ('Mantequilla', 0.05)],

            # BEBIDAS (sin recetas complejas, ingredientes básicos)
            'Limonada Natural': [('Azúcar', 0.05)],
            'Limonada de Frambuesa': [('Azúcar', 0.06)],
            'Café Espresso': [('Café', 0.02)],
            'Café Americano': [('Café', 0.02)],
            'Cappuccino': [('Café', 0.02), ('Leche', 0.15)],
            'Jugo de Naranja': [('Azúcar', 0.02)],
            'Jugo de Frambuesa': [('Azúcar', 0.03)],
            'Coca Cola': [],  # Bebida embotellada, sin ingredientes
            'Sprite': [],  # Bebida embotellada, sin ingredientes
            'Agua Mineral': [],  # Bebida embotellada, sin ingredientes

            # ESPECIALIDADES
            'Paella Marinera': [('Arroz', 0.3), ('Camarones', 0.2), ('Salmón', 0.15), ('Pimentón', 0.1), ('Tomate', 0.1), ('Aceite de Oliva', 0.05)],
            'Paella Mixta': [('Arroz', 0.3), ('Camarones', 0.15), ('Pollo', 0.15), ('Cerdo', 0.1), ('Pimentón', 0.1), ('Tomate', 0.1)],
            'Risotto de Champiñones': [('Arroz', 0.25), ('Champiñones', 0.2), ('Queso', 0.1), ('Mantequilla', 0.05), ('Cebolla', 0.05)],
            'Risotto de Mariscos': [('Arroz', 0.25), ('Camarones', 0.15), ('Salmón', 0.1), ('Mantequilla', 0.05), ('Queso', 0.08)],
            'Filete Wellington': [('Carne de Res', 0.35), ('Champiñones', 0.15), ('Harina', 0.15), ('Huevos', 1), ('Mantequilla', 0.08)],
            'Rack de Cordero': [('Cordero', 0.5), ('Aceite de Oliva', 0.04), ('Sal', 0.02), ('Pimienta', 0.01)],
        }

        recetas_creadas = 0
        platos_sin_receta = []

        for nombre_plato, plato_obj in platos.items():
            if nombre_plato in recetas_realistas:
                receta_ingredientes = recetas_realistas[nombre_plato]

                for nombre_ing, cantidad in receta_ingredientes:
                    if nombre_ing in ingredientes:
                        Receta.objects.create(
                            plato=plato_obj,
                            ingrediente=ingredientes[nombre_ing],
                            cantidad_requerida=Decimal(str(cantidad))
                        )
                        recetas_creadas += 1
                    else:
                        self.stdout.write(self.style.WARNING(f'  ⚠ Ingrediente "{nombre_ing}" no encontrado para {nombre_plato}'))
            else:
                platos_sin_receta.append(nombre_plato)

        if platos_sin_receta:
            self.stdout.write(self.style.WARNING(f'  ⚠ {len(platos_sin_receta)} platos sin receta definida'))

        self.stdout.write(self.style.SUCCESS(f'  Total: {recetas_creadas} relaciones REALISTAS plato-ingrediente creadas\n'))

    def crear_reservas(self, usuarios, mesas):
        self.stdout.write(self.style.HTTP_INFO('Creando reservas...'))

        clientes = usuarios.get('cliente', [])
        if not clientes:
            self.stdout.write(self.style.WARNING('  No hay clientes, saltando reservas\n'))
            return []

        reservas = []
        hoy = date.today()

        # Estados de reserva
        estados = ['pendiente', 'confirmada', 'activa', 'completada']

        # Crear reservas para los próximos 7 días
        for dia in range(7):
            fecha_reserva = hoy + timedelta(days=dia)

            # 3-6 reservas por día
            num_reservas = random.randint(3, 6)

            for _ in range(num_reservas):
                mesa = random.choice(mesas)
                cliente = random.choice(clientes)

                # Horarios realistas (12:00-21:00)
                hora = random.choice([12, 13, 14, 19, 20, 21])
                hora_reserva = time(hour=hora, minute=0)

                # Estado según el día
                if dia == 0:
                    estado = random.choice(['activa', 'confirmada', 'completada'])
                elif dia == 1:
                    estado = random.choice(['pendiente', 'confirmada'])
                else:
                    estado = 'pendiente'

                try:
                    reserva = Reserva.objects.create(
                        mesa=mesa,
                        cliente=cliente,
                        fecha_reserva=fecha_reserva,
                        hora_reserva=hora_reserva,
                        cantidad_personas=random.randint(2, mesa.capacidad),
                        estado=estado,
                        notas=random.choice(['', 'Cumpleaños', 'Aniversario', 'Cena de negocios', ''])
                    )
                    reservas.append(reserva)
                    self.stdout.write(f"  + Reserva {reserva.id}: Mesa {reserva.mesa.numero}, {fecha_reserva} {hora_reserva} ({estado})")
                except Exception as e:
                    pass

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(reservas)} reservas creadas\n'))
        return reservas

    def crear_pedidos_cocina(self, mesas, platos, reservas):
        """Crear MUCHOS pedidos con énfasis en estados de cocina"""
        self.stdout.write(self.style.HTTP_INFO('Creando MUCHOS pedidos para cocina...'))

        lista_platos = list(platos.values())

        # Estados con peso hacia cocina
        estados_cocina = [
            EstadoPedido.CREADO,      # 30%
            EstadoPedido.CREADO,
            EstadoPedido.CREADO,
            EstadoPedido.URGENTE,     # 10%
            EstadoPedido.EN_PREPARACION,  # 30%
            EstadoPedido.EN_PREPARACION,
            EstadoPedido.EN_PREPARACION,
            EstadoPedido.LISTO,       # 20%
            EstadoPedido.LISTO,
            EstadoPedido.ENTREGADO,   # 10%
        ]

        pedidos_creados = 0

        # Crear 40 pedidos de reservas (la mayoría en cocina)
        for i in range(min(40, len(reservas))):
            reserva = reservas[i % len(reservas)]
            mesa = reserva.mesa
            estado = random.choice(estados_cocina)

            pedido = Pedido.objects.create(
                mesa=mesa,
                reserva=reserva,
                cliente=reserva.cliente,
                estado=estado,
                notas=random.choice(['', 'Sin sal', 'Extra salsa', 'Bien cocido', 'Al punto', 'Sin cebolla', 'Urgente!'])
            )

            # 2-5 platos por pedido
            num_platos = random.randint(2, 5)
            platos_pedido = random.sample(lista_platos, num_platos)

            for plato in platos_pedido:
                DetallePedido.objects.create(
                    pedido=pedido,
                    plato=plato,
                    cantidad=random.randint(1, 3),
                    precio_unitario=plato.precio,
                    notas_especiales=random.choice(['', 'Sin cebolla', 'Bien cocido', 'Extra queso', ''])
                )

            pedidos_creados += 1
            self.stdout.write(f"  + Pedido {pedido.id}: Mesa {pedido.mesa.numero}, {num_platos} platos ({estado})")

        # Crear 60 pedidos sin reserva (walk-ins, mayoría en cocina)
        for _ in range(60):
            mesa = random.choice(mesas)
            estado = random.choice(estados_cocina)

            pedido = Pedido.objects.create(
                mesa=mesa,
                estado=estado,
                notas=random.choice(['', 'Para llevar', 'Sin gluten', 'Vegano', ''])
            )

            num_platos = random.randint(2, 4)
            platos_pedido = random.sample(lista_platos, num_platos)

            for plato in platos_pedido:
                DetallePedido.objects.create(
                    pedido=pedido,
                    plato=plato,
                    cantidad=random.randint(1, 2),
                    precio_unitario=plato.precio
                )

            pedidos_creados += 1
            self.stdout.write(f"  + Pedido {pedido.id}: Mesa {pedido.mesa.numero}, {num_platos} platos ({estado})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {pedidos_creados} pedidos creados\n'))

    def mostrar_resumen(self):
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('DATOS EXTENDIDOS CREADOS EXITOSAMENTE'))
        self.stdout.write('='*60)

        # Contar pedidos por estado
        pedidos_cocina = Pedido.objects.filter(
            estado__in=[EstadoPedido.CREADO, EstadoPedido.URGENTE, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO]
        ).count()

        self.stdout.write(self.style.SUCCESS(f'''
RESUMEN:
  - Usuarios: {User.objects.count()}
  - Mesas: {Mesa.objects.count()}
  - Categorías: {CategoriaMenu.objects.count()}
  - Ingredientes: {Ingrediente.objects.count()}
  - Platos: {Plato.objects.count()} ✨ (muchos más!)
  - Recetas: {Receta.objects.count()}
  - Reservas: {Reserva.objects.count()}
  - Pedidos TOTALES: {Pedido.objects.count()}
  - Pedidos EN COCINA: {pedidos_cocina} ✨ (CREADO, URGENTE, EN_PREPARACION, LISTO)
  - Detalles de Pedidos: {DetallePedido.objects.count()}

PEDIDOS POR ESTADO:
  - CREADO: {Pedido.objects.filter(estado=EstadoPedido.CREADO).count()}
  - URGENTE: {Pedido.objects.filter(estado=EstadoPedido.URGENTE).count()}
  - EN_PREPARACION: {Pedido.objects.filter(estado=EstadoPedido.EN_PREPARACION).count()}
  - LISTO: {Pedido.objects.filter(estado=EstadoPedido.LISTO).count()}
  - ENTREGADO: {Pedido.objects.filter(estado=EstadoPedido.ENTREGADO).count()}

CREDENCIALES DE ACCESO:
  Admin:    admin / admin123
  Cajero:   cajero1 / test123, cajero2 / test123
  Mesero:   mesero1-3 / test123
  Cliente:  cliente1-9 / test123
'''))
        self.stdout.write('='*60 + '\n')
