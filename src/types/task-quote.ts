import type { BaseEntity } from './common';
import type { File } from './file';
import type { Installment } from './invoice';

export type TASK_QUOTE_STATUS = 'PENDING' | 'BUDGET_APPROVED' | 'BILLING_APPROVED' | 'UPCOMING' | 'DUE' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';
export type DISCOUNT_TYPE = 'NONE' | 'PERCENTAGE' | 'FIXED_VALUE';
export type QUOTE_BILLING_SPLIT = 'JOINT' | 'PER_TASK';

export interface PaymentConfig {
  type: 'CASH' | 'INSTALLMENTS';
  /** Settlement method stamped onto every Installment this config generates. */
  method?: 'PIX' | 'BANK_SLIP';
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
  /**
   * A TAREFA que esta configuração fatura, ou `null` para "todas as do
   * orçamento".
   *
   * `null` é o caso `JOINT` — uma fatura por cliente para os N veículos, e o
   * comportamento de sempre. Preenchido é `PER_TASK`: uma configuração por
   * caminhão, cada uma com sua fatura, seu plano de parcelas e sua NFS-e.
   */
  taskId?: string | null;
  /** Quando ESTA fatia teve o faturamento aprovado. Ver `TaskQuote.billingSplit`. */
  billingApprovedAt?: Date | string | null;
  subtotal: number;
  total: number;
  discountType: DISCOUNT_TYPE;
  discountValue?: number | null;
  discountReference?: string | null;
  customPaymentText: string | null;
  generateInvoice?: boolean;
  generateBankSlip?: boolean;
  orderNumber?: string | null;
  responsibleId?: string | null;
  paymentCondition?: string | null;
  paymentConfig?: PaymentConfig | null;
  customerSignatureId?: string | null;
  customerSignature?: File;
  customer?: {
    id: string;
    corporateName?: string | null;
    fantasyName: string;
    cnpj?: string | null;
    cpf?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    stateRegistration?: string | null;
    municipalRegistration?: string | null;
    streetType?: string | null;
    registrationStatus?: string | null;
  };
  responsible?: { id: string; name: string; role?: string; email?: string | null; phone?: string | null };
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

  layoutFiles?: File[];

  simultaneousTasks: number | null;

  /**
   * Como o cliente paga um orçamento que cobre mais de um veículo.
   *
   * `JOINT` (padrão): uma fatura, um plano de parcelas, uma NFS-e para os N
   * veículos. `PER_TASK`: uma fatura por veículo, e o financeiro aprova veículo
   * a veículo, com o vencimento contado de cada aprovação.
   */
  billingSplit?: QUOTE_BILLING_SPLIT;

  /**
   * AS TAREFAS do orçamento — uma por veículo, na ordem do documento.
   *
   * Era `task` no singular, quando `Task.quoteId` era `@unique`. Um orçamento
   * passou a cobrir N veículos: dois números de série na criação produzem duas
   * tarefas e UM orçamento.
   */
  tasks?: any[];
  /**
   * @deprecated Forma anterior ao orçamento multitarefa.
   *
   * A API ainda ACEITA `include: { task: … }` (o app instalado nos aparelhos o
   * envia) e traduz para a relação de lista, mas a RESPOSTA vem em `tasks`. Este
   * campo permanece declarado só para o código que ainda não migrou compilar;
   * leia por `quoteTasks()` / `primaryTask()` em `@/utils/quote-tasks`.
   */
  task?: any;
  services?: TaskQuoteService[];
  customerConfigs?: TaskQuoteCustomerConfig[];
}
