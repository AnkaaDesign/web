// packages/hooks/src/use-stable-query.ts

import { useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

/**
 * A wrapper around useQuery that provides stable query key management
 * and prevents stale closure issues with dynamic query keys
 */
export function useStableQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[]
>(
  queryKeyFn: () => TQueryKey,
  queryFn: () => Promise<TQueryFnData>,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, "queryKey" | "queryFn">
): UseQueryResult<TData, TError> & { refreshQuery: () => void } {
  const queryClient = useQueryClient();

  // Memoize the query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => queryKeyFn(), [queryKeyFn]);

  // Stable reference to the latest query function
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  // Create a stable query function that always calls the latest version
  const stableQueryFn = useMemo(
    () => () => queryFnRef.current(),
    []
  );

  const query = useQuery({
    queryKey,
    queryFn: stableQueryFn,
    ...options,
  });

  const refreshQuery = useMemo(
    () => () => {
      queryClient.invalidateQueries({ queryKey });
    },
    [queryClient, queryKey]
  );

  return {
    ...query,
    refreshQuery,
  };
}

/**
 * Hook to invalidate multiple related queries at once
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      invalidateAll: (queryKeys: readonly unknown[][]) => {
        return Promise.all(
          queryKeys.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
          )
        );
      },
      invalidateByPrefix: (prefix: string) => {
        return queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith(prefix);
          },
        });
      },
      refetchAll: (queryKeys: readonly unknown[][]) => {
        return Promise.all(
          queryKeys.map((queryKey) =>
            queryClient.refetchQueries({ queryKey })
          )
        );
      },
    }),
    [queryClient]
  );
}

/**
 * Hook to safely access query data without triggering a fetch
 */
export function useQueryData<TData = unknown>(queryKey: readonly unknown[]): TData | undefined {
  const queryClient = useQueryClient();

  return useMemo(
    () => queryClient.getQueryData<TData>(queryKey),
    [queryClient, queryKey]
  );
}

/**
 * Hook to prefetch data for better UX
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      prefetch: <TData = unknown>(
        queryKey: readonly unknown[],
        queryFn: () => Promise<TData>,
        options?: { staleTime?: number }
      ) => {
        return queryClient.prefetchQuery({
          queryKey,
          queryFn,
          staleTime: options?.staleTime || 1000 * 60 * 5, // 5 minutes default
        });
      },
      ensureData: <TData = unknown>(
        queryKey: readonly unknown[],
        queryFn: () => Promise<TData>,
        options?: { staleTime?: number }
      ) => {
        return queryClient.ensureQueryData({
          queryKey,
          queryFn,
          staleTime: options?.staleTime || 1000 * 60 * 5, // 5 minutes default
        });
      },
    }),
    [queryClient]
  );
}

// =====================
// Enhanced Query Error Monitor
// =====================

interface QueryError {
  queryKey: readonly unknown[];
  error: Error;
  timestamp: number;
  retryCount: number;
}

class QueryErrorMonitor {
  private errors: QueryError[] = [];
  private maxErrors = 100;
  private errorThreshold = 5; // Max errors per minute

  addError(queryKey: readonly unknown[], error: Error, retryCount: number) {
    this.errors.push({
      queryKey,
      error,
      timestamp: Date.now(),
      retryCount,
    });

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Check if we're hitting error threshold
    this.checkErrorThreshold(queryKey);
  }

  private checkErrorThreshold(queryKey: readonly unknown[]) {
    const oneMinuteAgo = Date.now() - 60000;
    const recentErrors = this.errors.filter(
      error =>
        error.timestamp > oneMinuteAgo &&
        JSON.stringify(error.queryKey) === JSON.stringify(queryKey)
    );

    if (recentErrors.length >= this.errorThreshold) {
      console.warn(
        `High error rate detected for query: ${JSON.stringify(queryKey)}`,
        `${recentErrors.length} errors in the last minute`
      );

      // Could trigger additional monitoring or alerts here
      this.notifyErrorThreshold(queryKey, recentErrors);
    }
  }

  private notifyErrorThreshold(queryKey: readonly unknown[], errors: QueryError[]) {
    const errorTypes = errors.reduce((acc, error) => {
      const type = error.error.constructor.name;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.group('Statistics Query Error Threshold Exceeded');
    console.log('Query Key:', queryKey);
    console.log('Error Types:', errorTypes);
    console.log('Recent Errors:', errors);
    console.groupEnd();
  }

  getErrorStats(queryKey?: readonly unknown[]) {
    const relevantErrors = queryKey
      ? this.errors.filter(error => JSON.stringify(error.queryKey) === JSON.stringify(queryKey))
      : this.errors;

    const oneHourAgo = Date.now() - 3600000;
    const recentErrors = relevantErrors.filter(error => error.timestamp > oneHourAgo);

    return {
      totalErrors: relevantErrors.length,
      recentErrors: recentErrors.length,
      errorRate: recentErrors.length / 60, // Errors per minute
      mostCommonError: this.getMostCommonError(recentErrors),
    };
  }

  private getMostCommonError(errors: QueryError[]) {
    const errorCounts = errors.reduce((acc, error) => {
      const message = error.error.message;
      acc[message] = (acc[message] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
  }

  clearErrors(queryKey?: readonly unknown[]) {
    if (queryKey) {
      this.errors = this.errors.filter(
        error => JSON.stringify(error.queryKey) !== JSON.stringify(queryKey)
      );
    } else {
      this.errors = [];
    }
  }
}

export const queryErrorMonitor = new QueryErrorMonitor();

// =====================
// Enhanced Error Handling Hook
// =====================

export function useQueryErrorHandler() {
  const handleQueryError = useCallback((
    queryKey: readonly unknown[],
    error: Error,
    retryCount: number = 0
  ) => {
    queryErrorMonitor.addError(queryKey, error, retryCount);

    // Log error for debugging
    console.error('Statistics Query Error:', {
      queryKey,
      error: error.message,
      retryCount,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const clearQueryErrors = useCallback((queryKey?: readonly unknown[]) => {
    queryErrorMonitor.clearErrors(queryKey);
  }, []);

  const getQueryErrorStats = useCallback((queryKey?: readonly unknown[]) => {
    return queryErrorMonitor.getErrorStats(queryKey);
  }, []);

  return {
    handleQueryError,
    clearQueryErrors,
    getQueryErrorStats,
  };
}

// =====================
// Smart Prefetching Hook
// =====================

interface PrefetchStrategy {
  /**
   * Related query keys to prefetch when this query succeeds
   */
  relatedQueries?: Array<{
    queryKey: readonly unknown[];
    queryFn: () => Promise<unknown>;
    condition?: (data: unknown) => boolean;
  }>;
  /**
   * Delay before triggering prefetch (in milliseconds)
   */
  delay?: number;
  /**
   * Only prefetch if data is older than this (in milliseconds)
   */
  staleThreshold?: number;
}

