#!/usr/bin/env python3
"""
Script de testing para verificar conexión WebSocket
Uso: python test_websocket.py <token>
"""
import asyncio
import websockets
import json
import sys

async def test_websocket_connection(token):
    """Test WebSocket connection con autenticación"""
    # URL WebSocket (ajustar según tu configuración)
    url = f"ws://localhost:8000/ws/cocina/cola/?token={token}"

    print(f"🔌 Conectando a: {url}")

    try:
        async with websockets.connect(url) as websocket:
            print("✅ Conexión WebSocket establecida")

            # Esperar mensaje de bienvenida
            welcome = await websocket.recv()
            data = json.loads(welcome)
            print(f"📨 Mensaje recibido: {json.dumps(data, indent=2)}")

            # Enviar ping
            print("\n🏓 Enviando ping...")
            await websocket.send(json.dumps({"type": "ping"}))

            # Esperar pong
            pong = await websocket.recv()
            print(f"📨 Respuesta: {pong}")

            print("\n✅ Test exitoso! WebSocket funcionando correctamente")
            print("💡 Tip: Abre PanelCocina en el navegador y crea un pedido")
            print("         Deberías ver la notificación aquí en tiempo real")

            # Mantener conexión abierta por 30 segundos para testing manual
            print("\n⏱️  Manteniendo conexión abierta por 30s para testing...")
            print("   (Presiona Ctrl+C para salir)\n")

            for i in range(30):
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    event = data.get('event', 'unknown')
                    pedido_id = data.get('pedido', {}).get('id', 'N/A')
                    print(f"🔔 [{i+1}s] Evento: {event} | Pedido ID: {pedido_id}")
                except asyncio.TimeoutError:
                    pass

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ Error de autenticación: {e}")
        print("   Verifica que el token sea válido")
    except ConnectionRefusedError:
        print("❌ Error: No se pudo conectar al servidor")
        print("   Asegúrate de que el backend esté corriendo en puerto 8000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Uso: python test_websocket.py <token>")
        print("\n💡 Para obtener tu token:")
        print("   1. Abre DevTools en el navegador (F12)")
        print("   2. Ve a Console")
        print("   3. Ejecuta: localStorage.getItem('token')")
        print("   4. Copia el token y ejecútalo aquí")
        sys.exit(1)

    token = sys.argv[1]
    print("🚀 Iniciando test de WebSocket...\n")
    asyncio.run(test_websocket_connection(token))
