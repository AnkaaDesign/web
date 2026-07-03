import * as React from "react";
import { X, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";
import { MessageCanvas } from "@/components/messaging/MessageCanvas";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  currentIndex?: number;
  /**
   * Called once per open cycle when the modal is closed via X, Escape or
   * outside click - receives ALL queued message ids (dismiss for today only)
   */
  onClose?: (messageIds: string[]) => void;
  /** Called when user clicks "Não mostrar novamente" - permanent dismiss */
  onDontShowAgain?: (messageId: string) => void;
  /** Called whenever a message becomes the displayed one (open / navigation) */
  onMessageDisplayed?: (messageId: string) => void;
}

export function MessageModal({
  open,
  onOpenChange,
  messages = [],
  currentIndex: initialIndex = 0,
  onClose,
  onDontShowAgain,
  onMessageDisplayed,
}: MessageModalProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [isClosing, setIsClosing] = React.useState(false);
  // Guards against double-firing of the close flow (e.g. X button click also
  // triggering Radix onOpenChange, or Escape hitting both our keydown handler
  // and Radix's). Reset on every open cycle.
  const closeHandledRef = React.useRef(false);

  const currentMessage = messages[currentIndex];
  const hasMultipleMessages = messages.length > 1;
  const isFirstMessage = currentIndex === 0;
  const isLastMessage = currentIndex === messages.length - 1;

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsClosing(false);
      closeHandledRef.current = false;
    }
  }, [open, initialIndex]);

  // Notify whenever a message is actually displayed (on open and on navigation)
  const currentMessageId = currentMessage?.id;
  React.useEffect(() => {
    if (open && currentMessageId) {
      onMessageDisplayed?.(currentMessageId);
    }
  }, [open, currentMessageId, onMessageDisplayed]);

  // Unified close path (X button, Escape, outside click / onOpenChange(false)):
  // snooze ALL queued messages for today. Idempotent per open cycle.
  const handleClose = React.useCallback(() => {
    if (!closeHandledRef.current) {
      closeHandledRef.current = true;
      if (messages.length > 0) {
        onClose?.(messages.map((message) => message.id));
      }
    }
    onOpenChange(false);
  }, [messages, onClose, onOpenChange]);

  // Route Radix-initiated closes (outside click, Escape) through handleClose
  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
      } else {
        handleClose();
      }
    },
    [handleClose, onOpenChange]
  );

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
  }, [open, hasMultipleMessages, isFirstMessage, isLastMessage, handleClose]);

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
        // Close the modal after a short delay. This is a permanent dismiss of
        // the only remaining message, so skip the snooze-on-close flow.
        setTimeout(() => {
          closeHandledRef.current = true;
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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

        {/* Body — shared canvas owns padding so decorators can bleed edge-to-edge;
            flex + flex-1 stretch the canvas so a trailing footer decorator sticks
            to the bottom even for short messages. */}
        <div className="pt-2 min-h-[200px] max-h-[60vh] overflow-y-auto flex flex-col">
          <MessageCanvas content={currentMessage.content} className="flex-1" />
        </div>

        {/* Footer — hidden when it would render empty */}
        {(hasMultipleMessages || onDontShowAgain) && (
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
        )}

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
