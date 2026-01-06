# Socket.io Real-time Notifications Implementation

This directory contains the Socket.io client implementation for real-time notifications in the web application.

## Architecture Overview

The implementation follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                      App.tsx                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │         SocketNotificationsListener               │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │      useNotificationSocket()                │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │         useSocket()                   │  │  │  │
│  │  │  │  ┌─────────────────────────────────┐  │  │  │  │
│  │  │  │  │     socketService               │  │  │  │  │
│  │  │  │  │  - Connection management        │  │  │  │  │
│  │  │  │  │  - Reconnection logic           │  │  │  │  │
│  │  │  │  │  - Event handling               │  │  │  │  │
│  │  │  │  └─────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Files and Their Responsibilities

### Core Files

#### `lib/socket.ts`
- **Purpose**: Socket service singleton for managing WebSocket connections
- **Key Features**:
  - Automatic reconnection with exponential backoff
  - Connection state management
  - Authentication token handling
  - Event emission and subscription
  - Sync missed data on reconnection

#### `hooks/use-socket.ts`
- **Purpose**: React hook for socket connection lifecycle
- **Features**:
  - Connects socket when user authenticates
  - Disconnects on unmount or logout
  - Returns socket instance for use in other hooks
  - Helper hooks: `useSocketEvent`, `useSocketEmit`, `useSocketConnected`

#### `hooks/use-notification-socket.ts`
- **Purpose**: Real-time notification event handlers
- **Features**:
  - Listens to notification events from server
  - Updates React Query cache automatically
  - Shows toast notifications
  - Handles notification CRUD operations
  - Syncs missed notifications on reconnection

### UI Components

#### `components/common/socket-notifications-listener.tsx`
- **Purpose**: Initializes socket notification listeners at app root
- **Usage**: Place inside AuthProvider context

#### `components/common/socket-reconnect-handler.tsx`
- **Purpose**: Handles socket reconnection failures
- **Features**:
  - Shows persistent error notification
  - Provides refresh button to user

## Socket Events

### Client -> Server

| Event | Payload | Description |
|-------|---------|-------------|
| `sync:request` | `{ timestamp: number }` | Request missed notifications after reconnection |

### Server -> Client

| Event | Payload | Description |
|-------|---------|-------------|
| `notification:new` | `Notification` | New notification created |
| `notification:update` | `Notification` | Notification updated |
| `notification:delete` | `string (notificationId)` | Notification deleted |
| `notification:read` | `{ notificationId: string, userId: string }` | Notification marked as read |
| `notification:read-all` | `void` | All notifications marked as read |
| `sync:notifications` | `{ notifications: Notification[] }` | Sync response with missed notifications |
| `auth:error` | `Error` | Authentication error |

## Connection Flow

1. **Initial Connection**
   ```typescript
   User logs in
   → Token stored in localStorage
   → useSocket() hook called
   → socketService.connect(token)
   → Socket connects with auth token
   → 'connect' event fired
   → Auto-sync missed data
   ```

2. **Disconnection**
   ```typescript
   Network error / Server restart
   → 'disconnect' event fired
   → Automatic reconnection starts
   → Exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
   → Max 5 attempts
   → On reconnect: sync missed data
   ```

3. **Manual Disconnect**
   ```typescript
   User logs out / Component unmounts
   → socketService.disconnect()
   → All listeners removed
   → Socket disconnected
   ```

## Reconnection Logic

The socket implements robust reconnection with:

- **Exponential Backoff**: Delays between attempts increase exponentially
  - Attempt 1: 1s delay
  - Attempt 2: 2s delay
  - Attempt 3: 4s delay
  - Attempt 4: 8s delay
  - Attempt 5: 16s delay
  - Max delay capped at 30s

- **Automatic Sync**: On successful reconnection, requests missed notifications

- **User Notification**: After max attempts, shows persistent error with refresh option

## Integration Guide

### 1. Install Dependencies
```bash
pnpm add socket.io-client
```

### 2. Configure Environment
Add to `.env` files:
```env
VITE_API_URL=http://localhost:3030
```

### 3. Add to App.tsx
```tsx
import { SocketNotificationsListener } from "@/components/common/socket-notifications-listener";
import { SocketReconnectHandler } from "@/components/common/socket-reconnect-handler";

function App() {
  return (
    <AuthProvider>
      <SocketNotificationsListener />
      <SocketReconnectHandler />
      {/* Rest of app */}
    </AuthProvider>
  );
}
```

### 4. Using in Components

#### Listen to socket connection status
```tsx
import { useSocketConnected } from '@/hooks/use-socket';

function MyComponent() {
  const isConnected = useSocketConnected();

  return <div>Socket: {isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

#### Emit custom events
```tsx
import { useSocketEmit } from '@/hooks/use-socket';

function MyComponent() {
  const emit = useSocketEmit();

  const sendMessage = () => {
    emit('custom:event', { data: 'hello' });
  };

  return <button onClick={sendMessage}>Send</button>;
}
```

#### Listen to custom events
```tsx
import { useSocketEvent } from '@/hooks/use-socket';

function MyComponent() {
  useSocketEvent('custom:event', (data) => {
    console.log('Received:', data);
  });

  return <div>Listening for events...</div>;
}
```

## Testing

### Manual Testing Checklist

- [ ] Socket connects on login
- [ ] Socket disconnects on logout
- [ ] Real-time notifications appear as toasts
- [ ] Notifications update React Query cache
- [ ] Clicking toast action navigates to URL
- [ ] Reconnection works after network drop
- [ ] Missed notifications sync after reconnection
- [ ] Error shown after max reconnection attempts
- [ ] Refresh button works in error notification

### Network Simulation
```bash
# Test reconnection by killing server
docker stop ankaa-api

# Wait 10 seconds, restart
docker start ankaa-api

# Socket should reconnect and sync
```

## Troubleshooting

### Socket not connecting
1. Check `VITE_API_URL` in `.env`
2. Verify token in localStorage
3. Check browser console for errors
4. Verify server is running

### Notifications not appearing
1. Check React Query DevTools for cache updates
2. Verify event names match server
3. Check browser console for socket events

### Reconnection issues
1. Check browser Network tab for WebSocket
2. Verify exponential backoff in console
3. Check max attempts configuration

## Performance Considerations

- Socket connection is singleton (one per app)
- Event listeners cleaned up on unmount
- React Query cache prevents unnecessary re-renders
- Toast notifications debounced by importance level

## Security

- Authentication via JWT token in socket handshake
- Token auto-refreshed with axios interceptor
- Server validates token on every connection
- Failed auth triggers automatic disconnect

## Future Enhancements

- [ ] Add socket connection indicator in UI
- [ ] Implement typing indicators
- [ ] Add read receipts
- [ ] Support for binary data (file uploads)
- [ ] Add socket middleware for logging
- [ ] Implement presence detection (online/offline users)
