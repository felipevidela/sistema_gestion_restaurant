from django.apps import AppConfig


class CocinaappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cocinaApp'

    def ready(self):
        import cocinaApp.signals
