import pytest
from channels.testing import WebsocketCommunicator
from config.asgi import application

@pytest.mark.asyncio
async def test_auth_timeout():
    """Verifica que conexión sin auth se cierre en 10s."""
    # Path con slash inicial para WebsocketCommunicator
    # (routing.py tiene: re_path(r'ws/cocina/$', ...))
    communicator = WebsocketCommunicator(application, "/ws/cocina/")
    connected, _ = await communicator.connect()
    assert connected

    # Esperar timeout (10s + margen)
    response = await communicator.receive_output(timeout=12)
    assert response['type'] == 'websocket.close'
    assert response.get('code') == 4001

@pytest.mark.asyncio
async def test_invalid_token():
    """Verifica que token inválido cierre con 4002."""
    # Path con slash inicial para WebsocketCommunicator
    communicator = WebsocketCommunicator(application, "/ws/cocina/")
    await communicator.connect()

    await communicator.send_json_to({
        'type': 'authenticate',
        'token': 'token-invalido-123'
    })

    response = await communicator.receive_json_from()
    assert response['type'] == 'auth_failed'
    assert response['reason'] == 'invalid_token'
