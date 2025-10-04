import { useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useInfiniteQuery, useQueryClient, QueryKey, UseQueryOptions, UseInfiniteQueryOptions, QueryFunction, InfiniteQueryFunction } from "@tanstack/react-query";

// =====================================================
// Types & Interfaces
// =====================================================

interface CancelableQueryOptions {
  queryKey: QueryKey;
  enabled?: boolean;
  cancelOnParamsChange?: boolean;
  cancelOnUnmount?: boolean;
  deduplicationWindow?: number;
}

interface QueryRequestInfo {
  requestId: string;
  timestamp: number;
  abortController: AbortController;
  queryKeyHash: string;
}

interface UseQueryWithCancellationOptions<TData, TError, TQueryKey extends QueryKey = QueryKey> extends Omit<UseQueryOptions<TData, TError, TData, TQueryKey>, "queryFn"> {
  cancelOnParamsChange?: boolean;
  cancelOnUnmount?: boolean;
  deduplicationWindow?: number;
  enablePrefetch?: boolean;
  prefetchStaleTime?: number;
}

interface UseInfiniteQueryWithCancellationOptions<TData, TError, TQueryKey extends QueryKey = QueryKey>
  extends Omit<UseInfiniteQueryOptions<TData, TError, TData, TQueryKey>, "queryFn"> {
  cancelOnParamsChange?: boolean;
  cancelOnUnmount?: boolean;
  deduplicationWindow?: number;
}

// =====================================================
// Core Cancellable Query Hook
// =====================================================

/**
 * Advanced hook for managing cancellable queries with comprehensive features:
 * - Request cancellation on parameter changes
 * - Race condition prevention
 * - Request deduplication
 * - Comprehensive error handling
 * - Loading state management
 */
export function useCancelableQuery({
  queryKey,
  enabled = true,
  cancelOnParamsChange = true,
  cancelOnUnmount = true,
  deduplicationWindow = 50, // ms
}: CancelableQueryOptions) {
  const queryClient = useQueryClient();

  // Request tracking
  const activeRequestsRef = useRef<Map<string, QueryRequestInfo>>(new Map());
  const lastRequestRef = useRef<QueryRequestInfo | null>(null);

  // Create stable query key hash for comparison
  const queryKeyHash = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Cleanup function for aborting requests
  const cleanupRequest = useCallback((requestInfo: QueryRequestInfo, reason: string) => {
    try {
      if (!requestInfo.abortController.signal.aborted) {
        requestInfo.abortController.abort(reason);
      }
      activeRequestsRef.current.delete(requestInfo.requestId);
    } catch (error) {
      console.warn("Error cleaning up request:", error);
    }
  }, []);

  // Cancel previous requests when parameters change
  useEffect(() => {
    if (!enabled || !cancelOnParamsChange) return;

    const currentRequests = Array.from(activeRequestsRef.current.values());

    // Cancel requests with different query key hash
    currentRequests.forEach((requestInfo) => {
      if (requestInfo.queryKeyHash !== queryKeyHash) {
        cleanupRequest(requestInfo, "Query parameters changed");
      }
    });
  }, [queryKeyHash, enabled, cancelOnParamsChange, cleanupRequest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelOnUnmount) {
        const currentRequests = Array.from(activeRequestsRef.current.values());
        currentRequests.forEach((requestInfo) => {
          cleanupRequest(requestInfo, "Component unmounted");
        });
      }
    };
  }, [cancelOnUnmount, cleanupRequest]);

  // Create abort controller for new request
  const createRequest = useCallback(() => {
    const requestId = generateRequestId();
    const abortController = new AbortController();
    const timestamp = Date.now();

    const requestInfo: QueryRequestInfo = {
      requestId,
      timestamp,
      abortController,
      queryKeyHash,
    };

    // Check for request deduplication
    if (deduplicationWindow > 0 && lastRequestRef.current) {
      const timeDiff = timestamp - lastRequestRef.current.timestamp;
      if (timeDiff < deduplicationWindow && lastRequestRef.current.queryKeyHash === queryKeyHash && !lastRequestRef.current.abortController.signal.aborted) {
        return lastRequestRef.current;
      }
    }

    activeRequestsRef.current.set(requestId, requestInfo);
    lastRequestRef.current = requestInfo;

    return requestInfo;
  }, [generateRequestId, queryKeyHash, deduplicationWindow]);

  // Get current signal
  const getSignal = useCallback(() => {
    return lastRequestRef.current?.abortController.signal;
  }, []);

  // Manual cancel function
  const cancel = useCallback(
    (reason = "Manually cancelled") => {
      if (lastRequestRef.current) {
        cleanupRequest(lastRequestRef.current, reason);
        lastRequestRef.current = null;
      }
    },
    [cleanupRequest],
  );

  // Cancel all active requests
  const cancelAll = useCallback(
    (reason = "All requests cancelled") => {
      const currentRequests = Array.from(activeRequestsRef.current.values());
      currentRequests.forEach((requestInfo) => {
        cleanupRequest(requestInfo, reason);
      });
      lastRequestRef.current = null;
    },
    [cleanupRequest],
  );

  // Cancel queries by pattern
  const cancelQueries = useCallback(
    (filters?: Parameters<typeof queryClient.cancelQueries>[0]) => {
      return queryClient.cancelQueries(filters);
    },
    [queryClient],
  );

  // Get request status
  const getRequestStatus = useCallback(() => {
    const current = lastRequestRef.current;
    return {
      hasActiveRequest: current && !current.abortController.signal.aborted,
      activeRequestCount: activeRequestsRef.current.size,
      isAborted: current?.abortController.signal.aborted ?? false,
      lastRequestId: current?.requestId,
    };
  }, []);

  return {
    createRequest,
    getSignal,
    cancel,
    cancelAll,
    cancelQueries,
    getRequestStatus,
  };
}

