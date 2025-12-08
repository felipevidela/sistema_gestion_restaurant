"""
Servicio de envío de emails para el sistema de reservas.
Maneja confirmaciones, activación de cuentas y notificaciones.
"""
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def enviar_email_confirmacion_invitado(reserva, perfil):
    """
    Envía email de confirmación a un usuario invitado (sin cuenta).

    Args:
        reserva: Instancia del modelo Reserva
        perfil: Instancia del modelo Perfil con token_activacion generado

    Returns:
        bool: True si se envió exitosamente, False en caso contrario
    """
    try:
        # Construir URLs (en producción usar dominio real)
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        link_ver_reserva = f"{base_url}/reserva/{perfil.token_activacion}"
        link_activar_cuenta = f"{base_url}/activar-cuenta/{perfil.token_activacion}"

        # Datos para el template
        context = {
            'nombre_completo': perfil.nombre_completo,
            'reserva_id': reserva.id,
            'mesa_numero': reserva.mesa.numero,
            'fecha_reserva': reserva.fecha_reserva.strftime('%d/%m/%Y'),
            'hora_inicio': reserva.hora_inicio.strftime('%H:%M'),
            'hora_fin': reserva.hora_fin.strftime('%H:%M'),
            'num_personas': reserva.num_personas,
            'notas': reserva.notas if reserva.notas else 'Sin notas adicionales',
            'link_ver_reserva': link_ver_reserva,
            'link_activar_cuenta': link_activar_cuenta,
            'token_valido_hasta': perfil.token_expira.strftime('%d/%m/%Y %H:%M') if perfil.token_expira else 'N/A'
        }

        # Asunto
        asunto = f'Confirmación de Reserva - Mesa {reserva.mesa.numero} - {reserva.fecha_reserva.strftime("%d/%m/%Y")}'

        # Mensaje en texto plano (fallback)
        mensaje_texto = f"""
¡Hola {perfil.nombre_completo}!

Tu reserva ha sido confirmada exitosamente:

📅 Detalles de tu Reserva:
- Mesa: {reserva.mesa.numero}
- Fecha: {reserva.fecha_reserva.strftime('%d/%m/%Y')}
- Hora: {reserva.hora_inicio.strftime('%H:%M')} - {reserva.hora_fin.strftime('%H:%M')}
- Personas: {reserva.num_personas}
- ID de Reserva: {reserva.id}

🔗 Gestionar tu Reserva:
Puedes ver o cancelar tu reserva usando este link (válido por 48 horas):
{link_ver_reserva}

✨ ¡Crea tu cuenta!
Si deseas gestionar tus reservas de forma más cómoda en el futuro, puedes crear tu cuenta aquí:
{link_activar_cuenta}

Con tu cuenta podrás:
- Ver todas tus reservas en un solo lugar
- Modificar o cancelar reservas fácilmente
- Recibir recordatorios automáticos

¡Te esperamos!

Equipo del Restaurante
        """.strip()

        # Enviar email
        send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[perfil.user.email],
            fail_silently=False,
        )

        return True

    except Exception as e:
        print(f"Error al enviar email de confirmación: {e}")
        return False


def enviar_email_confirmacion_usuario_registrado(reserva, perfil):
    """
    Envía email de confirmación a un usuario registrado (con cuenta).

    Args:
        reserva: Instancia del modelo Reserva
        perfil: Instancia del modelo Perfil

    Returns:
        bool: True si se envió exitosamente, False en caso contrario
    """
    try:
        # Construir URL del dashboard
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        link_dashboard = f"{base_url}/dashboard"

        # Asunto
        asunto = f'Confirmación de Reserva - Mesa {reserva.mesa.numero} - {reserva.fecha_reserva.strftime("%d/%m/%Y")}'

        # Mensaje en texto plano
        mensaje_texto = f"""
¡Hola {perfil.nombre_completo}!

Tu reserva ha sido confirmada exitosamente:

📅 Detalles de tu Reserva:
- Mesa: {reserva.mesa.numero}
- Fecha: {reserva.fecha_reserva.strftime('%d/%m/%Y')}
- Hora: {reserva.hora_inicio.strftime('%H:%M')} - {reserva.hora_fin.strftime('%H:%M')}
- Personas: {reserva.num_personas}
- ID de Reserva: {reserva.id}

🔗 Gestionar tu Reserva:
Puedes ver y gestionar todas tus reservas en tu panel de control:
{link_dashboard}

¡Te esperamos!

Equipo del Restaurante
        """.strip()

        # Enviar email
        send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[perfil.user.email],
            fail_silently=False,
        )

        return True

    except Exception as e:
        print(f"Error al enviar email de confirmación: {e}")
        return False


def enviar_email_bienvenida_cuenta_activada(perfil):
    """
    Envía email de bienvenida cuando un invitado activa su cuenta.

    Args:
        perfil: Instancia del modelo Perfil recién activado

    Returns:
        bool: True si se envió exitosamente, False en caso contrario
    """
    try:
        # Construir URL del dashboard
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        link_dashboard = f"{base_url}/dashboard"

        # Asunto
        asunto = '¡Bienvenido! Tu cuenta ha sido activada'

        # Mensaje en texto plano
        mensaje_texto = f"""
¡Hola {perfil.nombre_completo}!

¡Bienvenido al sistema de reservas!

Tu cuenta ha sido activada exitosamente. Ahora puedes:
- Ver todas tus reservas en un solo lugar
- Modificar o cancelar reservas fácilmente
- Crear nuevas reservas más rápidamente
- Recibir notificaciones sobre tus reservas

🔗 Accede a tu panel de control:
{link_dashboard}

¡Gracias por unirte a nosotros!

Equipo del Restaurante
        """.strip()

        # Enviar email
        send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[perfil.user.email],
            fail_silently=False,
        )

        return True

    except Exception as e:
        print(f"Error al enviar email de bienvenida: {e}")
        return False


def enviar_email_cancelacion_reserva(reserva, perfil):
    """
    Envía email de confirmación de cancelación de reserva.

    Args:
        reserva: Instancia del modelo Reserva cancelada
        perfil: Instancia del modelo Perfil

    Returns:
        bool: True si se envió exitosamente, False en caso contrario
    """
    try:
        # Construir URL para nueva reserva
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        link_nueva_reserva = f"{base_url}/reserva"

        # Asunto
        asunto = f'Reserva Cancelada - Mesa {reserva.mesa.numero} - {reserva.fecha_reserva.strftime("%d/%m/%Y")}'

        # Mensaje en texto plano
        mensaje_texto = f"""
Hola {perfil.nombre_completo},

Tu reserva ha sido cancelada:

📅 Detalles de la Reserva Cancelada:
- Mesa: {reserva.mesa.numero}
- Fecha: {reserva.fecha_reserva.strftime('%d/%m/%Y')}
- Hora: {reserva.hora_inicio.strftime('%H:%M')} - {reserva.hora_fin.strftime('%H:%M')}
- Personas: {reserva.num_personas}
- ID de Reserva: {reserva.id}

Si deseas hacer una nueva reserva, puedes hacerlo aquí:
{link_nueva_reserva}

¡Esperamos verte pronto!

Equipo del Restaurante
        """.strip()

        # Enviar email
        send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[perfil.user.email],
            fail_silently=False,
        )

        return True

    except Exception as e:
        print(f"Error al enviar email de cancelación: {e}")
        return False
