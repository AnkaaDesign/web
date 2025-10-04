import { createEntityHooks } from "./createEntityHooks";
import { paintTypeKeys, paintKeys } from "./queryKeys";
import {
  getPaintTypes,
  getPaintTypeById,
  createPaintType,
  updatePaintType,
  deletePaintType,
  batchCreatePaintTypes,
  batchUpdatePaintTypes,
  batchDeletePaintTypes,
} from "../api-client";
import type {
  PaintTypeGetManyFormData,
  PaintTypeCreateFormData,
  PaintTypeUpdateFormData,
  PaintTypeBatchCreateFormData,
  PaintTypeBatchUpdateFormData,
  PaintTypeBatchDeleteFormData,
  PaintTypeInclude,
} from "../schemas";
import type {
  PaintTypeGetManyResponse,
  PaintTypeGetUniqueResponse,
  PaintTypeCreateResponse,
  PaintTypeUpdateResponse,
  PaintTypeDeleteResponse,
  PaintTypeBatchCreateResponse,
  PaintTypeBatchUpdateResponse,
  PaintTypeBatchDeleteResponse,
} from "../types";

// Service adapter
const paintTypeServiceAdapter = {
  getMany: (params?: PaintTypeGetManyFormData) => getPaintTypes(params || {}),
  getById: (id: string, params?: any) => getPaintTypeById(id, params),
  create: (data: PaintTypeCreateFormData, include?: PaintTypeInclude) => createPaintType(data, include ? { include } : undefined),
  update: (id: string, data: PaintTypeUpdateFormData, include?: PaintTypeInclude) => updatePaintType(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePaintType(id),
  batchCreate: (data: PaintTypeBatchCreateFormData, include?: PaintTypeInclude) => batchCreatePaintTypes(data, include ? { include } : undefined),
  batchUpdate: (data: PaintTypeBatchUpdateFormData, include?: PaintTypeInclude) => batchUpdatePaintTypes(data, include ? { include } : undefined),
  batchDelete: (data: PaintTypeBatchDeleteFormData) => batchDeletePaintTypes(data),
};

// Create hooks using the factory
export const paintTypeHooks = createEntityHooks<
  PaintTypeGetManyFormData,
  PaintTypeGetManyResponse,
  PaintTypeGetUniqueResponse,
  PaintTypeCreateFormData,
  PaintTypeCreateResponse,
  PaintTypeUpdateFormData,
  PaintTypeUpdateResponse,
  PaintTypeDeleteResponse,
  PaintTypeBatchCreateFormData,
  PaintTypeBatchCreateResponse<PaintTypeCreateFormData>,
  PaintTypeBatchUpdateFormData,
  PaintTypeBatchUpdateResponse<PaintTypeUpdateFormData & { id: string }>,
  PaintTypeBatchDeleteFormData,
  PaintTypeBatchDeleteResponse
>({
  queryKeys: paintTypeKeys,
  service: paintTypeServiceAdapter,
  relatedQueryKeys: [paintKeys],
});

// Export individual hooks
export const {
  useInfiniteList: useInfinitePaintTypes,
  useList: usePaintTypes,
  useDetail: usePaintType,
  useMutations: usePaintTypeMutations,
  useBatchMutations: usePaintTypeBatchMutations,
} = paintTypeHooks;

// Re-export types for convenience
export type { PaintType, PaintTypeGetManyResponse, PaintTypeCreateResponse, PaintTypeUpdateResponse } from "../types";

export type { PaintTypeGetManyFormData, PaintTypeGetByIdFormData, PaintTypeCreateFormData, PaintTypeUpdateFormData } from "../schemas";
