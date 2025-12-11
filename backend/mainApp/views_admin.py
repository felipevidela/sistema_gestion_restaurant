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

    # Capturar output del comando
    output = StringIO()
    old_stdout = sys.stdout
    old_stderr = sys.stderr

    try:
        sys.stdout = output
        sys.stderr = output

        # Ejecutar comando
        verbose = request.POST.get('verbose', 'true') == 'true'
        dry_run = request.POST.get('dry_run', 'false') == 'true'

        call_command(
            'poblar_railway_seguro',
            verbosity=2 if verbose else 1,
            dry_run=dry_run,
            verbose=verbose
        )

        result = output.getvalue()

        return JsonResponse({
            'success': True,
            'message': 'Comando ejecutado correctamente',
            'output': result,
            'dry_run': dry_run
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e),
            'output': output.getvalue()
        }, status=500)

    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
