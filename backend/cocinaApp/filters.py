import django_filters
from .models import Pedido


class PedidoFilter(django_filters.FilterSet):
    fecha = django_filters.DateFilter(field_name='fecha_creacion__date')
    fecha_desde = django_filters.DateFilter(field_name='fecha_creacion__date', lookup_expr='gte')
    fecha_hasta = django_filters.DateFilter(field_name='fecha_creacion__date', lookup_expr='lte')

    class Meta:
        model = Pedido
        fields = ['estado', 'mesa', 'cliente']
