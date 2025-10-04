import { apiClient } from "../axiosClient";
import type { TimeClockEntry, BatchOperationResult, BaseGetManyResponse } from "../../types";
import type {
  TimeClockEntryCreateFormData,
  TimeClockEntryUpdateFormData,
  TimeClockEntryBatchUpdateFormData,
  TimeClockEntryQueryFormData,
  TimeClockJustificationFormData,
} from "../../schemas";

// Define missing types locally to avoid build issues
interface TimeClockEntryMoveDayFormData {
  entryId: string;
  field: string;
  dayOffset: number;
  version?: string;
}

interface TimeClockPartialAdjustmentFormData {
  entryId: string;
  field: string;
  time: string | null;
  reason: string;
}

export const timeClockEntryService = {
  getMany: async (params?: TimeClockEntryQueryFormData) => {
    const response = await apiClient.get<BaseGetManyResponse<TimeClockEntry>>("/time-clock-entries", { params });
    return response.data;
  },

  getById: async (id: string, params?: Pick<TimeClockEntryQueryFormData, "include">) => {
    const response = await apiClient.get<TimeClockEntry>(`/time-clock-entries/${id}`, { params });
    return response.data;
  },

  getByDateRange: async (startDate: string, endDate: string, params?: Pick<TimeClockEntryQueryFormData, "include" | "where" | "orderBy">) => {
    const response = await apiClient.get<TimeClockEntry[]>("/time-clock-entries/date-range", {
      params: { startDate, endDate, ...params },
    });
    return response.data;
  },

  create: async (data: TimeClockEntryCreateFormData) => {
    const response = await apiClient.post<TimeClockEntry>("/time-clock-entries", data);
    return response.data;
  },

  update: async (id: string, data: TimeClockEntryUpdateFormData, justification?: TimeClockJustificationFormData) => {
    const response = await apiClient.put<TimeClockEntry>(`/time-clock-entries/${id}`, { ...data, justification });
    return response.data;
  },

  batchUpdate: async (data: TimeClockEntryBatchUpdateFormData) => {
    const response = await apiClient.put<BatchOperationResult<TimeClockEntry>>("/time-clock-entries/batch", data);
    return response.data;
  },

  batchUpdateWithJustification: async (data: TimeClockEntryBatchUpdateFormData, justifications?: TimeClockJustificationFormData[]) => {
    const response = await apiClient.put<BatchOperationResult<TimeClockEntry>>("/time-clock-entries/batch-with-justification", {
      ...data,
      justifications,
    });
    return response.data;
  },

  moveToDay: async (data: TimeClockEntryMoveDayFormData) => {
    const response = await apiClient.post<TimeClockEntry>("/time-clock-entries/move-to-day", data);
    return response.data;
  },

  addPartialAdjustment: async (data: TimeClockPartialAdjustmentFormData) => {
    const response = await apiClient.post<TimeClockEntry>("/time-clock-entries/partial-adjustment", data);
    return response.data;
  },

  deleteTimeEntry: async (entryId: string, field: string, justification: TimeClockJustificationFormData) => {
    const response = await apiClient.delete<TimeClockEntry>(`/time-clock-entries/${entryId}/field/${field}`, {
      data: { justification },
    });
    return response.data;
  },

  getLocationPhoto: async (entryId: string, field: string) => {
    const response = await apiClient.get<{ photo: string | null; location: any }>(`/time-clock-entries/${entryId}/field/${field}/location-photo`);
    return response.data;
  },
};
