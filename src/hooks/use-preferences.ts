// packages/hooks/src/usePreference.ts

import {
  getPreferences,
  getPreferencesById,
  createPreferences,
  updatePreferences,
  deletePreferences,
  batchCreatePreferences,
  batchUpdatePreferences,
  batchDeletePreferences,
} from "../api-client";
import type {
  PreferencesQueryFormData,
  PreferencesCreateFormData,
  PreferencesUpdateFormData,
  PreferencesBatchCreateFormData,
  PreferencesBatchUpdateFormData,
  PreferencesBatchDeleteFormData,
  PreferencesInclude,
} from "../schemas";
import type { Preferences, SuccessResponse, PaginatedResponse, DeleteResponse, BatchCreateResponse, BatchUpdateResponse, BatchDeleteResponse } from "../types";
import { preferencesKeys } from "./query-keys";
import { createEntityHooks } from "./create-entity-hooks";

// =====================================================
// Preferences Service Adapter
// =====================================================

const preferencesService = {
  getMany: (params?: PreferencesQueryFormData) => getPreferences(params || {}),
  getById: (id: string, params?: any) => getPreferencesById(id, params),
  create: (data: PreferencesCreateFormData, include?: PreferencesInclude) => createPreferences(data, include ? { include } : undefined),
  update: (id: string, data: PreferencesUpdateFormData, include?: PreferencesInclude) => updatePreferences(id, data, include ? { include } : undefined),
  delete: (id: string) => deletePreferences(id),
  batchCreate: (data: PreferencesBatchCreateFormData, include?: PreferencesInclude) => batchCreatePreferences(data, include ? { include } : undefined),
  batchUpdate: (data: PreferencesBatchUpdateFormData, include?: PreferencesInclude) => batchUpdatePreferences(data, include ? { include } : undefined),
  batchDelete: (data: PreferencesBatchDeleteFormData) => batchDeletePreferences(data),
};

// =====================================================
// Base Preferences Hooks
// =====================================================

const basePreferencesHooks = createEntityHooks<
  PreferencesQueryFormData,
  PaginatedResponse<Preferences>,
  SuccessResponse<Preferences>,
  PreferencesCreateFormData,
  SuccessResponse<Preferences>,
  PreferencesUpdateFormData,
  SuccessResponse<Preferences>,
  DeleteResponse,
  PreferencesBatchCreateFormData,
  BatchCreateResponse<Preferences, PreferencesCreateFormData>,
  PreferencesBatchUpdateFormData,
  BatchUpdateResponse<Preferences, PreferencesUpdateFormData>,
  PreferencesBatchDeleteFormData,
  BatchDeleteResponse
>({
  queryKeys: preferencesKeys,
  service: preferencesService,
  staleTime: 1000 * 60 * 10, // 10 minutes since preferences don't change often
});

// Export base hooks with standard names
export const usePreferencesInfinite = basePreferencesHooks.useInfiniteList;
export const usePreferences = basePreferencesHooks.useList;
export const usePreference = basePreferencesHooks.useDetail;
export const usePreferenceMutations = basePreferencesHooks.useMutations;
export const usePreferenceBatchMutations = basePreferencesHooks.useBatchMutations;

// =====================================================
// Backward Compatibility Exports
// =====================================================

// Legacy mutation hooks for Preferences
export const useCreatePreferences = () => {
  const mutations = usePreferenceMutations();
  return mutations.createMutation;
};

export const useUpdatePreferences = () => {
  const mutations = usePreferenceMutations();
  return {
    mutate: ({ id, data }: { id: string; data: PreferencesUpdateFormData }) => mutations.update({ id, data }),
    mutateAsync: ({ id, data }: { id: string; data: PreferencesUpdateFormData }) => mutations.updateAsync({ id, data }),
    isPending: mutations.updateMutation.isPending,
    isError: mutations.updateMutation.isError,
    error: mutations.updateMutation.error,
  };
};

export const useDeletePreferences = () => {
  const mutations = usePreferenceMutations();
  return mutations.deleteMutation;
};

export const useBatchCreatePreferences = () => {
  const mutations = usePreferenceBatchMutations();
  return mutations.batchCreateMutation;
};

export const useBatchUpdatePreferences = () => {
  const mutations = usePreferenceBatchMutations();
  return mutations.batchUpdateMutation;
};

export const useBatchDeletePreferences = () => {
  const mutations = usePreferenceBatchMutations();
  return mutations.batchDeleteMutation;
};
