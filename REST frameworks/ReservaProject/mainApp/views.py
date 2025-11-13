from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Q
from datetime import date

from rest_framework import viewsets, views, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend

from .models import Mesa, Perfil, Reserva
from .serializers import (
    MesaSerializer,
    PerfilSerializer,
    ReservaSerializer,
    ReservaListSerializer,
    UserSerializer
)
from .permissions import (
    IsAdministrador,
    IsCajero,
    IsMesero,
    IsCliente,
    IsAdminOrCajero,
    IsAdminOrCajeroOrMesero
)


# ============ ENDPOINTS DE AUTENTICACIÓN ============

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    Endpoint para registrar un nuevo usuario (Cliente).
    POST /api/register/
    Body: {username, email, password, first_name, last_name}
    """
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Asegurar que el perfil se creó (debería hacerlo el signal)
        if not hasattr(user, 'perfil'):
            Perfil.objects.create(user=user, rol='cliente')

        # Generar token
        token, created = Token.objects.get_or_create(user=user)

        return Response({
            'user': serializer.data,
            'token': token.key,
            'rol': user.perfil.rol,
            'message': 'Usuario registrado exitosamente'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """
    Endpoint para login de usuario.
    POST /api/login/
    Body: {username, password}
    """
    from django.contrib.auth import authenticate

    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Por favor proporcione username y password'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)

    if user:
        token, created = Token.objects.get_or_create(user=user)

        # Asegurar que tiene perfil
        if not hasattr(user, 'perfil'):
            Perfil.objects.create(user=user, rol='cliente')

        return Response({
            'token': token.key,
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'rol': user.perfil.rol,
            'rol_display': user.perfil.get_rol_display(),
            'nombre_completo': user.perfil.nombre_completo,
        }, status=status.HTTP_200_OK)

    return Response(
        {'error': 'Credenciales inválidas'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_perfil(request):
    """
    Endpoint para obtener el perfil del usuario autenticado.
    GET /api/perfil/
    """
    try:
        perfil = request.user.perfil
        serializer = PerfilSerializer(perfil, context={'request': request})
        return Response(serializer.data)
    except AttributeError:
        return Response(
            {'error': 'El usuario no tiene perfil asociado'},
            status=status.HTTP_404_NOT_FOUND
        )


# ============ ENDPOINTS DE GESTIÓN DE USUARIOS (ADMIN) ============

@api_view(['GET'])
@permission_classes([IsAdministrador])
def listar_usuarios(request):
    """
    Endpoint para listar todos los usuarios del sistema (solo Admin).
    GET /api/usuarios/
    """
    usuarios = User.objects.all().select_related('perfil')

    data = []
    for usuario in usuarios:
        try:
            data.append({
                'id': usuario.id,
                'username': usuario.username,
                'email': usuario.email,
                'first_name': usuario.first_name,
                'last_name': usuario.last_name,
                'rol': usuario.perfil.rol,
                'rol_display': usuario.perfil.get_rol_display(),
                'nombre_completo': usuario.perfil.nombre_completo,
                'fecha_registro': usuario.date_joined,
                'last_login': usuario.last_login,
            })
        except AttributeError:
            # Usuario sin perfil, crearlo
            Perfil.objects.create(user=usuario, rol='cliente')
            data.append({
                'id': usuario.id,
                'username': usuario.username,
                'email': usuario.email,
                'first_name': usuario.first_name,
                'last_name': usuario.last_name,
                'rol': 'cliente',
                'rol_display': 'Cliente',
                'nombre_completo': '',
                'fecha_registro': usuario.date_joined,
                'last_login': usuario.last_login,
            })

    return Response(data)


@api_view(['PATCH'])
@permission_classes([IsAdministrador])
def cambiar_rol_usuario(request, user_id):
    """
    Endpoint para cambiar el rol de un usuario (solo Admin).
    PATCH /api/usuarios/{id}/cambiar-rol/
    Body: {rol: 'admin'|'cajero'|'mesero'|'cliente'}
    """
    try:
        usuario = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    nuevo_rol = request.data.get('rol')

    if not nuevo_rol:
        return Response(
            {'error': 'El campo "rol" es requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if nuevo_rol not in ['admin', 'cajero', 'mesero', 'cliente']:
        return Response(
            {'error': 'Rol inválido. Debe ser: admin, cajero, mesero o cliente'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Asegurar que el usuario tenga perfil
    try:
        perfil = usuario.perfil
    except AttributeError:
        perfil = Perfil.objects.create(user=usuario, rol='cliente')

    perfil.rol = nuevo_rol
    perfil.save()

    return Response({
        'success': True,
        'message': f'Rol actualizado a {perfil.get_rol_display()}',
        'usuario': {
            'id': usuario.id,
            'username': usuario.username,
            'rol': perfil.rol,
            'rol_display': perfil.get_rol_display(),
        }
    })


# ============ ENDPOINTS DE MESAS ============

class MesaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para el CRUD completo de Mesas.
    Solo los Administradores pueden modificar.
    Admin, Cajero y Mesero pueden consultar.
    """
    queryset = Mesa.objects.all()
    serializer_class = MesaSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAdminOrCajeroOrMesero]
        else:
            permission_classes = [IsAdministrador]
        return [permission() for permission in permission_classes]


