from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from encrypted_model_fields.fields import EncryptedCharField


# FIX #28 (MODERADO): Custom manager para soft delete
class SoftDeleteManager(models.Manager):
    """Manager que excluye automáticamente registros eliminados (deleted_at != NULL)"""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

    def with_deleted(self):
        """Incluir registros eliminados"""
        return super().get_queryset()

    def only_deleted(self):
        """Solo registros eliminados"""
        return super().get_queryset().filter(deleted_at__isnull=False)


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    ROL_CHOICES = (
        ('admin', 'Administrador'),
        ('cajero', 'Cajero'),
        ('mesero', 'Mesero'),
        ('cliente', 'Cliente'),
    )
    rol = models.CharField(max_length=10, choices=ROL_CHOICES, default='cliente')
    nombre_completo = models.CharField(max_length=200, blank=True)
    # Campos encriptados con django-encrypted-model-fields
    # FIX #17 (MODERADO): RUT debe ser único
    rut = EncryptedCharField(max_length=12, blank=True, null=True, unique=True, help_text="RUT del usuario (encriptado)")
    telefono = EncryptedCharField(max_length=15, blank=True, help_text="Teléfono del usuario (encriptado)")
    # FIX #18 (MODERADO): Email debe ser único
    email = models.EmailField(blank=True, null=True, unique=True)

    # Campos para sistema de invitados (reservas sin cuenta)
    es_invitado = models.BooleanField(
        default=False,
        help_text="Usuario creado sin contraseña para reserva pública"
    )
    token_activacion = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        unique=True,
        help_text="Token único para acceso sin login y activación de cuenta"
    )
    token_expira = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Fecha de expiración del token (48 horas desde creación)"
    )
    token_usado = models.BooleanField(
        default=False,
        help_text="Indica si el token de activación ya fue usado para crear cuenta"
    )

    def __str__(self):
        return f"{self.user.username} - {self.get_rol_display()}"

    def generar_token_activacion(self):
        """Genera un token único de activación válido por 48 horas"""
        import secrets
        self.token_activacion = secrets.token_urlsafe(32)
        self.token_expira = timezone.now() + timedelta(hours=48)
        self.token_usado = False
        self.save()
        return self.token_activacion

    def token_es_valido(self):
        """Verifica si el token de activación es válido"""
        if not self.token_activacion or self.token_usado:
            return False
        if self.token_expira and self.token_expira < timezone.now():
            return False
        return True

    class Meta:
        verbose_name = "Perfil"
        verbose_name_plural = "Perfiles"



class Mesa(models.Model):
    ESTADO_CHOICES = (
        ('disponible', 'Disponible'),
        ('reservada', 'Reservada'),
        ('ocupada', 'Ocupada'),
        ('limpieza', 'En Limpieza'),
    )

    numero = models.IntegerField(unique=True)
    capacidad = models.IntegerField(default=4)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='disponible')

    def clean(self):
        """Validaciones del modelo Mesa"""
        from django.core.exceptions import ValidationError

        if self.capacidad is not None and self.capacidad < 1:
            raise ValidationError({
                'capacidad': 'La capacidad debe ser al menos 1 persona.'
            })

    def __str__(self):
        return f"Mesa {self.numero} ({self.estado})"

    class Meta:
        verbose_name = "Mesa"
        verbose_name_plural = "Mesas"
        ordering = ['numero']


