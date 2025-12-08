import django_filters
from django.db import models
from .models import Ingrediente, Plato


class IngredienteFilter(django_filters.FilterSet):
    bajo_stock = django_filters.BooleanFilter(method='filter_bajo_stock')

    class Meta:
        model = Ingrediente
        fields = ['activo', 'unidad_medida']

    def filter_bajo_stock(self, queryset, name, value):
        if value:
            return queryset.filter(cantidad_disponible__lt=models.F('stock_minimo'))
        return queryset


class PlatoFilter(django_filters.FilterSet):
    precio_min = django_filters.NumberFilter(field_name='precio', lookup_expr='gte')
    precio_max = django_filters.NumberFilter(field_name='precio', lookup_expr='lte')

    class Meta:
        model = Plato
        fields = ['disponible', 'categoria', 'activo']
