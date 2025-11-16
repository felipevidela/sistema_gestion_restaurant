from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings

from rest_framework.routers import DefaultRouter
from rest_framework.authtoken import views as authtoken_views
from mainApp import views

# Configurar el router para ViewSets
router = DefaultRouter()
router.register(r'mesas', views.MesaViewSet, basename='mesa')
router.register(r'reservas', views.ReservaViewSet, basename='reserva')

urlpatterns = [
    # Panel de administración de Django
    path('admin/', admin.site.urls),

    # Endpoints de autenticación
    path('api/register/', views.register_user, name='register'),
    path('api/register-and-reserve/', views.register_and_reserve, name='register-and-reserve'),
    path('api/login/', views.login_user, name='login'),
    path('api/perfil/', views.get_perfil, name='perfil'),
    path('api/perfil/actualizar/', views.update_perfil, name='actualizar-perfil'),
    path('api/get-token/', authtoken_views.obtain_auth_token, name='get-token'),

    # Endpoints de gestión de usuarios (Admin)
    path('api/usuarios/', views.listar_usuarios, name='listar-usuarios'),
    path('api/usuarios/<int:user_id>/cambiar-rol/', views.cambiar_rol_usuario, name='cambiar-rol-usuario'),

    # Endpoints personalizados
    path('api/consultar-mesas/', views.ConsultaMesasView.as_view(), name='consultar-mesas'),
    path('api/horas-disponibles/', views.ConsultarHorasDisponiblesView.as_view(), name='horas-disponibles'),

    # Incluir las rutas generadas por el router (mesas y reservas)
    path('api/', include(router.urls)),

    # Servir el frontend React (catch-all - debe ir al FINAL)
    # Captura todas las rutas que no sean API, admin o static
    # WhiteNoise intercepta /static/ antes de que llegue aquí
    re_path(r'^(?!api/|admin/|static/).*$', TemplateView.as_view(template_name='index.html'), name='frontend'),
]
