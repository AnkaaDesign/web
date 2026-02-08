// packages/hooks/src/useChangelog.ts

import {
  getChangeLogs,
  getChangeLogById,
  createChangeLog,
  updateChangeLog,
  deleteChangeLog,
  batchCreateChangeLogs,
  batchUpdateChangeLogs,
  batchDeleteChangeLogs,
} from "../../api-client";
import type {
  ChangeLogGetManyFormData,
  ChangeLogCreateFormData,
  ChangeLogUpdateFormData,
  ChangeLogBatchCreateFormData,
  ChangeLogBatchUpdateFormData,
  ChangeLogBatchDeleteFormData,
} from "../../schemas";
import type {
  ChangeLogGetManyResponse,
  ChangeLogGetUniqueResponse,
  ChangeLogCreateResponse,
  ChangeLogUpdateResponse,
  ChangeLogDeleteResponse,
  ChangeLogBatchCreateResponse,
  ChangeLogBatchUpdateResponse,
  ChangeLogBatchDeleteResponse,
} from "../../types";
import { changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// ChangeLog Service Adapter
// =====================================================

const changeLogService = {
  getMany: getChangeLogs,
  getById: getChangeLogById,
  create: createChangeLog,
  update: updateChangeLog,
  delete: deleteChangeLog,
  batchCreate: batchCreateChangeLogs,
  batchUpdate: batchUpdateChangeLogs,
  batchDelete: batchDeleteChangeLogs,
};

// =====================================================
// Base ChangeLog Hooks
// =====================================================

const baseChangeLogHooks = createEntityHooks<
  ChangeLogGetManyFormData,
  ChangeLogGetManyResponse,
  ChangeLogGetUniqueResponse,
  ChangeLogCreateFormData,
  ChangeLogCreateResponse,
  ChangeLogUpdateFormData,
  ChangeLogUpdateResponse,
  ChangeLogDeleteResponse,
  ChangeLogBatchCreateFormData,
  ChangeLogBatchCreateResponse<ChangeLogCreateFormData>,
  ChangeLogBatchUpdateFormData,
  ChangeLogBatchUpdateResponse<ChangeLogUpdateFormData>,
  ChangeLogBatchDeleteFormData,
  ChangeLogBatchDeleteResponse
>({
  queryKeys: changeLogKeys,
  service: changeLogService,
  staleTime: 1000 * 60 * 5, // 5 minutes - changelogs are historical data
  relatedQueryKeys: [], // ChangeLogs are audit records, they don't affect other entities
});

// Export base hooks with standard names
export const useChangeLogsInfinite = baseChangeLogHooks.useInfiniteList;
export const useChangeLogs = baseChangeLogHooks.useList;
export const useChangeLog = baseChangeLogHooks.useDetail;
export const useChangeLogMutations = baseChangeLogHooks.useMutations;
export const useChangeLogBatchMutations = baseChangeLogHooks.useBatchMutations;
