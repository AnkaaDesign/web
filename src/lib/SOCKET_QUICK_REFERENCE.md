# Socket.io Client - Quick Reference

## Installation Status
✅ `socket.io-client@4.8.3` already installed

## Environment Variable
```bash
VITE_API_URL=http://localhost:3030  # Used for both API and WebSocket
```

## Import Statements

```tsx
// For notification management (most common use case)
import { useNotificationSocket } from '@/hooks/use-notification-socket';

// For direct socket access
import { socketService } from '@/lib/socket';
import type { ConnectionState } from '@/lib/socket';

// For custom socket events
import { useSocket, useSocketEvent, useSocketEmit } from '@/hooks/use-socket';
```

## Basic Usage - Notification Hook

```tsx
function MyComponent() {
  const {
    connectionState,    // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    isConnected,        // boolean
    unreadCount,        // number
    markAsRead,         // (id: string) => void
    markAsDelivered,    // (id: string) => void
  } = useNotificationSocket();

  return (
    <div>
      <span>Status: {connectionState}</span>
      <span>Unread: {unreadCount}</span>
      <button onClick={() => markAsRead('notification-id')}>
        Mark as Read
      </button>
    </div>
  );
}
```

## App-Level Setup

```tsx
// Add to App.tsx or root layout (inside AuthProvider)
import { SocketNotificationsListener } from '@/components/common/socket-notifications-listener';

function App() {
  return (
    <AuthProvider>
      <SocketNotificationsListener />  {/* ← Add this once at root */}
      <YourAppContent />
    </AuthProvider>
  );
}
```

## Direct Socket Operations

```tsx
import { socketService } from '@/lib/socket';

// Mark notification as read
socketService.markNotificationAsRead('notification-id');

// Mark notification as delivered
socketService.markNotificationAsDelivered('notification-id');

// Mark all as read
socketService.markAllNotificationsAsRead();

// Request notification count
socketService.requestNotificationCount();

// Get connection state
const state = socketService.getConnectionState();

// Subscribe to connection changes
const unsubscribe = socketService.onConnectionStateChange((state) => {
  console.log('Connection state:', state);
});
// Later: unsubscribe();
```

## Event Listeners

The hook automatically listens to these events:

- `notification:new` - New notification (auto-shows toast)
- `notification:read` - Notification marked as read
- `notification:count` - Unread count update
- `notification:update` - Notification updated
- `notification:delete` - Notification deleted
- `notification:read-all` - All marked as read
- `connect` - Socket connected
- `disconnect` - Socket disconnected
- `sync:notifications` - Sync after reconnection

## Custom Events

```tsx
import { useSocketEvent, useSocketEmit } from '@/hooks/use-socket';

function CustomComponent() {
  const emit = useSocketEmit();

  // Listen to custom event
  useSocketEvent('custom:event', (data) => {
    console.log('Received:', data);
  });

  // Emit custom event
  const sendEvent = () => {
    emit('custom:event', { message: 'Hello' });
  };

  return <button onClick={sendEvent}>Send</button>;
}
```

## Error Handling

```tsx
// Listen for authentication errors
useEffect(() => {
  const handler = (event: Event) => {
    const e = event as CustomEvent;
    console.error('Socket auth error:', e.detail);
    // Redirect to login
  };

  window.addEventListener('socket:auth-error', handler);
  return () => window.removeEventListener('socket:auth-error', handler);
}, []);

// Listen for reconnection failures
useEffect(() => {
  const handler = (event: Event) => {
    const e = event as CustomEvent;
    toast.error('Connection Lost', {
      description: e.detail.message,
      action: { label: 'Refresh', onClick: () => window.location.reload() }
    });
  };

  window.addEventListener('socket:reconnect-failed', handler);
  return () => window.removeEventListener('socket:reconnect-failed', handler);
}, []);
```

## Connection State Indicator

```tsx
function ConnectionIndicator() {
  const { connectionState } = useNotificationSocket();

  const colors = {
    connected: 'green',
    connecting: 'yellow',
    reconnecting: 'yellow',
    disconnected: 'gray',
    error: 'red',
  };

  return (
    <div style={{ color: colors[connectionState] }}>
      {connectionState}
    </div>
  );
}
```

## Configuration

Socket configuration (auto-applied):
- Auto-reconnect: ✅ Yes
- Reconnection delay: 1000ms (starting)
- Max reconnection delay: 30000ms
- Max reconnection attempts: 5
- JWT in handshake: ✅ Yes
- Transport: WebSocket (fallback to polling)

## Common Patterns

### Notification Badge
```tsx
function NotificationBadge() {
  const { unreadCount } = useNotificationSocket();

  return (
    <div className="relative">
      <BellIcon />
      {unreadCount > 0 && (
        <span className="badge">{unreadCount}</span>
      )}
    </div>
  );
}
```

### Connection Status Banner
```tsx
function ConnectionBanner() {
  const { isConnected } = useNotificationSocket();

  if (isConnected) return null;

  return (
    <div className="banner-warning">
      Connection lost. Attempting to reconnect...
    </div>
  );
}
```

### Manual Sync Button
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

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Socket not connecting | Check `VITE_API_URL` in `.env` |
| Auth errors | Verify JWT token is valid in localStorage |
| Events not received | Ensure socket is connected (`isConnected === true`) |
| Multiple connections | Only mount `SocketNotificationsListener` once |
| TypeScript errors | Import types from `@/lib/socket` |

## File Locations

- Socket Service: `/src/lib/socket.ts`
- Notification Hook: `/src/hooks/use-notification-socket.ts`
- Socket Hooks: `/src/hooks/use-socket.ts`
- Listener Component: `/src/components/common/socket-notifications-listener.tsx`
- Full Documentation: `/src/lib/SOCKET_CLIENT_USAGE.md`

## Type Definitions

```typescript
type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface NotificationSocketHook {
  connectionState: ConnectionState;
  isConnected: boolean;
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAsDelivered: (notificationId: string) => void;
}
```

## Key Features

✅ Auto-connect with JWT authentication
✅ Auto-reconnect with exponential backoff
✅ Real-time notification updates
✅ React Query cache integration
✅ Toast notifications for new messages
✅ Connection state management
✅ TypeScript support
✅ Automatic cleanup
✅ Error handling
✅ Event-driven architecture

## Next Steps

1. Add `SocketNotificationsListener` to your app root
2. Use `useNotificationSocket()` in components that need notifications
3. Configure `VITE_API_URL` in your `.env` file
4. Test connection with valid JWT token
5. Refer to `/src/lib/SOCKET_CLIENT_USAGE.md` for advanced usage

---

**For detailed documentation, see**: `/src/lib/SOCKET_CLIENT_USAGE.md`
