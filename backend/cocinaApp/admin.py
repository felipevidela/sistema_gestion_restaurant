from django.contrib import admin
from .models import Pedido, DetallePedido


class DetallePedidoInline(admin.TabularInline):
    model = DetallePedido
    extra = 0
    readonly_fields = ['subtotal']
    autocomplete_fields = ['plato']


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ['id', 'mesa', 'estado', 'total', 'fecha_creacion', 'cliente']
    list_filter = ['estado', 'fecha_creacion', 'mesa']
    search_fields = ['id', 'mesa__numero', 'cliente__username']
    ordering = ['-fecha_creacion']
    inlines = [DetallePedidoInline]
    readonly_fields = ['fecha_creacion', 'fecha_actualizacion', 'total']

    def total(self, obj):
        return f"${obj.total}"
    total.short_description = 'Total'


@admin.register(DetallePedido)
class DetallePedidoAdmin(admin.ModelAdmin):
    list_display = ['pedido', 'plato', 'cantidad', 'precio_unitario', 'subtotal']
    list_filter = ['pedido__estado']
    search_fields = ['plato__nombre', 'pedido__id']
    autocomplete_fields = ['pedido', 'plato']
