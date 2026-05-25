// packages/hooks/src/use-assessment-entry.ts
//
// AssessmentEntry hooks: queue listing, detail (with eager-loaded responses),
// batch-upsert responses, submit, reopen, plus the leader-convenience
// `useMyPendingAssessmentEntries`.
//
// AssessmentEntry has NO create/delete from the client — entries are spawned
// server-side when the parent Assessment is opened. We hand-roll because the
// surface doesn't match the createEntityHooks CRUD contract.

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getAssessmentEntries,
  getAssessmentEntryById,
  upsertAssessmentEntryResponses,
  updateAssessmentEntryMeta,
  submitAssessmentEntry,
  reopenAssessmentEntry,
} from "../../api-client";
import type {
  AssessmentEntryGetManyFormData,
  AssessmentEntryQueryFormData,
  AssessmentEntryUpdateFormData,
  AssessmentEntryResponsesUpsertFormData,
  AssessmentEntryIncludes,
  AssessmentEntryGetManyResponse,
  AssessmentEntryGetUniqueResponse,
  AssessmentEntryUpdateResponse,
} from "../../types";
import { ASSESSMENT_ENTRY_STATUS } from "../../constants";
import { assessmentEntryKeys, assessmentKeys } from "../common/query-keys";

// =====================================================
// Query: list (queue)
// =====================================================

/**
 * Generic queue listing. Use this for admin views.
 * Leaders should use `useMyPendingAssessmentEntries` below.
 */
export function useAssessmentEntries(
  params?: AssessmentEntryGetManyFormData,
  options?: Omit<UseQueryOptions<AssessmentEntryGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: assessmentEntryKeys.list(params),
    queryFn: () => getAssessmentEntries(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Default include for the leader's fill UI — pulls the assessment header,
 * evaluatee identity, and existing responses (with topic).
 */
const ENTRY_DETAIL_INCLUDE: AssessmentEntryIncludes = {
  assessment: true,
  evaluatee: true,
  evaluator: true,
  responses: { include: { topic: true } },
};

/**
 * Fetches a single AssessmentEntry with all responses + evaluatee/evaluator
 * eager-loaded. Used by the leader fill page.
 */
export function useAssessmentEntry(
  entryId: string | undefined,
  params?: AssessmentEntryQueryFormData,
  options?: Omit<UseQueryOptions<AssessmentEntryGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  const effective: AssessmentEntryQueryFormData = params ?? { include: ENTRY_DETAIL_INCLUDE };
  return useQuery({
    queryKey: assessmentEntryKeys.detail(entryId ?? "", effective.include),
    queryFn: () => getAssessmentEntryById(entryId as string, effective),
    enabled: !!entryId,
    staleTime: 1000 * 30,
    ...options,
  });
}

/**
 * Convenience for sector leaders: lists every entry assigned to me whose
 * status is PENDING or IN_PROGRESS.
 *
 * API resolves `evaluatorId: 'me'` to the authenticated user id.
 */
export function useMyPendingAssessmentEntries(
  extraParams?: Omit<AssessmentEntryGetManyFormData, "evaluatorId" | "status">,
  options?: Omit<UseQueryOptions<AssessmentEntryGetManyResponse>, "queryKey" | "queryFn">,
) {
  const params: AssessmentEntryGetManyFormData = {
    ...extraParams,
    evaluatorId: "me",
    status: [ASSESSMENT_ENTRY_STATUS.PENDING, ASSESSMENT_ENTRY_STATUS.IN_PROGRESS],
    include: extraParams?.include ?? {
      assessment: true,
      evaluatee: true,
      _count: { select: { responses: true } },
    },
  };
  return useQuery({
    queryKey: assessmentEntryKeys.myPending(),
    queryFn: () => getAssessmentEntries(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

// =====================================================
// Mutations: responses upsert / meta update / submit / reopen
// =====================================================

/**
 * Batch-upserts the entry's responses by topicId. Server flips status
 * PENDING -> IN_PROGRESS if responses arrive.
 *
 * Bound to a specific entryId so consumers don't have to thread it through
 * every call.
 */
export function useBatchUpsertResponses(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    AssessmentEntryGetUniqueResponse,
    Error,
    AssessmentEntryResponsesUpsertFormData & { suppressToast?: boolean }
  >({
    mutationFn: ({ suppressToast, ...data }) =>
      upsertAssessmentEntryResponses(entryId, data, { suppressToast }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.detail(entryId) });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.myPending() });
    },
  });
}

/**
 * Patches entry metadata (currently just `notes`).
 */
export function useUpdateAssessmentEntryMeta(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    AssessmentEntryUpdateResponse,
    Error,
    AssessmentEntryUpdateFormData & { suppressToast?: boolean }
  >({
    mutationFn: ({ suppressToast, ...data }) =>
      updateAssessmentEntryMeta(entryId, data, { suppressToast }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.detail(entryId) });
    },
  });
}

/**
 * Marks the entry SUBMITTED. API enforces that every topic has a response.
 * Invalidates the parent assessment analytics too (counts change).
 */
export function useSubmitAssessmentEntry(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation<AssessmentEntryGetUniqueResponse, Error, void>({
    mutationFn: () => submitAssessmentEntry(entryId),
    onSuccess: (res) => {
      const assessmentId = res?.data?.assessmentId;
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.detail(entryId) });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.myPending() });
      if (assessmentId) {
        queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(assessmentId) });
        queryClient.invalidateQueries({ queryKey: assessmentKeys.analytics(assessmentId) });
      }
    },
  });
}

/**
 * Admin-only: reopens a SUBMITTED entry back to IN_PROGRESS so the leader can
 * edit it.
 */
export function useReopenAssessmentEntry(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation<AssessmentEntryGetUniqueResponse, Error, void>({
    mutationFn: () => reopenAssessmentEntry(entryId),
    onSuccess: (res) => {
      const assessmentId = res?.data?.assessmentId;
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.detail(entryId) });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.myPending() });
      if (assessmentId) {
        queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(assessmentId) });
        queryClient.invalidateQueries({ queryKey: assessmentKeys.analytics(assessmentId) });
      }
    },
  });
}
