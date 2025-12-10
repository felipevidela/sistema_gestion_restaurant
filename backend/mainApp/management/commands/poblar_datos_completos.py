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
    help = 'Pobla la base de datos con datos completos de prueba para todas las funcionalidades'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('\n' + '='*60))
        self.stdout.write(self.style.WARNING('POBLANDO BASE DE DATOS CON DATOS COMPLETOS'))
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

            # 6. Crear platos
            platos = self.crear_platos(categorias)

            # 7. Crear recetas (todos los platos con ingredientes)
            self.crear_recetas(platos, ingredientes)

            # 8. Crear reservas
            reservas = self.crear_reservas(usuarios, mesas)

            # 9. Crear pedidos
            self.crear_pedidos(mesas, platos, reservas)

        self.mostrar_resumen()

    def limpiar_datos(self):
        self.stdout.write(self.style.WARNING('Limpiando datos existentes...'))

        # Orden de eliminación respetando dependencias
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

        # Eliminar todos los usuarios excepto el superusuario actual
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
             'first_name': 'Carlos', 'last_name': 'Soto', 'rol': 'mesero',
             'nombre_completo': 'Carlos Soto', 'rut': '14444444-4', 'telefono': '+56945678901'},
            {'username': 'mesero2', 'password': 'test123', 'email': 'mesero2@restaurant.com',
             'first_name': 'Andrea', 'last_name': 'López', 'rol': 'mesero',
             'nombre_completo': 'Andrea López', 'rut': '15555555-5', 'telefono': '+56956789012'},
            {'username': 'mesero3', 'password': 'test123', 'email': 'mesero3@restaurant.com',
             'first_name': 'Diego', 'last_name': 'Muñoz', 'rol': 'mesero',
             'nombre_completo': 'Diego Muñoz', 'rut': '16666666-6', 'telefono': '+56967890123'},
            # Clientes
            {'username': 'cliente1', 'password': 'test123', 'email': 'cliente1@example.com',
             'first_name': 'Juan', 'last_name': 'Pérez', 'rol': 'cliente',
             'nombre_completo': 'Juan Pérez López', 'rut': '17777777-7', 'telefono': '+56978901234'},
            {'username': 'cliente2', 'password': 'test123', 'email': 'cliente2@example.com',
             'first_name': 'Ana', 'last_name': 'Torres', 'rol': 'cliente',
             'nombre_completo': 'Ana Torres Martínez', 'rut': '18888888-8', 'telefono': '+56989012345'},
            {'username': 'cliente3', 'password': 'test123', 'email': 'cliente3@example.com',
             'first_name': 'Luis', 'last_name': 'Morales', 'rol': 'cliente',
             'nombre_completo': 'Luis Morales Fernández', 'rut': '19999999-9', 'telefono': '+56990123456'},
            {'username': 'cliente4', 'password': 'test123', 'email': 'cliente4@example.com',
             'first_name': 'Carmen', 'last_name': 'Silva', 'rol': 'cliente',
             'nombre_completo': 'Carmen Silva Rojas', 'rut': '10000000-0', 'telefono': '+56901234567'},
            {'username': 'cliente5', 'password': 'test123', 'email': 'cliente5@example.com',
             'first_name': 'Roberto', 'last_name': 'Díaz', 'rol': 'cliente',
             'nombre_completo': 'Roberto Díaz Vargas', 'rut': '20111111-1', 'telefono': '+56912345670'},
            {'username': 'cliente6', 'password': 'test123', 'email': 'cliente6@example.com',
             'first_name': 'Patricia', 'last_name': 'Vega', 'rol': 'cliente',
             'nombre_completo': 'Patricia Vega Soto', 'rut': '20222222-2', 'telefono': '+56923456780'},
            {'username': 'cliente7', 'password': 'test123', 'email': 'cliente7@example.com',
             'first_name': 'Andrés', 'last_name': 'Castillo', 'rol': 'cliente',
             'nombre_completo': 'Andrés Castillo Ruiz', 'rut': '20333333-3', 'telefono': '+56934567891'},
            {'username': 'cliente8', 'password': 'test123', 'email': 'cliente8@example.com',
             'first_name': 'Valentina', 'last_name': 'Herrera', 'rol': 'cliente',
             'nombre_completo': 'Valentina Herrera Paz', 'rut': '20444444-4', 'telefono': '+56945678902'},
            {'username': 'cliente9', 'password': 'test123', 'email': 'cliente9@example.com',
             'first_name': 'Sebastián', 'last_name': 'Núñez', 'rol': 'cliente',
             'nombre_completo': 'Sebastián Núñez Pinto', 'rut': '20555555-5', 'telefono': '+56956789013'},
        ]

        usuarios = {}
        for data in users_data:
            user = User.objects.create_user(
                username=data['username'],
                password=data['password'],
                email=data['email'],
                first_name=data['first_name'],
                last_name=data['last_name']
            )
            # El signal post_save ya crea el Perfil, solo lo actualizamos
            perfil = Perfil.objects.get(user=user)
            perfil.rol = data['rol']
            perfil.nombre_completo = data['nombre_completo']
            perfil.rut = data['rut']
            perfil.telefono = data['telefono']
            perfil.email = data['email']
            perfil.save()

            usuarios[data['username']] = user
            self.stdout.write(f"  + {data['username']} ({data['rol']})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(usuarios)} usuarios creados\n'))
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
            mesa = Mesa.objects.create(
                numero=data['numero'],
                capacidad=data['capacidad'],
                estado='disponible'
            )
            mesas.append(mesa)
            self.stdout.write(f"  + Mesa {mesa.numero} (capacidad: {mesa.capacidad})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(mesas)} mesas creadas\n'))
        return mesas

    def crear_categorias(self):
        self.stdout.write(self.style.HTTP_INFO('Creando categorías del menú...'))

        categorias_data = [
            {'nombre': 'Entradas', 'descripcion': 'Platos para comenzar', 'orden': 1},
            {'nombre': 'Platos Principales', 'descripcion': 'Platos fuertes del menú', 'orden': 2},
            {'nombre': 'Ensaladas', 'descripcion': 'Ensaladas frescas', 'orden': 3},
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
            # Carnes
            {'nombre': 'Pollo', 'unidad_medida': 'kg', 'cantidad_disponible': 25, 'stock_minimo': 5, 'precio_unitario': 4500},
            {'nombre': 'Carne de Res', 'unidad_medida': 'kg', 'cantidad_disponible': 20, 'stock_minimo': 4, 'precio_unitario': 8500},
            {'nombre': 'Cerdo', 'unidad_medida': 'kg', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 5500},
            {'nombre': 'Salmón', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 15000},
            {'nombre': 'Camarones', 'unidad_medida': 'kg', 'cantidad_disponible': 8, 'stock_minimo': 2, 'precio_unitario': 12000},
            # Vegetales
            {'nombre': 'Tomate', 'unidad_medida': 'kg', 'cantidad_disponible': 30, 'stock_minimo': 5, 'precio_unitario': 1200},
            {'nombre': 'Lechuga', 'unidad_medida': 'un', 'cantidad_disponible': 40, 'stock_minimo': 10, 'precio_unitario': 800},
            {'nombre': 'Cebolla', 'unidad_medida': 'kg', 'cantidad_disponible': 25, 'stock_minimo': 5, 'precio_unitario': 900},
            {'nombre': 'Zanahoria', 'unidad_medida': 'kg', 'cantidad_disponible': 20, 'stock_minimo': 4, 'precio_unitario': 700},
            {'nombre': 'Papa', 'unidad_medida': 'kg', 'cantidad_disponible': 50, 'stock_minimo': 10, 'precio_unitario': 600},
            {'nombre': 'Pimentón', 'unidad_medida': 'kg', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 1500},
            {'nombre': 'Champiñones', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 3500},
            # Lácteos
            {'nombre': 'Queso', 'unidad_medida': 'kg', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 6000},
            {'nombre': 'Crema', 'unidad_medida': 'lt', 'cantidad_disponible': 20, 'stock_minimo': 5, 'precio_unitario': 2500},
            {'nombre': 'Leche', 'unidad_medida': 'lt', 'cantidad_disponible': 30, 'stock_minimo': 10, 'precio_unitario': 1200},
            {'nombre': 'Mantequilla', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 4000},
            # Condimentos
            {'nombre': 'Sal', 'unidad_medida': 'kg', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 500},
            {'nombre': 'Aceite de Oliva', 'unidad_medida': 'lt', 'cantidad_disponible': 15, 'stock_minimo': 3, 'precio_unitario': 5500},
            {'nombre': 'Vinagre', 'unidad_medida': 'lt', 'cantidad_disponible': 10, 'stock_minimo': 2, 'precio_unitario': 1500},
            {'nombre': 'Pimienta', 'unidad_medida': 'kg', 'cantidad_disponible': 5, 'stock_minimo': 1, 'precio_unitario': 8000},
            # Otros
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

    def crear_platos(self, categorias):
        self.stdout.write(self.style.HTTP_INFO('Creando platos...'))

        platos_data = [
            # Entradas
            {'nombre': 'Empanadas de Pino', 'descripcion': 'Empanadas de carne tradicionales chilenas',
             'precio': 3500, 'categoria': 'Entradas', 'tiempo_preparacion': 15},
            {'nombre': 'Ceviche de Salmón', 'descripcion': 'Salmón fresco marinado con limón y cilantro',
             'precio': 6500, 'categoria': 'Entradas', 'tiempo_preparacion': 10},
            {'nombre': 'Bruschetta', 'descripcion': 'Pan tostado con tomate, albahaca y aceite de oliva',
             'precio': 4500, 'categoria': 'Entradas', 'tiempo_preparacion': 8},
            # Platos Principales
            {'nombre': 'Lomo a lo Pobre', 'descripcion': 'Lomo de res con papas fritas, huevo y cebolla',
             'precio': 12500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 25},
            {'nombre': 'Pollo al Horno', 'descripcion': 'Pollo asado con hierbas y papas doradas',
             'precio': 8900, 'categoria': 'Platos Principales', 'tiempo_preparacion': 30},
            {'nombre': 'Salmón a la Parrilla', 'descripcion': 'Filete de salmón grillado con vegetales',
             'precio': 14500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 20},
            {'nombre': 'Pasta Carbonara', 'descripcion': 'Pasta con salsa cremosa, tocino y queso',
             'precio': 9500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 18},
            {'nombre': 'Costillar de Cerdo', 'descripcion': 'Costillas de cerdo glaseadas con BBQ',
             'precio': 13500, 'categoria': 'Platos Principales', 'tiempo_preparacion': 35},
            # Ensaladas
            {'nombre': 'Ensalada César', 'descripcion': 'Lechuga romana, crutones, queso parmesano',
             'precio': 6500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 10},
            {'nombre': 'Ensalada Mediterránea', 'descripcion': 'Mix de lechugas, tomate, aceitunas y queso feta',
             'precio': 7500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 12},
            {'nombre': 'Ensalada de Pollo', 'descripcion': 'Pollo grillado sobre mix de verdes',
             'precio': 8500, 'categoria': 'Ensaladas', 'tiempo_preparacion': 15},
            # Postres
            {'nombre': 'Tiramisú', 'descripcion': 'Clásico postre italiano con café y mascarpone',
             'precio': 5500, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Brownie con Helado', 'descripcion': 'Brownie de chocolate con helado de vainilla',
             'precio': 4900, 'categoria': 'Postres', 'tiempo_preparacion': 8},
            {'nombre': 'Crème Brûlée', 'descripcion': 'Crema de vainilla con costra de caramelo',
             'precio': 5900, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            {'nombre': 'Flan Casero', 'descripcion': 'Flan de huevo con caramelo',
             'precio': 3900, 'categoria': 'Postres', 'tiempo_preparacion': 5},
            # Bebidas
            {'nombre': 'Limonada Natural', 'descripcion': 'Limonada recién exprimida',
             'precio': 2500, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            {'nombre': 'Café Espresso', 'descripcion': 'Café espresso italiano',
             'precio': 1800, 'categoria': 'Bebidas', 'tiempo_preparacion': 2},
            {'nombre': 'Jugo de Naranja', 'descripcion': 'Jugo de naranja natural',
             'precio': 2800, 'categoria': 'Bebidas', 'tiempo_preparacion': 3},
            # Especialidades
            {'nombre': 'Paella Marinera', 'descripcion': 'Arroz con mariscos al estilo español',
             'precio': 16500, 'categoria': 'Especialidades', 'tiempo_preparacion': 40},
            {'nombre': 'Risotto de Champiñones', 'descripcion': 'Arroz cremoso con champiñones y parmesano',
             'precio': 11500, 'categoria': 'Especialidades', 'tiempo_preparacion': 25},
            {'nombre': 'Filete Wellington', 'descripcion': 'Filete de res envuelto en hojaldre',
             'precio': 18500, 'categoria': 'Especialidades', 'tiempo_preparacion': 45},
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

    def crear_recetas(self, platos, ingredientes):
        self.stdout.write(self.style.HTTP_INFO('Creando recetas (ingredientes por plato)...'))

        # Definir recetas para cada plato
        recetas_data = {
            'Empanadas de Pino': [('Carne de Res', 0.15), ('Cebolla', 0.1), ('Huevos', 1), ('Harina', 0.2)],
            'Ceviche de Salmón': [('Salmón', 0.2), ('Cebolla', 0.05), ('Tomate', 0.1), ('Sal', 0.01)],
            'Bruschetta': [('Pan', 2), ('Tomate', 0.15), ('Aceite de Oliva', 0.03), ('Sal', 0.005)],
            'Lomo a lo Pobre': [('Carne de Res', 0.25), ('Papa', 0.3), ('Huevos', 2), ('Cebolla', 0.1), ('Aceite de Oliva', 0.05)],
            'Pollo al Horno': [('Pollo', 0.4), ('Papa', 0.25), ('Mantequilla', 0.03), ('Sal', 0.01), ('Pimienta', 0.005)],
            'Salmón a la Parrilla': [('Salmón', 0.25), ('Zanahoria', 0.1), ('Pimentón', 0.1), ('Aceite de Oliva', 0.03)],
            'Pasta Carbonara': [('Pasta', 0.15), ('Crema', 0.1), ('Queso', 0.05), ('Huevos', 2), ('Pimienta', 0.005)],
            'Costillar de Cerdo': [('Cerdo', 0.5), ('Cebolla', 0.1), ('Azúcar', 0.02), ('Sal', 0.01)],
            'Ensalada César': [('Lechuga', 1), ('Queso', 0.05), ('Pan', 1), ('Aceite de Oliva', 0.03)],
            'Ensalada Mediterránea': [('Lechuga', 1), ('Tomate', 0.15), ('Queso', 0.08), ('Aceite de Oliva', 0.03), ('Vinagre', 0.02)],
            'Ensalada de Pollo': [('Pollo', 0.15), ('Lechuga', 1), ('Tomate', 0.1), ('Zanahoria', 0.05)],
            'Tiramisú': [('Café', 0.02), ('Crema', 0.1), ('Huevos', 2), ('Azúcar', 0.05), ('Chocolate', 0.03)],
            'Brownie con Helado': [('Chocolate', 0.1), ('Harina', 0.1), ('Huevos', 2), ('Azúcar', 0.08), ('Mantequilla', 0.05)],
            'Crème Brûlée': [('Crema', 0.15), ('Huevos', 3), ('Azúcar', 0.06), ('Leche', 0.1)],
            'Flan Casero': [('Huevos', 4), ('Leche', 0.3), ('Azúcar', 0.1)],
            'Limonada Natural': [('Azúcar', 0.03), ('Leche', 0.01)],  # Simplificado
            'Café Espresso': [('Café', 0.02), ('Azúcar', 0.01)],
            'Jugo de Naranja': [('Azúcar', 0.02)],  # Simplificado
            'Paella Marinera': [('Arroz', 0.2), ('Camarones', 0.15), ('Pimentón', 0.1), ('Cebolla', 0.1), ('Aceite de Oliva', 0.05)],
            'Risotto de Champiñones': [('Arroz', 0.15), ('Champiñones', 0.15), ('Crema', 0.1), ('Queso', 0.05), ('Mantequilla', 0.03)],
            'Filete Wellington': [('Carne de Res', 0.3), ('Champiñones', 0.1), ('Harina', 0.15), ('Mantequilla', 0.05), ('Huevos', 1)],
        }

        total_recetas = 0
        for nombre_plato, ingredientes_plato in recetas_data.items():
            plato = platos.get(nombre_plato)
            if not plato:
                continue

            for nombre_ing, cantidad in ingredientes_plato:
                ing = ingredientes.get(nombre_ing)
                if not ing:
                    continue

                Receta.objects.create(
                    plato=plato,
                    ingrediente=ing,
                    cantidad_requerida=Decimal(str(cantidad))
                )
                total_recetas += 1

        self.stdout.write(self.style.SUCCESS(f'  Total: {total_recetas} relaciones plato-ingrediente creadas\n'))

    def crear_reservas(self, usuarios, mesas):
        self.stdout.write(self.style.HTTP_INFO('Creando reservas...'))

        hoy = date.today()
        clientes = [usuarios[f'cliente{i}'] for i in range(1, 10)]
        horas = [time(12, 0), time(13, 0), time(14, 0), time(19, 0), time(20, 0), time(21, 0)]
        estados = ['pendiente', 'confirmada', 'activa', 'completada']

        reservas = []
        for dia in range(7):
            fecha = hoy + timedelta(days=dia)
            # 4-6 reservas por día
            num_reservas = random.randint(4, 6)
            mesas_usadas = set()

            for _ in range(num_reservas):
                mesa = random.choice([m for m in mesas if m.numero not in mesas_usadas])
                mesas_usadas.add(mesa.numero)

                cliente = random.choice(clientes)
                hora_inicio = random.choice(horas)
                hora_fin = time((hora_inicio.hour + 2) % 24, 0)

                # Estado según el día
                if dia == 0:  # Hoy
                    estado = random.choice(['activa', 'confirmada', 'completada'])
                elif dia < 3:
                    estado = random.choice(['pendiente', 'confirmada'])
                else:
                    estado = 'pendiente'

                num_personas = random.randint(1, mesa.capacidad)

                reserva = Reserva.objects.create(
                    cliente=cliente,
                    mesa=mesa,
                    fecha_reserva=fecha,
                    hora_inicio=hora_inicio,
                    hora_fin=hora_fin,
                    num_personas=num_personas,
                    estado=estado,
                    notas=random.choice(['', 'Mesa cerca de ventana', 'Cumpleaños', 'Reunión de negocios', ''])
                )
                reservas.append(reserva)
                self.stdout.write(f"  + Reserva {reserva.id}: Mesa {mesa.numero}, {fecha} {hora_inicio} ({estado})")

        self.stdout.write(self.style.SUCCESS(f'  Total: {len(reservas)} reservas creadas\n'))
        return reservas

    def crear_pedidos(self, mesas, platos, reservas):
        self.stdout.write(self.style.HTTP_INFO('Creando pedidos...'))

        lista_platos = list(platos.values())
        estados = [EstadoPedido.CREADO, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO, EstadoPedido.ENTREGADO]

        pedidos_creados = 0
        # Crear pedidos para algunas reservas
        for reserva in reservas[:20]:
            estado = random.choice(estados)

            pedido = Pedido.objects.create(
                mesa=reserva.mesa,
                reserva=reserva,
                cliente=reserva.cliente,
                estado=estado,
                notas=random.choice(['', 'Sin sal', 'Extra salsa', 'Alérgico a mariscos', ''])
            )

            # Agregar 2-4 platos al pedido
            num_platos = random.randint(2, 4)
            platos_pedido = random.sample(lista_platos, num_platos)

            for plato in platos_pedido:
                DetallePedido.objects.create(
                    pedido=pedido,
                    plato=plato,
                    cantidad=random.randint(1, 3),
                    precio_unitario=plato.precio,
                    notas_especiales=random.choice(['', 'Sin cebolla', 'Bien cocido', ''])
                )

            pedidos_creados += 1
            self.stdout.write(f"  + Pedido {pedido.id}: Mesa {pedido.mesa.numero}, {num_platos} platos ({estado})")

        # Crear algunos pedidos adicionales sin reserva
        for _ in range(5):
            mesa = random.choice(mesas)
            estado = random.choice(estados)

            pedido = Pedido.objects.create(
                mesa=mesa,
                estado=estado,
                notas=''
            )

            num_platos = random.randint(2, 3)
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
        self.stdout.write(self.style.SUCCESS('DATOS DE PRUEBA CREADOS EXITOSAMENTE'))
        self.stdout.write('='*60)

        self.stdout.write(self.style.SUCCESS(f'''
RESUMEN:
  - Usuarios: {User.objects.count()}
  - Mesas: {Mesa.objects.count()}
  - Categorías: {CategoriaMenu.objects.count()}
  - Ingredientes: {Ingrediente.objects.count()}
  - Platos: {Plato.objects.count()}
  - Recetas: {Receta.objects.count()}
  - Reservas: {Reserva.objects.count()}
  - Pedidos: {Pedido.objects.count()}
  - Detalles de Pedidos: {DetallePedido.objects.count()}

CREDENCIALES DE ACCESO:
  Admin:    admin / admin123
  Cajero:   cajero1 / test123, cajero2 / test123
  Mesero:   mesero1-3 / test123
  Cliente:  cliente1-9 / test123
'''))
        self.stdout.write('='*60 + '\n')
