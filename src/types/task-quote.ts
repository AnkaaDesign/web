import type { BaseEntity } from './common';
import type { File } from './file';
import type { Installment } from './invoice';
import type { Task } from './task';

export type TASK_QUOTE_STATUS = 'PENDING' | 'SIGNED' | 'EXPIRED' | 'BUDGET_APPROVED' | 'BILLING_APPROVED' | 'UPCOMING' | 'DUE' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';
export type DISCOUNT_TYPE = 'NONE' | 'PERCENTAGE' | 'FIXED_VALUE';
/**
 * JUNTO, SEPARADO OU EM LOTES.
 *
 * `JOINT`: uma fatura, um plano de parcelas e uma NFS-e para os N veículos — o
 * padrão, e o comportamento de sempre. `PER_TASK`: um faturamento por veículo,
 * aprovado veículo a veículo. `CUSTOM`: lotes livres, e aí a cobertura vem das
 * linhas de `Billing.tasks`, não do modo.
 */
export type QUOTE_BILLING_SPLIT = 'JOINT' | 'PER_TASK' | 'CUSTOM';

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
   * O FATURAMENTO a que este pagador pertence — e de onde vêm a COBERTURA (quais
   * veículos) e o ESTADO (se já foi aprovado).
   *
   * Nenhum dos dois mora mais aqui. Este registro é O PAGADOR: quem recebe a
   * cobrança, com que desconto, em que condições. Dois pagadores do mesmo
   * recorte são DOIS destes dentro de UM `Billing` — e era não saber disso que
   * fazia a tela desenhar "Fatura 1 · 2 · 3 · 4" numa página só.
   *
   * `billing.id` é o ENDEREÇO da tela de cobrança: `/financeiro/faturamento/:id`.
   *
   * ⚠️ É relação: uma resposta que não a pediu chega sem ela. Leia por
   * `coveredTaskIds()` / `coveredTaskCount()` / `billingApprovedAtOf()` de
   * `@/utils/quote-tasks`, que tratam a ausência como "cobre tudo" — nunca como
   * "cobre zero".
   */
  billingId?: string;
  billing?: {
    id: string;
    quoteId?: string;
    /** Quando ESTE faturamento foi aprovado. `TaskQuote.billingApprovedAt` é
     *  quando o ÚLTIMO fechou — "o orçamento inteiro está faturado". */
    approvedAt?: Date | string | null;
    createdAt?: Date | string;
    tasks?: Array<{
      taskId: string;
      task?: {
        id?: string;
        name?: string | null;
        serialNumber?: string | null;
        customerOrderNumber?: string | null;
        truck?: { plate?: string | null; chassisNumber?: string | null } | null;
      } | null;
    }>;
  } | null;
  subtotal: number;
  total: number;
  discountType: DISCOUNT_TYPE;
  discountValue?: number | null;
  discountReference?: string | null;
  customPaymentText: string | null;
  generateInvoice?: boolean;
  generateBankSlip?: boolean;
  /**
   * @deprecated A coluna saiu do banco na migração `20260909170000`: o número do
   * pedido de compra é do VEÍCULO (`Task.customerOrderNumber`), porque um
   * orçamento cobre N caminhões e o pedido é por ENTREGA.
   *
   * Nunca chega preenchido numa leitura. Segue declarado porque a API ainda
   * ACEITA o campo na escrita (o app instalado o envia e o servidor o traduz
   * para as tarefas) — nenhuma tela deste repositório o manda.
   */
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
  tasks?: Task[];

  /**
   * QUANTOS VEÍCULOS o orçamento cobre — coluna em `TaskQuote`, mantida pela API
   * junto dos totais (`recalcQuoteTotals`).
   *
   * Existe porque `total` é o valor do CONTRATO (`por veículo × N`) e as LISTAS
   * mostram uma linha por tarefa sem carregar a relação de veículos: sem este
   * número elas não têm como dividir, e cada linha afirma o total dos sessenta.
   * Leia por `quoteVehicleCount()` / `quotePerVehicleTotal()`.
   */
  vehicleCount?: number | null;
  /**
   * @deprecated Forma anterior ao orçamento multitarefa.
   *
   * A API ainda ACEITA `include: { task: … }` (o app instalado nos aparelhos o
   * envia) e traduz para a relação de lista, mas a RESPOSTA vem em `tasks`. Este
   * campo permanece declarado só para o código que ainda não migrou compilar;
   * leia por `quoteTasks()` / `primaryTask()` em `@/utils/quote-tasks`.
   */
  task?: Task;
  services?: TaskQuoteService[];
  customerConfigs?: TaskQuoteCustomerConfig[];
}