class Reserva(models.Model):
    ESTADO_CHOICES = (
        ('pendiente', 'Pendiente'),
        ('confirmada', 'Confirmada'),
        ('activa', 'Activa'),
        ('completada', 'Completada'),
        ('cancelada', 'Cancelada'),
    )

    cliente = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reservas')
    mesa = models.ForeignKey(Mesa, on_delete=models.CASCADE, related_name='reservas')
    fecha_reserva = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    num_personas = models.IntegerField(default=1)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='pendiente')
    # FIX #32 (MENOR): Limitar longitud de notas
    notas = models.TextField(blank=True, max_length=500, help_text="Notas o requerimientos especiales (máx 500 caracteres)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # FIX #28 (MODERADO): Soft delete - timestamp de eliminación
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="Fecha y hora de eliminación (soft delete)")

    # FIX #28 (MODERADO): Manager por defecto excluye eliminados
    objects = SoftDeleteManager()
    all_objects = models.Manager()  # Manager que incluye eliminados

    def __str__(self):
        return f"Reserva {self.id} - {self.cliente.username} - Mesa {self.mesa.numero} ({self.fecha_reserva})"

    def clean(self):
        """
        Validar que la mesa esté disponible en la fecha y hora solicitada.

        FIX #6 (MODERADO): Valida hora pasada en día actual
        FIX #1 (CRÍTICO): Valida solapamiento de horarios
        FIX #9 (GRAVE): Usa timezone-aware dates para comparaciones
        FIX #8 (GRAVE): Valida horario de cierre
        """
        from datetime import datetime, time
        from django.utils import timezone

        # FIX #9 (GRAVE): Usar timezone-aware date para comparaciones
        hoy = timezone.now().date()

        # Validar que la fecha no sea en el pasado
        if self.fecha_reserva < hoy:
            raise ValidationError("No se pueden crear reservas para fechas pasadas")

        # FIX #15 (MODERADO): Validar que la hora no sea pasada si la fecha es hoy
        if self.fecha_reserva == hoy:
            hora_actual = timezone.now().time()
            if self.hora_inicio < hora_actual:
                raise ValidationError(
                    f"No se pueden crear reservas para horas pasadas. "
                    f"La hora actual es {hora_actual.strftime('%H:%M')}"
                )

        # Validar horario de operación del restaurante (12:00 - 21:00)
        hora_apertura = time(12, 0)
        hora_ultimo_turno = time(21, 0)

        if self.hora_inicio < hora_apertura:
            raise ValidationError(
                f"El restaurante abre a las 12:00. "
                f"No se pueden hacer reservas antes de este horario."
            )

        if self.hora_inicio > hora_ultimo_turno:
            raise ValidationError(
                f"El último turno es a las 21:00. "
                f"No se pueden hacer reservas después de este horario."
            )

        # FIX #8 (GRAVE): Validar horario de cierre (restaurante cierra a las 23:00)
        hora_cierre = time(23, 0)
        if self.hora_fin and self.hora_fin > hora_cierre:
            raise ValidationError(
                f"La reserva no puede exceder el horario de cierre (23:00). "
                f"Hora fin calculada: {self.hora_fin.strftime('%H:%M')}"
            )

        # Validar capacidad de la mesa
        if self.num_personas > self.mesa.capacidad:
            raise ValidationError({
                'num_personas': f"La mesa {self.mesa.numero} tiene capacidad para {self.mesa.capacidad} personas. "
                                f"No puede reservar para {self.num_personas} personas."
            })

        # Validar número mínimo de personas
        if self.num_personas < 1:
            raise ValidationError("Debe reservar para al menos 1 persona")

        # Validar que la mesa no esté reservada en el mismo horario
        reservas_conflicto = Reserva.objects.filter(
            mesa=self.mesa,
            fecha_reserva=self.fecha_reserva,
            estado__in=['pendiente', 'activa']
        ).exclude(id=self.id)

        # Verificar que hora_fin esté calculada antes de validar solapamiento
        if self.hora_fin:
            for reserva in reservas_conflicto:
                # Verificar solapamiento de horarios
                if (self.hora_inicio < reserva.hora_fin and self.hora_fin > reserva.hora_inicio):
                    raise ValidationError(
                        f"Solapamiento detectado: La mesa {self.mesa.numero} ya está reservada entre "
                        f"{reserva.hora_inicio} y {reserva.hora_fin}"
                    )

    def save(self, *args, **kwargs):
        # Auto-calcular hora_fin como hora_inicio + 2 horas
        if self.hora_inicio:
            from datetime import datetime
            # Convertir hora_inicio a datetime para sumar timedelta
            dt_inicio = datetime.combine(datetime.today(), self.hora_inicio)
            dt_fin = dt_inicio + timedelta(hours=2)
            self.hora_fin = dt_fin.time()

        self.full_clean()  # Ejecutar validaciones antes de guardar
        super().save(*args, **kwargs)

    # FIX #28 (MODERADO): Soft delete methods
    def delete(self, using=None, keep_parents=False):
        """Soft delete: marca como eliminado en lugar de borrar"""
        self.deleted_at = timezone.now()
        self.save(using=using)

    def hard_delete(self):
        """Eliminación real de la base de datos"""
        super().delete()

    def restore(self):
        """Restaurar una reserva eliminada"""
        self.deleted_at = None
        self.save()

    @property
    def is_deleted(self):
        """Verificar si la reserva está eliminada"""
        return self.deleted_at is not None

    class Meta:
        verbose_name = "Reserva"
        verbose_name_plural = "Reservas"
        ordering = ['-fecha_reserva', '-hora_inicio']
        indexes = [
            models.Index(fields=['fecha_reserva', 'estado']),
            models.Index(fields=['estado']),
            models.Index(fields=['-fecha_reserva', '-hora_inicio']),
            # FIX #33 (MENOR): Índice compuesto para queries por cliente y fecha
            models.Index(fields=['cliente', 'fecha_reserva'], name='idx_cliente_fecha'),
        ]
        # FIX #10 (GRAVE): Agregar constraints a nivel de base de datos
        constraints = [
            # Validar que num_personas sea >= 1
            models.CheckConstraint(
                check=models.Q(num_personas__gte=1),
                name='num_personas_minimo_1'
            ),
            # Validar que num_personas no exceda límite razonable
            models.CheckConstraint(
                check=models.Q(num_personas__lte=50),
                name='num_personas_maximo_50'
            ),
        ]


