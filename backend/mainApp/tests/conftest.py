"""
Configuración global de fixtures para tests de mainApp

Este archivo contiene fixtures que están disponibles para todos los tests
sin necesidad de importarlos explícitamente.
"""

import pytest
from datetime import date, time, timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from mainApp.models import Perfil, Mesa, Reserva


@pytest.fixture
def api_client():
    """
    Cliente de API de Django REST Framework para hacer requests a los endpoints.

    Uso:
        def test_algo(api_client):
            response = api_client.get('/api/reservas/')
            assert response.status_code == 200
    """
    return APIClient()


@pytest.fixture
def user_cliente(db):
    """
    Usuario con rol de cliente para tests.

    Retorna: User con perfil de cliente
    """
    user = User.objects.create_user(
        username='cliente_test',
        email='cliente@test.com',
        password='TestPass123!',
        first_name='Juan',
        last_name='Pérez'
    )
    # El signal ya creó el Perfil automáticamente, solo lo actualizamos
    perfil = user.perfil
    perfil.rol = 'cliente'
    perfil.nombre_completo = 'Juan Pérez'
    perfil.rut = '12345678-5'
    perfil.telefono = '+56912345678'
    perfil.email = 'cliente@test.com'
    perfil.save()
    return user


@pytest.fixture
def user_admin(db):
    """
    Usuario con rol de administrador para tests.

    Retorna: User con perfil de admin
    """
    user = User.objects.create_user(
        username='admin_test',
        email='admin@test.com',
        password='AdminPass123!',
        first_name='Admin',
        last_name='Sistema',
        is_staff=True,
        is_superuser=True
    )
    # El signal ya creó el Perfil automáticamente, solo lo actualizamos
    perfil = user.perfil
    perfil.rol = 'admin'
    perfil.nombre_completo = 'Admin Sistema'
    perfil.rut = '11111111-1'
    perfil.telefono = '+56911111111'
    perfil.email = 'admin@test.com'
    perfil.save()
    return user


@pytest.fixture
def user_cajero(db):
    """
    Usuario con rol de cajero para tests.
    """
    user = User.objects.create_user(
        username='cajero_test',
        email='cajero@test.com',
        password='CajeroPass123!',
        first_name='María',
        last_name='González'
    )
    # El signal ya creó el Perfil automáticamente, solo lo actualizamos
    perfil = user.perfil
    perfil.rol = 'cajero'
    perfil.nombre_completo = 'María González'
    perfil.rut = '22222222-2'
    perfil.telefono = '+56922222222'
    perfil.email = 'cajero@test.com'
    perfil.save()
    return user


@pytest.fixture
def mesa_disponible(db):
    """
    Mesa disponible con capacidad para 4 personas.

    Retorna: Mesa con estado 'disponible'
    """
    return Mesa.objects.create(
        numero=1,
        capacidad=4,
        estado='disponible'
    )


@pytest.fixture
def mesa_pequena(db):
    """
    Mesa pequeña para 2 personas.
    """
    return Mesa.objects.create(
        numero=2,
        capacidad=2,
        estado='disponible'
    )


@pytest.fixture
def mesa_grande(db):
    """
    Mesa grande para 8 personas.
    """
    return Mesa.objects.create(
        numero=3,
        capacidad=8,
        estado='disponible'
    )


@pytest.fixture
def fecha_futura():
    """
    Fecha en el futuro (mañana) para tests de reservas válidas.

    Retorna: date object (mañana)
    """
    return date.today() + timedelta(days=1)


@pytest.fixture
def fecha_pasada():
    """
    Fecha en el pasado para tests de validación.

    Retorna: date object (ayer)
    """
    return date.today() - timedelta(days=1)


@pytest.fixture
def hora_valida():
    """
    Hora válida para reservas (14:00).
    """
    return time(14, 0)


@pytest.fixture
def reserva_valida(db, user_cliente, mesa_disponible, fecha_futura):
    """
    Reserva válida para tests.

    Retorna: Reserva con estado 'pendiente'
    """
    return Reserva.objects.create(
        cliente=user_cliente,
        mesa=mesa_disponible,
        fecha_reserva=fecha_futura,
        hora_inicio=time(14, 0),
        num_personas=2,
        estado='pendiente',
        notas='Test reservation'
    )


@pytest.fixture
def authenticated_client(api_client, user_cliente):
    """
    Cliente autenticado como cliente normal.

    Retorna: APIClient con usuario autenticado

    Uso:
        def test_algo(authenticated_client):
            response = authenticated_client.get('/api/mis-reservas/')
            assert response.status_code == 200
    """
    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user_cliente)
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    api_client.user = user_cliente
    return api_client


@pytest.fixture
def admin_client(api_client, user_admin):
    """
    Cliente autenticado como administrador.

    Retorna: APIClient con usuario admin autenticado
    """
    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user_admin)
    api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    api_client.user = user_admin
    return api_client


@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """
    Habilita acceso a la base de datos para todos los tests automáticamente.

    Con autouse=True, no necesitas marcar cada test con @pytest.mark.django_db
    """
    pass


@pytest.fixture
def freeze_time():
    """
    Congela el tiempo para tests que dependen de fechas/horas específicas.

    Uso:
        def test_algo(freeze_time):
            with freeze_time("2025-11-19 14:00:00"):
                # El tiempo está congelado en esta fecha/hora
                reserva = crear_reserva()
                assert reserva.created_at.hour == 14
    """
    from freezegun import freeze_time as freezegun_freeze
    return freezegun_freeze
