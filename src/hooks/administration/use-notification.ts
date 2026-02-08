// packages/hooks/src/useNotification.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  // Notification functions
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  batchCreateNotifications,
  batchUpdateNotifications,
  batchDeleteNotifications,
  getNotificationsByUser,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  sendNotification,
  // SeenNotification functions
  getSeenNotifications,
  getSeenNotificationById,
  createSeenNotification,
  updateSeenNotification,
  deleteSeenNotification,
  batchCreateSeenNotifications,
  batchUpdateSeenNotifications,
  batchDeleteSeenNotifications,
  getSeenNotificationsByUser,
  getSeenNotificationsByNotification,
} from "../../api-client";
import type {
  // Notification types
  NotificationGetManyFormData,
  NotificationCreateFormData,
  NotificationUpdateFormData,
  NotificationBatchCreateFormData,
  NotificationBatchUpdateFormData,
  NotificationBatchDeleteFormData,
  NotificationInclude,
  // SeenNotification types
  SeenNotificationGetManyFormData,
  SeenNotificationCreateFormData,
  SeenNotificationUpdateFormData,
  SeenNotificationBatchCreateFormData,
  SeenNotificationBatchUpdateFormData,
  SeenNotificationBatchDeleteFormData,
  SeenNotificationInclude,
} from "../../schemas";
import type {
  // Entity types
  Notification,
  SeenNotification,
  // Notification response types
  NotificationGetManyResponse,
  NotificationGetUniqueResponse,
  NotificationCreateResponse,
  NotificationUpdateResponse,
  NotificationDeleteResponse,
  NotificationBatchCreateResponse,
  NotificationBatchUpdateResponse,
  NotificationBatchDeleteResponse,
  // SeenNotification response types
  SeenNotificationGetManyResponse,
  SeenNotificationGetUniqueResponse,
  SeenNotificationCreateResponse,
  SeenNotificationUpdateResponse,
  SeenNotificationDeleteResponse,
  SeenNotificationBatchCreateResponse,
  SeenNotificationBatchUpdateResponse,
  SeenNotificationBatchDeleteResponse,
} from "../../types";
import { notificationKeys, seenNotificationKeys, userKeys } from "../common/query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "../common/create-entity-hooks";

// =====================================================
// Notification Service Adapter
// =====================================================

const notificationService = {
  getMany: (params?: NotificationGetManyFormData) => getNotifications(params || {}),
  getById: (id: string, params?: any) => getNotificationById(id, params),
  create: (data: NotificationCreateFormData, include?: NotificationInclude) => createNotification(data, include ? { include } : undefined),
  update: (id: string, data: NotificationUpdateFormData, include?: NotificationInclude) => updateNotification(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteNotification(id),
  batchCreate: (data: NotificationBatchCreateFormData, include?: NotificationInclude) => batchCreateNotifications(data, include ? { include } : undefined),
  batchUpdate: (data: NotificationBatchUpdateFormData, include?: NotificationInclude) => batchUpdateNotifications(data, include ? { include } : undefined),
  batchDelete: (data: NotificationBatchDeleteFormData) => batchDeleteNotifications(data),
};

// =====================================================
// Base Notification Hooks
// =====================================================

const baseNotificationHooks = createEntityHooks<
  NotificationGetManyFormData,
  NotificationGetManyResponse,
  NotificationGetUniqueResponse,
  NotificationCreateFormData,
  NotificationCreateResponse,
  NotificationUpdateFormData,
  NotificationUpdateResponse,
  NotificationDeleteResponse,
  NotificationBatchCreateFormData,
  NotificationBatchCreateResponse<Notification>,
  NotificationBatchUpdateFormData,
  NotificationBatchUpdateResponse<Notification>,
  NotificationBatchDeleteFormData,
  NotificationBatchDeleteResponse
>({
  queryKeys: notificationKeys,
  service: notificationService,
  staleTime: 1000 * 60 * 1, // 1 minute since notifications change frequently
  relatedQueryKeys: [userKeys, seenNotificationKeys], // Notifications affect users and seen status
});

// Export base hooks with standard names
export const useNotificationsInfinite = baseNotificationHooks.useInfiniteList;
export const useNotifications = baseNotificationHooks.useList;
export const useNotification = baseNotificationHooks.useDetail;
export const useNotificationMutations = baseNotificationHooks.useMutations;
export const useNotificationBatchMutations = baseNotificationHooks.useBatchMutations;

// =====================================================
// Specialized Notification Query Hooks
// =====================================================

// Notifications by user
export const useNotificationsByUser = createSpecializedQueryHook<{ userId: string; filters?: Partial<NotificationGetManyFormData> }, NotificationGetManyResponse>({
  queryKeyFn: ({ userId, filters }) => notificationKeys.byUser(userId, filters),
  queryFn: ({ userId, filters }) => getNotificationsByUser(userId, filters),
  staleTime: 1000 * 60 * 1, // 1 minute
});

// Unread notifications
export const useUnreadNotifications = createSpecializedQueryHook<{ userId: string; filters?: Partial<NotificationGetManyFormData> }, NotificationGetManyResponse>({
  queryKeyFn: ({ userId }) => notificationKeys.unread(userId),
  queryFn: ({ userId, filters }) => getUnreadNotifications(userId, filters),
  staleTime: 1000 * 30, // 30 seconds - very fresh data needed
});

// =====================================================
// Specialized Notification Mutation Hooks
// =====================================================

// Send notification
export const useSendNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => sendNotification(notificationId),
    onSuccess: (_, notificationId) => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.detail(notificationId),
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.all,
      });
    },
  });
};

