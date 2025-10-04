import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UseRefetchOnFocusOptions {
  /**
   * Enable or disable the refetch on focus behavior
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum time in milliseconds between refetches
   * Prevents too frequent refetching
   * @default 5000 (5 seconds)
   */
  refetchInterval?: number;

  /**
   * Query keys to refetch when the window gains focus
   * If not provided, all queries will be refetched
   */
  queryKeys?: unknown[][];

  /**
   * Whether to refetch when the tab becomes visible
   * @default true
   */
  refetchOnVisibilityChange?: boolean;

  /**
   * Whether to refetch when the window gains focus
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Custom refetch function to call
   * If not provided, will use queryClient.invalidateQueries
   */
  onRefetch?: () => void | Promise<void>;
}

/**
 * Custom hook that refetches queries when the window regains focus or visibility
 * Useful for keeping data fresh when users switch between tabs or windows
 */
export function useRefetchOnFocus(options: UseRefetchOnFocusOptions = {}) {
  const { enabled = true, refetchInterval = 5000, queryKeys, refetchOnVisibilityChange = true, refetchOnWindowFocus = true, onRefetch } = options;

  const queryClient = useQueryClient();
  const lastRefetchTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleRefetch = async () => {
      const now = Date.now();
      const timeSinceLastRefetch = now - lastRefetchTimeRef.current;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Check if enough time has passed since the last refetch
      if (timeSinceLastRefetch < refetchInterval) {
        // Schedule a refetch for when the interval has passed
        const remainingTime = refetchInterval - timeSinceLastRefetch;
        timeoutRef.current = setTimeout(() => {
          handleRefetch();
        }, remainingTime);
        return;
      }

      // Update the last refetch time
      lastRefetchTimeRef.current = now;

      // Perform the refetch
      if (onRefetch) {
        await onRefetch();
      } else if (queryKeys && queryKeys.length > 0) {
        // Refetch specific queries
        await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      } else {
        // Refetch all queries
        await queryClient.invalidateQueries();
      }
    };

    const handleWindowFocus = () => {
      if (refetchOnWindowFocus) {
        handleRefetch();
      }
    };

    const handleVisibilityChange = () => {
      if (refetchOnVisibilityChange && !document.hidden) {
        handleRefetch();
      }
    };

    // Add event listeners
    if (refetchOnWindowFocus) {
      window.addEventListener("focus", handleWindowFocus);
    }

    if (refetchOnVisibilityChange) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Cleanup function
    return () => {
      // Remove event listeners
      if (refetchOnWindowFocus) {
        window.removeEventListener("focus", handleWindowFocus);
      }

      if (refetchOnVisibilityChange) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }

      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, refetchInterval, queryKeys, refetchOnVisibilityChange, refetchOnWindowFocus, onRefetch, queryClient]);

  // Return a manual refetch function that respects the interval
  const refetch = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastRefetch = now - lastRefetchTimeRef.current;

    if (timeSinceLastRefetch >= refetchInterval) {
      lastRefetchTimeRef.current = now;

      if (onRefetch) {
        await onRefetch();
      } else if (queryKeys && queryKeys.length > 0) {
        await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      } else {
        await queryClient.invalidateQueries();
      }
    }
  }, [refetchInterval, onRefetch, queryKeys, queryClient]);

  return { refetch };
}

/**
 * Example usage:
 *
 * // Refetch all queries on focus
 * useRefetchOnFocus();
 *
 * // Refetch specific queries with custom interval
 * useRefetchOnFocus({
 *   queryKeys: [['users'], ['posts']],
 *   refetchInterval: 10000, // 10 seconds
 * });
 *
 * // Custom refetch logic
 * useRefetchOnFocus({
 *   onRefetch: async () => {
 *     await queryClient.invalidateQueries({ queryKey: ['critical-data'] });
 **   },
 * });
 *
 * // Disable visibility change refetch
 * useRefetchOnFocus({
 *   refetchOnVisibilityChange: false,
 *   refetchOnWindowFocus: true,
 * });
 */
