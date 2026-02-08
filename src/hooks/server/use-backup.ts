import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backupApi } from "../../api-client";
import type {
  CreateBackupRequest,
  ScheduleBackupRequest,
  BackupQueryParams,
} from "../../api-client";

// Query keys
export const backupQueryKeys = {
  all: ["backups"] as const,
  lists: () => [...backupQueryKeys.all, "list"] as const,
  list: (params?: BackupQueryParams) => [...backupQueryKeys.lists(), params] as const,
  detail: (id: string) => [...backupQueryKeys.all, "detail", id] as const,
  scheduled: () => [...backupQueryKeys.all, "scheduled"] as const,
  systemHealth: () => [...backupQueryKeys.all, "systemHealth"] as const,
  systemHealthSummary: () => [...backupQueryKeys.all, "systemHealthSummary"] as const,
  verification: (id: string) => [...backupQueryKeys.all, "verification", id] as const,
};

// List backups hook
export function useBackups(params?: BackupQueryParams, enabled: boolean = true) {
  return useQuery({
    queryKey: backupQueryKeys.list(params),
    queryFn: () => backupApi.getBackups(params),
    enabled, // Only fetch when enabled (e.g., when user is authenticated)
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Single backup hook
export function useBackup(id: string) {
  return useQuery({
    queryKey: backupQueryKeys.detail(id),
    queryFn: () => backupApi.getBackupById(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Scheduled backups hook
export function useScheduledBackups(enabled: boolean = true) {
  return useQuery({
    queryKey: backupQueryKeys.scheduled(),
    queryFn: () => backupApi.getScheduledBackups(),
    enabled, // Only fetch when enabled (e.g., when user is authenticated)
    staleTime: 60 * 1000, // 1 minute
  });
}

// System health hook
export function useBackupSystemHealth() {
  return useQuery({
    queryKey: backupQueryKeys.systemHealth(),
    queryFn: () => backupApi.getSystemHealth(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// System health summary hook
export function useBackupSystemHealthSummary(enabled: boolean = true) {
  return useQuery({
    queryKey: backupQueryKeys.systemHealthSummary(),
    queryFn: () => backupApi.getSystemHealthSummary(),
    enabled, // Only fetch when enabled (e.g., when user is authenticated)
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Backup verification hook
export function useBackupVerification(id: string, enabled: boolean = false) {
  return useQuery({
    queryKey: backupQueryKeys.verification(id),
    queryFn: () => backupApi.verifyBackup(id),
    enabled: enabled && !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Backup mutations hook
export function useBackupMutations() {
  const queryClient = useQueryClient();

  const createBackup = useMutation({
    mutationFn: (data: CreateBackupRequest) => backupApi.createBackup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupQueryKeys.all });
    },
  });

  const restoreBackup = useMutation({
    mutationFn: ({ id, targetPath }: { id: string; targetPath?: string }) =>
      backupApi.restoreBackup(id, targetPath),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: backupQueryKeys.all });
    },
  });

  const deleteBackup = useMutation({
    mutationFn: (id: string) => backupApi.deleteBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupQueryKeys.all });
    },
  });

  const scheduleBackup = useMutation({
    mutationFn: (data: ScheduleBackupRequest) => backupApi.scheduleBackup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupQueryKeys.scheduled() });
    },
  });

  const removeScheduledBackup = useMutation({
    mutationFn: (id: string) => backupApi.removeScheduledBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupQueryKeys.scheduled() });
    },
  });

  const verifyBackup = useMutation({
    mutationFn: (id: string) => backupApi.verifyBackup(id),
    onSuccess: (result, id) => {
      queryClient.invalidateQueries({ queryKey: backupQueryKeys.verification(id) });
    },
  });

  return {
    create: createBackup,
    restore: restoreBackup,
    delete: deleteBackup,
    schedule: scheduleBackup,
    removeScheduled: removeScheduledBackup,
    verify: verifyBackup,
  };
}

// Utility hooks
export function useBackupUtils() {
  return {
    formatBytes: backupApi.formatBytes.bind(backupApi),
    generateCronExpression: backupApi.generateCronExpression.bind(backupApi),
    parseCronToHuman: backupApi.parseCronToHuman.bind(backupApi),
    getPathsByPriority: backupApi.getPathsByPriority.bind(backupApi),
  };
}