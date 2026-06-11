// packages/api/src/externalOperation.ts

import { apiClient } from "./axiosClient";
import type {
  // ExternalOperation Schema types
  ExternalOperationGetManyFormData,
  ExternalOperationCreateFormData,
  ExternalOperationUpdateFormData,
  ExternalOperationBatchCreateFormData,
  ExternalOperationBatchUpdateFormData,
  ExternalOperationBatchDeleteFormData,
  ExternalOperationQueryFormData,
  // ExternalOperationItem Schema types
  ExternalOperationItemGetManyFormData,
  ExternalOperationItemCreateFormData,
  ExternalOperationItemUpdateFormData,
  ExternalOperationItemBatchCreateFormData,
  ExternalOperationItemBatchUpdateFormData,
  ExternalOperationItemBatchDeleteFormData,
  ExternalOperationItemQueryFormData,
  // GetById Schema types
  ExternalOperationGetByIdFormData,
  ExternalOperationItemGetByIdFormData,
} from "../schemas";
import type {
  // ExternalOperation Interface types
  ExternalOperation,
  ExternalOperationGetUniqueResponse,
  ExternalOperationGetManyResponse,
  ExternalOperationCreateResponse,
  ExternalOperationUpdateResponse,
  ExternalOperationDeleteResponse,
  ExternalOperationBatchCreateResponse,
  ExternalOperationBatchUpdateResponse,
  ExternalOperationBatchDeleteResponse,
  // ExternalOperationItem Interface types
  ExternalOperationItem,
  ExternalOperationItemGetUniqueResponse,
  ExternalOperationItemGetManyResponse,
  ExternalOperationItemCreateResponse,
  ExternalOperationItemUpdateResponse,
  ExternalOperationItemDeleteResponse,
  ExternalOperationItemBatchCreateResponse,
  ExternalOperationItemBatchUpdateResponse,
  ExternalOperationItemBatchDeleteResponse,
} from "../types";

// =====================
// ExternalOperation Service Class
// =====================

export class ExternalOperationService {
  private readonly basePath = "/external-operations";

  // =====================
  // Query Operations
  // =====================

