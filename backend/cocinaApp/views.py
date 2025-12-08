from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Avg, Count
from django.db.models.functions import TruncDate
from django.core.exceptions import ValidationError

from .models import Pedido, DetallePedido, EstadoPedido
from .serializers import (
    PedidoSerializer,
    PedidoListSerializer,
    PedidoCreateSerializer,
    CambiarEstadoSerializer,
    DetallePedidoSerializer
)
from .filters import PedidoFilter
from .services import PedidoService
from mainApp.permissions import IsAdministrador, IsAdminOrCajero


class PedidoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de pedidos de cocina"""
    queryset = Pedido.objects.select_related('mesa', 'reserva', 'cliente').prefetch_related('detalles__plato')
    filter_backends = [DjangoFilterBackend]
    filterset_class = PedidoFilter
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return PedidoListSerializer
        if self.action == 'create':
            return PedidoCreateSerializer
        if self.action == 'estado':
            return CambiarEstadoSerializer
        return PedidoSerializer

    def create(self, request, *args, **kwargs):
        """Crear pedido usando el servicio transaccional"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            pedido = PedidoService.crear_pedido_con_detalles(
                mesa=serializer.validated_data['mesa'],
                detalles_data=serializer.validated_data['detalles'],
                reserva=serializer.validated_data.get('reserva'),
                cliente=request.user if request.user.is_authenticated else None,
                notas=serializer.validated_data.get('notas', '')
            )
            return Response(
                PedidoSerializer(pedido).data,
                status=status.HTTP_201_CREATED
            )
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        """Cambiar estado del pedido"""
        pedido = self.get_object()
        serializer = CambiarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nuevo_estado = serializer.validated_data['estado']

        try:
            pedido = PedidoService.cambiar_estado(pedido, nuevo_estado)
            return Response(PedidoSerializer(pedido).data)
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ColaCocinaPedidosView(APIView):
    """Vista para la cola de pedidos de cocina"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Obtener pedidos pendientes y en preparación ordenados"""
        estados_cola = [
            EstadoPedido.CREADO,
            EstadoPedido.URGENTE,
            EstadoPedido.EN_PREPARACION
        ]

        # Ordenar: urgentes primero, luego por antigüedad
        pedidos = Pedido.objects.filter(
            estado__in=estados_cola
        ).select_related('mesa').prefetch_related('detalles__plato').order_by(
            # Urgentes primero
            '-estado',  # URGENTE viene después de CREADO alfabéticamente, así que usamos -
            'fecha_creacion'  # Más antiguos primero
        )

        # Reordenar manualmente para que URGENTE sea primero
        pedidos_ordenados = sorted(
            pedidos,
            key=lambda p: (
                0 if p.estado == 'URGENTE' else 1,
                p.fecha_creacion
            )
        )

        serializer = PedidoSerializer(pedidos_ordenados, many=True)
        return Response(serializer.data)


class ColaUrgentesView(APIView):
    """Vista para pedidos urgentes"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Obtener solo pedidos urgentes"""
        pedidos = Pedido.objects.filter(
            estado=EstadoPedido.URGENTE
        ).select_related('mesa').prefetch_related('detalles__plato').order_by('fecha_creacion')

        serializer = PedidoSerializer(pedidos, many=True)
        return Response(serializer.data)


class EstadisticasCocinaView(APIView):
    """Vista para estadísticas de cocina"""
    permission_classes = [IsAuthenticated, IsAdminOrCajero]

    def get(self, request):
        """Obtener estadísticas de pedidos"""
        hoy = timezone.now().date()

        # Pedidos de hoy por estado
        pedidos_hoy = Pedido.objects.filter(
            fecha_creacion__date=hoy
        ).values('estado').annotate(count=Count('id'))

        resumen_estados = {item['estado']: item['count'] for item in pedidos_hoy}

        # Tiempo promedio de preparación (de CREADO a LISTO)
        # Esto es una aproximación simplificada
        pedidos_completados = Pedido.objects.filter(
            estado__in=[EstadoPedido.LISTO, EstadoPedido.ENTREGADO],
            fecha_creacion__date=hoy
        )

        total_pedidos_hoy = Pedido.objects.filter(fecha_creacion__date=hoy).count()

        return Response({
            'fecha': hoy.isoformat(),
            'total_pedidos': total_pedidos_hoy,
            'por_estado': resumen_estados,
            'pedidos_pendientes': resumen_estados.get('CREADO', 0) + resumen_estados.get('URGENTE', 0),
            'pedidos_en_preparacion': resumen_estados.get('EN_PREPARACION', 0),
            'pedidos_listos': resumen_estados.get('LISTO', 0),
            'pedidos_entregados': resumen_estados.get('ENTREGADO', 0),
            'pedidos_cancelados': resumen_estados.get('CANCELADO', 0),
        })
