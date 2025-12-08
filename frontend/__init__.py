"""
Permite que la carpeta del frontend actúe como un paquete Python.

Esto es necesario porque Railway intenta importar ``Reservas.wsgi`` por
compatibilidad con un deploy antiguo. El archivo real vive en ``Reservas/wsgi.py``.
"""