  async getExternalOperations(params: ExternalOperationGetManyFormData = {}): Promise<ExternalOperationGetManyResponse> {
    const response = await apiClient.get<ExternalOperationGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getExternalOperationById(id: string, params?: Omit<ExternalOperationGetByIdFormData, "id">): Promise<ExternalOperationGetUniqueResponse> {
    const response = await apiClient.get<ExternalOperationGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createExternalOperation(data: ExternalOperationCreateFormData, queryParams?: ExternalOperationQueryFormData): Promise<ExternalOperationCreateResponse> {
    const response = await apiClient.post<ExternalOperationCreateResponse>(this.basePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateExternalOperation(id: string, data: ExternalOperationUpdateFormData, queryParams?: ExternalOperationQueryFormData): Promise<ExternalOperationUpdateResponse> {
    const response = await apiClient.patch<ExternalOperationUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteExternalOperation(id: string): Promise<ExternalOperationDeleteResponse> {
    const response = await apiClient.delete<ExternalOperationDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Status Transition Methods (Devolution/Charging Workflow)
  // =====================

  async markAsPartiallyReturned(
    id: string,
    data?: Pick<ExternalOperationUpdateFormData, "notes">,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationUpdateResponse> {
    return this.updateExternalOperation(
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
    data?: Pick<ExternalOperationUpdateFormData, "notes">,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationUpdateResponse> {
    return this.updateExternalOperation(
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
    data?: Pick<ExternalOperationUpdateFormData, "notes">,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationUpdateResponse> {
    return this.updateExternalOperation(
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
    data?: Pick<ExternalOperationUpdateFormData, "notes">,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationUpdateResponse> {
    return this.updateExternalOperation(
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
    data?: Pick<ExternalOperationUpdateFormData, "notes">,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationUpdateResponse> {
    return this.updateExternalOperation(
      id,
      {
        ...data,
        status: "DELIVERED" as any,
      },
      queryParams,
    );
  }

  async cancel(id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData): Promise<ExternalOperationUpdateResponse> {
    return this.updateExternalOperation(
      id,
      {
        ...data,
        status: "CANCELLED" as any,
      },
      queryParams,
    );
  }

  // =====================
  // Billing Operations
  // =====================

  /**
   * Manually (re)trigger the billing pipeline (Invoice → Installments → BankSlips → NFS-e)
   * for a CHARGED withdrawal with billing configured and no active invoice.
   * Roles: ADMIN, FINANCIAL.
   */
  async generateBilling(id: string): Promise<ExternalOperationUpdateResponse> {
    const response = await apiClient.post<ExternalOperationUpdateResponse>(`${this.basePath}/${id}/generate-billing`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateExternalOperations(
    data: ExternalOperationBatchCreateFormData,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationBatchCreateResponse<ExternalOperation>> {
    const response = await apiClient.post<ExternalOperationBatchCreateResponse<ExternalOperation>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateExternalOperations(
    data: ExternalOperationBatchUpdateFormData,
    queryParams?: ExternalOperationQueryFormData,
  ): Promise<ExternalOperationBatchUpdateResponse<ExternalOperation>> {
    const response = await apiClient.patch<ExternalOperationBatchUpdateResponse<ExternalOperation>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteExternalOperations(data: ExternalOperationBatchDeleteFormData): Promise<ExternalOperationBatchDeleteResponse> {
    const response = await apiClient.delete<ExternalOperationBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// ExternalOperationItem Service Class
// =====================

export class ExternalOperationItemService {
  private readonly basePath = "/external-operation-items";

  // =====================
  // Query Operations
  // =====================

  async getExternalOperationItems(params: ExternalOperationItemGetManyFormData = {}): Promise<ExternalOperationItemGetManyResponse> {
    const response = await apiClient.get<ExternalOperationItemGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getExternalOperationItemById(id: string, params?: Omit<ExternalOperationItemGetByIdFormData, "id">): Promise<ExternalOperationItemGetUniqueResponse> {
    const response = await apiClient.get<ExternalOperationItemGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createExternalOperationItem(data: ExternalOperationItemCreateFormData, queryParams?: ExternalOperationItemQueryFormData): Promise<ExternalOperationItemCreateResponse> {
    const response = await apiClient.post<ExternalOperationItemCreateResponse>(this.basePath, data, {
      params: queryParams,
    });
    return response.data;
  }

  async updateExternalOperationItem(
    id: string,
    data: ExternalOperationItemUpdateFormData,
    queryParams?: ExternalOperationItemQueryFormData,
  ): Promise<ExternalOperationItemUpdateResponse> {
    const response = await apiClient.patch<ExternalOperationItemUpdateResponse>(`${this.basePath}/${id}`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async deleteExternalOperationItem(id: string): Promise<ExternalOperationItemDeleteResponse> {
    const response = await apiClient.delete<ExternalOperationItemDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreateExternalOperationItems(
    data: ExternalOperationItemBatchCreateFormData,
    queryParams?: ExternalOperationItemQueryFormData,
  ): Promise<ExternalOperationItemBatchCreateResponse<ExternalOperationItem>> {
    const response = await apiClient.post<ExternalOperationItemBatchCreateResponse<ExternalOperationItem>>(`${this.basePath}/batch`, data, {
      params: queryParams,
    });
    return response.data;
  }

  async batchUpdateExternalOperationItems(
    data: ExternalOperationItemBatchUpdateFormData,
    queryParams?: ExternalOperationItemQueryFormData,
  ): Promise<ExternalOperationItemBatchUpdateResponse<ExternalOperationItem>> {
    if (process.env.NODE_ENV !== 'production') {
      console.log("[ExternalOperationItemService] Batch update data received:", JSON.stringify(data, null, 2));
    }

    // Fix array serialization issue directly here
    let fixedData = data;
    if (data.externalOperationItems && typeof data.externalOperationItems === "object" && !Array.isArray(data.externalOperationItems)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("[ExternalOperationItemService] Converting externalOperationItems from object to array");
      }
      fixedData = {
        ...data,
        externalOperationItems: Object.values(data.externalOperationItems),
      };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log("[ExternalOperationItemService] Batch update data being sent:", JSON.stringify(fixedData, null, 2));
    }
    const response = await apiClient.put<ExternalOperationItemBatchUpdateResponse<ExternalOperationItem>>(`${this.basePath}/batch`, fixedData, {
      params: queryParams,
    });
    return response.data;
  }

  async batchDeleteExternalOperationItems(data: ExternalOperationItemBatchDeleteFormData): Promise<ExternalOperationItemBatchDeleteResponse> {
    const response = await apiClient.delete<ExternalOperationItemBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const externalOperationService = new ExternalOperationService();
export const externalOperationItemService = new ExternalOperationItemService();

// ExternalOperation exports
export const getExternalOperations = (params?: ExternalOperationGetManyFormData) => externalOperationService.getExternalOperations(params);
export const getExternalOperationById = (id: string, params?: Omit<ExternalOperationGetByIdFormData, "id">) => externalOperationService.getExternalOperationById(id, params);
export const createExternalOperation = (data: ExternalOperationCreateFormData, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.createExternalOperation(data, queryParams);
export const updateExternalOperation = (id: string, data: ExternalOperationUpdateFormData, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.updateExternalOperation(id, data, queryParams);
export const deleteExternalOperation = (id: string) => externalOperationService.deleteExternalOperation(id);
export const batchCreateExternalOperations = (data: ExternalOperationBatchCreateFormData, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.batchCreateExternalOperations(data, queryParams);
export const batchUpdateExternalOperations = (data: ExternalOperationBatchUpdateFormData, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.batchUpdateExternalOperations(data, queryParams);
export const batchDeleteExternalOperations = (data: ExternalOperationBatchDeleteFormData) => externalOperationService.batchDeleteExternalOperations(data);

// Status transition convenience exports
export const markExternalOperationAsPartiallyReturned = (id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.markAsPartiallyReturned(id, data, queryParams);
export const markExternalOperationAsFullyReturned = (id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.markAsFullyReturned(id, data, queryParams);
export const markExternalOperationAsCharged = (id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.markAsCharged(id, data, queryParams);
export const markExternalOperationAsLiquidated = (id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.markAsLiquidated(id, data, queryParams);
export const markExternalOperationAsDelivered = (id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.markAsDelivered(id, data, queryParams);
export const cancelExternalOperation = (id: string, data?: Pick<ExternalOperationUpdateFormData, "notes">, queryParams?: ExternalOperationQueryFormData) =>
  externalOperationService.cancel(id, data, queryParams);

// Billing exports
export const generateExternalOperationBilling = (id: string) => externalOperationService.generateBilling(id);

// ExternalOperationItem exports
export const getExternalOperationItems = (params?: ExternalOperationItemGetManyFormData) => externalOperationItemService.getExternalOperationItems(params);
export const getExternalOperationItemById = (id: string, params?: Omit<ExternalOperationItemGetByIdFormData, "id">) =>
  externalOperationItemService.getExternalOperationItemById(id, params);
export const createExternalOperationItem = (data: ExternalOperationItemCreateFormData, queryParams?: ExternalOperationItemQueryFormData) =>
  externalOperationItemService.createExternalOperationItem(data, queryParams);
export const updateExternalOperationItem = (id: string, data: ExternalOperationItemUpdateFormData, queryParams?: ExternalOperationItemQueryFormData) =>
  externalOperationItemService.updateExternalOperationItem(id, data, queryParams);
export const deleteExternalOperationItem = (id: string) => externalOperationItemService.deleteExternalOperationItem(id);
export const batchCreateExternalOperationItems = (data: ExternalOperationItemBatchCreateFormData, queryParams?: ExternalOperationItemQueryFormData) =>
  externalOperationItemService.batchCreateExternalOperationItems(data, queryParams);
export const batchUpdateExternalOperationItems = (data: ExternalOperationItemBatchUpdateFormData, queryParams?: ExternalOperationItemQueryFormData) =>
  externalOperationItemService.batchUpdateExternalOperationItems(data, queryParams);
export const batchDeleteExternalOperationItems = (data: ExternalOperationItemBatchDeleteFormData) => externalOperationItemService.batchDeleteExternalOperationItems(data);

// =====================
// Type Exports
// =====================

export type { ExternalOperationQueryFormData, ExternalOperationItemQueryFormData } from "../schemas";
