from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone

from rest_framework import viewsets, views, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.throttling import AnonRateThrottle
from django_filters.rest_framework import DjangoFilterBackend

from .models import Mesa, Perfil, Reserva
from .serializers import (
    MesaSerializer,
    PerfilSerializer,
    ReservaSerializer,
    ReservaListSerializer,
    UserSerializer,
    RegisterSerializer
)
from .permissions import (
    IsAdministrador,
    IsCajero,
    IsMesero,
    IsCliente,
    IsAdminOrCajero,
    IsAdminOrCajeroOrMesero
)


# ============ THROTTLING CLASSES ============

class RegisterRateThrottle(AnonRateThrottle):
    """Rate limiting para registro: 5 intentos por hora"""
    scope = 'register'


class LoginRateThrottle(AnonRateThrottle):
    """Rate limiting para login: 10 intentos por hora"""
    scope = 'login'


# ============ ENDPOINTS DE AUTENTICACIÓN ============

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register_user(request):
    """
    Endpoint para registrar un nuevo usuario (Cliente) con datos completos del perfil.
    POST /api/register/
    Body: {
        username, email, password, password_confirm,
        nombre, apellido, rut, telefono, email_perfil (opcional)
    }
    Rate limit: 5 intentos por hora
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Generar token para auto-login después del registro
        token, created = Token.objects.get_or_create(user=user)

        return Response({
            'token': token.key,
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'rol': user.perfil.rol,
            'rol_display': user.perfil.get_rol_display(),
            'nombre_completo': user.perfil.nombre_completo,
            'message': 'Usuario registrado exitosamente'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register_and_reserve(request):
    """
    Endpoint combinado: registrar usuario y crear reserva en una sola transacción.
    Pensado para el flujo de reserva pública.
    POST /api/register-and-reserve/
    Body: {
        # Datos del usuario
        email, password, password_confirm, nombre, apellido, rut, telefono,
        # Datos de la reserva
        mesa, fecha_reserva, hora_inicio, num_personas, notas (opcional)
    }
    Rate limit: 5 intentos por hora
    """
    from django.db import transaction

    # Separar datos de usuario y reserva
    user_data = {
        'username': request.data.get('email'),  # Usar email como username
        'email': request.data.get('email'),
        'password': request.data.get('password'),
        'password_confirm': request.data.get('password_confirm'),
        'nombre': request.data.get('nombre'),
        'apellido': request.data.get('apellido'),
        'rut': request.data.get('rut'),
        'telefono': request.data.get('telefono'),
    }

    reserva_data = {
        'mesa': request.data.get('mesa'),
        'fecha_reserva': request.data.get('fecha_reserva'),
        'hora_inicio': request.data.get('hora_inicio'),
        'hora_fin': request.data.get('hora_fin'),
        'num_personas': request.data.get('num_personas'),
        'notas': request.data.get('notas', ''),
    }

    try:
        with transaction.atomic():
            # 1. Registrar usuario
            user_serializer = RegisterSerializer(data=user_data)
            if not user_serializer.is_valid():
                return Response({
                    'error': 'Datos de usuario inválidos',
                    'details': user_serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            user = user_serializer.save()

            # 2. Bloquear la mesa PRIMERO para evitar race conditions
            mesa_id = reserva_data.get('mesa')
            if not mesa_id:
                return Response({
                    'error': 'Debe seleccionar una mesa',
                    'details': {'mesa': ['Este campo es requerido']}
                }, status=status.HTTP_400_BAD_REQUEST)

            mesa = Mesa.objects.select_for_update().get(id=mesa_id)

            # 3. IMPORTANTE: Validar DESPUÉS de obtener el lock
            # Esto previene que dos usuarios reserven la misma mesa simultáneamente
            reserva_serializer = ReservaSerializer(data=reserva_data)
            if not reserva_serializer.is_valid():
                return Response({
                    'error': 'Datos de reserva inválidos',
                    'details': reserva_serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            reserva = reserva_serializer.save(cliente=user)

            # 3. Actualizar estado de la mesa
            if mesa.estado == 'disponible':
                mesa.estado = 'reservada'
                mesa.save()

            # 4. Generar token para auto-login
            token, created = Token.objects.get_or_create(user=user)

            return Response({
                'token': token.key,
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'rol': user.perfil.rol,
                'nombre_completo': user.perfil.nombre_completo,
                'reserva': {
                    'id': reserva.id,
                    'mesa_numero': reserva.mesa.numero,
                    'fecha_reserva': reserva.fecha_reserva,
                    'hora_inicio': reserva.hora_inicio,
                    'hora_fin': reserva.hora_fin,
                    'num_personas': reserva.num_personas,
                    'estado': reserva.estado,
                },
                'message': '¡Reserva creada exitosamente! Tu cuenta ha sido registrada.'
            }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({
            'error': 'Error al procesar la reserva',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_user(request):
    """
    Endpoint para login de usuario.
    Acepta username o email como identificador.
    POST /api/login/
    Body: {username (o email), password}
    Rate limit: 10 intentos por hora
    """
    from django.contrib.auth import authenticate

    identifier = request.data.get('username') or request.data.get('email')
    password = request.data.get('password')

    if not identifier or not password:
        return Response(
            {'error': 'Por favor proporcione email/usuario y contraseña'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Intentar autenticar por username
    user = authenticate(username=identifier, password=password)

    # Si falla, intentar buscar por email y autenticar
    if not user:
        try:
            user_by_email = User.objects.get(email=identifier)
            user = authenticate(username=user_by_email.username, password=password)
        except User.DoesNotExist:
            pass

    if user:
        # IMPORTANTE: Verificar que el usuario esté activo
        if not user.is_active:
            return Response(
                {'error': 'Esta cuenta ha sido desactivada'},
                status=status.HTTP_403_FORBIDDEN
            )
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


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_perfil(request):
    """
    Endpoint para actualizar el perfil del usuario autenticado.
    PATCH /api/perfil/actualizar/
    Body: {nombre, apellido, telefono (opcional), rut (opcional)}
    """
    try:
        perfil = request.user.perfil
    except AttributeError:
        # Si no existe perfil, crearlo
        perfil = Perfil.objects.create(user=request.user, rol='cliente')

    # Extraer datos del request
    nombre = request.data.get('nombre')
    apellido = request.data.get('apellido')
    telefono = request.data.get('telefono')
    rut = request.data.get('rut')

    # Validar campos requeridos
    if not nombre or not apellido:
        return Response(
            {'error': 'Nombre y apellido son requeridos'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Actualizar nombre_completo
    perfil.nombre_completo = f"{nombre.strip()} {apellido.strip()}"

    # Actualizar teléfono si se proporciona
    if telefono:
        perfil.telefono = telefono

    # Actualizar RUT si se proporciona
    if rut:
        perfil.rut = rut

    perfil.save()

    # Retornar perfil actualizado
    serializer = PerfilSerializer(perfil, context={'request': request})
    return Response({
        'success': True,
        'message': 'Perfil actualizado exitosamente',
        'perfil': serializer.data
    })


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

    def perform_update(self, serializer):
        """
        FIX #2 (CRÍTICO): Validar reservas antes de cambiar estado de mesa manualmente.

        IMPORTANTE: No permitir cambiar a 'disponible' si hay reservas activas/pendientes.
        El estado de la mesa debe ser manejado automáticamente por el sistema de reservas.
        """
        from rest_framework.exceptions import ValidationError

        mesa = self.get_object()
        nuevo_estado = serializer.validated_data.get('estado')

        # Si se está cambiando el estado de la mesa
        if nuevo_estado and nuevo_estado != mesa.estado:
            # Si se intenta marcar como 'disponible', verificar que no haya reservas activas
            if nuevo_estado == 'disponible':
                reservas_activas = Reserva.objects.filter(
                    mesa=mesa,
                    estado__in=['pendiente', 'activa']
                ).exists()

                if reservas_activas:
                    raise ValidationError({
                        'estado': 'No se puede marcar como disponible. La mesa tiene reservas pendientes o activas. '
                                  'Cancele o complete las reservas primero.'
                    })

        serializer.save()


class ConsultaMesasView(views.APIView):
    """
    Endpoint de consulta de mesas (HU-08)
    Accesible por: Todos (incluyendo usuarios no autenticados para reserva pública)

    Parámetros opcionales:
    - estado: filtrar por estado actual de la mesa
    - fecha: verificar disponibilidad para una fecha específica (YYYY-MM-DD)
    - hora: verificar disponibilidad para una hora específica (HH:MM)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        estado = request.query_params.get('estado', None)
        fecha_str = request.query_params.get('fecha', None)
        hora_str = request.query_params.get('hora', None)

        # Obtener todas las mesas o filtrar por estado
        if estado:
            mesas = Mesa.objects.filter(estado=estado)
        else:
            mesas = Mesa.objects.all()

        # Si se proporciona fecha y hora, filtrar mesas disponibles
        if fecha_str and hora_str:
            from datetime import datetime, timedelta

            try:
                fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
                hora_inicio = datetime.strptime(hora_str, '%H:%M').time()

                # Calcular hora fin (2 horas después)
                dt_inicio = datetime.combine(fecha, hora_inicio)
                dt_fin = dt_inicio + timedelta(hours=2)
                hora_fin = dt_fin.time()

                # Obtener mesas con reservas que se solapen
                mesas_ocupadas_ids = Reserva.objects.filter(
                    fecha_reserva=fecha,
                    estado__in=['pendiente', 'activa'],
                    # Verificar solapamiento de horarios:
                    # La nueva reserva se solapa si:
                    # - Su hora_inicio es antes de hora_fin de reserva existente Y
                    # - Su hora_fin es después de hora_inicio de reserva existente
                ).filter(
                    Q(hora_inicio__lt=hora_fin) & Q(hora_fin__gt=hora_inicio)
                ).values_list('mesa_id', flat=True)

                # Excluir mesas ocupadas
                mesas = mesas.exclude(id__in=mesas_ocupadas_ids)

            except ValueError:
                # Si hay error en el formato de fecha/hora, ignorar el filtro
                pass

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

        OPTIMIZACIÓN: Usa select_related para evitar N+1 queries
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

        # OPTIMIZACIÓN: Cargar relaciones en una sola query
        queryset = queryset.select_related('cliente', 'cliente__perfil', 'mesa')

        # Filtro por fecha (para HU-17: reservas del día)
        fecha = self.request.query_params.get('date', None)
        if fecha == 'today':
            queryset = queryset.filter(fecha_reserva=timezone.now().date())
        elif fecha:
            queryset = queryset.filter(fecha_reserva=fecha)

        return queryset

    def perform_create(self, serializer):
        """
        Al crear una reserva, asignar el usuario autenticado como cliente
        y actualizar el estado de la mesa a 'reservada'.

        IMPORTANTE: Usa transacción atómica y select_for_update() para evitar race conditions
        """
        from django.db import transaction

        with transaction.atomic():
            # Bloquear la mesa para evitar dobles reservas simultáneas
            mesa_id = serializer.validated_data['mesa'].id
            mesa = Mesa.objects.select_for_update().get(id=mesa_id)

            # Guardar la reserva
            reserva = serializer.save(cliente=self.request.user)

            # Actualizar estado de la mesa
            if mesa.estado == 'disponible':
                mesa.estado = 'reservada'
                mesa.save()

    def perform_update(self, serializer):
        """
        IMPORTANTE: Al actualizar una reserva, validar solapamientos y fecha pasada.

        Fix para #1 (CRÍTICO) y #3 (CRÍTICO):
        - Valida solapamiento de horarios en UPDATE/PATCH
        - Valida que no se modifiquen reservas de fechas pasadas
        """
        from django.db import transaction
        from rest_framework.exceptions import ValidationError

        reserva = self.get_object()

        # Validar que no se actualice una reserva de fecha pasada (usando timezone-aware date)
        if reserva.fecha_reserva < timezone.now().date():
            raise ValidationError({
                'fecha_reserva': 'No se pueden modificar reservas de fechas pasadas'
            })

        with transaction.atomic():
            # Si se está cambiando la mesa, bloquear la nueva mesa
            if 'mesa' in serializer.validated_data:
                nueva_mesa_id = serializer.validated_data['mesa'].id
                nueva_mesa = Mesa.objects.select_for_update().get(id=nueva_mesa_id)

            # Guardar con validación completa (ejecuta model.clean())
            serializer.save()

    def perform_destroy(self, instance):
        """
        FIX #6 (GRAVE): Al eliminar una reserva, actualizar estado de mesa.

        IMPORTANTE: Solo marcar como disponible si no hay otras reservas activas/pendientes.
        """
        from django.db import transaction

        with transaction.atomic():
            mesa = instance.mesa

            # Eliminar la reserva
            instance.delete()

            # Verificar si hay otras reservas activas/pendientes para esta mesa
            otras_reservas_activas = Reserva.objects.filter(
                mesa=mesa,
                estado__in=['pendiente', 'activa']
            ).exists()

            # Solo marcar como disponible si no hay otras reservas
            if not otras_reservas_activas:
                mesa.estado = 'disponible'
                mesa.save()

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminOrCajero])
    def cambiar_estado(self, request, pk=None):
        """
        Endpoint personalizado para cambiar el estado de una reserva.
        PATCH /api/reservas/{id}/cambiar_estado/
        Body: {estado: 'activa'|'completada'|'cancelada'|'pendiente'}

        IMPORTANTE (Fase 3 fixes):
        - #5 CRÍTICO: Previene cancelación de reservas pasadas
        - #19 MODERADO: Valida transiciones de estado válidas
        - #23 MODERADO: Locks para prevenir inconsistencias en cancelaciones múltiples
        - #13 MODERADO: Solo cambia estado de mesa si reserva es para hoy/futuro cercano
        """
        from django.db import transaction
        from datetime import timedelta

        # FIX #23 (MODERADO): Usar transacción con locks
        with transaction.atomic():
            # Bloquear la reserva y la mesa para prevenir race conditions
            reserva = Reserva.objects.select_for_update().select_related('mesa').get(pk=pk)
            nuevo_estado = request.data.get('estado')

            if nuevo_estado not in ['activa', 'completada', 'cancelada', 'pendiente']:
                return Response(
                    {'error': 'Estado inválido'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # FIX #5 (CRÍTICO): Validar que no se modifiquen reservas de fechas pasadas (timezone-aware)
            if reserva.fecha_reserva < timezone.now().date():
                return Response(
                    {'error': 'No se pueden modificar reservas de fechas pasadas'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # FIX #19 (MODERADO): Validar transiciones de estado válidas
            transiciones_validas = {
                'pendiente': ['activa', 'cancelada'],
                'activa': ['completada', 'cancelada'],
                'completada': [],  # Estado final, no se puede cambiar
                'cancelada': []     # Estado final, no se puede cambiar
            }

            if nuevo_estado not in transiciones_validas.get(reserva.estado, []):
                return Response({
                    'error': f'Transición inválida de {reserva.estado} a {nuevo_estado}',
                    'transiciones_validas': transiciones_validas.get(reserva.estado, [])
                }, status=status.HTTP_400_BAD_REQUEST)

            # Actualizar estado de la reserva
            reserva.estado = nuevo_estado

            # FIX #13 (MODERADO): Solo actualizar estado de mesa si la reserva es para hoy o futuro cercano
            # No tiene sentido cambiar el estado de la mesa por una reserva de dentro de 2 meses
            fecha_limite = timezone.now().date() + timedelta(days=1)  # Hoy o mañana
            debe_actualizar_mesa = reserva.fecha_reserva <= fecha_limite

            if debe_actualizar_mesa:
                # Actualizar estado de la mesa según el estado de la reserva
                if nuevo_estado == 'activa':
                    reserva.mesa.estado = 'ocupada'
                elif nuevo_estado in ['completada', 'cancelada']:
                    # IMPORTANTE: Solo marcar como disponible si no hay otras reservas activas/pendientes
                    otras_reservas_activas = Reserva.objects.filter(
                        mesa=reserva.mesa,
                        estado__in=['pendiente', 'activa']
                    ).exclude(id=reserva.id).exists()

                    if not otras_reservas_activas:
                        reserva.mesa.estado = 'disponible'
                    # Si hay otras reservas, mantener el estado actual de la mesa
                elif nuevo_estado == 'pendiente':
                    reserva.mesa.estado = 'reservada'

                reserva.mesa.save()

            reserva.save()

            serializer = self.get_serializer(reserva)
            return Response(serializer.data)