from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PedidoViewSet,
    ColaCocinaPedidosView,
    ColaUrgentesView,
    EstadisticasCocinaView
)

router = DefaultRouter()
router.register(r'pedidos', PedidoViewSet, basename='pedido')

urlpatterns = [
    path('', include(router.urls)),
    path('cola/', ColaCocinaPedidosView.as_view(), name='cola-cocina'),
    path('cola/urgentes/', ColaUrgentesView.as_view(), name='cola-urgentes'),
    path('estadisticas/', EstadisticasCocinaView.as_view(), name='estadisticas-cocina'),
]
