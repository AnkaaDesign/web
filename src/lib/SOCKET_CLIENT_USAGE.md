# Socket.io Client Setup - Usage Guide

## Overview

This guide explains how to use the Socket.io client setup for real-time notifications in the web frontend.

## Architecture

The Socket.io client implementation consists of three main parts:

1. **SocketService** (`/src/lib/socket.ts`) - Core socket connection management
2. **useSocket Hook** (`/src/hooks/use-socket.ts`) - React hook for socket instance management
3. **useNotificationSocket Hook** (`/src/hooks/use-notification-socket.ts`) - React hook for notification events

## Configuration

### Environment Variables

The socket client uses the same backend URL as the REST API. Set this in your `.env` file:

```bash
# Development
VITE_API_URL=http://localhost:3030

# Staging
VITE_API_URL=https://api.staging.ankaadesign.com.br

# Production
VITE_API_URL=https://api.ankaadesign.com.br
```

Socket.io will automatically handle the WebSocket connection upgrade from this URL.

## Features

### Socket Connection

- **Auto-connect**: Automatically connects when user is authenticated
- **JWT Authentication**: Sends JWT token in handshake auth header
- **Auto-reconnect**: Exponential backoff with max 5 attempts
- **Reconnection Delay**: Starts at 1000ms, max 30000ms
- **Connection State Management**: Tracks connection state (disconnected, connecting, connected, reconnecting, error)
- **Authentication Error Handling**: Automatically disconnects and emits events on auth errors

### Notification Events

The client listens to the following notification events:

- `notification:new` - New notification received
- `notification:read` - Notification marked as read
- `notification:count` - Notification count update
- `connect` - Socket connected
- `disconnect` - Socket disconnected
- `notification:update` - Notification updated
- `notification:delete` - Notification deleted
- `notification:read-all` - All notifications marked as read

### Methods

The following methods are available for notification management:

- `markAsRead(notificationId)` - Mark a notification as read
- `markAsDelivered(notificationId)` - Mark a notification as delivered
- `markAllNotificationsAsRead()` - Mark all notifications as read
- `requestNotificationCount()` - Request current notification count

## Usage Examples

### Basic Setup - Component Level

Use the `useNotificationSocket` hook in any component that needs real-time notifications:

```tsx
import { useNotificationSocket } from '@/hooks/use-notification-socket';

function NotificationCenter() {
  const {
    connectionState,
    isConnected,
    unreadCount,
    markAsRead,
    markAsDelivered
  } = useNotificationSocket();

  const handleNotificationClick = (notificationId: string) => {
    // Mark as read when user clicks
    markAsRead(notificationId);
  };

  return (
    <div>
      <div>Status: {connectionState}</div>
      <div>Unread: {unreadCount}</div>
      {isConnected ? (
        <span>Connected</span>
      ) : (
        <span>Disconnected</span>
      )}
    </div>
  );
}
```

### App-Level Setup

For app-wide notification handling, add the `SocketNotificationsListener` component at the root level:

```tsx
// App.tsx or main layout
import { SocketNotificationsListener } from '@/components/common/socket-notifications-listener';

function App() {
  return (
    <AuthProvider>
      <SocketNotificationsListener />
      {/* Your app content */}
    </AuthProvider>
  );
}
```

### Manual Socket Operations

For advanced use cases, you can access the socket service directly:

```tsx
import { socketService } from '@/lib/socket';

// Get connection state
const state = socketService.getConnectionState();

// Subscribe to connection state changes
const unsubscribe = socketService.onConnectionStateChange((state) => {
  console.log('Connection state changed:', state);
});

// Mark notification as read
socketService.markNotificationAsRead('notification-id');

// Mark notification as delivered
socketService.markNotificationAsDelivered('notification-id');

// Mark all as read
socketService.markAllNotificationsAsRead();

// Request notification count
socketService.requestNotificationCount();

// Clean up
unsubscribe();
```

### Connection State Management

