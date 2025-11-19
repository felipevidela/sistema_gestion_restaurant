# 📋 Guía de Testing Manual - Sistema de Reservas con Cuenta Opcional

## 🚀 Pre-requisitos

Asegúrate de que ambos servidores estén corriendo:

- **Django**: http://localhost:8000
- **React**: http://localhost:5173

```bash
# Terminal 1 - Django
cd "REST frameworks/ReservaProject"
python manage.py runserver

# Terminal 2 - React
cd Reservas
npm run dev
```

---

## ✅ TEST 1: Checkbox "Quiero crear una cuenta"

**Objetivo**: Verificar que el checkbox controla la visibilidad de los campos de password.

### Pasos:

1. Abre el navegador en: **http://localhost:5173**
2. Deberías ver el formulario de reserva pública
3. Observa el checkbox **"Quiero crear una cuenta"**

### Verificaciones:

- [ ] Por defecto, el checkbox está **DESMARCADO**
- [ ] Los campos de password **NO están visibles**
- [ ] Marca el checkbox ✓
- [ ] Los campos de password **APARECEN** (Password y Confirmar Password)
- [ ] Desmarca el checkbox
- [ ] Los campos de password **DESAPARECEN**

**✅ RESULTADO ESPERADO**: El checkbox controla correctamente la visibilidad de los campos de password.

---

## ✅ TEST 2: Crear Reserva SIN cuenta (Invitado)

**Objetivo**: Crear una reserva sin crear cuenta (usuario invitado).

### Pasos:

1. Refresca la página (F5)
2. **NO marques** el checkbox "Quiero crear una cuenta"
3. Completa el formulario con estos datos:

```
Email: invitado.prueba1@example.com
Nombre: Carlos
Apellido: Invitado
RUT: 11.111.111-1
Teléfono: +56 9 1111 1111
Mesa: 1 (o cualquier disponible)
Fecha: [Selecciona mañana o pasado]
Hora inicio: 14:00
Hora fin: 16:00
Número de personas: 2
```

4. Haz clic en **"Crear Reserva"**

### Verificaciones:

- [ ] La reserva se crea exitosamente
- [ ] Aparece un mensaje de éxito
- [ ] **NO** deberías ser redirigido al panel de usuario (porque es invitado)
- [ ] Revisa la **consola de Django** (terminal donde corre el servidor)
- [ ] Deberías ver un EMAIL con:
  - Asunto: "Confirmación de Reserva..."
  - Un link tipo: `http://localhost:5173/reserva/[TOKEN_LARGO]`

**✅ RESULTADO ESPERADO**: Reserva creada como invitado, email con link de acceso generado.

**📝 NOTA**: Copia el token del link (la parte después de `/reserva/`) para el siguiente test.

---

## ✅ TEST 3: Acceder a Reserva de Invitado

**Objetivo**: Acceder a la reserva usando el link del email.

### Pasos:

1. Copia el link completo del email en la consola de Django
   - Ejemplo: `http://localhost:5173/reserva/ABC123...XYZ`
2. Abre ese link en el navegador

### Verificaciones:

- [ ] La página carga correctamente
- [ ] Se muestra la información de la reserva:
  - Mesa número
  - Fecha y hora
  - Número de personas
- [ ] Se muestran los datos del cliente:
  - Nombre completo
  - Email
  - Teléfono
- [ ] Aparece un **banner azul** con el mensaje: "Activa tu cuenta para gestionar tus reservas más fácilmente"
- [ ] Hay un botón **"Activar mi cuenta"**
- [ ] Hay un botón **"Cancelar Reserva"** (en rojo)

**✅ RESULTADO ESPERADO**: Página de reserva de invitado funciona correctamente.

---

## ✅ TEST 4: Crear Reserva CON cuenta (Usuario Registrado)

**Objetivo**: Crear una reserva Y una cuenta de usuario simultáneamente.

### Pasos:

1. Vuelve a http://localhost:5173
2. Refresca la página (F5)
3. **SÍ marca** el checkbox "Quiero crear una cuenta" ✓
4. Los campos de password deberían aparecer
5. Completa el formulario:

```
Email: usuario.prueba1@example.com
Nombre: María
Apellido: González
RUT: 22.222.222-2
Teléfono: +56 9 2222 2222
Mesa: 2
Fecha: [Selecciona pasado mañana]
Hora inicio: 18:00
Hora fin: 20:00
Número de personas: 4
Password: MiPassword123!
Confirmar Password: MiPassword123!
```

6. Haz clic en **"Crear Reserva"**

### Verificaciones:

