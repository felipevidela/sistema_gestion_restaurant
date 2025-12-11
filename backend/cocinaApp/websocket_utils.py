"""
Utilidades para enviar notificaciones WebSocket
"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from typing import Dict
from .models import Pedido, EstadoPedido


def enviar_notificacion_pedido(pedido: Pedido, evento: str, data_extra: Dict = None):
    """
    Envía notificación WebSocket cuando un pedido cambia.

    Args:
        pedido: Instancia del pedido
        evento: Tipo ('creado', 'actualizado', 'cancelado')
        data_extra: Datos adicionales
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    from .serializers import PedidoSerializer
    pedido_data = PedidoSerializer(pedido).data

    message = {
        'type': f'pedido_{evento}',
        'data': {
            'event': evento,
            'pedido': pedido_data,
            'timestamp': pedido.fecha_actualizacion.isoformat(),
            **(data_extra or {})
        }
    }

    # Determinar grupos según estado
    grupos = [f'mesa_{pedido.mesa.id}']

    if pedido.estado in [EstadoPedido.CREADO, EstadoPedido.URGENTE, EstadoPedido.EN_PREPARACION]:
        grupos.append('cola_cocina')

    if pedido.estado == EstadoPedido.URGENTE:
        grupos.append('pedidos_urgentes')

    if pedido.estado == EstadoPedido.LISTO:
        grupos.append('pedidos_listos')

    # Enviar a grupos
    for grupo in grupos:
        async_to_sync(channel_layer.group_send)(grupo, message)
