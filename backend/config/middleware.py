"""
Middleware custom para autenticación WebSocket con DRF Token
"""
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user_from_token(token_key):
    """
    Obtener usuario desde token de DRF (authtoken_token table)
    """
    try:
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """
    Middleware para autenticar WebSocket connections con DRF Token.
    Lee token desde query string: ws://host/path/?token=abc123
    """

    async def __call__(self, scope, receive, send):
        # Solo procesar WebSocket connections
        if scope['type'] != 'websocket':
            return await super().__call__(scope, receive, send)

        # Extraer token del query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token_key = query_params.get('token', [None])[0]

        print(f"[TokenAuthMiddleware] Query string: {query_string}")
        print(f"[TokenAuthMiddleware] Token extraído: {token_key[:10] if token_key else None}...")

        # Autenticar con token
        if token_key:
            scope['user'] = await get_user_from_token(token_key)
            print(f"[TokenAuthMiddleware] Usuario obtenido: {scope['user']}")
        else:
            scope['user'] = AnonymousUser()
            print(f"[TokenAuthMiddleware] No se encontró token, asignando AnonymousUser")

        return await super().__call__(scope, receive, send)
