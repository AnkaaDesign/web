import { io, Socket } from 'socket.io-client';

/**
 * Connection state for the socket
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Socket.io service class for managing WebSocket connections
 * Provides connection management, reconnection logic, and event handling
 */
class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private stateChangeListeners: Set<(state: ConnectionState) => void> = new Set();

  /**
   * Connect to the Socket.io server
   * @param token - Authentication token
   * @returns The socket instance
   */
  connect(token: string): Socket {
    // If already connected with the same token, return existing socket
    if (this.socket?.connected && this.token === token) {
      return this.socket;
    }

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect();
    }

    this.token = token;
    this.setConnectionState('connecting');

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3030';
    // Connect to the notifications namespace
    const notificationsUrl = `${apiUrl}/notifications`;

    // Create new socket connection
    this.socket = io(notificationsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'], // Websocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
      reconnectionAttempts: Infinity, // We'll handle max attempts manually
      timeout: 20000,
      autoConnect: true,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  /**
   * Set up socket event handlers for connection management
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection successful
    this.socket.on('connect', () => {
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay

      // Clear any pending reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Sync missed data after reconnection
      this.socket?.emit('sync:request', { timestamp: Date.now() });
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      this.setConnectionState('error');

      // Check if it's an authentication error
      if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        this.handleAuthenticationError(error);
      } else {
        this.handleReconnect();
      }
    });

    // Disconnected
    this.socket.on('disconnect', (reason) => {
      this.setConnectionState('disconnected');

      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        this.handleReconnect();
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network issues, try to reconnect
        this.handleReconnect();
      }
      // 'io client disconnect' means manual disconnect, don't reconnect
    });

    // Reconnection attempt
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.setConnectionState('reconnecting');
    });

    // Reconnection failed
    this.socket.on('reconnect_failed', () => {
      this.setConnectionState('error');
      this.handleReconnectFailure();
    });

    // Error event
    this.socket.on('error', (error) => {
      this.setConnectionState('error');
    });

    // Authentication error
    this.socket.on('auth:error', (error) => {
      this.handleAuthenticationError(error);
    });
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateChangeListeners.forEach(listener => listener(state));
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthenticationError(error: Error): void {
    this.setConnectionState('error');

    // Disconnect socket
    this.disconnect();

    // Dispatch event for the app to handle (e.g., redirect to login)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socket:auth-error', {
        detail: {
          message: 'Authentication failed. Please log in again.',
          error
        }
      }));
    }
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleReconnectFailure();
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');

    // Exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.socket && !this.socket.connected && this.token) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Handle complete reconnection failure
   */
  private handleReconnectFailure(): void {
    this.setConnectionState('error');

    // Could emit a custom event here that the UI can listen to
    if (this.socket) {
      this.socket.emit('reconnect:failed');
    }

    // Optionally show a notification to the user
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socket:reconnect-failed', {
        detail: { message: 'Não foi possível restabelecer a conexão. Por favor, atualize a página.' }
      }));
    }
  }

  /**
   * Disconnect from the Socket.io server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.token = null;
    this.reconnectAttempts = 0;
    this.setConnectionState('disconnected');
  }

  /**
   * Get the current socket instance
   * @returns The socket instance or null if not connected
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribe to connection state changes
   * @param listener - Callback function that receives the new state
   * @returns Unsubscribe function
   */
  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  /**
   * Emit an event through the socket
   * @param event - Event name
   * @param data - Data to send
   */
  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Listen to an event
   * @param event - Event name
   * @param callback - Callback function
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    this.socket?.on(event, callback);
  }

  /**
   * Remove an event listener
   * @param event - Event name
   * @param callback - Callback function (optional)
   */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  /**
   * Mark a notification as read
   * @param notificationId - ID of the notification to mark as read
   */
  markNotificationAsRead(notificationId: string): void {
    this.emit('notification:mark-read', { notificationId });
  }

  /**
   * Mark a notification as delivered
   * @param notificationId - ID of the notification to mark as delivered
   */
  markNotificationAsDelivered(notificationId: string): void {
    this.emit('notification:mark-delivered', { notificationId });
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead(): void {
    this.emit('notification:mark-all-read');
  }

  /**
   * Request notification count
   */
  requestNotificationCount(): void {
    this.emit('notification:count-request');
  }
}

// Export singleton instance
export const socketService = new SocketService();
