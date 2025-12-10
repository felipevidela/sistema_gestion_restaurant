"""
ASGI config for Sistema de Gestión de Restaurant.

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
from channels.security.websocket import AllowedHostsOriginValidator
from cocinaApp.routing import websocket_urlpatterns

# =============================================================================
# CONFIGURACIÓN DE WEBSOCKET SECURITY
# =============================================================================
# Actualmente usamos AllowedHostsOriginValidator sin AuthMiddlewareStack porque:
# 1. Solo existe CocinaConsumer, que autentica via token en mensaje inicial
# 2. AuthMiddlewareStack no soporta tokens de forma segura (solo sesión/cookie)
#
# SI EN EL FUTURO se agregan consumers que requieran auth por sesión/cookie,
# reintroducir AuthMiddlewareStack así:
#
# from channels.auth import AuthMiddlewareStack
# from channels.security.websocket import AllowedHostsOriginValidator
#
# application = ProtocolTypeRouter({
#     "http": django_asgi_app,
#     "websocket": AllowedHostsOriginValidator(
#         AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
#     ),
# })
# =============================================================================

application = ProtocolTypeRouter({
    # HTTP requests manejados por Django
    "http": django_asgi_app,
    # WebSocket con validación de origen (auth se hace en el consumer)
    "websocket": AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})
