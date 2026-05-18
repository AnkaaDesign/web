// packages/hooks/src/use-topic.ts
//
// Topic hooks: CRUD + batch via createEntityHooks, plus the specialised
// `useUpsertTopicLevels` for PUT /topic/:id/levels.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic,
  upsertTopicLevels,
  batchCreateTopics,
  batchUpdateTopics,
  batchDeleteTopics,
} from "../../api-client";
import type {
  TopicGetManyFormData,
  TopicCreateFormData,
  TopicUpdateFormData,
  TopicLevelsUpsertFormData,
  TopicBatchCreateFormData,
  TopicBatchUpdateFormData,
  TopicBatchDeleteFormData,
  TopicIncludes,
  TopicGetManyResponse,
  TopicGetUniqueResponse,
  TopicCreateResponse,
  TopicUpdateResponse,
  TopicDeleteResponse,
  TopicLevelsUpsertResponse,
  TopicBatchCreateResponse,
  TopicBatchUpdateResponse,
  TopicBatchDeleteResponse,
  Topic,
} from "../../types";
import { topicKeys, skillKeys, assessmentKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Service adapter
// =====================================================

const topicServiceAdapter = {
  getMany: (params?: TopicGetManyFormData) => getTopics(params || {}),
  getById: (id: string, params?: any) => getTopicById(id, params),
  create: (data: TopicCreateFormData, include?: TopicIncludes) =>
    createTopic(data, include ? { include } : undefined),
  update: (id: string, data: TopicUpdateFormData, include?: TopicIncludes) =>
    updateTopic(id, data, include ? { include } : undefined),
  delete: (id: string) => deleteTopic(id),
  batchCreate: (data: TopicBatchCreateFormData, include?: TopicIncludes) =>
    batchCreateTopics(data, include ? { include } : undefined),
  batchUpdate: (data: TopicBatchUpdateFormData, include?: TopicIncludes) =>
    batchUpdateTopics(data, include ? { include } : undefined),
  batchDelete: (data: TopicBatchDeleteFormData) => batchDeleteTopics(data),
};

// =====================================================
// Base hooks via factory
// =====================================================

const baseTopicHooks = createEntityHooks<
  TopicGetManyFormData,
  TopicGetManyResponse,
  TopicGetUniqueResponse,
  TopicCreateFormData,
  TopicCreateResponse,
  TopicUpdateFormData,
  TopicUpdateResponse,
  TopicDeleteResponse,
  TopicBatchCreateFormData,
  TopicBatchCreateResponse<Topic>,
  TopicBatchUpdateFormData,
  TopicBatchUpdateResponse<Topic>,
  TopicBatchDeleteFormData,
  TopicBatchDeleteResponse
>({
  queryKeys: topicKeys,
  service: topicServiceAdapter,
  staleTime: 1000 * 60 * 10,
  relatedQueryKeys: [skillKeys, assessmentKeys],
});

export const useTopicsInfinite = baseTopicHooks.useInfiniteList;
export const useTopics = baseTopicHooks.useList;
export const useTopic = baseTopicHooks.useDetail;
export const useTopicMutations = baseTopicHooks.useMutations;
export const useTopicBatchMutations = baseTopicHooks.useBatchMutations;

// =====================================================
// Specialised hook: PUT /topic/:id/levels
// =====================================================

/**
 * Upserts the 6 TopicLevel rows (score 0..5) for a single topic.
 * On success invalidates the topic detail (so the new levels are eager-loaded
 * next render) plus the topic list (in case _count.levels changed).
 */
export function useUpsertTopicLevels(topicId: string) {
  const queryClient = useQueryClient();
  return useMutation<TopicLevelsUpsertResponse, Error, TopicLevelsUpsertFormData>({
    mutationFn: (data: TopicLevelsUpsertFormData) => upsertTopicLevels(topicId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: topicKeys.detail(topicId) });
      queryClient.invalidateQueries({ queryKey: topicKeys.lists() });
      queryClient.invalidateQueries({ queryKey: topicKeys.levels(topicId) });
    },
  });
}
