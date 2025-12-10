from django.db import models


class CategoriaMenu(models.Model):
    """Categoría de platos del menú"""
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    activa = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0, help_text="Orden de aparición en el menú")

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Categoría de Menú"
        verbose_name_plural = "Categorías de Menú"
        ordering = ['orden', 'nombre']


class Ingrediente(models.Model):
    """Ingrediente con datos fijos + stock (modelo simplificado)"""
    UNIDADES = [
        ('gr', 'Gramos'),
        ('kg', 'Kilogramos'),
        ('un', 'Unidades'),
        ('lt', 'Litros'),
        ('ml', 'Mililitros'),
    ]

    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    unidad_medida = models.CharField(max_length=20, choices=UNIDADES, default='un')
    # Stock
    cantidad_disponible = models.DecimalField(
        max_digits=10, decimal_places=3, default=0,
        help_text="Cantidad disponible en inventario"
    )
    stock_minimo = models.DecimalField(
        max_digits=10, decimal_places=3, default=0,
        help_text="Cantidad mínima antes de alerta"
    )
    # Costo
    precio_unitario = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Precio de compra por unidad"
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def bajo_stock(self):
        """Retorna True si el stock está bajo el mínimo"""
        return self.cantidad_disponible < self.stock_minimo

    def __str__(self):
        return f"{self.nombre} ({self.get_unidad_medida_display()})"

    class Meta:
        verbose_name = "Ingrediente"
        verbose_name_plural = "Ingredientes"
        ordering = ['nombre']


class Plato(models.Model):
    """Plato del menú"""
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    categoria = models.ForeignKey(
        CategoriaMenu,
        on_delete=models.PROTECT,
        related_name='platos'
    )
    disponible = models.BooleanField(default=True)
    imagen = models.ImageField(upload_to='platos/', blank=True, null=True)
    tiempo_preparacion = models.PositiveIntegerField(
        default=15,
        help_text="Tiempo estimado de preparación en minutos"
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def verificar_disponibilidad(self):
        """Verifica si todos los ingredientes tienen stock suficiente"""
        # Optimización: usar select_related para evitar N+1 queries
        recetas = self.recetas.select_related('ingrediente')
        for receta in recetas:
            if receta.ingrediente.cantidad_disponible < receta.cantidad_requerida:
                return False
        return True

    def __str__(self):
        return f"{self.nombre} - ${self.precio}"

    class Meta:
        verbose_name = "Plato"
        verbose_name_plural = "Platos"
        ordering = ['categoria__orden', 'nombre']


class Receta(models.Model):
    """Relación M2M entre Plato e Ingrediente con cantidad requerida"""
    plato = models.ForeignKey(
        Plato,
        on_delete=models.CASCADE,
        related_name='recetas'
    )
    ingrediente = models.ForeignKey(
        Ingrediente,
        on_delete=models.PROTECT,
        related_name='recetas'
    )
    cantidad_requerida = models.DecimalField(
        max_digits=10, decimal_places=3,
        help_text="Cantidad de ingrediente necesaria para preparar el plato"
    )

    def __str__(self):
        return f"{self.plato.nombre} - {self.ingrediente.nombre}: {self.cantidad_requerida}"

    class Meta:
        verbose_name = "Receta"
        verbose_name_plural = "Recetas"
        unique_together = ['plato', 'ingrediente']