class BloqueoMesa(models.Model):
    """
    Modelo para bloquear mesas por mantenimiento, eventos, u otros motivos.
    Permite bloqueos por rango de fechas, días completos y recurrencias.
    """
    CATEGORIA_CHOICES = (
        ('mantenimiento', 'Mantenimiento'),
        ('evento_privado', 'Evento Privado'),
        ('reparacion', 'Reparación'),
        ('reserva_especial', 'Reserva Especial'),
        ('otro', 'Otro'),
    )

    TIPO_RECURRENCIA_CHOICES = (
        ('ninguna', 'Sin Recurrencia'),
        ('diaria', 'Diaria'),
        ('semanal', 'Semanal'),
        ('mensual', 'Mensual'),
    )

    mesa = models.ForeignKey(
        Mesa,
        on_delete=models.CASCADE,
        related_name='bloqueos',
        help_text="Mesa a bloquear"
    )
    fecha_inicio = models.DateField(help_text="Fecha de inicio del bloqueo")
    fecha_fin = models.DateField(help_text="Fecha de fin del bloqueo")
    hora_inicio = models.TimeField(
        null=True,
        blank=True,
        help_text="Hora de inicio (dejar vacío para bloqueo de día completo)"
    )
    hora_fin = models.TimeField(
        null=True,
        blank=True,
        help_text="Hora de fin (dejar vacío para bloqueo de día completo)"
    )
    motivo = models.CharField(
        max_length=200,
        help_text="Motivo del bloqueo"
    )
    categoria = models.CharField(
        max_length=20,
        choices=CATEGORIA_CHOICES,
        default='otro',
        help_text="Categoría del bloqueo"
    )
    notas = models.TextField(
        blank=True,
        max_length=500,
        help_text="Notas adicionales (máx 500 caracteres)"
    )
    usuario_creador = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='bloqueos_creados',
        help_text="Usuario que creó el bloqueo"
    )
    tipo_recurrencia = models.CharField(
        max_length=10,
        choices=TIPO_RECURRENCIA_CHOICES,
        default='ninguna',
        help_text="Tipo de recurrencia del bloqueo"
    )
    activo = models.BooleanField(
        default=True,
        help_text="Si el bloqueo está activo"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Bloqueo Mesa {self.mesa.numero} - {self.fecha_inicio} ({self.get_categoria_display()})"

    def clean(self):
        """Validaciones del modelo BloqueoMesa"""
        from django.core.exceptions import ValidationError
        from django.utils import timezone

        # Validar que fecha_fin sea posterior o igual a fecha_inicio
        if self.fecha_fin < self.fecha_inicio:
            raise ValidationError({
                'fecha_fin': 'La fecha de fin debe ser posterior o igual a la fecha de inicio.'
            })

        # Validar que las fechas no sean en el pasado
        hoy = timezone.now().date()
        if self.fecha_inicio < hoy:
            raise ValidationError({
                'fecha_inicio': 'No se pueden crear bloqueos para fechas pasadas.'
            })

        # Si se especifica hora_inicio, debe especificarse hora_fin y viceversa
        if (self.hora_inicio is None) != (self.hora_fin is None):
            raise ValidationError(
                'Debe especificar tanto hora_inicio como hora_fin, o dejar ambas vacías para bloqueo de día completo.'
            )

        # Si hay horas especificadas, validar que hora_fin sea posterior a hora_inicio
        if self.hora_inicio and self.hora_fin:
            if self.hora_fin <= self.hora_inicio:
                raise ValidationError({
                    'hora_fin': 'La hora de fin debe ser posterior a la hora de inicio.'
                })

            # Validar horario de operación (12:00 - 23:00)
            from datetime import time
            hora_apertura = time(12, 0)
            hora_cierre = time(23, 0)

            if self.hora_inicio < hora_apertura or self.hora_inicio > hora_cierre:
                raise ValidationError({
                    'hora_inicio': 'La hora de inicio debe estar entre 12:00 y 23:00.'
                })

            if self.hora_fin < hora_apertura or self.hora_fin > hora_cierre:
                raise ValidationError({
                    'hora_fin': 'La hora de fin debe estar entre 12:00 y 23:00.'
                })

        # Validar solapamiento con otros bloqueos activos de la misma mesa
        if self.activo:
            bloqueos_conflicto = BloqueoMesa.objects.filter(
                mesa=self.mesa,
                activo=True
            ).exclude(id=self.id)

            for bloqueo in bloqueos_conflicto:
                # Verificar solapamiento de fechas
                if (self.fecha_inicio <= bloqueo.fecha_fin and
                    self.fecha_fin >= bloqueo.fecha_inicio):

                    # Si ambos bloqueos son de día completo, hay conflicto
                    if not self.hora_inicio and not bloqueo.hora_inicio:
                        raise ValidationError(
                            f"Existe un bloqueo de día completo en las fechas {bloqueo.fecha_inicio} - {bloqueo.fecha_fin}"
                        )

                    # Si uno es de día completo y el otro tiene horario, hay conflicto
                    if not self.hora_inicio or not bloqueo.hora_inicio:
                        raise ValidationError(
                            f"Existe un bloqueo que se solapa con las fechas seleccionadas"
                        )

                    # Si ambos tienen horario, verificar solapamiento de horas
                    if (self.hora_inicio < bloqueo.hora_fin and
                        self.hora_fin > bloqueo.hora_inicio):
                        raise ValidationError(
                            f"Existe un bloqueo entre {bloqueo.hora_inicio} y {bloqueo.hora_fin} "
                            f"en las fechas {bloqueo.fecha_inicio} - {bloqueo.fecha_fin}"
                        )

    def save(self, *args, **kwargs):
        self.full_clean()  # Ejecutar validaciones antes de guardar
        super().save(*args, **kwargs)

    def esta_activo_en_fecha_hora(self, fecha, hora_inicio=None, hora_fin=None):
        """
        Verifica si el bloqueo está activo en una fecha y hora específica.

        Args:
            fecha: DateField - fecha a verificar
            hora_inicio: TimeField - hora de inicio a verificar (opcional)
            hora_fin: TimeField - hora de fin a verificar (opcional)

        Returns:
            bool - True si el bloqueo aplica en la fecha/hora especificada
        """
        if not self.activo:
            return False

        # Verificar si la fecha está dentro del rango
        if not (self.fecha_inicio <= fecha <= self.fecha_fin):
            return False

        # Si el bloqueo es de día completo, aplica siempre
        if not self.hora_inicio:
            return True

        # Si no se especificaron horas a verificar, solo verificar fecha
        if hora_inicio is None or hora_fin is None:
            return True

        # Verificar solapamiento de horarios
        return (hora_inicio < self.hora_fin and hora_fin > self.hora_inicio)

    class Meta:
        verbose_name = "Bloqueo de Mesa"
        verbose_name_plural = "Bloqueos de Mesas"
        ordering = ['-fecha_inicio', '-hora_inicio']
        indexes = [
            models.Index(fields=['mesa', 'fecha_inicio', 'fecha_fin']),
            models.Index(fields=['activo']),
            models.Index(fields=['categoria']),
        ]