class ConsultaMesasView(views.APIView):
    """
    Endpoint de consulta de mesas (HU-08)
    Protegido por: Admin, Cajero o Mesero
    """
    permission_classes = [IsAdminOrCajeroOrMesero]

    def get(self, request):
        estado = request.query_params.get('estado', None)

        if estado:
            mesas = Mesa.objects.filter(estado=estado)
        else:
            mesas = Mesa.objects.all()

        serializer = MesaSerializer(mesas, many=True)
        return Response(serializer.data)


# ============ ENDPOINTS DE RESERVAS ============

class ReservaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para el CRUD de Reservas.
    - Admin y Cajero: acceso completo
    - Cliente: solo sus propias reservas
    - Filtros: fecha, estado
    """
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['estado', 'fecha_reserva', 'mesa']
    ordering_fields = ['fecha_reserva', 'hora_inicio', 'created_at']
    ordering = ['-fecha_reserva', '-hora_inicio']

    def get_permissions(self):
        if self.action in ['create']:
            # Cualquier usuario autenticado puede crear reserva
            permission_classes = [IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Solo admin y cajero pueden modificar/eliminar
            permission_classes = [IsAdminOrCajero]
        else:
            # Para list y retrieve, cualquier autenticado
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Filtrar reservas según el rol del usuario.
        - Admin y Cajero: todas las reservas
        - Cliente: solo sus propias reservas
        """
        user = self.request.user

        try:
            if user.perfil.rol in ['admin', 'cajero', 'mesero']:
                queryset = Reserva.objects.all()
            else:
                # Cliente solo ve sus reservas
                queryset = Reserva.objects.filter(cliente=user)
        except AttributeError:
            queryset = Reserva.objects.filter(cliente=user)

        # Filtro por fecha (para HU-17: reservas del día)
        fecha = self.request.query_params.get('date', None)
        if fecha == 'today':
            queryset = queryset.filter(fecha_reserva=date.today())
        elif fecha:
            queryset = queryset.filter(fecha_reserva=fecha)

        return queryset

    def perform_create(self, serializer):
        """
        Al crear una reserva, asignar el usuario autenticado como cliente
        y actualizar el estado de la mesa a 'reservada'.
        """
        reserva = serializer.save(cliente=self.request.user)

        # Actualizar estado de la mesa
        mesa = reserva.mesa
        if mesa.estado == 'disponible':
            mesa.estado = 'reservada'
            mesa.save()

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminOrCajero])
    def cambiar_estado(self, request, pk=None):
        """
        Endpoint personalizado para cambiar el estado de una reserva.
        PATCH /api/reservas/{id}/cambiar_estado/
        Body: {estado: 'activa'|'completada'|'cancelada'|'pendiente'}
        """
        reserva = self.get_object()
        nuevo_estado = request.data.get('estado')

        if nuevo_estado not in ['activa', 'completada', 'cancelada', 'pendiente']:
            return Response(
                {'error': 'Estado inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Actualizar estado de la reserva
        reserva.estado = nuevo_estado

        # Actualizar estado de la mesa según el estado de la reserva
        if nuevo_estado == 'activa':
            reserva.mesa.estado = 'ocupada'
        elif nuevo_estado in ['completada', 'cancelada']:
            reserva.mesa.estado = 'disponible'
        elif nuevo_estado == 'pendiente':
            reserva.mesa.estado = 'reservada'

        reserva.mesa.save()
        reserva.save()

        serializer = self.get_serializer(reserva)
        return Response(serializer.data)