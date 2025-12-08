from django.db import transaction
from django.db.models import F
from django.core.exceptions import ValidationError
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Pedido, DetallePedido, TRANSICIONES_VALIDAS
from menuApp.models import Ingrediente


class PedidoService:
    """Servicio para gestión de pedidos con manejo transaccional de stock"""

    @staticmethod
    @transaction.atomic
    def crear_pedido_con_detalles(mesa, detalles_data, reserva=None, cliente=None, notas=''):
        """
        Crea pedido y detalles en una transacción atómica.
        Valida y reserva stock usando F() para evitar race conditions.

        Args:
            mesa: Instancia de Mesa
            detalles_data: Lista de dicts con {'plato': Plato, 'cantidad': int, 'notas': str}
            reserva: Instancia de Reserva (opcional)
            cliente: Instancia de User (opcional)
            notas: Notas del pedido

        Returns:
            Pedido creado

        Raises:
            ValidationError si el stock es insuficiente
        """
        # Crear pedido
        pedido = Pedido.objects.create(
            mesa=mesa,
            reserva=reserva,
            cliente=cliente,
            notas=notas
        )

        for detalle_data in detalles_data:
            plato = detalle_data['plato']
            cantidad = detalle_data['cantidad']

            # Validar y reservar stock para cada ingrediente
            for receta in plato.recetas.select_for_update().all():
                cantidad_necesaria = receta.cantidad_requerida * cantidad

                # Verificar stock disponible
                ingrediente = Ingrediente.objects.select_for_update().get(pk=receta.ingrediente_id)
                if ingrediente.cantidad_disponible < cantidad_necesaria:
                    raise ValidationError(
                        f"Stock insuficiente de {ingrediente.nombre}. "
                        f"Disponible: {ingrediente.cantidad_disponible}, Necesario: {cantidad_necesaria}"
                    )

                # Descontar stock con F() para atomicidad
                Ingrediente.objects.filter(pk=ingrediente.pk).update(
                    cantidad_disponible=F('cantidad_disponible') - cantidad_necesaria
                )

            # Crear detalle con precio snapshot
            DetallePedido.objects.create(
                pedido=pedido,
                plato=plato,
                cantidad=cantidad,
                precio_unitario=plato.precio,
                notas_especiales=detalle_data.get('notas', '')
            )

        # Actualizar disponibilidad de platos afectados
        PedidoService._actualizar_disponibilidad_platos(pedido)

        # Notificar por WebSocket
        PedidoService._notificar_websocket('pedido_creado', pedido)

        return pedido

    @staticmethod
    @transaction.atomic
    def cancelar_pedido(pedido):
        """
        Cancela pedido y revierte stock en una transacción.

        Args:
            pedido: Instancia de Pedido

        Returns:
            Pedido actualizado

        Raises:
            ValidationError si la transición no es válida
        """
        if not pedido.puede_transicionar_a('CANCELADO'):
            raise ValidationError(f"No se puede cancelar pedido en estado {pedido.estado}")

        # Revertir stock de cada detalle ANTES de cambiar estado
        for detalle in pedido.detalles.all():
            for receta in detalle.plato.recetas.all():
                cantidad_a_revertir = receta.cantidad_requerida * detalle.cantidad
                Ingrediente.objects.filter(pk=receta.ingrediente_id).update(
                    cantidad_disponible=F('cantidad_disponible') + cantidad_a_revertir
                )

        pedido.estado = 'CANCELADO'
        pedido.save()

        # Actualizar disponibilidad de platos
        PedidoService._actualizar_disponibilidad_platos(pedido)

        # Notificar por WebSocket
        PedidoService._notificar_websocket('pedido_actualizado', pedido)

        return pedido

    @staticmethod
    @transaction.atomic
    def cambiar_estado(pedido, nuevo_estado):
        """
        Cambia estado validando transición. Si es CANCELADO, usa cancelar_pedido.

        Args:
            pedido: Instancia de Pedido
            nuevo_estado: Nuevo estado a asignar

        Returns:
            Pedido actualizado

        Raises:
            ValidationError si la transición no es válida
        """
        if nuevo_estado == 'CANCELADO':
            return PedidoService.cancelar_pedido(pedido)

        if not pedido.puede_transicionar_a(nuevo_estado):
            raise ValidationError(
                f"Transición inválida: {pedido.estado} → {nuevo_estado}"
            )

        pedido.estado = nuevo_estado
        pedido.save()

        # Notificar por WebSocket
        PedidoService._notificar_websocket('pedido_actualizado', pedido)

        return pedido

    @staticmethod
    def _actualizar_disponibilidad_platos(pedido):
        """Actualiza disponibilidad de platos según stock actual"""
        platos_afectados = set()
        for detalle in pedido.detalles.all():
            platos_afectados.add(detalle.plato)
            # También platos que usan los mismos ingredientes
            for receta in detalle.plato.recetas.all():
                for otra_receta in receta.ingrediente.recetas.all():
                    platos_afectados.add(otra_receta.plato)

        for plato in platos_afectados:
            plato.disponible = plato.verificar_disponibilidad()
            plato.save(update_fields=['disponible'])

    @staticmethod
    def _notificar_websocket(tipo, pedido):
        """Envía notificación por WebSocket"""
        try:
            channel_layer = get_channel_layer()
            if channel_layer is None:
                return  # Channels no configurado

            data = {
                'id': pedido.id,
                'mesa': pedido.mesa.numero,
                'estado': pedido.estado,
                'notas': pedido.notas,
                'total': str(pedido.total),
                'fecha_creacion': pedido.fecha_creacion.isoformat() if pedido.fecha_creacion else None,
            }

            # Notificar a cocina_cola
            async_to_sync(channel_layer.group_send)(
                'cocina_cola',
                {'type': tipo, 'data': data}
            )

            # Notificar al mesero si hay cliente asociado
            if pedido.cliente:
                async_to_sync(channel_layer.group_send)(
                    f'mesero_{pedido.cliente.id}',
                    {'type': tipo, 'data': data}
                )
        except Exception:
            # Si falla WebSocket, no interrumpir la operación principal
            pass
