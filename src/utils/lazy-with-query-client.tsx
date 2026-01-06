import { lazy, ComponentType, LazyExoticComponent } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

// Get or create a global QueryClient instance
function getGlobalQueryClient(): QueryClient | null {
  if (typeof window !== "undefined") {
    const globalClient = (window as any).__REACT_QUERY_CLIENT__;
    if (globalClient instanceof QueryClient) {
      return globalClient;
    }
    // Check if initialization is in progress but not yet complete
    if ((window as any).__QUERY_CLIENT_INITIALIZED__ === true) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("[QueryClient] Global client flag set but instance not found");
      }
    }
  }
  return null;
}

// Wait for global QueryClient with timeout
async function waitForGlobalQueryClient(maxWaitMs = 5000): Promise<QueryClient | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const client = getGlobalQueryClient();
    if (client) {
      return client;
    }
    // Wait 10ms before checking again
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error("[QueryClient] Timeout waiting for global QueryClient");
  }
  return null;
}

// Wrapper component that ensures QueryClient is available
function QueryClientWrapper({ children }: { children: React.ReactNode }) {
  // Try to use existing QueryClient from context
  let queryClient: QueryClient | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // No QueryClient in context, get global one
    queryClient = getGlobalQueryClient();
  }

  // If we have a QueryClient from context, just render children
  if (queryClient) {
    return <>{children}</>;
  }

  // Otherwise, create a new provider with global client
  const globalClient = getGlobalQueryClient();
  if (globalClient) {
    return (
      <QueryClientProvider client={globalClient}>
        {children}
      </QueryClientProvider>
    );
  }

  // Fallback: create a new QueryClient if none exists
  const fallbackClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });

  return (
    <QueryClientProvider client={fallbackClient}>
      {children}
    </QueryClientProvider>
  );
}

// Enhanced lazy loading that ensures QueryClient is available
export function lazyWithQueryClient<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T } | { [key: string]: T }>,
  namedExport?: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const module = await importFunc();

    // Handle named exports
    const Component = namedExport
      ? (module as any)[namedExport]
      : (module as { default: T }).default;

    // Wrap component to ensure QueryClient is available
    const WrappedComponent = (props: any) => (
      <QueryClientWrapper>
        <Component {...props} />
      </QueryClientWrapper>
    );

    return { default: WrappedComponent as T };
  });
}