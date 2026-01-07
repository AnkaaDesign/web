import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageService } from "@/api-client/message";
import type { Message } from "@/types/message";
import { useAuth } from "@/contexts/auth-context";

const messageService = new MessageService();

export interface UseMessageModalOptions {
  autoShow?: boolean;
  showOnMount?: boolean;
  checkInterval?: number;
  onMessageRead?: (messageId: string) => void;
  onMessageDismissed?: (messageId: string) => void;
}

export interface UseMessageModalReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: Message[];
  unviewedMessages: Message[];
  isLoading: boolean;
  error: Error | null;
  markAsRead: (messageId: string) => void;
  markAllAsRead: () => void;
  dontShowAgain: (messageId: string) => void;
  refetch: () => void;
}

const DISMISSED_MESSAGES_KEY = "dismissedMessages";

export function useMessageModal(options: UseMessageModalOptions = {}): UseMessageModalReturn {
  const {
    autoShow = true,
    showOnMount = true,
    checkInterval = 60000, // Check every minute
    onMessageRead,
    onMessageDismissed,
  } = options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [dismissedMessages, setDismissedMessages] = React.useState<string[]>([]);
  const hasShownOnMount = React.useRef(false);

  // Debug: Log user state
  React.useEffect(() => {
    console.log('[MessageModal] User state changed:', { userId: user?.id, userEmail: user?.email });
  }, [user?.id]);

  // Load dismissed messages from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_MESSAGES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDismissedMessages(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error("Failed to parse dismissed messages:", error);
      }
    }
  }, []);

  // Fetch unviewed messages
  const {
    data: messagesData,
    isLoading,
    error,
    refetch,
    isFetching,
    status,
  } = useQuery({
    queryKey: ["messages", "unviewed", user?.id],
    queryFn: async () => {
      console.log('[MessageModal] ===== QUERY FN EXECUTING =====');
      console.log('[MessageModal] Fetching unviewed messages for user:', user?.id);
      if (!user?.id) {
        console.log('[MessageModal] No user ID, returning empty array');
        return [];
      }
      try {
        const messages = await messageService.getUnviewedMessages();
        console.log('[MessageModal] Received messages:', messages);
        return messages;
      } catch (error) {
        console.error('[MessageModal] Failed to fetch unviewed messages:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    refetchInterval: checkInterval,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // Debug: Log query state changes
  React.useEffect(() => {
    console.log('[MessageModal] Query state:', {
      status,
      isLoading,
      isFetching,
      hasUser: !!user?.id,
      enabled: !!user?.id,
      dataLength: Array.isArray(messagesData) ? messagesData.length : 'not-array'
    });
  }, [status, isLoading, isFetching, user?.id, messagesData]);

  // Force refetch when user becomes available
  React.useEffect(() => {
    if (user?.id) {
      console.log('[MessageModal] User available, forcing refetch');
      refetch();
    }
  }, [user?.id, refetch]);

  const messages = Array.isArray(messagesData) ? messagesData : [];

  // Filter out dismissed messages
  const unviewedMessages = React.useMemo(() => {
    return messages.filter((msg) => !dismissedMessages.includes(msg.id));
  }, [messages, dismissedMessages]);

  // Mark as viewed mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      try {
        return await messageService.markAsViewed(messageId);
      } catch (error) {
        console.error('Failed to mark message as viewed:', error);
        throw error;
      }
    },
    onSuccess: (_, messageId) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      onMessageRead?.(messageId);
    },
  });

  // Mark all as read mutation (not implemented in MessageService yet)
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      // Mark all unviewed messages as viewed
      const promises = unviewedMessages.map(msg => messageService.markAsViewed(msg.id));
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setOpen(false);
    },
  });

  // Mark as read handler
  const markAsRead = React.useCallback(
    (messageId: string) => {
      markAsReadMutation.mutate(messageId);
    },
    [markAsReadMutation]
  );

  // Mark all as read handler
  const markAllAsRead = React.useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  // Don't show again handler
  const dontShowAgain = React.useCallback(
    (messageId: string) => {
      const updated = [...dismissedMessages, messageId];
      setDismissedMessages(updated);
      localStorage.setItem(DISMISSED_MESSAGES_KEY, JSON.stringify(updated));
      onMessageDismissed?.(messageId);

      // Also mark as read
      markAsRead(messageId);
    },
    [dismissedMessages, markAsRead, onMessageDismissed]
  );

  // Auto-show modal when unviewed messages are available
  React.useEffect(() => {
    console.log('[MessageModal] Auto-show check:', {
      autoShow,
      isLoading,
      showOnMount,
      hasShownOnMount: hasShownOnMount.current,
      unviewedMessagesCount: unviewedMessages.length,
      open
    });

    if (!autoShow || isLoading) {
      console.log('[MessageModal] Skipping auto-show: autoShow=', autoShow, 'isLoading=', isLoading);
      return;
    }

    if (showOnMount && !hasShownOnMount.current && unviewedMessages.length > 0) {
      console.log('[MessageModal] Opening modal on mount with', unviewedMessages.length, 'messages');
      hasShownOnMount.current = true;
      setOpen(true);
    } else if (unviewedMessages.length > 0 && !open && hasShownOnMount.current) {
      // Show modal for new messages that arrive after mount
      console.log('[MessageModal] Opening modal for new messages');
      setOpen(true);
    }
  }, [autoShow, showOnMount, unviewedMessages.length, open, isLoading]);

  return {
    open,
    setOpen,
    messages,
    unviewedMessages,
    isLoading,
    error: error as Error | null,
    markAsRead,
    markAllAsRead,
    dontShowAgain,
    refetch,
  };
}
