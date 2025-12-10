from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Avg, Count
from django.db.models.functions import TruncDate
from django.core.exceptions import ValidationError
from datetime import timedelta

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


class PedidoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class PedidoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de pedidos de cocina"""
    queryset = Pedido.objects.select_related('mesa', 'reserva', 'cliente').prefetch_related('detalles__plato')
    filter_backends = [DjangoFilterBackend]
    filterset_class = PedidoFilter
    permission_classes = [IsAuthenticated]
    pagination_class = PedidoPagination

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
        """
        Cambiar estado del pedido.

        ⚠️ IMPORTANTE - TRAZABILIDAD DE CANCELACIONES:

        Para registrar auditoría completa (RECOMENDADO):
        {
            "estado": "CANCELADO",
            "motivo": "Cliente solicitó cancelación, ingredientes no disponibles, etc."
        }
        → Requisitos: motivo ≥10 caracteres
        → Guarda: usuario (auth), fecha, motivo, snapshot de productos

        Sin auditoría (compatibilidad con código legacy):
        {
            "estado": "CANCELADO"
        }
        → ⚠️ NO se registra quién canceló, cuándo, ni por qué
        → ⚠️ NO hay trazabilidad ni control de gestión
        → Solo para flujos existentes que no pueden enviar motivo

        REGLA DE NEGOCIO: Para trazabilidad completa, SIEMPRE enviar motivo (≥10 caracteres).
        """
        pedido = self.get_object()
        serializer = CambiarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nuevo_estado = serializer.validated_data['estado']

        # Capturar motivo de cancelación si aplica
        motivo = request.data.get('motivo', '')

        try:
            # Si es cancelación con motivo, llamar directamente al servicio con parámetros
            if nuevo_estado == 'CANCELADO' and motivo:
                pedido = PedidoService.cancelar_pedido(
                    pedido,
                    usuario=request.user,
                    motivo=motivo
                )
            else:
                # Llamar al método estándar para otros estados
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
        """Obtener pedidos pendientes y en preparación. Soporta ?horas_recientes=N"""
        estados_cola = [
            EstadoPedido.CREADO,
            EstadoPedido.URGENTE,
            EstadoPedido.EN_PREPARACION
        ]

        pedidos = Pedido.objects.filter(
            estado__in=estados_cola
        ).select_related('mesa').prefetch_related('detalles__plato')

        # NUEVO: Filtro opcional por últimas N horas
        horas_recientes = request.query_params.get('horas_recientes')
        if horas_recientes:
            try:
                horas = int(horas_recientes)
                limite = timezone.now() - timedelta(hours=horas)
                pedidos = pedidos.filter(fecha_creacion__gte=limite)
            except (ValueError, TypeError):
                pass

        pedidos = pedidos.order_by('fecha_creacion')

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


class PedidosListosView(APIView):
    """Vista para pedidos LISTO (meseros). Soporta paginación, ordenamiento, filtros."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pedidos = Pedido.objects.filter(
            estado=EstadoPedido.LISTO
        ).select_related('mesa', 'reserva', 'cliente', 'cliente__perfil').prefetch_related('detalles__plato')

        # Filtros
        mesa = request.query_params.get('mesa')
        if mesa:
            pedidos = pedidos.filter(mesa_id=mesa)

        cliente = request.query_params.get('cliente')
        if cliente:
            pedidos = pedidos.filter(cliente_id=cliente)

        busqueda = request.query_params.get('busqueda')
        if busqueda:
            from django.db.models import Q
            pedidos = pedidos.filter(
                Q(id__icontains=busqueda) |
                Q(mesa__numero__icontains=busqueda) |
                Q(cliente__username__icontains=busqueda) |
                Q(cliente__first_name__icontains=busqueda) |
                Q(cliente__last_name__icontains=busqueda) |
                Q(cliente__perfil__nombre_completo__icontains=busqueda)
            )

        # Ordenamiento (default: más antiguos primero)
        ordering = request.query_params.get('ordering', 'fecha_listo')
        # Validar campos permitidos para evitar ordenamientos arbitrarios
        ordering_permitidos = ['fecha_listo', '-fecha_listo', 'mesa__numero', '-mesa__numero']
        if ordering in ordering_permitidos:
            pedidos = pedidos.order_by(ordering)
        else:
            pedidos = pedidos.order_by('fecha_listo')  # Default seguro

        # Paginación
        paginator = PedidoPagination()
        page = paginator.paginate_queryset(pedidos, request)

        if page is not None:
            serializer = PedidoSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = PedidoSerializer(pedidos, many=True)
        return Response(serializer.data)


