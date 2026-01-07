# Message Modal Integration Guide

This guide shows you exactly how to integrate the Message Modal into your application.

## Step 1: Update App.tsx

Edit `/home/kennedy/Documents/repositories/web/src/App.tsx` and add the `MessageModalProvider`:

```tsx
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { routes } from "./constants";
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/contexts/auth-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { FileViewerProvider } from "@/components/common/file/file-viewer";
import { MessageModalProvider } from "@/components/common/message-modal"; // ADD THIS LINE
import { AutoPrivilegeRoute } from "@/components/navigation/auto-privilege-route";
import { MainLayout } from "@/layouts/main-layout";
import { AuthLayout } from "@/layouts/auth-layout";
import { Toaster } from "@/components/ui/sonner";
import { setupWebNotifications } from "@/lib/setup-notifications";
import { PushNotificationSetup } from "@/components/common/push-notification-setup";
import { SocketNotificationsListener } from "@/components/common/socket-notifications-listener";
import { SocketReconnectHandler } from "@/components/common/socket-reconnect-handler";

// ... rest of imports ...

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <MessageModalProvider>  {/* ADD THIS WRAPPER */}
              <FileViewerProvider>
                <QueryClientProvider client={queryClient}>
                  {/* Your routes and other providers */}
                  <Routes>
                    {/* ... your routes ... */}
                  </Routes>
                  <Toaster />
                  <PushNotificationSetup />
                  <SocketNotificationsListener />
                  <SocketReconnectHandler />
                </QueryClientProvider>
              </FileViewerProvider>
            </MessageModalProvider>  {/* CLOSE THE WRAPPER */}
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
```

**Important**: Place `MessageModalProvider` inside `AuthProvider` but can be anywhere in the tree. The example above shows the recommended position.

## Step 2: Verify Dependencies

Make sure you have the Checkbox component. Check if this file exists:
- `/home/kennedy/Documents/repositories/web/src/components/ui/checkbox.tsx`

If it doesn't exist, you can create it or remove the checkbox feature from the modal.

## Step 3: Test the Integration

1. **Create a test notification** in your database:

```sql
INSERT INTO notifications (id, title, body, type, importance, channel, "userId", "sentAt", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Welcome to the System',
  '<p>This is a test message to verify the Message Modal is working correctly.</p>',
  'ANNOUNCEMENT',
  'HIGH',
  ARRAY['PUSH', 'IN_APP'],
  'your-user-id-here',
  NOW(),
  NOW(),
  NOW()
);
```

2. **Login to the application**
3. The modal should automatically appear with your test message

## Optional: Add Message Count Badge to Header

If you want to show unread message count in your navigation, add this to your Header component:

```tsx
import { useMessageModal } from "@/components/common/message-modal";

function Header() {
  const { unviewedMessages, setOpen } = useMessageModal({ autoShow: false });

  return (
    <nav>
      {/* Other header items */}

      <button
        onClick={() => setOpen(true)}
        className="relative p-2"
      >
        <BellIcon className="h-5 w-5" />
        {unviewedMessages.length > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unviewedMessages.length}
          </span>
        )}
      </button>
    </nav>
  );
}
```

## Configuration Options

You can customize the behavior by passing props to `MessageModalProvider`:

```tsx
<MessageModalProvider
  autoShow={true}           // Auto-show modal when messages available (default: true)
  showOnMount={true}        // Show on first mount/focus (default: true)
  checkInterval={60000}     // Check for new messages every 60 seconds (default: 60000)
>
  {children}
</MessageModalProvider>
```

### Disable Auto-Show

If you want manual control only:

```tsx
<MessageModalProvider autoShow={false}>
  {children}
</MessageModalProvider>
```

Then use the hook in your components to manually show the modal:

```tsx
const { setOpen, unviewedMessages } = useMessageModal();

// Show modal manually
<button onClick={() => setOpen(true)}>
  Messages ({unviewedMessages.length})
</button>
```

