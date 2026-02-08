import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { throttlerService } from "@/api-client";

// Query keys
export const throttlerKeys = {
  all: ["throttler"] as const,
  stats: () => [...throttlerKeys.all, "stats"] as const,
  keys: (pattern?: string, limit?: number) =>
    [...throttlerKeys.all, "keys", { pattern, limit }] as const,
  blockedKeys: () => [...throttlerKeys.all, "blocked-keys"] as const,
};

/**
 * Hook to fetch throttler statistics
 */
export function useThrottlerStats() {
  return useQuery({
    queryKey: throttlerKeys.stats(),
    queryFn: () => throttlerService.getStats().then((res) => res.data),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider stale after 5 seconds
  });
}

/**
 * Hook to fetch throttler keys
 */
export function useThrottlerKeys(pattern?: string, limit?: number) {
  return useQuery({
    queryKey: throttlerKeys.keys(pattern, limit),
    queryFn: () => throttlerService.getKeys(pattern, limit).then((res) => res.data),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

/**
 * Hook to fetch blocked keys
 */
export function useBlockedKeys() {
  return useQuery({
    queryKey: throttlerKeys.blockedKeys(),
    queryFn: () => throttlerService.getBlockedKeys().then((res) => res.data),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
}

/**
 * Hook for throttler mutation operations (clear operations)
 * Note: Toasts are handled globally by the API client interceptor
 */
export function useThrottlerMutations() {
  const queryClient = useQueryClient();

  const clearKeys = useMutation({
    mutationFn: (pattern?: string) => throttlerService.clearKeys(pattern),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: throttlerKeys.all });
    },
  });

  const clearSpecificKey = useMutation({
    mutationFn: (key: string) => throttlerService.clearSpecificKey(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: throttlerKeys.all });
    },
  });

  const clearUserKeys = useMutation({
    mutationFn: (userId?: string) => throttlerService.clearUserKeys(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: throttlerKeys.all });
    },
  });

  const clearIpKeys = useMutation({
    mutationFn: (ip: string) => throttlerService.clearIpKeys(ip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: throttlerKeys.all });
    },
  });

  const clearBlockedKeys = useMutation({
    mutationFn: () => throttlerService.clearBlockedKeys(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: throttlerKeys.all });
    },
  });

  return {
    clearKeys,
    clearSpecificKey,
    clearUserKeys,
    clearIpKeys,
    clearBlockedKeys,
  };
}
