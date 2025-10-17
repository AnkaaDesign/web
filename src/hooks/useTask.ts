// packages/hooks/src/hooks/useTask.ts

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getTasks, getTaskById, createTask, updateTask, deleteTask, batchCreateTasks, batchUpdateTasks, batchDeleteTasks, duplicateTask } from "../api-client";
import type {
  TaskGetManyFormData,
  TaskCreateFormData,
  TaskUpdateFormData,
  TaskBatchCreateFormData,
  TaskBatchUpdateFormData,
  TaskBatchDeleteFormData,
  TaskDuplicateFormData,
} from "../schemas";
import {
  taskKeys,
  serviceOrderKeys,
  observationKeys,
  airbrushingKeys,
  customerKeys,
  userKeys,
  sectorKeys,
  paintKeys,
  artworkKeys,
  truckKeys,
  garageKeys,
  changeLogKeys,
} from "./queryKeys";

// ===============================================
// TASK HOOKS
// ===============================================

// -------------------------------------
// PARAM TYPES
// -------------------------------------
interface UseTasksParams extends Partial<TaskGetManyFormData> {
  enabled?: boolean;
}

interface UseTaskDetailParams {
  enabled?: boolean;
  include?: any; // TaskInclude from schemas
}

// -------------------------------------
// INFINITE LIST HOOK
// -------------------------------------
export const useTasksInfinite = (params?: Partial<TaskGetManyFormData>) => {
  const queryClient = useQueryClient();

  // Separate pagination params from filter params for stable query keys
  const { page: _, limit, ...filterParams } = params || {};

  const query = useInfiniteQuery({
    queryKey: taskKeys.list(filterParams), // Use only filters in query key, not pagination
    queryFn: async ({ pageParam = 1 }) => {
      return getTasks({
        ...params,
        page: pageParam,
        limit: limit || 40,
      });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta) return undefined;
      return lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: taskKeys.list(filterParams),
    });
  };

  return {
    ...query,
    refresh,
  };
};

// -------------------------------------
// STANDARD LIST HOOK
// -------------------------------------
export function useTasks(params?: UseTasksParams) {
  const queryClient = useQueryClient();
  const { enabled = true, ...restParams } = params ?? {};

  // Include pagination in query key for proper pagination support
  // Each page should be a separate cached query
  const queryKey = useMemo(() => {
    if (!restParams) return taskKeys.list();

    // Include all parameters (including page/limit) in query key
    return taskKeys.list(restParams);
  }, [JSON.stringify(restParams)]); // Use JSON.stringify for deep comparison

  const query = useQuery({
    queryKey, // Include pagination in query key
    queryFn: () => getTasks(restParams), // Pass all params to the API
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: taskKeys.all, // Invalidate all task queries on refresh
    });
  };

  return {
    ...query,
    refresh,
  };
}

// -------------------------------------
// DETAIL HOOK
// -------------------------------------
export function useTaskDetail(id: string, params?: UseTaskDetailParams) {
  const queryClient = useQueryClient();
  const { enabled = true, include } = params ?? {};

  const query = useQuery({
    queryKey: taskKeys.detail(id, include),
    queryFn: () => getTaskById(id, { include }),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: taskKeys.detail(id),
    });
  };

  return {
    ...query,
    refresh,
  };
}

