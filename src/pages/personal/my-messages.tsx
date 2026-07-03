import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES } from "@/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { messageService } from "@/api-client/message";
import { MessageModal } from "@/components/common/message-modal/message-modal";
import { MessageMiniature } from "@/components/messaging/MessageCanvas";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { IconInbox } from "@tabler/icons-react";
import type { Message } from "@/types/message";

type MessageWithViewStatus = Message & { viewedAt?: Date | null; dismissedAt?: Date | null };

/** Cap on the card preview height; longer messages clip with a bottom fade. */
const CARD_PREVIEW_MAX_HEIGHT = 340;

const MessagePreviewCard = ({
  message,
  onClick,
}: {
  message: MessageWithViewStatus;
  onClick: () => void;
}) => {
  const isViewed = !!message.viewedAt;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:z-10 relative flex flex-col overflow-hidden",
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
                ? formatDistanceToNow(
                    typeof message.publishedAt === "string"
                      ? new Date(message.publishedAt)
                      : message.publishedAt,
                    { addSuffix: true, locale: ptBR }
                  )
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

      {/* Content preview — full-width scaled miniature of the whole message */}
      <CardContent className="p-0">
        <MessageMiniature content={message.content} mode="width" maxBodyHeight={CARD_PREVIEW_MAX_HEIGHT} className="w-full" />
      </CardContent>
    </Card>
  );
};

export const MyMessagesPage = () => {
  const { user } = useAuth();
  const [selectedMessage, setSelectedMessage] = useState<MessageWithViewStatus | null>(null);

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["my-messages"],
    queryFn: () => messageService.getMyMessages(),
    enabled: !!user,
  });

  const handleCardClick = (message: MessageWithViewStatus) => {
    setSelectedMessage(message);
  };

  const handleModalClose = () => {
    setSelectedMessage(null);
  };

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Minhas Mensagens" subtitle="Mensagens e comunicados do sistema" favoritePage={FAVORITE_PAGES.PESSOAL_MENSAGENS_LISTAR} />
        <Card className="mt-6">
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">Faça login para ver suas mensagens</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        favoritePage={FAVORITE_PAGES.PESSOAL_MENSAGENS_LISTAR}
        title="Minhas Mensagens"
        subtitle="Mensagens e comunicados do sistema"
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start px-1">
            {Array.from({ length: 8 }).map((_, j) => (
              <Card key={j} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-destructive text-center">Erro ao carregar mensagens</p>
            </CardContent>
          </Card>
        ) : !messages || messages.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center gap-4">
                <div className="rounded-full bg-muted p-4">
                  <IconInbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Nenhuma mensagem</h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Você não possui mensagens no momento. Quando houver comunicados ou avisos importantes, eles aparecerão aqui.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start px-1">
            {messages.map((message) => (
              <MessagePreviewCard
                key={message.id}
                message={message}
                onClick={() => handleCardClick(message)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Message Modal */}
      {selectedMessage && (
        <MessageModal
          open={!!selectedMessage}
          onOpenChange={(open) => !open && handleModalClose()}
          messages={[selectedMessage]}
          currentIndex={0}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default MyMessagesPage;
