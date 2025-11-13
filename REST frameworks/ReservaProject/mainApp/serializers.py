from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Mesa, Perfil, Reserva


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


# Serializer para el modelo Perfil
class PerfilSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email_user = serializers.CharField(source='user.email', read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)

    class Meta:
        model = Perfil
        fields = ('id', 'username', 'email_user', 'rol', 'rol_display',
                  'nombre_completo', 'rut', 'telefono', 'email')

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


# Serializer para el modelo Reserva
class ReservaSerializer(serializers.ModelSerializer):
    cliente_username = serializers.CharField(source='cliente.username', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.perfil.nombre_completo', read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero', read_only=True)
    mesa_info = MesaSerializer(source='mesa', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Reserva
        fields = ('id', 'cliente', 'cliente_username', 'cliente_nombre',
                  'mesa', 'mesa_numero', 'mesa_info',
                  'fecha_reserva', 'hora_inicio', 'hora_fin',
                  'num_personas', 'estado', 'estado_display', 'notas',
                  'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

    def validate(self, data):
        """Validaciones adicionales a nivel de serializer"""
        if data.get('hora_fin') and data.get('hora_inicio'):
            if data['hora_fin'] <= data['hora_inicio']:
                raise serializers.ValidationError({
                    'hora_fin': 'La hora de fin debe ser posterior a la hora de inicio'
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