// -------------------------------------
// CRUD MUTATIONS HOOK
// -------------------------------------
export function useTaskMutations() {
  const queryClient = useQueryClient();

  const invalidateTasks = () => {
    // Invalidate main task queries
    queryClient.invalidateQueries({
      queryKey: taskKeys.all,
    });

    // Invalidate statistics
    queryClient.invalidateQueries({
      queryKey: taskKeys.statistics(),
    });

    // Invalidate active tasks
    queryClient.invalidateQueries({
      queryKey: taskKeys.active(),
    });

    // Invalidate all related entities
    queryClient.invalidateQueries({
      queryKey: serviceOrderKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: observationKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: airbrushingKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: truckKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: changeLogKeys.all,
    });
  };

  // CREATE
  const createMutation = useMutation({
    mutationFn: (data: TaskCreateFormData) => createTask(data),
    onSuccess: (response) => {
      invalidateTasks();

      // Invalidate specific customer if task has customerId
      if (response.data?.customerId) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byCustomer(response.data.customerId),
        });
        queryClient.invalidateQueries({
          queryKey: customerKeys.detail(response.data.customerId),
        });
      }

      // Invalidate specific sector if task has sectorId
      if (response.data?.sectorId) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.bySector(response.data.sectorId),
        });
        queryClient.invalidateQueries({
          queryKey: sectorKeys.detail(response.data.sectorId),
        });
      }

      // Invalidate user-specific queries if task has createdBy
      if (response.data?.createdBy?.id) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byUser(response.data.createdBy.id),
        });
        queryClient.invalidateQueries({
          queryKey: userKeys.detail(response.data.createdBy.id),
        });
      }

      // Invalidate paint queries if task has paintId
      if (response.data?.paintId) {
        queryClient.invalidateQueries({
          queryKey: paintKeys.detail(response.data.paintId),
        });
      }
    },
  });

  // UPDATE
  const updateMutation = useMutation({
    mutationFn: ({ id, data, query }: { id: string; data: TaskUpdateFormData | FormData; query?: TaskQueryFormData }) =>
      updateTask(id, data, query),
    onSuccess: (response, variables) => {
      invalidateTasks();
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.id),
      });

      // Invalidate customer-specific queries
      if (response.data?.customerId) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byCustomer(response.data.customerId),
        });
        queryClient.invalidateQueries({
          queryKey: customerKeys.detail(response.data.customerId),
        });
      }

      // Invalidate sector-specific queries
      if (response.data?.sectorId) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.bySector(response.data.sectorId),
        });
        queryClient.invalidateQueries({
          queryKey: sectorKeys.detail(response.data.sectorId),
        });
      }

      // Invalidate user-specific queries if task has createdBy
      if (response.data?.createdBy?.id) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byUser(response.data.createdBy.id),
        });
        queryClient.invalidateQueries({
          queryKey: userKeys.detail(response.data.createdBy.id),
        });
      }

      // Invalidate paint queries if task has paintId
      if (response.data?.paintId) {
        queryClient.invalidateQueries({
          queryKey: paintKeys.detail(response.data.paintId),
        });
      }

      // Invalidate observation for this task
      queryClient.invalidateQueries({
        queryKey: observationKeys.byTask(variables.id),
      });

      // Invalidate artworks for this task
      queryClient.invalidateQueries({
        queryKey: artworkKeys.byEntity("task", variables.id),
      });
    },
  });

  // DELETE
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      invalidateTasks();

      // Invalidate garage queries since trucks might be affected
      queryClient.invalidateQueries({
        queryKey: garageKeys.all,
      });

      // Invalidate artworks since task might have had attached artworks
      queryClient.invalidateQueries({
        queryKey: artworkKeys.all,
      });
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const error = createMutation.error || updateMutation.error || deleteMutation.error;

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    isLoading,
    error,
    refresh: invalidateTasks,
  };
}