class PedidosEntregadosView(APIView):
    """Vista para pedidos ENTREGADOS del día. Soporta paginación, ordenamiento, filtros."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Default: solo del día actual
        hoy = timezone.now().date()

        fecha = request.query_params.get('fecha')
        if fecha:
            from datetime import datetime
            try:
                hoy = datetime.strptime(fecha, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Formato de fecha inválido. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        pedidos = Pedido.objects.filter(
            estado=EstadoPedido.ENTREGADO,
            fecha_entregado__date=hoy
        ).select_related('mesa', 'reserva', 'cliente', 'cliente__perfil').prefetch_related('detalles__plato')

        # Filtros
        mesa = request.query_params.get('mesa')
        if mesa:
            pedidos = pedidos.filter(mesa_id=mesa)

        cliente = request.query_params.get('cliente')
        if cliente:
            pedidos = pedidos.filter(cliente_id=cliente)

        busqueda = request.query_params.get('busqueda')
        if busqueda:
            from django.db.models import Q
            pedidos = pedidos.filter(
                Q(id__icontains=busqueda) |
                Q(mesa__numero__icontains=busqueda) |
                Q(cliente__username__icontains=busqueda) |
                Q(cliente__first_name__icontains=busqueda) |
                Q(cliente__last_name__icontains=busqueda) |
                Q(cliente__perfil__nombre_completo__icontains=busqueda)
            )

        # Ordenamiento (default: más recientes primero)
        ordering = request.query_params.get('ordering', '-fecha_entregado')
        # Validar campos permitidos
        ordering_permitidos = ['fecha_entregado', '-fecha_entregado', 'mesa__numero', '-mesa__numero', 'fecha_listo', '-fecha_listo']
        if ordering in ordering_permitidos:
            pedidos = pedidos.order_by(ordering)
        else:
            pedidos = pedidos.order_by('-fecha_entregado')  # Default seguro

        # Paginación
        paginator = PedidoPagination()
        page = paginator.paginate_queryset(pedidos, request)

        if page is not None:
            serializer = PedidoSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = PedidoSerializer(pedidos, many=True)
        return Response(serializer.data)


class PedidosCanceladosView(APIView):
    """Vista para pedidos CANCELADOS con filtros de auditoría"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        GET /api/cocina/pedidos/cancelados/

        Parámetros:
        - fecha: fecha específica (YYYY-MM-DD)
        - periodo: 'hoy' | 'semana' | 'mes' (default: semana)
        - usuario: ID del usuario que canceló
        - busqueda: buscar por ID, mesa o cliente
        - ordering: campo de ordenamiento
        """
        # Base queryset con relaciones correctas
        pedidos = Pedido.objects.filter(
            estado=EstadoPedido.CANCELADO
        ).select_related(
            'mesa', 'reserva', 'cliente', 'cliente__perfil',
            # IMPORTANTE: Cargar relación de cancelación
            'cancelacion', 'cancelacion__cancelado_por', 'cancelacion__cancelado_por__perfil'
        ).prefetch_related('detalles__plato')

        # Filtro por periodo (default: semana para tener datos útiles)
        periodo = request.query_params.get('periodo', 'semana')
        hoy = timezone.now().date()

        if periodo == 'hoy':
            # Filtrar por pedidos con auditoría de cancelación de hoy
            pedidos = pedidos.filter(cancelacion__fecha_cancelacion__date=hoy)
        elif periodo == 'semana':
            # Últimos 7 días
            hace_7_dias = hoy - timedelta(days=7)
            pedidos = pedidos.filter(cancelacion__fecha_cancelacion__date__gte=hace_7_dias)
        elif periodo == 'mes':
            # Últimos 30 días
            hace_30_dias = hoy - timedelta(days=30)
            pedidos = pedidos.filter(cancelacion__fecha_cancelacion__date__gte=hace_30_dias)

        # Filtro por fecha específica
        fecha = request.query_params.get('fecha')
        if fecha:
            from datetime import datetime
            try:
                fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
                pedidos = pedidos.filter(cancelacion__fecha_cancelacion__date=fecha_obj)
            except ValueError:
                pass

        # Filtro por usuario que canceló
        usuario_id = request.query_params.get('usuario')
        if usuario_id:
            pedidos = pedidos.filter(cancelacion__cancelado_por_id=usuario_id)

        # Búsqueda
        busqueda = request.query_params.get('busqueda')
        if busqueda:
            from django.db.models import Q
            pedidos = pedidos.filter(
                Q(id__icontains=busqueda) |
                Q(mesa__numero__icontains=busqueda) |
                Q(cliente__username__icontains=busqueda) |
                Q(cliente__perfil__nombre_completo__icontains=busqueda) |
                Q(cancelacion__motivo__icontains=busqueda)
            )

        # Ordenamiento (default: más recientes primero)
        ordering = request.query_params.get('ordering', '-cancelacion__fecha_cancelacion')
        ordering_permitidos = [
            'cancelacion__fecha_cancelacion', '-cancelacion__fecha_cancelacion',
            'mesa__numero', '-mesa__numero',
            'fecha_creacion', '-fecha_creacion'
        ]
        if ordering in ordering_permitidos:
            pedidos = pedidos.order_by(ordering)
        else:
            pedidos = pedidos.order_by('-cancelacion__fecha_cancelacion')

        # Paginación
        paginator = PedidoPagination()
        page = paginator.paginate_queryset(pedidos, request)

        if page is not None:
            serializer = PedidoSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = PedidoSerializer(pedidos, many=True)
        return Response(serializer.data)


class EstadisticasCancelacionesView(APIView):
    """Vista para estadísticas de pedidos cancelados"""
    permission_classes = [IsAuthenticated, IsAdminOrCajero]

    def get(self, request):
        """
        GET /api/cocina/estadisticas/cancelaciones/

        Parámetros:
        - periodo: 'dia' | 'semana' | 'mes' (default: dia)
        """
        periodo = request.query_params.get('periodo', 'dia')
        hoy = timezone.now().date()

        # Determinar rango de fechas
        if periodo == 'dia':
            fecha_inicio = hoy
            fecha_fin = hoy
        elif periodo == 'semana':
            # Últimos 7 días
            fecha_inicio = hoy - timedelta(days=7)
            fecha_fin = hoy
        elif periodo == 'mes':
            # Últimos 30 días
            fecha_inicio = hoy - timedelta(days=30)
            fecha_fin = hoy
        else:
            fecha_inicio = hoy
            fecha_fin = hoy

        # Query de cancelaciones en el periodo
        # IMPORTANTE: Usar modelo relacionado PedidoCancelacion
        from .models import PedidoCancelacion
        cancelaciones = PedidoCancelacion.objects.filter(
            fecha_cancelacion__date__gte=fecha_inicio,
            fecha_cancelacion__date__lte=fecha_fin
        ).select_related('cancelado_por', 'cancelado_por__perfil', 'pedido')

        total_cancelados = cancelaciones.count()

        # Cancelaciones por usuario
        por_usuario = cancelaciones.values(
            'cancelado_por__username',
            'cancelado_por__perfil__nombre_completo'
        ).annotate(
            count=Count('id')
        ).order_by('-count')

        # Motivos más frecuentes (limitar a 100 caracteres por motivo y máximo 20 motivos)
        motivos_raw = cancelaciones.values_list('motivo', flat=True)
        motivos_truncados = [
            m[:97] + '...' if len(m) > 100 else m
            for m in motivos_raw if m
        ][:20]  # Máximo 20 motivos para evitar respuestas enormes

        return Response({
            'periodo': periodo,
            'fecha_inicio': fecha_inicio.isoformat(),
            'fecha_fin': fecha_fin.isoformat(),
            'total_cancelados': total_cancelados,
            'por_usuario': list(por_usuario),
            'motivos_sample': motivos_truncados,
            'motivos_total': len(motivos_raw)  # Total de motivos disponibles
        })
