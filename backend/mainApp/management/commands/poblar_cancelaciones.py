"""
Comando para poblar datos de prueba de cancelaciones de pedidos.
Crea pedidos cancelados con auditoría completa para testing.

Uso:
    python manage.py poblar_cancelaciones
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import random

from mainApp.models import Mesa, Perfil
from menuApp.models import Plato
from cocinaApp.models import Pedido, DetallePedido, PedidoCancelacion, EstadoPedido


class Command(BaseCommand):
    help = 'Poblar base de datos con pedidos cancelados para testing'

    MOTIVOS_CANCELACION = [
        "Cliente solicitó cancelación por tiempo de espera excesivo en cocina",
        "Error en el pedido - platos equivocados fueron registrados en el sistema",
        "Cliente cambió de opinión después de realizar el pedido original",
        "Ingredientes no disponibles para completar todos los platos solicitados",
        "Cliente tuvo que retirarse urgentemente del restaurante por emergencia",
        "Pedido duplicado creado por error en el sistema de gestión",
        "Cliente no satisfecho con tiempo estimado de preparación informado",
        "Mesa se marchó sin esperar el pedido que había solicitado",
        "Restricciones dietéticas del cliente no pueden ser cumplidas correctamente",
        "Problema con sistema de pago - cliente no pudo completar la transacción",
        "Reserva cancelada por el cliente después de haber ordenado platos",
        "Platos ya no están disponibles en el menú según actualización reciente",
        "Cliente prefirió ordenar desde el menú de delivery en lugar de comer aquí",
        "Errores de comunicación entre mesero y cliente sobre el contenido del pedido",
        "Tiempo de espera superó las expectativas razonables del cliente insatisfecho",
        "Mesa asignada incorrectamente - grupo se trasladó a otra ubicación del local",
        "Cliente alérgico a ingredientes que no pueden ser removidos del plato",
        "Cierre anticipado de cocina por problemas técnicos en equipamiento crítico",
        "Cliente canceló después de verificar precios y considerar su presupuesto",
        "Pedido realizado en mesa equivocada por confusión del personal",
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            '--cantidad',
            type=int,
            default=25,
            help='Número de cancelaciones a crear (default: 25)'
        )
        parser.add_argument(
            '--dias',
            type=int,
            default=30,
            help='Días hacia atrás para distribuir cancelaciones (default: 30)'
        )

    def handle(self, *args, **options):
        cantidad = options['cantidad']
        dias = options['dias']

        self.stdout.write(self.style.WARNING(f'\n🔄 Creando {cantidad} pedidos cancelados...'))

        # Verificar datos necesarios
        usuarios = User.objects.filter(is_active=True).exclude(username='AnonymousUser')
        if not usuarios.exists():
            self.stdout.write(self.style.ERROR('❌ No hay usuarios en la BD. Ejecuta poblar_datos primero.'))
            return

        mesas = Mesa.objects.all()
        if not mesas.exists():
            self.stdout.write(self.style.ERROR('❌ No hay mesas en la BD. Ejecuta poblar_datos primero.'))
            return

        platos = Plato.objects.filter(activo=True, disponible=True)
        if not platos.exists():
            self.stdout.write(self.style.ERROR('❌ No hay platos disponibles. Ejecuta poblar_datos primero.'))
            return

        # Usuarios que cancelarán (admin, cajeros, meseros)
        usuarios_staff = usuarios.filter(perfil__rol__in=['admin', 'cajero', 'mesero'])
        if not usuarios_staff.exists():
            usuarios_staff = usuarios  # Fallback a todos los usuarios

        # Clientes para pedidos
        clientes = usuarios.filter(perfil__rol='cliente')
        if not clientes.exists():
            clientes = usuarios  # Fallback

        creados = 0
        errores = 0

        for i in range(cantidad):
            try:
                # Fecha aleatoria en los últimos N días
                dias_atras = random.randint(0, dias)
                horas_atras = random.randint(0, 23)
                minutos_atras = random.randint(0, 59)

                fecha_creacion = timezone.now() - timedelta(
                    days=dias_atras,
                    hours=horas_atras,
                    minutes=minutos_atras
                )

                # Fecha de cancelación: 5-30 minutos después de creación
                minutos_hasta_cancelacion = random.randint(5, 30)
                fecha_cancelacion = fecha_creacion + timedelta(minutes=minutos_hasta_cancelacion)

                # Seleccionar datos
                mesa = random.choice(mesas)
                cliente = random.choice(clientes) if random.random() > 0.2 else None  # 80% con cliente
                usuario_cancelo = random.choice(usuarios_staff)

                # Crear pedido
                pedido = Pedido.objects.create(
                    mesa=mesa,
                    cliente=cliente,
                    estado=EstadoPedido.CANCELADO,
                    fecha_creacion=fecha_creacion,
                    notas=f"Pedido de prueba #{i+1}" if random.random() > 0.7 else ""
                )

                # Agregar 1-4 platos al pedido
                num_platos = random.randint(1, 4)
                total = Decimal('0.00')

                for _ in range(num_platos):
                    plato = random.choice(platos)
                    cantidad = random.randint(1, 3)

                    DetallePedido.objects.create(
                        pedido=pedido,
                        plato=plato,
                        cantidad=cantidad,
                        precio_unitario=plato.precio,
                        notas_especiales="Sin cebolla" if random.random() > 0.8 else ""
                    )

                    total += plato.precio * cantidad

                # Actualizar total del pedido
                pedido.save()  # Esto recalcula el total automáticamente

                # Crear auditoría de cancelación
                motivo = random.choice(self.MOTIVOS_CANCELACION)

                # Preparar productos_detalle JSON
                detalles = pedido.detalles.all()
                productos_detalle = []
                productos_resumen_parts = []

                for detalle in detalles:
                    productos_detalle.append({
                        'plato_id': detalle.plato.id,
                        'plato_nombre': detalle.plato.nombre,
                        'cantidad': detalle.cantidad,
                        'precio_unitario': float(detalle.precio_unitario),
                        'subtotal': float(detalle.subtotal)
                    })
                    productos_resumen_parts.append(f"{detalle.cantidad}x {detalle.plato.nombre}")

                productos_resumen = ', '.join(productos_resumen_parts)[:500]

                # Cliente nombre
                cliente_nombre = ''
                if cliente and hasattr(cliente, 'perfil'):
                    cliente_nombre = cliente.perfil.nombre_completo

                PedidoCancelacion.objects.create(
                    pedido=pedido,
                    cancelado_por=usuario_cancelo,
                    motivo=motivo,
                    mesa_numero=mesa.numero,
                    cliente_nombre=cliente_nombre,
                    total_pedido=pedido.total,
                    productos_resumen=productos_resumen,
                    productos_detalle=productos_detalle,
                    fecha_cancelacion=fecha_cancelacion
                )

                creados += 1

                if (i + 1) % 10 == 0:
                    self.stdout.write(f'  📊 {i + 1}/{cantidad} cancelaciones creadas...')

            except Exception as e:
                errores += 1
                self.stdout.write(self.style.ERROR(f'  ❌ Error creando cancelación {i+1}: {str(e)}'))

        # Resumen
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'✅ Proceso completado!'))
        self.stdout.write(f'  ✓ Cancelaciones creadas: {creados}')
        if errores > 0:
            self.stdout.write(self.style.WARNING(f'  ⚠ Errores: {errores}'))

        # Estadísticas
        total_cancelaciones = PedidoCancelacion.objects.count()
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'📈 Total de cancelaciones en BD: {total_cancelaciones}'))

        # Distribución por usuario
        from django.db.models import Count
        por_usuario = PedidoCancelacion.objects.values(
            'cancelado_por__username'
        ).annotate(
            count=Count('id')
        ).order_by('-count')[:5]

        self.stdout.write('')
        self.stdout.write('🏆 Top 5 usuarios que más cancelaron:')
        for item in por_usuario:
            username = item['cancelado_por__username']
            count = item['count']
            self.stdout.write(f'  • {username}: {count} cancelaciones')

        self.stdout.write('')
