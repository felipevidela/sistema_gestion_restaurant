from django.contrib import admin
from .models import CategoriaMenu, Ingrediente, Plato, Receta


@admin.register(CategoriaMenu)
class CategoriaMenuAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activa', 'orden']
    list_filter = ['activa']
    search_fields = ['nombre']
    ordering = ['orden', 'nombre']


@admin.register(Ingrediente)
class IngredienteAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'unidad_medida', 'cantidad_disponible', 'stock_minimo', 'bajo_stock', 'activo']
    list_filter = ['activo', 'unidad_medida']
    search_fields = ['nombre']
    ordering = ['nombre']

    def bajo_stock(self, obj):
        return obj.bajo_stock
    bajo_stock.boolean = True
    bajo_stock.short_description = 'Bajo Stock'


@admin.register(Plato)
class PlatoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'categoria', 'precio', 'disponible', 'activo', 'tiempo_preparacion']
    list_filter = ['categoria', 'disponible', 'activo']
    search_fields = ['nombre', 'descripcion']
    ordering = ['categoria__orden', 'nombre']


@admin.register(Receta)
class RecetaAdmin(admin.ModelAdmin):
    list_display = ['plato', 'ingrediente', 'cantidad_requerida']
    list_filter = ['plato__categoria']
    search_fields = ['plato__nombre', 'ingrediente__nombre']
    autocomplete_fields = ['plato', 'ingrediente']
