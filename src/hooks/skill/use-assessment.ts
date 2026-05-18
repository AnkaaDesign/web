// packages/hooks/src/use-assessment.ts
//
// Assessment hooks (campaigns). The API exposes CRUD + lifecycle transitions
// (open/close/cancel) + analytics, but NO batch endpoints — so we hand-roll
// the hooks rather than using createEntityHooks (which always wires batch).

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  openAssessment,
  closeAssessment,
  cancelAssessment,
  getAssessmentAnalytics,
} from "../../api-client";
import type {
  AssessmentGetManyFormData,
  AssessmentQueryFormData,
  AssessmentCreateFormData,
  AssessmentUpdateFormData,
  AssessmentGetManyResponse,
  AssessmentGetUniqueResponse,
  AssessmentCreateResponse,
  AssessmentUpdateResponse,
  AssessmentDeleteResponse,
  AssessmentAnalyticsResponse,
} from "../../types";
import { assessmentKeys, assessmentEntryKeys } from "../common/query-keys";

// =====================================================
// Query hooks
// =====================================================

/**
 * Lists assessments. Pass filters as a regular object — they go through the
 * shared paramsSerializer (web/src/api-client/axiosClient.ts) so nested
 * `where` clauses are JSON-stringified per the repo's rule.
 */
export function useAssessments(
  params?: AssessmentGetManyFormData,
  options?: Omit<UseQueryOptions<AssessmentGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: assessmentKeys.list(params),
    queryFn: () => getAssessments(params),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useAssessment(
  id: string | undefined,
  params?: AssessmentQueryFormData,
  options?: Omit<UseQueryOptions<AssessmentGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: assessmentKeys.detail(id ?? "", params?.include),
    queryFn: () => getAssessmentById(id as string, params),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

// =====================================================
// Mutation hooks: CRUD
// =====================================================

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation<
    AssessmentCreateResponse,
    Error,
    { data: AssessmentCreateFormData; query?: AssessmentQueryFormData }
  >({
    mutationFn: ({ data, query }) => createAssessment(data, query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation<
    AssessmentUpdateResponse,
    Error,
    { id: string; data: AssessmentUpdateFormData; query?: AssessmentQueryFormData }
  >({
    mutationFn: ({ id, data, query }) => updateAssessment(id, data, query),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation<AssessmentDeleteResponse, Error, string>({
    mutationFn: (id: string) => deleteAssessment(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
    },
  });
}

// =====================================================
// Lifecycle transitions: open / close / cancel
// =====================================================

/**
 * Opens the assessment: DRAFT -> OPEN. Spawns AssessmentEntry rows
 * (one per evaluatee × their sector leader) — so the entry queue MUST be
 * invalidated too.
 */
export function useOpenAssessment() {
  const queryClient = useQueryClient();
  return useMutation<AssessmentGetUniqueResponse, Error, string>({
    mutationFn: (id: string) => openAssessment(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
      // Entries were just created — refresh the whole entry surface.
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.all });
    },
  });
}

/**
 * Closes the assessment: OPEN -> CLOSED. Existing entries remain read-only.
 */
export function useCloseAssessment() {
  const queryClient = useQueryClient();
  return useMutation<AssessmentGetUniqueResponse, Error, string>({
    mutationFn: (id: string) => closeAssessment(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.all });
    },
  });
}

/**
 * Cancels the assessment: status -> CANCELLED. Entries can no longer accept input.
 */
export function useCancelAssessment() {
  const queryClient = useQueryClient();
  return useMutation<AssessmentGetUniqueResponse, Error, string>({
    mutationFn: (id: string) => cancelAssessment(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: assessmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assessmentEntryKeys.all });
    },
  });
}

// =====================================================
// Analytics
// =====================================================

/**
 * Fetches the per-evaluatee + per-topic distribution analytics for the
 * assessment. Used by the admin dashboard.
 */
export function useAssessmentAnalytics(
  assessmentId: string | undefined,
  options?: Omit<UseQueryOptions<AssessmentAnalyticsResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: assessmentKeys.analytics(assessmentId ?? ""),
    queryFn: () => getAssessmentAnalytics(assessmentId as string),
    enabled: !!assessmentId,
    staleTime: 1000 * 30, // 30s — refresh fairly often during a live campaign
    ...options,
  });
}
