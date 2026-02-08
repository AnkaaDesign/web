// packages/hooks/src/useActivity.ts

import {
  createActivity,
  deleteActivity,
  getActivityById,
  getActivities,
  updateActivity,
  batchCreateActivities,
  batchUpdateActivities,
  batchDeleteActivities,
} from "../../api-client";
import type {
  ActivityCreateFormData,
  ActivityUpdateFormData,
  ActivityGetManyFormData,
  ActivityBatchCreateFormData,
  ActivityBatchUpdateFormData,
  ActivityBatchDeleteFormData,
  ActivityInclude,
} from "../../schemas";
import type {
  Activity,
  ActivityGetManyResponse,
  ActivityGetUniqueResponse,
  ActivityCreateResponse,
  ActivityUpdateResponse,
  ActivityDeleteResponse,
  ActivityBatchCreateResponse,
  ActivityBatchUpdateResponse,
  ActivityBatchDeleteResponse,
} from "../../types";
import { activityKeys, itemKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Activity Service Adapter
// =====================================================

const activityService = {
  getMany: (params?: ActivityGetManyFormData) => {
    // Filter out empty include objects
    if (params?.include && Object.keys(params.include).length === 0) {
      const { include, ...restParams } = params;
      return getActivities(restParams);
    }
    return getActivities(params || {});
  },
  getById: (id: string, params?: any) => getActivityById(id, params),
  create: (data: ActivityCreateFormData, include?: ActivityInclude) => createActivity(data, include ? { include } : undefined),
  update: (id: string, data: ActivityUpdateFormData, include?: ActivityInclude) => updateActivity(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteActivity(id),
  batchCreate: (data: ActivityBatchCreateFormData, include?: ActivityInclude) => batchCreateActivities(data, include ? { include } : undefined),
  batchUpdate: (data: ActivityBatchUpdateFormData, include?: ActivityInclude) => batchUpdateActivities(data, include ? { include } : undefined),
  batchDelete: (data: ActivityBatchDeleteFormData) => batchDeleteActivities(data),
};

// =====================================================
// Base Activity Hooks
// =====================================================

const baseHooks = createEntityHooks<
  ActivityGetManyFormData,
  ActivityGetManyResponse,
  ActivityGetUniqueResponse,
  ActivityCreateFormData,
  ActivityCreateResponse,
  ActivityUpdateFormData,
  ActivityUpdateResponse,
  ActivityDeleteResponse,
  ActivityBatchCreateFormData,
  ActivityBatchCreateResponse<Activity>,
  ActivityBatchUpdateFormData,
  ActivityBatchUpdateResponse<Activity>,
  ActivityBatchDeleteFormData,
  ActivityBatchDeleteResponse
>({
  queryKeys: activityKeys,
  service: activityService,
  staleTime: 1000 * 60 * 3, // 3 minutes since activities change frequently
  relatedQueryKeys: [itemKeys, changeLogKeys], // Activities affect item quantities and are tracked in change logs
});

// Export base hooks with standard names
export const useActivitiesInfinite = baseHooks.useInfiniteList;
export const useActivities = baseHooks.useList;
export const useActivity = baseHooks.useDetail;
export const useActivityMutations = baseHooks.useMutations;
export const useActivityBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

// Re-export mutations with legacy names if needed
export { useActivityMutations as useActivityCrud };
export { useActivityBatchMutations as useActivityBatchOperations };
