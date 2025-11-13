from rest_framework.permissions import BasePermission


class IsAdministrador(BasePermission):
    """
    Permite acceso solo a usuarios con rol 'Administrador'.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            return request.user.perfil.rol == 'admin'
        except AttributeError:
            # Si el usuario no tiene perfil, denegar acceso
            return False


class IsCajero(BasePermission):
    """
    Permite acceso solo a usuarios con rol 'Cajero'.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            return request.user.perfil.rol == 'cajero'
        except AttributeError:
            return False


class IsMesero(BasePermission):
    """
    Permite acceso solo a usuarios con rol 'Mesero'.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            return request.user.perfil.rol == 'mesero'
        except AttributeError:
            return False


class IsCliente(BasePermission):
    """
    Permite acceso solo a usuarios con rol 'Cliente'.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            return request.user.perfil.rol == 'cliente'
        except AttributeError:
            return False


class IsAdminOrCajero(BasePermission):
    """
    Permite acceso a usuarios con rol 'Administrador' o 'Cajero'.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            return request.user.perfil.rol in ['admin', 'cajero']
        except AttributeError:
            return False


class IsAdminOrCajeroOrMesero(BasePermission):
    """
    Permite acceso a usuarios con rol 'Administrador', 'Cajero' o 'Mesero'.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            return request.user.perfil.rol in ['admin', 'cajero', 'mesero']
        except AttributeError:
            return False

