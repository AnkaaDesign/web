import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  IconBell,
  IconChecklist,
  IconShield,
  IconPackage,
  IconInfoCircle,
  IconClock,
} from "@tabler/icons-react";
import type { Notification } from "@/types";
import { NOTIFICATION_TYPE } from "@/constants";
import { Button } from "@/components/ui/button";

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
  onRemindLater?: (notification: Notification) => void;
  onDismiss?: (notification: Notification) => void;
}

const getNotificationIcon = (type: NOTIFICATION_TYPE) => {
  const iconProps = { className: "w-5 h-5", strokeWidth: 1.5 };

  switch (type) {
    case NOTIFICATION_TYPE.SYSTEM:
      return <IconBell {...iconProps} />;
    case NOTIFICATION_TYPE.PRODUCTION:
      return <IconChecklist {...iconProps} />;
    case NOTIFICATION_TYPE.STOCK:
      return <IconPackage {...iconProps} />;
    case NOTIFICATION_TYPE.USER:
      return <IconShield {...iconProps} />;
    case NOTIFICATION_TYPE.GENERAL:
    default:
      return <IconInfoCircle {...iconProps} />;
  }
};

const getNotificationIconBgColor = (type: NOTIFICATION_TYPE) => {
  switch (type) {
    case NOTIFICATION_TYPE.SYSTEM:
      return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
    case NOTIFICATION_TYPE.PRODUCTION:
      return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
    case NOTIFICATION_TYPE.STOCK:
      return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400";
    case NOTIFICATION_TYPE.USER:
      return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";
    case NOTIFICATION_TYPE.GENERAL:
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  onRemindLater,
}) => {
  const isUnread = !notification.seenBy || notification.seenBy.length === 0;
  const icon = getNotificationIcon(notification.type);
  const iconBgColor = getNotificationIconBgColor(notification.type);

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  const handleRemindLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemindLater?.(notification);
  };

  return (
    <div
      onClick={() => onClick(notification)}
      className={cn(
        "group relative flex gap-3 p-4 cursor-pointer transition-all duration-200 border-b border-border last:border-b-0",
        "hover:bg-muted/50",
        isUnread && "bg-blue-50/50 dark:bg-blue-950/20 border-l-[3px] border-l-blue-600"
      )}
    >
      {/* Unread indicator dot */}
      {isUnread && (
        <div className="absolute left-1 top-4 w-2 h-2 bg-blue-600 rounded-full" />
      )}

      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg",
        iconBgColor,
        isUnread && "ml-1"
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className={cn("text-sm font-medium line-clamp-1", isUnread && "font-semibold")}>{notification.title}</h4>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
            {onRemindLater && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemindLater}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Lembrar depois"
              >
                <IconClock className="w-4 h-4 text-muted-foreground hover:text-blue-600" />
              </Button>
            )}
          </div>
        </div>

        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
        )}
      </div>
    </div>
  );
};
