// packages/hooks/src/useTeamStaff.ts

import { useQuery } from "@tanstack/react-query";
import {
  getTeamStaffUsers,
  getTeamStaffBorrows,
  getTeamStaffVacations,
  getTeamStaffWarnings,
  getTeamStaffActivities,
  getTeamStaffEpis,
  getTeamStaffCalculations,
} from "../../api-client";
import type {
  UserGetManyFormData,
  BorrowGetManyFormData,
  VacationGetManyFormData,
  WarningGetManyFormData,
  ActivityGetManyFormData,
  PpeDeliveryGetManyFormData,
} from "../../schemas";
import type {
  UserGetManyResponse,
  BorrowGetManyResponse,
  VacationGetManyResponse,
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
 * based on the user's managedSectorId.
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
 * based on the user's managedSectorId.
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
// Team Staff Vacations Hook
// =====================================================

/**
 * Hook to fetch vacations for users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's managedSectorId.
 *
 * @param filters - Query parameters (includes, orderBy, pagination, etc.)
 * @param options - React Query options
 * @returns Query result with team vacations
 */
export function useTeamStaffVacations(
  filters?: Partial<VacationGetManyFormData>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery<VacationGetManyResponse>({
    queryKey: teamStaffKeys.vacationsList(filters),
    queryFn: () => getTeamStaffVacations(filters),
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
 * based on the user's managedSectorId.
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
 * based on the user's managedSectorId.
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
 * based on the user's managedSectorId.
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
 * Hook to fetch payroll calculations for users in the authenticated team leader's sector.
 * This hook uses the secure team-staff endpoint which automatically filters
 * based on the user's managedSectorId.
 *
 * @param year - Year for calculation
 * @param month - Month for calculation (1-12)
 * @param options - React Query options
 * @returns Query result with team payroll calculations
 */
export function useTeamStaffCalculations(
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: teamStaffKeys.calculationsByPeriod(year, month),
    queryFn: () => getTeamStaffCalculations(year, month),
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}