- [ ] La reserva se crea exitosamente
- [ ] Aparece un mensaje de éxito
- [ ] **SÍ** eres redirigido al panel de usuario (auto-login)
- [ ] Deberías ver tu nombre en la esquina superior derecha
- [ ] El rol debería mostrar "Cliente"
- [ ] Puedes ver la tab "Mis Reservas"
- [ ] Puedes ver la tab "Nueva Reserva"
- [ ] Puedes ver la tab "Mi Perfil"
- [ ] Revisa la **consola de Django**
- [ ] Deberías ver un EMAIL de bienvenida (SIN token de acceso)

**✅ RESULTADO ESPERADO**: Cuenta creada, auto-login funcionando, usuario puede acceder a su panel.

---

## ✅ TEST 5: Validaciones de Password

**Objetivo**: Verificar que las validaciones de password funcionan correctamente.

### Pasos:

#### 5.1 - Password requerido cuando checkbox marcado

1. Refresca http://localhost:5173 (F5)
2. Marca el checkbox "Quiero crear una cuenta" ✓
3. Completa todos los campos EXCEPTO las passwords
4. Intenta crear la reserva

**Verificación**:
- [ ] Aparece error: "La contraseña es requerida para crear cuenta"

#### 5.2 - Password muy corto

1. Marca el checkbox ✓
2. Ingresa password: `123`
3. Intenta crear la reserva

**Verificación**:
- [ ] Aparece error sobre requisitos de password (mínimo 8 caracteres, etc.)

#### 5.3 - Passwords no coinciden

1. Marca el checkbox ✓
2. Password: `MiPassword123!`
3. Confirmar: `OtraPassword123!`
4. Intenta crear la reserva

**Verificación**:
- [ ] Aparece error: "Las contraseñas no coinciden"

#### 5.4 - Sin checkbox, password NO requerido

1. **Desmarca** el checkbox
2. Deja los campos de password vacíos (deberían estar ocultos)
3. Completa los demás campos
4. Crea la reserva

**Verificación**:
- [ ] La reserva se crea exitosamente SIN password
- [ ] Usuario creado como invitado

**✅ RESULTADO ESPERADO**: Todas las validaciones funcionan correctamente.

---

## ✅ TEST 6: Validación de Fechas

**Objetivo**: Verificar que no se pueden ingresar fechas inválidas.

### Pasos:

#### 6.1 - Año muy grande

1. Refresca http://localhost:5173 (F5)
2. En el campo de fecha, intenta ingresar: `2757-01-01`
3. Haz clic fuera del campo o intenta enviar

**Verificación**:
- [ ] Aparece mensaje de error sobre el año
- [ ] El formulario NO se puede enviar

#### 6.2 - Año en el pasado

1. Intenta ingresar una fecha del año pasado (ej: `2024-01-01`)
2. Haz clic fuera del campo

**Verificación**:
- [ ] Aparece error: "No se pueden crear reservas para años pasados"

#### 6.3 - Año muy en el futuro

1. Intenta ingresar: `2028-01-01` (más de 2 años adelante)
2. Haz clic fuera del campo

**Verificación**:
- [ ] Aparece error: "El año no puede ser mayor a [año_actual + 2]"

**✅ RESULTADO ESPERADO**: Validación de fechas funciona correctamente.

---

## ✅ TEST 7: Mensajes de Error en Login

**Objetivo**: Verificar que el login muestra mensajes de error claros.

### Pasos:

1. En http://localhost:5173, haz clic en **"Iniciar Sesión"** (esquina superior derecha)
2. Deberías ver el formulario de login
3. Ingresa credenciales incorrectas:
   - Usuario: `usuario@noexiste.com`
   - Password: `PasswordIncorrecto123!`
4. Haz clic en **"Iniciar Sesión"**

### Verificaciones:

- [ ] Aparece un mensaje de error VISIBLE
- [ ] El mensaje dice algo como: "Usuario o contraseña incorrectos. Por favor verifica tus datos..."
- [ ] La página **NO se reinicia** silenciosamente
- [ ] El error es claro y descriptivo
- [ ] Puedes intentar de nuevo sin problemas

**✅ RESULTADO ESPERADO**: Mensajes de error claros, sin comportamiento silencioso.

---

## ✅ TEST 8: Activar Cuenta de Invitado

**Objetivo**: Convertir una cuenta de invitado en una cuenta completa.

### Pasos:

1. Usa el link de la reserva de invitado del **TEST 2**
   - `http://localhost:5173/reserva/[TOKEN]`
2. Deberías ver la página de la reserva
3. Haz clic en el botón **"Activar mi cuenta"** (en el banner azul)
4. Deberías ser redirigido a una página de activación
5. Verifica que se muestra:
   - Tu nombre y email
   - Un formulario para ingresar nueva contraseña
6. Ingresa:
   - Password: `NuevaPassword123!`
   - Confirmar: `NuevaPassword123!`
7. Haz clic en **"Activar Cuenta"**

### Verificaciones:

