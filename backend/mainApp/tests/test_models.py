"""
Tests para los modelos de mainApp

Estos tests cubren las validaciones críticas y lógica de negocio en los modelos.
"""

import pytest
from datetime import date, time, timedelta
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from mainApp.models import Perfil, Mesa, Reserva
from mainApp.tests.factories import (
    UserFactory, PerfilFactory, PerfilClienteFactory,
    MesaFactory, ReservaFactory, ReservaPasadaFactory,
    crear_reserva_con_solapamiento
)


@pytest.mark.models
@pytest.mark.unit
class TestPerfilModel:
    """Tests para el modelo Perfil"""

    def test_crear_perfil_basico(self):
        """Debe crear un perfil con datos válidos"""
        perfil = PerfilFactory()
        assert perfil.id is not None
        assert perfil.user is not None
        assert perfil.rol in ['cliente', 'admin', 'cajero']

    def test_perfil_nombre_completo_coincide_con_user(self):
        """El nombre_completo debe coincidir con first_name + last_name del User"""
        perfil = PerfilFactory()
        expected = f"{perfil.user.first_name} {perfil.user.last_name}"
        assert perfil.nombre_completo == expected

    def test_perfil_email_coincide_con_user(self):
        """El email del perfil debe coincidir con el del User"""
        perfil = PerfilFactory()
        assert perfil.email == perfil.user.email

    def test_validacion_rol_invalido(self):
        """No debe permitir roles inválidos"""
        perfil = PerfilFactory.build(rol='rol_invalido')
        with pytest.raises(ValidationError):
            perfil.full_clean()

    def test_formato_rut_valido(self):
        """El RUT debe seguir el formato XX.XXX.XXX-X"""
        perfil = PerfilFactory()
        # RUT puede ser None (campo opcional) o tener formato válido
        if perfil.rut:
            assert '-' in perfil.rut
            assert len(perfil.rut) >= 9  # Al menos 8 dígitos + guión + verificador


@pytest.mark.models
@pytest.mark.unit
class TestMesaModel:
    """Tests para el modelo Mesa"""

    def test_crear_mesa_basica(self):
        """Debe crear una mesa con datos válidos"""
        mesa = MesaFactory()
        assert mesa.id is not None
        assert mesa.numero > 0
        assert mesa.capacidad > 0
        assert mesa.estado == 'disponible'

    def test_numero_mesa_unico(self):
        """No debe permitir dos mesas con el mismo número"""
        MesaFactory(numero=1)
        with pytest.raises(Exception):  # IntegrityError
            MesaFactory(numero=1)

    def test_capacidad_minima(self):
        """La capacidad no puede ser menor a 1"""
        mesa = MesaFactory.build(capacidad=0)
        with pytest.raises(ValidationError):
            mesa.full_clean()

    def test_estado_valido(self):
        """El estado debe ser uno de los valores permitidos"""
        estados_validos = ['disponible', 'ocupada', 'reservada', 'mantenimiento']
        for estado in estados_validos:
            mesa = MesaFactory(estado=estado)
            assert mesa.estado == estado


