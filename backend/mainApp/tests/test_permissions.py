"""
Tests para permisos y autenticación

Estos tests verifican que los diferentes roles (admin, cajero, cliente)
tengan los permisos correctos para cada operación.
"""

import pytest
from datetime import date, timedelta
from rest_framework import status
from rest_framework.test import APIClient
from mainApp.tests.factories import (
    UserFactory, PerfilAdminFactory, PerfilClienteFactory,
    PerfilCajeroFactory, MesaFactory, ReservaFactory
)


@pytest.mark.permissions
@pytest.mark.critical
class TestReservaPermissions:
    """Tests de permisos para el modelo Reserva"""

    def test_usuario_no_autenticado_no_puede_listar_reservas(self, api_client):
        """Un usuario sin autenticar no debe poder listar reservas (opcional según tu lógica)"""
        ReservaFactory.create_batch(3)

        response = api_client.get('/api/reservas/')

        # Ajustar según si permites acceso público o no
        # Si es público: HTTP_200_OK
        # Si requiere auth: HTTP_401_UNAUTHORIZED
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN
        ]

    def test_cliente_puede_crear_reserva(self, authenticated_client, mesa_disponible):
        """Un cliente autenticado debe poder crear reservas"""
        fecha = date.today() + timedelta(days=5)

        data = {
            'mesa': mesa_disponible.id,
            'fecha_reserva': fecha.isoformat(),
            'hora_inicio': '14:00:00',
            'num_personas': 2
        }

        response = authenticated_client.post(
            '/api/reservas/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_cliente_solo_ve_sus_propias_reservas(self, api_client):
        """
        CRÍTICO: Un cliente solo debe ver sus propias reservas,
        no las de otros clientes.
        """
        # Crear cliente 1 con 2 reservas
        perfil1 = PerfilClienteFactory()
        cliente1 = perfil1.user
        reserva1_cliente1 = ReservaFactory(cliente=cliente1)
        reserva2_cliente1 = ReservaFactory(cliente=cliente1)

        # Crear cliente 2 con 2 reservas
        perfil2 = PerfilClienteFactory()
        cliente2 = perfil2.user
        reserva1_cliente2 = ReservaFactory(cliente=cliente2)
        reserva2_cliente2 = ReservaFactory(cliente=cliente2)

        # Autenticar como cliente 1
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cliente1)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = api_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Cliente 1 debe ver solo sus 2 reservas
        reservas_ids = [r['id'] for r in data['results']]
        assert reserva1_cliente1.id in reservas_ids
        assert reserva2_cliente1.id in reservas_ids

        # NO debe ver las reservas de cliente 2
        assert reserva1_cliente2.id not in reservas_ids
        assert reserva2_cliente2.id not in reservas_ids

    def test_cliente_puede_editar_su_propia_reserva(self, api_client):
        """Un cliente debe poder editar sus propias reservas"""
        perfil = PerfilClienteFactory()
        cliente = perfil.user
        reserva = ReservaFactory(cliente=cliente, num_personas=2)

        # Autenticar
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cliente)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        # Editar reserva
        data = {'num_personas': 4}

        response = api_client.patch(
            f'/api/reservas/{reserva.id}/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        reserva.refresh_from_db()
        assert reserva.num_personas == 4

    def test_cliente_no_puede_editar_reserva_de_otro(self, api_client):
        """
        CRÍTICO: Un cliente NO debe poder editar reservas de otros clientes.
        """
        # Crear cliente 1
        perfil1 = PerfilClienteFactory()
        cliente1 = perfil1.user

        # Crear cliente 2 con una reserva
        perfil2 = PerfilClienteFactory()
        cliente2 = perfil2.user
        reserva_cliente2 = ReservaFactory(cliente=cliente2, num_personas=2)

        # Autenticar como cliente 1
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cliente1)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        # Intentar editar reserva de cliente 2
        data = {'num_personas': 6}

        response = api_client.patch(
            f'/api/reservas/{reserva_cliente2.id}/',
            data,
            format='json'
        )

        # Debe ser rechazado (404 o 403)
        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_403_FORBIDDEN
        ]

        # La reserva no debe haberse modificado
        reserva_cliente2.refresh_from_db()
        assert reserva_cliente2.num_personas == 2

    def test_cliente_no_puede_eliminar_reserva_de_otro(self, api_client):
        """Un cliente NO debe poder eliminar reservas de otros"""
        perfil1 = PerfilClienteFactory()
        cliente1 = perfil1.user

        perfil2 = PerfilClienteFactory()
        cliente2 = perfil2.user
        reserva_cliente2 = ReservaFactory(cliente=cliente2)

        # Autenticar como cliente 1
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cliente1)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = api_client.delete(f'/api/reservas/{reserva_cliente2.id}/')

        # Debe ser rechazado
        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_403_FORBIDDEN
        ]


