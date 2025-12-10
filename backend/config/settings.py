
from pathlib import Path
import os
import sys

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(env_path):
    """Cargar variables desde un archivo .env simple si existe."""
    if not env_path.exists():
        return

    with env_path.open() as env_file:
        for line in env_file:
            stripped = line.strip()

            # Ignorar comentarios o líneas vacías
            if not stripped or stripped.startswith('#'):
                continue

            key, sep, value = stripped.partition('=')
            if not sep:
                continue

            key = key.strip()
            value = value.strip().strip('"').strip("'")

            # No sobrescribir variables ya definidas en el entorno
            os.environ.setdefault(key, value)


load_env_file(BASE_DIR / '.env')
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Frontend React - configuración para producción
# BASE_DIR = /app/ReservaProject (donde está manage.py)
# BASE_DIR.parent = /app (donde está Reservas/)
FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: don't run with debug turned on in production!
# CAMBIO: Default False para evitar arrancar en debug si falta la env var
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')

# Detectar modo testing (manage.py test o pytest)
TESTING = 'test' in sys.argv or 'pytest' in sys.modules

# Modo desarrollo = DEBUG activo O ejecutando tests
DEVELOPMENT_MODE = DEBUG or TESTING

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if DEVELOPMENT_MODE:
        # Clave insegura solo para desarrollo/testing local
        SECRET_KEY = 'dev-insecure-key-only-for-local-development'
    else:
        raise ValueError(
            "DJANGO_SECRET_KEY no configurada.\n"
            "Genera una con: python -c \"import secrets; print(secrets.token_urlsafe(50))\"\n"
            "Y configúrala en variables de entorno."
        )

# Obtener hosts de variable de entorno y siempre incluir .railway.app
_allowed_hosts = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
if '.railway.app' not in _allowed_hosts:
    _allowed_hosts.append('.railway.app')
ALLOWED_HOSTS = _allowed_hosts


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'django_cryptography',
    'django_filters',
    'channels',
    # Local apps
    'mainApp',
    'menuApp',
    'cocinaApp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Para servir archivos estáticos en producción
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [TEMPLATES_DIR, FRONTEND_DIR],  # Incluir directorio del frontend
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# Configuración de base de datos
import dj_database_url

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    if DEVELOPMENT_MODE:  # DEBUG o TESTING
        # Solo para desarrollo local y tests con SQLite
        DATABASE_URL = 'sqlite:///db.sqlite3'
    else:
        raise ValueError(
            "DATABASE_URL es requerida en producción. "
            "Configúrala en las variables de entorno."
        )

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# FIX: Remove 'schema' option if present, as it causes issues with psycopg2
if 'default' in DATABASES and 'OPTIONS' in DATABASES['default'] and 'schema' in DATABASES['default']['OPTIONS']:
    del DATABASES['default']['OPTIONS']['schema']


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'es-es'

TIME_ZONE = 'America/Santiago'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')  # Para producción (WhiteNoise)

# Incluir archivos estáticos del frontend React
# En producción, incluir todo el directorio dist para mantener la estructura /assets/
STATICFILES_DIRS = [STATIC_DIR, FRONTEND_DIR]

# Configuración de WhiteNoise para archivos estáticos en producción
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# en ReservaProject/settings.py (al final del archivo)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # 1ro: Prioridad a la autenticación por Token
        'rest_framework.authentication.TokenAuthentication',

        # 2do: Permite la autenticación por Sesión (para la API Navegable)
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        # Por defecto, exigimos que al menos esté autenticado
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Anónimos: máximo 20 requests por hora (previene spam en registro/login)
        'anon': '20/hour',
        # Usuarios autenticados: 100 requests por hora
        'user': '100/hour',
        # Rate especial para registro: 5 intentos por hora
        'register': '5/hour',
        # Rate especial para login: 10 intentos por hora
        'login': '10/hour',
    },
    # FIX #14 (MODERADO): Paginación para mejorar rendimiento en listados
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,  # 50 elementos por página por defecto
    # Filtros django-filter
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
}

# ASGI Configuration para WebSockets (Channels)
ASGI_APPLICATION = 'config.asgi.application'

# Channel Layers - Redis para WebSockets en tiempo real
# En Railway: agregar Redis como Add-on y configurar REDIS_URL
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.environ.get('REDIS_URL', 'redis://localhost:6379')],
        },
    },
}

# Configuración CORS para permitir el frontend React
# En desarrollo: localhost (para cuando corres backend y frontend separados)
# En producción (Railway): no es necesario CORS porque frontend y backend están en el mismo dominio
cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if cors_origins_env:
    # Si se configura manualmente (opcional)
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_env.split(',')]
else:
    # En desarrollo: permitir Vite dev server
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Puerto alternativo de Vite
        "http://127.0.0.1:5174",
        "http://localhost:5175",  # Puerto alternativo de Vite
        "http://127.0.0.1:5175",
    ]