## Customization

### Change Check Interval

Check for messages every 5 minutes instead of 1 minute:

```tsx
<MessageModalProvider checkInterval={300000}>
  {children}
</MessageModalProvider>
```

### Add Custom Callbacks

```tsx
import { MessageModalProvider } from "@/components/common/message-modal";

function App() {
  const handleMessageRead = (messageId: string) => {
    console.log("Message marked as read:", messageId);
    // Send analytics event, etc.
  };

  const handleMessageDismissed = (messageId: string) => {
    console.log("Message dismissed:", messageId);
    // Send analytics event, etc.
  };

  // Note: You'll need to use the hook directly for this
  // The provider doesn't expose these callbacks
  return (
    <MessageModalProvider>
      {children}
    </MessageModalProvider>
  );
}
```

For full callback control, use the hook directly:

```tsx
import { useMessageModal, MessageModal } from "@/components/common/message-modal";

function MyComponent() {
  const {
    open,
    setOpen,
    unviewedMessages,
    markAsRead,
    dontShowAgain,
  } = useMessageModal({
    onMessageRead: (id) => console.log("Read:", id),
    onMessageDismissed: (id) => console.log("Dismissed:", id),
  });

  return (
    <MessageModal
      open={open}
      onOpenChange={setOpen}
      messages={unviewedMessages}
      onMarkAsRead={markAsRead}
      onDontShowAgain={dontShowAgain}
    />
  );
}
```

## Troubleshooting

### Modal doesn't appear

1. Check browser console for errors
2. Verify user is logged in
3. Check if there are unread notifications:
   ```tsx
   const { messages, isLoading } = useMessageModal();
   console.log("Messages:", messages, "Loading:", isLoading);
   ```

### TypeScript errors

Make sure your notification types match. The component expects notifications to have:
- `id: string`
- `title: string`
- `body: string` (HTML content)
- `type: NOTIFICATION_TYPE`
- `importance: NOTIFICATION_IMPORTANCE`
- `sentAt: Date | null`
- `actionUrl?: string | null`
- `actionType?: string | null`

### Styling issues

The component uses your existing Tailwind configuration. If styles look off:
1. Check your `tailwind.config.js` includes the component path
2. Verify your theme colors are defined
3. Check for CSS conflicts

## Advanced: Custom Modal UI

If you want to customize the modal appearance, you can:

1. **Fork the component**: Copy `message-modal.tsx` and modify it
2. **Use CSS overrides**: Target the component classes with custom CSS
3. **Create a wrapper**: Wrap `MessageModal` with your own component

Example wrapper:

```tsx
import { MessageModal, MessageModalProps } from "@/components/common/message-modal";

export function CustomMessageModal(props: MessageModalProps) {
  return (
    <div className="custom-message-modal-wrapper">
      <MessageModal {...props} />
    </div>
  );
}
```

## Next Steps

1. Test with different message types and importance levels
2. Create notifications through your admin panel
3. Monitor user engagement with message analytics
4. Customize styling to match your brand

## Support

If you encounter issues:
1. Check the main README.md for API documentation
2. Review the component source code
3. Check browser console for errors
4. Verify API endpoints are working

## Complete Example

Here's a complete working example:

```tsx
// App.tsx
import { MessageModalProvider } from "@/components/common/message-modal";

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <MessageModalProvider
            autoShow={true}
            showOnMount={true}
            checkInterval={60000}
          >
            <Routes>
              {/* Your routes */}
            </Routes>
          </MessageModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

// Header.tsx (optional)
import { useMessageModal } from "@/components/common/message-modal";

function Header() {
  const { unviewedMessages, setOpen } = useMessageModal({ autoShow: false });

  return (
    <header>
      <button onClick={() => setOpen(true)}>
        Messages
        {unviewedMessages.length > 0 && (
          <Badge>{unviewedMessages.length}</Badge>
        )}
      </button>
    </header>
  );
}
```

That's it! Your message modal is now fully integrated.