```tsx
import { useNotificationSocket } from '@/hooks/use-notification-socket';

function ConnectionIndicator() {
  const { connectionState } = useNotificationSocket();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'green';
      case 'connecting':
      case 'reconnecting':
        return 'yellow';
      case 'disconnected':
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <div style={{ color: getStatusColor() }}>
      {connectionState}
    </div>
  );
}
```

### Handling Authentication Errors

The socket client automatically handles authentication errors and emits a browser event. Listen to it in your auth context:

```tsx
// In your AuthProvider or App component
useEffect(() => {
  const handleSocketAuthError = (event: Event) => {
    const customEvent = event as CustomEvent;
    console.error('Socket auth error:', customEvent.detail);
    // Redirect to login or show error message
    logout();
  };

  window.addEventListener('socket:auth-error', handleSocketAuthError);

  return () => {
    window.removeEventListener('socket:auth-error', handleSocketAuthError);
  };
}, []);
```

### Handling Reconnection Failures

```tsx
useEffect(() => {
  const handleReconnectFailed = (event: Event) => {
    const customEvent = event as CustomEvent;
    toast.error('Connection Lost', {
      description: customEvent.detail.message,
      action: {
        label: 'Refresh',
        onClick: () => window.location.reload(),
      },
    });
  };

  window.addEventListener('socket:reconnect-failed', handleReconnectFailed);

  return () => {
    window.removeEventListener('socket:reconnect-failed', handleReconnectFailed);
  };
}, []);
```

## Advanced Features

### Custom Event Listeners

Use the `useSocketEvent` hook for custom socket events:

```tsx
import { useSocketEvent } from '@/hooks/use-socket';

function CustomComponent() {
  useSocketEvent('custom:event', (data) => {
    console.log('Custom event received:', data);
  });

  return <div>Listening to custom events...</div>;
}
```

### Emitting Custom Events

```tsx
import { useSocketEmit } from '@/hooks/use-socket';

function CustomComponent() {
  const emit = useSocketEmit();

  const sendCustomEvent = () => {
    emit('custom:event', { message: 'Hello from client' });
  };

  return <button onClick={sendCustomEvent}>Send Event</button>;
}
```

### Notification Sync

Request notification sync after reconnection:

```tsx
import { useNotificationSync } from '@/hooks/use-notification-socket';

function SyncButton() {
  const syncNotifications = useNotificationSync();

  return (
    <button onClick={syncNotifications}>
      Sync Notifications
    </button>
  );
}
```

## Best Practices

1. **Single Instance**: The `SocketNotificationsListener` should only be mounted once at the app level
2. **Authentication**: Ensure the user is authenticated before the socket connects (handled automatically by `useSocket`)
3. **Connection State**: Display connection state to users for better UX
4. **Error Handling**: Always handle authentication and reconnection errors
5. **Cleanup**: The hooks automatically clean up listeners on unmount
6. **React Query Integration**: Notification events automatically update React Query cache

## Troubleshooting

### Socket Not Connecting

1. Check `VITE_API_URL` environment variable
2. Verify JWT token is valid and stored in localStorage
3. Check browser console for connection errors
4. Verify backend Socket.io server is running

### Authentication Errors

1. Ensure JWT token is valid
2. Check token expiration
3. Verify backend authentication middleware
4. Listen to `socket:auth-error` event for details

### Events Not Received

1. Verify socket is connected (`isConnected` should be `true`)
2. Check backend is emitting events correctly
3. Ensure event names match between client and server
4. Check browser console for errors

## Type Definitions

```typescript
// Connection states
type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// useNotificationSocket return type
interface NotificationSocketHook {
  connectionState: ConnectionState;
  isConnected: boolean;
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAsDelivered: (notificationId: string) => void;
}
```

## Related Files

- `/src/lib/socket.ts` - Socket service implementation
- `/src/hooks/use-socket.ts` - Socket React hooks
- `/src/hooks/use-notification-socket.ts` - Notification socket hook
- `/src/components/common/socket-notifications-listener.tsx` - App-level listener component
- `.env.example` - Environment variable configuration

## Support

For issues or questions, refer to:
- Socket.io client documentation: https://socket.io/docs/v4/client-api/
- Project README
- Backend Socket.io implementation
