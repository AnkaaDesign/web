import type { BaseEntity } from './common';
import type { File } from './file';

export type TASK_PRICING_STATUS = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DISCOUNT_TYPE = 'NONE' | 'PERCENTAGE' | 'FIXED_VALUE';
export type PAYMENT_CONDITION =
  | 'CASH'           // Single payment
  | 'INSTALLMENTS_2' // Down payment + 1 installment (20 days)
  | 'INSTALLMENTS_3' // Down payment + 2 installments (20/40 days)
  | 'INSTALLMENTS_4' // Down payment + 3 installments (20/40/60 days)
  | 'INSTALLMENTS_5' // Down payment + 4 installments (20/40/60/80 days)
  | 'INSTALLMENTS_6' // Down payment + 5 installments (20/40/60/80/100 days)
  | 'INSTALLMENTS_7' // Down payment + 6 installments (20/40/60/80/100/120 days)
  | 'CUSTOM';        // Custom payment terms

export interface TaskPricingItem extends BaseEntity {
  description: string;
  observation?: string | null;
  amount: number;
  pricingId: string;
  shouldSync: boolean; // Controls bidirectional sync with ServiceOrder
  pricing?: TaskPricing;
}

export interface TaskPricing extends BaseEntity {
  budgetNumber: number; // Auto-generated sequential number for display
  subtotal: number;
  discountType: DISCOUNT_TYPE;
  discountValue: number | null;
  total: number;
  expiresAt: Date;
  status: TASK_PRICING_STATUS;

  // Payment Terms (simplified)
  paymentCondition: PAYMENT_CONDITION | null;
  downPaymentDate: Date | null;
  customPaymentText: string | null;

  // Guarantee Terms
  guaranteeYears: number | null;
  customGuaranteeText: string | null;

  // Custom Forecast - manual override for production days displayed in budget
  customForecastDays: number | null;

  // Layout File
  layoutFileId: string | null;
  layoutFile?: File;

  // Customer Signature (uploaded by customer on public page)
  customerSignatureId: string | null;
  customerSignature?: File;

  // New fields from migration
  simultaneousTasks: number | null; // Number of simultaneous tasks (1-100)
  discountReference: string | null; // Reference/justification for discount
  invoicesToCustomerIds?: string[]; // IDs of customers to invoice
  invoicesToCustomers?: Array<{ // Full customer objects for display
    id: string;
    corporateName?: string;
    fantasyName?: string;
  }>;

  task?: any;  // One-to-one relationship with task
  items?: TaskPricingItem[];
}
