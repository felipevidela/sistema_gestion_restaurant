from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PedidoViewSet,
    ColaCocinaPedidosView,
    ColaUrgentesView,
    EstadisticasCocinaView,
    PedidosListosView,
    PedidosEntregadosView,
    PedidosCanceladosView,
    EstadisticasCancelacionesView,
)

router = DefaultRouter()
router.register(r'pedidos', PedidoViewSet, basename='pedido')

urlpatterns = [
    # Rutas específicas ANTES del router para evitar conflictos
    path('cola/', ColaCocinaPedidosView.as_view(), name='cola-cocina'),
    path('cola/urgentes/', ColaUrgentesView.as_view(), name='cola-urgentes'),
    path('pedidos/listos/', PedidosListosView.as_view(), name='pedidos-listos'),
    path('pedidos/entregados/', PedidosEntregadosView.as_view(), name='pedidos-entregados'),
    path('pedidos/cancelados/', PedidosCanceladosView.as_view(), name='pedidos-cancelados'),
    path('estadisticas/', EstadisticasCocinaView.as_view(), name='estadisticas-cocina'),
    path('estadisticas/cancelaciones/', EstadisticasCancelacionesView.as_view(), name='estadisticas-cancelaciones'),
    # Router genérico al final
    path('', include(router.urls)),
]
