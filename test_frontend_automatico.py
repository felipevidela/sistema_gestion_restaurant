#!/usr/bin/env python
"""
Script de testing AUTOMATIZADO para el sistema de reservas con cuenta opcional.
Este script ejecuta tests automáticos del backend y proporciona instrucciones para el frontend.
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api"
FRONTEND_URL = "http://localhost:5173"

def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

def print_test(message):
    print(f"\n🔍 {message}")

def print_instruction(message):
    print(f"📋 {message}")

# TEST 1: Crear reserva SIN cuenta (checkbox desmarcado)
def test_reserva_sin_cuenta():
    print_section("TEST 1: Reserva SIN cuenta (API Backend)")

    fecha_reserva = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')

    data = {
        "email": "invitado.frontend.auto1@example.com",
        "password": "",
        "password_confirm": "",
        "nombre": "Pedro",
        "apellido": "Invitado",
        "rut": "12345678-5",
        "telefono": "+56912345678",
        "mesa": 1,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "15:00",
        "hora_fin": "17:00",
        "num_personas": 3
    }

    print_info(f"Creando reserva SIN cuenta para: {data['email']}")
    print_info(f"Fecha: {fecha_reserva} | Mesa: {data['mesa']} | Personas: {data['num_personas']}")

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("Reserva creada exitosamente")
            print_info(f"  Es invitado: {result.get('es_invitado')}")
            print_info(f"  Email: {result.get('email')}")
            print_info(f"  Mesa: {result['reserva']['mesa_numero']}")

            # Verificar que es invitado
            if result.get('es_invitado'):
                print_success("✓ Usuario marcado como invitado (correcto)")
            else:
                print_error("✗ Usuario NO marcado como invitado (incorrecto)")

            # Verificar que NO tiene token de autenticación
            if 'token' not in result:
                print_success("✓ Invitado NO recibió token de autenticación (correcto)")
            else:
                print_error("✗ Invitado recibió token de autenticación (incorrecto)")

            # Verificar que SÍ tiene token de acceso
            if 'token_acceso' in result:
                print_success(f"✓ Token de acceso generado")
                print_info(f"  Token: {result['token_acceso'][:40]}...")
                print_info(f"  Link: http://localhost:5173/reserva/{result['token_acceso']}")
                return result['token_acceso']
            else:
                print_error("✗ No se generó token de acceso")
                return None
        else:
            print_error(f"Error al crear reserva: {response.status_code}")
            print_error(response.json())
            return None
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None

# TEST 2: Crear reserva CON cuenta (checkbox marcado)
def test_reserva_con_cuenta():
    print_section("TEST 2: Reserva CON cuenta (API Backend)")

    fecha_reserva = (datetime.now() + timedelta(days=4)).strftime('%Y-%m-%d')

    data = {
        "email": "usuario.frontend.auto1@example.com",
        "password": "MiPassword123!",
        "password_confirm": "MiPassword123!",
        "nombre": "Ana",
        "apellido": "Registrada",
        "rut": "19876543-2",
        "telefono": "+56987654321",
        "mesa": 2,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "18:00",
        "hora_fin": "20:00",
        "num_personas": 4
    }

    print_info(f"Creando reserva CON cuenta para: {data['email']}")
    print_info(f"Fecha: {fecha_reserva} | Mesa: {data['mesa']} | Personas: {data['num_personas']}")

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("Reserva creada exitosamente")
            print_info(f"  Es invitado: {result.get('es_invitado')}")
            print_info(f"  Email: {result.get('email')}")
            print_info(f"  Mesa: {result['reserva']['mesa_numero']}")

            # Verificar que NO es invitado
            if not result.get('es_invitado'):
                print_success("✓ Usuario NO marcado como invitado (correcto)")
            else:
                print_error("✗ Usuario marcado como invitado (incorrecto)")

            # Verificar que SÍ tiene token de autenticación
            if 'token' in result:
                print_success("✓ Usuario registrado recibió token de autenticación (correcto)")
                print_info(f"  Token: {result['token'][:40]}...")
            else:
                print_error("✗ Usuario registrado NO recibió token de autenticación (incorrecto)")

            # No debería tener token de acceso (es usuario registrado)
            if 'token_acceso' not in result:
                print_success("✓ Usuario registrado NO recibió token de acceso (correcto)")
            else:
                print_info(f"  Token de acceso: {result.get('token_acceso', 'N/A')}")

            return result
        else:
            print_error(f"Error al crear reserva: {response.status_code}")
            print_error(response.json())
            return None
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None

# TEST 3: Verificar token de invitado
def test_verificar_token(token):
    print_section("TEST 3: Verificar token de invitado (API Backend)")

    if not token:
        print_error("No hay token disponible")
        return False

    print_info(f"Verificando token: {token[:40]}...")

    try:
        response = requests.get(f"{BASE_URL}/verificar-token/{token}/")

        if response.status_code == 200:
            data = response.json()
            print_success("Token verificado correctamente")
            print_info(f"  Email: {data.get('email')}")
            print_info(f"  Nombre: {data.get('nombre_completo')}")
            print_info(f"  Es invitado: {data.get('es_invitado')}")
            print_info(f"  Token válido: {data.get('token_valido')}")
            return True
        else:
            print_error(f"Error al verificar token: {response.status_code}")
            print_error(response.json())
            return False
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return False

# TEST 4: Ver reserva de invitado
def test_ver_reserva_invitado(token):
    print_section("TEST 4: Ver reserva de invitado (API Backend)")

    if not token:
        print_error("No hay token disponible")
        return False

    print_info(f"Obteniendo reserva con token...")

    try:
        response = requests.get(f"{BASE_URL}/reserva-invitado/{token}/")

        if response.status_code == 200:
            data = response.json()
            print_success("Reserva obtenida correctamente")
            print_info(f"  Mesa: {data['reserva']['mesa_numero']}")
            print_info(f"  Fecha: {data['reserva']['fecha_reserva']}")
            print_info(f"  Hora: {data['reserva']['hora_inicio']} - {data['reserva']['hora_fin']}")
            print_info(f"  Cliente: {data['cliente']['nombre_completo']}")
            print_info(f"  Email: {data['cliente']['email']}")
            print_info(f"  Teléfono: {data['cliente']['telefono']}")
            return True
        else:
            print_error(f"Error al ver reserva: {response.status_code}")
            print_error(response.json())
            return False
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return False

# TEST 5: Activar cuenta de invitado
def test_activar_cuenta(token):
    print_section("TEST 5: Activar cuenta de invitado (API Backend)")

    if not token:
        print_error("No hay token disponible")
        return False

    data = {
        "token": token,
        "password": "NuevoPassword123!",
        "password_confirm": "NuevoPassword123!"
    }

    print_info(f"Activando cuenta con nueva contraseña...")

    try:
        response = requests.post(f"{BASE_URL}/activar-cuenta/", json=data)

        if response.status_code == 200:
            result = response.json()
            print_success("Cuenta activada exitosamente")
            print_info(f"  Email: {result.get('email')}")
            print_info(f"  Username: {result.get('username')}")
            print_info(f"  Token auth: {result['token'][:40]}...")
            print_success("✓ Usuario puede ahora hacer login con su contraseña")
            return True
        else:
            print_error(f"Error al activar cuenta: {response.status_code}")
            error_data = response.json()
            print_error(error_data.get('error', 'Error desconocido'))
            return False
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return False

# TEST 6: Validación de password - Invitado sin password
def test_validacion_invitado_sin_password():
    print_section("TEST 6: Validación - Invitado SIN password debe funcionar")

    fecha_reserva = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')

    data = {
        "email": "test.validacion1@example.com",
        "password": "",  # Vacío
        "password_confirm": "",  # Vacío
        "nombre": "Test",
        "apellido": "Validacion1",
        "rut": "11111111-1",
        "telefono": "+56911111111",
        "mesa": 1,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "12:00",
        "hora_fin": "14:00",
        "num_personas": 2
    }

    print_info("Intentando crear reserva SIN password (debería funcionar)...")

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("✓ Reserva creada SIN password (correcto)")
            print_info(f"  Es invitado: {result.get('es_invitado')}")
            return True
        else:
            print_error(f"✗ No permitió crear reserva sin password: {response.status_code}")
            print_error(response.json())
            return False
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return False

# TEST 7: Validación de password - Usuario registrado requiere password
def test_validacion_usuario_requiere_password():
    print_section("TEST 7: Validación - Usuario CON cuenta requiere password válido")

    fecha_reserva = (datetime.now() + timedelta(days=6)).strftime('%Y-%m-%d')

    # Caso 1: Password muy corto
    print_test("Caso 1: Password muy corto")
    data = {
        "email": "test.validacion2@example.com",
        "password": "123",  # Muy corto
        "password_confirm": "123",
        "nombre": "Test",
        "apellido": "Validacion2",
        "rut": "22222222-2",
        "telefono": "+56922222222",
        "mesa": 2,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "12:00",
        "hora_fin": "14:00",
        "num_personas": 2
    }

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code != 201:
            print_success("✓ Rechazó password muy corto (correcto)")
        else:
            print_error("✗ Aceptó password muy corto (incorrecto)")
    except Exception as e:
        print_error(f"Excepción: {str(e)}")

    # Caso 2: Passwords no coinciden
    print_test("Caso 2: Passwords no coinciden")
    data["password"] = "Password123!"
    data["password_confirm"] = "OtraPassword123!"
    data["email"] = "test.validacion3@example.com"

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code != 201:
            print_success("✓ Rechazó passwords que no coinciden (correcto)")
        else:
            print_error("✗ Aceptó passwords diferentes (incorrecto)")
    except Exception as e:
        print_error(f"Excepción: {str(e)}")

# TEST 8: Validación de fechas
def test_validacion_fechas():
    print_section("TEST 8: Validación de fechas")

    current_year = datetime.now().year

    # Caso 1: Año en el pasado
    print_test("Caso 1: Año en el pasado")
    data = {
        "email": "test.fecha1@example.com",
        "password": "",
        "password_confirm": "",
        "nombre": "Test",
        "apellido": "Fecha1",
        "rut": "33333333-3",
        "telefono": "+56933333333",
        "mesa": 1,
        "fecha_reserva": f"{current_year - 1}-01-01",  # Año pasado
        "hora_inicio": "12:00",
        "hora_fin": "14:00",
        "num_personas": 2
    }

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code != 201:
            print_success("✓ Rechazó fecha en el pasado (correcto)")
        else:
            print_error("✗ Aceptó fecha en el pasado (incorrecto)")
    except Exception as e:
        print_error(f"Excepción: {str(e)}")

    # Caso 2: Año muy en el futuro
    print_test("Caso 2: Año muy en el futuro")
    data["email"] = "test.fecha2@example.com"
    data["fecha_reserva"] = f"{current_year + 10}-01-01"  # 10 años adelante

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code != 201:
            print_success("✓ Rechazó fecha muy en el futuro (correcto)")
        else:
            print_error("✗ Aceptó fecha muy en el futuro (incorrecto)")
    except Exception as e:
        print_error(f"Excepción: {str(e)}")

# Instrucciones para tests manuales en el frontend
def mostrar_instrucciones_frontend():
    print_section("INSTRUCCIONES PARA TESTS MANUALES EN EL FRONTEND")

    print_instruction("\n🌐 Abre el navegador en: http://localhost:5173\n")

    print_info("TEST FRONTEND 1: Checkbox 'Quiero crear una cuenta'")
    print("  1. Observa que hay un checkbox: 'Quiero crear una cuenta'")
    print("  2. Por defecto, el checkbox está DESMARCADO")
    print("  3. Los campos de password NO deberían estar visibles")
    print("  4. Marca el checkbox ✓")
    print("  5. Los campos de password DEBEN aparecer")
    print("  6. Desmarca el checkbox")
    print("  7. Los campos de password DEBEN desaparecer")

    print_info("\nTEST FRONTEND 2: Validación de fechas en UI")
    print("  1. En el campo de fecha, intenta escribir: 2757-01-01")
    print("  2. Debería mostrar un mensaje de error sobre el año")
    print("  3. El formulario NO debería permitir enviarse")

    print_info("\nTEST FRONTEND 3: Mensajes de error en Login")
    print("  1. Haz clic en 'Iniciar Sesión' (esquina superior derecha)")
    print("  2. Ingresa credenciales incorrectas:")
    print("     - Usuario: usuario@noexiste.com")
    print("     - Password: PasswordIncorrecto123!")
    print("  3. Haz clic en 'Iniciar Sesión'")
    print("  4. Debería mostrar: 'Usuario o contraseña incorrectos...'")
    print("  5. NO debería reiniciar la página sin mensaje")

    print_info("\nTEST FRONTEND 4: Ver reserva de invitado")
    print("  1. Usa el link generado en TEST 1 arriba")
    print("  2. Debería mostrar los detalles de la reserva")
    print("  3. Debería haber un banner para 'Activar cuenta'")
    print("  4. Debería haber un botón para 'Cancelar Reserva'")

    print_info("\nTEST FRONTEND 5: Activar cuenta")
    print("  1. Desde la página de reserva de invitado, haz clic en 'Activar cuenta'")
    print("  2. Ingresa una nueva contraseña")
    print("  3. Debería activarse la cuenta y hacer login automático")

# Ejecutar todos los tests
if __name__ == "__main__":
    print("\n" + "="*70)
    print("  TESTING AUTOMATIZADO: Sistema de Reservas con Cuenta Opcional")
    print("="*70)
    print("\n🤖 Este script ejecuta tests automáticos del backend")
    print("   y proporciona instrucciones para tests manuales del frontend\n")

    # Tests automáticos del backend
    print_section("TESTS AUTOMÁTICOS DEL BACKEND")

    # TEST 1: Reserva sin cuenta
    token_invitado = test_reserva_sin_cuenta()

    # TEST 2: Reserva con cuenta
    test_reserva_con_cuenta()

    # TEST 3: Verificar token
    if token_invitado:
        test_verificar_token(token_invitado)

    # TEST 4: Ver reserva
    if token_invitado:
        test_ver_reserva_invitado(token_invitado)

    # TEST 5: Activar cuenta
    if token_invitado:
        test_activar_cuenta(token_invitado)

    # TEST 6: Validaciones - invitado sin password
    test_validacion_invitado_sin_password()

    # TEST 7: Validaciones - password requerido
    test_validacion_usuario_requiere_password()

    # TEST 8: Validación de fechas
    test_validacion_fechas()

    # Instrucciones para tests manuales
    mostrar_instrucciones_frontend()

    print("\n" + "="*70)
    print("  TESTS COMPLETADOS")
    print("="*70)
    print("\n✅ Tests automáticos del backend: COMPLETADOS")
    print("📋 Sigue las instrucciones arriba para probar el frontend manualmente")
    print("\n📧 Revisa la consola de Django para ver los emails enviados")
    print("   (Los emails se imprimen en consola porque DEBUG=True)\n")