// =====================================================
// Enhanced Query Hook with Cancellation
// =====================================================

/**
 * Enhanced useQuery with automatic cancellation, race condition prevention,
 * and request deduplication
 */
export function useQueryWithCancellation<TData = unknown, TError = unknown>(
  queryKey: QueryKey,
  queryFn: QueryFunction<TData, QueryKey>,
  options: UseQueryWithCancellationOptions<TData, TError> = {},
) {
  const {
    cancelOnParamsChange = true,
    cancelOnUnmount = true,
    deduplicationWindow = 50,
    enablePrefetch = false,
    prefetchStaleTime = 5 * 60 * 1000, // 5 minutes
    enabled = true,
    ...queryOptions
  } = options;

  const queryClient = useQueryClient();

  const { createRequest, cancel, cancelAll, cancelQueries, getRequestStatus } = useCancelableQuery({
    queryKey,
    enabled,
    cancelOnParamsChange,
    cancelOnUnmount,
    deduplicationWindow,
  });

  // Wrap query function to include signal
  const wrappedQueryFn = useCallback<QueryFunction<TData, QueryKey>>(
    async (context) => {
      const requestInfo = createRequest();

      try {
        // Create a combined signal that respects both React Query and our cancellation
        const combinedController = new AbortController();

        // Abort combined when either signal aborts
        if (context.signal) {
          context.signal.addEventListener(
            "abort",
            () => {
              if (!combinedController.signal.aborted) {
                combinedController.abort("React Query cancelled");
              }
            },
            { once: true },
          );
        }

        if (requestInfo.abortController.signal) {
          requestInfo.abortController.signal.addEventListener(
            "abort",
            () => {
              if (!combinedController.signal.aborted) {
                combinedController.abort("Manual cancellation");
              }
            },
            { once: true },
          );
        }

        // Execute the original query function with combined signal
        const result = await queryFn({
          ...context,
          signal: combinedController.signal,
        });

        return result;
      } catch (error: any) {
        // Handle abort errors gracefully
        if (error?.name === "AbortError" || error?.message?.includes("abort") || error?.message?.includes("cancel")) {
          throw new Error("Query was cancelled");
        }
        throw error;
      }
    },
    [queryFn, createRequest],
  );

  // Prefetch functionality
  useEffect(() => {
    if (enablePrefetch && enabled) {
      const timeoutId = setTimeout(() => {
        queryClient
          .prefetchQuery({
            queryKey,
            queryFn: wrappedQueryFn,
            staleTime: prefetchStaleTime,
          })
          .catch(() => {
            // Silently handle prefetch errors
          });
      }, 100); // Small delay to avoid immediate prefetch

      return () => clearTimeout(timeoutId);
    }
  }, [enablePrefetch, enabled, queryClient, queryKey, wrappedQueryFn, prefetchStaleTime]);

  // Execute the query
  const query = useQuery({
    queryKey,
    queryFn: wrappedQueryFn,
    enabled,
    staleTime: 5 * 60 * 1000, // Default 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry if cancelled
      if (error?.message?.includes("cancelled") || error?.name === "AbortError") {
        return false;
      }
      // Default retry logic (3 times)
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });

  const requestStatus = getRequestStatus();

  return {
    ...query,
    // Extended functionality
    cancel,
    cancelAll,
    cancelQueries,
    requestStatus,
    // Enhanced loading states
    isLoadingFirstTime: query.isLoading && !query.data,
    isRefetching: query.isFetching && !query.isLoading,
    hasData: !!query.data,
  };
}

