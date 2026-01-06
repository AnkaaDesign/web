# Socket.io Setup Guide for Real-time Notifications

This guide explains how to enable real-time notifications using Socket.io.

## Installation

Install the Socket.io client package:

```bash
npm install socket.io-client
```

## Environment Configuration

Add the API URL to your `.env` file:

```env
VITE_API_URL=http://localhost:3000
```

For production:

```env
VITE_API_URL=https://api.yourdomain.com
```

## Enable Socket.io in the Hook

Edit `/src/hooks/use-notification-center.ts`:

1. Uncomment the import statement:

```typescript
import { io, Socket } from "socket.io-client";
```

2. Uncomment the entire Socket.io setup block in the `useEffect`:

```typescript
const socket = io(import.meta.env.VITE_API_URL || "http://localhost:3000", {
  auth: {
    token: localStorage.getItem("token"),
  },
  transports: ["websocket"],
});

// Listen for new notifications
socket.on("notification:new", (notification: Notification) => {
  // ... implementation
});

// ... other event listeners

return () => {
  socket.off("notification:new");
  socket.off("notification:update");
  socket.off("notification:delete");
  socket.disconnect();
};
```

3. Remove or comment out the polling interval fallback:

```typescript
// const pollInterval = setInterval(() => {
//   queryClient.invalidateQueries({ queryKey: ["notifications"] });
// }, 30000);
//
// return () => {
//   clearInterval(pollInterval);
// };
```

## Backend Socket.io Events

Your backend should emit the following events:

### notification:new

Emitted when a new notification is created for a user.

```typescript
// Backend example
io.to(`user:${userId}`).emit("notification:new", {
  id: "notification-id",
  title: "New Task Assigned",
  body: "You have been assigned a new task",
  type: "TASK",
  link: "/tasks/123",
  createdAt: new Date(),
  seenBy: [],
});
```

### notification:update

Emitted when a notification is updated (e.g., marked as read).

```typescript
// Backend example
io.to(`user:${userId}`).emit("notification:update", {
  id: "notification-id",
  // ... updated notification data
  seenBy: [{ userId, seenAt: new Date() }],
});
```

### notification:delete

Emitted when a notification is deleted.

```typescript
// Backend example
io.to(`user:${userId}`).emit("notification:delete", "notification-id");
```

## Backend Socket.io Setup Example

```typescript
import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const user = await verifyToken(token);
    socket.data.user = user;
    socket.join(`user:${user.id}`);
    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log(`User ${socket.data.user.id} connected`);

  socket.on("disconnect", () => {
    console.log(`User ${socket.data.user.id} disconnected`);
  });
});

// Emit notification when created
async function createNotification(data) {
  const notification = await db.notification.create({ data });

  // Emit to the user's room
  io.to(`user:${notification.userId}`).emit("notification:new", notification);

  return notification;
}

httpServer.listen(3000);
```

## Testing Socket.io Connection

You can test the Socket.io connection in the browser console:

```javascript
// Check if socket is connected
console.log(window.socket?.connected);

// Monitor socket events
window.socket?.onAny((event, ...args) => {
  console.log("Socket event:", event, args);
});
```

## Troubleshooting

### Connection Errors

If you see connection errors in the console:

1. Check that the API URL is correct
2. Verify CORS settings on the backend
3. Ensure the token is valid and being sent correctly
4. Check firewall/network settings

### No Real-time Updates

If notifications don't appear in real-time:

1. Verify the backend is emitting events to the correct room
2. Check the browser console for Socket.io errors
3. Ensure the user is properly authenticated
4. Verify the notification data structure matches the expected format

### High CPU/Memory Usage

If Socket.io causes performance issues:

1. Implement rate limiting on the backend
2. Use Socket.io rooms efficiently
3. Limit the number of events per connection
4. Consider using Redis adapter for scaling

## Security Considerations

1. Always authenticate Socket.io connections
2. Validate all incoming data on the backend
3. Use rooms to ensure users only receive their own notifications
4. Implement rate limiting to prevent abuse
5. Use secure WebSocket connections (wss://) in production
6. Rotate authentication tokens regularly

## Performance Tips

1. Use binary data for large payloads
2. Implement message acknowledgments for critical notifications
3. Use compression for Socket.io messages
4. Batch notifications when appropriate
5. Implement reconnection logic with exponential backoff

## Production Checklist

- [ ] Socket.io client installed
- [ ] Environment variables configured
- [ ] Backend Socket.io server set up
- [ ] Authentication middleware implemented
- [ ] Event handlers uncommented in hook
- [ ] CORS settings configured
- [ ] SSL/TLS certificates installed
- [ ] Error handling implemented
- [ ] Logging set up
- [ ] Load testing completed
- [ ] Monitoring configured