export function useSmartPrefetch<TData = unknown>(
  mainQueryKey: readonly unknown[],
  strategy: PrefetchStrategy
) {
  const queryClient = useQueryClient();
  const { prefetch } = usePrefetch();
  const prefetchTriggered = useRef(new Set<string>());

  useEffect(() => {
    const data = queryClient.getQueryData<TData>(mainQueryKey);

    if (!data || !strategy.relatedQueries) return;
    return undefined;

    const triggerPrefetch = () => {
      strategy.relatedQueries?.forEach(({ queryKey, queryFn, condition }) => {
        const keyString = JSON.stringify(queryKey);

        // Skip if already prefetched recently
        if (prefetchTriggered.current.has(keyString)) return;

        // Check condition if provided
        if (condition && !condition(data)) return;

        // Check if data is stale enough to warrant prefetching
        if (strategy.staleThreshold) {
          const queryState = queryClient.getQueryState(queryKey);
          if (queryState?.dataUpdatedAt &&
              Date.now() - queryState.dataUpdatedAt < strategy.staleThreshold) {
            return;
          }
        }

        // Trigger prefetch
        prefetch(queryKey, queryFn, { staleTime: strategy.staleThreshold || 5 * 60 * 1000 });
        prefetchTriggered.current.add(keyString);

        // Clear the prefetch flag after some time
        setTimeout(() => {
          prefetchTriggered.current.delete(keyString);
        }, 30000); // 30 seconds
      });
    };

    if (strategy.delay) {
      const timer = setTimeout(triggerPrefetch, strategy.delay);
      return () => clearTimeout(timer);
    } else {
      triggerPrefetch();
    }
  }, [queryClient, mainQueryKey, strategy, prefetch]);
}

// =====================
// Background Refresh Hook
// =====================

interface BackgroundRefreshOptions {
  /**
   * Interval in milliseconds
   */
  interval: number;
  /**
   * Only refresh when tab is visible
   */
  onlyWhenVisible?: boolean;
  /**
   * Stop refreshing after this many iterations
   */
  maxIterations?: number;
  /**
   * Condition to check before refreshing
   */
  condition?: () => boolean;
}

export function useBackgroundRefresh(
  queryKeys: readonly unknown[][],
  options: BackgroundRefreshOptions
) {
  const queryClient = useQueryClient();
  const iterationCount = useRef(0);
  const isVisible = useRef(true);

  useEffect(() => {
    if (options.onlyWhenVisible) {
      const handleVisibilityChange = () => {
        isVisible.current = !document.hidden;
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    return undefined;
  }, [options.onlyWhenVisible]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Check iteration limit
      if (options.maxIterations && iterationCount.current >= options.maxIterations) {
        return;
      }

      // Check visibility condition
      if (options.onlyWhenVisible && !isVisible.current) {
        return;
      }

      // Check custom condition
      if (options.condition && !options.condition()) {
        return;
      }

      // Refresh all queries
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });

      iterationCount.current++;
    }, options.interval);

    return () => clearInterval(interval);
  }, [queryClient, queryKeys, options]);

  const stopRefresh = useCallback(() => {
    iterationCount.current = options.maxIterations || Infinity;
  }, [options.maxIterations]);

  const resetIterations = useCallback(() => {
    iterationCount.current = 0;
  }, []);

  return {
    stopRefresh,
    resetIterations,
    currentIteration: iterationCount.current,
  };
}