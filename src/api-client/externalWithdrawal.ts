// packages/api/src/externalWithdrawal.ts

import { apiClient } from "./axiosClient";
import type {
  // ExternalWithdrawal Schema types
  ExternalWithdrawalGetManyFormData,
  ExternalWithdrawalCreateFormData,
  ExternalWithdrawalUpdateFormData,
  ExternalWithdrawalBatchCreateFormData,
  ExternalWithdrawalBatchUpdateFormData,
  ExternalWithdrawalBatchDeleteFormData,
  ExternalWithdrawalQueryFormData,
  // ExternalWithdrawalItem Schema types
  ExternalWithdrawalItemGetManyFormData,
  ExternalWithdrawalItemCreateFormData,
  ExternalWithdrawalItemUpdateFormData,
  ExternalWithdrawalItemBatchCreateFormData,
  ExternalWithdrawalItemBatchUpdateFormData,
  ExternalWithdrawalItemBatchDeleteFormData,
  ExternalWithdrawalItemQueryFormData,
  // GetById Schema types
  ExternalWithdrawalGetByIdFormData,
  ExternalWithdrawalItemGetByIdFormData,
} from "../schemas";
import type {
  // ExternalWithdrawal Interface types
  ExternalWithdrawal,
  ExternalWithdrawalGetUniqueResponse,
  ExternalWithdrawalGetManyResponse,
  ExternalWithdrawalCreateResponse,
  ExternalWithdrawalUpdateResponse,
  ExternalWithdrawalDeleteResponse,
  ExternalWithdrawalBatchCreateResponse,
  ExternalWithdrawalBatchUpdateResponse,
  ExternalWithdrawalBatchDeleteResponse,
  // ExternalWithdrawalItem Interface types
  ExternalWithdrawalItem,
  ExternalWithdrawalItemGetUniqueResponse,
  ExternalWithdrawalItemGetManyResponse,
  ExternalWithdrawalItemCreateResponse,
  ExternalWithdrawalItemUpdateResponse,
  ExternalWithdrawalItemDeleteResponse,
  ExternalWithdrawalItemBatchCreateResponse,
  ExternalWithdrawalItemBatchUpdateResponse,
  ExternalWithdrawalItemBatchDeleteResponse,
} from "../types";

// =====================
// ExternalWithdrawal Service Class
// =====================

export class ExternalWithdrawalService {
  private readonly basePath = "/external-withdrawals";

  // =====================
  // Query Operations
  // =====================

