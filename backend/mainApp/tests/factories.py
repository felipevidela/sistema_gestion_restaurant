"""
Factories para generar datos de prueba usando factory_boy y faker.

Las factories permiten crear objetos de prueba de forma sencilla y con datos realistas.

Uso básico:
    # Crear un usuario simple
    user = UserFactory()

    # Crear un usuario con valores específicos
    user = UserFactory(username='custom_user', email='custom@example.com')

    # Crear múltiples objetos
    users = UserFactory.create_batch(5)  # Crea 5 usuarios

    # Crear sin guardar en la DB (útil para validaciones)
    user = UserFactory.build()
"""

import factory
from factory.django import DjangoModelFactory
from factory import faker
from datetime import date, time, timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from mainApp.models import Perfil, Mesa, Reserva


class UserFactory(DjangoModelFactory):
    """
    Factory para crear usuarios de Django.

    NOTA: Cuando se crea un User, automáticamente se crea un Perfil
    asociado a través de un signal. No necesitas crear el Perfil manualmente.

    Ejemplo:
        user = UserFactory(username='testuser')
        user = UserFactory(email='specific@email.com')
        admin = UserFactory(is_staff=True, is_superuser=True)
        # El perfil se crea automáticamente: user.perfil
    """
    class Meta:
        model = User
        skip_postgeneration_save = True  # Evita double save con signals

    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda obj: f'{obj.username}@test.com')
    first_name = faker.Faker('first_name', locale='es_CL')
    last_name = faker.Faker('last_name', locale='es_CL')
    is_active = True
    is_staff = False
    is_superuser = False

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        """
        Establece una contraseña hasheada.
        Por defecto usa 'password123' pero puede especificarse.

        Uso:
            user = UserFactory(password='mi_password_custom')
        """
        if not create:
            return

        if extracted:
            obj.set_password(extracted)
        else:
            obj.set_password('password123')
        obj.save()


class PerfilFactory(DjangoModelFactory):
    """
    Factory para crear perfiles de usuario.

    Ejemplo:
        perfil = PerfilFactory()  # Crea user + perfil automáticamente
        perfil_cliente = PerfilFactory(rol='cliente')
        perfil_admin = PerfilFactory(rol='admin')

    IMPORTANTE: No usa django_get_or_create porque el signal post_save ya crea el Perfil
    automáticamente. La factory solo actualiza los campos del Perfil creado por el signal.
    """
    class Meta:
        model = Perfil
        skip_postgeneration_save = True  # Evitar double save

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """
        Sobrescribir _create para obtener el Perfil creado por el signal
        y actualizarlo en lugar de intentar crear uno nuevo.
        """
        # Extraer el user y otros campos
        user = kwargs.pop('user', None)
        if user is None:
            user = UserFactory()

        # Obtener el Perfil que fue creado automáticamente por el signal
        perfil = user.perfil

        # Actualizar todos los campos del perfil
        for key, value in kwargs.items():
            setattr(perfil, key, value)

        # Guardar los cambios
        perfil.save()

        return perfil

    user = factory.SubFactory(UserFactory)
    rol = 'cliente'
    nombre_completo = factory.LazyAttribute(
        lambda obj: f'{obj.user.first_name} {obj.user.last_name}'
    )
    rut = factory.Sequence(lambda n: f'1234567{n % 10}-{(11 - ((sum(int(d) * (2 + i % 6) for i, d in enumerate(reversed(f"1234567{n % 10}"))) % 11))) % 10}')
    telefono = factory.Faker('phone_number', locale='es_CL')
    email = factory.LazyAttribute(lambda obj: obj.user.email)
    es_invitado = False


class PerfilClienteFactory(PerfilFactory):
    """
    Factory específica para perfiles de clientes.
    """
    rol = 'cliente'


class PerfilAdminFactory(PerfilFactory):
    """
    Factory específica para perfiles de administradores.
    """
    rol = 'admin'
    user__is_staff = True
    user__is_superuser = True


class PerfilCajeroFactory(PerfilFactory):
    """
    Factory específica para perfiles de cajeros.
    """
    rol = 'cajero'


class PerfilInvitadoFactory(PerfilFactory):
    """
    Factory para usuarios invitados (sin contraseña).

    Ejemplo:
        invitado = PerfilInvitadoFactory()
        assert invitado.es_invitado == True
        assert invitado.token_activacion is not None
    """
    rol = 'cliente'
    es_invitado = True
    token_activacion = factory.Faker('sha256')
    token_expira = factory.LazyFunction(
        lambda: timezone.now() + timedelta(hours=48)
    )
    token_usado = False


