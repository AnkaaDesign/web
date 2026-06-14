// packages/api/src/benefit.ts
// Benefícios e adesões (Departamento Pessoal)
// Exports both benefitService (Benefit) and userBenefitService (UserBenefit / Adesões).

import { apiClient } from "./axiosClient";
import type {
  BenefitGetManyFormData,
  BenefitCreateFormData,
  BenefitUpdateFormData,
  BenefitBatchCreateFormData,
  BenefitBatchUpdateFormData,
  BenefitBatchDeleteFormData,
  UserBenefitGetManyFormData,
  UserBenefitCreateFormData,
  UserBenefitUpdateFormData,
  UserBenefitBatchCreateFormData,
  UserBenefitBatchUpdateFormData,
  UserBenefitBatchDeleteFormData,
} from "../schemas/benefit";
import type {
  Benefit,
  BenefitGetUniqueResponse,
  BenefitGetManyResponse,
  BenefitCreateResponse,
  BenefitUpdateResponse,
  BenefitDeleteResponse,
  BenefitBatchCreateResponse,
  BenefitBatchUpdateResponse,
  BenefitBatchDeleteResponse,
  UserBenefit,
  UserBenefitGetUniqueResponse,
  UserBenefitGetManyResponse,
  UserBenefitCreateResponse,
  UserBenefitUpdateResponse,
  UserBenefitDeleteResponse,
  UserBenefitBatchCreateResponse,
  UserBenefitBatchUpdateResponse,
  UserBenefitBatchDeleteResponse,
} from "../types/benefit";

// =====================
// Benefit Service Class
// =====================

export class BenefitService {
  private readonly basePath = "/benefits";

  // =====================
  // Query Operations
  // =====================

