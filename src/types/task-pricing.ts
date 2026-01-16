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
  amount: number;
  pricingId: string;
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
  taskId: string;

  // Payment Terms (simplified)
  paymentCondition: PAYMENT_CONDITION | null;
  downPaymentDate: Date | null;
  customPaymentText: string | null;

  // Guarantee Terms
  guaranteeYears: number | null;
  customGuaranteeText: string | null;

  // Layout File
  layoutFileId: string | null;
  layoutFile?: File;

  // Customer Signature (uploaded by customer on public page)
  customerSignatureId: string | null;
  customerSignature?: File;

  task?: any;  // Task type
  items?: TaskPricingItem[];
}