  async getExternalWithdrawals(params: ExternalWithdrawalGetManyFormData = {}): Promise<ExternalWithdrawalGetManyResponse> {
    const response = await apiClient.get<ExternalWithdrawalGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getExternalWithdrawalById(id: string, params?: Omit<ExternalWithdrawalGetByIdFormData, "id">): Promise<ExternalWithdrawalGetUniqueResponse> {
    const response = await apiClient.get<ExternalWithdrawalGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createExternalWithdrawal(data: ExternalWithdrawalCreateFormData, queryParams?: ExternalWithdrawalQueryFormData): Promise<ExternalWithdrawalCreateResponse> {
    const response = await apiClient.post<ExternalWithdrawalCreateResponse>(this.basePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateExternalWithdrawal(id: string, data: ExternalWithdrawalUpdateFormData, queryParams?: ExternalWithdrawalQueryFormData): Promise<ExternalWithdrawalUpdateResponse> {
    const response = await apiClient.patch<ExternalWithdrawalUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteExternalWithdrawal(id: string): Promise<ExternalWithdrawalDeleteResponse> {
    const response = await apiClient.delete<ExternalWithdrawalDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Status Transition Methods (Devolution/Charging Workflow)
  // =====================

  async markAsPartiallyReturned(
    id: string,
    data?: Pick<ExternalWithdrawalUpdateFormData, "notes">,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalUpdateResponse> {
    return this.updateExternalWithdrawal(
      id,
      {
        ...data,
        status: "PARTIALLY_RETURNED" as any,
      },
      queryParams,
    );
  }

  async markAsFullyReturned(
    id: string,
    data?: Pick<ExternalWithdrawalUpdateFormData, "notes">,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalUpdateResponse> {
    return this.updateExternalWithdrawal(
      id,
      {
        ...data,
        status: "FULLY_RETURNED" as any,
      },
      queryParams,
    );
  }

  async markAsCharged(
    id: string,
    data?: Pick<ExternalWithdrawalUpdateFormData, "notes">,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalUpdateResponse> {
    return this.updateExternalWithdrawal(
      id,
      {
        ...data,
        status: "CHARGED" as any,
      },
      queryParams,
    );
  }

  async markAsLiquidated(
    id: string,
    data?: Pick<ExternalWithdrawalUpdateFormData, "notes">,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalUpdateResponse> {
    return this.updateExternalWithdrawal(
      id,
      {
        ...data,
        status: "LIQUIDATED" as any,
      },
      queryParams,
    );
  }

  async markAsDelivered(
    id: string,
    data?: Pick<ExternalWithdrawalUpdateFormData, "notes">,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalUpdateResponse> {
    return this.updateExternalWithdrawal(
      id,
      {
        ...data,
        status: "DELIVERED" as any,
      },
      queryParams,
    );
  }

  async cancel(id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData): Promise<ExternalWithdrawalUpdateResponse> {
    return this.updateExternalWithdrawal(
      id,
      {
        ...data,
        status: "CANCELLED" as any,
      },
      queryParams,
    );
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateExternalWithdrawals(
    data: ExternalWithdrawalBatchCreateFormData,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalBatchCreateResponse<ExternalWithdrawal>> {
    const response = await apiClient.post<ExternalWithdrawalBatchCreateResponse<ExternalWithdrawal>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateExternalWithdrawals(
    data: ExternalWithdrawalBatchUpdateFormData,
    queryParams?: ExternalWithdrawalQueryFormData,
  ): Promise<ExternalWithdrawalBatchUpdateResponse<ExternalWithdrawal>> {
    const response = await apiClient.patch<ExternalWithdrawalBatchUpdateResponse<ExternalWithdrawal>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteExternalWithdrawals(data: ExternalWithdrawalBatchDeleteFormData): Promise<ExternalWithdrawalBatchDeleteResponse> {
    const response = await apiClient.delete<ExternalWithdrawalBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// ExternalWithdrawalItem Service Class
// =====================

export class ExternalWithdrawalItemService {
  private readonly basePath = "/external-withdrawal-items";

  // =====================
  // Query Operations
  // =====================

  async getExternalWithdrawalItems(params: ExternalWithdrawalItemGetManyFormData = {}): Promise<ExternalWithdrawalItemGetManyResponse> {
    const response = await apiClient.get<ExternalWithdrawalItemGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getExternalWithdrawalItemById(id: string, params?: Omit<ExternalWithdrawalItemGetByIdFormData, "id">): Promise<ExternalWithdrawalItemGetUniqueResponse> {
    const response = await apiClient.get<ExternalWithdrawalItemGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createExternalWithdrawalItem(data: ExternalWithdrawalItemCreateFormData, queryParams?: ExternalWithdrawalItemQueryFormData): Promise<ExternalWithdrawalItemCreateResponse> {
    const response = await apiClient.post<ExternalWithdrawalItemCreateResponse>(this.basePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateExternalWithdrawalItem(
    id: string,
    data: ExternalWithdrawalItemUpdateFormData,
    queryParams?: ExternalWithdrawalItemQueryFormData,
  ): Promise<ExternalWithdrawalItemUpdateResponse> {
    const response = await apiClient.patch<ExternalWithdrawalItemUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteExternalWithdrawalItem(id: string): Promise<ExternalWithdrawalItemDeleteResponse> {
    const response = await apiClient.delete<ExternalWithdrawalItemDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateExternalWithdrawalItems(
    data: ExternalWithdrawalItemBatchCreateFormData,
    queryParams?: ExternalWithdrawalItemQueryFormData,
  ): Promise<ExternalWithdrawalItemBatchCreateResponse<ExternalWithdrawalItem>> {
    const response = await apiClient.post<ExternalWithdrawalItemBatchCreateResponse<ExternalWithdrawalItem>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateExternalWithdrawalItems(
    data: ExternalWithdrawalItemBatchUpdateFormData,
    queryParams?: ExternalWithdrawalItemQueryFormData,
  ): Promise<ExternalWithdrawalItemBatchUpdateResponse<ExternalWithdrawalItem>> {
    console.log("[ExternalWithdrawalItemService] Batch update data received:", JSON.stringify(data, null, 2));

    // Fix array serialization issue directly here
    let fixedData = data;
    if (data.externalWithdrawalItems && typeof data.externalWithdrawalItems === "object" && !Array.isArray(data.externalWithdrawalItems)) {
      console.log("[ExternalWithdrawalItemService] Converting externalWithdrawalItems from object to array");
      fixedData = {
        ...data,
        externalWithdrawalItems: Object.values(data.externalWithdrawalItems),
      };
    }

    console.log("[ExternalWithdrawalItemService] Batch update data being sent:", JSON.stringify(fixedData, null, 2));
    const response = await apiClient.put<ExternalWithdrawalItemBatchUpdateResponse<ExternalWithdrawalItem>>(`${this.basePath}/batch`, fixedData, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteExternalWithdrawalItems(data: ExternalWithdrawalItemBatchDeleteFormData): Promise<ExternalWithdrawalItemBatchDeleteResponse> {
    const response = await apiClient.delete<ExternalWithdrawalItemBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const externalWithdrawalService = new ExternalWithdrawalService();
export const externalWithdrawalItemService = new ExternalWithdrawalItemService();

// ExternalWithdrawal exports
export const getExternalWithdrawals = (params?: ExternalWithdrawalGetManyFormData) => externalWithdrawalService.getExternalWithdrawals(params);
export const getExternalWithdrawalById = (id: string, params?: Omit<ExternalWithdrawalGetByIdFormData, "id">) => externalWithdrawalService.getExternalWithdrawalById(id, params);
export const createExternalWithdrawal = (data: ExternalWithdrawalCreateFormData, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.createExternalWithdrawal(data, queryParams);
export const updateExternalWithdrawal = (id: string, data: ExternalWithdrawalUpdateFormData, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.updateExternalWithdrawal(id, data, queryParams);
export const deleteExternalWithdrawal = (id: string) => externalWithdrawalService.deleteExternalWithdrawal(id);
export const batchCreateExternalWithdrawals = (data: ExternalWithdrawalBatchCreateFormData, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.batchCreateExternalWithdrawals(data, queryParams);
export const batchUpdateExternalWithdrawals = (data: ExternalWithdrawalBatchUpdateFormData, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.batchUpdateExternalWithdrawals(data, queryParams);
export const batchDeleteExternalWithdrawals = (data: ExternalWithdrawalBatchDeleteFormData) => externalWithdrawalService.batchDeleteExternalWithdrawals(data);

// Status transition convenience exports
export const markExternalWithdrawalAsPartiallyReturned = (id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.markAsPartiallyReturned(id, data, queryParams);
export const markExternalWithdrawalAsFullyReturned = (id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.markAsFullyReturned(id, data, queryParams);
export const markExternalWithdrawalAsCharged = (id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.markAsCharged(id, data, queryParams);
export const markExternalWithdrawalAsLiquidated = (id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.markAsLiquidated(id, data, queryParams);
export const markExternalWithdrawalAsDelivered = (id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.markAsDelivered(id, data, queryParams);
export const cancelExternalWithdrawal = (id: string, data?: Pick<ExternalWithdrawalUpdateFormData, "notes">, queryParams?: ExternalWithdrawalQueryFormData) =>
  externalWithdrawalService.cancel(id, data, queryParams);

// ExternalWithdrawalItem exports
export const getExternalWithdrawalItems = (params?: ExternalWithdrawalItemGetManyFormData) => externalWithdrawalItemService.getExternalWithdrawalItems(params);
export const getExternalWithdrawalItemById = (id: string, params?: Omit<ExternalWithdrawalItemGetByIdFormData, "id">) =>
  externalWithdrawalItemService.getExternalWithdrawalItemById(id, params);
export const createExternalWithdrawalItem = (data: ExternalWithdrawalItemCreateFormData, queryParams?: ExternalWithdrawalItemQueryFormData) =>
  externalWithdrawalItemService.createExternalWithdrawalItem(data, queryParams);
export const updateExternalWithdrawalItem = (id: string, data: ExternalWithdrawalItemUpdateFormData, queryParams?: ExternalWithdrawalItemQueryFormData) =>
  externalWithdrawalItemService.updateExternalWithdrawalItem(id, data, queryParams);
export const deleteExternalWithdrawalItem = (id: string) => externalWithdrawalItemService.deleteExternalWithdrawalItem(id);
export const batchCreateExternalWithdrawalItems = (data: ExternalWithdrawalItemBatchCreateFormData, queryParams?: ExternalWithdrawalItemQueryFormData) =>
  externalWithdrawalItemService.batchCreateExternalWithdrawalItems(data, queryParams);
export const batchUpdateExternalWithdrawalItems = (data: ExternalWithdrawalItemBatchUpdateFormData, queryParams?: ExternalWithdrawalItemQueryFormData) =>
  externalWithdrawalItemService.batchUpdateExternalWithdrawalItems(data, queryParams);
export const batchDeleteExternalWithdrawalItems = (data: ExternalWithdrawalItemBatchDeleteFormData) => externalWithdrawalItemService.batchDeleteExternalWithdrawalItems(data);

// =====================
// Type Exports
// =====================

export type { ExternalWithdrawalQueryFormData, ExternalWithdrawalItemQueryFormData } from "../schemas";