class MesaFactory(DjangoModelFactory):
    """
    Factory para crear mesas.

    Ejemplo:
        mesa = MesaFactory()  # Mesa disponible con número secuencial
        mesa_grande = MesaFactory(capacidad=8)
        mesa_ocupada = MesaFactory(estado='ocupada')
    """
    class Meta:
        model = Mesa

    numero = factory.Sequence(lambda n: n + 1)
    capacidad = 4
    estado = 'disponible'


class MesaPequenaFactory(MesaFactory):
    """Mesa pequeña para 2 personas."""
    capacidad = 2


class MesaGrandeFactory(MesaFactory):
    """Mesa grande para 8 personas."""
    capacidad = 8


class ReservaFactory(DjangoModelFactory):
    """
    Factory para crear reservas.

    IMPORTANTE: Por defecto crea reservas para MAÑANA (fecha válida).

    Ejemplo:
        # Reserva básica válida
        reserva = ReservaFactory()

        # Reserva con fecha específica
        reserva = ReservaFactory(
            fecha_reserva=date(2025, 12, 25),
            hora_inicio=time(19, 0)
        )

        # Reserva con cliente específico
        mi_cliente = UserFactory()
        reserva = ReservaFactory(cliente=mi_cliente)

        # Reserva completada
        reserva = ReservaFactory(estado='completada')
    """
    class Meta:
        model = Reserva

    cliente = factory.SubFactory(UserFactory)
    mesa = factory.SubFactory(MesaFactory)

    # Por defecto, reservas para mañana (fecha válida)
    fecha_reserva = factory.LazyFunction(
        lambda: date.today() + timedelta(days=1)
    )

    # Hora de inicio entre 12:00 y 20:00
    hora_inicio = factory.LazyFunction(
        lambda: time(14, 0)  # 14:00 por defecto
    )

    # num_personas entre 1 y la capacidad de la mesa
    num_personas = factory.LazyAttribute(
        lambda obj: min(2, obj.mesa.capacidad)
    )

    estado = 'pendiente'
    notas = factory.Faker('sentence', locale='es')

    # hora_fin se calcula automáticamente en el modelo


class ReservaPasadaFactory(ReservaFactory):
    """
    Factory para crear reservas con fecha pasada.
    ÚTIL PARA TESTS DE VALIDACIÓN (debe fallar).

    Ejemplo:
        # Esto debería lanzar ValidationError
        reserva = ReservaPasadaFactory.build()
        reserva.full_clean()  # Lanza ValidationError
    """
    fecha_reserva = factory.LazyFunction(
        lambda: date.today() - timedelta(days=1)
    )


class ReservaActivaFactory(ReservaFactory):
    """Reserva con estado 'activa'."""
    estado = 'activa'


class ReservaCompletadaFactory(ReservaFactory):
    """Reserva con estado 'completada'."""
    estado = 'completada'


class ReservaCanceladaFactory(ReservaFactory):
    """Reserva con estado 'cancelada'."""
    estado = 'cancelada'


# ============================================================================
# HELPERS: Funciones auxiliares para crear escenarios complejos
# ============================================================================

def crear_reserva_con_solapamiento(reserva_existente):
    """
    Crea una reserva que se solapa con otra existente (para tests de validación).

    Args:
        reserva_existente: Reserva ya creada

    Returns:
        Reserva (sin guardar) que se solapa

    Ejemplo:
        reserva1 = ReservaFactory(hora_inicio=time(14, 0))  # 14:00-16:00
        reserva_solapada = crear_reserva_con_solapamiento(reserva1)
        # reserva_solapada tiene misma mesa/fecha pero hora 15:00-17:00 (se solapa)
    """
    return ReservaFactory.build(
        mesa=reserva_existente.mesa,
        fecha_reserva=reserva_existente.fecha_reserva,
        hora_inicio=time(15, 0),  # 15:00-17:00 se solapa con 14:00-16:00
        cliente=UserFactory()
    )


def crear_dia_lleno_reservas(fecha, mesa):
    """
    Crea reservas para todo el día en una mesa específica.

    Args:
        fecha: date object
        mesa: Mesa object

    Returns:
        List[Reserva] - Lista de reservas creadas

    Ejemplo:
        mesa = MesaFactory()
        fecha = date(2025, 12, 25)
        reservas = crear_dia_lleno_reservas(fecha, mesa)
        # Devuelve ~18 reservas (cada 30 min de 12:00 a 21:00)
    """
    reservas = []
    hora = 12
    minuto = 0

    while hora < 21 or (hora == 21 and minuto == 0):
        reserva = ReservaFactory(
            mesa=mesa,
            fecha_reserva=fecha,
            hora_inicio=time(hora, minuto)
        )
        reservas.append(reserva)

        minuto += 30
        if minuto >= 60:
            minuto = 0
            hora += 1

    return reservas
