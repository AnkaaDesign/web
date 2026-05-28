// hooks/questionnaire/use-questionnaire-entry.ts
//
// QuestionnaireEntry hooks: self-fill queue, detail (with eager answers),
// answers upsert, submit, reopen. Mirrors use-assessment-entry but self-fill
// (respondentId 'me'). Toasts come from the axios interceptor.

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getQuestionnaireEntries,
  getQuestionnaireEntryById,
  upsertQuestionnaireEntryAnswers,
  updateQuestionnaireEntryMeta,
  submitQuestionnaireEntry,
  reopenQuestionnaireEntry,
} from "../../api-client";
import type {
  QuestionnaireEntryGetManyFormData,
  QuestionnaireEntryQueryFormData,
  QuestionnaireEntryUpdateFormData,
  QuestionnaireEntryAnswersUpsertFormData,
  QuestionnaireEntryIncludes,
  QuestionnaireEntryGetManyResponse,
  QuestionnaireEntryGetUniqueResponse,
  QuestionnaireEntryUpdateResponse,
} from "../../types";
import { QUESTIONNAIRE_ENTRY_STATUS } from "../../constants";
import { questionnaireEntryKeys, questionnaireKeys } from "../common/query-keys";

export function useQuestionnaireEntries(
  params?: QuestionnaireEntryGetManyFormData,
  options?: Omit<UseQueryOptions<QuestionnaireEntryGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: questionnaireEntryKeys.list(params),
    queryFn: () => getQuestionnaireEntries(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

const ENTRY_DETAIL_INCLUDE: QuestionnaireEntryIncludes = {
  questionnaire: true,
  respondent: true,
  answers: { include: { question: true } },
};

export function useQuestionnaireEntry(
  entryId: string | undefined,
  params?: QuestionnaireEntryQueryFormData,
  options?: Omit<UseQueryOptions<QuestionnaireEntryGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  const effective: QuestionnaireEntryQueryFormData = params ?? { include: ENTRY_DETAIL_INCLUDE };
  return useQuery({
    queryKey: questionnaireEntryKeys.detail(entryId ?? "", effective.include),
    queryFn: () => getQuestionnaireEntryById(entryId as string, effective),
    enabled: !!entryId,
    staleTime: 1000 * 30,
    ...options,
  });
}

/** The current user's own questionnaire queue (PENDING + IN_PROGRESS). */
export function useMyPendingQuestionnaireEntries(
  extraParams?: Omit<QuestionnaireEntryGetManyFormData, "respondentId" | "status">,
  options?: Omit<UseQueryOptions<QuestionnaireEntryGetManyResponse>, "queryKey" | "queryFn">,
) {
  const params: QuestionnaireEntryGetManyFormData = {
    ...extraParams,
    respondentId: "me",
    include: extraParams?.include ?? {
      questionnaire: true,
      _count: { select: { answers: true } },
    },
  };
  return useQuery({
    queryKey: questionnaireEntryKeys.mine(),
    queryFn: () => getQuestionnaireEntries(params),
    staleTime: 1000 * 30,
    ...options,
  });
}

export function useBatchUpsertQuestionnaireAnswers(entryId: string) {
  const qc = useQueryClient();
  return useMutation<
    QuestionnaireEntryGetUniqueResponse,
    Error,
    QuestionnaireEntryAnswersUpsertFormData & { suppressToast?: boolean }
  >({
    mutationFn: ({ suppressToast, ...data }) =>
      upsertQuestionnaireEntryAnswers(entryId, data, { suppressToast }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.detail(entryId) });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.lists() });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.mine() });
    },
  });
}

export function useUpdateQuestionnaireEntryMeta(entryId: string) {
  const qc = useQueryClient();
  return useMutation<
    QuestionnaireEntryUpdateResponse,
    Error,
    QuestionnaireEntryUpdateFormData & { suppressToast?: boolean }
  >({
    mutationFn: ({ suppressToast, ...data }) =>
      updateQuestionnaireEntryMeta(entryId, data, { suppressToast }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionnaireEntryKeys.detail(entryId) }),
  });
}

export function useSubmitQuestionnaireEntry(entryId: string) {
  const qc = useQueryClient();
  return useMutation<QuestionnaireEntryGetUniqueResponse, Error, void>({
    mutationFn: () => submitQuestionnaireEntry(entryId),
    onSuccess: (res) => {
      const questionnaireId = res?.data?.questionnaireId;
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.detail(entryId) });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.lists() });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.mine() });
      if (questionnaireId) qc.invalidateQueries({ queryKey: questionnaireKeys.detail(questionnaireId) });
    },
  });
}

export function useReopenQuestionnaireEntry(entryId: string) {
  const qc = useQueryClient();
  return useMutation<QuestionnaireEntryGetUniqueResponse, Error, void>({
    mutationFn: () => reopenQuestionnaireEntry(entryId),
    onSuccess: (res) => {
      const questionnaireId = res?.data?.questionnaireId;
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.detail(entryId) });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.lists() });
      qc.invalidateQueries({ queryKey: questionnaireEntryKeys.mine() });
      if (questionnaireId) qc.invalidateQueries({ queryKey: questionnaireKeys.detail(questionnaireId) });
    },
  });
}

// Re-export the status enum for convenience in pages.
export { QUESTIONNAIRE_ENTRY_STATUS };