// -------------------------------------
// BATCH MUTATIONS HOOK
// -------------------------------------
export function useTaskBatchMutations() {
  const queryClient = useQueryClient();

  const invalidateTasks = () => {
    // Invalidate main task queries
    queryClient.invalidateQueries({
      queryKey: taskKeys.all,
    });

    // Invalidate statistics
    queryClient.invalidateQueries({
      queryKey: taskKeys.statistics(),
    });

    // Invalidate active tasks
    queryClient.invalidateQueries({
      queryKey: taskKeys.active(),
    });

    // Invalidate all related entities
    queryClient.invalidateQueries({
      queryKey: serviceOrderKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: observationKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: airbrushingKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: truckKeys.all,
    });
    queryClient.invalidateQueries({
      queryKey: changeLogKeys.all,
    });
  };

  // BATCH CREATE
  const batchCreateMutation = useMutation({
    mutationFn: (data: TaskBatchCreateFormData) => batchCreateTasks(data),
    onSuccess: (response) => {
      invalidateTasks();

      // Invalidate customer, sector, user and paint specific queries for affected entities
      if (response.data?.success) {
        const customerIds = new Set(response.data.success.map((task) => task.customerId).filter(Boolean));
        const sectorIds = new Set(response.data.success.map((task) => task.sectorId).filter(Boolean));
        const userIds = new Set(response.data.success.map((task) => task.createdBy?.id).filter(Boolean));
        const paintIds = new Set(response.data.success.map((task) => task.paintId).filter(Boolean));

        customerIds.forEach((customerId) => {
          if (customerId) {
            queryClient.invalidateQueries({
              queryKey: taskKeys.byCustomer(customerId),
            });
            queryClient.invalidateQueries({
              queryKey: customerKeys.detail(customerId),
            });
          }
        });

        sectorIds.forEach((sectorId) => {
          if (sectorId) {
            queryClient.invalidateQueries({
              queryKey: taskKeys.bySector(sectorId),
            });
            queryClient.invalidateQueries({
              queryKey: sectorKeys.detail(sectorId),
            });
          }
        });

        userIds.forEach((userId) => {
          if (userId) {
            queryClient.invalidateQueries({
              queryKey: taskKeys.byUser(userId),
            });
            queryClient.invalidateQueries({
              queryKey: userKeys.detail(userId),
            });
          }
        });

        paintIds.forEach((paintId) => {
          if (paintId) {
            queryClient.invalidateQueries({
              queryKey: paintKeys.detail(paintId),
            });
          }
        });
      }
    },
  });

  // BATCH UPDATE
  const batchUpdateMutation = useMutation({
    mutationFn: (data: TaskBatchUpdateFormData) => batchUpdateTasks(data),
    onSuccess: (response) => {
      invalidateTasks();

      // Invalidate detail queries and related entities for updated tasks
      if (response.data?.success) {
        const customerIds = new Set<string>();
        const sectorIds = new Set<string>();
        const userIds = new Set<string>();
        const paintIds = new Set<string>();

        response.data.success.forEach((task) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.detail(task.id),
          });

          // Invalidate observation for this task
          queryClient.invalidateQueries({
            queryKey: observationKeys.byTask(task.id),
          });

          // Invalidate artworks for this task
          queryClient.invalidateQueries({
            queryKey: artworkKeys.byEntity("task", task.id),
          });

          if (task.customerId) customerIds.add(task.customerId);
          if (task.sectorId) sectorIds.add(task.sectorId);
          if (task.createdBy?.id) userIds.add(task.createdBy.id);
          if (task.paintId) paintIds.add(task.paintId);
        });

        // Invalidate aggregated queries
        customerIds.forEach((customerId) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.byCustomer(customerId),
          });
          queryClient.invalidateQueries({
            queryKey: customerKeys.detail(customerId),
          });
        });

        sectorIds.forEach((sectorId) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.bySector(sectorId),
          });
          queryClient.invalidateQueries({
            queryKey: sectorKeys.detail(sectorId),
          });
        });

        userIds.forEach((userId) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.byUser(userId),
          });
          queryClient.invalidateQueries({
            queryKey: userKeys.detail(userId),
          });
        });

        paintIds.forEach((paintId) => {
          queryClient.invalidateQueries({
            queryKey: paintKeys.detail(paintId),
          });
        });
      }
    },
  });

  // BATCH DELETE
  const batchDeleteMutation = useMutation({
    mutationFn: (data: TaskBatchDeleteFormData) => batchDeleteTasks(data),
    onSuccess: () => {
      invalidateTasks();

      // Invalidate garage queries since trucks might be affected
      queryClient.invalidateQueries({
        queryKey: garageKeys.all,
      });

      // Invalidate artworks since tasks might have had attached artworks
      queryClient.invalidateQueries({
        queryKey: artworkKeys.all,
      });
    },
  });

  const isLoading = batchCreateMutation.isPending || batchUpdateMutation.isPending || batchDeleteMutation.isPending;
  const error = batchCreateMutation.error || batchUpdateMutation.error || batchDeleteMutation.error;

  return {
    batchCreate: batchCreateMutation.mutate,
    batchCreateAsync: batchCreateMutation.mutateAsync,
    batchUpdate: batchUpdateMutation.mutate,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    batchDelete: batchDeleteMutation.mutate,
    batchDeleteAsync: batchDeleteMutation.mutateAsync,
    isLoading,
    error,
    refresh: invalidateTasks,
  };
}

