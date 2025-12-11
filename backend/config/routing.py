"""
WebSocket URL routing
"""
from django.urls import re_path
from cocinaApp.consumers import PedidoConsumer

websocket_urlpatterns = [
    # Cola de cocina (todos los pedidos CREADO/URGENTE/EN_PREPARACION)
    re_path(r'^ws/cocina/cola/$', PedidoConsumer.as_asgi()),

    # Pedidos de mesa específica
    re_path(r'^ws/cocina/mesa/(?P<mesa_id>\d+)/$', PedidoConsumer.as_asgi()),

    # Pedidos listos (meseros)
    re_path(r'^ws/cocina/listos/$', PedidoConsumer.as_asgi()),

    # Pedidos urgentes
    re_path(r'^ws/cocina/urgentes/$', PedidoConsumer.as_asgi()),
]
