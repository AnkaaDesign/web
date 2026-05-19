// packages/hooks/src/useTeamStaff.ts

import { useQuery } from "@tanstack/react-query";
import {
  getTeamStaffUsers,
  getTeamStaffBorrows,
  getTeamStaffWarnings,
  getTeamStaffActivities,
  getTeamStaffEpis,
  getTeamStaffCalculations,
} from "../../api-client";
import type {
  UserGetManyFormData,
  BorrowGetManyFormData,
  WarningGetManyFormData,
  ActivityGetManyFormData,
  PpeDeliveryGetManyFormData,
} from "../../schemas";
import type {
  BorrowGetManyResponse,
  WarningGetManyResponse,
  ActivityGetManyResponse,
  PpeDeliveryGetManyResponse,
} from "../../types";
import { teamStaffKeys } from "../common/query-keys";

// =====================================================
// Team Staff Users Hook
// =====================================================

/**
 * Hook to fetch users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's ledSectorId.
 *
 * @param filters - Query parameters (includes, orderBy, etc.)
 * @param options - React Query options
 * @returns Query result with team members
 */
export function useTeamStaffUsers(
  filters?: Partial<UserGetManyFormData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: teamStaffKeys.usersList(filters),
    queryFn: () => getTeamStaffUsers(filters),
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

// =====================================================
// Team Staff Borrows Hook
// =====================================================

/**
 * Hook to fetch borrows for users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's ledSectorId.
 *
 * @param filters - Query parameters (includes, orderBy, pagination, etc.)
 * @param options - React Query options
 * @returns Query result with team borrows
 */
export function useTeamStaffBorrows(
  filters?: Partial<BorrowGetManyFormData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery<BorrowGetManyResponse>({
    queryKey: teamStaffKeys.borrowsList(filters),
    queryFn: () => getTeamStaffBorrows(filters),
    staleTime: options?.staleTime ?? 1000 * 60 * 3, // 3 minutes default
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

// =====================================================
// Team Staff Warnings Hook
// =====================================================

/**
 * Hook to fetch warnings for users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's ledSectorId.
 *
 * @param filters - Query parameters (includes, orderBy, pagination, etc.)
 * @param options - React Query options
 * @returns Query result with team warnings
 */
export function useTeamStaffWarnings(
  filters?: Partial<WarningGetManyFormData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery<WarningGetManyResponse>({
    queryKey: teamStaffKeys.warningsList(filters),
    queryFn: () => getTeamStaffWarnings(filters),
    staleTime: options?.staleTime ?? 1000 * 60 * 3, // 3 minutes default
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

// =====================================================
// Team Staff Activities Hook
// =====================================================

/**
 * Hook to fetch activities for users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's ledSectorId.
 *
 * @param filters - Query parameters (includes, orderBy, pagination, etc.)
 * @param options - React Query options
 * @returns Query result with team activities
 */
export function useTeamStaffActivities(
  filters?: Partial<ActivityGetManyFormData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery<ActivityGetManyResponse>({
    queryKey: teamStaffKeys.activitiesList(filters),
    queryFn: () => getTeamStaffActivities(filters),
    staleTime: options?.staleTime ?? 1000 * 60 * 3, // 3 minutes default
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

// =====================================================
// Team Staff EPIs Hook
// =====================================================

/**
 * Hook to fetch PPE deliveries (EPIs) for users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's ledSectorId.
 *
 * @param filters - Query parameters (includes, orderBy, pagination, etc.)
 * @param options - React Query options
 * @returns Query result with team EPIs
 */
export function useTeamStaffEpis(
  filters?: Partial<PpeDeliveryGetManyFormData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery<PpeDeliveryGetManyResponse>({
    queryKey: teamStaffKeys.episList(filters),
    queryFn: () => getTeamStaffEpis(filters),
    staleTime: options?.staleTime ?? 1000 * 60 * 3, // 3 minutes default
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

// =====================================================
// Team Staff Calculations Hook
// =====================================================

/**
 * Hook to fetch Secullum payroll calculations for a single team member.
 * The backend (/team-staff/calculations) validates the target user belongs
 * to the leader's led sector before forwarding to Secullum, so the leader
 * can only ever pull data for users in their own sector.
 *
 * Returns the same `{ success, data: { Colunas, Linhas, Totais } }` payload
 * shape as the HR `/integrations/secullum/calculations` endpoint.
 */
export function useTeamStaffCalculations(
  params: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    take?: number;
  } | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  const ready = !!params?.userId && !!params?.startDate && !!params?.endDate;
  return useQuery({
    queryKey: teamStaffKeys.calculationsByUser(params),
    queryFn: () =>
      getTeamStaffCalculations({
        userId: params!.userId!,
        startDate: params!.startDate!,
        endDate: params!.endDate!,
        page: params?.page,
        take: params?.take,
      }),
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
    enabled: (options?.enabled ?? true) && ready,
    refetchInterval: options?.refetchInterval,
  });
}
