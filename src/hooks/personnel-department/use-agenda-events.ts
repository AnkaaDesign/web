// use-agenda-events.ts
// Agenda com avisos — eventos do calendário com lembretes configuráveis.

import {
  getAgendaEvents,
  getAgendaEventById,
  createAgendaEvent,
  updateAgendaEvent,
  deleteAgendaEvent,
  batchCreateAgendaEvents,
  batchUpdateAgendaEvents,
  batchDeleteAgendaEvents,
} from "../../api-client/agenda-event";
import type {
  AgendaEventGetManyFormData,
  AgendaEventCreateFormData,
  AgendaEventUpdateFormData,
  AgendaEventBatchCreateFormData,
  AgendaEventBatchUpdateFormData,
  AgendaEventBatchDeleteFormData,
} from "../../schemas/agenda-event";
import type {
  AgendaEvent,
  AgendaEventGetManyResponse,
  AgendaEventGetUniqueResponse,
  AgendaEventCreateResponse,
  AgendaEventUpdateResponse,
  AgendaEventDeleteResponse,
  AgendaEventBatchCreateResponse,
  AgendaEventBatchUpdateResponse,
  AgendaEventBatchDeleteResponse,
} from "../../types/agenda-event";
import { agendaEventKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// AgendaEvent Service Adapter
// =====================================================

const agendaEventServiceAdapter = {
  getMany: getAgendaEvents,
  getById: getAgendaEventById,
  create: createAgendaEvent,
  update: updateAgendaEvent,
  delete: deleteAgendaEvent,
  batchCreate: batchCreateAgendaEvents,
  batchUpdate: batchUpdateAgendaEvents,
  batchDelete: batchDeleteAgendaEvents,
};

// =====================================================
// Base AgendaEvent Hooks
// =====================================================

const baseHooks = createEntityHooks<
  AgendaEventGetManyFormData,
  AgendaEventGetManyResponse,
  AgendaEventGetUniqueResponse,
  AgendaEventCreateFormData,
  AgendaEventCreateResponse,
  AgendaEventUpdateFormData,
  AgendaEventUpdateResponse,
  AgendaEventDeleteResponse,
  AgendaEventBatchCreateFormData,
  AgendaEventBatchCreateResponse<AgendaEvent>,
  AgendaEventBatchUpdateFormData,
  AgendaEventBatchUpdateResponse<AgendaEvent>,
  AgendaEventBatchDeleteFormData,
  AgendaEventBatchDeleteResponse
>({
  queryKeys: agendaEventKeys,
  service: agendaEventServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Export base hooks with standard names
export const useAgendaEventsInfinite = baseHooks.useInfiniteList;
export const useAgendaEvents = baseHooks.useList;
export const useAgendaEvent = baseHooks.useDetail;
export const useAgendaEventMutations = baseHooks.useMutations;
export const useAgendaEventBatchMutations = baseHooks.useBatchMutations;
