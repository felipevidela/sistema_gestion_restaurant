from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Pedido


@receiver(pre_save, sender=Pedido)
def actualizar_timestamps_estado(sender, instance, **kwargs):
    """Actualiza fecha_listo y fecha_entregado cuando cambia el estado."""
    if instance.pk:
        try:
            pedido_anterior = Pedido.objects.get(pk=instance.pk)

            # Transición a LISTO
            if instance.estado == 'LISTO' and pedido_anterior.estado != 'LISTO':
                if not instance.fecha_listo:
                    instance.fecha_listo = timezone.now()

            # Transición a ENTREGADO
            if instance.estado == 'ENTREGADO' and pedido_anterior.estado != 'ENTREGADO':
                if not instance.fecha_entregado:
                    instance.fecha_entregado = timezone.now()
                if not instance.fecha_listo:
                    instance.fecha_listo = timezone.now()

        except Pedido.DoesNotExist:
            pass
