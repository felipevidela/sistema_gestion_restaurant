from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Perfil


@receiver(post_save, sender=User)
def crear_perfil_usuario(sender, instance, created, **kwargs):
    """
    Signal para crear automáticamente un Perfil cuando se crea un nuevo User.
    Por defecto, el rol será 'cliente'.
    """
    if created:
        Perfil.objects.create(user=instance)


@receiver(post_save, sender=User)
def guardar_perfil_usuario(sender, instance, **kwargs):
    """
    Signal para guardar el perfil cada vez que se guarda el usuario.
    """
    if hasattr(instance, 'perfil'):
        instance.perfil.save()
