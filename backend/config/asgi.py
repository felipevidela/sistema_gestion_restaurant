"""
ASGI config - Soporta HTTP y WebSocket con autenticación DRF Token
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Inicializar Django ASGI primero (CRÍTICO: antes de imports de apps)
django_asgi_app = get_asgi_application()

# Importar DESPUÉS de inicializar Django
from config.routing import websocket_urlpatterns
from config.middleware import TokenAuthMiddleware

# Orígenes permitidos para WebSocket (con protocolo)
ALLOWED_ORIGINS = [
    'https://sistema-gestion-restaurant.up.railway.app',
    'https://moduloreservas-production.up.railway.app',
    'http://localhost:5173',  # Desarrollo frontend
    'http://localhost:8000',  # Desarrollo backend
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": OriginValidator(
        TokenAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        ),
        ALLOWED_ORIGINS
    ),
})
