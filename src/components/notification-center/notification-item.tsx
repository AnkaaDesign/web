import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  IconBell,
  IconChecklist,
  IconShoppingCart,
  IconShield,
  IconBeach,
  IconAlertTriangle,
  IconPackage,
  IconInfoCircle,
  IconClock,
  IconX,
  IconClipboardCheck,
} from "@tabler/icons-react";
import type { Notification } from "@/types";
import { NOTIFICATION_TYPE } from "@/constants";

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
    case NOTIFICATION_TYPE.TASK:
      return <IconChecklist {...iconProps} />;
    case NOTIFICATION_TYPE.ORDER:
      return <IconShoppingCart {...iconProps} />;
    case NOTIFICATION_TYPE.SERVICE_ORDER:
      return <IconClipboardCheck {...iconProps} />;
    case NOTIFICATION_TYPE.PPE:
      return <IconShield {...iconProps} />;
    case NOTIFICATION_TYPE.VACATION:
      return <IconBeach {...iconProps} />;
    case NOTIFICATION_TYPE.WARNING:
      return <IconAlertTriangle {...iconProps} />;
    case NOTIFICATION_TYPE.STOCK:
      return <IconPackage {...iconProps} />;
    case NOTIFICATION_TYPE.GENERAL:
    default:
      return <IconInfoCircle {...iconProps} />;
  }
};

const getNotificationIconBgColor = (type: NOTIFICATION_TYPE) => {
  switch (type) {
    case NOTIFICATION_TYPE.SYSTEM:
      return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
    case NOTIFICATION_TYPE.TASK:
      return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
    case NOTIFICATION_TYPE.ORDER:
      return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
    case NOTIFICATION_TYPE.SERVICE_ORDER:
      return "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400";
    case NOTIFICATION_TYPE.PPE:
      return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";
    case NOTIFICATION_TYPE.VACATION:
      return "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400";
    case NOTIFICATION_TYPE.WARNING:
      return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
    case NOTIFICATION_TYPE.STOCK:
      return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400";
    case NOTIFICATION_TYPE.GENERAL:
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
  onRemindLater,
  onDismiss,
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

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(notification);
  };

  return (
    <div
      onClick={() => onClick(notification)}
      className={cn(
        "group relative flex gap-3 p-4 cursor-pointer transition-all duration-200 border-b border-border last:border-b-0",
        "hover:bg-muted/50",
        isUnread && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
      )}

      {/* Icon */}
      <div className={cn("flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg", iconBgColor)}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className={cn("text-sm font-medium line-clamp-1", isUnread && "font-semibold")}>{notification.title}</h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
        </div>

        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{notification.body}</p>
        )}

        {/* Action buttons - only show on hover or for unread items */}
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity",
            isUnread ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {onRemindLater && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemindLater}
              className="h-7 px-2 text-xs"
            >
              <IconClock className="w-3 h-3 mr-1" />
              Lembrar depois
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-7 px-2 text-xs"
            >
              <IconX className="w-3 h-3 mr-1" />
              Dispensar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
