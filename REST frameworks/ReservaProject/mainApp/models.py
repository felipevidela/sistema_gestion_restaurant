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
    rut = EncryptedCharField(max_length=12, blank=True, help_text="RUT del usuario (encriptado)")
    telefono = EncryptedCharField(max_length=15, blank=True, help_text="Teléfono del usuario (encriptado)")
    email = models.EmailField(blank=True)

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
    notas = models.TextField(blank=True, help_text="Notas o requerimientos especiales")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Reserva {self.id} - {self.cliente.username} - Mesa {self.mesa.numero} ({self.fecha_reserva})"

    def clean(self):
        """Validar que la mesa esté disponible en la fecha y hora solicitada"""
        # Validar que la fecha no sea en el pasado
        from datetime import date
        if self.fecha_reserva < date.today():
            raise ValidationError("No se pueden crear reservas para fechas pasadas")

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