// Mark notification as read
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ notificationId, userId }: { notificationId: string; userId: string }) => markAsRead(notificationId, userId),
    onSuccess: (_, { notificationId, userId }) => {
      // Invalidate notification queries
      queryClient.invalidateQueries({
        queryKey: notificationKeys.detail(notificationId),
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unread(userId),
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.byUser(userId),
      });

      // Invalidate the notification center query (for real-time UI updates)
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });

      // Invalidate seen notification queries
      queryClient.invalidateQueries({
        queryKey: seenNotificationKeys.all,
      });

      // Invalidate user queries
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(userId),
      });
    },
  });
};

// Mark all notifications as read
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => markAllAsRead(userId),
    onSuccess: (_, userId) => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({
        queryKey: notificationKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.unread(userId),
      });
      queryClient.invalidateQueries({
        queryKey: notificationKeys.byUser(userId),
      });

      // Invalidate the notification center query (for real-time UI updates)
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });

      // Invalidate seen notification queries
      queryClient.invalidateQueries({
        queryKey: seenNotificationKeys.all,
      });

      // Invalidate user queries
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(userId),
      });
    },
  });
};

// =====================================================
// SeenNotification Service Adapter
// =====================================================

const seenNotificationService = {
  getMany: (params?: SeenNotificationGetManyFormData) => getSeenNotifications(params || {}),
  getById: (id: string, params?: any) => getSeenNotificationById(id, params),
  create: (data: SeenNotificationCreateFormData, include?: SeenNotificationInclude) => createSeenNotification(data, include ? { include } : undefined),
  update: (id: string, data: SeenNotificationUpdateFormData, include?: SeenNotificationInclude) => updateSeenNotification(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteSeenNotification(id),
  batchCreate: (data: SeenNotificationBatchCreateFormData, include?: SeenNotificationInclude) => batchCreateSeenNotifications(data, include ? { include } : undefined),
  batchUpdate: (data: SeenNotificationBatchUpdateFormData, include?: SeenNotificationInclude) => batchUpdateSeenNotifications(data, include ? { include } : undefined),
  batchDelete: (data: SeenNotificationBatchDeleteFormData) => batchDeleteSeenNotifications(data),
};

// =====================================================
// Base SeenNotification Hooks
// =====================================================

const baseSeenNotificationHooks = createEntityHooks<
  SeenNotificationGetManyFormData,
  SeenNotificationGetManyResponse,
  SeenNotificationGetUniqueResponse,
  SeenNotificationCreateFormData,
  SeenNotificationCreateResponse,
  SeenNotificationUpdateFormData,
  SeenNotificationUpdateResponse,
  SeenNotificationDeleteResponse,
  SeenNotificationBatchCreateFormData,
  SeenNotificationBatchCreateResponse<SeenNotification>,
  SeenNotificationBatchUpdateFormData,
  SeenNotificationBatchUpdateResponse<SeenNotification>,
  SeenNotificationBatchDeleteFormData,
  SeenNotificationBatchDeleteResponse
>({
  queryKeys: seenNotificationKeys,
  service: seenNotificationService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [notificationKeys, userKeys], // Seen notifications affect notifications and users
});

// Export base hooks with standard names
export const useSeenNotificationsInfinite = baseSeenNotificationHooks.useInfiniteList;
export const useSeenNotifications = baseSeenNotificationHooks.useList;
export const useSeenNotification = baseSeenNotificationHooks.useDetail;
export const useSeenNotificationMutations = baseSeenNotificationHooks.useMutations;
export const useSeenNotificationBatchMutations = baseSeenNotificationHooks.useBatchMutations;

// =====================================================
// Specialized SeenNotification Query Hooks
// =====================================================

// Seen notifications by user
export const useSeenNotificationsByUser = createSpecializedQueryHook<string, SeenNotificationGetManyResponse>({
  queryKeyFn: (userId) => seenNotificationKeys.byUser(userId),
  queryFn: (userId) => getSeenNotificationsByUser(userId),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Seen notifications by notification
export const useSeenNotificationsByNotification = createSpecializedQueryHook<string, SeenNotificationGetManyResponse>({
  queryKeyFn: (notificationId) => seenNotificationKeys.byNotification(notificationId),
  queryFn: (notificationId) => getSeenNotificationsByNotification(notificationId),
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// =====================================================
// Backward Compatibility Exports
// =====================================================

// Legacy mutation hooks
export const useCreateNotification = () => {
  const mutations = useNotificationMutations();
  return mutations.createMutation;
};

export const useUpdateNotification = (id: string) => {
  const mutations = useNotificationMutations();
  return {
    mutate: (data: NotificationUpdateFormData) => mutations.update({ id, data }),
    mutateAsync: (data: NotificationUpdateFormData) => mutations.updateAsync({ id, data }),
    isPending: mutations.updateMutation.isPending,
    isError: mutations.updateMutation.isError,
    error: mutations.updateMutation.error,
  };
};

export const useDeleteNotification = () => {
  const mutations = useNotificationMutations();
  return mutations.deleteMutation;
};

export const useBatchCreateNotifications = () => {
  const mutations = useNotificationBatchMutations();
  return mutations.batchCreateMutation;
};

export const useBatchUpdateNotifications = () => {
  const mutations = useNotificationBatchMutations();
  return mutations.batchUpdateMutation;
};

export const useBatchDeleteNotifications = () => {
  const mutations = useNotificationBatchMutations();
  return mutations.batchDeleteMutation;
};

// SeenNotification legacy hooks
export const useCreateSeenNotification = () => {
  const queryClient = useQueryClient();
  const mutations = useSeenNotificationMutations({
    onCreateSuccess: (data) => {
      // Additional invalidation for unread notifications
      if (data.data?.userId) {
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unread(data.data.userId),
        });
      }
    },
  });
  return mutations.createMutation;
};

export const useUpdateSeenNotification = (id: string) => {
  const mutations = useSeenNotificationMutations();
  return {
    mutate: (data: SeenNotificationUpdateFormData) => mutations.update({ id, data }),
    mutateAsync: (data: SeenNotificationUpdateFormData) => mutations.updateAsync({ id, data }),
    isPending: mutations.updateMutation.isPending,
    isError: mutations.updateMutation.isError,
    error: mutations.updateMutation.error,
  };
};

export const useDeleteSeenNotification = () => {
  const mutations = useSeenNotificationMutations();
  return mutations.deleteMutation;
};

export const useBatchCreateSeenNotifications = () => {
  const mutations = useSeenNotificationBatchMutations();
  return mutations.batchCreateMutation;
};

export const useBatchUpdateSeenNotifications = () => {
  const mutations = useSeenNotificationBatchMutations();
  return mutations.batchUpdateMutation;
};

export const useBatchDeleteSeenNotifications = () => {
  const mutations = useSeenNotificationBatchMutations();
  return mutations.batchDeleteMutation;
};
