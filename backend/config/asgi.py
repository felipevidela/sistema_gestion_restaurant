"""
ASGI config - Soporta HTTP y WebSocket con autenticación DRF Token
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Inicializar Django ASGI primero (CRÍTICO: antes de imports de apps)
django_asgi_app = get_asgi_application()

# Importar DESPUÉS de inicializar Django
from config.routing import websocket_urlpatterns
from config.middleware import TokenAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        TokenAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
