import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { socketService } from '@/lib/socket';
import { getLocalStorage } from '@/lib/storage';
import { useAuth } from '@/contexts/auth-context';

/**
 * Hook to manage Socket.io connection
 * Automatically connects when user is authenticated and disconnects on unmount
 *
 * @returns The socket instance or null if not connected
 */
export function useSocket(): Socket | null {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
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
      const socket = socketService.connect(token);
      socketRef.current = socket;
    } catch (error) {
      console.error('[useSocket] Failed to connect socket:', error);
    } finally {
      isConnectingRef.current = false;
    }

    // Cleanup function
    return () => {
      socketService.disconnect();
      socketRef.current = null;
      isConnectingRef.current = false;
    };
  }, [isAuthenticated, user?.id]); // Re-connect if user changes

  return socketRef.current;
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
