import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { socketService, updateNotificationSocketToken } from '@/lib/socket';
import { getLocalStorage } from '@/lib/storage';
import { useAuth } from '@/contexts/auth-context';

/** How often to notice that the access token rotated. Cheap (a localStorage read).
 * Mirrors TOKEN_WATCH_MS in the attention socket hook. */
const TOKEN_WATCH_MS = 30_000;

/**
 * Hook to manage Socket.io connection
 * Automatically connects when user is authenticated and disconnects on unmount
 *
 * @returns The socket instance or null if not connected
 */
export function useSocket(): Socket | null {
  const { user, isAuthenticated } = useAuth();
  // STATE, not a ref: the socket is created inside an effect, and a ref write does not
  // re-render. Consumers (useNotificationSocket) read this during render and register
  // their listeners in an effect keyed on it — with a ref they would capture `null`
  // forever unless some unrelated re-render happened to land after the connect, so the
  // notification listeners were only ever attached by luck.
  const [socket, setSocket] = useState<Socket | null>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    // Only connect if authenticated and not already connecting
    if (!isAuthenticated || isConnectingRef.current) {
      return;
    }

    const token = getLocalStorage('token');

    if (!token) {
      console.warn('[useSocket] No token found, cannot connect to socket');
      return;
    }

    // Prevent concurrent connection attempts
    isConnectingRef.current = true;

    try {
      setSocket(socketService.connect(token));
    } catch (error) {
      console.error('[useSocket] Failed to connect socket:', error);
    } finally {
      isConnectingRef.current = false;
    }

    // Keep the socket's credential current. Without this the handshake token captured
    // above is replayed on every reconnect; once it expires the gateway rejects us and
    // real-time notifications die silently until a page reload.
    const tokenWatch = setInterval(() => {
      const latest = getLocalStorage('token');
      if (latest) updateNotificationSocketToken(latest);
    }, TOKEN_WATCH_MS);

    // Cleanup function
    return () => {
      clearInterval(tokenWatch);
      socketService.disconnect();
      setSocket(null);
      isConnectingRef.current = false;
    };
  }, [isAuthenticated, user?.id]); // Re-connect if user changes

  return socket;
}

/**
 * Hook to listen to socket events
 * Automatically removes listeners on unmount
 *
 * @param event - Event name to listen to
 * @param callback - Callback function to execute when event is received
 */
export function useSocketEvent(
  event: string,
  callback: (...args: unknown[]) => void
): void {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) {
      return;
    }

    // Add event listener
    socket.on(event, callback);

    // Cleanup - remove listener on unmount or when dependencies change
    return () => {
      socket.off(event, callback);
    };
  }, [socket, event, callback]);
}

/**
 * Hook to emit socket events
 * Returns a function that can be used to emit events
 *
 * @returns Function to emit events
 */
export function useSocketEmit(): (event: string, data?: unknown) => void {
  const socket = useSocket();

  return (event: string, data?: unknown) => {
    if (!socket) {
      console.warn(`[useSocketEmit] Cannot emit "${event}" - socket not connected`);
      return;
    }

    socket.emit(event, data);
  };
}

/**
 * Hook to check socket connection status
 *
 * @returns Boolean indicating if socket is connected
 */
export function useSocketConnected(): boolean {
  return socketService.isConnected();
}