@pytest.mark.models
@pytest.mark.critical
class TestReservaModel:
    """Tests para el modelo Reserva - FUNCIONALIDAD CRÍTICA"""

    def test_crear_reserva_valida(self):
        """Debe crear una reserva con datos válidos"""
        reserva = ReservaFactory()
        assert reserva.id is not None
        assert reserva.cliente is not None
        assert reserva.mesa is not None
        assert reserva.fecha_reserva >= date.today()

    def test_fecha_pasada_invalida(self):
        """No debe permitir reservas con fecha pasada"""
        reserva = ReservaPasadaFactory.build()
        with pytest.raises(ValidationError) as exc_info:
            reserva.full_clean()
        # El error puede estar en 'fecha_reserva' o en '__all__'
        error_str = str(exc_info.value)
        assert 'fecha_reserva' in error_str or '__all__' in error_str
        assert 'pasada' in error_str.lower()

    def test_hora_inicio_en_horario_valido(self):
        """La hora de inicio debe estar entre 12:00 y 21:00"""
        # Hora válida (14:00)
        reserva = ReservaFactory(hora_inicio=time(14, 0))
        reserva.full_clean()  # No debe lanzar error

        # Hora inválida temprano (10:00)
        # La validación se ejecuta en save(), por lo que .create() debe fallar directamente
        with pytest.raises(ValidationError):
            ReservaFactory.create(hora_inicio=time(10, 0))

        # Hora inválida tarde (22:00)
        with pytest.raises(ValidationError):
            ReservaFactory.create(hora_inicio=time(22, 0))

    def test_num_personas_no_excede_capacidad_mesa(self):
        """El número de personas no puede exceder la capacidad de la mesa"""
        mesa = MesaFactory(capacidad=4)

        # Válido: 4 personas en mesa de 4
        reserva_valida = ReservaFactory(mesa=mesa, num_personas=4)
        reserva_valida.full_clean()

        # Inválido: 6 personas en mesa de 4
        # La validación se ejecuta en save(), por lo que .create() debe fallar directamente
        with pytest.raises(ValidationError) as exc_info:
            ReservaFactory.create(mesa=mesa, num_personas=6)
        assert 'num_personas' in str(exc_info.value)

    def test_hora_fin_calculada_automaticamente(self):
        """La hora_fin debe calcularse automáticamente (2 horas después de hora_inicio)"""
        reserva = ReservaFactory(hora_inicio=time(14, 0))
        reserva.save()

        # hora_fin debe ser 16:00 (14:00 + 2 horas)
        assert reserva.hora_fin == time(16, 0)

    def test_solapamiento_reservas_misma_mesa(self):
        """
        CRÍTICO: No debe permitir reservas que se solapen en la misma mesa.

        Escenario:
        - Reserva 1: Mesa 1, 2025-12-25, 14:00-16:00
        - Reserva 2: Mesa 1, 2025-12-25, 15:00-17:00 (SE SOLAPA)
        """
        # Crear primera reserva
        fecha = date.today() + timedelta(days=30)
        mesa = MesaFactory()
        reserva1 = ReservaFactory(
            mesa=mesa,
            fecha_reserva=fecha,
            hora_inicio=time(14, 0)
        )

        # Intentar crear reserva solapada
        reserva2 = ReservaFactory.build(
            mesa=mesa,
            fecha_reserva=fecha,
            hora_inicio=time(15, 0)  # Se solapa con reserva1 (14:00-16:00)
        )
        # Calcular hora_fin manualmente ya que .build() no llama a save()
        from datetime import datetime
        dt_inicio = datetime.combine(datetime.today(), reserva2.hora_inicio)
        dt_fin = dt_inicio + timedelta(hours=2)
        reserva2.hora_fin = dt_fin.time()

        with pytest.raises(ValidationError) as exc_info:
            reserva2.full_clean()

        error_msg = str(exc_info.value)
        assert 'solapamiento' in error_msg.lower() or 'solapa' in error_msg.lower()

    def test_reservas_diferentes_mesas_mismo_horario_valido(self):
        """
        Debe permitir reservas en diferentes mesas al mismo tiempo.

        Escenario:
        - Reserva 1: Mesa 1, 2025-12-25, 14:00-16:00
        - Reserva 2: Mesa 2, 2025-12-25, 14:00-16:00 (VÁLIDO - diferente mesa)
        """
        fecha = date.today() + timedelta(days=30)
        mesa1 = MesaFactory(numero=1)
        mesa2 = MesaFactory(numero=2)

        reserva1 = ReservaFactory(
            mesa=mesa1,
            fecha_reserva=fecha,
            hora_inicio=time(14, 0)
        )

        # Debe poder crear reserva en otra mesa al mismo tiempo
        reserva2 = ReservaFactory(
            mesa=mesa2,
            fecha_reserva=fecha,
            hora_inicio=time(14, 0)
        )

        assert reserva1.id is not None
        assert reserva2.id is not None
        assert reserva1.mesa != reserva2.mesa

    def test_reservas_misma_mesa_horarios_consecutivos_valido(self):
        """
        Debe permitir reservas consecutivas en la misma mesa.

        Escenario:
        - Reserva 1: Mesa 1, 2025-12-25, 14:00-16:00
        - Reserva 2: Mesa 1, 2025-12-25, 16:00-18:00 (VÁLIDO - consecutivo sin solapar)
        """
        fecha = date.today() + timedelta(days=30)
        mesa = MesaFactory()

        reserva1 = ReservaFactory(
            mesa=mesa,
            fecha_reserva=fecha,
            hora_inicio=time(14, 0)  # 14:00-16:00
        )

        # Reserva consecutiva (empieza cuando termina la anterior)
        reserva2 = ReservaFactory(
            mesa=mesa,
            fecha_reserva=fecha,
            hora_inicio=time(16, 0)  # 16:00-18:00
        )

        assert reserva1.id is not None
        assert reserva2.id is not None

    def test_soft_delete_funciona(self):
        """Las reservas deben usar soft delete (deleted_at)"""
        reserva = ReservaFactory()
        reserva_id = reserva.id

        # Verificar que existe
        assert Reserva.objects.filter(id=reserva_id).exists()

        # Soft delete
        reserva.delete()

        # No debe aparecer en queryset normal
        assert not Reserva.objects.filter(id=reserva_id).exists()

        # Pero debe existir con deleted_at
        assert Reserva.all_objects.filter(id=reserva_id, deleted_at__isnull=False).exists()

    def test_estado_valido(self):
        """El estado debe ser uno de los valores permitidos"""
        estados_validos = ['pendiente', 'confirmada', 'activa', 'completada', 'cancelada']
        for estado in estados_validos:
            reserva = ReservaFactory(estado=estado)
            assert reserva.estado == estado

    def test_str_representation(self):
        """La representación en string debe ser legible"""
        reserva = ReservaFactory()
        str_repr = str(reserva)

        # Debe incluir información clave
        assert str(reserva.mesa.numero) in str_repr or str(reserva.cliente.username) in str_repr


@pytest.mark.models
@pytest.mark.integration
class TestReservaWorkflow:
    """Tests de flujo completo de reservas"""

    def test_ciclo_vida_reserva(self):
        """
        Test del ciclo de vida completo de una reserva:
        pendiente -> confirmada -> activa -> completada
        """
        reserva = ReservaFactory(estado='pendiente')

        # Confirmar
        reserva.estado = 'confirmada'
        reserva.save()
        assert reserva.estado == 'confirmada'

        # Activar (cliente llega)
        reserva.estado = 'activa'
        reserva.save()
        assert reserva.estado == 'activa'

        # Completar
        reserva.estado = 'completada'
        reserva.save()
        assert reserva.estado == 'completada'

    def test_cancelar_reserva(self):
        """Debe poder cancelar una reserva en cualquier estado previo"""
        reserva = ReservaFactory(estado='pendiente')

        reserva.estado = 'cancelada'
        reserva.save()

        assert reserva.estado == 'cancelada'
