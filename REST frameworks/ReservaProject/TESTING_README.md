# Guía de Testing - Sistema de Reservas

## 📋 Descripción

Este proyecto cuenta con una infraestructura completa de pruebas automatizadas usando **pytest**, **factory_boy**, y **Django REST Framework Testing Tools**.

## 🛠️ Instalación de Dependencias

Las dependencias de testing ya están instaladas. Si necesitas instalarlas nuevamente:

```bash
pip install pytest pytest-django pytest-cov factory-boy faker freezegun
```

## 🚀 Ejecutar Tests

### Todos los tests
```bash
pytest
```

### Tests con reporte de coverage
```bash
pytest --cov=mainApp --cov-report=html
```

### Tests específicos por categoría
```bash
# Tests unitarios solamente
pytest -m unit

# Tests de integración
pytest -m integration

# Tests críticos de negocio
pytest -m critical

# Tests de API
pytest -m api

# Tests de modelos
pytest -m models

# Tests de permisos
pytest -m permissions
```

### Tests de un archivo específico
```bash
pytest mainApp/tests/test_models.py
pytest mainApp/tests/test_views.py
pytest mainApp/tests/test_serializers.py
pytest mainApp/tests/test_permissions.py
```

### Un test específico
```bash
pytest mainApp/tests/test_models.py::TestReservaModel::test_solapamiento_reservas_misma_mesa
```

### Tests verbose (más información)
```bash
pytest -v
```

### Tests con output en tiempo real
```bash
pytest -s
```

## 📊 Reportes de Coverage

Después de ejecutar los tests con coverage, abre el reporte HTML:

```bash
# El reporte se genera en htmlcov/index.html
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

## 📁 Estructura de Tests

```
mainApp/tests/
├── __init__.py
├── conftest.py           # Fixtures globales
├── factories.py          # Factories para generar datos de prueba
├── test_models.py        # Tests de modelos (Perfil, Mesa, Reserva)
├── test_views.py         # Tests de endpoints de API
├── test_serializers.py   # Tests de serializers y validaciones
└── test_permissions.py   # Tests de permisos y autenticación
```

## 🏭 Factories - Generar Datos de Prueba

Las factories permiten crear objetos de prueba fácilmente:

### Usuarios
```python
from mainApp.tests.factories import UserFactory, PerfilClienteFactory, PerfilAdminFactory

# Crear usuario básico (automáticamente crea perfil por signal)
user = UserFactory()

# Crear usuario con valores específicos
user = UserFactory(username='juan', email='juan@test.com')

# Crear perfil de cliente
perfil = PerfilClienteFactory()

# Crear perfil de admin
admin = PerfilAdminFactory()

# Crear múltiples usuarios
users = UserFactory.create_batch(5)
```

### Mesas
```python
from mainApp.tests.factories import MesaFactory, MesaPequenaFactory, MesaGrandeFactory

# Mesa básica (capacidad 4)
mesa = MesaFactory()

# Mesa pequeña (capacidad 2)
mesa_pequena = MesaPequenaFactory()

# Mesa grande (capacidad 8)
mesa_grande = MesaGrandeFactory()

# Mesa con valores personalizados
mesa = MesaFactory(numero=10, capacidad=6, estado='ocupada')
```

### Reservas
```python
from mainApp.tests.factories import ReservaFactory, ReservaActivaFactory

# Reserva válida (por defecto para mañana)
reserva = ReservaFactory()

# Reserva con fecha y hora específica
from datetime import date, time
reserva = ReservaFactory(
    fecha_reserva=date(2025, 12, 25),
    hora_inicio=time(19, 0),
    num_personas=4
)

# Reserva con cliente y mesa específica
reserva = ReservaFactory(cliente=mi_user, mesa=mi_mesa)

# Reserva activa
reserva = ReservaActivaFactory()

# Crear múltiples reservas
reservas = ReservaFactory.create_batch(10)
```

## 🎯 Fixtures Disponibles

Los siguientes fixtures están disponibles automáticamente en todos los tests:

### Clientes de API
- `api_client`: Cliente sin autenticar
- `authenticated_client`: Cliente autenticado como cliente normal
- `admin_client`: Cliente autenticado como admin

### Usuarios
- `user_cliente`: Usuario con rol cliente
- `user_admin`: Usuario con rol admin
- `user_cajero`: Usuario con rol cajero

### Mesas
- `mesa_disponible`: Mesa disponible (capacidad 4)
- `mesa_pequena`: Mesa para 2 personas
- `mesa_grande`: Mesa para 8 personas

### Fechas
- `fecha_futura`: Fecha en el futuro (mañana)
- `fecha_pasada`: Fecha en el pasado (ayer)
- `hora_valida`: Hora válida (14:00)

### Reservas
- `reserva_valida`: Reserva válida para tests

### Ejemplo de uso
```python
def test_listar_reservas(authenticated_client, mesa_disponible):
    """Test usando fixtures"""
    # El cliente ya está autenticado
    # La mesa ya existe
    response = authenticated_client.get('/api/reservas/')
    assert response.status_code == 200
