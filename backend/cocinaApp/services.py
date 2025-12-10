from django.db import transaction
from django.db.models import F
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import Pedido, DetallePedido, PedidoCancelacion, TRANSICIONES_VALIDAS
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

        return pedido

    @staticmethod
    @transaction.atomic
    def cancelar_pedido(pedido, usuario=None, motivo=None):
        """
        Cancela pedido y revierte stock en una transacción.
        Captura datos de auditoría si se proporcionan.

        Reglas de validación:
        - Si se proporciona 'usuario', entonces 'motivo' es OBLIGATORIO y debe tener ≥10 caracteres
        - Si NO se proporciona 'usuario', se permite cancelación sin motivo (compatibilidad con código existente)

        Args:
            pedido: Instancia de Pedido
            usuario: Usuario que cancela (opcional para compatibilidad, recomendado proporcionar)
            motivo: Motivo de cancelación (opcional para compatibilidad, recomendado proporcionar)

        Returns:
            Pedido actualizado

        Raises:
            ValidationError si la transición no es válida o si falta motivo cuando se requiere auditoría
        """
        if not pedido.puede_transicionar_a('CANCELADO'):
            raise ValidationError(f"No se puede cancelar pedido en estado {pedido.estado}")

        # VALIDACIÓN: Si se proporciona usuario (auditoría), motivo es OBLIGATORIO
        if usuario and not motivo:
            raise ValidationError("Debe especificar el motivo de cancelación")

        # VALIDACIÓN: Si se proporciona usuario, motivo debe tener al menos 10 caracteres
        if usuario and motivo and len(motivo.strip()) < 10:
            raise ValidationError("El motivo de cancelación debe tener al menos 10 caracteres")

        # Revertir stock de cada detalle ANTES de cambiar estado
        for detalle in pedido.detalles.all():
            for receta in detalle.plato.recetas.all():
                cantidad_a_revertir = receta.cantidad_requerida * detalle.cantidad
                Ingrediente.objects.filter(pk=receta.ingrediente_id).update(
                    cantidad_disponible=F('cantidad_disponible') + cantidad_a_revertir
                )

        pedido.estado = 'CANCELADO'
        pedido.save()

        # NUEVO: Guardar auditoría de cancelación si se proporcionan datos
        if usuario and motivo:
            # Capturar snapshot de datos
            cliente_nombre = ''
            if pedido.cliente and hasattr(pedido.cliente, 'perfil'):
                cliente_nombre = pedido.cliente.perfil.nombre_completo

            # Crear snapshots de productos (texto y JSON)
            detalles = pedido.detalles.all()

            # Resumen en texto legible
            productos_resumen = ', '.join([
                f"{d.cantidad}x {d.plato.nombre}"
                for d in detalles
            ])

            # Detalle estructurado en JSON para análisis futuro
            productos_detalle = [
                {
                    'plato_id': d.plato.id,
                    'plato_nombre': d.plato.nombre,
                    'cantidad': d.cantidad,
                    'precio_unitario': float(d.precio_unitario),
                    'subtotal': float(d.subtotal)
                }
                for d in detalles
            ]

            PedidoCancelacion.objects.create(
                pedido=pedido,
                cancelado_por=usuario,
                motivo=motivo.strip()[:500],
                mesa_numero=pedido.mesa.numero,
                cliente_nombre=cliente_nombre,
                total_pedido=pedido.total,
                productos_resumen=productos_resumen[:500],  # Límite de seguridad
                productos_detalle=productos_detalle
            )

        # Actualizar disponibilidad de platos
        PedidoService._actualizar_disponibilidad_platos(pedido)

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

        return pedido

    @staticmethod
    def _actualizar_disponibilidad_platos(pedido):
        """
        Actualiza disponibilidad de platos según stock actual.
        Optimizado para reducir queries usando prefetch_related.
        """
        # Solo actualizar los platos directamente en el pedido
        # (no todos los platos que comparten ingredientes - demasiado costoso)
        platos_afectados = set()

        # Obtener detalles con prefetch de relaciones para evitar N+1 queries
        detalles = pedido.detalles.select_related('plato').prefetch_related('plato__recetas')

        for detalle in detalles:
            platos_afectados.add(detalle.plato.id)

        # Actualizar solo los platos del pedido en una sola operación
        if platos_afectados:
            from menuApp.models import Plato
            platos = Plato.objects.filter(id__in=platos_afectados)
            for plato in platos:
                plato.disponible = plato.verificar_disponibilidad()
                plato.save(update_fields=['disponible'])
