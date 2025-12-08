from django.test import TestCase
from django.contrib.auth.models import User
from decimal import Decimal
from django.core.exceptions import ValidationError
from mainApp.models import Mesa
from menuApp.models import Ingrediente, Plato, CategoriaMenu, Receta
from cocinaApp.models import Pedido
from cocinaApp.services import PedidoService


class PedidoServiceTests(TestCase):
    """Tests unitarios para PedidoService"""

    def setUp(self):
        """Configurar datos de prueba"""
        self.mesa = Mesa.objects.create(numero=1, capacidad=4)
        self.categoria = CategoriaMenu.objects.create(nombre='Entradas')
        self.ingrediente = Ingrediente.objects.create(
            nombre='Tomate',
            unidad_medida='kg',
            cantidad_disponible=Decimal('10.000'),
            stock_minimo=Decimal('2.000'),
            precio_unitario=Decimal('5.00')
        )
        self.plato = Plato.objects.create(
            nombre='Ensalada',
            precio=Decimal('15.00'),
            categoria=self.categoria
        )
        Receta.objects.create(
            plato=self.plato,
            ingrediente=self.ingrediente,
            cantidad_requerida=Decimal('0.500')
        )

    def test_crear_pedido_descuenta_stock(self):
        """Test: crear pedido descuenta stock correctamente"""
        stock_inicial = self.ingrediente.cantidad_disponible

        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 2}]
        )

        self.ingrediente.refresh_from_db()
        # 2 platos × 0.5 kg = 1 kg descontado
        self.assertEqual(
            self.ingrediente.cantidad_disponible,
            stock_inicial - Decimal('1.000')
        )
        self.assertEqual(pedido.estado, 'CREADO')
        self.assertEqual(pedido.detalles.count(), 1)

    def test_crear_pedido_stock_insuficiente(self):
        """Test: error si stock insuficiente"""
        self.ingrediente.cantidad_disponible = Decimal('0.100')
        self.ingrediente.save()

        with self.assertRaises(ValidationError) as ctx:
            PedidoService.crear_pedido_con_detalles(
                mesa=self.mesa,
                detalles_data=[{'plato': self.plato, 'cantidad': 1}]
            )
        self.assertIn('Stock insuficiente', str(ctx.exception))

    def test_crear_pedido_con_notas(self):
        """Test: crear pedido con notas"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{
                'plato': self.plato,
                'cantidad': 1,
                'notas': 'Sin cebolla'
            }],
            notas='Mesa cerca de la ventana'
        )

        self.assertEqual(pedido.notas, 'Mesa cerca de la ventana')
        self.assertEqual(pedido.detalles.first().notas_especiales, 'Sin cebolla')

    def test_crear_pedido_snapshot_precio(self):
        """Test: precio se guarda como snapshot al crear"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )

        precio_original = self.plato.precio
        detalle = pedido.detalles.first()
        self.assertEqual(detalle.precio_unitario, precio_original)

        # Cambiar precio del plato
        self.plato.precio = Decimal('20.00')
        self.plato.save()

        # El precio en el detalle no debe cambiar
        detalle.refresh_from_db()
        self.assertEqual(detalle.precio_unitario, precio_original)

    def test_cambiar_estado_transicion_valida(self):
        """Test: transición válida CREADO → EN_PREPARACION"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )

        pedido = PedidoService.cambiar_estado(pedido, 'EN_PREPARACION')
        self.assertEqual(pedido.estado, 'EN_PREPARACION')

    def test_cambiar_estado_transicion_invalida(self):
        """Test: error en transición inválida CREADO → ENTREGADO"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )

        with self.assertRaises(ValidationError) as ctx:
            PedidoService.cambiar_estado(pedido, 'ENTREGADO')
        self.assertIn('Transición inválida', str(ctx.exception))

    def test_cambiar_estado_a_urgente(self):
        """Test: transición CREADO → URGENTE"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )

        pedido = PedidoService.cambiar_estado(pedido, 'URGENTE')
        self.assertEqual(pedido.estado, 'URGENTE')

    def test_flujo_completo_pedido(self):
        """Test: flujo completo CREADO → EN_PREPARACION → LISTO → ENTREGADO"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )
        self.assertEqual(pedido.estado, 'CREADO')

        pedido = PedidoService.cambiar_estado(pedido, 'EN_PREPARACION')
        self.assertEqual(pedido.estado, 'EN_PREPARACION')

        pedido = PedidoService.cambiar_estado(pedido, 'LISTO')
        self.assertEqual(pedido.estado, 'LISTO')

        pedido = PedidoService.cambiar_estado(pedido, 'ENTREGADO')
        self.assertEqual(pedido.estado, 'ENTREGADO')

    def test_cancelar_pedido_revierte_stock(self):
        """Test: cancelar pedido revierte stock"""
        stock_inicial = self.ingrediente.cantidad_disponible

        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 2}]
        )

        self.ingrediente.refresh_from_db()
        stock_despues_crear = self.ingrediente.cantidad_disponible
        self.assertEqual(stock_despues_crear, stock_inicial - Decimal('1.000'))

        # Cancelar pedido
        PedidoService.cancelar_pedido(pedido)

        self.ingrediente.refresh_from_db()
        self.assertEqual(self.ingrediente.cantidad_disponible, stock_inicial)
        self.assertEqual(pedido.estado, 'CANCELADO')

    def test_cancelar_pedido_ya_entregado_falla(self):
        """Test: no se puede cancelar pedido entregado"""
        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )
        # Avanzar estados hasta ENTREGADO
        PedidoService.cambiar_estado(pedido, 'EN_PREPARACION')
        PedidoService.cambiar_estado(pedido, 'LISTO')
        PedidoService.cambiar_estado(pedido, 'ENTREGADO')

        with self.assertRaises(ValidationError):
            PedidoService.cancelar_pedido(pedido)

    def test_cancelar_pedido_en_preparacion(self):
        """Test: se puede cancelar pedido en preparación"""
        stock_inicial = self.ingrediente.cantidad_disponible

        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )
        PedidoService.cambiar_estado(pedido, 'EN_PREPARACION')

        # Cancelar
        PedidoService.cancelar_pedido(pedido)

        self.ingrediente.refresh_from_db()
        self.assertEqual(self.ingrediente.cantidad_disponible, stock_inicial)
        self.assertEqual(pedido.estado, 'CANCELADO')

    def test_cambiar_estado_via_cancelado(self):
        """Test: cambiar_estado con CANCELADO llama a cancelar_pedido"""
        stock_inicial = self.ingrediente.cantidad_disponible

        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 1}]
        )

        # Usar cambiar_estado en vez de cancelar_pedido directamente
        pedido = PedidoService.cambiar_estado(pedido, 'CANCELADO')

        self.ingrediente.refresh_from_db()
        self.assertEqual(self.ingrediente.cantidad_disponible, stock_inicial)
        self.assertEqual(pedido.estado, 'CANCELADO')

    def test_actualiza_disponibilidad_plato(self):
        """Test: disponibilidad del plato se actualiza según stock"""
        # Reducir stock a menos del mínimo para una porción
        self.ingrediente.cantidad_disponible = Decimal('0.300')
        self.ingrediente.save()

        # Crear pedido que consume 0.5 kg (más de lo disponible)
        with self.assertRaises(ValidationError):
            PedidoService.crear_pedido_con_detalles(
                mesa=self.mesa,
                detalles_data=[{'plato': self.plato, 'cantidad': 1}]
            )

    def test_multiple_ingredientes(self):
        """Test: pedido con plato que tiene múltiples ingredientes"""
        # Crear segundo ingrediente
        ingrediente2 = Ingrediente.objects.create(
            nombre='Lechuga',
            unidad_medida='kg',
            cantidad_disponible=Decimal('5.000'),
            stock_minimo=Decimal('1.000'),
            precio_unitario=Decimal('3.00')
        )
        Receta.objects.create(
            plato=self.plato,
            ingrediente=ingrediente2,
            cantidad_requerida=Decimal('0.200')
        )

        stock_tomate_inicial = self.ingrediente.cantidad_disponible
        stock_lechuga_inicial = ingrediente2.cantidad_disponible

        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[{'plato': self.plato, 'cantidad': 2}]
        )

        self.ingrediente.refresh_from_db()
        ingrediente2.refresh_from_db()

        # Tomate: 2 × 0.5 = 1.0 kg descontado
        self.assertEqual(
            self.ingrediente.cantidad_disponible,
            stock_tomate_inicial - Decimal('1.000')
        )
        # Lechuga: 2 × 0.2 = 0.4 kg descontado
        self.assertEqual(
            ingrediente2.cantidad_disponible,
            stock_lechuga_inicial - Decimal('0.400')
        )

    def test_multiple_platos_en_pedido(self):
        """Test: pedido con múltiples platos diferentes"""
        # Crear segundo plato
        plato2 = Plato.objects.create(
            nombre='Sopa',
            precio=Decimal('10.00'),
            categoria=self.categoria
        )
        ingrediente2 = Ingrediente.objects.create(
            nombre='Zanahoria',
            unidad_medida='kg',
            cantidad_disponible=Decimal('8.000'),
            stock_minimo=Decimal('1.000'),
            precio_unitario=Decimal('2.00')
        )
        Receta.objects.create(
            plato=plato2,
            ingrediente=ingrediente2,
            cantidad_requerida=Decimal('0.300')
        )

        pedido = PedidoService.crear_pedido_con_detalles(
            mesa=self.mesa,
            detalles_data=[
                {'plato': self.plato, 'cantidad': 1},
                {'plato': plato2, 'cantidad': 2}
            ]
        )

        self.assertEqual(pedido.detalles.count(), 2)

        self.ingrediente.refresh_from_db()
        ingrediente2.refresh_from_db()

        # Tomate: 1 × 0.5 = 0.5 kg
        self.assertEqual(
            self.ingrediente.cantidad_disponible,
            Decimal('9.500')
        )
        # Zanahoria: 2 × 0.3 = 0.6 kg
        self.assertEqual(
            ingrediente2.cantidad_disponible,
            Decimal('7.400')
        )
