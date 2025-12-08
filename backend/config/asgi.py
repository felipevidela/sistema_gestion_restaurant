"""
ASGI config for ReservaProject project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Inicializar Django ASGI application primero (antes de importar consumers)
django_asgi_app = get_asgi_application()

# Importar después de configurar settings para evitar AppRegistryNotReady
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from cocinaApp.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    # HTTP requests manejados por Django
    "http": django_asgi_app,
    # WebSocket requests con autenticación
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
