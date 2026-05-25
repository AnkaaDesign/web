import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  notificationConfigurationService,
  notificationUserPreferenceService,
} from "../../api-client/services/notification-configuration.service";
import type {
  NotificationConfigurationQueryParams,
  CreateNotificationConfigurationDto,
  UpdateNotificationConfigurationDto,
  UpdateChannelConfigDto,
  UpdateSectorOverrideDto,
  TestConfigurationDto,
  SendByConfigurationDto,
  UpdateUserPreferenceDto,
  UserPreferenceResponse,
  GroupedConfigurationsResponse,
} from "../../types/notification-configuration";
import type { NOTIFICATION_CHANNEL, SECTOR_PRIVILEGES } from "../../constants";

// =====================
// Query Keys
// =====================

export const notificationConfigurationKeys = {
  all: ["notification-configurations"] as const,
  lists: () => [...notificationConfigurationKeys.all, "list"] as const,
  list: (filters: NotificationConfigurationQueryParams) => [...notificationConfigurationKeys.lists(), filters] as const,
  details: () => [...notificationConfigurationKeys.all, "detail"] as const,
  detail: (key: string) => [...notificationConfigurationKeys.details(), key] as const,
  test: (key: string) => [...notificationConfigurationKeys.all, "test", key] as const,
};

export const userPreferenceKeys = {
  all: ["user-notification-preferences"] as const,
  myPreferences: () => [...userPreferenceKeys.all, "my"] as const,
  myPreference: (configKey: string) => [...userPreferenceKeys.myPreferences(), configKey] as const,
  availableConfigurations: () => [...userPreferenceKeys.all, "available"] as const,
};

// =====================
// Admin Configuration Hooks
// =====================

interface UseNotificationConfigurationsOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnWindowFocus?: boolean;
}

/**
 * Hook to fetch notification configurations with filters
 */
export const useNotificationConfigurations = (
  params: NotificationConfigurationQueryParams = {},
  options?: UseNotificationConfigurationsOptions
) => {
  return useQuery({
    queryKey: notificationConfigurationKeys.list(params),
    queryFn: () => notificationConfigurationService.getConfigurations(params),
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes
    refetchOnMount: options?.refetchOnMount ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

/**
 * Hook to fetch a single notification configuration by key
 */
export const useNotificationConfiguration = (
  key: string,
  options?: UseNotificationConfigurationsOptions
) => {
  return useQuery({
    queryKey: notificationConfigurationKeys.detail(key),
    queryFn: () => notificationConfigurationService.getConfigurationByKey(key),
    enabled: options?.enabled !== false && !!key,
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
    refetchOnMount: options?.refetchOnMount ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

/**
 * Hook for CRUD mutations on notification configurations
 */
export const useNotificationConfigurationMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateNotificationConfigurationDto) =>
      notificationConfigurationService.createConfiguration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigurationKeys.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotificationConfigurationDto }) =>
      notificationConfigurationService.updateConfiguration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigurationKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      notificationConfigurationService.deleteConfiguration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigurationKeys.all });
    },
  });

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  };
};

/**
 * Hook for channel configuration mutations
 */
export const useChannelConfigMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      channel,
      data,
    }: {
      configId: string;
      channel: NOTIFICATION_CHANNEL;
      data: UpdateChannelConfigDto;
    }) => notificationConfigurationService.updateChannelConfig(configId, channel, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigurationKeys.all });
    },
  });
};

/**
 * Hook for sector override mutations
 */
export const useSectorOverrideMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      configId,
      sector,
      data,
    }: {
      configId: string;
      sector: SECTOR_PRIVILEGES;
      data: UpdateSectorOverrideDto;
    }) => notificationConfigurationService.updateSectorOverride(configId, sector, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationConfigurationKeys.all });
    },
  });
};

/**
 * Hook for testing notification configuration
 */
export const useTestConfiguration = () => {
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data?: TestConfigurationDto }) =>
      notificationConfigurationService.testConfiguration(key, data),
  });
};

/**
 * Hook for sending notifications via configuration
 */
export const useSendByConfiguration = () => {
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: SendByConfigurationDto }) =>
      notificationConfigurationService.sendByConfiguration(key, data),
    onSuccess: (response) => {
      if (response.success) {
        // Distinct from the interceptor's generic success message: reports the
        // count of notifications actually created by this configuration send.
        toast.success(`${response.data?.notificationsCreated || 0} notificações enviadas`);
      }
    },
  });
};

// =====================
// User Preference Hooks
// =====================

interface UseUserPreferencesOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnWindowFocus?: boolean;
}

/**
 * Hook to fetch all user preferences
 */
export const useMyNotificationPreferences = (options?: UseUserPreferencesOptions) => {
  return useQuery({
    queryKey: userPreferenceKeys.myPreferences(),
    queryFn: () => notificationUserPreferenceService.getMyPreferences(),
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
    refetchOnMount: options?.refetchOnMount ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

/**
 * Hook to fetch available configurations grouped by type
 */
export const useAvailableConfigurations = (options?: UseUserPreferencesOptions) => {
  return useQuery({
    queryKey: userPreferenceKeys.availableConfigurations(),
    queryFn: () => notificationUserPreferenceService.getAvailableConfigurations(),
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
    refetchOnMount: options?.refetchOnMount ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    select: (data) => data.data as GroupedConfigurationsResponse | undefined,
  });
};

/**
 * Hook for updating user preferences with optimistic updates
 */
export const useUpdateMyPreference = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configKey, data }: { configKey: string; data: UpdateUserPreferenceDto }) =>
      notificationUserPreferenceService.updateMyPreference(configKey, data),
    onMutate: async ({ configKey, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: userPreferenceKeys.availableConfigurations() });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(userPreferenceKeys.availableConfigurations());

      // Optimistically update
      queryClient.setQueryData(userPreferenceKeys.availableConfigurations(), (old: any) => {
        if (!old?.data) return old;

        const newData = { ...old.data };
        for (const type in newData) {
          const configs = newData[type] as UserPreferenceResponse[];
          const configIndex = configs.findIndex((c) => c.configKey === configKey);
          if (configIndex !== -1) {
            newData[type] = [...configs];
            newData[type][configIndex] = {
              ...configs[configIndex],
              channels: configs[configIndex].channels.map((ch) => ({
                ...ch,
                userEnabled: data.channels.includes(ch.channel),
              })),
            };
          }
        }
        return { ...old, data: newData };
      });

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(userPreferenceKeys.availableConfigurations(), context.previousData);
      }
      toast.error("Erro ao atualizar preferência");
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: userPreferenceKeys.availableConfigurations() });
    },
  });
};

/**
 * Hook for resetting user preference to defaults
 */
export const useResetMyPreference = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (configKey: string) =>
      notificationUserPreferenceService.resetMyPreference(configKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userPreferenceKeys.availableConfigurations() });
      toast.success("Preferência restaurada para o padrão");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao restaurar preferência");
    },
  });
};
