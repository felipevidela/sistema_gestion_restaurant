"""
Tests unitarios para modelos de cocinaApp.

Tests de:
- PedidoCancelacion: Auditoría de cancelaciones con snapshots JSON
- Validaciones de campos y límites
- Queries y consultas
"""
import pytest
from datetime import date, timedelta
from django.db.utils import IntegrityError
from django.core.exceptions import ValidationError

from cocinaApp.models import PedidoCancelacion, Pedido
from .factories import (
    PedidoCancelacionFactory, PedidoCanceladoFactory,
    PedidoFactory, DetallePedidoFactory, PlatoFactory
)


@pytest.mark.django_db
@pytest.mark.models
@pytest.mark.unit
class TestPedidoCancelacion:
    """Tests del modelo PedidoCancelacion"""

    def test_crear_cancelacion_basica(self):
        """Crear PedidoCancelacion con todos los campos obligatorios"""
        cancelacion = PedidoCancelacionFactory()

        assert cancelacion.id is not None
        assert cancelacion.pedido is not None
        assert cancelacion.pedido.estado == 'CANCELADO'
        assert cancelacion.cancelado_por is not None
        assert cancelacion.motivo is not None
        assert len(cancelacion.motivo) >= 10
        assert cancelacion.mesa_numero > 0
        assert cancelacion.total_pedido >= 0
        assert cancelacion.fecha_cancelacion is not None

    def test_campos_snapshot_correctos(self):
        """Snapshots guardan datos del momento de cancelación"""
        cancelacion = PedidoCancelacionFactory()

        # Validar que snapshots existen
        assert cancelacion.mesa_numero is not None
        assert cancelacion.cliente_nombre is not None or cancelacion.cliente_nombre == ''
        assert cancelacion.total_pedido is not None
        assert cancelacion.productos_resumen is not None
        assert cancelacion.productos_detalle is not None

    def test_onetoone_no_duplicados(self):
        """OneToOneField no permite múltiples cancelaciones por pedido"""
        pedido = PedidoCanceladoFactory()
        PedidoCancelacionFactory(pedido=pedido)

        # Intentar crear segunda cancelación para el mismo pedido
        with pytest.raises(IntegrityError):
            PedidoCancelacionFactory(pedido=pedido)

    def test_productos_detalle_json_valido(self):
        """productos_detalle es una lista JSON con estructura correcta"""
        cancelacion = PedidoCancelacionFactory()

        # Validar tipo
        assert isinstance(cancelacion.productos_detalle, list)
        assert len(cancelacion.productos_detalle) > 0

        # Validar estructura de cada item
        for item in cancelacion.productos_detalle:
            assert 'plato_id' in item
            assert 'plato_nombre' in item
            assert 'cantidad' in item
            assert 'precio_unitario' in item
            assert 'subtotal' in item

            # Validar tipos
            assert isinstance(item['plato_id'], int)
            assert isinstance(item['plato_nombre'], str)
            assert isinstance(item['cantidad'], int)
            assert isinstance(item['precio_unitario'], (int, float))
            assert isinstance(item['subtotal'], (int, float))

    def test_productos_detalle_vacio_es_lista(self):
        """productos_detalle puede ser lista vacía"""
        pedido = PedidoCanceladoFactory()
        cancelacion = PedidoCancelacionFactory(
            pedido=pedido,
            productos_detalle=[]
        )

        assert isinstance(cancelacion.productos_detalle, list)
        assert len(cancelacion.productos_detalle) == 0

    def test_motivo_largo_permitido_en_modelo(self):
        """Modelo permite motivos >500 chars (truncado se hace en servicio)"""
        motivo_largo = 'x' * 600
        cancelacion = PedidoCancelacionFactory(motivo=motivo_largo)

        # El modelo NO trunca automáticamente - eso se hace en la capa de servicio
        assert len(cancelacion.motivo) == 600

    def test_motivo_exactamente_500_chars(self):
        """motivo de exactamente 500 caracteres se guarda completo"""
        motivo_500 = 'x' * 500
        cancelacion = PedidoCancelacionFactory(motivo=motivo_500)

        assert len(cancelacion.motivo) == 500
        assert cancelacion.motivo == motivo_500

    def test_productos_resumen_largo_permitido_en_modelo(self):
        """Modelo permite productos_resumen >500 chars (truncado se hace en servicio)"""
        resumen_largo = 'x' * 600
        cancelacion = PedidoCancelacionFactory(productos_resumen=resumen_largo)

        # El modelo NO trunca automáticamente - eso se hace en la capa de servicio
        assert len(cancelacion.productos_resumen) == 600

    def test_productos_resumen_formato_esperado(self):
        """productos_resumen tiene formato '2x Plato, 1x Otro'"""
        resumen = '2x Pizza Napolitana, 1x Ensalada César, 3x Empanadas'
        cancelacion = PedidoCancelacionFactory(productos_resumen=resumen)

        assert cancelacion.productos_resumen == resumen
        assert '2x Pizza Napolitana' in cancelacion.productos_resumen
        assert '1x Ensalada César' in cancelacion.productos_resumen

    def test_cliente_nombre_puede_ser_vacio(self):
        """cliente_nombre puede ser cadena vacía si no hay cliente"""
        pedido = PedidoCanceladoFactory(cliente=None)
        cancelacion = PedidoCancelacionFactory(
            pedido=pedido,
            cliente_nombre=''
        )

        assert cancelacion.cliente_nombre == ''

    def test_cliente_nombre_con_valor(self):
        """cliente_nombre puede guardar nombre completo"""
        nombre_completo = 'Juan Carlos Pérez García'
        cancelacion = PedidoCancelacionFactory(cliente_nombre=nombre_completo)

        assert cancelacion.cliente_nombre == nombre_completo

    def test_query_por_fecha_cancelacion(self):
        """Consultar cancelaciones por fecha específica"""
        # Crear cancelaciones de hoy
        PedidoCancelacionFactory.create_batch(5)

        hoy = date.today()
        cancelaciones = PedidoCancelacion.objects.filter(
            fecha_cancelacion__date=hoy
        )

        assert cancelaciones.count() == 5

    def test_query_por_rango_fechas(self):
        """Consultar cancelaciones por rango de fechas"""
        # Crear cancelaciones de hoy
        PedidoCancelacionFactory.create_batch(3)

        # Crear cancelaciones de hace 5 días
        hace_5_dias = date.today() - timedelta(days=5)
        cancelacion_antigua = PedidoCancelacionFactory()
        cancelacion_antigua.fecha_cancelacion = hace_5_dias
        cancelacion_antigua.save()

        # Query: solo última semana
        hace_7_dias = date.today() - timedelta(days=7)
        cancelaciones_semana = PedidoCancelacion.objects.filter(
            fecha_cancelacion__date__gte=hace_7_dias
        )

        assert cancelaciones_semana.count() == 4  # 3 de hoy + 1 de hace 5 días

    def test_query_por_cancelado_por(self, user_admin):
        """Consultar cancelaciones por usuario que canceló"""
        # Cancelaciones del admin
        PedidoCancelacionFactory.create_batch(3, cancelado_por=user_admin)

        # Cancelaciones de otros usuarios
        PedidoCancelacionFactory.create_batch(2)

        cancelaciones_admin = PedidoCancelacion.objects.filter(
            cancelado_por=user_admin
        )

        assert cancelaciones_admin.count() == 3

    def test_query_por_mesa_numero(self):
        """Consultar cancelaciones por número de mesa"""
        # Crear cancelaciones de mesa 5
        for _ in range(3):
            cancelacion = PedidoCancelacionFactory()
            cancelacion.mesa_numero = 5
            cancelacion.save()

        # Crear cancelaciones de otras mesas
        PedidoCancelacionFactory.create_batch(2)

        cancelaciones_mesa_5 = PedidoCancelacion.objects.filter(mesa_numero=5)

        assert cancelaciones_mesa_5.count() == 3

    def test_str_representation(self):
        """__str__ retorna representación legible"""
        cancelacion = PedidoCancelacionFactory()

        str_repr = str(cancelacion)
        assert str_repr is not None
        # Debería incluir información del pedido
        assert 'Pedido' in str_repr or 'pedido' in str_repr or str(cancelacion.pedido.id) in str_repr

    def test_ordering_default(self):
        """Cancelaciones ordenadas por defecto (más recientes primero si aplica)"""
        # Crear 3 cancelaciones
        c1 = PedidoCancelacionFactory()
        c2 = PedidoCancelacionFactory()
        c3 = PedidoCancelacionFactory()

        cancelaciones = PedidoCancelacion.objects.all()

        # Verificar que se pueden recuperar todas
        assert cancelaciones.count() == 3
        assert c1 in cancelaciones
        assert c2 in cancelaciones
        assert c3 in cancelaciones

    def test_relacion_con_pedido(self):
        """Relación OneToOne con Pedido funciona correctamente"""
        pedido = PedidoCanceladoFactory()
        cancelacion = PedidoCancelacionFactory(pedido=pedido)

        # Acceso desde cancelacion a pedido
        assert cancelacion.pedido == pedido
        assert cancelacion.pedido.estado == 'CANCELADO'

        # Acceso desde pedido a cancelacion (reverse)
        assert hasattr(pedido, 'cancelacion')
        assert pedido.cancelacion == cancelacion

    def test_relacion_con_usuario(self):
        """Relación ForeignKey con User funciona correctamente"""
        from mainApp.tests.factories import UserFactory

        usuario = UserFactory()
        cancelacion = PedidoCancelacionFactory(cancelado_por=usuario)

        assert cancelacion.cancelado_por == usuario
        assert cancelacion.cancelado_por.id is not None

    def test_delete_cascade_pedido(self):
        """Al eliminar pedido, se elimina la cancelación (CASCADE)"""
        pedido = PedidoCanceladoFactory()
        cancelacion = PedidoCancelacionFactory(pedido=pedido)
        cancelacion_id = cancelacion.id

        # Eliminar pedido
        pedido.delete()

        # Verificar que cancelación también fue eliminada
        assert not PedidoCancelacion.objects.filter(id=cancelacion_id).exists()

    def test_delete_set_null_usuario(self):
        """Al eliminar usuario, cancelado_por debe quedar en NULL"""
        from mainApp.tests.factories import UserFactory

        usuario = UserFactory()
        cancelacion = PedidoCancelacionFactory(cancelado_por=usuario)
        cancelacion_id = cancelacion.id

        # Eliminar usuario
        usuario_id = usuario.id
        usuario.delete()

        # Verificar que cancelación sigue existiendo
        cancelacion.refresh_from_db()
        assert cancelacion.id == cancelacion_id

        # Pero cancelado_por es NULL
        assert cancelacion.cancelado_por is None

    def test_total_pedido_decimal(self):
        """total_pedido se guarda como Decimal con 2 decimales"""
        from decimal import Decimal

        cancelacion = PedidoCancelacionFactory(total_pedido=Decimal('12345.67'))

        assert isinstance(cancelacion.total_pedido, Decimal)
        assert cancelacion.total_pedido == Decimal('12345.67')

    def test_total_pedido_cero_valido(self):
        """total_pedido puede ser cero"""
        from decimal import Decimal

        cancelacion = PedidoCancelacionFactory(total_pedido=Decimal('0.00'))

        assert cancelacion.total_pedido == Decimal('0.00')

    def test_motivo_con_caracteres_especiales(self):
        """motivo puede contener caracteres especiales"""
        motivo_especial = "Cliente solicitó cancelación: 'tiempo de espera > 30 min' & stock insuficiente"
        cancelacion = PedidoCancelacionFactory(motivo=motivo_especial)

        assert cancelacion.motivo == motivo_especial

    def test_productos_detalle_con_decimales(self):
        """productos_detalle maneja correctamente valores decimales"""
        productos = [
            {
                'plato_id': 1,
                'plato_nombre': 'Pizza',
                'cantidad': 2,
                'precio_unitario': 12500.50,
                'subtotal': 25001.00
            }
        ]
        cancelacion = PedidoCancelacionFactory(productos_detalle=productos)

        assert cancelacion.productos_detalle[0]['precio_unitario'] == 12500.50
        assert cancelacion.productos_detalle[0]['subtotal'] == 25001.00