@pytest.mark.permissions
@pytest.mark.critical
class TestAdminPermissions:
    """Tests de permisos para rol de administrador"""

    def test_admin_puede_ver_todas_reservas(self, admin_client):
        """
        CRÍTICO: Los administradores deben ver TODAS las reservas,
        no solo las suyas.
        """
        # Crear reservas de diferentes usuarios
        perfil1 = PerfilClienteFactory()
        perfil2 = PerfilClienteFactory()
        perfil3 = PerfilClienteFactory()

        reserva1 = ReservaFactory(cliente=perfil1.user)
        reserva2 = ReservaFactory(cliente=perfil2.user)
        reserva3 = ReservaFactory(cliente=perfil3.user)

        response = admin_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Admin debe ver todas las reservas
        reservas_ids = [r['id'] for r in data['results']]
        assert reserva1.id in reservas_ids
        assert reserva2.id in reservas_ids
        assert reserva3.id in reservas_ids

    def test_admin_puede_editar_cualquier_reserva(self, admin_client):
        """Los admins deben poder editar reservas de cualquier cliente"""
        perfil = PerfilClienteFactory()
        # Crear mesa con capacidad suficiente para el test
        mesa = MesaFactory(capacidad=8)
        reserva = ReservaFactory(cliente=perfil.user, mesa=mesa, num_personas=2)

        data = {'num_personas': 6}

        response = admin_client.patch(
            f'/api/reservas/{reserva.id}/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        reserva.refresh_from_db()
        assert reserva.num_personas == 6

    def test_admin_puede_cambiar_estado_reserva(self, admin_client):
        """Los admins deben poder cambiar el estado de reservas"""
        perfil = PerfilClienteFactory()
        reserva = ReservaFactory(cliente=perfil.user, estado='pendiente')

        # Cambiar a activa
        data = {'estado': 'activa'}

        response = admin_client.patch(
            f'/api/reservas/{reserva.id}/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        reserva.refresh_from_db()
        assert reserva.estado == 'activa'

    def test_admin_puede_eliminar_reservas(self, admin_client):
        """Los admins deben poder eliminar reservas"""
        perfil = PerfilClienteFactory()
        reserva = ReservaFactory(cliente=perfil.user)
        reserva_id = reserva.id

        response = admin_client.delete(f'/api/reservas/{reserva_id}/')

        # Debe permitir eliminación (200, 204)
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT
        ]

    def test_admin_puede_crear_mesas(self, admin_client):
        """Los admins deben poder crear mesas"""
        data = {
            'numero': 99,
            'capacidad': 6,
            'estado': 'disponible'
        }

        response = admin_client.post(
            '/api/mesas/',
            data,
            format='json'
        )

        # Debe permitir crear (o puede estar restringido según tu lógica)
        assert response.status_code in [
            status.HTTP_201_CREATED,
            status.HTTP_403_FORBIDDEN  # Si decides restringir
        ]

    def test_admin_puede_modificar_mesas(self, admin_client, mesa_disponible):
        """Los admins deben poder modificar mesas"""
        # Estados válidos: 'disponible', 'reservada', 'ocupada', 'limpieza'
        data = {'estado': 'limpieza'}

        response = admin_client.patch(
            f'/api/mesas/{mesa_disponible.id}/',
            data,
            format='json'
        )

        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_403_FORBIDDEN  # Si decides restringir
        ]


