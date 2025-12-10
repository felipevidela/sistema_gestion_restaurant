import asyncio
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from config.websocket_auth import get_user_from_token

logger = logging.getLogger(__name__)


class CocinaConsumer(AsyncWebsocketConsumer):
    """Consumer WebSocket para notificaciones de cocina en tiempo real"""

    async def connect(self):
        """Acepta conexión y espera autenticación."""
        await self.accept()
        self.authenticated = False
        self.auth_timeout_task = asyncio.create_task(self._auth_timeout())
        logger.info("WebSocket cocina: conexión aceptada, esperando autenticación")

    async def _auth_timeout(self):
        """Desconecta si no autentica en 10 segundos."""
        try:
            await asyncio.sleep(10)
            if not self.authenticated:
                logger.warning("WebSocket cocina: timeout de autenticación")
                await self.send(text_data=json.dumps({
                    'type': 'auth_failed',
                    'reason': 'timeout'
                }))
                await self.close(code=4001)  # 4001 = Auth timeout
        except asyncio.CancelledError:
            pass  # Cancelado porque se autenticó exitosamente

    async def disconnect(self, close_code):
        """Limpia recursos al desconectar."""
        # Cancelar timeout si está pendiente
        if hasattr(self, 'auth_timeout_task') and not self.auth_timeout_task.done():
            self.auth_timeout_task.cancel()

        # Remover de grupos si estaba autenticado
        if hasattr(self, 'authenticated') and self.authenticated:
            await self._cleanup_groups()

        logger.info(f"WebSocket cocina: desconectado (code={close_code})")

    async def receive(self, text_data):
        """Procesa mensajes entrantes."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            logger.warning("WebSocket cocina: JSON inválido recibido")
            return

        # Primer mensaje debe ser autenticación
        if not self.authenticated:
            if data.get('type') == 'authenticate':
                token = data.get('token')
                user = await get_user_from_token(token)

                if user.is_authenticated:
                    self.scope['user'] = user
                    self.authenticated = True

                    # Cancelar timeout
                    if not self.auth_timeout_task.done():
                        self.auth_timeout_task.cancel()

                    # Configurar grupos según rol
                    await self._setup_groups()

                    # Confirmar autenticación
                    await self.send(text_data=json.dumps({
                        'type': 'authenticated',
                        'user': user.username
                    }))
                    logger.info(f"WebSocket cocina: autenticado como {user.username}")
                else:
                    # Token inválido
                    await self.send(text_data=json.dumps({
                        'type': 'auth_failed',
                        'reason': 'invalid_token'
                    }))
                    await self.close(code=4002)  # 4002 = Auth failed
            else:
                # Mensaje no es de autenticación
                await self.send(text_data=json.dumps({
                    'type': 'auth_required',
                    'message': 'Envía {type: "authenticate", token: "..."} primero'
                }))
            return

        # Usuario autenticado - procesar mensajes normales
        await self._handle_authenticated_message(data)

    async def _setup_groups(self):
        """Configura grupos según el rol del usuario."""
        user = self.scope['user']
        perfil = await self._get_perfil(user)

        self.user_groups = []

        if perfil and perfil.rol in ['admin', 'cajero', 'mesero']:
            await self.channel_layer.group_add('cocina_cola', self.channel_name)
            self.user_groups.append('cocina_cola')

        if perfil and perfil.rol == 'admin':
            await self.channel_layer.group_add('cocina_admin', self.channel_name)
            self.user_groups.append('cocina_admin')

    async def _cleanup_groups(self):
        """Remueve al usuario de todos los grupos."""
        for group_name in getattr(self, 'user_groups', []):
            await self.channel_layer.group_discard(group_name, self.channel_name)

    @database_sync_to_async
    def _get_perfil(self, user):
        """Obtiene perfil del usuario de forma async-safe."""
        try:
            return user.perfil
        except Exception:
            return None

    async def _handle_authenticated_message(self, data):
        """Procesa mensajes de usuarios autenticados."""
        # Ping/pong para mantener conexión activa
        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    # Handlers para eventos de grupo (notificaciones desde el backend)

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
