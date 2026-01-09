import * as React from "react";
import { X, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";
import { MessageBlockRenderer } from "@/components/messaging/MessageBlockRenderer";
import { transformMessageContent } from "@/utils/message-transformer";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  currentIndex?: number;
  /** Called when user clicks close (X) - dismiss for today only */
  onClose?: (messageId: string) => void;
  /** Called when user clicks "Não mostrar novamente" - permanent dismiss */
  onDontShowAgain?: (messageId: string) => void;
}

export function MessageModal({
  open,
  onOpenChange,
  messages = [],
  currentIndex: initialIndex = 0,
  onClose,
  onDontShowAgain,
}: MessageModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [isClosing, setIsClosing] = React.useState(false);

  const currentMessage = messages[currentIndex];
  const hasMultipleMessages = messages.length > 1;
  const isFirstMessage = currentIndex === 0;
  const isLastMessage = currentIndex === messages.length - 1;

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
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
    }
  };

  const handleNext = () => {
    if (!isLastMessage) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Close button - dismiss for today only
  const handleClose = () => {
    if (currentMessage) {
      onClose?.(currentMessage.id);
    }
    onOpenChange(false);
  };

  // Don't show again - permanent dismiss
  const handleDontShowAgain = () => {
    if (currentMessage && onDontShowAgain) {
      setIsClosing(true);
      onDontShowAgain(currentMessage.id);

      // If there are more messages, move to the next one
      if (hasMultipleMessages && !isLastMessage) {
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setIsClosing(false);
        }, 300);
      } else if (hasMultipleMessages && isLastMessage) {
        // If we're at the last message, go to previous
        setTimeout(() => {
          setCurrentIndex((prev) => Math.max(0, prev - 1));
          setIsClosing(false);
        }, 300);
      } else {
        // Close the modal after a short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 300);
      }
    }
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
        hideClose
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
              <h2 className="text-xl font-semibold text-foreground leading-tight">
                {currentMessage.title}
              </h2>
              {currentMessage.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(currentMessage.publishedAt)}
                </span>
              )}
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full"
              title="Fechar (mostrará novamente amanhã)"
            >
              <X className="h-4 w-4" />
            </Button>
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
        <div className="px-6 pb-6 pt-2 min-h-[200px] max-h-[60vh] overflow-y-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <MessageBlockRenderer
              blocks={transformMessageContent(currentMessage.content)}
            />
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
        <div className="border-t bg-muted/20 px-6 py-4">
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

            {/* Action button */}
            <div className="flex items-center gap-2 ml-auto">
              {onDontShowAgain && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDontShowAgain}
                  className="gap-2"
                >
                  <EyeOff className="h-4 w-4" />
                  Não mostrar novamente
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Screen reader description */}
        <div id="message-modal-description" className="sr-only">
          Modal de mensagem do sistema. Use as setas esquerda e direita para navegar entre
          mensagens, ESC para fechar. A mensagem será exibida novamente amanhã ao fechar.
          Clique em &quot;Não mostrar novamente&quot; para ocultar permanentemente.
        </div>
      </DialogContent>
    </Dialog>
  );
}
