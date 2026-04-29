import type { BaseEntity } from './common';
import type { File } from './file';
import type { Installment } from './invoice';

export type TASK_QUOTE_STATUS = 'PENDING' | 'BUDGET_APPROVED' | 'COMMERCIAL_APPROVED' | 'BILLING_APPROVED' | 'UPCOMING' | 'DUE' | 'PARTIAL' | 'SETTLED';
export type DISCOUNT_TYPE = 'NONE' | 'PERCENTAGE' | 'FIXED_VALUE';

export interface PaymentConfig {
  type: 'CASH' | 'INSTALLMENTS';
  cashDays?: number;
  installmentCount?: number;
  installmentStep?: number;
  entryDays?: number;
  specificDate?: string; // YYYY-MM-DD
}

export interface TaskQuoteService extends BaseEntity {
  description: string;
  observation?: string | null;
  amount: number;
  quoteId: string;
  invoiceToCustomerId?: string | null;
  invoiceToCustomer?: { id: string; corporateName?: string; fantasyName: string; cnpj?: string | null };
  quote?: TaskQuote;
}

export interface TaskQuoteCustomerConfig extends BaseEntity {
  quoteId: string;
  customerId: string;
  subtotal: number;
  total: number;
  discountType: DISCOUNT_TYPE;
  discountValue?: number | null;
  discountReference?: string | null;
  customPaymentText: string | null;
  generateInvoice?: boolean;
  orderNumber?: string | null;
  responsibleId?: string | null;
  paymentCondition?: string | null;
  paymentConfig?: PaymentConfig | null;
  customerSignatureId?: string | null;
  customerSignature?: File;
  customer?: { id: string; corporateName?: string; fantasyName: string; cnpj?: string | null };
  responsible?: { id: string; name: string; role: string };
  installments?: Installment[];
}

export interface TaskQuote extends BaseEntity {
  budgetNumber: number;
  subtotal: number;
  total: number;
  expiresAt: Date;
  status: TASK_QUOTE_STATUS;
  statusOrder: number;
  billingApprovedAt?: Date | null;

  guaranteeYears: number | null;
  customGuaranteeText: string | null;

  customForecastDays: number | null;

  layoutFileId: string | null;
  layoutFile?: File;

  simultaneousTasks: number | null;

  task?: any;
  services?: TaskQuoteService[];
  customerConfigs?: TaskQuoteCustomerConfig[];
}
