from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class EstadoPedido(models.TextChoices):
    """Estados posibles de un pedido"""
    CREADO = 'CREADO', 'Creado'
    URGENTE = 'URGENTE', 'Urgente'
    EN_PREPARACION = 'EN_PREPARACION', 'En preparación'
    LISTO = 'LISTO', 'Listo'
    ENTREGADO = 'ENTREGADO', 'Entregado'
    CANCELADO = 'CANCELADO', 'Cancelado'


# Transiciones válidas de estado (constante centralizada)
TRANSICIONES_VALIDAS = {
    'CREADO': ['EN_PREPARACION', 'URGENTE', 'CANCELADO'],
    'URGENTE': ['EN_PREPARACION', 'CANCELADO'],
    'EN_PREPARACION': ['LISTO', 'CANCELADO'],
    'LISTO': ['ENTREGADO', 'CANCELADO'],
    'ENTREGADO': [],  # Estado final
    'CANCELADO': [],  # Estado final
}


class Pedido(models.Model):
    """Pedido de cocina asociado a una mesa y opcionalmente a una reserva"""
    # FKs a modelos existentes
    mesa = models.ForeignKey(
        'mainApp.Mesa',
        on_delete=models.PROTECT,
        related_name='pedidos'
    )
    reserva = models.ForeignKey(
        'mainApp.Reserva',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos'
    )
    cliente = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos'
    )
    # Estado
    estado = models.CharField(
        max_length=20,
        choices=EstadoPedido.choices,
        default=EstadoPedido.CREADO
    )
    notas = models.TextField(blank=True, max_length=500)
    # Timestamps
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    # Timestamps de transiciones de estado
    fecha_listo = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha y hora cuando el pedido pasó a estado LISTO"
    )
    fecha_entregado = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha y hora cuando el pedido fue entregado"
    )

    def puede_transicionar_a(self, nuevo_estado):
        """Verifica si la transición de estado es válida"""
        return nuevo_estado in TRANSICIONES_VALIDAS.get(self.estado, [])

    @property
    def total(self):
        """Calcula el total del pedido"""
        return sum(detalle.subtotal for detalle in self.detalles.all())

    def __str__(self):
        return f"Pedido #{self.id} - Mesa {self.mesa.numero} - {self.get_estado_display()}"

    class Meta:
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering = ['-fecha_creacion']
        indexes = [
            models.Index(fields=['estado', 'fecha_creacion']),
            models.Index(fields=['mesa', 'estado']),
            models.Index(fields=['fecha_listo']),
            models.Index(fields=['fecha_entregado']),
            models.Index(fields=['estado', 'fecha_listo']),
        ]


class DetallePedido(models.Model):
    """Detalle de un pedido (plato + cantidad)"""
    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    plato = models.ForeignKey(
        'menuApp.Plato',
        on_delete=models.PROTECT
    )
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Precio al momento de crear el pedido (snapshot)"
    )
    notas_especiales = models.TextField(blank=True, max_length=200)

    @property
    def subtotal(self):
        """Calcula el subtotal del detalle"""
        return self.precio_unitario * self.cantidad

    def __str__(self):
        return f"{self.cantidad}x {self.plato.nombre} - Pedido #{self.pedido.id}"

    class Meta:
        verbose_name = "Detalle de Pedido"
        verbose_name_plural = "Detalles de Pedido"
        ordering = ['id']
