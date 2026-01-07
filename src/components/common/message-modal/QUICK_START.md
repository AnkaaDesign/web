# Quick Start - 30 Second Setup

## Step 1: Add to App.tsx

Open `/home/kennedy/Documents/repositories/web/src/App.tsx` and add these two lines:

**Add import at the top:**
```tsx
import { MessageModalProvider } from "@/components/common/message-modal";
```

**Wrap your app (add after AuthProvider):**
```tsx
<AuthProvider>
  <FavoritesProvider>
    <MessageModalProvider>  {/* ADD THIS */}
      <FileViewerProvider>
        {/* rest of your app */}
      </FileViewerProvider>
    </MessageModalProvider>  {/* ADD THIS */}
  </FavoritesProvider>
</AuthProvider>
```

## Step 2: Test It

Create a test notification in your database:

```sql
INSERT INTO notifications (
  id,
  title,
  body,
  type,
  importance,
  channel,
  "userId",
  "sentAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'Test Message',
  '<p>This is a test notification from the Message Modal!</p>',
  'ANNOUNCEMENT',
  'HIGH',
  ARRAY['IN_APP'],
  'YOUR-USER-ID-HERE',  -- Replace with your user ID
  NOW(),
  NOW(),
  NOW()
);
```

## Step 3: Login

Login to your app - the modal should appear automatically!

## That's It!

The message modal is now fully functional.

## Optional: Add Message Button to Header

Want to show a message button with count? Add this to your header:

```tsx
import { useMessageModal } from "@/components/common/message-modal";
import { Bell } from "lucide-react";

function Header() {
  const { unviewedMessages, setOpen } = useMessageModal({ autoShow: false });

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setOpen(true)}
      className="relative"
    >
      <Bell className="h-5 w-5" />
      {unviewedMessages.length > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
          {unviewedMessages.length}
        </span>
      )}
    </Button>
  );
}
```

## Test Demo

View the interactive demo at:
```tsx
import { MessageModalDemo } from "@/components/common/message-modal/message-modal-demo";
```

Add it to a route:
```tsx
<Route path="/demo/messages" element={<MessageModalDemo />} />
```

## Configuration

Default configuration works great, but you can customize:

```tsx
<MessageModalProvider
  autoShow={true}           // Auto-show on new messages
  showOnMount={true}        // Show on first app load
  checkInterval={60000}     // Check every 60 seconds
>
```

## Need Help?

- Read the full documentation: `README.md`
- Step-by-step guide: `INTEGRATION_GUIDE.md`
- Complete reference: `IMPLEMENTATION_SUMMARY.md`

## Features at a Glance

✓ Auto-shows unread messages
✓ Beautiful animations
✓ Keyboard navigation (←/→/ESC)
✓ Mark as read
✓ Don't show again
✓ Multiple messages support
✓ Priority badges
✓ Dark mode
✓ Mobile responsive
✓ Fully accessible

Enjoy! 🎉
