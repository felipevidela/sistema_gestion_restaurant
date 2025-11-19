#!/usr/bin/env python
"""
Script de testing para el sistema de reservas con cuenta opcional.
Prueba los flujos de invitados y activación de cuenta.
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

# TEST 1: Reserva SIN cuenta (invitado)
def test_reserva_sin_cuenta():
    print_section("TEST 1: Reserva SIN cuenta (invitado)")

    # Preparar datos
    fecha_reserva = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')

    data = {
        "email": "invitado.test@example.com",
        "password": "",  # SIN PASSWORD
        "password_confirm": "",
        "nombre": "Juan",
        "apellido": "Invitado",
        "rut": "11111111-1",
        "telefono": "+56912345678",
        "mesa": 1,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "14:00",
        "hora_fin": "16:00",
        "num_personas": 2,
        "notas": "Test de reserva sin cuenta"
    }

    print_info(f"Creando reserva para: {data['email']}")
    print_info(f"Fecha: {fecha_reserva} a las {data['hora_inicio']}")

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("Reserva creada exitosamente")
            print_info(f"Es invitado: {result.get('es_invitado')}")
            print_info(f"Email: {result.get('email')}")
            print_info(f"Mesa: {result['reserva']['mesa_numero']}")

            # Verificar que NO haya token de autenticación (invitado)
            if 'token' not in result:
                print_success("✓ Invitado NO recibió token de autenticación (correcto)")
            else:
                print_error("✗ Invitado recibió token de autenticación (incorrecto)")

            if result.get('es_invitado'):
                print_success("✓ Usuario marcado como invitado (correcto)")
            else:
                print_error("✗ Usuario NO marcado como invitado (incorrecto)")

            return result
        else:
            print_error(f"Error al crear reserva: {response.status_code}")
            print_error(response.json())
            return None
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None

# TEST 2: Reserva CON cuenta
def test_reserva_con_cuenta():
    print_section("TEST 2: Reserva CON cuenta")

    fecha_reserva = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')

    data = {
        "email": "usuario.registrado@example.com",
        "password": "Test123!@#",  # CON PASSWORD
        "password_confirm": "Test123!@#",
        "nombre": "María",
        "apellido": "Registrada",
        "rut": "22222222-2",
        "telefono": "+56987654321",
        "mesa": 2,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "19:00",
        "hora_fin": "21:00",
        "num_personas": 4,
        "notas": "Test de reserva con cuenta"
    }

    print_info(f"Creando reserva para: {data['email']}")
    print_info(f"Fecha: {fecha_reserva} a las {data['hora_inicio']}")

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("Reserva creada exitosamente")
            print_info(f"Es invitado: {result.get('es_invitado')}")
            print_info(f"Email: {result.get('email')}")
            print_info(f"Mesa: {result['reserva']['mesa_numero']}")

            # Verificar que SÍ haya token de autenticación
            if 'token' in result:
                print_success("✓ Usuario registrado recibió token de autenticación (correcto)")
                print_info(f"Token: {result['token'][:20]}...")
            else:
                print_error("✗ Usuario registrado NO recibió token de autenticación (incorrecto)")

            if not result.get('es_invitado'):
                print_success("✓ Usuario NO marcado como invitado (correcto)")
            else:
                print_error("✗ Usuario marcado como invitado (incorrecto)")

            return result
        else:
            print_error(f"Error al crear reserva: {response.status_code}")
            print_error(response.json())
            return None
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None

# TEST 3: Obtener token de un invitado y probar endpoints
def test_acceso_con_token():
    print_section("TEST 3: Acceso con token de invitado")

    # Necesitamos obtener el token de la base de datos
    # Vamos a usar Django shell para esto
    print_info("Obteniendo token de invitado de la base de datos...")

    import os
    import sys
    sys.path.insert(0, '/Users/felipevidela/Desktop/modulo_reservas/REST frameworks/ReservaProject')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ReservaProject.settings')

    try:
        import django
        django.setup()

        from mainApp.models import Perfil

        # Buscar un perfil de invitado
        perfil_invitado = Perfil.objects.filter(es_invitado=True).order_by('-id').first()

        if perfil_invitado and perfil_invitado.token_activacion:
            token = perfil_invitado.token_activacion
            print_success(f"Token encontrado: {token[:20]}...")

            # Test: Verificar token
            print_info("\n3.1 - Verificando token...")
            response = requests.get(f"{BASE_URL}/verificar-token/{token}/")
            if response.status_code == 200:
                data = response.json()
                print_success("Token verificado correctamente")
                print_info(f"Email: {data['email']}")
                print_info(f"Nombre: {data['nombre_completo']}")
            else:
                print_error(f"Error al verificar token: {response.status_code}")

            # Test: Ver reserva
            print_info("\n3.2 - Viendo reserva...")
            response = requests.get(f"{BASE_URL}/reserva-invitado/{token}/")
            if response.status_code == 200:
                data = response.json()
                print_success("Reserva obtenida correctamente")
                print_info(f"Mesa: {data['reserva']['mesa_numero']}")
                print_info(f"Fecha: {data['reserva']['fecha_reserva']}")
                print_info(f"Cliente: {data['cliente']['nombre_completo']}")
            else:
                print_error(f"Error al ver reserva: {response.status_code}")

            return token
        else:
            print_error("No se encontró ningún perfil de invitado con token")
            return None
    except Exception as e:
        print_error(f"Error al obtener token: {str(e)}")
        return None

# TEST 4: Activar cuenta
def test_activar_cuenta(token):
    print_section("TEST 4: Activar cuenta de invitado")

    if not token:
        print_error("No hay token disponible para probar")
        return

    data = {
        "token": token,
        "password": "NuevaPass123!@#",
        "password_confirm": "NuevaPass123!@#"
    }

    print_info("Activando cuenta...")

    try:
        response = requests.post(f"{BASE_URL}/activar-cuenta/", json=data)

        if response.status_code == 200:
            result = response.json()
            print_success("Cuenta activada exitosamente")
            print_info(f"Email: {result['email']}")
            print_info(f"Token de autenticación: {result['token'][:20]}...")
            print_success("✓ Usuario puede ahora hacer login con su contraseña")
        else:
            print_error(f"Error al activar cuenta: {response.status_code}")
            error_data = response.json()
            print_error(error_data.get('error', 'Error desconocido'))
    except Exception as e:
        print_error(f"Excepción: {str(e)}")

# Ejecutar todos los tests
if __name__ == "__main__":
    print("\n" + "="*60)
    print("  TESTING: Sistema de Reservas con Cuenta Opcional")
    print("="*60)

    # Test 1: Reserva sin cuenta
    resultado1 = test_reserva_sin_cuenta()

    # Test 2: Reserva con cuenta
    resultado2 = test_reserva_con_cuenta()

    # Test 3: Acceso con token
    token = test_acceso_con_token()

    # Test 4: Activar cuenta
    if token:
        test_activar_cuenta(token)

    print("\n" + "="*60)
    print("  TESTS COMPLETADOS")
    print("="*60)
    print("\nREVISA LA CONSOLA DEL SERVIDOR DJANGO PARA VER LOS EMAILS")
    print("(Como DEBUG=True, los emails se imprimen en consola)\n")