  async getBenefits(params?: BenefitGetManyFormData): Promise<BenefitGetManyResponse> {
    const response = await apiClient.get<BenefitGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getBenefitById(id: string, params?: any): Promise<BenefitGetUniqueResponse> {
    const response = await apiClient.get<BenefitGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createBenefit(data: BenefitCreateFormData, query?: any): Promise<BenefitCreateResponse> {
    const response = await apiClient.post<BenefitCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateBenefit(id: string, data: BenefitUpdateFormData, query?: any): Promise<BenefitUpdateResponse> {
    const response = await apiClient.put<BenefitUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteBenefit(id: string): Promise<BenefitDeleteResponse> {
    const response = await apiClient.delete<BenefitDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateBenefits(data: BenefitBatchCreateFormData, query?: any): Promise<BenefitBatchCreateResponse<Benefit>> {
    const response = await apiClient.post<BenefitBatchCreateResponse<Benefit>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateBenefits(data: BenefitBatchUpdateFormData, query?: any): Promise<BenefitBatchUpdateResponse<Benefit>> {
    const response = await apiClient.put<BenefitBatchUpdateResponse<Benefit>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteBenefits(data: BenefitBatchDeleteFormData, query?: any): Promise<BenefitBatchDeleteResponse> {
    const response = await apiClient.delete<BenefitBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// UserBenefit Service Class
// =====================

export class UserBenefitService {
  private readonly basePath = "/user-benefits";

  // =====================
  // Query Operations
  // =====================

  async getUserBenefits(params?: UserBenefitGetManyFormData): Promise<UserBenefitGetManyResponse> {
    const response = await apiClient.get<UserBenefitGetManyResponse>(this.basePath, {
      params,
    });
    return response.data;
  }

  async getUserBenefitById(id: string, params?: any): Promise<UserBenefitGetUniqueResponse> {
    const response = await apiClient.get<UserBenefitGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async createUserBenefit(data: UserBenefitCreateFormData, query?: any): Promise<UserBenefitCreateResponse> {
    const response = await apiClient.post<UserBenefitCreateResponse>(this.basePath, data, {
      params: query,
    });
    return response.data;
  }

  async updateUserBenefit(id: string, data: UserBenefitUpdateFormData, query?: any): Promise<UserBenefitUpdateResponse> {
    const response = await apiClient.put<UserBenefitUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: query,
    });
    return response.data;
  }

  async deleteUserBenefit(id: string): Promise<UserBenefitDeleteResponse> {
    const response = await apiClient.delete<UserBenefitDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // Status machine (ACTIVE ⇄ SUSPENDED, → TERMINATED)
  async suspendUserBenefit(id: string, query?: any): Promise<UserBenefitUpdateResponse> {
    const response = await apiClient.put<UserBenefitUpdateResponse>(`${this.basePath}/${id}/suspend`, undefined, {
      params: query,
    });
    return response.data;
  }

  async reactivateUserBenefit(id: string, query?: any): Promise<UserBenefitUpdateResponse> {
    const response = await apiClient.put<UserBenefitUpdateResponse>(`${this.basePath}/${id}/reactivate`, undefined, {
      params: query,
    });
    return response.data;
  }

  async terminateUserBenefit(id: string, data: { endDate: Date }, query?: any): Promise<UserBenefitUpdateResponse> {
    const response = await apiClient.put<UserBenefitUpdateResponse>(`${this.basePath}/${id}/terminate`, data, {
      params: query,
    });
    return response.data;
  }

  // Convênios parcelados (Part H) — advance the installment counter.
  async advanceUserBenefitInstallment(id: string, query?: any): Promise<UserBenefitUpdateResponse> {
    const response = await apiClient.put<UserBenefitUpdateResponse>(`${this.basePath}/${id}/advance-installment`, undefined, {
      params: query,
    });
    return response.data;
  }

  // Declaração assinada (renúncia VT / autorização de desconto — multipart, field "declaration")
  async uploadUserBenefitDeclaration(id: string, file: globalThis.File, query?: any): Promise<UserBenefitUpdateResponse> {
    const formData = new FormData();
    formData.append("declaration", file);
    const response = await apiClient.post<UserBenefitUpdateResponse>(`${this.basePath}/${id}/declaration`, formData, {
      params: query,
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateUserBenefits(data: UserBenefitBatchCreateFormData, query?: any): Promise<UserBenefitBatchCreateResponse<UserBenefit>> {
    const response = await apiClient.post<UserBenefitBatchCreateResponse<UserBenefit>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchUpdateUserBenefits(data: UserBenefitBatchUpdateFormData, query?: any): Promise<UserBenefitBatchUpdateResponse<UserBenefit>> {
    const response = await apiClient.put<UserBenefitBatchUpdateResponse<UserBenefit>>(`${this.basePath}/batch`, data, {
      params: query,
    });
    return response.data;
  }

  async batchDeleteUserBenefits(data: UserBenefitBatchDeleteFormData, query?: any): Promise<UserBenefitBatchDeleteResponse> {
    const response = await apiClient.delete<UserBenefitBatchDeleteResponse>(`${this.basePath}/batch`, {
      data,
      params: query,
    });
    return response.data;
  }
}

// =====================
// Export service instances
// =====================

export const benefitService = new BenefitService();
export const userBenefitService = new UserBenefitService();

// =====================
// Export individual functions — Benefit
// =====================

// Query Operations
export const getBenefits = (params?: BenefitGetManyFormData) => benefitService.getBenefits(params);
export const getBenefitById = (id: string, params?: any) => benefitService.getBenefitById(id, params);

// Mutation Operations
export const createBenefit = (data: BenefitCreateFormData, query?: any) => benefitService.createBenefit(data, query);
export const updateBenefit = (id: string, data: BenefitUpdateFormData, query?: any) => benefitService.updateBenefit(id, data, query);
export const deleteBenefit = (id: string) => benefitService.deleteBenefit(id);

// Batch Operations
export const batchCreateBenefits = (data: BenefitBatchCreateFormData, query?: any) => benefitService.batchCreateBenefits(data, query);
export const batchUpdateBenefits = (data: BenefitBatchUpdateFormData, query?: any) => benefitService.batchUpdateBenefits(data, query);
export const batchDeleteBenefits = (data: BenefitBatchDeleteFormData, query?: any) => benefitService.batchDeleteBenefits(data, query);

// =====================
// Export individual functions — UserBenefit
// =====================

// Query Operations
export const getUserBenefits = (params?: UserBenefitGetManyFormData) => userBenefitService.getUserBenefits(params);
export const getUserBenefitById = (id: string, params?: any) => userBenefitService.getUserBenefitById(id, params);

// Mutation Operations
export const createUserBenefit = (data: UserBenefitCreateFormData, query?: any) => userBenefitService.createUserBenefit(data, query);
export const updateUserBenefit = (id: string, data: UserBenefitUpdateFormData, query?: any) => userBenefitService.updateUserBenefit(id, data, query);
export const deleteUserBenefit = (id: string) => userBenefitService.deleteUserBenefit(id);
export const suspendUserBenefit = (id: string, query?: any) => userBenefitService.suspendUserBenefit(id, query);
export const reactivateUserBenefit = (id: string, query?: any) => userBenefitService.reactivateUserBenefit(id, query);
export const terminateUserBenefit = (id: string, data: { endDate: Date }, query?: any) => userBenefitService.terminateUserBenefit(id, data, query);
export const advanceUserBenefitInstallment = (id: string, query?: any) => userBenefitService.advanceUserBenefitInstallment(id, query);
export const uploadUserBenefitDeclaration = (id: string, file: globalThis.File, query?: any) => userBenefitService.uploadUserBenefitDeclaration(id, file, query);

// Batch Operations
export const batchCreateUserBenefits = (data: UserBenefitBatchCreateFormData, query?: any) => userBenefitService.batchCreateUserBenefits(data, query);
export const batchUpdateUserBenefits = (data: UserBenefitBatchUpdateFormData, query?: any) => userBenefitService.batchUpdateUserBenefits(data, query);
export const batchDeleteUserBenefits = (data: UserBenefitBatchDeleteFormData, query?: any) => userBenefitService.batchDeleteUserBenefits(data, query);
