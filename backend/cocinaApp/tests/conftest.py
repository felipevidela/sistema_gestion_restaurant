"""
Fixtures de pytest para tests de cocinaApp.

Proporciona fixtures reutilizables para tests de pedidos, platos,
ingredientes y cancelaciones.

Las fixtures de mainApp (api_client, usuarios, mesas, etc.) están
disponibles automáticamente desde mainApp/tests/conftest.py.
"""
import pytest

# Importar fixtures de mainApp para que estén disponibles
from mainApp.tests.conftest import (
    api_client, user_cliente, user_admin, user_cajero,
    authenticated_client, admin_client,
    mesa_disponible, mesa_pequena, mesa_grande,
    fecha_futura, fecha_pasada
)

from .factories import (
    # Pedidos
    PedidoFactory, PedidoCreadoFactory, PedidoUrgenteFactory,
    PedidoEnPreparacionFactory, PedidoListoFactory, PedidoCanceladoFactory,
    PedidoConDetallesFactory,
    DetallePedidoFactory,
    # Cancelaciones
    PedidoCancelacionFactory,
    # Platos e Ingredientes
    PlatoFactory, PlatoConRecetaFactory, IngredienteFactory,
    RecetaFactory, CategoriaMenuFactory
)


# ======================================================================
# FIXTURES DE INGREDIENTES
# ======================================================================

@pytest.fixture
def ingrediente_con_stock(db):
    """Ingrediente con stock suficiente (1000 unidades)"""
    return IngredienteFactory(cantidad_disponible=1000, stock_minimo=100)


@pytest.fixture
def ingrediente_sin_stock(db):
    """Ingrediente sin stock"""
    return IngredienteFactory(cantidad_disponible=0, stock_minimo=100)


@pytest.fixture
def ingrediente_bajo_stock(db):
    """Ingrediente con stock bajo (debajo del mínimo)"""
    return IngredienteFactory(cantidad_disponible=50, stock_minimo=100)


# ======================================================================
# FIXTURES DE CATEGORÍAS Y PLATOS
# ======================================================================

@pytest.fixture
def categoria_menu(db):
    """Categoría de menú activa"""
    return CategoriaMenuFactory(nombre='Platos Fuertes', activa=True)


@pytest.fixture
def plato_disponible(db, categoria_menu):
    """Plato disponible sin receta"""
    return PlatoFactory(disponible=True, activo=True, categoria=categoria_menu)


@pytest.fixture
def plato_con_receta(db, plato_disponible, ingrediente_con_stock):
    """Plato disponible con receta (1 ingrediente)"""
    RecetaFactory(
        plato=plato_disponible,
        ingrediente=ingrediente_con_stock,
        cantidad_requerida=100
    )
    return plato_disponible


@pytest.fixture
def plato_sin_stock(db, categoria_menu, ingrediente_sin_stock):
    """Plato que no tiene stock suficiente"""
    plato = PlatoFactory(disponible=False, categoria=categoria_menu)
    RecetaFactory(
        plato=plato,
        ingrediente=ingrediente_sin_stock,
        cantidad_requerida=100
    )
    return plato


# ======================================================================
# FIXTURES DE PEDIDOS
# ======================================================================

@pytest.fixture
def pedido_creado(db, mesa_disponible):
    """Pedido en estado CREADO"""
    return PedidoCreadoFactory(mesa=mesa_disponible)


@pytest.fixture
def pedido_urgente(db, mesa_disponible):
    """Pedido en estado URGENTE"""
    return PedidoUrgenteFactory(mesa=mesa_disponible)


@pytest.fixture
def pedido_en_preparacion(db, mesa_disponible):
    """Pedido en estado EN_PREPARACION"""
    return PedidoEnPreparacionFactory(mesa=mesa_disponible)


@pytest.fixture
def pedido_listo(db, mesa_disponible):
    """Pedido en estado LISTO"""
    return PedidoListoFactory(mesa=mesa_disponible)


@pytest.fixture
def pedido_entregado(db, mesa_disponible):
    """Pedido en estado ENTREGADO"""
    return PedidoEntregadoFactory(mesa=mesa_disponible)


@pytest.fixture
def pedido_con_detalles(db, mesa_disponible, plato_disponible):
    """Pedido con 2 detalles de pedido"""
    pedido = PedidoFactory(mesa=mesa_disponible)
    DetallePedidoFactory.create_batch(2, pedido=pedido, plato=plato_disponible)
    return pedido


@pytest.fixture
def pedido_con_receta_completa(db, mesa_disponible, plato_con_receta):
    """
    Pedido completo con plato que tiene receta.
    Útil para tests de stock.
    """
    pedido = PedidoFactory(mesa=mesa_disponible)
    DetallePedidoFactory(pedido=pedido, plato=plato_con_receta, cantidad=2)
    return pedido


# ======================================================================
# FIXTURES DE CANCELACIONES
# ======================================================================

@pytest.fixture
def pedido_cancelado_sin_auditoria(db, mesa_disponible):
    """Pedido cancelado sin registro de auditoría (legacy)"""
    return PedidoCanceladoFactory(mesa=mesa_disponible)


@pytest.fixture
def pedido_cancelado_con_auditoria(db, mesa_disponible, user_admin):
    """Pedido cancelado con registro de auditoría completo"""
    pedido = PedidoCanceladoFactory(mesa=mesa_disponible, cliente=user_admin)
    return PedidoCancelacionFactory(pedido=pedido, cancelado_por=user_admin)


@pytest.fixture
def cancelacion_simple(db):
    """Cancelación simple para tests de modelo"""
    return PedidoCancelacionFactory()


@pytest.fixture
def cancelacion_con_productos(db, plato_disponible):
    """
    Cancelación con productos_detalle realista.
    Útil para tests de snapshots.
    """
    pedido = PedidoCanceladoFactory()
    detalle1 = DetallePedidoFactory(pedido=pedido, plato=plato_disponible, cantidad=2)
    detalle2 = DetallePedidoFactory(pedido=pedido, plato=plato_disponible, cantidad=1)

    return PedidoCancelacionFactory(
        pedido=pedido,
        productos_resumen=f'2x {detalle1.plato.nombre}, 1x {detalle2.plato.nombre}',
        productos_detalle=[
            {
                'plato_id': detalle1.plato.id,
                'plato_nombre': detalle1.plato.nombre,
                'cantidad': detalle1.cantidad,
                'precio_unitario': float(detalle1.precio_unitario),
                'subtotal': float(detalle1.subtotal)
            },
            {
                'plato_id': detalle2.plato.id,
                'plato_nombre': detalle2.plato.nombre,
                'cantidad': detalle2.cantidad,
                'precio_unitario': float(detalle2.precio_unitario),
                'subtotal': float(detalle2.subtotal)
            }
        ]
    )


# ======================================================================
# FIXTURES DE USUARIOS ESPECIALIZADOS
# ======================================================================

@pytest.fixture
def user_mesero(db):
    """Usuario con rol mesero"""
    from mainApp.tests.factories import UserFactory, PerfilFactory

    user = UserFactory(username='mesero_test')
    PerfilFactory(user=user, rol='mesero', nombre='Test', apellido='Mesero')
    return user


@pytest.fixture
def user_cocinero(db):
    """Usuario con rol cocinero"""
    from mainApp.tests.factories import UserFactory, PerfilFactory

    user = UserFactory(username='cocinero_test')
    PerfilFactory(user=user, rol='cocinero', nombre='Test', apellido='Cocinero')
    return user
