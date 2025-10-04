// packages/hooks/src/usePosition.ts

import { getPositions, getPositionById, createPosition, updatePosition, deletePosition, batchCreatePositions, batchUpdatePositions, batchDeletePositions } from "../api-client";
import type {
  PositionGetManyFormData,
  PositionCreateFormData,
  PositionUpdateFormData,
  PositionBatchCreateFormData,
  PositionBatchUpdateFormData,
  PositionBatchDeleteFormData,
  PositionInclude,
} from "../schemas";
import type {
  PositionGetManyResponse,
  PositionGetUniqueResponse,
  PositionCreateResponse,
  PositionUpdateResponse,
  PositionDeleteResponse,
  PositionBatchCreateResponse,
  PositionBatchUpdateResponse,
  PositionBatchDeleteResponse,
} from "../types";
import { positionKeys, userKeys, changeLogKeys } from "./queryKeys";
import { createEntityHooks } from "./createEntityHooks";

// =====================================================
// Position Service Adapter
// =====================================================

const positionService = {
  getMany: (params?: PositionGetManyFormData) => getPositions(params || {}),
  getById: (id: string, params?: any) => getPositionById(id, params),
  create: (data: PositionCreateFormData, include?: PositionInclude) => createPosition(data, include ? { include } : undefined),
  update: (id: string, data: PositionUpdateFormData, include?: PositionInclude) => updatePosition(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePosition(id),
  batchCreate: (data: PositionBatchCreateFormData, include?: PositionInclude) => batchCreatePositions(data, include ? { include } : undefined),
  batchUpdate: (data: PositionBatchUpdateFormData, include?: PositionInclude) => batchUpdatePositions(data, include ? { include } : undefined),
  batchDelete: (data: PositionBatchDeleteFormData) => batchDeletePositions(data),
};

// =====================================================
// Base Position Hooks
// =====================================================

const basePositionHooks = createEntityHooks<
  PositionGetManyFormData,
  PositionGetManyResponse,
  PositionGetUniqueResponse,
  PositionCreateFormData,
  PositionCreateResponse,
  PositionUpdateFormData,
  PositionUpdateResponse,
  PositionDeleteResponse,
  PositionBatchCreateFormData,
  PositionBatchCreateResponse<PositionCreateFormData>,
  PositionBatchUpdateFormData,
  PositionBatchUpdateResponse<PositionUpdateFormData>,
  PositionBatchDeleteFormData,
  PositionBatchDeleteResponse
>({
  queryKeys: positionKeys,
  service: positionService,
  staleTime: 1000 * 60 * 10, // 10 minutes - positions don't change often
  relatedQueryKeys: [userKeys, changeLogKeys], // Invalidate users and change logs when positions change
});

// Export base hooks with standard names
export const usePositionsInfinite = basePositionHooks.useInfiniteList;
export const usePositions = basePositionHooks.useList;
export const usePosition = basePositionHooks.useDetail;
export const usePositionMutations = basePositionHooks.useMutations;
export const usePositionBatchMutations = basePositionHooks.useBatchMutations;
