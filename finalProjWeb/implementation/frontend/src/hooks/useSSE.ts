import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SSE Event Types
 */
export interface SSEConnectedEvent {
  type: 'connected';
  clientId: string;
  timestamp: string;
}

export interface SSESensorReadingEvent {
  type: 'sensor_reading';
  data: {
    sensor_id: string;
    patient_id: string;
    heart_rate?: number;
    oxygen_level?: number;
    temperature?: number;
    pressure?: number;
    timestamp: string;
  };
  timestamp: string;
}

export interface SSEAlertTriggeredEvent {
  type: 'alert_triggered';
  data: {
    alert_id: number;
    patient_id: string;
    sensor_id: string;
    alert_type: string;
    severity: string;
    message: string;
    reading_value: number;
    threshold_value: number;
  };
  timestamp: string;
}

export interface SSEAlertAcknowledgedEvent {
  type: 'alert_acknowledged';
  data: {
    alert_id: number;
    patient_id: string;
    acknowledged_by: string;
    acknowledged_at: string;
  };
  timestamp: string;
}

export interface SSESensorStatusEvent {
  type: 'sensor_status';
  data: {
    sensor_id: string;
    status: 'online' | 'offline';
    timestamp: string;
  };
  timestamp: string;
}

export type SSEEvent =
  | SSEConnectedEvent
  | SSESensorReadingEvent
  | SSEAlertTriggeredEvent
  | SSEAlertAcknowledgedEvent
  | SSESensorStatusEvent;

/**
 * Connection State
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Hook Options
 */
interface UseSSEOptions {
  url: string;
  token?: string | null; // JWT token for authentication
  enabled?: boolean;
  onSensorReading?: (event: SSESensorReadingEvent) => void;
  onAlertTriggered?: (event: SSEAlertTriggeredEvent) => void;
  onAlertAcknowledged?: (event: SSEAlertAcknowledgedEvent) => void;
  onSensorStatus?: (event: SSESensorStatusEvent) => void;
  onConnected?: (event: SSEConnectedEvent) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
}

/**
 * useSSE Hook
 * 
 * Custom React hook for Server-Sent Events (SSE) connection.
 * Manages EventSource connection, handles reconnection, and provides event callbacks.
 * 
 * @param options - Configuration options for SSE connection
 * @returns Connection state and control functions
 * 
 * @example
 * ```tsx
 * const { connectionState, reconnect } = useSSE({
 *   url: '/api/v1/stream/sensor-data',
 *   enabled: true,
 *   onSensorReading: (event) => {
 *     console.log('New reading:', event.data);
 *     updatePatientData(event.data);
 *   },
 *   onAlertTriggered: (event) => {
 *     console.log('Alert:', event.data);
 *     showAlertNotification(event.data);
 *   }
 * });
 * ```
 */
