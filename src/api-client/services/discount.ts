import { apiClient } from "../axiosClient";
import type { Discount } from "../../types";
import type {
  DiscountCreateFormData as DiscountCreateSchema,
  DiscountUpdateFormData as DiscountUpdateSchema,
} from "../../schemas";

// Additional types for API responses
interface DiscountGetManyResponse {
  success: boolean;
  message: string;
  data?: Discount[];
  meta?: {
    totalRecords: number;
    page: number;
    hasNextPage: boolean;
  };
}

interface DiscountQueryFormData {
  include?: {
    payroll?: boolean;
  };
}

interface BatchDiscountCreateFormData {
  discounts: DiscountCreateSchema[];
}

interface BatchDiscountResult {
  success: boolean;
  created: Discount[];
  failed: any[];
}

export const discountService = {
  getMany: (params?: {
    page?: number;
    limit?: number;
    where?: {
      payrollId?: string;
      reference?: string;
      discountType?: string | { in?: string[] };
      isPersistent?: boolean;
      isActive?: boolean;
    };
    orderBy?: {
      discountType?: "asc" | "desc";
      createdAt?: "asc" | "desc";
    };
    include?: {
      payroll?: boolean;
    };
  }) =>
    apiClient.get<DiscountGetManyResponse>("/discount", { params }),

  getById: (id: string, params?: DiscountQueryFormData) =>
    apiClient.get<Discount>(`/discount/${id}`, { params }),

  getByPayroll: (payrollId: string) =>
    apiClient.get<{ success: boolean; message: string; data: Discount[] }>(
      `/discount/by-payroll/${payrollId}`,
    ),

  create: (data: DiscountCreateSchema) =>
    apiClient.post<Discount>("/discount", data),

  update: (id: string, data: DiscountUpdateSchema) =>
    apiClient.put<Discount>(`/discount/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/discount/${id}`),

  batchCreate: (data: BatchDiscountCreateFormData) =>
    apiClient.post<BatchDiscountResult>("/discount/batch", data),

  batchDelete: (ids: string[]) =>
    apiClient.delete("/discount/batch", { data: { discountIds: ids } }),
};

// Export types for external use
export type {
  DiscountGetManyResponse,
  DiscountQueryFormData,
  BatchDiscountCreateFormData,
  BatchDiscountResult,
};