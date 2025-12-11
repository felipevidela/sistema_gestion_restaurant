"""
Vista temporal para ejecutar comando de población de datos.
NOTA: Este archivo debe ser eliminado después de usar.
"""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.core.management import call_command
from io import StringIO
import sys
import json


# Token secreto temporal - cambiar antes de deploy
ADMIN_SECRET_TOKEN = "temp_poblacion_railway_2024_secure_token_xyz789"


@csrf_exempt
@require_http_methods(["POST"])
def poblar_datos_railway(request):
    """
    Endpoint temporal para ejecutar el comando de población.
    Requiere token secreto en header.
    """
    # Verificar token
    token = request.headers.get('X-Admin-Token')
    if token != ADMIN_SECRET_TOKEN:
        return JsonResponse({
            'error': 'Token inválido o faltante'
        }, status=401)

    # Parsear JSON del body
    try:
        data = json.loads(request.body.decode('utf-8'))
    except:
        data = {}

    # Parámetros del comando
    verbose = data.get('verbose', 'true') == 'true'
    dry_run = data.get('dry_run', 'false') == 'true'

    try:
        # Ejecutar comando sin capturar output
        # (el output irá a los logs de Railway)
        call_command(
            'poblar_railway_seguro',
            dry_run=dry_run,
            verbose=verbose
        )

        return JsonResponse({
            'success': True,
            'message': 'Comando ejecutado correctamente. Revisa los logs de Railway para ver el output.',
            'dry_run': dry_run
        })

    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)
