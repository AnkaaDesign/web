# Message Modal Component

A beautiful, fully-featured modal component for displaying system messages and notifications to users.

## Features

- **Auto-show on mount**: Automatically displays unviewed messages when the user first focuses/visits the app
- **Beautiful design**: Gradient header, smooth animations, and responsive layout
- **Multi-message navigation**: Navigate through multiple messages with next/previous buttons
- **Keyboard shortcuts**: Full keyboard navigation support
- **Mark as read**: Mark individual messages as read with visual feedback
- **Don't show again**: Option to permanently dismiss messages
- **Priority badges**: Visual indicators for message importance (High, Medium, Low)
- **Message types**: Different badges for message types (General, System, Update, Alert, etc.)
- **Action URLs**: Support for external links and call-to-action buttons
- **Progress indicator**: Visual progress bar when viewing multiple messages
- **Responsive**: Works perfectly on all screen sizes
- **Accessible**: Full ARIA support and screen reader friendly
- **Smooth animations**: Beautiful enter/exit animations using Tailwind CSS

## Installation

The component is already set up and ready to use. Just follow the integration steps below.

## Quick Start

### 1. Add to your App Layout

Edit `/home/kennedy/Documents/repositories/web/src/App.tsx`:

```tsx
import { MessageModalProvider } from "@/components/common/message-modal";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FavoritesProvider>
          <MessageModalProvider>  {/* Add this wrapper */}
            <FileViewerProvider>
              {/* Rest of your app */}
            </FileViewerProvider>
          </MessageModalProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

That's it! The modal will now automatically show when there are unread messages.

## Advanced Usage

### Custom Configuration

You can customize the behavior with props:

```tsx
<MessageModalProvider
  autoShow={true}           // Automatically show modal when messages are available
  showOnMount={true}        // Show on first mount/focus
  checkInterval={60000}     // Check for new messages every 60 seconds
>
  {children}
</MessageModalProvider>
```

### Manual Control

For manual control over the modal, use the `useMessageModal` hook:

```tsx
import { useMessageModal } from "@/components/common/message-modal";

function MyComponent() {
  const {
    open,
    setOpen,
    messages,
    unviewedMessages,
    isLoading,
    markAsRead,
    markAllAsRead,
    dontShowAgain,
    refetch,
  } = useMessageModal({
    autoShow: false,  // Disable auto-show for manual control
  });

  return (
    <div>
      <button onClick={() => setOpen(true)}>
        Show Messages ({unviewedMessages.length})
      </button>

      <MessageModal
        open={open}
        onOpenChange={setOpen}
        messages={unviewedMessages}
        onMarkAsRead={markAsRead}
        onDontShowAgain={dontShowAgain}
      />
    </div>
  );
}
```

### Standalone Usage

You can also use the modal component standalone:

```tsx
import { MessageModal } from "@/components/common/message-modal";
import { useState } from "react";

