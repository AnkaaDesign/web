// hooks/questionnaire/use-questionnaire.ts
//
// Questionnaire catalogue (group / question) + campaign hooks. Mirrors the
// skill-assessment hooks. Toasts come from the axios interceptor.

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getQuestionnaireGroups,
  getQuestionnaireGroupById,
  createQuestionnaireGroup,
  updateQuestionnaireGroup,
  deleteQuestionnaireGroup,
  getQuestionnaireQuestions,
  getQuestionnaireQuestionById,
  createQuestionnaireQuestion,
  updateQuestionnaireQuestion,
  deleteQuestionnaireQuestion,
  upsertQuestionnaireQuestionOptions,
  getQuestionnaires,
  getQuestionnaireById,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  openQuestionnaire,
  closeQuestionnaire,
  cancelQuestionnaire,
  getQuestionnaireResults,
} from "../../api-client";
import type {
  QuestionnaireGroupGetManyFormData,
  QuestionnaireGroupQueryFormData,
  QuestionnaireGroupCreateFormData,
  QuestionnaireGroupUpdateFormData,
  QuestionnaireGroupGetManyResponse,
  QuestionnaireGroupGetUniqueResponse,
  QuestionnaireQuestionGetManyFormData,
  QuestionnaireQuestionQueryFormData,
  QuestionnaireQuestionCreateFormData,
  QuestionnaireQuestionUpdateFormData,
  QuestionnaireOptionsUpsertFormData,
  QuestionnaireQuestionGetManyResponse,
  QuestionnaireQuestionGetUniqueResponse,
  QuestionnaireGetManyFormData,
  QuestionnaireQueryFormData,
  QuestionnaireCreateFormData,
  QuestionnaireUpdateFormData,
  QuestionnaireGetManyResponse,
  QuestionnaireGetUniqueResponse,
  QuestionnaireResultsResponse,
} from "../../types";
import {
  questionnaireGroupKeys,
  questionnaireQuestionKeys,
  questionnaireKeys,
  questionnaireEntryKeys,
} from "../common/query-keys";

// ===================== GROUPS =====================

export function useQuestionnaireGroups(
  params?: QuestionnaireGroupGetManyFormData,
  options?: Omit<UseQueryOptions<QuestionnaireGroupGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireGroupKeys.list(params),
    queryFn: () => getQuestionnaireGroups(params),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useQuestionnaireGroup(
  id: string | undefined,
  params?: QuestionnaireGroupQueryFormData,
  options?: Omit<UseQueryOptions<QuestionnaireGroupGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireGroupKeys.detail(id ?? "", params?.include),
    queryFn: () => getQuestionnaireGroupById(id as string, params),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useCreateQuestionnaireGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireGroupCreateFormData) => createQuestionnaireGroup(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireGroupKeys.lists() }),
  });
}

export function useUpdateQuestionnaireGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireGroupUpdateFormData) => updateQuestionnaireGroup(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionnaireGroupKeys.detail(id) });
      qc.invalidateQueries({ queryKey: questionnaireGroupKeys.lists() });
    },
  });
}

export function useDeleteQuestionnaireGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuestionnaireGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireGroupKeys.lists() }),
  });
}

// ===================== QUESTIONS =====================

export function useQuestionnaireQuestions(
  params?: QuestionnaireQuestionGetManyFormData,
  options?: Omit<UseQueryOptions<QuestionnaireQuestionGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireQuestionKeys.list(params),
    queryFn: () => getQuestionnaireQuestions(params),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useQuestionnaireQuestion(
  id: string | undefined,
  params?: QuestionnaireQuestionQueryFormData,
  options?: Omit<UseQueryOptions<QuestionnaireQuestionGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireQuestionKeys.detail(id ?? "", params?.include),
    queryFn: () => getQuestionnaireQuestionById(id as string, params),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useCreateQuestionnaireQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireQuestionCreateFormData) => createQuestionnaireQuestion(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireQuestionKeys.lists() }),
  });
}

export function useUpdateQuestionnaireQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireQuestionUpdateFormData) => updateQuestionnaireQuestion(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionnaireQuestionKeys.detail(id) });
      qc.invalidateQueries({ queryKey: questionnaireQuestionKeys.lists() });
    },
  });
}

export function useDeleteQuestionnaireQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuestionnaireQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireQuestionKeys.lists() }),
  });
}

export function useUpsertQuestionnaireQuestionOptions(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireOptionsUpsertFormData) => upsertQuestionnaireQuestionOptions(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionnaireQuestionKeys.detail(id) });
      qc.invalidateQueries({ queryKey: questionnaireQuestionKeys.lists() });
    },
  });
}

// ===================== CAMPAIGN =====================

export function useQuestionnaires(
  params?: QuestionnaireGetManyFormData,
  options?: Omit<UseQueryOptions<QuestionnaireGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireKeys.list(params),
    queryFn: () => getQuestionnaires(params),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useQuestionnaire(
  id: string | undefined,
  params?: QuestionnaireQueryFormData,
  options?: Omit<UseQueryOptions<QuestionnaireGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireKeys.detail(id ?? "", params?.include),
    queryFn: () => getQuestionnaireById(id as string, params),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useCreateQuestionnaire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireCreateFormData) => createQuestionnaire(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireKeys.lists() }),
  });
}

export function useUpdateQuestionnaire(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionnaireUpdateFormData) => updateQuestionnaire(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionnaireKeys.detail(id) });
      qc.invalidateQueries({ queryKey: questionnaireKeys.lists() });
    },
  });
}

export function useDeleteQuestionnaire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuestionnaire(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireKeys.lists() }),
  });
}

function useLifecycleMutation(action: (id: string) => Promise<QuestionnaireGetUniqueResponse>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: (res) => {
      const id = res?.data?.id;
      if (id) qc.invalidateQueries({ queryKey: questionnaireKeys.detail(id) });
      qc.invalidateQueries({ queryKey: questionnaireKeys.lists() });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.all });
    },
  });
}

// Aggregated, identity-free results — used by the anonymous results view.
export function useQuestionnaireResults(
  id: string,
  options?: Omit<UseQueryOptions<QuestionnaireResultsResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["questionnaire", "results", id],
    queryFn: () => getQuestionnaireResults(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useOpenQuestionnaire() {
  return useLifecycleMutation(openQuestionnaire);
}
export function useCloseQuestionnaire() {
  return useLifecycleMutation(closeQuestionnaire);
}
export function useCancelQuestionnaire() {
  return useLifecycleMutation(cancelQuestionnaire);
}
