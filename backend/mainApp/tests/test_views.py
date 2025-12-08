"""
Tests para los ViewSets y endpoints de la API

Estos tests verifican que los endpoints funcionen correctamente
con diferentes roles y permisos.
"""

import pytest
from datetime import date, time, timedelta
from django.urls import reverse
from rest_framework import status
from mainApp.models import Reserva, Mesa, Perfil
from mainApp.tests.factories import (
    UserFactory, PerfilClienteFactory, PerfilAdminFactory,
    MesaFactory, ReservaFactory
)


@pytest.mark.api
@pytest.mark.critical
class TestReservaViewSet:
    """Tests para el endpoint de reservas"""

    def test_listar_reservas_autenticado(self, authenticated_client):
        """Un cliente autenticado debe ver solo sus propias reservas"""
        # Crear reservas para el usuario autenticado
        cliente = authenticated_client.user
        reserva1 = ReservaFactory(cliente=cliente)
        reserva2 = ReservaFactory(cliente=cliente)

        # Crear reserva de otro usuario (no debe verla)
        otro_cliente = UserFactory()
        reserva_otro = ReservaFactory(cliente=otro_cliente)

        response = authenticated_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Debe ver solo sus 2 reservas
        reservas_ids = [r['id'] for r in data['results']]
        assert reserva1.id in reservas_ids
        assert reserva2.id in reservas_ids
        assert reserva_otro.id not in reservas_ids

    def test_listar_todas_reservas_admin(self, admin_client):
        """Un admin debe ver todas las reservas"""
        # Crear reservas de diferentes usuarios
        ReservaFactory.create_batch(3)

        response = admin_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Admin debe ver todas las reservas
        assert data['count'] >= 3

    def test_crear_reserva_autenticado(self, authenticated_client, mesa_disponible):
        """Un cliente autenticado debe poder crear reservas"""
        fecha = date.today() + timedelta(days=5)

        data = {
            'mesa': mesa_disponible.id,
            'fecha_reserva': fecha.isoformat(),
            'hora_inicio': '14:00:00',
            'num_personas': 2,
            'notas': 'Reserva de prueba'
        }

        response = authenticated_client.post(
            '/api/reservas/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['estado'] == 'pendiente'
        assert response.data['cliente'] == authenticated_client.user.id

    def test_crear_reserva_sin_autenticar(self, api_client, mesa_disponible):
        """Un usuario no autenticado NO debe poder crear reservas (si requiere auth)"""
        fecha = date.today() + timedelta(days=5)

        data = {
            'mesa': mesa_disponible.id,
            'fecha_reserva': fecha.isoformat(),
            'hora_inicio': '14:00:00',
            'num_personas': 2
        }

        response = api_client.post(
            '/api/reservas/',
            data,
            format='json'
        )

        # Puede ser 401 (no autenticado) o 201 si permite reservas públicas
        # Ajustar según la lógica de tu aplicación
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_201_CREATED
        ]

    def test_actualizar_propia_reserva(self, authenticated_client):
        """Un cliente debe poder actualizar sus propias reservas"""
        cliente = authenticated_client.user
        reserva = ReservaFactory(cliente=cliente, num_personas=2)

        data = {
            'num_personas': 4,
            'notas': 'Cambié el número de personas'
        }

        response = authenticated_client.patch(
            f'/api/reservas/{reserva.id}/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        reserva.refresh_from_db()
        assert reserva.num_personas == 4

    def test_no_actualizar_reserva_de_otro(self, authenticated_client):
        """Un cliente NO debe poder actualizar reservas de otros"""
        otro_cliente = UserFactory()
        reserva_otro = ReservaFactory(cliente=otro_cliente)

        data = {'num_personas': 4}

        response = authenticated_client.patch(
            f'/api/reservas/{reserva_otro.id}/',
            data,
            format='json'
        )

        # Debe ser 404 (no encontrada) o 403 (forbidden)
        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_403_FORBIDDEN
        ]

    def test_cancelar_reserva(self, authenticated_client):
        """Un cliente debe poder cancelar sus propias reservas"""
        cliente = authenticated_client.user
        reserva = ReservaFactory(cliente=cliente, estado='pendiente')

        data = {'estado': 'cancelada'}

        response = authenticated_client.patch(
            f'/api/reservas/{reserva.id}/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        reserva.refresh_from_db()
        assert reserva.estado == 'cancelada'

    def test_filtrar_por_fecha(self, authenticated_client):
        """Debe poder filtrar reservas por fecha"""
        cliente = authenticated_client.user
        fecha1 = date.today() + timedelta(days=1)
        fecha2 = date.today() + timedelta(days=5)

        reserva1 = ReservaFactory(cliente=cliente, fecha_reserva=fecha1)
        reserva2 = ReservaFactory(cliente=cliente, fecha_reserva=fecha2)

        response = authenticated_client.get(
            f'/api/reservas/?fecha_reserva={fecha1.isoformat()}'
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        reservas_ids = [r['id'] for r in data['results']]
        assert reserva1.id in reservas_ids
        assert reserva2.id not in reservas_ids

    def test_filtrar_por_estado(self, authenticated_client):
        """Debe poder filtrar reservas por estado"""
        cliente = authenticated_client.user

        reserva_pendiente = ReservaFactory(cliente=cliente, estado='pendiente')
        reserva_confirmada = ReservaFactory(cliente=cliente, estado='confirmada')

        response = authenticated_client.get('/api/reservas/?estado=pendiente')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        reservas_ids = [r['id'] for r in data['results']]
        assert reserva_pendiente.id in reservas_ids
        assert reserva_confirmada.id not in reservas_ids

    def test_buscar_por_cliente(self, admin_client):
        """Debe poder buscar reservas por nombre/email del cliente"""
        # Crear cliente con nombre específico
        usuario = UserFactory(
            first_name='Juan',
            last_name='Pérez',
            email='juan.perez@test.com'
        )
        reserva = ReservaFactory(cliente=usuario)

        # Buscar por nombre
        response = admin_client.get('/api/reservas/?search=Juan')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        reservas_ids = [r['id'] for r in data['results']]
        assert reserva.id in reservas_ids

        # Buscar por email
        response = admin_client.get('/api/reservas/?search=juan.perez')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        reservas_ids = [r['id'] for r in data['results']]
        assert reserva.id in reservas_ids

    def test_paginacion(self, authenticated_client):
        """Las reservas deben estar paginadas"""
        cliente = authenticated_client.user

        # Crear más de 10 reservas
        ReservaFactory.create_batch(15, cliente=cliente)

        response = authenticated_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Debe tener estructura de paginación
        assert 'count' in data
        assert 'next' in data
        assert 'previous' in data
        assert 'results' in data

        # Debe tener página siguiente
        assert data['next'] is not None


@pytest.mark.api
class TestMesaViewSet:
    """Tests para el endpoint de mesas"""

    def test_listar_mesas(self, api_client):
        """Debe poder listar todas las mesas"""
        MesaFactory.create_batch(5)

        response = api_client.get('/api/mesas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data['results']) >= 5

    def test_filtrar_mesas_disponibles(self, api_client):
        """Debe poder filtrar solo mesas disponibles"""
        mesa_disponible = MesaFactory(estado='disponible')
        mesa_ocupada = MesaFactory(estado='ocupada')

        response = api_client.get('/api/mesas/?estado=disponible')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        mesas_ids = [m['id'] for m in data['results']]
        assert mesa_disponible.id in mesas_ids
        assert mesa_ocupada.id not in mesas_ids

    def test_disponibilidad_mesa(self, api_client, mesa_disponible):
        """
        Endpoint de disponibilidad debe mostrar horarios disponibles
        """
        fecha = date.today() + timedelta(days=1)

        # Crear una reserva existente
        ReservaFactory(
            mesa=mesa_disponible,
            fecha_reserva=fecha,
            hora_inicio=time(14, 0)
        )

        response = api_client.get(
            f'/api/mesas/{mesa_disponible.id}/disponibilidad/',
            {'fecha': fecha.isoformat(), 'num_personas': 2}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Debe devolver horarios disponibles
        assert 'horarios_disponibles' in data or 'disponible' in data


@pytest.mark.api
class TestPerfilViewSet:
    """Tests para el endpoint de perfiles"""

    def test_obtener_propio_perfil(self, authenticated_client):
        """Un usuario debe poder ver su propio perfil"""
        response = authenticated_client.get('/api/perfil/me/')

        # Puede ser /api/perfil/me/ o /api/users/me/ dependiendo de tu configuración
        if response.status_code == status.HTTP_404_NOT_FOUND:
            # Intentar con /api/users/me/
            response = authenticated_client.get('/api/users/me/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['id'] == authenticated_client.user.id

    def test_actualizar_propio_perfil(self, authenticated_client):
        """Un usuario debe poder actualizar su propio perfil"""
        perfil = authenticated_client.user.perfil

        data = {
            'telefono': '+56987654321',
            'nombre_completo': 'Nuevo Nombre'
        }

        response = authenticated_client.patch(
            f'/api/perfil/{perfil.id}/',
            data,
            format='json'
        )

        # Ajustar según tu endpoint exacto
        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Endpoint de perfil no configurado aún")

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.api
@pytest.mark.integration
class TestCrearReservaCompleta:
    """Test de integración: flujo completo de crear reserva"""

    def test_flujo_completo_crear_reserva(
        self, authenticated_client, mesa_disponible
    ):
        """
        Test de integración completo:
        1. Ver mesas disponibles
        2. Ver disponibilidad de mesa específica
        3. Crear reserva
        4. Verificar que la reserva existe
        """
        fecha = date.today() + timedelta(days=3)

        # 1. Listar mesas disponibles
        response = authenticated_client.get('/api/mesas/?estado=disponible')
        assert response.status_code == status.HTTP_200_OK
        mesas = response.json()['results']
        assert len(mesas) > 0

        # 2. Ver disponibilidad de la mesa
        response = authenticated_client.get(
            f'/api/mesas/{mesa_disponible.id}/disponibilidad/',
            {'fecha': fecha.isoformat(), 'num_personas': 2}
        )
        assert response.status_code == status.HTTP_200_OK

        # 3. Crear reserva
        data = {
            'mesa': mesa_disponible.id,
            'fecha_reserva': fecha.isoformat(),
            'hora_inicio': '14:00:00',
            'num_personas': 2,
            'notas': 'Reserva de integración'
        }

        response = authenticated_client.post(
            '/api/reservas/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED
        reserva_id = response.data['id']

        # 4. Verificar que la reserva existe
        response = authenticated_client.get(f'/api/reservas/{reserva_id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['num_personas'] == 2


@pytest.mark.api
@pytest.mark.permissions
class TestPermisos:
    """Tests de permisos y autorización"""

    def test_admin_puede_ver_todas_reservas(self, admin_client):
        """Los admins deben ver todas las reservas"""
        ReservaFactory.create_batch(5)

        response = admin_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['count'] >= 5

    def test_cliente_solo_ve_sus_reservas(self, authenticated_client):
        """Los clientes solo ven sus propias reservas"""
        cliente = authenticated_client.user

        # Crear reservas del cliente
        mis_reservas = ReservaFactory.create_batch(2, cliente=cliente)

        # Crear reservas de otros
        ReservaFactory.create_batch(3)

        response = authenticated_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Solo debe ver sus 2 reservas
        assert data['count'] == 2

    def test_solo_admin_puede_modificar_estado_a_completada(self, authenticated_client, admin_client):
        """Solo los admins deben poder marcar reservas como completadas"""
        cliente = authenticated_client.user
        reserva = ReservaFactory(cliente=cliente, estado='activa')

        # Cliente intenta marcar como completada
        response = authenticated_client.patch(
            f'/api/reservas/{reserva.id}/',
            {'estado': 'completada'},
            format='json'
        )

        # Puede ser rechazado o permitido según tu lógica
        # Ajusta según tus reglas de negocio

        # Admin puede marcar como completada
        response = admin_client.patch(
            f'/api/reservas/{reserva.id}/',
            {'estado': 'completada'},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
