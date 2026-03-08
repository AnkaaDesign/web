import type { BaseEntity } from './common';
import type { File } from './file';
import type { Installment } from './invoice';

export type TASK_PRICING_STATUS = 'PENDING' | 'BUDGET_APPROVED' | 'VERIFIED' | 'INTERNAL_APPROVED' | 'UPCOMING' | 'PARTIAL' | 'SETTLED';
export type DISCOUNT_TYPE = 'NONE' | 'PERCENTAGE' | 'FIXED_VALUE';

export interface TaskPricingService extends BaseEntity {
  description: string;
  observation?: string | null;
  amount: number;
  pricingId: string;
  shouldSync: boolean; // Controls bidirectional sync with ServiceOrder
  invoiceToCustomerId?: string | null;
  invoiceToCustomer?: { id: string; corporateName?: string; fantasyName: string; cnpj?: string | null };
  pricing?: TaskPricing;
}

export interface TaskPricingCustomerConfig extends BaseEntity {
  pricingId: string;
  customerId: string;
  subtotal: number;
  discountType: DISCOUNT_TYPE;
  discountValue: number | null;
  total: number;
  customPaymentText: string | null;
  responsibleId?: string | null;
  discountReference?: string | null;
  paymentCondition?: string | null;
  downPaymentDate?: Date | null;
  customerSignatureId?: string | null;
  customerSignature?: File;
  customer?: { id: string; corporateName?: string; fantasyName: string; cnpj?: string | null };
  responsible?: { id: string; name: string; role: string };
  installments?: Installment[];
}

export interface TaskPricing extends BaseEntity {
  budgetNumber: number; // Auto-generated sequential number for display
  subtotal: number; // Aggregate: sum of config subtotals
  total: number; // Aggregate: sum of config totals
  expiresAt: Date;
  status: TASK_PRICING_STATUS;
  statusOrder: number;

  // Guarantee Terms
  guaranteeYears: number | null;
  customGuaranteeText: string | null;

  // Custom Forecast - manual override for production days displayed in budget
  customForecastDays: number | null;

  // Layout File
  layoutFileId: string | null;
  layoutFile?: File;

  simultaneousTasks: number | null; // Number of simultaneous tasks (1-100)

  task?: any;  // One-to-one relationship with task
  services?: TaskPricingService[];
  customerConfigs?: TaskPricingCustomerConfig[];
}
