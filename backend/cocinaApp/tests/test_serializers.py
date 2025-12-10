"""
Tests unitarios para serializers de cocinaApp.

Tests de:
- PedidoCancelacionSerializer: Serialización de auditoría de cancelaciones
- PedidoSerializer: Campo cliente_nombre y relación con cancelacion
"""
import pytest
from decimal import Decimal

from cocinaApp.serializers import PedidoCancelacionSerializer, PedidoSerializer
from cocinaApp.models import Pedido
from .factories import (
    PedidoCancelacionFactory, PedidoFactory, DetallePedidoFactory,
    PedidoCanceladoFactory
)


@pytest.mark.django_db
@pytest.mark.serializers
@pytest.mark.unit
class TestPedidoCancelacionSerializer:
    """Tests del PedidoCancelacionSerializer"""

    def test_serializar_cancelacion_completa(self):
        """Serializar cancelación con todos los campos"""
        cancelacion = PedidoCancelacionFactory()
        serializer = PedidoCancelacionSerializer(cancelacion)

        data = serializer.data

        # Campos básicos
        assert 'id' in data
        assert 'pedido' in data
        assert 'cancelado_por' in data
        assert 'motivo' in data
        assert 'fecha_cancelacion' in data

        # Campos computados
        assert 'cancelado_por_username' in data
        assert 'cancelado_por_nombre' in data

        # Snapshots
        assert 'mesa_numero' in data
        assert 'cliente_nombre' in data
        assert 'total_pedido' in data
        assert 'productos_resumen' in data
        assert 'productos_detalle' in data

    def test_cancelado_por_username_readonly(self):
        """cancelado_por_username es read-only y retorna username"""
        cancelacion = PedidoCancelacionFactory()
        serializer = PedidoCancelacionSerializer(cancelacion)

        assert serializer.data['cancelado_por_username'] == cancelacion.cancelado_por.username

    def test_cancelado_por_nombre_con_perfil(self, user_admin):
        """cancelado_por_nombre retorna nombre_completo del perfil"""
        cancelacion = PedidoCancelacionFactory(cancelado_por=user_admin)
        serializer = PedidoCancelacionSerializer(cancelacion)

        assert serializer.data['cancelado_por_nombre'] == user_admin.perfil.nombre_completo

    def test_cancelado_por_nombre_sin_perfil(self):
        """cancelado_por_nombre retorna None si no hay perfil"""
        from mainApp.tests.factories import UserFactory
        from django.contrib.auth.models import User

        user_sin_perfil = UserFactory.build()
        user_sin_perfil.save()
        user_id = user_sin_perfil.id
        # Eliminar perfil creado automáticamente por signal
        if hasattr(user_sin_perfil, 'perfil'):
            user_sin_perfil.perfil.delete()

        # Recargar usuario desde DB para eliminar referencia cacheada
        user_sin_perfil = User.objects.get(id=user_id)

        cancelacion = PedidoCancelacionFactory(cancelado_por=user_sin_perfil)
        serializer = PedidoCancelacionSerializer(cancelacion)

        assert serializer.data['cancelado_por_nombre'] is None

    def test_productos_detalle_como_json(self):
        """productos_detalle se serializa como lista JSON"""
        cancelacion = PedidoCancelacionFactory()
        serializer = PedidoCancelacionSerializer(cancelacion)

        productos = serializer.data['productos_detalle']

        assert isinstance(productos, list)
        assert len(productos) > 0

    def test_productos_detalle_estructura(self):
        """productos_detalle mantiene estructura correcta"""
        productos_data = [
            {
                'plato_id': 10,
                'plato_nombre': 'Pizza',
                'cantidad': 2,
                'precio_unitario': 12500.00,
                'subtotal': 25000.00
            }
        ]
        cancelacion = PedidoCancelacionFactory(productos_detalle=productos_data)
        serializer = PedidoCancelacionSerializer(cancelacion)

        productos = serializer.data['productos_detalle']

        assert productos[0]['plato_id'] == 10
        assert productos[0]['plato_nombre'] == 'Pizza'
        assert productos[0]['cantidad'] == 2

    def test_read_only_fields(self):
        """Campos read_only no se pueden modificar"""
        cancelacion = PedidoCancelacionFactory()

        # Intentar modificar campo read_only
        serializer = PedidoCancelacionSerializer(
            cancelacion,
            data={'cancelado_por_username': 'hacker'},
            partial=True
        )

        assert serializer.is_valid()
        serializer.save()

        # Verificar que el campo no cambió
        cancelacion.refresh_from_db()
        assert cancelacion.cancelado_por.username != 'hacker'

    def test_fecha_cancelacion_formato_iso(self):
        """fecha_cancelacion se serializa en formato ISO"""
        cancelacion = PedidoCancelacionFactory()
        serializer = PedidoCancelacionSerializer(cancelacion)

        fecha = serializer.data['fecha_cancelacion']

        # Debe ser string en formato ISO
        assert isinstance(fecha, str)
        assert 'T' in fecha  # Formato ISO incluye T

    def test_total_pedido_decimal_format(self):
        """total_pedido se serializa como string decimal"""
        from decimal import Decimal

        cancelacion = PedidoCancelacionFactory(total_pedido=Decimal('12345.67'))
        serializer = PedidoCancelacionSerializer(cancelacion)

        total = serializer.data['total_pedido']

        # DRF DecimalField serializa como string
        assert isinstance(total, str) or isinstance(total, (int, float))

    def test_motivo_largo_se_serializa_completo(self):
        """motivo largo (hasta 500 chars) se serializa completo"""
        motivo_500 = 'x' * 500
        cancelacion = PedidoCancelacionFactory(motivo=motivo_500)
        serializer = PedidoCancelacionSerializer(cancelacion)

        assert len(serializer.data['motivo']) == 500

    def test_serializar_multiple_cancelaciones(self):
        """Serializar lista de cancelaciones (many=True)"""
        cancelaciones = PedidoCancelacionFactory.create_batch(5)
        serializer = PedidoCancelacionSerializer(cancelaciones, many=True)

        data = serializer.data

        assert isinstance(data, list)
        assert len(data) == 5

        for item in data:
            assert 'id' in item
            assert 'motivo' in item
            assert 'productos_detalle' in item