// =====================================================
// Enhanced Infinite Query Hook with Cancellation
// =====================================================

/**
 * Enhanced useInfiniteQuery with automatic cancellation and race condition prevention
 */
export function useInfiniteQueryWithCancellation<TData = unknown, TError = unknown>(
  queryKey: QueryKey,
  queryFn: InfiniteQueryFunction<TData, QueryKey>,
  options: UseInfiniteQueryWithCancellationOptions<TData, TError> = {},
) {
  const { cancelOnParamsChange = true, cancelOnUnmount = true, deduplicationWindow = 50, enabled = true, ...queryOptions } = options;

  const { createRequest, cancel, cancelAll, cancelQueries, getRequestStatus } = useCancelableQuery({
    queryKey,
    enabled,
    cancelOnParamsChange,
    cancelOnUnmount,
    deduplicationWindow,
  });

  // Wrap query function to include signal
  const wrappedQueryFn = useCallback<InfiniteQueryFunction<TData, QueryKey>>(
    async (context) => {
      const requestInfo = createRequest();

      try {
        // Create combined signal
        const combinedController = new AbortController();

        if (context.signal) {
          context.signal.addEventListener(
            "abort",
            () => {
              if (!combinedController.signal.aborted) {
                combinedController.abort("React Query cancelled");
              }
            },
            { once: true },
          );
        }

        if (requestInfo.abortController.signal) {
          requestInfo.abortController.signal.addEventListener(
            "abort",
            () => {
              if (!combinedController.signal.aborted) {
                combinedController.abort("Manual cancellation");
              }
            },
            { once: true },
          );
        }

        const result = await queryFn({
          ...context,
          signal: combinedController.signal,
        });

        return result;
      } catch (error: any) {
        if (error?.name === "AbortError" || error?.message?.includes("abort") || error?.message?.includes("cancel")) {
          throw new Error("Query was cancelled");
        }
        throw error;
      }
    },
    [queryFn, createRequest],
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: wrappedQueryFn,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes("cancelled") || error?.name === "AbortError") {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...queryOptions,
  });

  const requestStatus = getRequestStatus();

  return {
    ...query,
    cancel,
    cancelAll,
    cancelQueries,
    requestStatus,
    isLoadingFirstTime: query.isLoading && !query.data,
    isLoadingMore: query.isFetchingNextPage,
    hasData: !!query.data?.pages?.length,
  };
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Hook for prefetching data with cancellation support
 */
export function usePrefetchWithCancellation() {
  const queryClient = useQueryClient();
  const activeRequestsRef = useRef<Map<string, AbortController>>(new Map());

  const prefetch = useCallback(
    async <TData>(
      queryKey: QueryKey,
      queryFn: QueryFunction<TData, QueryKey>,
      options?: {
        staleTime?: number;
        signal?: AbortSignal;
      },
    ) => {
      const requestId = `prefetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const abortController = new AbortController();

      activeRequestsRef.current.set(requestId, abortController);

      try {
        await queryClient.prefetchQuery({
          queryKey,
          queryFn: (context) =>
            queryFn({
              ...context,
              signal: abortController.signal,
            }),
          staleTime: options?.staleTime ?? 5 * 60 * 1000,
        });
      } finally {
        activeRequestsRef.current.delete(requestId);
      }
    },
    [queryClient],
  );

  const cancelAllPrefetch = useCallback(() => {
    activeRequestsRef.current.forEach((controller) => {
      if (!controller.signal.aborted) {
        controller.abort("All prefetch cancelled");
      }
    });
    activeRequestsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => cancelAllPrefetch();
  }, [cancelAllPrefetch]);

  return {
    prefetch,
    cancelAllPrefetch,
  };
}
