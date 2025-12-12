from rest_framework import serializers
from .models import Pedido, DetallePedido, PedidoCancelacion, TRANSICIONES_VALIDAS
from mainApp.models import Mesa, Reserva
from menuApp.models import Plato


class DetallePedidoSerializer(serializers.ModelSerializer):
    plato_nombre = serializers.CharField(source='plato.nombre', read_only=True)
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = DetallePedido
        fields = [
            'id', 'plato', 'plato_nombre', 'cantidad',
            'precio_unitario', 'notas_especiales', 'subtotal'
        ]
        read_only_fields = ['precio_unitario']


class PedidoCancelacionSerializer(serializers.ModelSerializer):
    """Serializer para datos de cancelación"""
    cancelado_por_username = serializers.CharField(
        source='cancelado_por.username',
        read_only=True,
        default=None
    )
    cancelado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PedidoCancelacion
        fields = [
            'id', 'pedido',
            'cancelado_por', 'cancelado_por_username', 'cancelado_por_nombre',
            'fecha_cancelacion', 'motivo',
            'mesa_numero', 'cliente_nombre', 'total_pedido',
            'productos_resumen', 'productos_detalle'
        ]
        read_only_fields = ['cancelado_por', 'fecha_cancelacion']

    def get_cancelado_por_nombre(self, obj):
        """Obtener nombre completo del usuario que canceló"""
        if obj.cancelado_por and hasattr(obj.cancelado_por, 'perfil'):
            return obj.cancelado_por.perfil.nombre_completo
        return None


class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    transiciones_permitidas = serializers.SerializerMethodField()
    total = serializers.ReadOnlyField()
    cliente_username = serializers.CharField(source='cliente.username', read_only=True, default=None)
    cliente_nombre = serializers.SerializerMethodField()
    tiempo_desde_creacion = serializers.SerializerMethodField()
    tiempo_desde_listo = serializers.SerializerMethodField()
    tiempo_total = serializers.SerializerMethodField()
    cancelacion = PedidoCancelacionSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Pedido
        fields = [
            'id', 'mesa', 'mesa_numero', 'reserva', 'cliente', 'cliente_username', 'cliente_nombre',
            'estado', 'notas', 'fecha_creacion', 'fecha_actualizacion',
            'fecha_listo', 'fecha_entregado',
            'tiempo_desde_creacion', 'tiempo_desde_listo', 'tiempo_total',
            'detalles', 'transiciones_permitidas', 'total',
            'cancelacion'
        ]
        read_only_fields = ['estado', 'fecha_creacion', 'fecha_actualizacion', 'fecha_listo', 'fecha_entregado']

    def get_cliente_nombre(self, obj):
        """Obtener nombre completo del cliente desde perfil"""
        if obj.cliente and hasattr(obj.cliente, 'perfil'):
            return obj.cliente.perfil.nombre_completo
        return None

    def get_transiciones_permitidas(self, obj):
        return TRANSICIONES_VALIDAS.get(obj.estado, [])

    def get_tiempo_desde_creacion(self, obj):
        """Minutos desde creación hasta ahora (o hasta entregado)"""
        from django.utils import timezone
        fecha_fin = obj.fecha_entregado if obj.fecha_entregado else timezone.now()
        delta = fecha_fin - obj.fecha_creacion
        return int(delta.total_seconds() / 60)

    def get_tiempo_desde_listo(self, obj):
        """Minutos desde LISTO hasta ahora (o hasta entregado). None si no ha llegado a LISTO"""
        if not obj.fecha_listo:
            return None
        from django.utils import timezone
        fecha_fin = obj.fecha_entregado if obj.fecha_entregado else timezone.now()
        delta = fecha_fin - obj.fecha_listo
        return int(delta.total_seconds() / 60)

    def get_tiempo_total(self, obj):
        """Minutos totales desde creación hasta entregado. None si no está ENTREGADO"""
        if not obj.fecha_entregado:
            return None
        delta = obj.fecha_entregado - obj.fecha_creacion
        return int(delta.total_seconds() / 60)


class PedidoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados"""
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    total = serializers.ReadOnlyField()
    num_items = serializers.SerializerMethodField()
    tiempo_desde_listo = serializers.SerializerMethodField()
    tiempo_desde_creacion = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id', 'mesa_numero', 'estado', 'fecha_creacion',
            'fecha_listo', 'tiempo_desde_listo', 'tiempo_desde_creacion',
            'total', 'num_items',
            'detalles', 'cliente_nombre'
        ]

    def get_cliente_nombre(self, obj):
        """Obtener nombre completo del cliente desde perfil"""
        if obj.cliente and hasattr(obj.cliente, 'perfil'):
            return obj.cliente.perfil.nombre_completo
        return None

    def get_num_items(self, obj):
        return obj.detalles.count()

    def get_tiempo_desde_listo(self, obj):
        """Minutos desde LISTO hasta ahora (o hasta entregado). None si no ha llegado a LISTO"""
        if not obj.fecha_listo:
            return None
        from django.utils import timezone
        fecha_fin = obj.fecha_entregado if obj.fecha_entregado else timezone.now()
        delta = fecha_fin - obj.fecha_listo
        return int(delta.total_seconds() / 60)

    def get_tiempo_desde_creacion(self, obj):
        """Minutos desde creación hasta ahora (o hasta entregado)"""
        from django.utils import timezone
        fecha_fin = obj.fecha_entregado if obj.fecha_entregado else timezone.now()
        delta = fecha_fin - obj.fecha_creacion
        return int(delta.total_seconds() / 60)


class DetalleInputSerializer(serializers.Serializer):
    """Serializer para validar detalles al crear pedido"""
    plato = serializers.PrimaryKeyRelatedField(queryset=Plato.objects.filter(activo=True))
    cantidad = serializers.IntegerField(min_value=1)
    notas = serializers.CharField(required=False, allow_blank=True, max_length=200)


class PedidoCreateSerializer(serializers.Serializer):
    """Serializer para crear pedido con detalles"""
    mesa = serializers.PrimaryKeyRelatedField(queryset=Mesa.objects.all())
    reserva = serializers.PrimaryKeyRelatedField(
        queryset=Reserva.objects.all(),
        required=False,
        allow_null=True
    )
    notas = serializers.CharField(required=False, allow_blank=True, max_length=500)
    detalles = DetalleInputSerializer(many=True, min_length=1)

    def validate_detalles(self, value):
        """Convierte los datos de detalles para el servicio"""
        validated = []
        for detalle in value:
            plato = detalle['plato']
            if not plato.disponible:
                raise serializers.ValidationError(
                    f"El plato '{plato.nombre}' no está disponible actualmente"
                )
            validated.append({
                'plato': plato,
                'cantidad': detalle['cantidad'],
                'notas': detalle.get('notas', '')
            })
        return validated


class CambiarEstadoSerializer(serializers.Serializer):
    """Serializer para cambiar estado de pedido"""
    estado = serializers.ChoiceField(choices=[
        ('EN_PREPARACION', 'En preparación'),
        ('URGENTE', 'Urgente'),
        ('LISTO', 'Listo'),
        ('ENTREGADO', 'Entregado'),
        ('CANCELADO', 'Cancelado'),
    ])