- [ ] Aparece mensaje de éxito
- [ ] Eres **redirigido automáticamente** al panel de usuario
- [ ] Estás **autenticado** (ves tu nombre arriba a la derecha)
- [ ] Puedes ver tus tabs: "Mis Reservas", "Nueva Reserva", "Mi Perfil"
- [ ] Ya NO puedes usar el link con token para acceder a la reserva
- [ ] Revisa la **consola de Django**
- [ ] Deberías ver un EMAIL de "¡Bienvenido! Tu cuenta ha sido activada"

**✅ RESULTADO ESPERADO**: Cuenta activada exitosamente, auto-login funcionando.

---

## ✅ TEST 9: Login con Cuenta Activada

**Objetivo**: Verificar que puedes hacer login con la cuenta recién activada.

### Pasos:

1. Cierra sesión (botón "Salir" arriba a la derecha)
2. Haz clic en "Iniciar Sesión"
3. Ingresa las credenciales de la cuenta activada:
   - Usuario: `invitado.prueba1@example.com` (del TEST 2)
   - Password: `NuevaPassword123!` (la que pusiste al activar)
4. Haz clic en "Iniciar Sesión"

### Verificaciones:

- [ ] Login exitoso
- [ ] Eres redirigido al panel de usuario
- [ ] Puedes ver tus reservas
- [ ] Todo funciona normalmente

**✅ RESULTADO ESPERADO**: Login funciona con la cuenta activada.

---

## ✅ TEST 10: Cancelar Reserva de Invitado

**Objetivo**: Verificar que un invitado puede cancelar su reserva con el token.

### Pasos:

1. Crea una nueva reserva SIN cuenta (invitado)
2. Accede al link del email
3. En la página de la reserva, haz clic en **"Cancelar Reserva"**
4. Deberías ver un modal de confirmación
5. Confirma la cancelación

### Verificaciones:

- [ ] Aparece modal pidiendo confirmación
- [ ] Al confirmar, la reserva se cancela
- [ ] Aparece mensaje de éxito
- [ ] La página se actualiza mostrando que no hay reserva
- [ ] Revisa la **consola de Django**
- [ ] Deberías ver un EMAIL de "Reserva Cancelada"

**✅ RESULTADO ESPERADO**: Cancelación de reserva funciona correctamente.

---

## 📊 Resumen de Tests

| Test | Funcionalidad | Estado |
|------|--------------|--------|
| 1 | Checkbox controla password | [ ] |
| 2 | Crear reserva sin cuenta | [ ] |
| 3 | Acceder a reserva de invitado | [ ] |
| 4 | Crear reserva con cuenta | [ ] |
| 5 | Validaciones de password | [ ] |
| 6 | Validación de fechas | [ ] |
| 7 | Mensajes de error en login | [ ] |
| 8 | Activar cuenta de invitado | [ ] |
| 9 | Login con cuenta activada | [ ] |
| 10 | Cancelar reserva de invitado | [ ] |

---

## 🐛 Si encuentras problemas

### Problema: Los servidores no están corriendo

```bash
# Verificar puertos
lsof -ti:8000  # Django
lsof -ti:5173  # React

# Reiniciar servidores
# Ver comandos al inicio de esta guía
```

### Problema: "Too Many Requests" (429)

- Espera unos minutos (hay rate limiting)
- O reinicia el servidor Django

### Problema: No veo los emails

- Los emails se imprimen en la **consola de Django** (terminal)
- Asegúrate de mirar el terminal donde corre `python manage.py runserver`

### Problema: Errores de RUT

- Usa RUTs válidos con dígito verificador correcto
- Ejemplos válidos:
  - `11.111.111-1`
  - `22.222.222-2`
  - `12.345.678-5`
  - `19.876.543-2`

---

## 📝 Notas Importantes

1. **Tokens de acceso**: Son únicos y expiran en 48 horas
2. **Emails**: En desarrollo, se imprimen en consola de Django
3. **Rate Limiting**: Si haces muchas requests, espera unos minutos
4. **Auto-login**: Funciona para usuarios registrados y cuentas activadas
5. **Invitados**: No tienen password, solo token de acceso temporal

---

## ✨ Features Implementadas

- ✅ Reserva sin cuenta (invitado)
- ✅ Reserva con cuenta (usuario registrado)
- ✅ Checkbox para elegir crear cuenta
- ✅ Validaciones condicionales de password
- ✅ Tokens de acceso únicos para invitados
- ✅ Emails de confirmación y bienvenida
- ✅ Activación de cuenta posterior
- ✅ Auto-login después de registro/activación
- ✅ Validación de fechas mejorada
- ✅ Mensajes de error claros en login
- ✅ Rutas públicas para invitados (/reserva/:token, /activar-cuenta/:token)

---

**¡Buena suerte con los tests!** 🎉
