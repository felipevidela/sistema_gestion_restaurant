import django_filters
from django.utils import timezone
from datetime import timedelta
from .models import Pedido


class PedidoFilter(django_filters.FilterSet):
    # Existentes
    fecha = django_filters.DateFilter(field_name='fecha_creacion__date')
    fecha_desde = django_filters.DateFilter(field_name='fecha_creacion__date', lookup_expr='gte')
    fecha_hasta = django_filters.DateFilter(field_name='fecha_creacion__date', lookup_expr='lte')

    # NUEVO: Rango horario (fecha + hora)
    fecha_hora_desde = django_filters.DateTimeFilter(field_name='fecha_creacion', lookup_expr='gte')
    fecha_hora_hasta = django_filters.DateTimeFilter(field_name='fecha_creacion', lookup_expr='lte')

    # NUEVO: Últimas N horas
    ultimas_horas = django_filters.NumberFilter(method='filter_ultimas_horas')

    # NUEVO: Filtros por fecha_listo
    fecha_listo_desde = django_filters.DateTimeFilter(field_name='fecha_listo', lookup_expr='gte')
    fecha_listo_hasta = django_filters.DateTimeFilter(field_name='fecha_listo', lookup_expr='lte')

    id_pedido = django_filters.NumberFilter(field_name='id', lookup_expr='exact')

    class Meta:
        model = Pedido
        fields = ['estado', 'mesa', 'cliente']

    def filter_ultimas_horas(self, queryset, name, value):
        """Filtra pedidos creados en las últimas N horas."""
        if not value:
            return queryset
        limite = timezone.now() - timedelta(hours=value)
        return queryset.filter(fecha_creacion__gte=limite)
