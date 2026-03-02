import { useState, useRef, useCallback } from "react";
import { IconMessage } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageBlockRenderer } from "@/components/messaging/MessageBlockRenderer";
import { MessageModal } from "@/components/common/message-modal/message-modal";
import { transformMessageContent } from "@/utils/message-transformer";
import { useMarkAsViewed } from "@/hooks/administration/use-message";
import type { HomeDashboardMessage } from "../../types";

const HOVER_DELAY_MS = 400;

function MessagePreviewCard({
  message,
  onClick,
}: {
  message: HomeDashboardMessage;
  onClick: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollActive, setScrollActive] = useState(false);
  const isViewed = !!message.viewedAt;

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      if (contentRef.current) {
        const el = contentRef.current;
        const isScrollable = el.scrollHeight > el.clientHeight;
        if (isScrollable) {
          setScrollActive(true);
        }
      }
    }, HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setScrollActive(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!scrollActive || !contentRef.current) return;

      const el = contentRef.current;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop === 0;
      const atBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

      if ((e.deltaY > 0 && atBottom) || (e.deltaY < 0 && atTop)) {
        return;
      }

      e.stopPropagation();
      el.scrollTop += e.deltaY;
    },
    [scrollActive]
  );

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:z-10 relative flex flex-col h-full overflow-hidden",
        !isViewed && "outline outline-2 outline-primary/30 bg-primary/5"
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      {/* Header with gradient like the modal */}
      <div
        className={cn(
          "px-4 py-3 border-b shrink-0",
          !isViewed
            ? "bg-gradient-to-r from-primary/15 via-primary/10 to-background"
            : "bg-gradient-to-r from-muted/50 via-muted/30 to-background"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-semibold text-base truncate",
                !isViewed && "text-primary"
              )}
            >
              {message.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {message.publishedAt
                ? formatDistanceToNow(new Date(message.publishedAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : ""}
            </span>
          </div>
          {!isViewed && (
            <Badge variant="default" className="text-xs shrink-0">
              Novo
            </Badge>
          )}
        </div>
      </div>

      {/* Content preview */}
      <CardContent className="p-4 flex-1 min-h-0">
        <div
          ref={contentRef}
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground h-full",
            scrollActive
              ? "overflow-y-auto overscroll-contain"
              : "overflow-hidden"
          )}
        >
          <MessageBlockRenderer
            blocks={transformMessageContent(message.content)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface RecentMessagesListProps {
  messages: HomeDashboardMessage[];
  unreadCount?: number;
}

export function RecentMessagesList({ messages, unreadCount }: RecentMessagesListProps) {
  const [selectedMessage, setSelectedMessage] = useState<HomeDashboardMessage | null>(null);
  const { mutate: markAsViewed } = useMarkAsViewed();

  const handleMessageClick = useCallback(
    (message: HomeDashboardMessage) => {
      if (!message.viewedAt) {
        markAsViewed(message.id);
      }
      setSelectedMessage(message);
    },
    [markAsViewed],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <IconMessage className="h-4 w-4 text-indigo-500" />
        <h3 className="text-base font-semibold text-secondary-foreground">Mensagens Recentes</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" style={{ height: 220 }}>
        {messages.map((message) => (
          <MessagePreviewCard
            key={message.id}
            message={message}
            onClick={() => handleMessageClick(message)}
          />
        ))}
      </div>

      {/* Message Modal */}
      {selectedMessage && (
        <MessageModal
          open={!!selectedMessage}
          onOpenChange={(open) => !open && setSelectedMessage(null)}
          messages={[selectedMessage as any]}
          currentIndex={0}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}
