// frontend/src/hooks/useSSE.ts — Subscribe to server-sent events for real-time updates

import { useEffect, useRef } from 'react';

type SSEHandler = (event: string, data: unknown) => void;

/**
 * Opens an SSE connection to /api/events and calls `onEvent` whenever
 * the server pushes an event. Automatically reconnects on drop.
 */
export function useSSE(orgId: string | undefined, onEvent: SSEHandler) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent; // always use latest handler without re-subscribing

  useEffect(() => {
    if (!orgId) return;

    let es: EventSource;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource(`/api/events?orgId=${orgId}`, { withCredentials: true });

      const handle = (name: string) => (e: MessageEvent) => {
        try { handlerRef.current(name, JSON.parse(e.data)); } catch { /* ignore */ }
      };

      es.addEventListener('attendance',   handle('attendance'));
      es.addEventListener('notification', handle('notification'));
      es.addEventListener('ping',         handle('ping'));

      es.onerror = () => {
        es.close();
        // Reconnect after 3s if not intentionally closed
        if (!closed) setTimeout(connect, 3_000);
      };
    }

    connect();

    return () => {
      closed = true;
      es?.close();
    };
  }, [orgId]);
}