export function useSSE(options: UseSSEOptions) {
  const {
    url,
    token,
    enabled = true,
    reconnectInterval = 3000,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  /**
   * Store callbacks in refs to prevent unnecessary reconnections
   * This is the recommended React pattern for event handlers in useEffect
   * See: https://react.dev/learn/separating-events-from-effects
   */
  const callbacksRef = useRef({
    onSensorReading: options.onSensorReading,
    onAlertTriggered: options.onAlertTriggered,
    onAlertAcknowledged: options.onAlertAcknowledged,
    onSensorStatus: options.onSensorStatus,
    onConnected: options.onConnected,
    onError: options.onError,
  });

  // Update callback refs when they change (doesn't trigger reconnection)
  useEffect(() => {
    callbacksRef.current = {
      onSensorReading: options.onSensorReading,
      onAlertTriggered: options.onAlertTriggered,
      onAlertAcknowledged: options.onAlertAcknowledged,
      onSensorStatus: options.onSensorStatus,
      onConnected: options.onConnected,
      onError: options.onError,
    };
  });

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    console.log('[SSE] Connect called - enabled:', enabled, 'token:', token ? 'present' : 'missing');
    
    if (!enabled) {
      console.log('[SSE] Connection disabled, skipping');
      return;
    }

    // Don't connect without authentication token
    if (!token) {
      console.warn('[SSE] Cannot connect without authentication token');
      setConnectionState('disconnected');
      return;
    }
    
    console.log('[SSE] Starting connection...');

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setConnectionState('connecting');

    try {
      // Use relative URL to go through nginx proxy (avoids CORS issues)
      // In production, nginx serves frontend and proxies /api/ to backend
      let fullUrl = url.startsWith('http') ? url : `/api/v1${url}`;
      
      // Add token as query parameter (EventSource doesn't support custom headers)
      if (token) {
        const separator = fullUrl.includes('?') ? '&' : '?';
        fullUrl = `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
      }

      console.log('[SSE] Creating EventSource for:', fullUrl);
      console.log('[SSE] Window location:', window.location.href);
      console.log('[SSE] EventSource constructor exists:', typeof EventSource !== 'undefined');
      
      const eventSource = new EventSource(fullUrl);
      eventSourceRef.current = eventSource;
      
      console.log('[SSE] EventSource created, readyState:', eventSource.readyState);
      console.log('[SSE] EventSource url property:', eventSource.url);
      
      // Log state changes
      setTimeout(() => {
        console.log('[SSE] After 1s, readyState:', eventSource.readyState, 
                    'CONNECTING=0, OPEN=1, CLOSED=2');
      }, 1000);

      // Handle connection open
      eventSource.onopen = () => {
        console.log('[SSE] Connection opened!');
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        console.log('[SSE] Connected to', fullUrl);
      };

      // Handle incoming messages
      eventSource.onmessage = (event) => {
        console.log('[SSE] Message received:', event.data);
        try {
          const parsedEvent: SSEEvent = JSON.parse(event.data);
          console.log('[SSE] Parsed event type:', parsedEvent.type);

          // Route event to appropriate handler
          switch (parsedEvent.type) {
            case 'connected':
              setClientId(parsedEvent.clientId);
              setConnectionState('connected'); // Set connected state on first message
              callbacksRef.current.onConnected?.(parsedEvent);
              console.log('[SSE] Connection confirmed, client ID:', parsedEvent.clientId);
              break;

            case 'sensor_reading':
              console.log('[SSE] Sensor reading event for:', parsedEvent.data.sensor_id);
              callbacksRef.current.onSensorReading?.(parsedEvent);
              break;

            case 'alert_triggered':
              callbacksRef.current.onAlertTriggered?.(parsedEvent);
              console.log('[SSE] Alert triggered:', parsedEvent.data);
              break;

            case 'alert_acknowledged':
              callbacksRef.current.onAlertAcknowledged?.(parsedEvent);
              break;

            case 'sensor_status':
              callbacksRef.current.onSensorStatus?.(parsedEvent);
              console.log('[SSE] Sensor status change:', parsedEvent.data);
              break;

            default:
              console.warn('[SSE] Unknown event type:', parsedEvent);
          }
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error);
        }
      };

      // Handle errors
      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error!');
        console.error('[SSE] Error event:', event);
        console.error('[SSE] EventSource readyState:', eventSource.readyState);
        console.error('[SSE] Event target:', event.target);
        setConnectionState('error');
        callbacksRef.current.onError?.(event);

        // Attempt reconnection with exponential backoff
        const maxAttempts = 10;
        if (reconnectAttemptsRef.current < maxAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1),
            30000
          );

          console.log(
            `[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
          setConnectionState('disconnected');
        }

        // Close the failed connection
        eventSource.close();
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      setConnectionState('error');
    }
  }, [url, token, enabled, reconnectInterval]); // Only stable dependencies - callbacks stored in ref

  /**
   * Disconnect from SSE endpoint
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState('disconnected');
    setClientId(null);
    reconnectAttemptsRef.current = 0;
    console.log('[SSE] Disconnected');
  }, []);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    console.log('[SSE] Manual reconnect requested');
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Connect on mount if enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]); // Now safe - connect/disconnect have stable dependencies

  return {
    connectionState,
    clientId,
    reconnect,
    disconnect,
  };
}

export default useSSE;
