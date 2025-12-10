from channels.db import database_sync_to_async
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import AnonymousUser
import logging

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token_key):
    """Obtiene usuario desde token de autenticación.

    IMPORTANTE: Esta función usa database_sync_to_async para
    ejecutar queries de forma segura en contexto async.
    """
    if not token_key:
        return AnonymousUser()
    try:
        token = Token.objects.select_related('user').get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        logger.warning("Token de WebSocket inválido (no existe)")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"Error validando token WebSocket: {e}")
        return AnonymousUser()