```

## 📝 Escribir Nuevos Tests

### Template básico
```python
import pytest
from mainApp.tests.factories import ReservaFactory

@pytest.mark.unit
class TestMiModelo:
    """Descripción de qué se está testeando"""

    def test_caso_basico(self):
        """Descripción del caso de prueba"""
        # Arrange (preparar)
        reserva = ReservaFactory()

        # Act (actuar)
        resultado = reserva.alguna_operacion()

        # Assert (verificar)
        assert resultado == valor_esperado
```

### Test de API
```python
@pytest.mark.api
def test_crear_reserva(authenticated_client, mesa_disponible):
    """Debe permitir crear una reserva válida"""
    data = {
        'mesa': mesa_disponible.id,
        'fecha_reserva': '2025-12-25',
        'hora_inicio': '14:00:00',
        'num_personas': 2
    }

    response = authenticated_client.post('/api/reservas/', data, format='json')

    assert response.status_code == 201
    assert response.data['estado'] == 'pendiente'
```

## 🏷️ Markers Personalizados

Los tests pueden ser marcados con categorías:

- `@pytest.mark.unit`: Tests unitarios
- `@pytest.mark.integration`: Tests de integración
- `@pytest.mark.api`: Tests de API endpoints
- `@pytest.mark.models`: Tests de modelos
- `@pytest.mark.views`: Tests de vistas
- `@pytest.mark.serializers`: Tests de serializers
- `@pytest.mark.permissions`: Tests de permisos
- `@pytest.mark.critical`: Tests de funcionalidad crítica
- `@pytest.mark.slow`: Tests lentos

## ⚠️ Tests Críticos de Negocio

Los siguientes tests son **CRÍTICOS** y deben pasar siempre:

### Validaciones de Reserva
- ❌ No permitir reservas con fecha pasada
- ❌ No permitir solapamiento de reservas en la misma mesa
- ❌ No permitir más personas que la capacidad de la mesa
- ❌ No permitir horas fuera del horario (12:00-21:00)

### Permisos y Seguridad
- ✅ Clientes solo ven sus propias reservas
- ✅ Clientes no pueden editar reservas de otros
- ✅ Admins pueden ver todas las reservas
- ✅ Soft delete funciona correctamente

## 🐛 Debugging Tests

### Ver print statements
```bash
pytest -s
```

### Ver más detalle en fallos
```bash
pytest -vv
```

### Parar en el primer error
```bash
pytest -x
```

### Ejecutar el último test que falló
```bash
pytest --lf
```

### Ver qué tests se ejecutarían sin ejecutarlos
```bash
pytest --collect-only
```

## 📈 Objetivos de Coverage

| Módulo | Objetivo | Estado Actual |
|--------|----------|---------------|
| Models | 90%+ | ⚠️ En progreso |
| Views | 85%+ | ⚠️ En progreso |
| Serializers | 90%+ | ⚠️ En progreso |
| Permissions | 95%+ | ⚠️ En progreso |

## 🔄 CI/CD Integration

Para integrar con GitHub Actions, Gitlab CI, etc:

```yaml
# Ejemplo .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.13'

    - name: Install dependencies
      run: |
        pip install -r requirements.txt

    - name: Run tests
      run: |
        pytest --cov=mainApp --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

## 📚 Recursos Adicionales

- [Pytest Documentation](https://docs.pytest.org/)
- [Factory Boy Documentation](https://factoryboy.readthedocs.io/)
- [DRF Testing Guide](https://www.django-rest-framework.org/api-guide/testing/)
- [Django Testing Documentation](https://docs.djangoproject.com/en/5.0/topics/testing/)

## 🤝 Contribuir

Al añadir nuevas funcionalidades, asegúrate de:

1. ✅ Escribir tests para el nuevo código
2. ✅ Mantener coverage arriba del 80%
3. ✅ Marcar tests críticos con `@pytest.mark.critical`
4. ✅ Documentar fixtures y factories nuevas
5. ✅ Ejecutar `pytest` antes de hacer commit
