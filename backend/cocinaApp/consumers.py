import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class CocinaConsumer(AsyncWebsocketConsumer):
    """Consumer WebSocket para notificaciones de cocina en tiempo real"""

    async def connect(self):
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close()
            return

        # Obtener rol del perfil
        perfil = await self._get_perfil(user)
        if not perfil:
            await self.close()
            return

        self.user_groups = []

        # Asignar a grupos según rol
        if perfil.rol in ['admin', 'cajero', 'cocinero']:
            await self.channel_layer.group_add('cocina_cola', self.channel_name)
            self.user_groups.append('cocina_cola')
        elif perfil.rol == 'mesero':
            group_name = f'mesero_{user.id}'
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.user_groups.append(group_name)

        await self.accept()

    async def disconnect(self, close_code):
        # Remover de todos los grupos
        for group in getattr(self, 'user_groups', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data):
        """Recibir mensaje del cliente (opcional, para ping/pong)"""
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    async def pedido_actualizado(self, event):
        """Handler para eventos de pedido actualizado"""
        await self.send(text_data=json.dumps({
            'type': 'pedido_actualizado',
            'data': event['data']
        }))

    async def pedido_creado(self, event):
        """Handler para eventos de pedido nuevo"""
        await self.send(text_data=json.dumps({
            'type': 'pedido_creado',
            'data': event['data']
        }))

    @database_sync_to_async
    def _get_perfil(self, user):
        try:
            return user.perfil
        except Exception:
            return None
