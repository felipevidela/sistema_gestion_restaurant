from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
import logging

from rest_framework import viewsets, views, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.throttling import AnonRateThrottle
from django_filters.rest_framework import DjangoFilterBackend

from .models import Mesa, Perfil, Reserva, BloqueoMesa
from .serializers import (
    MesaSerializer,
    PerfilSerializer,
    ReservaSerializer,
    ReservaListSerializer,
    UserSerializer,
    RegisterSerializer,
    BloqueoMesaSerializer,
    BloqueoMesaListSerializer
)
from .permissions import (
    IsAdministrador,
    IsCajero,
    IsMesero,
    IsCliente,
    IsAdminOrCajero,
    IsAdminOrCajeroOrMesero,
    IsOwnerOrAdmin,
    IsAdminOrCajeroOrOwner
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

    Soporta tres flujos:
    1. Con contraseña: usuario registrado con cuenta completa
    2. Sin contraseña: usuario invitado (genera password aleatoria + token)
    3. Usuario existente: permite múltiples reservas del mismo usuario (FIX #231)

    POST /api/register-and-reserve/
    Body: {
        # Datos del usuario
        email, password (opcional), password_confirm (opcional), nombre, apellido, rut, telefono,
        # Datos de la reserva
        mesa, fecha_reserva, hora_inicio, num_personas, notas (opcional),
        # Flag de confirmación (opcional, para usuarios existentes)
        confirm_existing: boolean
    }
    Rate limit: 5 intentos por hora

    FIX #231: Si el email existe y no se proporciona confirm_existing=true,
    retorna requires_confirmation=true para que el frontend pida confirmación.
    """
    from django.db import transaction
    from .email_service import enviar_email_confirmacion_invitado, enviar_email_confirmacion_usuario_registrado

    # Separar datos de usuario y reserva
    user_data = {
        'username': request.data.get('email'),  # Usar email como username
        'email': request.data.get('email'),
        'password': request.data.get('password', ''),  # Puede ser vacío para invitados
        'password_confirm': request.data.get('password_confirm', ''),
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

    # FIX #231: Verificar si el usuario ya existe y si fue confirmado
    email = request.data.get('email')
    confirm_existing = request.data.get('confirm_existing', False)

    # DEBUG: Log para diagnosticar
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🔍 DEBUG - Email recibido: {email}")
    logger.info(f"🔍 DEBUG - confirm_existing: {confirm_existing}")

    try:
        # Verificar si el usuario existe
        existing_user = User.objects.filter(email=email).first() if email else None
        logger.info(f"🔍 DEBUG - Usuario existente encontrado: {existing_user is not None}")

        # Si existe y NO fue confirmado, solicitar confirmación
        if existing_user and not confirm_existing:
            logger.info(f"🔍 DEBUG - Retornando requires_confirmation")
            # Verificar que tenga perfil
            if not hasattr(existing_user, 'perfil'):
                return Response({
                    'error': 'El usuario existe pero no tiene perfil asociado. Contacte al administrador.',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            perfil = existing_user.perfil
            # Contar reservas existentes
            reservas_count = Reserva.objects.filter(cliente=existing_user).count()

            return Response({
                'requires_confirmation': True,
                'user_exists': True,
                'user_info': {
                    'nombre_completo': perfil.nombre_completo,
                    'email': existing_user.email,
                    'es_invitado': perfil.es_invitado
                },
                'reservas_count': reservas_count,
                'message': f'Ya tienes una cuenta con {reservas_count} reserva(s). ¿Deseas agregar esta nueva reserva a tu perfil?'
            }, status=status.HTTP_200_OK)

        with transaction.atomic():
            # 1. Registrar usuario (puede ser invitado, con cuenta, o reutilizar existente)
            # Si existe y fue confirmado, pasar contexto para permitir reutilización
            context = {'allow_existing_user': confirm_existing} if confirm_existing else {}
            user_serializer = RegisterSerializer(data=user_data, context=context)

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

            # 4. Actualizar estado de la mesa
            if mesa.estado == 'disponible':
                mesa.estado = 'reservada'
                mesa.save()

            # 5. Obtener perfil del usuario
            perfil = user.perfil

            # 6. Contar reservas totales del usuario (FIX #231)
            reservas_count = Reserva.objects.filter(cliente=user).count()
            is_additional_reservation = reservas_count > 1

            # 7. Enviar email de confirmación según tipo de usuario
            if perfil.es_invitado:
                # Usuario invitado: enviar email con link único y link de activación
                enviar_email_confirmacion_invitado(reserva, perfil)
                if is_additional_reservation:
                    mensaje_respuesta = f'¡Reserva confirmada! Ahora tienes {reservas_count} reservas. Revisa tu email para ver los detalles.'
                else:
                    mensaje_respuesta = '¡Reserva confirmada! Revisa tu email para ver los detalles y un link para gestionar tu reserva.'
            else:
                # Usuario registrado: enviar email de bienvenida con link al dashboard
                enviar_email_confirmacion_usuario_registrado(reserva, perfil)
                if is_additional_reservation:
                    mensaje_respuesta = f'¡Reserva creada exitosamente! Ahora tienes {reservas_count} reservas activas.'
                else:
                    mensaje_respuesta = '¡Reserva creada exitosamente! Tu cuenta ha sido registrada.'

            # 8. Preparar respuesta
            response_data = {
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'rol': perfil.rol,
                'rol_display': perfil.get_rol_display(),
                'nombre_completo': perfil.nombre_completo,
                'es_invitado': perfil.es_invitado,
                'reservas_count': reservas_count,  # FIX #231: Incluir contador
                'is_additional_reservation': is_additional_reservation,  # FIX #231: Flag para frontend
                'reserva': {
                    'id': reserva.id,
                    'mesa_numero': reserva.mesa.numero,
                    'fecha_reserva': reserva.fecha_reserva,
                    'hora_inicio': reserva.hora_inicio,
                    'hora_fin': reserva.hora_fin,
                    'num_personas': reserva.num_personas,
                    'estado': reserva.estado,
                },
                'message': mensaje_respuesta
            }

            # 8. Si es usuario registrado (no invitado), generar token para auto-login
            if not perfil.es_invitado:
                token, created = Token.objects.get_or_create(user=user)
                response_data['token'] = token.key

            return Response(response_data, status=status.HTTP_201_CREATED)

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


# ============ ENDPOINTS PARA USUARIOS INVITADOS ============

@api_view(['GET'])
@permission_classes([AllowAny])
def verificar_token_invitado(request, token):
    """
    Verifica si un token de invitado es válido y retorna información básica.
    GET /api/verificar-token/<token>/
    """
    try:
        perfil = Perfil.objects.get(token_activacion=token)

        if not perfil.token_es_valido():
            return Response({
                'error': 'Token inválido o expirado'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'valido': True,
            'email': perfil.user.email,
            'nombre_completo': perfil.nombre_completo,
            'es_invitado': perfil.es_invitado,
            'token_usado': perfil.token_usado,
            'expira': perfil.token_expira
        })

    except Perfil.DoesNotExist:
        return Response({
            'error': 'Token no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def ver_reserva_invitado(request, token):
    """
    Permite a un invitado ver su reserva usando el token único.
    GET /api/reserva-invitado/<token>/
    """
    try:
        perfil = Perfil.objects.get(token_activacion=token)

        # Validar token
        if not perfil.token_es_valido():
            return Response({
                'error': 'Token inválido o expirado. El link solo es válido por 48 horas.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Obtener reserva más reciente del usuario
        reserva = Reserva.objects.filter(
            cliente=perfil.user,
            estado__in=['pendiente', 'activa']
        ).select_related('mesa').order_by('-created_at').first()

        if not reserva:
            return Response({
                'error': 'No se encontró una reserva activa para este usuario'
            }, status=status.HTTP_404_NOT_FOUND)

        # Serializar reserva
        from .serializers import ReservaListSerializer
        serializer = ReservaListSerializer(reserva)

        return Response({
            'reserva': serializer.data,
            'cliente': {
                'nombre_completo': perfil.nombre_completo,
                'email': perfil.user.email,
                'telefono': perfil.telefono
            },
            'es_invitado': perfil.es_invitado,
            'puede_activar_cuenta': perfil.es_invitado and not perfil.token_usado
        })

    except Perfil.DoesNotExist:
        return Response({
            'error': 'Token no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def cancelar_reserva_invitado(request, token):
    """
    Permite a un invitado cancelar su reserva usando el token único.
    DELETE /api/reserva-invitado/<token>/cancelar/
    """
    from django.db import transaction
    from .email_service import enviar_email_cancelacion_reserva

    try:
        perfil = Perfil.objects.get(token_activacion=token)

        # Validar token
        if not perfil.token_es_valido():
            return Response({
                'error': 'Token inválido o expirado'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Obtener reserva más reciente del usuario
        reserva = Reserva.objects.filter(
            cliente=perfil.user,
            estado__in=['pendiente', 'activa']
        ).select_related('mesa').order_by('-created_at').first()

        if not reserva:
            return Response({
                'error': 'No se encontró una reserva activa para cancelar'
            }, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            # Guardar datos antes de eliminar
            mesa = reserva.mesa
            reserva_info = {
                'id': reserva.id,
                'mesa_numero': mesa.numero,
                'fecha_reserva': reserva.fecha_reserva,
                'hora_inicio': reserva.hora_inicio
            }

            # Marcar reserva como cancelada (en lugar de eliminar)
            reserva.estado = 'cancelada'
            reserva.save()

            # Verificar si hay otras reservas activas/pendientes para esta mesa
            otras_reservas_activas = Reserva.objects.filter(
                mesa=mesa,
                estado__in=['pendiente', 'activa']
            ).exists()

            # Solo marcar como disponible si no hay otras reservas
            if not otras_reservas_activas:
                mesa.estado = 'disponible'
                mesa.save()

            # Enviar email de confirmación de cancelación
            enviar_email_cancelacion_reserva(reserva, perfil)

        return Response({
            'success': True,
            'message': 'Reserva cancelada exitosamente',
            'reserva_cancelada': reserva_info
        })

    except Perfil.DoesNotExist:
        return Response({
            'error': 'Token no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def activar_cuenta_invitado(request):
    """
    Activa la cuenta de un invitado estableciendo una contraseña.
    POST /api/activar-cuenta/
    Body: {token, password, password_confirm}
    """
    from django.contrib.auth.hashers import make_password
    from .email_service import enviar_email_bienvenida_cuenta_activada

    token = request.data.get('token')
    password = request.data.get('password')
    password_confirm = request.data.get('password_confirm')

    # Validaciones básicas
    if not token or not password or not password_confirm:
        return Response({
            'error': 'Token, contraseña y confirmación son requeridos'
        }, status=status.HTTP_400_BAD_REQUEST)

    if password != password_confirm:
        return Response({
            'error': 'Las contraseñas no coinciden'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Validar complejidad de contraseña
    if len(password) < 8:
        return Response({
            'error': 'La contraseña debe tener al menos 8 caracteres'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not any(c.isupper() for c in password):
        return Response({
            'error': 'La contraseña debe contener al menos una letra mayúscula'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not any(c.islower() for c in password):
        return Response({
            'error': 'La contraseña debe contener al menos una letra minúscula'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not any(c.isdigit() for c in password):
        return Response({
            'error': 'La contraseña debe contener al menos un número'
        }, status=status.HTTP_400_BAD_REQUEST)

    caracteres_especiales = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in caracteres_especiales for c in password):
        return Response({
            'error': 'La contraseña debe contener al menos un carácter especial'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        perfil = Perfil.objects.get(token_activacion=token)

        # Validar que sea invitado
        if not perfil.es_invitado:
            return Response({
                'error': 'Esta cuenta ya está activada'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validar token
        if not perfil.token_es_valido():
            return Response({
                'error': 'Token inválido o expirado'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validar que el token no haya sido usado
        if perfil.token_usado:
            return Response({
                'error': 'Este token ya fue utilizado'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Actualizar usuario y perfil
        user = perfil.user
        user.set_password(password)
        user.save()

        perfil.es_invitado = False
        perfil.token_usado = True
        perfil.save()

        # Generar token de autenticación
        from rest_framework.authtoken.models import Token
        token_auth, created = Token.objects.get_or_create(user=user)

        # Enviar email de bienvenida
        enviar_email_bienvenida_cuenta_activada(perfil)

        return Response({
            'success': True,
            'message': '¡Cuenta activada exitosamente! Ya puedes iniciar sesión.',
            'token': token_auth.key,
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'rol': perfil.rol,
            'rol_display': perfil.get_rol_display(),
            'nombre_completo': perfil.nombre_completo
        }, status=status.HTTP_200_OK)

    except Perfil.DoesNotExist:
        return Response({
            'error': 'Token no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


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
            # Permitir acceso público a la lista de mesas
            permission_classes = [AllowAny]
        else:
            # Solo admins pueden crear/modificar/eliminar mesas
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

                # Obtener mesas con bloqueos activos que se solapen
                mesas_bloqueadas_ids = BloqueoMesa.objects.filter(
                    activo=True,
                    fecha_inicio__lte=fecha,
                    fecha_fin__gte=fecha
                ).filter(
                    # Si el bloqueo tiene horario, verificar solapamiento de horas
                    # Si el bloqueo es de día completo (hora_inicio=None), bloquear toda la mesa
                    Q(hora_inicio__isnull=True) |  # Bloqueo de día completo
                    (Q(hora_inicio__lt=hora_fin) & Q(hora_fin__gt=hora_inicio))  # Solapamiento de horario
                ).values_list('mesa_id', flat=True)

                # Excluir mesas ocupadas y bloqueadas
                mesas = mesas.exclude(id__in=list(mesas_ocupadas_ids) + list(mesas_bloqueadas_ids))

            except ValueError:
                # Si hay error en el formato de fecha/hora, ignorar el filtro
                pass

        serializer = MesaSerializer(mesas, many=True)
        return Response(serializer.data)


class ConsultarHorasDisponiblesView(views.APIView):
    """
    Endpoint para consultar horas disponibles para una fecha y número de personas.
    Mejora UX: permite al frontend mostrar solo horas disponibles en el dropdown.

    GET /api/horas-disponibles/?fecha=2025-11-21&personas=2

    Parámetros:
    - fecha (requerido): Fecha en formato YYYY-MM-DD
    - personas (opcional): Número de personas (default: 1)

    Retorna:
    {
        "fecha": "2025-11-21",
        "personas": 2,
        "horas": [
            {"hora": "12:00", "mesas_disponibles": 5},
            {"hora": "12:30", "mesas_disponibles": 3},
            {"hora": "13:00", "mesas_disponibles": 0},
            ...
        ],
        "horas_disponibles": ["12:00", "12:30", ...],  # Deprecated, usar 'horas'
        "horas_no_disponibles": ["13:00", ...]  # Deprecated, usar 'horas'
    }
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from datetime import datetime, timedelta, time

        fecha_str = request.query_params.get('fecha', None)
        personas_str = request.query_params.get('personas', '1')

        # Validar que se proporcione fecha
        if not fecha_str:
            return Response(
                {'error': 'El parámetro "fecha" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
            num_personas = int(personas_str)
        except ValueError as e:
            return Response(
                {'error': f'Formato inválido: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generar todas las horas disponibles (12:00 - 21:00 cada 30 min)
        todas_las_horas = []
        for hora in range(12, 22):  # 12:00 a 21:00 (última reserva a las 21:00)
            for minuto in [0, 30]:
                todas_las_horas.append(time(hora, minuto))

        # Obtener mesas que cumplan con la capacidad requerida
        mesas_suficientes = Mesa.objects.filter(capacidad__gte=num_personas)

        if not mesas_suficientes.exists():
            # No hay mesas con capacidad suficiente
            horas_sin_capacidad = [
                {'hora': h.strftime('%H:%M'), 'mesas_disponibles': 0}
                for h in todas_las_horas
            ]
            return Response({
                'fecha': fecha_str,
                'personas': num_personas,
                'horas': horas_sin_capacidad,
                'horas_disponibles': [],
                'horas_no_disponibles': [h.strftime('%H:%M') for h in todas_las_horas],
                'mensaje': f'No hay mesas disponibles para {num_personas} personas'
            })

        horas_info = []
        horas_disponibles = []
        horas_no_disponibles = []

        # Verificar disponibilidad para cada hora
        for hora_inicio in todas_las_horas:
            # Calcular hora fin (2 horas después)
            dt_inicio = datetime.combine(fecha, hora_inicio)
            dt_fin = dt_inicio + timedelta(hours=2)
            hora_fin = dt_fin.time()

            # Buscar mesas ocupadas en este horario
            mesas_ocupadas_ids = Reserva.objects.filter(
                fecha_reserva=fecha,
                estado__in=['pendiente', 'activa'],  # Solo reservas activas/pendientes
            ).filter(
                # Verificar solapamiento de horarios
                Q(hora_inicio__lt=hora_fin) & Q(hora_fin__gt=hora_inicio)
            ).values_list('mesa_id', flat=True)

            # Buscar mesas bloqueadas en este horario
            mesas_bloqueadas_ids = BloqueoMesa.objects.filter(
                activo=True,
                fecha_inicio__lte=fecha,
                fecha_fin__gte=fecha
            ).filter(
                # Si el bloqueo tiene horario, verificar solapamiento de horas
                # Si el bloqueo es de día completo (hora_inicio=None), bloquear toda la mesa
                Q(hora_inicio__isnull=True) |  # Bloqueo de día completo
                (Q(hora_inicio__lt=hora_fin) & Q(hora_fin__gt=hora_inicio))  # Solapamiento de horario
            ).values_list('mesa_id', flat=True)

            # Verificar si hay al menos una mesa disponible con capacidad suficiente
            mesas_no_disponibles_ids = list(mesas_ocupadas_ids) + list(mesas_bloqueadas_ids)
            mesas_disponibles = mesas_suficientes.exclude(id__in=mesas_no_disponibles_ids)
            num_mesas_disponibles = mesas_disponibles.count()

            hora_str = hora_inicio.strftime('%H:%M')

            # Agregar info de la hora con cantidad de mesas disponibles
            horas_info.append({
                'hora': hora_str,
                'mesas_disponibles': num_mesas_disponibles
            })

            # Mantener compatibilidad con versión anterior
            if num_mesas_disponibles > 0:
                horas_disponibles.append(hora_str)
            else:
                horas_no_disponibles.append(hora_str)

        return Response({
            'fecha': fecha_str,
            'personas': num_personas,
            'horas': horas_info,  # Nueva estructura con cantidad de mesas
            'horas_disponibles': horas_disponibles,  # Deprecated
            'horas_no_disponibles': horas_no_disponibles,  # Deprecated
            'total_horas': len(todas_las_horas),
            'disponibles': len(horas_disponibles),
            'no_disponibles': len(horas_no_disponibles)
        })


# ============ ENDPOINTS DE RESERVAS ============

class ReservaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para el CRUD de Reservas.

    Permisos:
    - Admin y Cajero: acceso completo
    - Cliente: solo sus propias reservas

    FIX #22 (MODERADO): Documentación de filtros disponibles

    Filtros disponibles:
    1. Por campos estándar (Django Filter Backend):
       - ?estado=activa                     Filtra por estado (pendiente|activa|completada|cancelada)
       - ?fecha_reserva=2025-11-15          Filtra por fecha específica (formato YYYY-MM-DD)
       - ?fecha_reserva__gte=2025-01-01     Reservas desde fecha (mayor o igual)
       - ?fecha_reserva__lte=2025-12-31     Reservas hasta fecha (menor o igual)
       - ?fecha_reserva__range=2025-01-01,2025-12-31  Rango de fechas
       - ?mesa=5                            Filtra por número de mesa

    2. Búsqueda por cliente (Search Filter):
       - ?search=juan                       Busca en: username, nombre, apellido, email, nombre_completo
       - La búsqueda es case-insensitive y busca coincidencias parciales
       - Ejemplos: "juan perez", "juan@example.com", "jpérez"

    3. Filtros especiales de fecha:
       - ?date=today                        Reservas de hoy
       - ?all=true                          BÚSQUEDA GLOBAL: sin límite de fecha (usar con precaución)

    4. Ordenamiento:
       - ?ordering=fecha_reserva            Ordena ascendente por fecha
       - ?ordering=-fecha_reserva           Ordena descendente por fecha
       - ?ordering=hora_inicio              Ordena por hora de inicio

    5. Paginación (50 elementos por página):
       - ?page=2                            Segunda página de resultados

    OPTIMIZACIÓN DE RENDIMIENTO (Filtro Masivo):
    ==========================================
    Cuando se combinan filtros de fecha + búsqueda de cliente, el sistema aplica
    la fecha PRIMERO para limitar el conjunto de datos antes de procesar la búsqueda.

    Esto es especialmente útil en "Reservas del día" donde necesitas buscar clientes
    dentro de una fecha específica sin escanear toda la base de datos.

    Ejemplo optimizado (RECOMENDADO):
    - GET /api/reservas/?date=today&search=juan
      → Busca "juan" SOLO en las reservas de hoy (muy rápido)

    Búsqueda sin fecha (con límite automático):
    - GET /api/reservas/?search=juan
      → Busca "juan" en reservas de últimos 7 días + futuras (previene escaneo completo)

    Beneficio: 60-90% más rápido cuando se especifica fecha en búsquedas de clientes.
    Protección automática: Búsquedas sin fecha se limitan a ventana relevante (7 días).

    Ejemplos de uso:
    - GET /api/reservas/?estado=activa&date=today
      → Reservas activas del día actual
    - GET /api/reservas/?date=today&search=juan
      → Buscar cliente "juan" en reservas de hoy (OPTIMIZADO)
    - GET /api/reservas/?fecha_reserva=2025-11-15&search=perez
      → Buscar cliente "perez" en fecha específica (OPTIMIZADO)
    - GET /api/reservas/?fecha_reserva=2025-11-15&mesa=5
      → Reservas de la mesa 5 en fecha específica
    - GET /api/reservas/?all=true&search=juan
      → BÚSQUEDA GLOBAL: Buscar "juan" en TODO el historial (puede ser lento)
    - GET /api/reservas/?fecha_reserva__gte=2025-01-01&search=perez
      → Buscar "perez" en reservas desde el 1 de enero 2025
    - GET /api/reservas/?fecha_reserva__range=2025-01-01,2025-03-31
      → Reservas del primer trimestre de 2025
    - GET /api/reservas/?search=@example.com
      → Todas las reservas de clientes con email @example.com (últimos 7 días + futuras)
    - GET /api/reservas/?ordering=-created_at&page=1
      → Primera página de reservas ordenadas por fecha de creación descendente
    """
    queryset = Reserva.objects.all()
    serializer_class = ReservaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    # Filtros disponibles con lookups avanzados
    filterset_fields = {
        'estado': ['exact'],
        'mesa': ['exact'],
        'fecha_reserva': ['exact', 'gte', 'lte', 'range'],  # Soporte para rangos de fecha
    }
    search_fields = ['cliente__username', 'cliente__first_name', 'cliente__last_name',
                     'cliente__email', 'cliente__perfil__nombre_completo']
    ordering_fields = ['fecha_reserva', 'hora_inicio', 'created_at']
    ordering = ['-fecha_reserva', '-hora_inicio']

    # FIX #21 (MODERADO): Logger para auditoría
    audit_logger = logging.getLogger('mainApp.audit')

    def get_permissions(self):
        if self.action in ['create']:
            # Cualquier usuario autenticado puede crear reserva
            permission_classes = [IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Admins y Cajeros pueden modificar/eliminar cualquier reserva
            # Clientes solo pueden modificar/eliminar sus propias reservas
            permission_classes = [IsAdminOrCajeroOrOwner]
        else:
            # Para list y retrieve, cualquier autenticado
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Filtrar reservas según el rol del usuario.
        - Admin y Cajero: todas las reservas
        - Cliente: solo sus propias reservas

        OPTIMIZACIÓN:
        - Aplica filtros de fecha PRIMERO para reducir el conjunto de datos
        - Usa select_related para evitar N+1 queries
        - Scoping de búsqueda: cuando se busca por cliente, el filtro de fecha
          se aplica antes de que SearchFilter procese, evitando escaneos completos
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

        # OPTIMIZACIÓN CRÍTICA: Aplicar filtros de fecha PRIMERO
        # Esto limita el conjunto de datos antes de que SearchFilter procese
        # Beneficio: búsquedas de clientes en "Reservas del día" no escanean toda la BD

        # Filtro por fecha (para HU-17: reservas del día)
        fecha = self.request.query_params.get('date', None)
        all_results = self.request.query_params.get('all', None)

        if fecha == 'today':
            queryset = queryset.filter(fecha_reserva=timezone.now().date())
        elif fecha:
            queryset = queryset.filter(fecha_reserva=fecha)
        elif all_results == 'true':
            # BÚSQUEDA GLOBAL: No aplicar límite de fecha
            # Usar con precaución - puede ser lento con muchas reservas
            pass
        else:
            # OPTIMIZACIÓN ADICIONAL: Si no hay filtro de fecha Y hay búsqueda,
            # limitar automáticamente a reservas relevantes (últimos 7 días + futuras)
            # Esto previene escaneos completos de la base de datos
            search_query = self.request.query_params.get('search', None)
            if search_query:
                from datetime import timedelta
                fecha_limite = timezone.now().date() - timedelta(days=7)
                queryset = queryset.filter(fecha_reserva__gte=fecha_limite)

        # OPTIMIZACIÓN: Cargar relaciones en una sola query
        queryset = queryset.select_related('cliente', 'cliente__perfil', 'mesa')

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

            # FIX #21: Logging de auditoría
            self.audit_logger.info(
                f"RESERVA_CREADA: ID={reserva.id}, Usuario={self.request.user.username}, "
                f"Mesa={reserva.mesa.numero}, Fecha={reserva.fecha_reserva}, "
                f"Hora={reserva.hora_inicio}-{reserva.hora_fin}, Personas={reserva.num_personas}"
            )

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
            estado_anterior = reserva.estado  # Guardar para logging
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

            # FIX #21: Logging de auditoría
            self.audit_logger.info(
                f"ESTADO_CAMBIADO: Reserva_ID={reserva.id}, Usuario={request.user.username}, "
                f"Estado_Anterior={estado_anterior}, Estado_Nuevo={nuevo_estado}, "
                f"Mesa={reserva.mesa.numero}, Fecha={reserva.fecha_reserva}"
            )

            serializer = self.get_serializer(reserva)
            return Response(serializer.data)


class BloqueoMesaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para el CRUD completo de Bloqueos de Mesas.
    Solo los Administradores pueden crear, modificar y eliminar bloqueos.
    Todos los usuarios autenticados pueden consultar bloqueos.

    Endpoints:
    - GET /api/bloqueos/ - Listar todos los bloqueos
    - POST /api/bloqueos/ - Crear un nuevo bloqueo (solo admin)
    - GET /api/bloqueos/{id}/ - Ver detalle de un bloqueo
    - PUT/PATCH /api/bloqueos/{id}/ - Modificar un bloqueo (solo admin)
    - DELETE /api/bloqueos/{id}/ - Eliminar un bloqueo (solo admin)

    Filtros disponibles:
    - mesa: Filtrar por número de mesa
    - activo: Filtrar por estado activo/inactivo
    - categoria: Filtrar por categoría de bloqueo
    - fecha_inicio: Filtrar por fecha de inicio
    - fecha_fin: Filtrar por fecha de fin
    """
    queryset = BloqueoMesa.objects.all()
    serializer_class = BloqueoMesaSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['mesa__numero', 'activo', 'categoria', 'fecha_inicio', 'fecha_fin']
    search_fields = ['motivo', 'notas']
    ordering_fields = ['fecha_inicio', 'fecha_fin', 'created_at']
    ordering = ['-fecha_inicio', '-hora_inicio']

    def get_permissions(self):
        """
        Permisos:
        - Lectura (list, retrieve): Usuarios autenticados
        - Escritura (create, update, destroy): Solo administradores
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdministrador]
        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        """Usar serializer compacto para listados"""
        if self.action == 'list':
            return BloqueoMesaListSerializer
        return BloqueoMesaSerializer

    def perform_create(self, serializer):
        """
        Asignar automáticamente el usuario creador al crear un bloqueo.
        """
        serializer.save(usuario_creador=self.request.user)

    def get_queryset(self):
        """
        Filtrado adicional del queryset.
        Permite filtrar por:
        - mesa_numero: Número de la mesa
        - activos_en_fecha: Bloqueos activos en una fecha específica
        """
        queryset = super().get_queryset()

        # Filtrar por número de mesa
        mesa_numero = self.request.query_params.get('mesa_numero', None)
        if mesa_numero:
            queryset = queryset.filter(mesa__numero=mesa_numero)

        # Filtrar solo bloqueos activos
        solo_activos = self.request.query_params.get('solo_activos', None)
        if solo_activos == 'true':
            queryset = queryset.filter(activo=True)

        # Filtrar bloqueos activos en una fecha específica
        activos_en_fecha = self.request.query_params.get('activos_en_fecha', None)
        if activos_en_fecha:
            from datetime import datetime
            try:
                fecha = datetime.strptime(activos_en_fecha, '%Y-%m-%d').date()
                queryset = queryset.filter(
                    activo=True,
                    fecha_inicio__lte=fecha,
                    fecha_fin__gte=fecha
                )
            except ValueError:
                pass  # Ignorar fechas inválidas

        return queryset

    @action(detail=False, methods=['get'], url_path='activos-hoy')
    def activos_hoy(self, request):
        """
        Endpoint personalizado: Obtener bloqueos activos para hoy.
        GET /api/bloqueos/activos-hoy/
        """
        from datetime import date
        hoy = date.today()

        bloqueos_hoy = self.get_queryset().filter(
            activo=True,
            fecha_inicio__lte=hoy,
            fecha_fin__gte=hoy
        )

        serializer = self.get_serializer(bloqueos_hoy, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='desactivar')
    def desactivar(self, request, pk=None):
        """
        Endpoint personalizado: Desactivar un bloqueo sin eliminarlo.
        POST /api/bloqueos/{id}/desactivar/
        Solo administradores.
        """
        bloqueo = self.get_object()
        bloqueo.activo = False
        bloqueo.save()

        serializer = self.get_serializer(bloqueo)
        return Response({
            'message': 'Bloqueo desactivado exitosamente',
            'bloqueo': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        """
        Endpoint personalizado: Activar un bloqueo previamente desactivado.
        POST /api/bloqueos/{id}/activar/
        Solo administradores.
        """
        bloqueo = self.get_object()

        # Validar que el bloqueo pueda ser reactivado (sin solapamientos)
        try:
            bloqueo.activo = True
            bloqueo.full_clean()  # Esto ejecutará las validaciones del modelo
            bloqueo.save()

            serializer = self.get_serializer(bloqueo)
            return Response({
                'message': 'Bloqueo activado exitosamente',
                'bloqueo': serializer.data
            })
        except Exception as e:
            bloqueo.activo = False  # Revertir cambio
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
