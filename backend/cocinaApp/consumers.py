"""
WebSocket consumers para notificaciones de pedidos en tiempo real
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser


class PedidoConsumer(AsyncWebsocketConsumer):
    """
    Consumer para notificaciones de pedidos.
    Soporta grupos: cola_cocina, pedidos_listos, pedidos_urgentes, mesa_{id}
    """

    async def connect(self):
        # Verificar autenticación
        user = self.scope.get('user')
        if not user or isinstance(user, AnonymousUser):
            await self.close(code=4001)
            return

        # Determinar grupos según URL
        self.room_groups = []
        path = self.scope['path']

        if '/cola/' in path:
            self.room_groups.append('cola_cocina')
        elif '/listos/' in path:
            self.room_groups.append('pedidos_listos')
        elif '/urgentes/' in path:
            self.room_groups.append('pedidos_urgentes')
        elif '/mesa/' in path:
            mesa_id = self.scope['url_route']['kwargs'].get('mesa_id')
            if mesa_id:
                self.room_groups.append(f'mesa_{mesa_id}')

        # Unirse a grupos
        for group_name in self.room_groups:
            await self.channel_layer.group_add(group_name, self.channel_name)

        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'groups': self.room_groups,
            'message': 'Conectado a notificaciones en tiempo real'
        }))

    async def disconnect(self, close_code):
        for group_name in self.room_groups:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive(self, text_data):
        # Opcional: ping/pong para keep-alive
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    # Handlers para eventos
    async def pedido_creado(self, event):
        await self.send(text_data=json.dumps(event['data']))

    async def pedido_actualizado(self, event):
        await self.send(text_data=json.dumps(event['data']))

    async def pedido_cancelado(self, event):
        await self.send(text_data=json.dumps(event['data']))