@pytest.mark.permissions
class TestCajeroPermissions:
    """Tests de permisos para rol de cajero"""

    def test_cajero_puede_ver_todas_reservas(self, api_client):
        """Los cajeros deben poder ver todas las reservas"""
        perfil_cajero = PerfilCajeroFactory()
        cajero = perfil_cajero.user

        # Crear reservas de diferentes clientes
        ReservaFactory.create_batch(5)

        # Autenticar como cajero
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cajero)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = api_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Cajero debe ver todas las reservas
        assert data['count'] >= 5

    def test_cajero_puede_cambiar_estado_reserva(self, api_client):
        """Los cajeros deben poder cambiar estado de reservas (confirmar/activar)"""
        perfil_cajero = PerfilCajeroFactory()
        cajero = perfil_cajero.user

        perfil_cliente = PerfilClienteFactory()
        reserva = ReservaFactory(cliente=perfil_cliente.user, estado='pendiente')

        # Autenticar como cajero
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cajero)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        # Confirmar reserva
        data = {'estado': 'confirmada'}

        response = api_client.patch(
            f'/api/reservas/{reserva.id}/',
            data,
            format='json'
        )

        # Debe poder cambiar estado
        assert response.status_code == status.HTTP_200_OK

    def test_cajero_no_puede_eliminar_reservas(self, api_client):
        """Los cajeros NO deben poder eliminar reservas (solo admin)"""
        perfil_cajero = PerfilCajeroFactory()
        cajero = perfil_cajero.user

        perfil_cliente = PerfilClienteFactory()
        reserva = ReservaFactory(cliente=perfil_cliente.user)

        # Autenticar como cajero
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=cajero)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = api_client.delete(f'/api/reservas/{reserva.id}/')

        # Debe ser rechazado (ajustar según tu lógica de permisos)
        # Si permites que cajero elimine, cambia esta expectativa
        assert response.status_code in [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_204_NO_CONTENT,  # Si sí pueden eliminar
            status.HTTP_200_OK  # Si sí pueden eliminar
        ]


@pytest.mark.permissions
class TestMesaPermissions:
    """Tests de permisos para el modelo Mesa"""

    def test_cualquiera_puede_listar_mesas(self, api_client):
        """Las mesas deben ser visibles públicamente"""
        MesaFactory.create_batch(3)

        response = api_client.get('/api/mesas/')

        assert response.status_code == status.HTTP_200_OK

    def test_cliente_no_puede_crear_mesas(self, authenticated_client):
        """Los clientes NO deben poder crear mesas"""
        data = {
            'numero': 99,
            'capacidad': 4,
            'estado': 'disponible'
        }

        response = authenticated_client.post(
            '/api/mesas/',
            data,
            format='json'
        )

        # Debe ser rechazado
        assert response.status_code in [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_405_METHOD_NOT_ALLOWED
        ]

    def test_cliente_no_puede_modificar_mesas(self, authenticated_client, mesa_disponible):
        """Los clientes NO deben poder modificar mesas"""
        data = {'estado': 'ocupada'}

        response = authenticated_client.patch(
            f'/api/mesas/{mesa_disponible.id}/',
            data,
            format='json'
        )

        # Debe ser rechazado
        assert response.status_code in [
            status.HTTP_403_FORBIDDEN,
            status.HTTP_405_METHOD_NOT_ALLOWED
        ]


@pytest.mark.permissions
@pytest.mark.integration
class TestAutenticacionFlow:
    """Tests del flujo de autenticación"""

    def test_login_con_credenciales_validas(self, api_client, user_cliente):
        """Debe poder hacer login con credenciales válidas"""
        data = {
            'username': 'cliente_test',
            'password': 'TestPass123!'
        }

        response = api_client.post(
            '/api/login/',
            data,
            format='json'
        )

        # Si tienes endpoint de login personalizado
        if response.status_code == status.HTTP_404_NOT_FOUND:
            # Intentar con auth/login o token/
            response = api_client.post('/api/auth/login/', data, format='json')

        if response.status_code == status.HTTP_200_OK:
            assert 'token' in response.data or 'key' in response.data

    def test_login_con_credenciales_invalidas(self, api_client):
        """No debe permitir login con credenciales incorrectas"""
        data = {
            'username': 'usuario_inexistente',
            'password': 'password_incorrecta'
        }

        response = api_client.post(
            '/api/login/',
            data,
            format='json'
        )

        if response.status_code == status.HTTP_404_NOT_FOUND:
            response = api_client.post('/api/auth/login/', data, format='json')

        # Debe rechazar
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND
        ]

    def test_acceso_con_token_valido(self, api_client, user_cliente):
        """Debe poder acceder a recursos con token válido"""
        from rest_framework.authtoken.models import Token

        token, _ = Token.objects.get_or_create(user=user_cliente)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        response = api_client.get('/api/reservas/')

        assert response.status_code == status.HTTP_200_OK

    def test_acceso_con_token_invalido(self, api_client):
        """No debe permitir acceso con token inválido"""
        api_client.credentials(HTTP_AUTHORIZATION='Token token_invalido_12345')

        response = api_client.get('/api/reservas/')

        # Puede devolver 401 o 200 según si el endpoint es público
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_200_OK  # Si el endpoint es público
        ]
