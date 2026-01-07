import * as React from "react";
import { MessageModal } from "./message-modal";
import { useMessageModal } from "./use-message-modal";

export interface MessageModalProviderProps {
  children: React.ReactNode;
  autoShow?: boolean;
  showOnMount?: boolean;
  checkInterval?: number;
}

export function MessageModalProvider({
  children,
  autoShow = true,
  showOnMount = true,
  checkInterval = 60000,
}: MessageModalProviderProps) {
  const {
    open,
    setOpen,
    unviewedMessages,
    markAsRead,
    dontShowAgain,
  } = useMessageModal({
    autoShow,
    showOnMount,
    checkInterval,
  });

  return (
    <>
      {children}
      <MessageModal
        open={open}
        onOpenChange={setOpen}
        messages={unviewedMessages}
        onMarkAsRead={markAsRead}
        onDontShowAgain={dontShowAgain}
      />
    </>
  );
}
