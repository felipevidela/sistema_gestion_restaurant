from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from encrypted_model_fields.fields import EncryptedCharField


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

    def __str__(self):
        return f"{self.user.username} - {self.get_rol_display()}"

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

    def __str__(self):
        return f"Mesa {self.numero} ({self.estado})"

    class Meta:
        verbose_name = "Mesa"
        verbose_name_plural = "Mesas"
        ordering = ['numero']


class Reserva(models.Model):
    ESTADO_CHOICES = (
        ('pendiente', 'Pendiente'),
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

        # FIX #8 (GRAVE): Validar horario de cierre (restaurante cierra a las 23:00)
        hora_cierre = time(23, 0)
        if self.hora_fin > hora_cierre:
            raise ValidationError(
                f"La reserva no puede exceder el horario de cierre (23:00). "
                f"Hora fin calculada: {self.hora_fin.strftime('%H:%M')}"
            )

        # Validar capacidad de la mesa
        if self.num_personas > self.mesa.capacidad:
            raise ValidationError(
                f"La mesa {self.mesa.numero} tiene capacidad para {self.mesa.capacidad} personas. "
                f"No puede reservar para {self.num_personas} personas."
            )

        # Validar número mínimo de personas
        if self.num_personas < 1:
            raise ValidationError("Debe reservar para al menos 1 persona")

        # Validar que la mesa no esté reservada en el mismo horario
        reservas_conflicto = Reserva.objects.filter(
            mesa=self.mesa,
            fecha_reserva=self.fecha_reserva,
            estado__in=['pendiente', 'activa']
        ).exclude(id=self.id)

        for reserva in reservas_conflicto:
            # Verificar solapamiento de horarios
            if (self.hora_inicio < reserva.hora_fin and self.hora_fin > reserva.hora_inicio):
                raise ValidationError(
                    f"La mesa {self.mesa.numero} ya está reservada entre "
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

    class Meta:
        verbose_name = "Reserva"
        verbose_name_plural = "Reservas"
        ordering = ['-fecha_reserva', '-hora_inicio']
        indexes = [
            models.Index(fields=['fecha_reserva', 'estado']),
            models.Index(fields=['estado']),
            models.Index(fields=['-fecha_reserva', '-hora_inicio']),
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

