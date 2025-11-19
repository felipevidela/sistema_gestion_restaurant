#!/usr/bin/env python
"""
Script de testing FRONTEND para el sistema de reservas con cuenta opcional.
Este script prueba la interfaz web y las funcionalidades del usuario.
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
    print(f"\n🔍 TEST: {message}")

def print_instruction(message):
    print(f"\n📋 INSTRUCCIÓN: {message}")

# TEST 1: Crear reserva SIN cuenta (checkbox desmarcado)
def test_reserva_sin_cuenta():
    print_section("TEST 1: Crear reserva SIN cuenta (checkbox desmarcado)")

    print_instruction("Abre el navegador en: http://localhost:5173")
    print_info("Deberías ver el formulario de reserva pública")

    fecha_reserva = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')

    datos_prueba = {
        "email": "invitado.frontend1@example.com",
        "nombre": "Pedro",
        "apellido": "Invitado",
        "rut": "12.345.678-9",
        "telefono": "+56 9 1234 5678",
        "mesa": "1",
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "15:00",
        "hora_fin": "17:00",
        "num_personas": "3"
    }

    print_instruction("Completa el formulario con estos datos:")
    for key, value in datos_prueba.items():
        print(f"  - {key}: {value}")

    print_instruction("IMPORTANTE: NO marques el checkbox 'Quiero crear una cuenta'")
    print_instruction("Los campos de contraseña NO deberían estar visibles")

    print_test("Verificando que el endpoint funciona correctamente...")

    # Test backend
    data = {
        "email": datos_prueba["email"],
        "password": "",
        "password_confirm": "",
        "nombre": datos_prueba["nombre"],
        "apellido": datos_prueba["apellido"],
        "rut": "12345678-9",
        "telefono": "+56912345678",
        "mesa": 1,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "15:00",
        "hora_fin": "17:00",
        "num_personas": 3
    }

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("✓ Backend: Reserva creada exitosamente")
            print_info(f"  - Es invitado: {result.get('es_invitado')}")
            print_info(f"  - Email: {result.get('email')}")
            print_info(f"  - Mesa: {result['reserva']['mesa_numero']}")

            if result.get('es_invitado') and 'token' not in result:
                print_success("✓ Usuario creado como invitado (sin token de auth)")
            else:
                print_error("✗ Usuario NO creado correctamente como invitado")

            if 'token_acceso' in result:
                print_success(f"✓ Token de acceso generado: {result['token_acceso'][:30]}...")
                print_info(f"\n📧 Revisa la consola de Django para ver el EMAIL enviado")
                print_info(f"   El email debería contener el link: http://localhost:5173/reserva/{result['token_acceso']}")

                return result['token_acceso']
            else:
                print_error("✗ No se generó token de acceso")
                return None
        else:
            print_error(f"✗ Error: {response.status_code}")
            print_error(response.json())
            return None
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None

# TEST 2: Crear reserva CON cuenta (checkbox marcado)
def test_reserva_con_cuenta():
    print_section("TEST 2: Crear reserva CON cuenta (checkbox marcado)")

    print_instruction("En el mismo formulario, haz scroll hacia arriba y presiona F5 para refrescar")

    fecha_reserva = (datetime.now() + timedelta(days=4)).strftime('%Y-%m-%d')

    datos_prueba = {
        "email": "usuario.frontend1@example.com",
        "nombre": "Ana",
        "apellido": "Registrada",
        "rut": "98.765.432-1",
        "telefono": "+56 9 8765 4321",
        "mesa": "2",
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "18:00",
        "hora_fin": "20:00",
        "num_personas": "4",
        "password": "MiPassword123!",
        "password_confirm": "MiPassword123!"
    }

    print_instruction("Completa el formulario con estos datos:")
    for key, value in datos_prueba.items():
        print(f"  - {key}: {value}")

    print_instruction("IMPORTANTE: SÍ marca el checkbox 'Quiero crear una cuenta'")
    print_instruction("Los campos de contraseña DEBEN aparecer y ser requeridos")

    print_test("Verificando que el endpoint funciona correctamente...")

    # Test backend
    data = {
        "email": datos_prueba["email"],
        "password": "MiPassword123!",
        "password_confirm": "MiPassword123!",
        "nombre": datos_prueba["nombre"],
        "apellido": datos_prueba["apellido"],
        "rut": "98765432-1",
        "telefono": "+56987654321",
        "mesa": 2,
        "fecha_reserva": fecha_reserva,
        "hora_inicio": "18:00",
        "hora_fin": "20:00",
        "num_personas": 4
    }

    try:
        response = requests.post(f"{BASE_URL}/register-and-reserve/", json=data)

        if response.status_code == 201:
            result = response.json()
            print_success("✓ Backend: Reserva creada exitosamente")
            print_info(f"  - Es invitado: {result.get('es_invitado')}")
            print_info(f"  - Email: {result.get('email')}")
            print_info(f"  - Mesa: {result['reserva']['mesa_numero']}")

            if not result.get('es_invitado') and 'token' in result:
                print_success("✓ Usuario creado con cuenta completa (con token de auth)")
                print_info(f"  - Token de autenticación: {result['token'][:30]}...")
            else:
                print_error("✗ Usuario NO creado correctamente con cuenta")

            print_info(f"\n📧 Revisa la consola de Django para ver el EMAIL enviado")
            print_info(f"   El email debería ser de tipo 'Usuario Registrado' (sin token de acceso)")

            return result
        else:
            print_error(f"✗ Error: {response.status_code}")
            print_error(response.json())
            return None
    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None

# TEST 3: Validaciones de password condicionales
def test_validaciones_password():
    print_section("TEST 3: Validaciones de password condicionales")

    print_instruction("Abre el formulario de nuevo (F5 para refrescar)")

    print_test("Prueba 1: Sin checkbox marcado, password vacío")
    print_instruction("1. NO marques el checkbox 'Quiero crear una cuenta'")
    print_instruction("2. Completa TODOS los campos EXCEPTO password")
    print_instruction("3. Haz clic en 'Crear Reserva'")
    print_instruction("   ✓ DEBERÍA permitir crear la reserva SIN password")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_test("Prueba 2: Con checkbox marcado, password vacío")
    print_instruction("1. Marca el checkbox 'Quiero crear una cuenta'")
    print_instruction("2. Los campos de password deberían aparecer")
    print_instruction("3. Deja los campos de password VACÍOS")
    print_instruction("4. Intenta crear la reserva")
    print_instruction("   ✓ DEBERÍA mostrar error: 'La contraseña es requerida para crear cuenta'")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_test("Prueba 3: Password muy corto")
    print_instruction("1. Con el checkbox marcado, ingresa password: '123'")
    print_instruction("2. Intenta crear la reserva")
    print_instruction("   ✓ DEBERÍA mostrar error sobre requisitos de password")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_test("Prueba 4: Passwords no coinciden")
    print_instruction("1. Password: 'MiPassword123!'")
    print_instruction("2. Confirmar: 'OtraPassword123!'")
    print_instruction("3. Intenta crear la reserva")
    print_instruction("   ✓ DEBERÍA mostrar error: 'Las contraseñas no coinciden'")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_success("✓ Test de validaciones completado")

# TEST 4: Acceso a reserva de invitado
def test_acceso_invitado(token):
    print_section("TEST 4: Acceso a reserva de invitado")

    if not token:
        print_error("No hay token disponible. Ejecuta primero el TEST 1")
        return

    url_acceso = f"http://localhost:5173/reserva/{token}"

    print_instruction(f"Abre esta URL en el navegador:\n  {url_acceso}")

    print_test("Deberías ver:")
    print_info("  ✓ Información de la reserva (mesa, fecha, hora, personas)")
    print_info("  ✓ Datos del cliente (nombre, email, teléfono)")
    print_info("  ✓ Botón 'Cancelar Reserva'")
    print_info("  ✓ Banner para activar cuenta (porque es invitado)")

    input("\nPresiona ENTER cuando hayas verificado esto...")

    print_test("Verificando que el endpoint funciona...")
    try:
        response = requests.get(f"{BASE_URL}/reserva-invitado/{token}/")
        if response.status_code == 200:
            data = response.json()
            print_success("✓ Endpoint de acceso funcionando")
            print_info(f"  - Mesa: {data['reserva']['mesa_numero']}")
            print_info(f"  - Cliente: {data['cliente']['nombre_completo']}")
        else:
            print_error(f"✗ Error: {response.status_code}")
    except Exception as e:
        print_error(f"Excepción: {str(e)}")

# TEST 5: Validación de fechas
def test_validacion_fechas():
    print_section("TEST 5: Validación de fechas mejorada")

    print_instruction("Abre el formulario de reserva (http://localhost:5173)")

    print_test("Prueba 1: Año inválido muy grande")
    print_instruction("1. Intenta ingresar la fecha: 275760-01-01")
    print_instruction("2. El campo de fecha debería:")
    print_instruction("   ✓ Mostrar mensaje de error")
    print_instruction("   ✓ No permitir enviar el formulario")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_test("Prueba 2: Año en el pasado")
    print_instruction("1. Intenta ingresar una fecha del año pasado")
    print_instruction("2. Debería mostrar error sobre años pasados")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_test("Prueba 3: Año muy en el futuro")
    current_year = datetime.now().year
    print_instruction(f"1. Intenta ingresar fecha: {current_year + 3}-01-01")
    print_instruction(f"2. Debería mostrar error: 'El año no puede ser mayor a {current_year + 2}'")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_success("✓ Test de validación de fechas completado")

# TEST 6: Mensajes de error en login
def test_mensajes_error_login():
    print_section("TEST 6: Mensajes de error mejorados en login")

    print_instruction("1. Abre http://localhost:5173")
    print_instruction("2. Haz clic en 'Iniciar Sesión' (esquina superior derecha)")

    print_test("Prueba 1: Credenciales incorrectas")
    print_instruction("1. Usuario: 'usuarioinexistente@example.com'")
    print_instruction("2. Password: 'PasswordIncorrecto123!'")
    print_instruction("3. Haz clic en 'Iniciar Sesión'")
    print_instruction("   ✓ DEBERÍA mostrar: 'Usuario o contraseña incorrectos...'")
    print_instruction("   ✓ NO DEBERÍA reiniciar la página sin mensaje")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_success("✓ Test de mensajes de error completado")

# TEST 7: Activar cuenta
def test_activar_cuenta(token):
    print_section("TEST 7: Activar cuenta de invitado")

    if not token:
        print_error("No hay token disponible. Ejecuta primero el TEST 1")
        return

    url_activacion = f"http://localhost:5173/activar-cuenta/{token}"

    print_instruction(f"Desde la página de la reserva, haz clic en 'Activar mi cuenta'")
    print_instruction(f"O abre directamente: {url_activacion}")

    print_test("Deberías ver:")
    print_info("  ✓ Formulario de activación de cuenta")
    print_info("  ✓ Información del perfil (nombre, email)")
    print_info("  ✓ Campos para ingresar nueva contraseña")

    print_instruction("\nIngresa estos datos:")
    print_instruction("  - Password: NuevoPassword123!")
    print_instruction("  - Confirmar: NuevoPassword123!")
    print_instruction("\nHaz clic en 'Activar Cuenta'")

    print_test("Después de activar:")
    print_info("  ✓ Deberías ver mensaje de éxito")
    print_info("  ✓ Deberías ser redirigido al panel de usuario")
    print_info("  ✓ Deberías estar autenticado automáticamente")

    input("\nPresiona ENTER cuando hayas probado esto...")

    print_success("✓ Test de activación completado")

# Ejecutar todos los tests
if __name__ == "__main__":
    print("\n" + "="*70)
    print("  TESTING FRONTEND: Sistema de Reservas con Cuenta Opcional")
    print("="*70)
    print("\n⚠️  IMPORTANTE: Este es un test INTERACTIVO")
    print("   Necesitarás interactuar con el navegador y presionar ENTER")
    print("   para continuar entre tests.\n")

    input("Presiona ENTER para comenzar...")

    # TEST 1: Reserva sin cuenta
    token_invitado = test_reserva_sin_cuenta()
    input("\n✋ Presiona ENTER para continuar con el siguiente test...")

    # TEST 2: Reserva con cuenta
    test_reserva_con_cuenta()
    input("\n✋ Presiona ENTER para continuar con el siguiente test...")

    # TEST 3: Validaciones de password
    test_validaciones_password()
    input("\n✋ Presiona ENTER para continuar con el siguiente test...")

    # TEST 4: Acceso a reserva de invitado
    if token_invitado:
        test_acceso_invitado(token_invitado)
        input("\n✋ Presiona ENTER para continuar con el siguiente test...")

    # TEST 5: Validación de fechas
    test_validacion_fechas()
    input("\n✋ Presiona ENTER para continuar con el siguiente test...")

    # TEST 6: Mensajes de error en login
    test_mensajes_error_login()
    input("\n✋ Presiona ENTER para continuar con el siguiente test...")

    # TEST 7: Activar cuenta
    if token_invitado:
        test_activar_cuenta(token_invitado)

    print("\n" + "="*70)
    print("  TESTS COMPLETADOS")
    print("="*70)
    print("\n📊 RESUMEN:")
    print("  ✓ Reserva sin cuenta (invitado)")
    print("  ✓ Reserva con cuenta (usuario registrado)")
    print("  ✓ Validaciones condicionales de password")
    print("  ✓ Acceso a reserva de invitado")
    print("  ✓ Validación de fechas mejorada")
    print("  ✓ Mensajes de error en login")
    print("  ✓ Activación de cuenta")
    print("\n🎉 ¡Todos los tests han sido ejecutados!")
    print("   Revisa la consola de Django para ver los emails enviados.\n")
