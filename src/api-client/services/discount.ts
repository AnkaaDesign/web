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

// Employee-anchored loan/advance registration (POST /discount/loan).
// Creates a master persistent PayrollDiscount (payrollId=null) that the API
// auto-applies to every future folha and auto-advances the installments.
interface LoanRegisterFormData {
  userId: string;
  value: number; // monthly installment, > 0
  totalInstallments: number; // 1..120
  startCompetence: string; // "YYYY-MM"
  discountType?: "LOAN" | "ADVANCE"; // default LOAN
  loanKind?: "COMPANY" | "PAYROLL_CONSIGNED"; // default COMPANY
  lenderName?: string; // bank/credor, only meaningful for PAYROLL_CONSIGNED
  description?: string;
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
      payrollId?: string | null;
      userId?: string;
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
      user?: boolean;
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

  // Employee-anchored loan/advance registration. The master discount
  // auto-applies to future folhas; 35% consignável is enforced server-side.
  registerLoan: (data: LoanRegisterFormData) =>
    apiClient.post<{ success: boolean; message: string; data?: Discount }>(
      "/discount/loan",
      data,
    ),

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
  LoanRegisterFormData,
};