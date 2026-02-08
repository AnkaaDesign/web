import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationPreferenceService } from "../../api-client/services/notification.service";
import type {
  UserNotificationPreference,
  UserNotificationPreferenceGetManyResponse,
  UserNotificationPreferenceUpdateResponse,
} from "../../types";

// =====================================================
// Query Keys
// =====================================================

export const notificationPreferenceKeys = {
  all: ["notificationPreferences"] as const,
  byUser: (userId: string) => [...notificationPreferenceKeys.all, "user", userId] as const,
  defaults: () => [...notificationPreferenceKeys.all, "defaults"] as const,
};

// =====================================================
// Query Hooks
// =====================================================

interface UseNotificationPreferencesOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnWindowFocus?: boolean;
}

/**
 * Hook to fetch user notification preferences
 */
export const useNotificationPreferences = (
  userId: string,
  options?: UseNotificationPreferencesOptions
) => {
  return useQuery({
    queryKey: notificationPreferenceKeys.byUser(userId),
    queryFn: async () => {
      const response = await notificationPreferenceService.getPreferences(userId);
      return response.data;
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    refetchOnMount: options?.refetchOnMount ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

/**
 * Hook to fetch default notification preferences
 */
export const useDefaultNotificationPreferences = () => {
  return useQuery({
    queryKey: notificationPreferenceKeys.defaults(),
    queryFn: async () => {
      const response = await notificationPreferenceService.getDefaults();
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - defaults rarely change
  });
};

// =====================================================
// Mutation Hooks
// =====================================================

interface UpdatePreferenceParams {
  userId: string;
  type: string;
  eventType: string;
  channels: string[];
}

/**
 * Hook to update a single notification preference
 */
export const useUpdatePreference = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, type, eventType, channels }: UpdatePreferenceParams) => {
      const response = await notificationPreferenceService.updatePreference(userId, type, {
        eventType,
        channels,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the user's preferences
      queryClient.invalidateQueries({
        queryKey: notificationPreferenceKeys.byUser(variables.userId),
      });
    },
  });
};

interface ResetPreferencesParams {
  userId: string;
}

/**
 * Hook to reset notification preferences to defaults
 */
export const useResetPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: ResetPreferencesParams) => {
      const response = await notificationPreferenceService.resetPreferences(userId);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the user's preferences
      queryClient.invalidateQueries({
        queryKey: notificationPreferenceKeys.byUser(variables.userId),
      });
    },
  });
};

// =====================================================
// Helper Hooks
// =====================================================

/**
 * Transform API preferences to the format expected by the form
 */
export const useTransformedPreferences = (userId: string) => {
  const { data: preferences, ...queryProps } = useNotificationPreferences(userId);

  const transformedData = React.useMemo(() => {
    if (!preferences || preferences.data.length === 0) return null;

    // Group preferences by type and eventType
    const grouped: Record<string, Record<string, UserNotificationPreference>> = {};

    preferences.data.forEach((pref) => {
      const type = pref.notificationType.toLowerCase();
      const eventType = pref.eventType || "general";

      if (!grouped[type]) {
        grouped[type] = {};
      }

      grouped[type][eventType] = pref;
    });

    // Transform to form structure
    return {
      task: {
        status: {
          channels: grouped.task?.status?.channels || [],
          mandatory: grouped.task?.status?.isMandatory || false,
        },
        artwork: {
          channels: grouped.task?.artwork?.channels || [],
          mandatory: grouped.task?.artwork?.isMandatory || false,
        },
        deadline: {
          channels: grouped.task?.deadline?.channels || [],
          mandatory: grouped.task?.deadline?.isMandatory || false,
        },
        assignment: {
          channels: grouped.task?.assignment?.channels || [],
          mandatory: grouped.task?.assignment?.isMandatory || false,
        },
        comment: {
          channels: grouped.task?.comment?.channels || [],
          mandatory: grouped.task?.comment?.isMandatory || false,
        },
        priority: {
          channels: grouped.task?.priority?.channels || [],
          mandatory: grouped.task?.priority?.isMandatory || false,
        },
        description: {
          channels: grouped.task?.description?.channels || [],
          mandatory: grouped.task?.description?.isMandatory || false,
        },
        customer: {
          channels: grouped.task?.customer?.channels || [],
          mandatory: grouped.task?.customer?.isMandatory || false,
        },
        sector: {
          channels: grouped.task?.sector?.channels || [],
          mandatory: grouped.task?.sector?.isMandatory || false,
        },
        completion: {
          channels: grouped.task?.completion?.channels || [],
          mandatory: grouped.task?.completion?.isMandatory || false,
        },
      },
      order: {
        created: {
          channels: grouped.order?.created?.channels || [],
          mandatory: grouped.order?.created?.isMandatory || false,
        },
        status: {
          channels: grouped.order?.status?.channels || [],
          mandatory: grouped.order?.status?.isMandatory || false,
        },
        fulfilled: {
          channels: grouped.order?.fulfilled?.channels || [],
          mandatory: grouped.order?.fulfilled?.isMandatory || false,
        },
        cancelled: {
          channels: grouped.order?.cancelled?.channels || [],
          mandatory: grouped.order?.cancelled?.isMandatory || false,
        },
        overdue: {
          channels: grouped.order?.overdue?.channels || [],
          mandatory: grouped.order?.overdue?.isMandatory || false,
        },
      },
      stock: {
        low: {
          channels: grouped.stock?.low?.channels || [],
          mandatory: grouped.stock?.low?.isMandatory || false,
        },
        out: {
          channels: grouped.stock?.out?.channels || [],
          mandatory: grouped.stock?.out?.isMandatory || false,
        },
        restock: {
          channels: grouped.stock?.restock?.channels || [],
          mandatory: grouped.stock?.restock?.isMandatory || false,
        },
      },
    };
  }, [preferences]);

  return {
    ...queryProps,
    data: transformedData,
  };
};

// React import for useMemo
import React from "react";
