import { useState, useCallback } from "react";
import { IconMessage } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageMiniature } from "@/components/messaging/MessageCanvas";
import { MessageModal } from "@/components/common/message-modal/message-modal";
import { useMarkAsViewed } from "@/hooks/administration/use-message";
import type { HomeDashboardMessage } from "../../types";

function MessagePreviewCard({
  message,
  onClick,
}: {
  message: HomeDashboardMessage;
  onClick: () => void;
}) {
  const isViewed = !!message.viewedAt;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:z-10 relative flex flex-col h-full overflow-hidden",
        !isViewed && "outline outline-2 outline-primary/30 bg-primary/5"
      )}
      onClick={onClick}
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

      {/* Content preview — true scaled miniature (375px reference render) */}
      <CardContent className="p-0 flex-1 min-h-0">
        <MessageMiniature content={message.content} className="h-full w-full" />
      </CardContent>
    </Card>
  );
}

interface RecentMessagesListProps {
  messages: HomeDashboardMessage[];
  unreadCount?: number;
  /**
   * When true, omit the outer heading and let the grid fill available height.
   * Used when rendering inside a dashboard widget that supplies its own header.
   */
  embedded?: boolean;
  /**
   * In embedded mode, override the responsive column count with a fixed
   * number of columns. Lets dashboard widgets expose a user-controlled
   * "messages per row" config.
   */
  columns?: number;
  /**
   * In embedded mode, lock visible rows to this number (cards split the
   * widget body height equally). Items beyond columns*rows scroll-overflow.
   */
  rows?: number;
}

const GRID_GAP_PX = 12; // gap-3

export function RecentMessagesList({
  messages,
  embedded,
  columns,
  rows,
}: RecentMessagesListProps) {
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

  const usingFixedColumns = embedded && typeof columns === "number" && columns > 0;
  const usingFixedRows = embedded && typeof rows === "number" && rows > 0;
  const fixedCols = Math.max(1, Math.min(10, columns ?? 4));
  const fixedRows = Math.max(1, Math.min(6, rows ?? 2));
  const rowHeight = usingFixedRows
    ? `calc((100% - ${(fixedRows - 1) * GRID_GAP_PX}px) / ${fixedRows})`
    : undefined;
  const gridStyle: React.CSSProperties | undefined = usingFixedColumns
    ? {
        gridTemplateColumns: `repeat(${fixedCols}, minmax(0, 1fr))`,
        ...(usingFixedRows
          ? {
              gridTemplateRows: `repeat(${fixedRows}, ${rowHeight})`,
              gridAutoRows: rowHeight,
            }
          : {}),
      }
    : embedded
    ? undefined
    : { height: 220 };
  const grid = (
    <div
      className={cn(
        "grid gap-3",
        usingFixedColumns ? "" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        embedded ? "flex-1 min-h-0 p-3" : "",
        usingFixedRows ? "h-full" : "",
      )}
      style={gridStyle}
    >
      {messages.map((message) => (
        <MessagePreviewCard
          key={message.id}
          message={message}
          onClick={() => handleMessageClick(message)}
        />
      ))}
    </div>
  );

  return embedded ? (
    <>
      {grid}
      {selectedMessage && (
        <MessageModal
          open={!!selectedMessage}
          onOpenChange={(open) => !open && setSelectedMessage(null)}
          messages={[selectedMessage as any]}
          currentIndex={0}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </>
  ) : (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <IconMessage className="h-4 w-4 text-indigo-500" />
        <h3 className="text-base font-semibold text-secondary-foreground">Mensagens Recentes</h3>
      </div>
      {grid}

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
