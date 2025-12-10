import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para conexión WebSocket con reconexión automática y auth segura
 * @param {string} path - Ruta del WebSocket (ej: '/ws/cocina/')
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.enabled - Si el WebSocket debe conectarse
 * @param {function} options.onMessage - Callback al recibir mensaje
 * @param {function} options.onOpen - Callback al conectar
 * @param {function} options.onClose - Callback al desconectar
 * @param {function} options.onError - Callback en error
 * @param {number} options.reconnectInterval - Intervalo de reconexión en ms (default: 3000)
 * @param {number} options.maxReconnectAttempts - Máximo de intentos de reconexión (default: 5)
 */
export function useWebSocket(path, options = {}) {
  const {
    enabled = true,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // IMPORTANTE: Usar SOLO useRef para estado en closures (evita valores desactualizados)
  // NO usar variables let/const locales que se pierden entre reconexiones
  const connectionStatusRef = useRef('disconnected');
  const reconnectAttempts = useRef(0);
  const authSentRef = useRef(false);  // ÚNICO lugar donde se trackea si se envió auth
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Función helper para actualizar ambos (state para UI + ref para closures)
  const updateConnectionStatus = useCallback((status) => {
    connectionStatusRef.current = status;
    setConnectionStatus(status);
  }, []);

  // RESETEAR ESTADO al iniciar nueva conexión
  // IMPORTANTE: Llamar SIEMPRE justo antes de cada new WebSocket(...)
  const resetConnectionState = useCallback(() => {
    authSentRef.current = false;
    // NO resetear reconnectAttempts aquí - se resetea solo al auth exitoso
  }, []);

  // Construir URL del WebSocket
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_URL || window.location.host;
    return `${protocol}//${host}${path}`;
  }, [path]);

  // Función para conectar
  const connect = useCallback(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    if (!token) {
      updateConnectionStatus('no_auth');
      return;
    }

    try {
      // ========================================
      // FLUJO DE CONEXIÓN (usar SOLO refs):
      // ========================================
      // 1. resetConnectionState() - SIEMPRE antes de new WebSocket
      // 2. new WebSocket(url)
      // 3. onopen -> envía auth -> authSentRef.current = true
      // 4. onmessage 'authenticated' -> reconnectAttempts.current = 0
      // ========================================

      resetConnectionState();  // <-- SIEMPRE antes de crear WebSocket
      updateConnectionStatus('connecting');
      const url = getWebSocketUrl();

      // SIN token en URL - más seguro
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        updateConnectionStatus('authenticating');
        // Enviar token en primer mensaje (no en URL)
        wsRef.current.send(JSON.stringify({
          type: 'authenticate',
          token: token
        }));
        authSentRef.current = true;  // USAR REF, no variable local
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Manejar respuestas de autenticación
          if (data.type === 'authenticated') {
            setIsConnected(true);
            updateConnectionStatus('connected');
            reconnectAttempts.current = 0;  // <-- RESETEAR al autenticar exitosamente
            onOpen?.();
            return;
          }

          if (data.type === 'auth_failed') {
            updateConnectionStatus('auth_failed');
            console.error('WebSocket auth failed:', data.reason);
            // NO llamar close() aquí - el servidor ya lo hará
            return;
          }

          if (data.type === 'auth_required') {
            // Servidor pidió autenticación, reenviar si no lo hicimos
            if (!authSentRef.current) {
              wsRef.current.send(JSON.stringify({
                type: 'authenticate',
                token: token
              }));
              authSentRef.current = true;
            }
            return;
          }

          // Mensaje normal de la aplicación
          setLastMessage(data);
          onMessage?.(data);
        } catch (e) {
          console.error('Error procesando mensaje WebSocket:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        // Usar ref en lugar de state para evitar closure desactualizado
        const currentStatus = connectionStatusRef.current;
        setIsConnected(false);
        let shouldAttemptReconnect = true;

        if (event.code === 4001) {
          updateConnectionStatus('auth_timeout');
          shouldAttemptReconnect = true;  // Puede ser problema de red
        } else if (event.code === 4002) {
          updateConnectionStatus('auth_failed');
          shouldAttemptReconnect = false;  // Token inválido
        } else if (!authSentRef.current) {
          updateConnectionStatus('connection_failed');
          shouldAttemptReconnect = true;
        } else if (currentStatus === 'authenticating') {
          // Cerró mientras autenticábamos sin respuesta
          updateConnectionStatus('auth_failed');
          shouldAttemptReconnect = false;
        } else {
          updateConnectionStatus('disconnected');
          shouldAttemptReconnect = true;
        }

        onClose?.(event);

        // Reconexión con protección anti-loop
        if (enabled && shouldAttemptReconnect) {
          reconnectAttempts.current += 1;

          if (reconnectAttempts.current <= MAX_RECONNECT_ATTEMPTS) {
            updateConnectionStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval);
          } else {
            updateConnectionStatus('max_retries_exceeded');
            console.error('WebSocket: máximo de reintentos alcanzado');
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus('error');
        onError?.(error);
      };

    } catch (error) {
      updateConnectionStatus('error');
      onError?.(error);
    }
  }, [enabled, getWebSocketUrl, onMessage, onOpen, onClose, onError, reconnectInterval, resetConnectionState, updateConnectionStatus]);

  // Función para desconectar
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    updateConnectionStatus('disconnected');
  }, [updateConnectionStatus]);

  // Función para enviar mensaje
  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  // Conectar al montar, desconectar al desmontar
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
  };
}

/**
 * Hook específico para la cocina con manejo de eventos
 * @param {Object} options - Opciones adicionales
 * @param {function} options.onPedidoCreado - Callback cuando se crea un pedido
 * @param {function} options.onPedidoActualizado - Callback cuando se actualiza un pedido
 */
export function useCocinaWebSocket(options = {}) {
  const { onPedidoCreado, onPedidoActualizado, enabled = true } = options;

  const handleMessage = useCallback((message) => {
    switch (message.type) {
      case 'pedido_creado':
        onPedidoCreado?.(message.data);
        break;
      case 'pedido_actualizado':
        onPedidoActualizado?.(message.data);
        break;
      default:
        console.log('Mensaje WebSocket desconocido:', message);
    }
  }, [onPedidoCreado, onPedidoActualizado]);

  return useWebSocket('/ws/cocina/', {
    enabled,
    onMessage: handleMessage,
  });
}

export default useWebSocket;
