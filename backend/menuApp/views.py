from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models

from .models import CategoriaMenu, Ingrediente, Plato, Receta
from .serializers import (
    CategoriaMenuSerializer,
    IngredienteSerializer,
    PlatoSerializer,
    PlatoListSerializer,
    RecetaSerializer
)
from .filters import IngredienteFilter, PlatoFilter
from mainApp.permissions import IsAdministrador


class CategoriaMenuViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de categorías del menú"""
    queryset = CategoriaMenu.objects.all()
    serializer_class = CategoriaMenuSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['activa']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticatedOrReadOnly()]
        return [IsAuthenticated(), IsAdministrador()]


class IngredienteViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de ingredientes e inventario"""
    queryset = Ingrediente.objects.all()
    serializer_class = IngredienteSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = IngredienteFilter

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdministrador()]

    @action(detail=False, methods=['get'])
    def bajo_minimo(self, request):
        """Retorna ingredientes con stock bajo el mínimo"""
        ingredientes = self.queryset.filter(
            cantidad_disponible__lt=models.F('stock_minimo'),
            activo=True
        )
        serializer = self.get_serializer(ingredientes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def ajustar_stock(self, request, pk=None):
        """Ajusta el stock de un ingrediente (suma o resta)"""
        ingrediente = self.get_object()
        cantidad = request.data.get('cantidad')

        if cantidad is None:
            return Response(
                {'error': 'Se requiere el campo cantidad'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cantidad = float(cantidad)
        except (ValueError, TypeError):
            return Response(
                {'error': 'La cantidad debe ser un número'},
                status=status.HTTP_400_BAD_REQUEST
            )

        nueva_cantidad = float(ingrediente.cantidad_disponible) + cantidad
        if nueva_cantidad < 0:
            return Response(
                {'error': 'El stock no puede ser negativo'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ingrediente.cantidad_disponible = nueva_cantidad
        ingrediente.save()

        serializer = self.get_serializer(ingrediente)
        return Response(serializer.data)


class PlatoViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de platos del menú"""
    queryset = Plato.objects.select_related('categoria').prefetch_related('recetas__ingrediente')
    filter_backends = [DjangoFilterBackend]
    filterset_class = PlatoFilter

    def get_serializer_class(self):
        if self.action == 'list':
            return PlatoListSerializer
        return PlatoSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'disponibilidad']:
            return [IsAuthenticatedOrReadOnly()]
        return [IsAuthenticated(), IsAdministrador()]

    @action(detail=True, methods=['get', 'post'])
    def receta(self, request, pk=None):
        """Ver o añadir ingredientes a la receta del plato"""
        plato = self.get_object()

        if request.method == 'GET':
            recetas = plato.recetas.all()
            serializer = RecetaSerializer(recetas, many=True)
            return Response(serializer.data)

        # POST - añadir ingrediente a la receta
        serializer = RecetaSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(plato=plato)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def disponibilidad(self, request):
        """Retorna platos disponibles según stock actual"""
        platos_disponibles = []
        for plato in self.queryset.filter(activo=True, disponible=True):
            if plato.verificar_disponibilidad():
                platos_disponibles.append(plato)

        serializer = PlatoListSerializer(platos_disponibles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def verificar(self, request, pk=None):
        """Verifica y actualiza la disponibilidad de un plato"""
        plato = self.get_object()
        plato.disponible = plato.verificar_disponibilidad()
        plato.save(update_fields=['disponible'])

        return Response({
            'plato': plato.nombre,
            'disponible': plato.disponible
        })
