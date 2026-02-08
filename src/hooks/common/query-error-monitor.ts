// packages/hooks/src/query-error-monitor.ts

import { QueryClient } from "@tanstack/react-query";

interface QueryErrorStats {
  totalErrors: number;
  errorTypes: Record<string, number>;
  networkErrors: number;
  authErrors: number;
  validationErrors: number;
  lastError?: {
    timestamp: Date;
    message: string;
    status?: number;
    queryKey?: string;
  };
}

class QueryErrorMonitor {
  private stats: QueryErrorStats = {
    totalErrors: 0,
    errorTypes: {},
    networkErrors: 0,
    authErrors: 0,
    validationErrors: 0,
  };

  private listeners: Array<(stats: QueryErrorStats) => void> = [];

  setup(queryClient: QueryClient) {
    // Monitor query errors
    queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === "updated" && event.query.state.error) {
        this.trackError(event.query.state.error, String(event.query.queryKey));
      }
    });

    // Monitor mutation errors
    queryClient.getMutationCache().subscribe((event) => {
      if (event?.type === "updated" && event.mutation.state.error) {
        this.trackError(event.mutation.state.error, "mutation");
      }
    });
  }

  private trackError(error: unknown, context: string) {
    this.stats.totalErrors++;

    // Categorize error
    if (error && typeof error === "object") {
      const axiosError = error as any;
      const status = axiosError.response?.status || axiosError._statusCode;
      const message = axiosError.message || "Unknown error";

      // Track by status code
      if (status) {
        this.stats.errorTypes[`status_${status}`] = (this.stats.errorTypes[`status_${status}`] || 0) + 1;

        // Categorize common error types
        if (status === 401 || status === 403) {
          this.stats.authErrors++;
        } else if (status >= 400 && status < 500) {
          this.stats.validationErrors++;
        }
      } else {
        this.stats.networkErrors++;
      }

      // Update last error
      this.stats.lastError = {
        timestamp: new Date(),
        message,
        status,
        queryKey: context,
      };
    }

    // Notify listeners
    this.notifyListeners();

    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.warn("[Query Error Monitor]", {
        context,
        error,
        stats: this.stats,
      });
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.stats });
      } catch (err) {
        console.error("Error in query error monitor listener:", err);
      }
    });
  }

  getStats(): QueryErrorStats {
    return { ...this.stats };
  }

  onStatsChange(listener: (stats: QueryErrorStats) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  reset() {
    this.stats = {
      totalErrors: 0,
      errorTypes: {},
      networkErrors: 0,
      authErrors: 0,
      validationErrors: 0,
    };
    this.notifyListeners();
  }
}

export const queryErrorMonitor = new QueryErrorMonitor();

// Hook to use error stats in components
// NOTE: This hook has been removed to prevent QueryClient initialization issues
// The hook was trying to access React Query context at module initialization
// which caused errors in production builds.
// If needed in the future:
// 1. Ensure it's only imported within a component context
// 2. Use lazy initialization
// 3. Check that QueryClientProvider is properly set up before using

// function useQueryErrorStats() {
//   const [stats, setStats] = React.useState<QueryErrorStats>(() => {
//     // Lazy initialization to avoid calling getStats during module load
//     return {
//       totalErrors: 0,
//       errorTypes: {},
//       networkErrors: 0,
//       authErrors: 0,
//       validationErrors: 0,
//     };
//   });

//   React.useEffect(() => {
//     // Get initial stats after mount
//     setStats(queryErrorMonitor.getStats());

//     // Subscribe to changes
//     return queryErrorMonitor.onStatsChange(setStats);
//   }, []);

//   return stats;
// }

