from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaMenuViewSet, IngredienteViewSet, PlatoViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaMenuViewSet, basename='categoria')
router.register(r'ingredientes', IngredienteViewSet, basename='ingrediente')
router.register(r'platos', PlatoViewSet, basename='plato')

urlpatterns = [
    path('', include(router.urls)),
]
