// packages/hooks/src/useHoliday.ts

import { getHolidays, getHolidayById, createHoliday, updateHoliday, deleteHoliday, batchCreateHolidays, batchUpdateHolidays, batchDeleteHolidays } from "../../api-client";
import type {
  HolidayGetManyFormData,
  HolidayCreateFormData,
  HolidayUpdateFormData,
  HolidayBatchCreateFormData,
  HolidayBatchUpdateFormData,
  HolidayBatchDeleteFormData,
} from "../../schemas";
import type {
  HolidayGetManyResponse,
  HolidayGetUniqueResponse,
  HolidayCreateResponse,
  HolidayUpdateResponse,
  HolidayDeleteResponse,
  HolidayBatchCreateResponse,
  HolidayBatchUpdateResponse,
  HolidayBatchDeleteResponse,
} from "../../types";
import { holidayKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks, createSpecializedQueryHook } from "../common/create-entity-hooks";

// =====================================================
// Holiday Service Adapter
// =====================================================

const holidayService = {
  getMany: getHolidays,
  getById: getHolidayById,
  create: createHoliday,
  update: updateHoliday,
  delete: deleteHoliday,
  batchCreate: batchCreateHolidays,
  batchUpdate: batchUpdateHolidays,
  batchDelete: batchDeleteHolidays,
};

// =====================================================
// Base Holiday Hooks
// =====================================================

const baseHolidayHooks = createEntityHooks<
  HolidayGetManyFormData,
  HolidayGetManyResponse,
  HolidayGetUniqueResponse,
  HolidayCreateFormData,
  HolidayCreateResponse,
  HolidayUpdateFormData,
  HolidayUpdateResponse,
  HolidayDeleteResponse,
  HolidayBatchCreateFormData,
  HolidayBatchCreateResponse<HolidayCreateFormData>,
  HolidayBatchUpdateFormData,
  HolidayBatchUpdateResponse<HolidayUpdateFormData>,
  HolidayBatchDeleteFormData,
  HolidayBatchDeleteResponse
>({
  queryKeys: holidayKeys,
  service: holidayService,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [changeLogKeys],
});

// Export base hooks with standard names
export const useHolidaysInfinite = baseHolidayHooks.useInfiniteList;
export const useHolidays = baseHolidayHooks.useList;
export const useHoliday = baseHolidayHooks.useDetail;
export const useHolidayMutations = baseHolidayHooks.useMutations;
export const useHolidayBatchMutations = baseHolidayHooks.useBatchMutations;

// =====================================================
// Specialized Holiday Hooks
// =====================================================

// Hook for upcoming holidays
export const useUpcomingHolidays = createSpecializedQueryHook<{ filters?: Partial<HolidayGetManyFormData> }, HolidayGetManyResponse>({
  queryKeyFn: ({ filters }) => holidayKeys.upcoming(filters),
  queryFn: ({ filters }) => {
    return getHolidays({
      ...filters,
      isUpcoming: true,
      orderBy: { date: "asc" },
    });
  },
  staleTime: 1000 * 60 * 5,
});

// Hook for holidays by year
export const useHolidaysByYear = createSpecializedQueryHook<{ year: number; filters?: Partial<HolidayGetManyFormData> }, HolidayGetManyResponse>({
  queryKeyFn: ({ year, filters }) => holidayKeys.byYear(year, filters),
  queryFn: ({ year, filters }) => getHolidays({ ...filters, year }),
  staleTime: 1000 * 60 * 5,
});

// Hook for holidays by type
export const useHolidaysByType = createSpecializedQueryHook<{ type: string; filters?: Partial<HolidayGetManyFormData> }, HolidayGetManyResponse>({
  queryKeyFn: ({ type, filters }) => holidayKeys.byType(type, filters),
  queryFn: ({ type, filters }) => getHolidays({ ...filters, types: [type as any] }),
  staleTime: 1000 * 60 * 5,
});

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export { useHoliday as useHolidayDetail };
export { useHolidayMutations as useCreateHoliday };
export { useHolidayMutations as useUpdateHoliday };
export { useHolidayMutations as useDeleteHoliday };
export { useHolidayBatchMutations as useBatchCreateHolidays };
export { useHolidayBatchMutations as useBatchUpdateHolidays };
export { useHolidayBatchMutations as useBatchDeleteHolidays };
