"""
Adaptador de compatibilidad para Railway.

El proyecto Django real vive en ``/app/ReservaProject`` con el módulo
``ReservaProject.wsgi``. Sin embargo, algunos despliegues siguen intentando
importar ``Reservas.wsgi``. Este archivo redirige esa importación al backend
correcto sin tener que tocar la configuración en Railway.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent

# En desarrollo local el backend vive en "REST frameworks/ReservaProject".
# En Docker ya está plano en "/app/ReservaProject".
CANDIDATES = [
    _ROOT / "ReservaProject",
    _ROOT / "REST frameworks" / "ReservaProject",
]

BACKEND_ROOT = next((path for path in CANDIDATES if path.exists()), CANDIDATES[0])

# Asegura que Python pueda importar `ReservaProject`.
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Configura el módulo de settings esperado por Django.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ReservaProject.settings")

# Reutiliza el WSGI oficial del proyecto.
from ReservaProject.wsgi import application  # noqa: E402  (import tardío intencional)

__all__ = ("application",)
