from rest_framework import serializers
from .models import CategoriaMenu, Ingrediente, Plato, Receta


class CategoriaMenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaMenu
        fields = ['id', 'nombre', 'descripcion', 'activa', 'orden']


class IngredienteSerializer(serializers.ModelSerializer):
    bajo_stock = serializers.ReadOnlyField()

    class Meta:
        model = Ingrediente
        fields = [
            'id', 'nombre', 'descripcion', 'unidad_medida',
            'cantidad_disponible', 'stock_minimo', 'precio_unitario',
            'activo', 'bajo_stock', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class RecetaSerializer(serializers.ModelSerializer):
    ingrediente_nombre = serializers.CharField(source='ingrediente.nombre', read_only=True)
    unidad_medida = serializers.CharField(source='ingrediente.unidad_medida', read_only=True)

    class Meta:
        model = Receta
        fields = ['id', 'ingrediente', 'ingrediente_nombre', 'unidad_medida', 'cantidad_requerida']


class PlatoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    recetas = RecetaSerializer(many=True, read_only=True)

    class Meta:
        model = Plato
        fields = [
            'id', 'nombre', 'descripcion', 'precio', 'categoria',
            'categoria_nombre', 'disponible', 'imagen',
            'tiempo_preparacion', 'activo', 'recetas',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PlatoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados"""
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)

    class Meta:
        model = Plato
        fields = ['id', 'nombre', 'precio', 'categoria', 'categoria_nombre', 'disponible', 'imagen', 'tiempo_preparacion', 'descripcion']