function MyComponent() {
  const [open, setOpen] = useState(false);
  const messages = [
    {
      id: "1",
      title: "Welcome!",
      body: "<p>Welcome to our application!</p>",
      type: "ANNOUNCEMENT",
      importance: "HIGH",
      sentAt: new Date(),
      // ... other notification fields
    },
  ];

  return (
    <MessageModal
      open={open}
      onOpenChange={setOpen}
      messages={messages}
      onMarkAsRead={(id) => console.log("Marked as read:", id)}
      onDontShowAgain={(id) => console.log("Don't show again:", id)}
    />
  );
}
```

## API Reference

### MessageModalProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | Required | Child components |
| `autoShow` | `boolean` | `true` | Automatically show modal when messages are available |
| `showOnMount` | `boolean` | `true` | Show modal on first mount/focus |
| `checkInterval` | `number` | `60000` | Interval to check for new messages (in milliseconds) |

### MessageModal Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | Required | Whether the modal is open |
| `onOpenChange` | `(open: boolean) => void` | Required | Callback when open state changes |
| `messages` | `Notification[]` | Required | Array of messages to display |
| `currentIndex` | `number` | `0` | Initial message index |
| `onMarkAsRead` | `(id: string) => void` | Optional | Callback when message is marked as read |
| `onDontShowAgain` | `(id: string) => void` | Optional | Callback when user chooses not to show message again |
| `onClose` | `() => void` | Optional | Callback when modal closes |

### useMessageModal Return

| Property | Type | Description |
|----------|------|-------------|
| `open` | `boolean` | Whether the modal is open |
| `setOpen` | `(open: boolean) => void` | Set modal open state |
| `messages` | `Notification[]` | All unread messages |
| `unviewedMessages` | `Notification[]` | Unread messages excluding dismissed ones |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error state |
| `markAsRead` | `(id: string) => void` | Mark a message as read |
| `markAllAsRead` | `() => void` | Mark all messages as read |
| `dontShowAgain` | `(id: string) => void` | Dismiss a message permanently |
| `refetch` | `() => void` | Manually refetch messages |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close modal |
| `←` (Left Arrow) | Previous message |
| `→` (Right Arrow) | Next message |

## Message Importance Levels

Messages can have three importance levels:

- **HIGH**: Red badge, appears first
- **MEDIUM**: Yellow badge, appears after high priority
- **LOW**: Gray badge, appears last

## Message Types

Supported message types:
- `GENERAL` - General messages
- `SYSTEM` - System notifications
- `UPDATE` - Update announcements
- `ALERT` - Important alerts
- `REMINDER` - Reminders
- `ANNOUNCEMENT` - Public announcements

## Styling

The component uses your existing design system:
- Tailwind CSS classes
- Radix UI primitives
- Your theme colors (primary, muted, destructive, etc.)
- Supports dark mode automatically

## Behavior

1. **On First Load**: If there are unread messages, the modal opens automatically
2. **Navigation**: Users can navigate through messages with buttons or keyboard
3. **Mark as Read**: Clicking "Mark as read" marks the message and moves to the next one
4. **Don't Show Again**: Dismissed messages are stored in localStorage and won't show again
5. **Auto-close**: When marking the last message as read, the modal closes automatically
6. **Polling**: Checks for new messages every 60 seconds (configurable)

## Data Flow

```
User Login
    ↓
useMessageModal fetches unread notifications
    ↓
Filter out dismissed messages (from localStorage)
    ↓
Auto-show modal if there are unviewed messages
    ↓
User interacts (mark as read / don't show again)
    ↓
Update backend + localStorage
    ↓
Refetch and update UI
```

## Backend Integration

The component uses the existing `NotificationService` API:
- `getUnreadNotifications(userId)` - Fetch unread notifications
- `markAsRead(notificationId, userId)` - Mark notification as read
- `markAllAsRead(userId)` - Mark all notifications as read

## Examples

### Show message count in header

```tsx
import { useMessageModal } from "@/components/common/message-modal";

function Header() {
  const { unviewedMessages, setOpen } = useMessageModal({ autoShow: false });

  return (
    <button onClick={() => setOpen(true)}>
      Messages {unviewedMessages.length > 0 && `(${unviewedMessages.length})`}
    </button>
  );
}
```

### Custom message handler

```tsx
const { markAsRead } = useMessageModal({
  onMessageRead: (id) => {
    console.log("Message read:", id);
    // Send analytics event
    analytics.track("message_read", { messageId: id });
  },
  onMessageDismissed: (id) => {
    console.log("Message dismissed:", id);
    // Send analytics event
    analytics.track("message_dismissed", { messageId: id });
  },
});
```

## Troubleshooting

### Modal doesn't show
- Check if user is authenticated
- Verify there are unread notifications in the database
- Check browser console for errors

### Messages don't mark as read
- Verify API endpoint is working
- Check network tab for failed requests
- Ensure user ID is correctly passed

### "Don't show again" not persisting
- Check localStorage is enabled in browser
- Verify localStorage key `dismissedMessages` is being set
- Check for localStorage quota errors

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

- React 18+
- Radix UI Dialog
- Tailwind CSS
- date-fns
- TanStack Query
- Lucide React (icons)

## License

Part of the Ankaa Web application.