// -------------------------------------
// SPECIAL OPERATIONS
// -------------------------------------
export function useDuplicateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TaskDuplicateFormData) => duplicateTask(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: taskKeys.statistics(),
      });

      // Invalidate queries for all successfully created tasks
      if (response.data?.success && response.data.success.length > 0) {
        const customerIds = new Set<string>();
        const sectorIds = new Set<string>();
        const userIds = new Set<string>();

        response.data.success.forEach((task) => {
          if (task.customerId) customerIds.add(task.customerId);
          if (task.sectorId) sectorIds.add(task.sectorId);
          if (task.createdBy?.id) userIds.add(task.createdBy.id);
        });

        // Invalidate customer queries
        customerIds.forEach((customerId) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.byCustomer(customerId),
          });
        });

        // Invalidate sector queries
        sectorIds.forEach((sectorId) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.bySector(sectorId),
          });
        });

        // Invalidate user queries
        userIds.forEach((userId) => {
          queryClient.invalidateQueries({
            queryKey: taskKeys.byUser(userId),
          });
        });
      }
    },
  });
}

// -------------------------------------
// COMBINED OPERATIONS HOOK
// -------------------------------------
export function useTaskOperations() {
  const mutations = useTaskMutations();
  const batchMutations = useTaskBatchMutations();
  const duplicateMutation = useDuplicateTask();

  return {
    // Single operations
    create: mutations.create,
    createAsync: mutations.createAsync,
    update: mutations.update,
    updateAsync: mutations.updateAsync,
    delete: mutations.delete,
    deleteAsync: mutations.deleteAsync,

    // Batch operations
    batchCreate: batchMutations.batchCreate,
    batchCreateAsync: batchMutations.batchCreateAsync,
    batchUpdate: batchMutations.batchUpdate,
    batchUpdateAsync: batchMutations.batchUpdateAsync,
    batchDelete: batchMutations.batchDelete,
    batchDeleteAsync: batchMutations.batchDeleteAsync,

    // Special operations
    duplicate: duplicateMutation.mutate,
    duplicateAsync: duplicateMutation.mutateAsync,

    // Common
    isLoading: mutations.isLoading || batchMutations.isLoading || duplicateMutation.isPending,
    error: mutations.error || batchMutations.error || duplicateMutation.error,
    refresh: mutations.refresh,
  };
}

// -------------------------------------
// BACKWARD COMPATIBILITY EXPORTS
// -------------------------------------
export function useCreateTask() {
  const { create, createAsync } = useTaskMutations();
  return { mutate: create, mutateAsync: createAsync };
}

export function useUpdateTask(id: string) {
  const { update, updateAsync } = useTaskMutations();
  return {
    mutate: (data: TaskUpdateFormData) => update({ id, data }),
    mutateAsync: (data: TaskUpdateFormData) => updateAsync({ id, data }),
  };
}

export function useDeleteTask() {
  const { delete: deleteTask, deleteAsync } = useTaskMutations();
  return { mutate: deleteTask, mutateAsync: deleteAsync };
}

export function useBatchCreateTasks() {
  const { batchCreate, batchCreateAsync } = useTaskBatchMutations();
  return { mutate: batchCreate, mutateAsync: batchCreateAsync };
}

export function useBatchUpdateTasks() {
  const { batchUpdate, batchUpdateAsync } = useTaskBatchMutations();
  return { mutate: batchUpdate, mutateAsync: batchUpdateAsync };
}

export function useBatchDeleteTasks() {
  const { batchDelete, batchDeleteAsync } = useTaskBatchMutations();
  return { mutate: batchDelete, mutateAsync: batchDeleteAsync };
}

// -------------------------------------
// URL STATE MANAGEMENT
// -------------------------------------
export { useTaskFormUrlState } from "./task/use-task-form-url-state";
