// packages/hooks/src/useServer.ts

import {
  getSystemServices,
  startSystemService,
  stopSystemService,
  restartSystemService,
  getSystemServiceLogs,
  getSystemMetrics,
  getSystemStatus,
  getSystemUsers,
  createSystemUser,
  deleteSystemUser,
  setSystemUserPassword,
  getSharedFolders,
  getSharedFolderContents,
  getCpuTemperature,
  getSsdHealth,
  getRaidStatus,
  refreshRaidStatus,
} from "../../api-client";
import type { ServiceAction, ServiceLogsQuery, CreateUserFormData, SetUserPasswordFormData } from "../../schemas";
import { serverKeys } from "../common/query-keys";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// =====================================================
// System Services Hooks
// =====================================================

export function useSystemServices() {
  return useQuery({
    queryKey: serverKeys.services(),
    queryFn: getSystemServices,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
}

export function useStartService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ServiceAction) => startSystemService(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.services() });
      queryClient.invalidateQueries({ queryKey: serverKeys.status() });
      queryClient.invalidateQueries({ queryKey: serverKeys.metrics() });
    },
  });
}

export function useStopService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ServiceAction) => stopSystemService(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.services() });
      queryClient.invalidateQueries({ queryKey: serverKeys.status() });
      queryClient.invalidateQueries({ queryKey: serverKeys.metrics() });
    },
  });
}

export function useRestartService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ServiceAction) => restartSystemService(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.services() });
      queryClient.invalidateQueries({ queryKey: serverKeys.status() });
      queryClient.invalidateQueries({ queryKey: serverKeys.metrics() });
    },
  });
}

export function useServiceLogs(serviceName: string, params?: ServiceLogsQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverKeys.serviceLogs(serviceName, params),
    queryFn: () => getSystemServiceLogs(serviceName, params),
    staleTime: 1000 * 10, // 10 seconds
    enabled: options?.enabled ?? true,
  });
}

// =====================================================
// System Metrics and Status Hooks
// =====================================================

export function useServerMetrics() {
  return useQuery({
    queryKey: serverKeys.metrics(),
    queryFn: getSystemMetrics,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
}

export function useServerStatus() {
  return useQuery({
    queryKey: serverKeys.status(),
    queryFn: getSystemStatus,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
}

export function useCpuTemperature() {
  return useQuery({
    queryKey: serverKeys.temperature(),
    queryFn: getCpuTemperature,
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 1000 * 30, // 30 seconds
  });
}

export function useSsdHealth() {
  return useQuery({
    queryKey: serverKeys.ssdHealth(),
    queryFn: getSsdHealth,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // 5 minutes
  });
}

export function useRaidStatus() {
  return useQuery({
    queryKey: serverKeys.raidStatus(),
    queryFn: getRaidStatus,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
}

export function useRefreshRaidStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshRaidStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.raidStatus() });
      queryClient.invalidateQueries({ queryKey: serverKeys.status() });
    },
  });
}

// =====================================================
// System Users Hooks
// =====================================================

export function useSystemUsers() {
  return useQuery({
    queryKey: serverKeys.users(),
    queryFn: getSystemUsers,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateSystemUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserFormData) => createSystemUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.users() });
    },
  });
}

export function useDeleteSystemUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => deleteSystemUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.users() });
    },
  });
}

export function useSetSystemUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, data }: { username: string; data: SetUserPasswordFormData }) => setSystemUserPassword(username, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverKeys.users() });
    },
  });
}

// =====================================================
// Shared Folders Hooks
// =====================================================

export function useSharedFolders() {
  return useQuery({
    queryKey: serverKeys.sharedFolders(),
    queryFn: getSharedFolders,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSharedFolderContents(folderName?: string, subPath?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverKeys.sharedFolderContents(folderName, subPath),
    queryFn: () => (folderName ? getSharedFolderContents(folderName, subPath) : Promise.resolve(null)),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: (options?.enabled ?? true) && !!folderName,
  });
}

// =====================================================
// Combined Server Management Hook
// =====================================================

export function useServerManagement() {
  const servicesQuery = useSystemServices();
  const metricsQuery = useServerMetrics();
  const statusQuery = useServerStatus();
  const temperatureQuery = useCpuTemperature();
  const ssdHealthQuery = useSsdHealth();
  const usersQuery = useSystemUsers();
  const sharedFoldersQuery = useSharedFolders();

  const startService = useStartService();
  const stopService = useStopService();
  const restartService = useRestartService();
  const createUser = useCreateSystemUser();
  const deleteUser = useDeleteSystemUser();
  const setUserPassword = useSetSystemUserPassword();

  return {
    // Query data
    services: servicesQuery.data?.data || [],
    metrics: metricsQuery.data?.data,
    status: statusQuery.data?.data,
    temperature: temperatureQuery.data?.data,
    ssdHealth: ssdHealthQuery.data?.data || [],
    users: usersQuery.data?.data || [],
    sharedFolders: sharedFoldersQuery.data?.data || [],

    // Loading states
    isLoading: servicesQuery.isLoading || metricsQuery.isLoading || statusQuery.isLoading,
    isServicesLoading: servicesQuery.isLoading,
    isMetricsLoading: metricsQuery.isLoading,
    isStatusLoading: statusQuery.isLoading,
    isSsdHealthLoading: ssdHealthQuery.isLoading,
    isUsersLoading: usersQuery.isLoading,
    isSharedFoldersLoading: sharedFoldersQuery.isLoading,

    // Error states
    servicesError: servicesQuery.error,
    metricsError: metricsQuery.error,
    statusError: statusQuery.error,
    ssdHealthError: ssdHealthQuery.error,
    usersError: usersQuery.error,
    sharedFoldersError: sharedFoldersQuery.error,

    // Mutations
    startService: startService.mutate,
    stopService: stopService.mutate,
    restartService: restartService.mutate,
    createUser: createUser.mutate,
    deleteUser: deleteUser.mutate,
    setUserPassword: setUserPassword.mutate,

    // Mutation states
    isStartingService: startService.isPending,
    isStoppingService: stopService.isPending,
    isRestartingService: restartService.isPending,
    isCreatingUser: createUser.isPending,
    isDeletingUser: deleteUser.isPending,
    isSettingPassword: setUserPassword.isPending,

    // Refetch functions
    refetchServices: servicesQuery.refetch,
    refetchMetrics: metricsQuery.refetch,
    refetchStatus: statusQuery.refetch,
    refetchSsdHealth: ssdHealthQuery.refetch,
    refetchUsers: usersQuery.refetch,
    refetchSharedFolders: sharedFoldersQuery.refetch,
  };
}
