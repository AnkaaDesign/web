import * as React from "react";
import { isToday, isYesterday, isThisWeek, startOfWeek } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "./notification-item";
import { NotificationEmpty } from "./notification-empty";
import type { Notification } from "@/types";

interface NotificationListProps {
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onRemindLater?: (notification: Notification) => void;
  onDismiss?: (notification: Notification) => void;
  maxHeight?: string;
  currentUserId?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

interface GroupedNotifications {
  today: Notification[];
  yesterday: Notification[];
  thisWeek: Notification[];
  older: Notification[];
}

const isNotificationUnread = (notification: Notification, userId?: string): boolean => {
  if (!userId) return false;
  return (
    !notification.seenBy ||
    notification.seenBy.length === 0 ||
    !notification.seenBy.some((seen) => seen.userId === userId)
  );
};

const groupNotificationsByDate = (notifications: Notification[], currentUserId?: string): GroupedNotifications => {
  const grouped: GroupedNotifications = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });

  notifications.forEach((notification) => {
    const notificationDate = new Date(notification.createdAt);

    if (isToday(notificationDate)) {
      grouped.today.push(notification);
    } else if (isYesterday(notificationDate)) {
      grouped.yesterday.push(notification);
    } else if (isThisWeek(notificationDate, { weekStartsOn: 0 }) && notificationDate >= weekStart) {
      grouped.thisWeek.push(notification);
    } else {
      grouped.older.push(notification);
    }
  });

  // Sort each group: unseen first, then seen
  // Within each status, sort by createdAt desc
  const sortBySeenStatus = (a: Notification, b: Notification) => {
    const aUnread = isNotificationUnread(a, currentUserId);
    const bUnread = isNotificationUnread(b, currentUserId);

    // Unseen notifications come first
    if (aUnread && !bUnread) return -1;
    if (!aUnread && bUnread) return 1;

    // If both have same seen status, sort by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  };

  grouped.today.sort(sortBySeenStatus);
  grouped.yesterday.sort(sortBySeenStatus);
  grouped.thisWeek.sort(sortBySeenStatus);
  grouped.older.sort(sortBySeenStatus);

  return grouped;
};

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNotificationClick,
  onRemindLater,
  onDismiss,
  maxHeight = "500px",
  currentUserId,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const scrollPositionRef = React.useRef<number>(0);
  const prevNotificationsLengthRef = React.useRef<number>(notifications.length);
  const isLoadingMoreRef = React.useRef<boolean>(false);

  // Track when loading more starts
  React.useEffect(() => {
    if (isLoadingMore) {
      isLoadingMoreRef.current = true;
    }
  }, [isLoadingMore]);

  // Restore scroll position after new data loads
  React.useEffect(() => {
    // Only restore if we were loading more and now have more notifications
    if (isLoadingMoreRef.current && notifications.length > prevNotificationsLengthRef.current && viewportRef.current) {
      const savedPosition = scrollPositionRef.current;
      // Use double requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (viewportRef.current) {
            viewportRef.current.scrollTop = savedPosition;
          }
        });
      });
      isLoadingMoreRef.current = false;
    }
    prevNotificationsLengthRef.current = notifications.length;
  }, [notifications]);

  // Handle scroll to detect when user reaches the bottom
  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.target as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;

      // Always save the current scroll position
      scrollPositionRef.current = scrollTop;

      if (!hasMore || !onLoadMore || isLoadingMore) return;

      // Load more when user is within 100px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        onLoadMore();
      }
    },
    [hasMore, onLoadMore, isLoadingMore]
  );

  if (notifications.length === 0) {
    return <NotificationEmpty />;
  }

  const grouped = groupNotificationsByDate(notifications, currentUserId);

  const renderGroup = (title: string, items: Notification[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mb-1">
        <div className="sticky top-0 z-10 px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
        </div>
        <div>
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={onNotificationClick}
              onRemindLater={onRemindLater}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="w-full" style={{ height: maxHeight }} viewportRef={viewportRef} onScroll={handleScroll}>
      <div className="flex flex-col">
        {renderGroup("Hoje", grouped.today)}
        {renderGroup("Ontem", grouped.yesterday)}
        {renderGroup("Esta Semana", grouped.thisWeek)}
        {renderGroup("Mais Antigas", grouped.older)}

        {/* Loading indicator */}
        {isLoadingMore && (
          <div className="py-4 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
