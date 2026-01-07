import * as React from "react";
import { X, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";
import { MessageBlockRenderer } from "@/components/messaging/MessageBlockRenderer";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  currentIndex?: number;
  onMarkAsRead?: (messageId: string) => void;
  onDontShowAgain?: (messageId: string) => void;
  onClose?: () => void;
}

export function MessageModal({
  open,
  onOpenChange,
  messages = [],
  currentIndex: initialIndex = 0,
  onMarkAsRead,
  onDontShowAgain,
  onClose,
}: MessageModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  const currentMessage = messages[currentIndex];
  const hasMultipleMessages = messages.length > 1;
  const isFirstMessage = currentIndex === 0;
  const isLastMessage = currentIndex === messages.length - 1;

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setDontShowAgain(false);
      setIsClosing(false);
    }
  }, [open, initialIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          if (hasMultipleMessages && !isFirstMessage) {
            event.preventDefault();
            handlePrevious();
          }
          break;
        case "ArrowRight":
          if (hasMultipleMessages && !isLastMessage) {
            event.preventDefault();
            handleNext();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, hasMultipleMessages, isFirstMessage, isLastMessage]);

  const handlePrevious = () => {
    if (!isFirstMessage) {
      setCurrentIndex((prev) => prev - 1);
      setDontShowAgain(false);
    }
  };

  const handleNext = () => {
    if (!isLastMessage) {
      setCurrentIndex((prev) => prev + 1);
      setDontShowAgain(false);
    }
  };

  const handleMarkAsRead = () => {
    if (currentMessage && onMarkAsRead) {
      setIsClosing(true);
      onMarkAsRead(currentMessage.id);

      // If there are more messages, move to the next one
      if (hasMultipleMessages && !isLastMessage) {
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setDontShowAgain(false);
          setIsClosing(false);
        }, 300);
      } else {
        // Close the modal after a short delay
        setTimeout(() => {
          handleClose();
        }, 300);
      }
    }
  };

  const handleClose = () => {
    if (dontShowAgain && currentMessage && onDontShowAgain) {
      onDontShowAgain(currentMessage.id);
    } else if (currentMessage && onMarkAsRead) {
      // If user closes without "don't show again", mark as read so it doesn't reappear
      onMarkAsRead(currentMessage.id);
    }
    onOpenChange(false);
    onClose?.();
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
      case "HIGH":
        return (
          <Badge variant="destructive" className="text-xs">
            Alta Prioridade
          </Badge>
        );
      case "NORMAL":
        return (
          <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            Normal
          </Badge>
        );
      case "LOW":
        return (
          <Badge variant="secondary" className="text-xs">
            Baixa Prioridade
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      DRAFT: { label: "Rascunho", variant: "secondary" },
      SCHEDULED: { label: "Agendada", variant: "outline" },
      ACTIVE: { label: "Ativa", variant: "default" },
      EXPIRED: { label: "Expirada", variant: "secondary" },
      ARCHIVED: { label: "Arquivada", variant: "secondary" },
    };
    const statusInfo = statusLabels[status] || { label: status, variant: "outline" as const };
    return (
      <Badge variant={statusInfo.variant} className="text-xs">
        {statusInfo.label}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });
  };

  if (!currentMessage) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 transition-all duration-300" />
      <DialogContent
        className={cn(
          "max-w-2xl w-full p-0 gap-0 overflow-hidden border-0 shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]",
          "transition-all duration-300",
          isClosing && "animate-out fade-out-0 zoom-out-95 slide-out-to-top-[48%]"
        )}
        aria-describedby="message-modal-description"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground leading-tight">
                  {currentMessage.title}
                </h2>
                {getPriorityBadge(currentMessage.priority)}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {getStatusBadge(currentMessage.status)}
                {currentMessage.publishedAt && (
                  <span className="text-xs">
                    {formatDate(currentMessage.publishedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress indicator for multiple messages */}
          {hasMultipleMessages && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${((currentIndex + 1) / messages.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {currentIndex + 1} de {messages.length}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-6 min-h-[200px] max-h-[60vh] overflow-y-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MessageBlockRenderer blocks={currentMessage.content?.blocks || []} />
          </div>

          {/* Action URL if available */}
          {currentMessage.actionUrl && currentMessage.actionType !== 'EXTERNAL_LINK' && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50">
              <a
                href={currentMessage.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline flex items-center gap-2"
              >
                {currentMessage.actionType || "Saiba mais"}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/20 px-6 py-4 space-y-4">
          {/* Don't show again option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label
              htmlFor="dont-show-again"
              className="text-sm text-muted-foreground cursor-pointer select-none flex items-center gap-2"
            >
              {dontShowAgain ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Não mostrar esta mensagem novamente
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3">
            {/* Navigation buttons */}
            {hasMultipleMessages && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={isFirstMessage}
                  className="gap-1"
                  title="Mensagem anterior (←)"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={isLastMessage}
                  className="gap-1"
                  title="Próxima mensagem (→)"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Mark as read button */}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Fechar
              </Button>
              {onMarkAsRead && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleMarkAsRead}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Marcar como lida
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Screen reader description */}
        <div id="message-modal-description" className="sr-only">
          Modal de mensagem do sistema. Use as setas esquerda e direita para navegar entre
          mensagens, ESC para fechar.
        </div>
      </DialogContent>
    </Dialog>
  );
}
