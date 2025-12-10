"""
Factories para tests de cocinaApp usando factory_boy.

Proporciona factories para crear objetos de prueba de manera fácil y consistente:
- Ingredientes y Platos (menuApp)
- Pedidos y Detalles
- Cancelaciones con auditoría completa
"""
import factory
from factory.django import DjangoModelFactory
from decimal import Decimal

from cocinaApp.models import Pedido, DetallePedido, PedidoCancelacion
from menuApp.models import Plato, Ingrediente, Receta, CategoriaMenu


# ======================================================================
# MENU APP FACTORIES
# ======================================================================

class CategoriaMenuFactory(DjangoModelFactory):
    """Factory para CategoriaMenu"""
    class Meta:
        model = CategoriaMenu

    nombre = factory.Sequence(lambda n: f'Categoría {n}')
    descripcion = factory.Faker('sentence')
    activa = True
    orden = factory.Sequence(lambda n: n)


class IngredienteFactory(DjangoModelFactory):
    """Factory para Ingrediente con stock"""
    class Meta:
        model = Ingrediente

    nombre = factory.Sequence(lambda n: f'Ingrediente {n}')
    descripcion = factory.Faker('sentence', nb_words=5)
    unidad_medida = 'gr'
    cantidad_disponible = 1000
    stock_minimo = 100
    precio_unitario = factory.Faker('pydecimal', left_digits=4, right_digits=2, positive=True)
    activo = True


class PlatoFactory(DjangoModelFactory):
    """Factory para Plato"""
    class Meta:
        model = Plato

    nombre = factory.Sequence(lambda n: f'Plato {n}')
    descripcion = factory.Faker('sentence', nb_words=10)
    precio = factory.Faker('pydecimal', left_digits=5, right_digits=2, positive=True, min_value=Decimal('1000'))
    categoria = factory.SubFactory(CategoriaMenuFactory)
    disponible = True
    activo = True
    tiempo_preparacion = 15
    imagen = None


class RecetaFactory(DjangoModelFactory):
    """Factory para Receta (relación Plato-Ingrediente)"""
    class Meta:
        model = Receta

    plato = factory.SubFactory(PlatoFactory)
    ingrediente = factory.SubFactory(IngredienteFactory)
    cantidad_requerida = 100


# ======================================================================
# COCINA APP FACTORIES
# ======================================================================

class PedidoFactory(DjangoModelFactory):
    """Factory base para Pedido"""
    class Meta:
        model = Pedido

    mesa = factory.SubFactory('mainApp.tests.factories.MesaFactory')
    cliente = factory.SubFactory('mainApp.tests.factories.UserFactory')
    reserva = None
    estado = 'CREADO'
    notas = ''


class DetallePedidoFactory(DjangoModelFactory):
    """Factory para DetallePedido"""
    class Meta:
        model = DetallePedido

    pedido = factory.SubFactory(PedidoFactory)
    plato = factory.SubFactory(PlatoFactory)
    cantidad = 2
    precio_unitario = factory.LazyAttribute(lambda obj: obj.plato.precio)
    notas_especiales = ''


class PedidoCancelacionFactory(DjangoModelFactory):
    """Factory para PedidoCancelacion con auditoría completa"""
    class Meta:
        model = PedidoCancelacion

    pedido = factory.SubFactory(PedidoFactory, estado='CANCELADO')
    cancelado_por = factory.SubFactory('mainApp.tests.factories.UserFactory')
    motivo = factory.Faker('sentence', nb_words=20)  # ≥10 caracteres
    mesa_numero = factory.LazyAttribute(lambda obj: obj.pedido.mesa.numero)
    cliente_nombre = factory.LazyAttribute(
        lambda obj: (
            obj.pedido.cliente.perfil.nombre_completo
            if obj.pedido.cliente and hasattr(obj.pedido.cliente, 'perfil')
            else ''
        )
    )
    total_pedido = factory.LazyAttribute(lambda obj: obj.pedido.total if hasattr(obj.pedido, 'total') else Decimal('0.00'))
    productos_resumen = '2x Plato Ejemplo, 1x Ensalada'
    productos_detalle = factory.LazyAttribute(
        lambda obj: [
            {
                'plato_id': 1,
                'plato_nombre': 'Plato Ejemplo',
                'cantidad': 2,
                'precio_unitario': 10000.00,
                'subtotal': 20000.00
            }
        ]
    )


# ======================================================================
# FACTORIES ESPECIALIZADAS POR ESTADO
# ======================================================================

class PedidoCreadoFactory(PedidoFactory):
    """Pedido en estado CREADO"""
    estado = 'CREADO'


class PedidoUrgenteFactory(PedidoFactory):
    """Pedido en estado URGENTE"""
    estado = 'URGENTE'


class PedidoEnPreparacionFactory(PedidoFactory):
    """Pedido en estado EN_PREPARACION"""
    estado = 'EN_PREPARACION'


class PedidoListoFactory(PedidoFactory):
    """Pedido en estado LISTO"""
    estado = 'LISTO'


class PedidoEntregadoFactory(PedidoFactory):
    """Pedido en estado ENTREGADO"""
    estado = 'ENTREGADO'


class PedidoCanceladoFactory(PedidoFactory):
    """Pedido en estado CANCELADO (sin auditoría)"""
    estado = 'CANCELADO'


# ======================================================================
# FACTORIES COMPLEJAS
# ======================================================================

class PedidoConDetallesFactory(PedidoFactory):
    """
    Pedido completo con detalles de pedido.

    Uso:
        # Con 2 detalles por defecto
        pedido = PedidoConDetallesFactory()

        # Con detalles específicos
        pedido = PedidoConDetallesFactory(
            detalles=[
                {'plato': plato1, 'cantidad': 2},
                {'plato': plato2, 'cantidad': 1}
            ]
        )
    """

    @factory.post_generation
    def detalles(self, create, extracted, **kwargs):
        if not create:
            return

        if extracted:
            # Detalles personalizados
            for detalle_data in extracted:
                DetallePedidoFactory(pedido=self, **detalle_data)
        else:
            # Por defecto crear 2 detalles
            DetallePedidoFactory.create_batch(2, pedido=self)


class PlatoConRecetaFactory(PlatoFactory):
    """
    Plato con receta (ingredientes).

    Uso:
        # Con 1 ingrediente por defecto
        plato = PlatoConRecetaFactory()

        # Con ingredientes específicos
        plato = PlatoConRecetaFactory(
            ingredientes=[
                {'ingrediente': ing1, 'cantidad_requerida': 100},
                {'ingrediente': ing2, 'cantidad_requerida': 50}
            ]
        )
    """

    @factory.post_generation
    def ingredientes(self, create, extracted, **kwargs):
        if not create:
            return

        if extracted:
            # Ingredientes personalizados
            for ingrediente_data in extracted:
                RecetaFactory(plato=self, **ingrediente_data)
        else:
            # Por defecto crear 1 ingrediente
            RecetaFactory(plato=self)
