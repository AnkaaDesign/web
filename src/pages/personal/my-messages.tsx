import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { messageService } from "@/api-client/message";
import { MessageModal } from "@/components/common/message-modal/message-modal";
import { MessageBlockRenderer } from "@/components/messaging/MessageBlockRenderer";
import { transformMessageContent } from "@/utils/message-transformer";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { IconInbox } from "@tabler/icons-react";
import type { Message } from "@/types/message";

type MessageWithViewStatus = Message & { viewedAt?: Date | null; dismissedAt?: Date | null };

export const MyMessagesPage = () => {
  const { user } = useAuth();
  const [selectedMessage, setSelectedMessage] = useState<MessageWithViewStatus | null>(null);

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["my-messages"],
    queryFn: () => messageService.getMyMessages(),
    enabled: !!user,
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });
  };

  const handleCardClick = (message: MessageWithViewStatus) => {
    setSelectedMessage(message);
  };

  const handleModalClose = () => {
    setSelectedMessage(null);
  };

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Minhas Mensagens" subtitle="Mensagens e comunicados do sistema" />
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
        title="Minhas Mensagens"
        subtitle="Mensagens e comunicados do sistema"
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {messages.map((message: MessageWithViewStatus) => {
              const isViewed = !!message.viewedAt;

              return (
                <Card
                  key={message.id}
                  className={cn(
                    "overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
                    !isViewed && "ring-2 ring-primary/30 bg-primary/5"
                  )}
                  onClick={() => handleCardClick(message)}
                >
                  {/* Header with gradient like the modal */}
                  <div className={cn(
                    "px-4 py-3 border-b",
                    !isViewed
                      ? "bg-gradient-to-r from-primary/15 via-primary/10 to-background"
                      : "bg-gradient-to-r from-muted/50 via-muted/30 to-background"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-semibold text-base truncate",
                          !isViewed && "text-primary"
                        )}>
                          {message.title}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(message.publishedAt)}
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
                  <CardContent className="p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-4 overflow-hidden text-sm text-muted-foreground">
                      <MessageBlockRenderer
                        blocks={transformMessageContent(message.content)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
