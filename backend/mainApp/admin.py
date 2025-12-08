from django.contrib import admin
from .models import Perfil, Mesa, Reserva


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ('user', 'rol', 'nombre_completo', 'email')
    list_filter = ('rol',)
    search_fields = ('user__username', 'nombre_completo', 'email')


@admin.register(Mesa)
class MesaAdmin(admin.ModelAdmin):
    list_display = ('numero', 'capacidad', 'estado')
    list_filter = ('estado',)
    search_fields = ('numero',)
    ordering = ('numero',)


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'mesa', 'fecha_reserva', 'hora_inicio', 'hora_fin', 'num_personas', 'estado')
    list_filter = ('estado', 'fecha_reserva')
    search_fields = ('cliente__username', 'mesa__numero')
    ordering = ('-fecha_reserva', '-hora_inicio')
    date_hierarchy = 'fecha_reserva' 
