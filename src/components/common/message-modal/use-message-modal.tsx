import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageService } from "@/api-client/message";
import type { Message } from "@/types/message";
import { useAuth } from "@/contexts/auth-context";
import { useMarkAsViewed, useDismissMessage } from "@/hooks/useMessage";

const messageService = new MessageService();

export interface UseMessageModalOptions {
  autoShow?: boolean;
  showOnMount?: boolean;
  checkInterval?: number;
  onMessageViewed?: (messageId: string) => void;
  onMessageDismissedForToday?: (messageId: string) => void;
}

export interface UseMessageModalReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: Message[];
  unviewedMessages: Message[];
  isLoading: boolean;
  error: Error | null;
  dismissForToday: (messageId: string) => void;
  dontShowAgain: (messageId: string) => void;
  refetch: () => void;
}

// Storage key for daily dismissed messages
const DAILY_DISMISSED_KEY = "message_modal_daily_dismissed";

// Get today's date as YYYY-MM-DD
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Get daily dismissed messages from localStorage
function getDailyDismissed(): Record<string, string> {
  try {
    const stored = localStorage.getItem(DAILY_DISMISSED_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("[MessageModal] Failed to parse daily dismissed:", error);
  }
  return {};
}

// Save daily dismissed messages to localStorage
function saveDailyDismissed(dismissed: Record<string, string>): void {
  try {
    localStorage.setItem(DAILY_DISMISSED_KEY, JSON.stringify(dismissed));
  } catch (error) {
    console.error("[MessageModal] Failed to save daily dismissed:", error);
  }
}

// Check if a message was dismissed today
function isDismissedToday(messageId: string, dismissed: Record<string, string>): boolean {
  const dismissedDate = dismissed[messageId];
  if (!dismissedDate) return false;
  return dismissedDate === getTodayDate();
}

// Clean up old dismissed entries (from previous days)
function cleanupOldDismissals(dismissed: Record<string, string>): Record<string, string> {
  const today = getTodayDate();
  const cleaned: Record<string, string> = {};

  for (const [messageId, date] of Object.entries(dismissed)) {
    if (date === today) {
      cleaned[messageId] = date;
    }
  }

  return cleaned;
}

export function useMessageModal(options: UseMessageModalOptions = {}): UseMessageModalReturn {
  const {
    autoShow = true,
    showOnMount = true,
    checkInterval = 60000, // Check every minute
    onMessageViewed,
    onMessageDismissedForToday,
  } = options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [dailyDismissed, setDailyDismissed] = React.useState<Record<string, string>>({});
  const hasShownOnMount = React.useRef(false);
  const lastMessageCount = React.useRef(0);
  const trackedViews = React.useRef<Set<string>>(new Set());

  // Hooks for tracking views and dismissals
  const markAsViewedMutation = useMarkAsViewed();
  const dismissMessageMutation = useDismissMessage();

  // Load and cleanup daily dismissed messages from localStorage on mount
  React.useEffect(() => {
    const stored = getDailyDismissed();
    const cleaned = cleanupOldDismissals(stored);
    setDailyDismissed(cleaned);

    // Save cleaned version back
    if (Object.keys(stored).length !== Object.keys(cleaned).length) {
      saveDailyDismissed(cleaned);
    }
  }, []);

  // Debug: Log user state
  React.useEffect(() => {
    console.log('[MessageModal] User state changed:', { userId: user?.id, userEmail: user?.email });
  }, [user?.id]);

  // Fetch unviewed messages from API
  const {
    data: messagesData,
    isLoading,
    error,
    refetch,
    status,
  } = useQuery({
    queryKey: ["messages", "unviewed", user?.id],
    queryFn: async () => {
      console.log('[MessageModal] Fetching unviewed messages for user:', user?.id);
      if (!user?.id) {
        console.log('[MessageModal] No user ID, returning empty array');
        return [];
      }
      try {
        const messages = await messageService.getUnviewedMessages();
        console.log('[MessageModal] Received messages from API:', messages.length);
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

  const messages = Array.isArray(messagesData) ? messagesData : [];

  // Filter out messages dismissed today (but NOT permanently dismissed - those are already filtered by API)
  const unviewedMessages = React.useMemo(() => {
    return messages.filter((msg) => !isDismissedToday(msg.id, dailyDismissed));
  }, [messages, dailyDismissed]);

  // Automatically track views when messages are displayed
  React.useEffect(() => {
    if (open && unviewedMessages.length > 0) {
      // Track view for the first message (currently displayed)
      const currentMessage = unviewedMessages[0];

      // Only track once per message per session
      if (currentMessage && !trackedViews.current.has(currentMessage.id)) {
        console.log('[MessageModal] Auto-tracking view for message:', currentMessage.id);
        trackedViews.current.add(currentMessage.id);
        markAsViewedMutation.mutate(currentMessage.id);
      }
    }
  }, [open, unviewedMessages, markAsViewedMutation]);

  // Debug: Log query state
  React.useEffect(() => {
    console.log('[MessageModal] Query state:', {
      status,
      isLoading,
      hasUser: !!user?.id,
      apiMessagesCount: messages.length,
      unviewedMessagesCount: unviewedMessages.length,
      dailyDismissedCount: Object.keys(dailyDismissed).length,
    });
  }, [status, isLoading, user?.id, messages.length, unviewedMessages.length, dailyDismissed]);

  // Dismiss for today only (mark as viewed in API + store locally, will show again tomorrow)
  const dismissForToday = React.useCallback(
    (messageId: string) => {
      console.log('[MessageModal] Dismissing for today (marking as viewed):', messageId);

      // Mark as viewed in the API so it doesn't keep appearing on refresh
      // This is different from permanent dismissal - the message is just "viewed"
      if (!trackedViews.current.has(messageId)) {
        trackedViews.current.add(messageId);
        markAsViewedMutation.mutate(messageId);
      }

      const newDismissed = {
        ...dailyDismissed,
        [messageId]: getTodayDate(),
      };

      setDailyDismissed(newDismissed);
      saveDailyDismissed(newDismissed);
      onMessageDismissedForToday?.(messageId);
    },
    [dailyDismissed, onMessageDismissedForToday, markAsViewedMutation]
  );

  // Don't show again (permanent - marks as dismissed in database)
  const dontShowAgain = React.useCallback(
    (messageId: string) => {
      console.log('[MessageModal] Don\'t show again (permanent):', messageId);
      dismissMessageMutation.mutate(messageId);
      onMessageViewed?.(messageId); // Call callback for dismissed messages too
    },
    [dismissMessageMutation, onMessageViewed]
  );

  // Auto-show modal when unviewed messages are available
  React.useEffect(() => {
    console.log('[MessageModal] Auto-show check:', {
      autoShow,
      isLoading,
      showOnMount,
      hasShownOnMount: hasShownOnMount.current,
      unviewedMessagesCount: unviewedMessages.length,
      lastMessageCount: lastMessageCount.current,
    });

    if (!autoShow || isLoading) {
      return;
    }

    // Show on mount if there are unviewed messages
    if (showOnMount && !hasShownOnMount.current && unviewedMessages.length > 0) {
      console.log('[MessageModal] Opening modal on mount with', unviewedMessages.length, 'messages');
      hasShownOnMount.current = true;
      lastMessageCount.current = unviewedMessages.length;
      setOpen(true);
    }
    // Only auto-reopen if NEW messages arrived (count increased)
    else if (unviewedMessages.length > lastMessageCount.current && hasShownOnMount.current) {
      console.log('[MessageModal] Opening modal for new messages');
      lastMessageCount.current = unviewedMessages.length;
      setOpen(true);
    }
    // Update the count when messages decrease
    else if (unviewedMessages.length < lastMessageCount.current) {
      lastMessageCount.current = unviewedMessages.length;
    }
  }, [autoShow, showOnMount, unviewedMessages.length, isLoading]);

  return {
    open,
    setOpen,
    messages,
    unviewedMessages,
    isLoading,
    error: error as Error | null,
    dismissForToday,
    dontShowAgain,
    refetch,
  };
}
