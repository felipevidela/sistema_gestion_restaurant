"""
Tests unitarios para views/API endpoints de cocinaApp.

Tests de:
- PedidoEstadoEndpoint: Endpoint estado() con cancelación y motivo
- PedidosCanceladosView: Lista de pedidos cancelados con filtros
- EstadisticasCancelacionesView: Estadísticas con permisos admin/cajero
"""
import pytest
from datetime import date, timedelta
from rest_framework import status
from decimal import Decimal

from cocinaApp.models import PedidoCancelacion
from .factories import (
    PedidoFactory, PedidoCancelacionFactory, DetallePedidoFactory,
    PedidoCreadoFactory, PedidoCanceladoFactory
)


# ======================================================================
# TESTS DE ENDPOINT estado() CON CANCELACIÓN
# ======================================================================

@pytest.mark.django_db
@pytest.mark.api
@pytest.mark.critical
class TestPedidoEstadoEndpoint:
    """Tests del endpoint /pedidos/{id}/estado/ con cancelación"""

    def test_cancelar_con_motivo_valido(self, authenticated_client, pedido_creado):
        """POST /estado/ con CANCELADO + motivo válido crea auditoría"""
        url = f'/api/cocina/pedidos/{pedido_creado.id}/estado/'
        data = {
            'estado': 'CANCELADO',
            'motivo': 'Cliente solicitó cancelación por tiempo de espera excesivo en la cocina'
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == 200
        response_data = response.json()
        assert response_data['estado'] == 'CANCELADO'
        assert 'cancelacion' in response_data
        assert response_data['cancelacion'] is not None
        assert response_data['cancelacion']['motivo'] == data['motivo']

    def test_cancelar_con_motivo_corto_error(self, authenticated_client, pedido_creado):
        """POST /estado/ con motivo <10 caracteres retorna 400"""
        url = f'/api/cocina/pedidos/{pedido_creado.id}/estado/'
        data = {
            'estado': 'CANCELADO',
            'motivo': 'Corto'
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == 400
        response_data = response.json()
        assert '10 caracteres' in response_data['error'].lower()

    def test_cancelar_sin_motivo_legacy_ok(self, authenticated_client, pedido_creado):
        """POST /estado/ con CANCELADO sin motivo funciona (legacy, sin auditoría)"""
        url = f'/api/cocina/pedidos/{pedido_creado.id}/estado/'
        data = {'estado': 'CANCELADO'}

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == 200
        response_data = response.json()
        assert response_data['estado'] == 'CANCELADO'
        # cancelacion puede ser null en modo legacy
        assert 'cancelacion' in response_data

    def test_request_user_se_registra(self, authenticated_client, pedido_creado):
        """request.user se registra como cancelado_por en auditoría"""
        url = f'/api/cocina/pedidos/{pedido_creado.id}/estado/'
        data = {
            'estado': 'CANCELADO',
            'motivo': 'Motivo válido de prueba para test de auditoría'
        }

        response = authenticated_client.post(url, data, format='json')

        assert response.status_code == 200
        cancelacion_data = response.json()['cancelacion']
        assert cancelacion_data is not None
        # Validar que tiene cancelado_por_username (del request.user)
        assert 'cancelado_por_username' in cancelacion_data
        assert cancelacion_data['cancelado_por_username'] is not None


# ======================================================================
# TESTS DE ENDPOINT /pedidos/cancelados/
# ======================================================================

@pytest.mark.django_db
@pytest.mark.api
class TestPedidosCanceladosView:
    """Tests del endpoint GET /pedidos/cancelados/ con filtros"""

    def test_listar_cancelados_sin_filtros(self, authenticated_client):
        """GET /pedidos/cancelados/ sin filtros retorna lista paginada"""
        PedidoCancelacionFactory.create_batch(5)

        response = authenticated_client.get('/api/cocina/pedidos/cancelados/')

        assert response.status_code == 200
        data = response.json()
        assert 'results' in data
        assert 'count' in data
        assert 'next' in data
        assert 'previous' in data
        assert data['count'] >= 5

    def test_filtro_periodo_hoy(self, authenticated_client):
        """Filtro periodo='hoy' retorna solo cancelaciones de hoy"""
        # Cancelación de hoy
        PedidoCancelacionFactory()

        # Cancelación de ayer (forzar fecha)
        ayer = PedidoCancelacionFactory()
        ayer.fecha_cancelacion = ayer.fecha_cancelacion - timedelta(days=1)
        ayer.save()

        response = authenticated_client.get('/api/cocina/pedidos/cancelados/?periodo=hoy')

        assert response.status_code == 200
        data = response.json()
        # Solo debe retornar la de hoy
        assert data['count'] == 1

    def test_filtro_periodo_semana(self, authenticated_client):
        """Filtro periodo='semana' retorna últimos 7 días"""
        # Cancelación de hace 3 días (dentro de semana)
        reciente = PedidoCancelacionFactory()
        reciente.fecha_cancelacion = reciente.fecha_cancelacion - timedelta(days=3)
        reciente.save()

        # Cancelación de hace 10 días (fuera de semana)
        vieja = PedidoCancelacionFactory()
        vieja.fecha_cancelacion = vieja.fecha_cancelacion - timedelta(days=10)
        vieja.save()

        response = authenticated_client.get('/api/cocina/pedidos/cancelados/?periodo=semana')

        assert response.status_code == 200
        assert response.json()['count'] == 1

    def test_filtro_periodo_mes(self, authenticated_client):
        """Filtro periodo='mes' retorna últimos 30 días"""
        # Cancelación de hace 15 días (dentro de mes)
        reciente = PedidoCancelacionFactory()
        reciente.fecha_cancelacion = reciente.fecha_cancelacion - timedelta(days=15)
        reciente.save()

        # Cancelación de hace 40 días (fuera de mes)
        vieja = PedidoCancelacionFactory()
        vieja.fecha_cancelacion = vieja.fecha_cancelacion - timedelta(days=40)
        vieja.save()

        response = authenticated_client.get('/api/cocina/pedidos/cancelados/?periodo=mes')

        assert response.status_code == 200
        assert response.json()['count'] == 1

    def test_filtro_fecha_especifica(self, authenticated_client):
        """Filtro por fecha específica (formato YYYY-MM-DD)"""
        cancelacion = PedidoCancelacionFactory()
        fecha = cancelacion.fecha_cancelacion.date().isoformat()

        response = authenticated_client.get(
            f'/api/cocina/pedidos/cancelados/?fecha={fecha}'
        )

        assert response.status_code == 200
        assert response.json()['count'] >= 1

    def test_filtro_usuario(self, authenticated_client, user_admin):
        """Filtro por usuario que canceló"""
        # Cancelaciones del admin
        PedidoCancelacionFactory.create_batch(3, cancelado_por=user_admin)

        # Cancelaciones de otros usuarios
        PedidoCancelacionFactory.create_batch(2)

        response = authenticated_client.get(
            f'/api/cocina/pedidos/cancelados/?usuario={user_admin.id}'
        )

        assert response.status_code == 200
        assert response.json()['count'] == 3

    def test_busqueda_por_id(self, authenticated_client):
        """Búsqueda por ID de pedido"""
        cancelacion = PedidoCancelacionFactory()
        pedido_id = cancelacion.pedido.id

        response = authenticated_client.get(
            f'/api/cocina/pedidos/cancelados/?busqueda={pedido_id}'
        )

        assert response.status_code == 200
        assert response.json()['count'] >= 1

    def test_busqueda_por_mesa(self, authenticated_client):
        """Búsqueda por número de mesa"""
        cancelacion = PedidoCancelacionFactory()
        mesa_numero = cancelacion.pedido.mesa.numero

        response = authenticated_client.get(
            f'/api/cocina/pedidos/cancelados/?busqueda={mesa_numero}'
        )

        assert response.status_code == 200
        assert response.json()['count'] >= 1

    def test_busqueda_por_motivo(self, authenticated_client):
        """Búsqueda por contenido del motivo"""
        cancelacion = PedidoCancelacionFactory(
            motivo='Cliente estaba muy insatisfecho con el servicio y tiempo de espera'
        )

        response = authenticated_client.get(
            '/api/cocina/pedidos/cancelados/?busqueda=insatisfecho'
        )

        assert response.status_code == 200
        assert response.json()['count'] >= 1

    def test_busqueda_por_cliente_nombre(self, authenticated_client, user_cliente):
        """Búsqueda por nombre de cliente"""
        # Actualizar nombre completo del perfil
        user_cliente.perfil.nombre_completo = 'Juan Carlos Pérez García'
        user_cliente.perfil.save()

        # Crear pedido cancelado con este cliente
        pedido = PedidoCanceladoFactory(cliente=user_cliente)
        PedidoCancelacionFactory(pedido=pedido, cancelado_por=user_cliente, cliente_nombre='Juan Carlos Pérez García')

        response = authenticated_client.get(
            '/api/cocina/pedidos/cancelados/?busqueda=Juan'
        )

        assert response.status_code == 200
        assert response.json()['count'] >= 1

    def test_ordenamiento_fecha_descendente(self, authenticated_client):
        """Ordenamiento por fecha_cancelacion descendente (más recientes primero)"""
        PedidoCancelacionFactory.create_batch(3)

        response = authenticated_client.get(
            '/api/cocina/pedidos/cancelados/?ordering=-cancelacion__fecha_cancelacion'
        )

        assert response.status_code == 200
        results = response.json()['results']

        # Validar orden descendente (si hay al menos 2)
        if len(results) >= 2:
            fecha_0 = results[0]['cancelacion']['fecha_cancelacion']
            fecha_1 = results[1]['cancelacion']['fecha_cancelacion']
            assert fecha_0 >= fecha_1

    def test_ordenamiento_fecha_ascendente(self, authenticated_client):
        """Ordenamiento por fecha_cancelacion ascendente (más antiguos primero)"""
        PedidoCancelacionFactory.create_batch(3)

        response = authenticated_client.get(
            '/api/cocina/pedidos/cancelados/?ordering=cancelacion__fecha_cancelacion'
        )

        assert response.status_code == 200
        results = response.json()['results']

        # Validar orden ascendente
        if len(results) >= 2:
            fecha_0 = results[0]['cancelacion']['fecha_cancelacion']
            fecha_1 = results[1]['cancelacion']['fecha_cancelacion']
            assert fecha_0 <= fecha_1

    def test_paginacion(self, authenticated_client):
        """Paginación funciona correctamente"""
        PedidoCancelacionFactory.create_batch(25)

        response = authenticated_client.get('/api/cocina/pedidos/cancelados/?page_size=10')

        assert response.status_code == 200
        data = response.json()
        assert len(data['results']) == 10
        assert data['count'] == 25
        assert data['next'] is not None
        assert data['previous'] is None  # Primera página

    def test_paginacion_segunda_pagina(self, authenticated_client):
        """Navegar a segunda página de paginación"""
        PedidoCancelacionFactory.create_batch(25)

        response = authenticated_client.get(
            '/api/cocina/pedidos/cancelados/?page_size=10&page=2'
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data['results']) == 10
        assert data['previous'] is not None  # Hay página anterior

    def test_permisos_autenticado(self, api_client):
        """Solo usuarios autenticados pueden acceder"""
        response = api_client.get('/api/cocina/pedidos/cancelados/')

        assert response.status_code == 401

    def test_estructura_respuesta_completa(self, authenticated_client):
        """Estructura de respuesta incluye todos los campos necesarios"""
        cancelacion = PedidoCancelacionFactory()

        response = authenticated_client.get('/api/cocina/pedidos/cancelados/')

        assert response.status_code == 200
        results = response.json()['results']
        assert len(results) > 0

        # Validar estructura de cada pedido
        pedido = results[0]
        assert 'id' in pedido
        assert 'estado' in pedido
        assert 'mesa' in pedido
        assert 'cancelacion' in pedido

        # Validar estructura de cancelacion
        cancelacion_data = pedido['cancelacion']
        assert 'motivo' in cancelacion_data
        assert 'cancelado_por_username' in cancelacion_data
        assert 'fecha_cancelacion' in cancelacion_data


# ======================================================================
# TESTS DE ENDPOINT /estadisticas/cancelaciones/
# ======================================================================

@pytest.mark.django_db
@pytest.mark.api
@pytest.mark.critical
@pytest.mark.permissions
class TestEstadisticasCancelacionesView:
    """Tests del endpoint GET /estadisticas/cancelaciones/ con permisos"""

    def test_estadisticas_periodo_dia(self, admin_client):
        """GET /estadisticas/cancelaciones/?periodo=dia retorna estadísticas"""
        PedidoCancelacionFactory.create_batch(3)

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=dia')

        assert response.status_code == 200
        data = response.json()
        assert 'periodo' in data
        assert 'fecha_inicio' in data
        assert 'fecha_fin' in data
        assert 'total_cancelados' in data
        assert 'por_usuario' in data
        assert 'motivos_sample' in data
        assert 'motivos_total' in data

    def test_estadisticas_periodo_semana(self, admin_client):
        """GET /estadisticas/cancelaciones/?periodo=semana"""
        # Cancelación dentro de semana
        reciente = PedidoCancelacionFactory()
        reciente.fecha_cancelacion = reciente.fecha_cancelacion - timedelta(days=3)
        reciente.save()

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=semana')

        assert response.status_code == 200
        assert response.json()['total_cancelados'] >= 1
        assert response.json()['periodo'] == 'semana'

    def test_estadisticas_periodo_mes(self, admin_client):
        """GET /estadisticas/cancelaciones/?periodo=mes"""
        # Cancelación dentro de mes
        reciente = PedidoCancelacionFactory()
        reciente.fecha_cancelacion = reciente.fecha_cancelacion - timedelta(days=15)
        reciente.save()

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=mes')

        assert response.status_code == 200
        assert response.json()['total_cancelados'] >= 1
        assert response.json()['periodo'] == 'mes'

    def test_calculo_total_cancelados(self, admin_client):
        """total_cancelados se calcula correctamente"""
        PedidoCancelacionFactory.create_batch(8)

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=dia')

        assert response.status_code == 200
        assert response.json()['total_cancelados'] == 8

    def test_agrupacion_por_usuario(self, admin_client, user_admin):
        """Agrupación por_usuario correcta"""
        from mainApp.tests.factories import UserFactory

        user_cajero = UserFactory(username='cajero_test')

        PedidoCancelacionFactory.create_batch(5, cancelado_por=user_admin)
        PedidoCancelacionFactory.create_batch(3, cancelado_por=user_cajero)

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=dia')

        por_usuario = response.json()['por_usuario']
        assert len(por_usuario) >= 2

        # Validar estructura
        for item in por_usuario:
            assert 'cancelado_por__username' in item
            assert 'count' in item

    def test_limite_motivos_20(self, admin_client):
        """motivos_sample limitado a máximo 20 motivos"""
        for i in range(30):
            PedidoCancelacionFactory(motivo=f'Motivo diferente número {i} para test de límite')

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=dia')

        motivos = response.json()['motivos_sample']
        assert len(motivos) <= 20

    def test_truncado_motivos_100_chars(self, admin_client):
        """motivos largos truncados a 100 caracteres"""
        motivo_largo = 'x' * 200
        PedidoCancelacionFactory(motivo=motivo_largo)

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=dia')

        motivos = response.json()['motivos_sample']
        for motivo in motivos:
            assert len(motivo) <= 100

    def test_permisos_admin_ok(self, admin_client):
        """Admin puede acceder a estadísticas"""
        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/')

        assert response.status_code == 200

    def test_permisos_cajero_ok(self, api_client):
        """Cajero puede acceder a estadísticas"""
        from mainApp.tests.factories import UserFactory, PerfilFactory
        from rest_framework.authtoken.models import Token

        user_cajero = UserFactory(username='cajero_permisos_test')
        PerfilFactory(user=user_cajero, rol='cajero')
        token = Token.objects.create(user=user_cajero)

        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        response = api_client.get('/api/cocina/estadisticas/cancelaciones/')

        assert response.status_code == 200

    def test_permisos_cliente_forbidden(self, authenticated_client):
        """Cliente NO puede acceder a estadísticas (403 Forbidden)"""
        response = authenticated_client.get('/api/cocina/estadisticas/cancelaciones/')

        # authenticated_client por defecto es un cliente
        assert response.status_code == 403

    def test_permisos_mesero_forbidden(self, api_client, user_mesero):
        """Mesero NO puede acceder a estadísticas (403 Forbidden)"""
        from rest_framework.authtoken.models import Token

        token = Token.objects.create(user=user_mesero)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = api_client.get('/api/cocina/estadisticas/cancelaciones/')

        assert response.status_code == 403

    def test_fechas_rango_correctas(self, admin_client):
        """Fechas de rango (fecha_inicio, fecha_fin) son correctas"""
        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=semana')

        assert response.status_code == 200
        data = response.json()

        # Validar formato de fechas
        assert data['fecha_inicio'] is not None
        assert data['fecha_fin'] is not None

        # fecha_fin debería ser hoy
        assert data['fecha_fin'] == date.today().isoformat()

        # fecha_inicio debería ser hace 7 días
        hace_7_dias = (date.today() - timedelta(days=7)).isoformat()
        assert data['fecha_inicio'] == hace_7_dias

    def test_motivos_total_correcto(self, admin_client):
        """motivos_total indica el número total de motivos (incluso si truncados)"""
        # Crear 25 cancelaciones con motivos únicos
        for i in range(25):
            PedidoCancelacionFactory(motivo=f'Motivo único {i}')

        response = admin_client.get('/api/cocina/estadisticas/cancelaciones/?periodo=dia')

        data = response.json()
        assert data['motivos_total'] == 25
        assert len(data['motivos_sample']) <= 20  # Pero solo muestra 20
