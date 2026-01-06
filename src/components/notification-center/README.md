# Notification Center

A comprehensive in-app notification center component for the web application with real-time updates, grouping by date, and user interactions.

## Features

- **Real-time Notifications**: Ready for Socket.io integration for instant notification delivery
- **Unread Badge**: Visual indicator showing the count of unread notifications
- **Date Grouping**: Automatically groups notifications by "Today", "Yesterday", "This Week", and "Older"
- **Type-based Icons**: Different icons and colors based on notification type
- **Interactive Actions**: "Remind me later" and "Dismiss" actions for each notification
- **Mark as Read**: Click notifications to mark them as read and navigate to the target
- **Mark All as Read**: Bulk action to mark all notifications as read
- **Empty State**: Friendly empty state when no notifications are present
- **Responsive Design**: Mobile-friendly with smooth animations
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## Components

### NotificationCenter

Main popover component that integrates into the header.

```tsx
import { NotificationCenter } from "@/components/notification-center";

<NotificationCenter />
```

### NotificationBadge

Badge component showing unread count.

```tsx
import { NotificationBadge } from "@/components/notification-center";

<NotificationBadge count={5} max={99} />
```

### NotificationList

Scrollable list with date-based grouping.

```tsx
import { NotificationList } from "@/components/notification-center";

<NotificationList
  notifications={notifications}
  onNotificationClick={handleClick}
  onRemindLater={handleRemind}
  onDismiss={handleDismiss}
  maxHeight="500px"
/>
```

### NotificationItem

Individual notification item with icon, title, body, and actions.

```tsx
import { NotificationItem } from "@/components/notification-center";

<NotificationItem
  notification={notification}
  onClick={handleClick}
  onRemindLater={handleRemind}
  onDismiss={handleDismiss}
/>
```

### NotificationEmpty

Empty state component.

```tsx
import { NotificationEmpty } from "@/components/notification-center";

<NotificationEmpty />
```

## Hook: useNotificationCenter

Custom hook managing notification state and API integration.

```tsx
import { useNotificationCenter } from "@/hooks/use-notification-center";

const {
  notifications,        // Array of recent notifications (last 50)
  unreadCount,         // Count of unread notifications
  isLoading,           // Loading state
  markAsRead,          // Mark a notification as read
  markAllAsRead,       // Mark all notifications as read
  dismissNotification, // Dismiss a notification
  refreshNotifications // Manually refresh notifications
} = useNotificationCenter();
```

## Notification Types

The system supports the following notification types:

- **SYSTEM**: System-related notifications (blue)
- **TASK**: Task-related notifications (purple)
- **ORDER**: Order-related notifications (green)
- **PPE**: PPE (Personal Protective Equipment) notifications (orange)
- **VACATION**: Vacation-related notifications (cyan)
- **WARNING**: Warning notifications (red)
- **STOCK**: Stock-related notifications (yellow)
- **GENERAL**: General notifications (gray)

## API Integration

The notification center integrates with the following API endpoints:

- `GET /notifications` - Fetch notifications
- `POST /notifications/:id/seen` - Mark notification as seen
- `GET /notifications/unseen/count` - Get unseen count

## Socket.io Integration (Future)

To enable real-time notifications:

1. Install Socket.io client:
```bash
npm install socket.io-client
```

2. Uncomment the Socket.io code in `/hooks/use-notification-center.ts`

3. Configure the Socket.io server URL in your environment variables:
```env
VITE_API_URL=http://localhost:3000
```

### Socket Events

The notification center listens to the following Socket.io events:

- `notification:new` - Triggered when a new notification is created
- `notification:update` - Triggered when a notification is updated
- `notification:delete` - Triggered when a notification is deleted

## Styling

The notification center uses Tailwind CSS for styling and follows the application's design system:

- Unread notifications have a subtle blue background
- Each notification type has a unique icon and color scheme
- Smooth animations for all interactions
- Dark mode support
- Mobile-responsive design

## Usage Example

```tsx
// In your header component
import { NotificationCenter } from "@/components/notification-center";

export const Header = () => {
  return (
    <header>
      <div className="flex items-center gap-3">
        <NotificationCenter />
        {/* Other header items */}
      </div>
    </header>
  );
};
```

## Customization

### Custom Max Height

```tsx
<NotificationList
  notifications={notifications}
  onNotificationClick={handleClick}
  maxHeight="400px"
/>
```

### Custom Badge Max Count

```tsx
<NotificationBadge count={150} max={99} /> // Shows "99+"
```

## Accessibility

- Bell icon button has `aria-label="Notificações"`
- Keyboard navigation support in the popover
- Screen reader friendly with proper semantic HTML
- Focus management when opening/closing the popover

## Performance

- Displays only the last 50 notifications
- Automatic polling every 30 seconds (when Socket.io is not available)
- Optimistic UI updates for instant feedback
- React Query caching for efficient data management

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

- `@radix-ui/react-popover` - Popover component
- `@radix-ui/react-scroll-area` - Scrollable area
- `@tabler/icons-react` - Icons
- `date-fns` - Date formatting
- `react-router-dom` - Navigation
- `@tanstack/react-query` - Data fetching and caching
- `sonner` - Toast notifications

## Future Enhancements

- [ ] Socket.io real-time notifications
- [ ] Notification preferences (email, SMS, push, in-app)
- [ ] Notification sound effects
- [ ] Notification filtering by type
- [ ] Notification search
- [ ] Notification archiving
- [ ] Notification templates
- [ ] Notification scheduling
- [ ] Notification analytics
- [ ] Desktop notifications API integration
