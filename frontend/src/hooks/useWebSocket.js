import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para gestionar conexiones WebSocket con reconexión automática
 */
export function useWebSocket(url, options = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    enabled = true,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    reconnectDecay = 1.5,
    maxReconnectAttempts = Infinity,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const currentReconnectIntervalRef = useRef(reconnectInterval);
  const shouldReconnectRef = useRef(true);
  const mountedRef = useRef(true);

  // Construir URL con token
  const buildWebSocketUrl = useCallback(() => {
    if (!url) return null;

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No hay token para WebSocket');
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiUrl = import.meta.env.VITE_API_URL;

    let baseUrl;
    if (apiUrl) {
      const apiUrlObj = new URL(apiUrl);
      baseUrl = `${protocol}//${apiUrlObj.host}`;
    } else {
      baseUrl = `${protocol}//${window.location.host}`;
    }

    const wsUrl = new URL(url, baseUrl);
    wsUrl.searchParams.append('token', token);

    return wsUrl.toString();
  }, [url]);

  // Conectar WebSocket
  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    const wsUrl = buildWebSocketUrl();
    if (!wsUrl) {
      setError('No se pudo construir URL de WebSocket');
      return;
    }

    try {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log(`[WS] Conectando a ${url}...`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }

        console.log(`[WS] Conectado a ${url}`);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        currentReconnectIntervalRef.current = reconnectInterval;

        if (onConnect) onConnect();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          console.log(`[WS] Mensaje:`, data);
          if (onMessage) onMessage(data);
        } catch (err) {
          console.error('[WS] Error parseando:', err);
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        console.error('[WS] Error:', event);
        const errorMsg = 'Error de conexión WebSocket';
        setError(errorMsg);
        if (onError) onError(errorMsg);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        console.log(`[WS] Desconectado (code: ${event.code})`);
        setIsConnected(false);
        wsRef.current = null;

        if (onDisconnect) onDisconnect(event);

        // Reconectar automáticamente
        if (shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const timeout = Math.min(
            currentReconnectIntervalRef.current,
            maxReconnectInterval
          );

          console.log(`[WS] Reconectando en ${timeout}ms`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            currentReconnectIntervalRef.current *= reconnectDecay;
            connect();
          }, timeout);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[WS] Error creando WebSocket:', err);
      setError(err.message);
    }
  }, [enabled, buildWebSocketUrl, url, onConnect, onMessage, onError, onDisconnect, reconnectInterval, maxReconnectInterval, reconnectDecay, maxReconnectAttempts]);

  const sendMessage = useCallback((data) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WS] No conectado');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
      return true;
    } catch (err) {
      console.error('[WS] Error enviando:', err);
      return false;
    }
  }, []);

  const reconnect = useCallback(() => {
    console.log('[WS] Reconexión manual');
    reconnectAttemptsRef.current = 0;
    currentReconnectIntervalRef.current = reconnectInterval;

    if (wsRef.current) {
      wsRef.current.close();
    } else {
      connect();
    }
  }, [connect, reconnectInterval]);

  useEffect(() => {
    mountedRef.current = true;
    shouldReconnectRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  return { isConnected, error, sendMessage, reconnect };
}