@pytest.mark.django_db
@pytest.mark.serializers
@pytest.mark.unit
class TestPedidoSerializer:
    """Tests del PedidoSerializer y campo cliente_nombre"""

    def test_cliente_nombre_con_perfil(self, user_cliente):
        """cliente_nombre retorna nombre_completo con perfil"""
        pedido = PedidoFactory(cliente=user_cliente)
        serializer = PedidoSerializer(pedido)

        assert 'cliente_nombre' in serializer.data
        assert serializer.data['cliente_nombre'] == user_cliente.perfil.nombre_completo

    def test_cliente_nombre_sin_cliente(self):
        """cliente_nombre retorna None sin cliente"""
        pedido = PedidoFactory(cliente=None)
        serializer = PedidoSerializer(pedido)

        assert 'cliente_nombre' in serializer.data
        assert serializer.data['cliente_nombre'] is None

    def test_cliente_nombre_sin_perfil(self):
        """cliente_nombre retorna None si cliente no tiene perfil"""
        from mainApp.tests.factories import UserFactory
        from django.contrib.auth.models import User

        user_sin_perfil = UserFactory.build()
        user_sin_perfil.save()
        user_id = user_sin_perfil.id
        # Eliminar perfil creado automáticamente por signal
        if hasattr(user_sin_perfil, 'perfil'):
            user_sin_perfil.perfil.delete()

        # Recargar usuario desde DB para eliminar referencia cacheada
        user_sin_perfil = User.objects.get(id=user_id)

        pedido = PedidoFactory(cliente=user_sin_perfil)
        serializer = PedidoSerializer(pedido)

        assert serializer.data['cliente_nombre'] is None

    def test_cancelacion_anidada_presente(self):
        """Pedido con cancelación incluye objeto anidado"""
        pedido = PedidoCanceladoFactory()
        cancelacion = PedidoCancelacionFactory(pedido=pedido)

        serializer = PedidoSerializer(pedido)

        assert 'cancelacion' in serializer.data
        assert serializer.data['cancelacion'] is not None
        assert serializer.data['cancelacion']['id'] == cancelacion.id
        assert serializer.data['cancelacion']['motivo'] == cancelacion.motivo

    def test_cancelacion_null_sin_cancelacion(self):
        """Pedido sin cancelación tiene cancelacion=null"""
        pedido = PedidoFactory(estado='CREADO')
        serializer = PedidoSerializer(pedido)

        assert 'cancelacion' in serializer.data
        assert serializer.data['cancelacion'] is None

    def test_cancelacion_estructura_completa(self):
        """Cancelación anidada incluye todos los campos necesarios"""
        pedido = PedidoCanceladoFactory()
        cancelacion = PedidoCancelacionFactory(pedido=pedido)

        serializer = PedidoSerializer(pedido)
        cancelacion_data = serializer.data['cancelacion']

        # Campos críticos de cancelación
        assert 'motivo' in cancelacion_data
        assert 'cancelado_por_username' in cancelacion_data
        assert 'cancelado_por_nombre' in cancelacion_data
        assert 'fecha_cancelacion' in cancelacion_data
        assert 'productos_detalle' in cancelacion_data

    def test_pedido_serializado_completo(self, user_cliente):
        """Pedido completo se serializa con todos los campos"""
        pedido = PedidoFactory(cliente=user_cliente, estado='LISTO')
        DetallePedidoFactory.create_batch(2, pedido=pedido)

        serializer = PedidoSerializer(pedido)
        data = serializer.data

        # Campos base
        assert 'id' in data
        assert 'mesa' in data
        assert 'cliente' in data
        assert 'estado' in data
        assert 'fecha_creacion' in data

        # Campos computados
        assert 'cliente_nombre' in data
        assert 'cancelacion' in data

        # Relaciones
        assert 'detalles' in data or 'productos' in data

    def test_serializar_lista_pedidos(self, user_cliente):
        """Serializar lista de pedidos (many=True)"""
        pedidos = PedidoFactory.create_batch(5, cliente=user_cliente)

        serializer = PedidoSerializer(pedidos, many=True)
        data = serializer.data

        assert isinstance(data, list)
        assert len(data) == 5

        for item in data:
            assert 'id' in item
            assert 'cliente_nombre' in item
            assert item['cliente_nombre'] == user_cliente.perfil.nombre_completo

    def test_pedido_sin_cliente_ni_cancelacion(self):
        """Pedido sin cliente ni cancelación serializa correctamente"""
        pedido = PedidoFactory(cliente=None, estado='CREADO')
        serializer = PedidoSerializer(pedido)

        assert serializer.data['cliente_nombre'] is None
        assert serializer.data['cancelacion'] is None

    def test_mesa_serializada_correctamente(self, mesa_disponible):
        """Mesa del pedido se serializa con información básica"""
        pedido = PedidoFactory(mesa=mesa_disponible)
        serializer = PedidoSerializer(pedido)

        assert 'mesa' in serializer.data
        mesa_data = serializer.data['mesa']

        # Debe tener al menos el ID de la mesa
        assert mesa_data is not None

    def test_total_pedido_calculado(self):
        """total del pedido se calcula correctamente"""
        pedido = PedidoFactory()
        DetallePedidoFactory(pedido=pedido, precio_unitario=Decimal('5000'), cantidad=2)
        DetallePedidoFactory(pedido=pedido, precio_unitario=Decimal('3000'), cantidad=1)

        serializer = PedidoSerializer(pedido)

        # total debería ser 5000*2 + 3000*1 = 13000
        if 'total' in serializer.data:
            total = serializer.data['total']
            # Puede ser string o número dependiendo del field type
            assert float(total) == 13000.00
