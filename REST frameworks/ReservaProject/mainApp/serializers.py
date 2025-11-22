from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Mesa, Perfil, Reserva, BloqueoMesa
import re


# Serializer para el modelo Usuario (para registro)
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name')
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user


# Serializer extendido para registro de clientes con datos completos
class RegisterSerializer(serializers.ModelSerializer):
    # Password opcional para permitir reservas sin cuenta
    password = serializers.CharField(write_only=True, required=False, min_length=8, style={'input_type': 'password'}, allow_blank=True)
    password_confirm = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'}, allow_blank=True)

    # Campos adicionales del Perfil
    nombre = serializers.CharField(required=True, max_length=100, write_only=True)
    apellido = serializers.CharField(required=True, max_length=100, write_only=True)
    rut = serializers.CharField(required=True, max_length=12)
    telefono = serializers.CharField(required=True, max_length=15)
    email_perfil = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm',
                  'nombre', 'apellido', 'rut', 'telefono', 'email_perfil')

    def validate_rut(self, value):
        """
        Validar formato y dígito verificador del RUT chileno.
        Formato esperado: 12.345.678-9 o 12345678-9
        """
        # Limpiar RUT (quitar puntos y guiones)
        rut_limpio = value.replace('.', '').replace('-', '').upper()

        if len(rut_limpio) < 2:
            raise serializers.ValidationError('RUT inválido: demasiado corto')

        # Separar número y dígito verificador
        numero = rut_limpio[:-1]
        dv_ingresado = rut_limpio[-1]

        # Validar que el número sea numérico
        if not numero.isdigit():
            raise serializers.ValidationError('RUT inválido: debe contener solo números antes del dígito verificador')

        # Calcular dígito verificador
        suma = 0
        multiplicador = 2
        for digit in reversed(numero):
            suma += int(digit) * multiplicador
            multiplicador = multiplicador + 1 if multiplicador < 7 else 2

        resto = suma % 11
        dv_calculado = str(11 - resto) if resto != 0 else '0'
        if dv_calculado == '10':
            dv_calculado = 'K'

        # Comparar dígitos verificadores
        if dv_ingresado != dv_calculado:
            raise serializers.ValidationError(
                f'RUT inválido: dígito verificador incorrecto. Debería ser {dv_calculado}'
            )

        # Retornar formato normalizado (con guión, sin puntos)
        return f'{numero}-{dv_ingresado}'

    def validate_telefono(self, value):
        """
        Validar formato de teléfono chileno.
        Formatos aceptados: +56912345678, 912345678, +56 9 1234 5678
        """
        # Limpiar espacios y guiones
        telefono_limpio = value.replace(' ', '').replace('-', '')

        # Patrón para teléfono chileno (móvil)
        # +569XXXXXXXX o 9XXXXXXXX
        patron_movil = r'^(\+?56)?9\d{8}$'

        if not re.match(patron_movil, telefono_limpio):
            raise serializers.ValidationError(
                'Formato de teléfono inválido. Use formato chileno: +56912345678 o 912345678'
            )

        # Normalizar a formato +56912345678
        if telefono_limpio.startswith('+56'):
            return telefono_limpio
        elif telefono_limpio.startswith('56'):
            return f'+{telefono_limpio}'
        else:
            return f'+56{telefono_limpio}'

    def validate(self, data):
        """
        Validaciones cruzadas.

        FIX #24 (MODERADO): Validar email duplicado en User
        NUEVO: Validar contraseña solo si se proporciona (soporte para invitados)
        NUEVO #231: Soportar allow_existing_user para permitir múltiples reservas del mismo usuario
        """
        email = data.get('email')
        username = data.get('username') or email
        rut_normalizado = data.get('rut')

        # Obtener flag del contexto para permitir usuarios existentes
        allow_existing_user = self.context.get('allow_existing_user', False)

        # FIX #24 (MODERADO): Validar que el email/username no esté en uso
        # EXCEPTO si allow_existing_user=True (para reservas múltiples)
        if email and not allow_existing_user:
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError({
                    'email': 'Este correo ya está registrado. Usa otro correo o inicia sesión con tu cuenta existente.'
                })
            if Perfil.objects.filter(email=email).exists():
                raise serializers.ValidationError({
                    'email': 'Este correo ya tiene una reserva registrada.'
                })

        if username and User.objects.filter(username=username).exists() and not allow_existing_user:
            raise serializers.ValidationError({
                'email': 'Ya existe una cuenta asociada a este correo. Inicia sesión o elige otro correo.'
            })

        # Si allow_existing_user=True y el usuario existe, validar que el RUT coincida
        if allow_existing_user and email:
            existing_user = User.objects.filter(email=email).first()
            if existing_user and hasattr(existing_user, 'perfil'):
                existing_perfil = existing_user.perfil
                # Solo validar RUT si ambos tienen RUT (no vacío)
                if rut_normalizado and existing_perfil.rut and rut_normalizado != existing_perfil.rut:
                    raise serializers.ValidationError({
                        'rut': 'El RUT ingresado no coincide con tu cuenta existente. Verifica tus datos o contacta al administrador.'
                    })

        if rut_normalizado and Perfil.objects.filter(rut=rut_normalizado).exists() and not allow_existing_user:
            raise serializers.ValidationError({
                'rut': 'El RUT ingresado ya se encuentra registrado.'
            })

        # Obtener password (puede ser None o string vacío)
        password = data.get('password', '')
        password_confirm = data.get('password_confirm', '')

        # Si hay password, validar completamente
        if password or password_confirm:
            # Validar que las contraseñas coincidan
            if password != password_confirm:
                raise serializers.ValidationError({
                    'password_confirm': 'Las contraseñas no coinciden'
                })

            # Validar complejidad de contraseña
            # Longitud mínima
            if len(password) < 8:
                raise serializers.ValidationError({
                    'password': 'La contraseña debe tener al menos 8 caracteres'
                })

            # Debe contener al menos una letra mayúscula
            if not any(c.isupper() for c in password):
                raise serializers.ValidationError({
                    'password': 'La contraseña debe contener al menos una letra mayúscula'
                })

            # Debe contener al menos una letra minúscula
            if not any(c.islower() for c in password):
                raise serializers.ValidationError({
                    'password': 'La contraseña debe contener al menos una letra minúscula'
                })

            # Debe contener al menos un número
            if not any(c.isdigit() for c in password):
                raise serializers.ValidationError({
                    'password': 'La contraseña debe contener al menos un número'
                })

            # Opcional pero recomendado: caracteres especiales
            caracteres_especiales = "!@#$%^&*()_+-=[]{}|;:,.<>?"
            if not any(c in caracteres_especiales for c in password):
                raise serializers.ValidationError({
                    'password': 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:,.<>?)'
                })

        return data

    def create(self, validated_data):
        """
        Crear usuario y perfil con todos los datos.
        Si no hay contraseña, crear usuario invitado con password aleatoria.
        NUEVO #231: Si allow_existing_user=True y el usuario existe, retornar usuario existente.
        """
        import secrets

        # Verificar si debemos reutilizar usuario existente
        allow_existing_user = self.context.get('allow_existing_user', False)
        email = validated_data.get('email')

        if allow_existing_user and email:
            existing_user = User.objects.filter(email=email).first()
            if existing_user:
                # Usuario existe, retornarlo sin crear uno nuevo
                return existing_user

        # Extraer campos que no pertenecen al modelo User
        nombre = validated_data.pop('nombre')
        apellido = validated_data.pop('apellido')
        nombre_completo = f"{nombre} {apellido}"
        rut = validated_data.pop('rut')
        telefono = validated_data.pop('telefono')
        email_perfil = validated_data.pop('email_perfil', None) or None
        validated_data.pop('password_confirm', None)

        # Determinar si es usuario invitado (sin password)
        password = validated_data.get('password')
        es_invitado = not password or password.strip() == ''

        # Si es invitado, generar password aleatoria segura
        if es_invitado:
            password = secrets.token_urlsafe(32)

        # Crear usuario
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password
        )

        # Crear o actualizar perfil con datos completos
        perfil, created = Perfil.objects.update_or_create(
            user=user,
            defaults={
                'rol': 'cliente',
                'nombre_completo': nombre_completo,
                'rut': rut,  # Se encriptará automáticamente
                'telefono': telefono,  # Se encriptará automáticamente
                'email': email_perfil,
                'es_invitado': es_invitado
            }
        )

        # Si es invitado, generar token de activación
        if es_invitado:
            perfil.generar_token_activacion()

        return user


