from django.contrib import admin
from django.urls import path, include

from rest_framework.routers import DefaultRouter
from rest_framework.authtoken import views as authtoken_views
from mainApp import views

# Configurar el router para ViewSets
router = DefaultRouter()
router.register(r'api/mesas', views.MesaViewSet, basename='mesa')
router.register(r'api/reservas', views.ReservaViewSet, basename='reserva')

urlpatterns = [
    # Panel de administración de Django
    path('admin/', admin.site.urls),

    # Endpoints de autenticación
    path('api/register/', views.register_user, name='register'),
    path('api/login/', views.login_user, name='login'),
    path('api/perfil/', views.get_perfil, name='perfil'),
    path('api/get-token/', authtoken_views.obtain_auth_token, name='get-token'),

    # Endpoints de gestión de usuarios (Admin)
    path('api/usuarios/', views.listar_usuarios, name='listar-usuarios'),
    path('api/usuarios/<int:user_id>/cambiar-rol/', views.cambiar_rol_usuario, name='cambiar-rol-usuario'),

    # Endpoints personalizados
    path('api/consultar-mesas/', views.ConsultaMesasView.as_view(), name='consultar-mesas'),

    # Incluir las rutas generadas por el router (mesas y reservas)
    path('', include(router.urls)),
]
