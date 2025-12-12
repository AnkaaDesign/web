// packages/api-client/src/services/team-staff.ts

import { apiClient } from "../axiosClient";
import type {
  // Schema types (for parameters)
  UserGetManyFormData,
  BorrowGetManyFormData,
  VacationGetManyFormData,
  WarningGetManyFormData,
  ActivityGetManyFormData,
  PpeDeliveryGetManyFormData,
} from "../../schemas";
import type {
  // Interface types (for responses)
  UserGetManyResponse,
  BorrowGetManyResponse,
  VacationGetManyResponse,
  WarningGetManyResponse,
  ActivityGetManyResponse,
  PpeDeliveryGetManyResponse,
} from "../../types";

// =====================
// Team Staff Service Class
// =====================

/**
 * Service for secure team staff endpoints.
 * These endpoints automatically filter data based on the authenticated user's managed sector.
 * Only team leaders (users with managedSectorId) can access these endpoints.
 */
export class TeamStaffService {
  private readonly basePath = "/team-staff";

  // =====================
  // Users
  // =====================

  /**
   * Get all users in the authenticated user's managed sector
   * @param params - Query parameters (filters, includes, pagination)
   * @returns List of users in the team leader's sector
   */
  async getUsers(params?: UserGetManyFormData): Promise<UserGetManyResponse> {
    const response = await apiClient.get<UserGetManyResponse>(`${this.basePath}/users`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Borrows (Loans)
  // =====================

  /**
   * Get all borrows for users in the authenticated user's managed sector
   * @param params - Query parameters (filters, includes, pagination)
   * @returns List of borrows for team members
   */
  async getBorrows(params?: BorrowGetManyFormData): Promise<BorrowGetManyResponse> {
    const response = await apiClient.get<BorrowGetManyResponse>(`${this.basePath}/borrows`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Vacations
  // =====================

  /**
   * Get all vacations for users in the authenticated user's managed sector
   * @param params - Query parameters (filters, includes, pagination)
   * @returns List of vacations for team members
   */
  async getVacations(params?: VacationGetManyFormData): Promise<VacationGetManyResponse> {
    const response = await apiClient.get<VacationGetManyResponse>(`${this.basePath}/vacations`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Warnings
  // =====================

  /**
   * Get all warnings for users in the authenticated user's managed sector
   * @param params - Query parameters (filters, includes, pagination)
   * @returns List of warnings for team members
   */
  async getWarnings(params?: WarningGetManyFormData): Promise<WarningGetManyResponse> {
    const response = await apiClient.get<WarningGetManyResponse>(`${this.basePath}/warnings`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Activities
  // =====================

  /**
   * Get all activities for users in the authenticated user's managed sector
   * @param params - Query parameters (filters, includes, pagination)
   * @returns List of activities for team members
   */
  async getActivities(params?: ActivityGetManyFormData): Promise<ActivityGetManyResponse> {
    const response = await apiClient.get<ActivityGetManyResponse>(`${this.basePath}/activities`, {
      params,
    });
    return response.data;
  }

  // =====================
  // EPIs (PPE Deliveries)
  // =====================

  /**
   * Get all PPE deliveries for users in the authenticated user's managed sector
   * @param params - Query parameters (filters, includes, pagination)
   * @returns List of PPE deliveries for team members
   */
  async getEpis(params?: PpeDeliveryGetManyFormData): Promise<PpeDeliveryGetManyResponse> {
    const response = await apiClient.get<PpeDeliveryGetManyResponse>(`${this.basePath}/epis`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Calculations
  // =====================

  /**
   * Get payroll calculations for users in the authenticated user's managed sector
   * @param year - Year for calculation
   * @param month - Month for calculation (1-12)
   * @returns Payroll calculations for team members
   */
  async getCalculations(year: number, month: number): Promise<any> {
    const response = await apiClient.get<any>(`${this.basePath}/calculations`, {
      params: { year, month },
    });
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const teamStaffService = new TeamStaffService();

// =====================
// Export individual functions
// =====================

export const getTeamStaffUsers = (params?: UserGetManyFormData) => teamStaffService.getUsers(params);
export const getTeamStaffBorrows = (params?: BorrowGetManyFormData) => teamStaffService.getBorrows(params);
export const getTeamStaffVacations = (params?: VacationGetManyFormData) => teamStaffService.getVacations(params);
export const getTeamStaffWarnings = (params?: WarningGetManyFormData) => teamStaffService.getWarnings(params);
export const getTeamStaffActivities = (params?: ActivityGetManyFormData) => teamStaffService.getActivities(params);
export const getTeamStaffEpis = (params?: PpeDeliveryGetManyFormData) => teamStaffService.getEpis(params);
export const getTeamStaffCalculations = (year: number, month: number) => teamStaffService.getCalculations(year, month);