# Serializer para el modelo Perfil
class PerfilSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)
    email_perfil = serializers.EmailField(source='email', read_only=True)

    class Meta:
        model = Perfil
        fields = ('id', 'username', 'email', 'rol', 'rol_display',
                  'nombre_completo', 'rut', 'telefono', 'email_perfil')

    def to_representation(self, instance):
        """
        Controla qué campos sensibles se muestran según el usuario que hace la petición.
        Solo el dueño del perfil o un admin pueden ver RUT y teléfono descifrados.
        """
        representation = super().to_representation(instance)
        request = self.context.get('request')

        if request and hasattr(request, 'user'):
            user = request.user
            # Si no es el dueño del perfil y no es admin, ocultar campos sensibles
            if user != instance.user and (not hasattr(user, 'perfil') or user.perfil.rol != 'admin'):
                representation['rut'] = None
                representation['telefono'] = None

        return representation


# Serializer para el modelo Mesa
class MesaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mesa
        fields = '__all__'

    def validate_capacidad(self, value):
        """Validar que la capacidad sea al menos 1 persona"""
        if value < 1:
            raise serializers.ValidationError('La capacidad debe ser al menos 1 persona.')
        return value


# Serializer para el modelo Reserva
class ReservaSerializer(serializers.ModelSerializer):
    cliente_username = serializers.CharField(source='cliente.username', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.perfil.nombre_completo', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente.perfil.telefono', read_only=True)
    cliente_email = serializers.EmailField(source='cliente.email', read_only=True)
    cliente_rut = serializers.CharField(source='cliente.perfil.rut', read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    mesa_info = MesaSerializer(source='mesa', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Reserva
        fields = ('id', 'cliente', 'cliente_username', 'cliente_nombre',
                  'cliente_telefono', 'cliente_email', 'cliente_rut',
                  'mesa', 'mesa_numero', 'mesa_info',
                  'fecha_reserva', 'hora_inicio', 'hora_fin',
                  'num_personas', 'estado', 'estado_display', 'notas',
                  'created_at', 'updated_at')
        read_only_fields = ('cliente', 'hora_fin', 'created_at', 'updated_at')

    def validate(self, data):
        """
        Validaciones adicionales a nivel de serializer.

        FIX #7 (GRAVE): Validar num_personas en backend
        """
        from datetime import date, time

        # Validar fecha no sea en el pasado
        if data.get('fecha_reserva') and data['fecha_reserva'] < date.today():
            raise serializers.ValidationError({
                'fecha_reserva': 'No se pueden crear reservas para fechas pasadas'
            })

        # Validar horario de operación del restaurante (12:00 - 21:00)
        if data.get('hora_inicio'):
            hora_apertura = time(12, 0)
            hora_ultimo_turno = time(21, 0)

            if data['hora_inicio'] < hora_apertura:
                raise serializers.ValidationError({
                    'hora_inicio': f'El restaurante abre a las 12:00. No se pueden hacer reservas antes de este horario.'
                })

            if data['hora_inicio'] > hora_ultimo_turno:
                raise serializers.ValidationError({
                    'hora_inicio': f'El último turno es a las 21:00. No se pueden hacer reservas después de este horario.'
                })

        # FIX #7 (GRAVE): Validar num_personas con límites razonables
        if 'num_personas' in data:
            if data['num_personas'] < 1:
                raise serializers.ValidationError({
                    'num_personas': 'Debe reservar para al menos 1 persona'
                })
            if data['num_personas'] > 50:
                raise serializers.ValidationError({
                    'num_personas': 'El número máximo de personas por reserva es 50. Para grupos más grandes, contacte al restaurante.'
                })

        # Validar capacidad de la mesa
        if data.get('mesa') and data.get('num_personas'):
            if data['num_personas'] > data['mesa'].capacidad:
                raise serializers.ValidationError({
                    'num_personas': f'La mesa {data["mesa"].numero} tiene capacidad para {data["mesa"].capacidad} personas. No puede reservar para {data["num_personas"]} personas.'
                })

        return data


# Serializer compacto para listados rápidos
class ReservaListSerializer(serializers.ModelSerializer):
    cliente_username = serializers.CharField(source='cliente.username', read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)

    class Meta:
        model = Reserva
        fields = ('id', 'cliente_username', 'mesa_numero', 'fecha_reserva',
                  'hora_inicio', 'hora_fin', 'num_personas', 'estado')


# Serializer para el modelo BloqueoMesa
class BloqueoMesaSerializer(serializers.ModelSerializer):
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    mesa_info = MesaSerializer(source='mesa', read_only=True)
    usuario_creador_username = serializers.CharField(source='usuario_creador.username', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    tipo_recurrencia_display = serializers.CharField(source='get_tipo_recurrencia_display', read_only=True)

    class Meta:
        model = BloqueoMesa
        fields = ('id', 'mesa', 'mesa_numero', 'mesa_info',
                  'fecha_inicio', 'fecha_fin', 'hora_inicio', 'hora_fin',
                  'motivo', 'categoria', 'categoria_display',
                  'notas', 'usuario_creador', 'usuario_creador_username',
                  'tipo_recurrencia', 'tipo_recurrencia_display',
                  'activo', 'created_at', 'updated_at')
        read_only_fields = ('usuario_creador', 'created_at', 'updated_at')

    def validate(self, data):
        """
        Validaciones adicionales a nivel de serializer.
        """
        from datetime import date, time
        from django.utils import timezone

        # Validar fecha de inicio no sea en el pasado
        if data.get('fecha_inicio') and data['fecha_inicio'] < timezone.now().date():
            raise serializers.ValidationError({
                'fecha_inicio': 'No se pueden crear bloqueos para fechas pasadas'
            })

        # Validar que fecha_fin sea posterior o igual a fecha_inicio
        if data.get('fecha_inicio') and data.get('fecha_fin'):
            if data['fecha_fin'] < data['fecha_inicio']:
                raise serializers.ValidationError({
                    'fecha_fin': 'La fecha de fin debe ser posterior o igual a la fecha de inicio'
                })

        # Validar horario de operación si se especifican horas
        if data.get('hora_inicio') and data.get('hora_fin'):
            hora_apertura = time(12, 0)
            hora_cierre = time(23, 0)

            if data['hora_inicio'] < hora_apertura or data['hora_inicio'] > hora_cierre:
                raise serializers.ValidationError({
                    'hora_inicio': 'La hora de inicio debe estar entre 12:00 y 23:00'
                })

            if data['hora_fin'] < hora_apertura or data['hora_fin'] > hora_cierre:
                raise serializers.ValidationError({
                    'hora_fin': 'La hora de fin debe estar entre 12:00 y 23:00'
                })

            if data['hora_fin'] <= data['hora_inicio']:
                raise serializers.ValidationError({
                    'hora_fin': 'La hora de fin debe ser posterior a la hora de inicio'
                })

        # Validar que si se especifica una hora, se especifique la otra
        if (data.get('hora_inicio') is None) != (data.get('hora_fin') is None):
            raise serializers.ValidationError(
                'Debe especificar tanto hora_inicio como hora_fin, o dejar ambas vacías para bloqueo de día completo'
            )

        return data


# Serializer compacto para listados de bloqueos
class BloqueoMesaListSerializer(serializers.ModelSerializer):
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)

    class Meta:
        model = BloqueoMesa
        fields = ('id', 'mesa_numero', 'fecha_inicio', 'fecha_fin',
                  'hora_inicio', 'hora_fin', 'motivo', 'categoria_display', 'activo')

