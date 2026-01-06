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
}

interface GroupedNotifications {
  today: Notification[];
  yesterday: Notification[];
  thisWeek: Notification[];
  older: Notification[];
}

const groupNotificationsByDate = (notifications: Notification[]): GroupedNotifications => {
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

  return grouped;
};

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNotificationClick,
  onRemindLater,
  onDismiss,
  maxHeight = "500px",
}) => {
  if (notifications.length === 0) {
    return <NotificationEmpty />;
  }

  const grouped = groupNotificationsByDate(notifications);

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
    <ScrollArea className="w-full" style={{ height: maxHeight }}>
      <div className="flex flex-col">
        {renderGroup("Hoje", grouped.today)}
        {renderGroup("Ontem", grouped.yesterday)}
        {renderGroup("Esta Semana", grouped.thisWeek)}
        {renderGroup("Mais Antigas", grouped.older)}
      </div>
    </ScrollArea>
  );
};
