from rest_framework import serializers
from .models import Pedido, DetallePedido, TRANSICIONES_VALIDAS
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


class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    transiciones_permitidas = serializers.SerializerMethodField()
    total = serializers.ReadOnlyField()
    cliente_username = serializers.CharField(source='cliente.username', read_only=True, default=None)

    class Meta:
        model = Pedido
        fields = [
            'id', 'mesa', 'mesa_numero', 'reserva', 'cliente', 'cliente_username',
            'estado', 'notas', 'fecha_creacion', 'fecha_actualizacion',
            'detalles', 'transiciones_permitidas', 'total'
        ]
        read_only_fields = ['estado', 'fecha_creacion', 'fecha_actualizacion']

    def get_transiciones_permitidas(self, obj):
        return TRANSICIONES_VALIDAS.get(obj.estado, [])


class PedidoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados"""
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    total = serializers.ReadOnlyField()
    num_items = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id', 'mesa_numero', 'estado', 'fecha_creacion',
            'total', 'num_items'
        ]

    def get_num_items(self, obj):
        return obj.detalles.count()


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
