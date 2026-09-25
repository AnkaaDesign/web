import type { BaseEntity } from './common';
import type { File } from './file';
import type { Installment } from './invoice';
import type { Task } from './task';

/**
 * O CICLO DO ORÇAMENTO — e só dele. Encolheu para cinco em 16/09/2026: o
 * pagamento é de outra entidade (`Billing`), e o ciclo dele é `BILLING_STATUS`.
 *
 * ⚠️ Espelho de `@/constants/enums`. O enum lá é o valor; este é o tipo que as
 * telas usam. Os dois têm de ter os mesmos cinco membros.
 */
export type TASK_QUOTE_STATUS =
  | 'REQUESTED'
  | 'EXPIRED'
  | 'PRE_APPROVED'
  | 'SIGNED'
  | 'IN_NEGOTIATION'
  | 'PENDING'
  | 'APPROVED'
  | 'CANCELLED';
/**
 * O CICLO DO FATURAMENTO. Derivado no servidor de `approvedAt` + das parcelas;
 * nenhuma tela o escreve. ⚠️ Não existe "A Vencer": depois de aprovar é
 * `APPROVED`, que já quer dizer "cobrado, esperando pagar".
 */
export type BILLING_STATUS = 'OVERDUE' | 'PENDING' | 'APPROVED' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';
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

export interface BudgetItem extends BaseEntity {
  description: string;
  observation?: string | null;
  amount: number;
  quoteId: string;
  invoiceToCustomerId?: string | null;
  invoiceToCustomer?: { id: string; corporateName?: string; fantasyName: string; cnpj?: string | null };
  quote?: Budget;
}

export interface BudgetPayer extends BaseEntity {
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
    /** Quando ESTE faturamento foi aprovado. `Budget.billingApprovedAt` é
     *  quando o ÚLTIMO fechou — "o orçamento inteiro está faturado". */
    approvedAt?: Date | string | null;
    /**
     * O ESTADO DA COBRANÇA — o que a lista de Faturamento mostra e ordena.
     *
     * ⚠️ NÃO é `quote.status`: aquele é o ciclo do orçamento, que termina em
     * `APPROVED`. Um orçamento aprovado pode ter uma cobrança liquidada e outra
     * vencida ao mesmo tempo, e era ter um campo só para as duas que fazia a
     * lista escolher "a última que rodasse".
     *
     * ⚠️ Só chega quando a consulta pede `billing: { select: { status: true,
     * statusOrder: true, … } }` explicitamente — o include automático do
     * servidor (`withCoverageInclude`) traz id, `approvedAt` e a cobertura, não
     * o estado.
     */
    status?: BILLING_STATUS;
    /** Espelho numérico de `status` para ordenação — ver `BILLING_STATUS_ORDER`. */
    statusOrder?: number;
    createdAt?: Date | string;
    tasks?: Array<{
      taskId: string;
      task?: {
        id?: string;
        name?: string | null;
        customerOrderNumber?: string | null;
        implement?: { serialNumber?: string | null; plate?: string | null; chassisNumber?: string | null } | null;
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
   * orçamento cobre N implementos e o pedido é por ENTREGA.
   *
   * Nunca chega preenchido numa leitura. Segue declarado porque a API ainda
   * ACEITA o campo na escrita (o app instalado o envia e o servidor o traduz
   * para as tarefas) — nenhuma tela deste repositório o manda.
   */
  orderNumber?: string | null;
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
  // ⛔ `responsible` NÃO existe mais em `BudgetPayer` — a coluna saiu na
  // migration `20260918120000`. O tipo continuou declarando o campo, e um tipo
  // que promete o que o servidor não manda é como uma tela volta vazia sem
  // erro. Quem responde pelo orçamento é `Task.responsibles`.
  installments?: Installment[];
}

/** Ver `Budget.layoutScope`. */
export type QuoteLayoutScope = "SHARED" | "PER_VEHICLE";

/** Uma arte aprovada do orçamento, com os veículos que ela cobre (só em `PER_VEHICLE`). */
export type QuoteLayoutFile = File & { quoteLayoutTasks?: Array<{ taskId: string }> };

export interface Budget extends BaseEntity {
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

  /**
   * As artes aprovadas do orçamento — o "Layout" do documento.
   *
   * Com `layoutScope = PER_VEHICLE`, cada arte carrega em `quoteLayoutTasks` os
   * veículos a que se aplica (ver `utils/quote-layout-coverage.ts`). Em `SHARED`
   * a lista vem vazia e toda arte vale para todos.
   */
  layoutFiles?: QuoteLayoutFile[];

  /**
   * A arte é a mesma para os N veículos (`SHARED`, o de sempre) ou cada implemento
   * tem a sua (`PER_VEHICLE`)? Ausente = `SHARED` (API anterior a esta coluna).
   */
  layoutScope?: QuoteLayoutScope;

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
   * QUANTOS VEÍCULOS o orçamento cobre — coluna em `Budget`, mantida pela API
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
  services?: BudgetItem[];
  customerConfigs?: BudgetPayer[];

  /**
   * AS COBRANÇAS deste orçamento — 1..N, cada uma com id, cobertura e estado
   * próprios.
   *
   * É onde mora tudo que é do pagamento. `customerConfigs` é a lista de
   * PAGADORES; ela aponta para a cobrança por `billingId`/`billing`, e não o
   * contrário.
   *
   * ⚠️ Relação: só vem quando a consulta a pede. Ausente NÃO quer dizer "não há
   * cobrança" — quer dizer "não perguntei".
   */
  billings?: Billing[];
}

/**
 * UMA COBRANÇA — o que é cobrado, de quem, em quantas parcelas e com que nota.
 *
 * Separada de `Budget` em 16/09/2026: o orçamento se altera até a execução do
 * serviço; o faturamento, até o pagamento terminar. Um orçamento tem 1..N
 * cobranças (uma por veículo, por lote, ou uma só para todos).
 */
export interface Billing {
  id: string;
  quoteId: string;
  /** Quando ESTA cobrança foi aprovada — nulo enquanto `status` for `PENDING`. */
  approvedAt?: Date | string | null;
  /** Derivado no servidor de `approvedAt` + das parcelas. Ninguém o digita. */
  status: BILLING_STATUS;
  /** Espelho numérico de `status` — ver `BILLING_STATUS_ORDER`. */
  statusOrder: number;
  /**
   * O ESTADO DA PARTE dos pagadores filtrados em "Faturar Para" — a mesma regra
   * de `status`, aplicada só às parcelas deles. `GET /billings` só o manda quando
   * a lista tem esse filtro; fora dele, é `status` que vale.
   */
  payerStatus?: BILLING_STATUS | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  /** OS VEÍCULOS que esta cobrança cobre. */
  tasks?: Array<{ taskId: string; task?: Task | null }>;
  /** A QUEM se cobra, e em que termos. Um por pagador. */
  customerConfigs?: BudgetPayer[];
  quote?: Budget;
}
