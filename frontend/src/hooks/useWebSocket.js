import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para conexión WebSocket con reconexión automática
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
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

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
      setConnectionStatus('no_auth');
      return;
    }

    try {
      setConnectionStatus('connecting');
      const url = getWebSocketUrl();

      // Incluir token en la URL como query param (el backend lo lee)
      const wsUrl = `${url}?token=${token}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onClose?.(event);

        // Reconexión automática si no fue cierre intencional
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (error) => {
        setConnectionStatus('error');
        onError?.(error);
      };

    } catch (error) {
      setConnectionStatus('error');
      onError?.(error);
    }
  }, [enabled, getWebSocketUrl, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts]);

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
    setConnectionStatus('disconnected');
  }, []);

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
