import os
import sys
import pytest

@pytest.fixture
def clean_settings_env(monkeypatch):
    """Fixture que limpia y restaura el entorno para tests de settings."""
    # Guardar estado original
    original_env = os.environ.copy()

    yield monkeypatch

    # Restaurar entorno
    os.environ.clear()
    os.environ.update(original_env)

    # Eliminar config.settings del cache para que se reimporte limpio
    modules_to_remove = [key for key in sys.modules if key.startswith('config')]
    for mod in modules_to_remove:
        sys.modules.pop(mod, None)

def test_secret_key_required_in_production(clean_settings_env):
    """Verifica que SECRET_KEY falle sin variable en producción."""
    clean_settings_env.setenv('DEBUG', 'False')
    clean_settings_env.delenv('DJANGO_SECRET_KEY', raising=False)

    # Limpiar cache del módulo
    sys.modules.pop('config.settings', None)

    with pytest.raises(ValueError, match="DJANGO_SECRET_KEY"):
        import config.settings

def test_encryption_key_required_in_production(clean_settings_env):
    """Verifica que FIELD_ENCRYPTION_KEY falle sin variable en producción."""
    clean_settings_env.setenv('DEBUG', 'False')
    clean_settings_env.delenv('FIELD_ENCRYPTION_KEY', raising=False)

    sys.modules.pop('config.settings', None)

    with pytest.raises(ValueError, match="FIELD_ENCRYPTION_KEY"):
        import config.settings
