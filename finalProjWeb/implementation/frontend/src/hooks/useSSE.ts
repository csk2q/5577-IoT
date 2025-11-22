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
    enabled = true,
    onSensorReading,
    onAlertTriggered,
    onAlertAcknowledged,
    onSensorStatus,
    onConnected,
    onError,
    reconnectInterval = 3000,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [clientId, setClientId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!enabled) {
      return;
    }

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
      // Determine full URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
      const fullUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;

      const eventSource = new EventSource(fullUrl);
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.onopen = () => {
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        console.log('[SSE] Connected to', fullUrl);
      };

      // Handle incoming messages
      eventSource.onmessage = (event) => {
        try {
          const parsedEvent: SSEEvent = JSON.parse(event.data);

          // Route event to appropriate handler
          switch (parsedEvent.type) {
            case 'connected':
              setClientId(parsedEvent.clientId);
              onConnected?.(parsedEvent);
              console.log('[SSE] Connection confirmed, client ID:', parsedEvent.clientId);
              break;

            case 'sensor_reading':
              onSensorReading?.(parsedEvent);
              break;

            case 'alert_triggered':
              onAlertTriggered?.(parsedEvent);
              console.log('[SSE] Alert triggered:', parsedEvent.data);
              break;

            case 'alert_acknowledged':
              onAlertAcknowledged?.(parsedEvent);
              break;

            case 'sensor_status':
              onSensorStatus?.(parsedEvent);
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
        console.error('[SSE] Connection error:', event);
        setConnectionState('error');
        onError?.(event);

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
  }, [
    url,
    enabled,
    onSensorReading,
    onAlertTriggered,
    onAlertAcknowledged,
    onSensorStatus,
    onConnected,
    onError,
    reconnectInterval,
  ]);

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
  }, [enabled, connect, disconnect]);

  return {
    connectionState,
    clientId,
    reconnect,
    disconnect,
  };
}

export default useSSE;