CORS_ALLOW_CREDENTIALS = True

# Headers permitidos en requests CORS
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Métodos HTTP permitidos
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# FIX #30 (MODERADO): Configuración CSRF correcta
# CSRF Trusted Origins para permitir requests POST/PUT/DELETE desde frontend
csrf_trusted_env = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
if csrf_trusted_env:
    # Producción: desde variable de entorno
    CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_trusted_env.split(',')]
else:
    # Desarrollo: permitir localhost en diferentes puertos
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]

# Configuraciones adicionales de seguridad CSRF
CSRF_COOKIE_SECURE = not DEBUG  # Cookie CSRF solo sobre HTTPS en producción
CSRF_COOKIE_HTTPONLY = False  # False para que JavaScript pueda leer el token
CSRF_COOKIE_SAMESITE = 'Lax'  # Protección contra CSRF
SESSION_COOKIE_SECURE = not DEBUG  # Session cookie solo sobre HTTPS en producción
SESSION_COOKIE_SAMESITE = 'Lax'

# FIX: Configuración para HTTPS detrás de proxy (Railway)
# Railway usa proxy reverso, necesitamos que Django reconozca HTTPS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# En producción, forzar HTTPS
if not DEBUG:
    SECURE_SSL_REDIRECT = True  # Redirigir HTTP a HTTPS
    SESSION_COOKIE_SECURE = True  # Cookies solo por HTTPS
    CSRF_COOKIE_SECURE = True  # CSRF token solo por HTTPS

# Configuración de django-encrypted-model-fields para encriptación
# IMPORTANTE: Esta clave debe ser secreta en producción y guardarse en variables de entorno
# Generar clave: from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())
FIELD_ENCRYPTION_KEY = os.environ.get('FIELD_ENCRYPTION_KEY')
if not FIELD_ENCRYPTION_KEY:
    if DEVELOPMENT_MODE:
        # Clave Fernet válida para desarrollo/testing (generada con Fernet.generate_key())
        FIELD_ENCRYPTION_KEY = 'gCwnvM_lUMw4I8oIlClPSh17YVnT3i_kjpaEuQ8Jk1k='
    else:
        raise ValueError(
            "FIELD_ENCRYPTION_KEY no configurada.\n"
            "En producción: Configúrala en variables de entorno de Railway.\n"
            "En desarrollo: Ejecuta con DEBUG=True o configura la variable."
        )

# FIX #27 (MODERADO): Configuración de cache para mejorar rendimiento
# En desarrollo: usar cache local en memoria
# En producción: podría usar Redis configurando REDIS_URL en variables de entorno
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'reservas-cache',
        'OPTIONS': {
            'MAX_ENTRIES': 1000,  # Máximo 1000 entradas en cache
        },
        'TIMEOUT': 300,  # Cache por defecto: 5 minutos
    }
}

# FIX #21 (MODERADO): Sistema de auditoría y logging
# En producción (Railway), usar solo console logging (Railway captura stdout/stderr)
# En desarrollo, usar file logging

# Determinar handlers según el entorno
if DEBUG:
    # Desarrollo: file handlers (requiere directorio logs/)
    # Asegurar que el directorio logs/ existe
    LOGS_DIR = os.path.join(BASE_DIR, 'logs')
    os.makedirs(LOGS_DIR, exist_ok=True)

    LOGGING_HANDLERS = {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOGS_DIR, 'reservas.log'),
            'maxBytes': 1024 * 1024 * 10,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(LOGS_DIR, 'audit.log'),
            'maxBytes': 1024 * 1024 * 10,  # 10 MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
    }
    DJANGO_HANDLERS = ['console', 'file']
    AUDIT_HANDLERS = ['audit_file', 'console']
else:
    # Producción (Railway): solo console logging
    # Railway captura automáticamente stdout/stderr en sus logs
    LOGGING_HANDLERS = {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',  # Usar formato verbose en producción
        },
    }
    DJANGO_HANDLERS = ['console']
    AUDIT_HANDLERS = ['console']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {process:d} {thread:d} - {message}',
            'style': '{',
        },
        'simple': {
            'format': '[{levelname}] {asctime} - {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': LOGGING_HANDLERS,
    'loggers': {
        'django': {
            'handlers': DJANGO_HANDLERS,
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': DJANGO_HANDLERS,
            'level': 'WARNING',
            'propagate': False,
        },
        'mainApp': {
            'handlers': DJANGO_HANDLERS,
            'level': 'INFO',
            'propagate': False,
        },
        'mainApp.audit': {
            'handlers': AUDIT_HANDLERS,
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Configuración de Email
# En desarrollo: usar console backend (solo imprime emails en consola)
# En producción: usar SMTP configurado en variables de entorno
if DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@restaurante.com')

# URL del frontend para construir links en emails
# En desarrollo: localhost, en producción: dominio real
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
