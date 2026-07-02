// packages/interfaces/src/order.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse } from "./common";
import type { ORDER_STATUS, ORDER_PAYMENT_STATUS, ORDER_INSTALLMENT_STATUS, PAYMENT_METHOD, SCHEDULE_FREQUENCY, WEEK_DAY, MONTH, ORDER_TRIGGER_TYPE, ORDER_BY_DIRECTION, RESCHEDULE_REASON } from '@constants';
import type { Supplier, SupplierIncludes, SupplierOrderBy } from "./supplier";
import type { Item, ItemCategory, ItemIncludes, ItemOrderBy, ItemWhere } from "./item";
import type { File, FileIncludes } from "./file";
import type {
  PpeDeliverySchedule,
  PpeDeliveryScheduleIncludes,
  WeeklyScheduleConfig,
  MonthlyScheduleConfig,
  YearlyScheduleConfig,
  WeeklyScheduleConfigIncludes,
  MonthlyScheduleConfigIncludes,
  YearlyScheduleConfigIncludes,
} from "./ppe";
import type { Activity, ActivityIncludes, ActivityOrderBy } from "./activity";
import type { User } from "./user";

// =====================
// Order Schedule Interfaces
// =====================

export interface OrderSchedule extends BaseEntity {
  // Identification fields
  name: string | null;
  description: string | null;

  // Target supplier for generated orders. Nullable for legacy schedules created
  // before the field existed; service propagates `supplierId ?? null` to orders.
  supplierId: string | null;

  frequency: SCHEDULE_FREQUENCY;
  frequencyCount: number;
  isActive: boolean;
  items: string[];

  // Specific scheduling fields
  specificDate: Date | null;
  dayOfMonth: number | null;
  dayOfWeek: WEEK_DAY | null;
  month: MONTH | null;
  customMonths: MONTH[];

  // Reschedule fields
  rescheduleCount: number;
  originalDate: Date | null;
  lastRescheduleDate: Date | null;
  rescheduleReason: RESCHEDULE_REASON | null;

  // Schedule configuration relations
  weeklyConfigId: string | null;
  monthlyConfigId: string | null;
  yearlyConfigId: string | null;

  nextRun: Date | null;
  lastRun: Date | null;
  // When the schedule was last evaluated by the worker (distinct from lastRun,
  // which is set only when an order is actually created).
  lastFiredAt?: Date | null;
  finishedAt: Date | null;
  lastRunId: string | null;
  originalScheduleId: string | null;

  // Relations (optional, populated based on query)
  supplier?: Supplier;
  weeklyConfig?: WeeklyScheduleConfig;
  monthlyConfig?: MonthlyScheduleConfig;
  yearlyConfig?: YearlyScheduleConfig;
  order?: Order;
}

// =====================
// Order Rule Interface
// =====================

export interface OrderRule extends BaseEntity {
  itemId: string;
  supplierId: string | null;
  isActive: boolean;
  priority: number;
  triggerType: ORDER_TRIGGER_TYPE;
  consumptionDays: number | null;
  safetyStockDays: number | null;
  minOrderQuantity: number | null;
  maxOrderQuantity: number | null;
  orderMultiple: number | null;

  // Relations (optional, populated based on query)
  item?: Item;
  supplier?: Supplier;
}

// =====================
// Order Item Interface
// =====================

export interface OrderItem extends BaseEntity {
  orderId: string;
  itemId: string | null;
  // Temporary (itemId = null) line fields. `temporaryItemDescription` is the PURE
  // name; código/marca/medidas/categoria are discrete fields. Legacy rows may keep
  // an old crammed string in temporaryItemDescription with the others null.
  temporaryItemDescription: string | null;
  temporaryItemUniCode: string | null;
  temporaryItemBrand: string | null;
  temporaryItemMeasures: string | null;
  temporaryItemCategoryId: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  price: number;
  unitPrice?: number;
  icms: number;
  ipi: number;
  receivedAt: Date | null;
  fulfilledAt: Date | null;

  // Relations (optional, populated based on query)
  item?: Item;
  temporaryItemCategory?: ItemCategory | null;
  order?: Order;
  activities?: Activity[];
}

// =====================
// Main Order Interface
// =====================

export interface Order extends BaseEntity {
  // Incremental, human-readable order number (4-digit when formatted, e.g. "0001").
  // Null for orders created before the numbering feature existed.
  orderNumber: number | null;
  description: string;
  forecast: Date | null;
  status: ORDER_STATUS;
  statusOrder: number; // Status numeric order for sorting: 1=Created, 2=PartiallyFulfilled, 3=Fulfilled, 4=Overdue, 5=PartiallyReceived, 6=Received, 7=Cancelled
  // Payment workflow (contas a pagar)
  paymentStatus: ORDER_PAYMENT_STATUS;
  paymentStatusOrder: number; // 1=AwaitingPayment, 2=PartiallyPaid, 3=Paid
  paidAt: Date | null;
  paidById: string | null;
  installmentCount: number;
  receiptIds?: string[];
  supplierId: string | null;
  orderScheduleId: string | null;
  orderRuleId: string | null;
  ppeScheduleId: string | null;
  notes: string | null;
  freight: number;
  discount: number;
  // Manual override of the order grand total. Null = use the computed total
  // (items − discount + freight); a number = the manually set grand total.
  totalOverride: number | null;
  paymentMethod: PAYMENT_METHOD | null;
  paymentPix: string | null;
  paymentDueDays: number | null; // boleto: intervalo (dias) entre parcelas
  paymentFirstDueDate: Date | null; // boleto: vencimento da 1ª parcela
  paymentResponsibleId: string | null;
  paymentAssignedById: string | null;

  // Relations (optional, populated based on query)
  paymentResponsible?: User;
  paymentAssignedBy?: User;
  paidBy?: User;
  installments?: OrderInstallment[];
  receipts?: File[];
  supplier?: Supplier;
  orderSchedule?: OrderSchedule;
  ppeSchedule?: PpeDeliverySchedule;
  items?: OrderItem[];
  activities?: Activity[];

  // Prisma count fields
  _count?: {
    items?: number;
    activities?: number;
  };
}

// Payment installment (boleto 2x/3x). Single-payment PIX/cartão orders carry none.
export interface OrderInstallment {
  id: string;
  orderId: string;
  number: number;
  dueDate: Date | null;
  amount: number;
  paidAmount: number;
  status: ORDER_INSTALLMENT_STATUS;
  paidAt: Date | null;
  paidById: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  order?: Order;
  paidBy?: User;
}

// =====================
// Include Types
// =====================

export interface OrderIncludes {
  receipts?:
    | boolean
    | {
        include?: FileIncludes;
      };
  supplier?:
    | boolean
    | {
        include?: SupplierIncludes;
      };
  orderSchedule?:
    | boolean
    | {
        include?: OrderScheduleIncludes;
      };
  ppeSchedule?:
    | boolean
    | {
        include?: PpeDeliveryScheduleIncludes;
      };
  items?:
    | boolean
    | {
        include?: OrderItemIncludes;
        where?: OrderItemWhere;
        orderBy?: OrderItemOrderBy;
        take?: number;
        skip?: number;
      };
  activities?:
    | boolean
    | {
        include?: ActivityIncludes;
        where?: any; // ActivityWhere not yet defined
        orderBy?: ActivityOrderBy;
        take?: number;
        skip?: number;
      };
  installments?:
    | boolean
    | {
        include?: any; // OrderInstallmentIncludes not yet defined
      };
  paymentResponsible?: boolean;
  paymentAssignedBy?: boolean;
  _count?:
    | boolean
    | {
        select?: {
          items?: boolean;
          activities?: boolean;
        };
      };
}

export interface OrderItemIncludes {
  item?:
    | boolean
    | {
        include?: ItemIncludes;
        where?: ItemWhere;
        orderBy?: ItemOrderBy;
      };
  temporaryItemCategory?: boolean;
  order?:
    | boolean
    | {
        include?: OrderIncludes;
        where?: OrderWhere;
        orderBy?: OrderOrderBy;
      };
  activities?:
    | boolean
    | {
        include?: ActivityIncludes;
        where?: any; // ActivityWhere not yet defined
        orderBy?: ActivityOrderBy;
      };
}

export interface OrderScheduleIncludes {
  weeklyConfig?:
    | boolean
    | {
        include?: WeeklyScheduleConfigIncludes;
      };
  monthlyConfig?:
    | boolean
    | {
        include?: MonthlyScheduleConfigIncludes;
      };
  yearlyConfig?:
    | boolean
    | {
        include?: YearlyScheduleConfigIncludes;
      };
  order?:
    | boolean
    | {
        include?: OrderIncludes;
      };
}

export interface OrderRuleIncludes {
  item?:
    | boolean
    | {
        include?: ItemIncludes;
      };
  supplier?:
    | boolean
    | {
        include?: SupplierIncludes;
      };
}

// =====================
// Where Types
// =====================

export interface OrderWhere {
  id?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  description?: string | { equals?: string; not?: string; contains?: string; startsWith?: string; endsWith?: string; mode?: "default" | "insensitive" };
  status?: ORDER_STATUS | { equals?: ORDER_STATUS; not?: ORDER_STATUS; in?: ORDER_STATUS[]; notIn?: ORDER_STATUS[] };
  statusOrder?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  paymentStatus?: ORDER_PAYMENT_STATUS | { equals?: ORDER_PAYMENT_STATUS; not?: ORDER_PAYMENT_STATUS; in?: ORDER_PAYMENT_STATUS[]; notIn?: ORDER_PAYMENT_STATUS[] };
  paymentStatusOrder?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  paidAt?: Date | null | { equals?: Date | null; not?: Date | null; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  supplierId?: string | null | { equals?: string | null; not?: string | null; in?: string[]; notIn?: string[] };
  forecast?: Date | null | { equals?: Date | null; not?: Date | null; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  createdAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  updatedAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  AND?: OrderWhere | OrderWhere[];
  OR?: OrderWhere[];
  NOT?: OrderWhere | OrderWhere[];
}

export interface OrderItemWhere {
  id?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  orderId?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  itemId?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  orderedQuantity?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  receivedQuantity?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  price?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  icms?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  ipi?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  receivedAt?: Date | null | { equals?: Date | null; not?: Date | null; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  fulfilledAt?: Date | null | { equals?: Date | null; not?: Date | null; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  createdAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  updatedAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  AND?: OrderItemWhere | OrderItemWhere[];
  OR?: OrderItemWhere[];
  NOT?: OrderItemWhere | OrderItemWhere[];
}

export interface OrderScheduleWhere {
  id?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  frequency?: SCHEDULE_FREQUENCY | { equals?: SCHEDULE_FREQUENCY; not?: SCHEDULE_FREQUENCY; in?: SCHEDULE_FREQUENCY[]; notIn?: SCHEDULE_FREQUENCY[] };
  isActive?: boolean | { equals?: boolean; not?: boolean };
  nextRun?: Date | null | { equals?: Date | null; not?: Date | null; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  lastRun?: Date | null | { equals?: Date | null; not?: Date | null; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  createdAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  updatedAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  AND?: OrderScheduleWhere | OrderScheduleWhere[];
  OR?: OrderScheduleWhere[];
  NOT?: OrderScheduleWhere | OrderScheduleWhere[];
}

export interface OrderRuleWhere {
  id?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  itemId?: string | { equals?: string; not?: string; in?: string[]; notIn?: string[] };
  supplierId?: string | null | { equals?: string | null; not?: string | null; in?: string[]; notIn?: string[] };
  isActive?: boolean | { equals?: boolean; not?: boolean };
  triggerType?: ORDER_TRIGGER_TYPE | { equals?: ORDER_TRIGGER_TYPE; not?: ORDER_TRIGGER_TYPE; in?: ORDER_TRIGGER_TYPE[]; notIn?: ORDER_TRIGGER_TYPE[] };
  priority?: number | { equals?: number; not?: number; lt?: number; lte?: number; gt?: number; gte?: number };
  createdAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  updatedAt?: Date | { equals?: Date; not?: Date; lt?: Date; lte?: Date; gt?: Date; gte?: Date };
  AND?: OrderRuleWhere | OrderRuleWhere[];
  OR?: OrderRuleWhere[];
  NOT?: OrderRuleWhere | OrderRuleWhere[];
}

// =====================
// Order By Types
// =====================

export interface OrderOrderBy {
  id?: ORDER_BY_DIRECTION;
  orderNumber?: ORDER_BY_DIRECTION;
  description?: ORDER_BY_DIRECTION;
  forecast?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  statusOrder?: ORDER_BY_DIRECTION;
  paymentStatus?: ORDER_BY_DIRECTION;
  paymentStatusOrder?: ORDER_BY_DIRECTION;
  paidAt?: ORDER_BY_DIRECTION;
  notes?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  supplier?: SupplierOrderBy;
}

export interface OrderItemOrderBy {
  id?: ORDER_BY_DIRECTION;
  orderedQuantity?: ORDER_BY_DIRECTION;
  receivedQuantity?: ORDER_BY_DIRECTION;
  price?: ORDER_BY_DIRECTION;
  icms?: ORDER_BY_DIRECTION;
  ipi?: ORDER_BY_DIRECTION;
  receivedAt?: ORDER_BY_DIRECTION;
  fulfilledAt?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  item?: ItemOrderBy;
  order?: OrderOrderBy;
}

export interface OrderScheduleOrderBy {
  id?: ORDER_BY_DIRECTION;
  frequency?: ORDER_BY_DIRECTION;
  frequencyCount?: ORDER_BY_DIRECTION;
  isActive?: ORDER_BY_DIRECTION;
  nextRun?: ORDER_BY_DIRECTION;
  lastRun?: ORDER_BY_DIRECTION;
  finishedAt?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
}

export interface OrderRuleOrderBy {
  id?: ORDER_BY_DIRECTION;
  isActive?: ORDER_BY_DIRECTION;
  priority?: ORDER_BY_DIRECTION;
  triggerType?: ORDER_BY_DIRECTION;
  consumptionDays?: ORDER_BY_DIRECTION;
  safetyStockDays?: ORDER_BY_DIRECTION;
  minOrderQuantity?: ORDER_BY_DIRECTION;
  maxOrderQuantity?: ORDER_BY_DIRECTION;
  orderMultiple?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  item?: ItemOrderBy;
  supplier?: SupplierOrderBy;
}

// =====================
// Response Interfaces
// =====================

// Order responses
export interface OrderGetUniqueResponse extends BaseGetUniqueResponse<Order> {}
export interface OrderGetManyResponse extends BaseGetManyResponse<Order> {}

// Payment summary (contas a pagar) — lightweight per-paymentStatus aggregates
// computed server-side: items (price×qty + ICMS/IPI) − discount% on goods
// subtotal + freight. PAID is windowed to the last 90 days.
export interface OrderPaymentSummaryBucket {
  count: number;
  total: number;
}

export interface OrderPaymentSummaryData {
  AWAITING_PAYMENT: OrderPaymentSummaryBucket;
  PARTIALLY_PAID: OrderPaymentSummaryBucket;
  /** PAID universe is unbounded, so it is windowed to the last 90 days. */
  PAID_LAST_90_DAYS: OrderPaymentSummaryBucket;
}

export interface OrderPaymentSummaryResponse {
  success: boolean;
  message: string;
  data: OrderPaymentSummaryData;
}

// =====================
// Unified payables (Contas a Pagar) — mirrors api/src/types/order.ts
// =====================

export type PayableSource =
  | "ORDER"
  | "AIRBRUSHING"
  | "SCHEDULED"
  | "TAX"
  | "PAYROLL"
  | "PAYROLL_SCHEDULED"
  | "RECURRING"
  // A materialized monthly occurrence of a first-class RecurrentPayable
  // (rent/internet/energy/water). Supersedes RECURRING for promoted categories.
  | "RECURRENT_PAYABLE";

/** How a payable row is settled — lets the UI pick the action generically. */
export type PayableSettleVia =
  | "ORDER_LIFECYCLE"
  | "AIRBRUSHING"
  | "THIRTEENTH"
  | "VACATION"
  | "PAYROLL_MONTH"
  | "SCHEDULE_TRIGGER"
  | "RECONCILIATION"
  // Mark-paid on a RecurrentPayableOccurrence; VARIABLE bills prompt for the
  // real paid amount, FIXED settle with the known amount.
  | "RECURRENT_PAYABLE"
  | "NONE";

export type PayableState = "AWAITING_PAYMENT" | "OVERDUE" | "PARTIALLY_PAID" | "EXPECTED" | "PAID";

/**
 * Axis B — the bank-confirmation (conciliação) state, INDEPENDENT of the
 * payment assertion axis (paymentState / receivable state). Derived from the
 * existence of a non-reversed ReconciliationMatch + an amount comparison:
 *   - UNCLEARED — no confirming bank line yet (the "Pago · aguardando
 *     conciliação" 3-5 day window).
 *   - CLEARED   — a non-reversed match exists and its amount agrees.
 *   - DISPUTED  — a match exists but the bank line differs beyond tolerance.
 * Mirrors api/src/types/order.ts ClearanceState.
 */
export type ClearanceState = "UNCLEARED" | "CLEARED" | "DISPUTED";

/**
 * {@link PayableRow.threeWayConsistency} discriminant — whether the order's
 * matched bank outflow, linked-NF totals and installment amounts agree.
 * Mirrors api/src/types/order.ts ThreeWayFlag.
 */
export type ThreeWayFlag = "OK" | "MISMATCH";

/** One normalized payable row: an open order, an airbrushing painter payment, or a scheduled/expected outflow. */
export interface PayableRow {
  source: PayableSource;
  /** Source entity id (orderId / airbrushingId / scheduleId). */
  id: string;
  /** Grouping key — supplier id, painter id, or schedule supplier id. May be null. */
  payeeId: string | null;
  payeeName: string;
  /** Supplier CNPJ of the counterparty (the "Tomador") — may be null. */
  payeeCnpj: string | null;
  /**
   * False for PENDING orders that still need an admin's "Requisitar Pagamento";
   * true for every already-requested obligation. PENDING rows render muted and
   * cannot be settled (mirrors the EXPECTED/forecast treatment).
   */
  paymentRequested: boolean;
  /** Order PIX key — populated only when the payment method is PIX, else null. */
  pixKey: string | null;
  description: string;
  amount: number;
  paymentState: PayableState;
  dueDate: string | null;
  method: string | null;
  /** When the row was settled (PAID rows only). */
  paidAt?: string | null;
  /** Convenience link back to the originating task (airbrushing rows). */
  taskId?: string | null;
  /** Installment id when the row represents a single boleto parcela. */
  installmentId?: string | null;
  /** How to settle this row (drives the Contas a Pagar action menu). */
  settleVia?: PayableSettleVia;
  /** Estimated value (taxes / recurrents / schedules) — informational. */
  isEstimate?: boolean;
  /** Sub-label: installment ("1ª parcela"), Fixo/Variável, etc. */
  subtype?: string | null;
  /**
   * RECURRENT_PAYABLE rows only — occurrence IGNORED for its month (e.g. diarista
   * faltou). Rendered muted with an "Ignorado" badge, excluded from all summary
   * totals, and revertible via the row action.
   */
  ignored?: boolean;
  /** Competence the row belongs to (YYYY-MM) — payroll/tax/recurring. */
  competence?: string | null;
  /** Deep-link target for RECONCILIATION/SCHEDULE settle actions. */
  settleHref?: string | null;
  /**
   * Axis B — bank-confirmation state, derived from a non-reversed
   * ReconciliationMatch on this row's anchor. Independent of paymentState:
   * a PAID row may still be UNCLEARED (awaiting the next OFX). Defaults to
   * 'UNCLEARED' for rows that have no confirming bank line.
   */
  clearanceState?: ClearanceState;
  /** When the confirming bank line cleared this row (CLEARED/DISPUTED only). */
  clearedAt?: string | null;
  /** The bank transaction that cleared this row (for row → extrato linking). */
  bankTransactionId?: string | null;
  /**
   * C4 — per-order 3-way consistency (ORDER rows only): whether the matched bank
   * outflow, the linked NF totals and the installment amounts agree within
   * tolerance. 'OK' when bank-backed and consistent, 'MISMATCH' when bank-backed
   * but the three sums diverge, null/undefined when the order has no bank backing
   * yet (paid-on-paper / still open — nothing to cross-validate).
   * Mirrors api/src/types/order.ts PayableRow.threeWayConsistency.
   */
  threeWayConsistency?: ThreeWayFlag | null;
  /**
   * The three sums behind {@link threeWayConsistency} (pedido ≟ nf ≟ transação):
   * `tx` = Σ conciliated bank debits, `nf` = Σ linked NF totals,
   * `installment` = Σ order installment amounts (the pedido total).
   */
  threeWaySums?: { tx: number; nf: number; installment: number } | null;
}

export interface PayablesSummary {
  AWAITING_PAYMENT: OrderPaymentSummaryBucket;
  OVERDUE: OrderPaymentSummaryBucket;
  PARTIALLY_PAID: OrderPaymentSummaryBucket;
  EXPECTED: OrderPaymentSummaryBucket;
  /** Settled this month. */
  PAID: OrderPaymentSummaryBucket;
}

export interface PayablesResponse {
  success: boolean;
  message: string;
  data: {
    rows: PayableRow[];
    summary: PayablesSummary;
  };
}
export interface OrderCreateResponse extends BaseCreateResponse<Order> {}
export interface OrderUpdateResponse extends BaseUpdateResponse<Order> {}
export interface OrderDeleteResponse extends BaseDeleteResponse {}

// OrderItem responses
export interface OrderItemGetUniqueResponse extends BaseGetUniqueResponse<OrderItem> {}
export interface OrderItemGetManyResponse extends BaseGetManyResponse<OrderItem> {}
export interface OrderItemCreateResponse extends BaseCreateResponse<OrderItem> {}
export interface OrderItemUpdateResponse extends BaseUpdateResponse<OrderItem> {}
export interface OrderItemDeleteResponse extends BaseDeleteResponse {}

// OrderSchedule responses
export interface OrderScheduleGetUniqueResponse extends BaseGetUniqueResponse<OrderSchedule> {}
export interface OrderScheduleGetManyResponse extends BaseGetManyResponse<OrderSchedule> {}
export interface OrderScheduleCreateResponse extends BaseCreateResponse<OrderSchedule> {}
export interface OrderScheduleUpdateResponse extends BaseUpdateResponse<OrderSchedule> {}
export interface OrderScheduleDeleteResponse extends BaseDeleteResponse {}

// OrderRule responses
export interface OrderRuleGetUniqueResponse extends BaseGetUniqueResponse<OrderRule> {}
export interface OrderRuleGetManyResponse extends BaseGetManyResponse<OrderRule> {}
export interface OrderRuleCreateResponse extends BaseCreateResponse<OrderRule> {}
export interface OrderRuleUpdateResponse extends BaseUpdateResponse<OrderRule> {}
export interface OrderRuleDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses
// =====================

// Order batch operations
export interface OrderBatchCreateResponse<T> extends BaseBatchResponse<Order, T> {}
export interface OrderBatchUpdateResponse<T> extends BaseBatchResponse<Order, T & { id: string }> {}
export interface OrderBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}

// OrderItem batch operations
export interface OrderItemBatchCreateResponse<T> extends BaseBatchResponse<OrderItem, T> {}
export interface OrderItemBatchUpdateResponse<T> extends BaseBatchResponse<OrderItem, T & { id: string }> {}
export interface OrderItemBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}

// OrderSchedule batch operations
export interface OrderScheduleBatchCreateResponse<T> extends BaseBatchResponse<OrderSchedule, T> {}
export interface OrderScheduleBatchUpdateResponse<T> extends BaseBatchResponse<OrderSchedule, T & { id: string }> {}
export interface OrderScheduleBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}

// OrderRule batch operations
export interface OrderRuleBatchCreateResponse<T> extends BaseBatchResponse<OrderRule, T> {}
export interface OrderRuleBatchUpdateResponse<T> extends BaseBatchResponse<OrderRule, T & { id: string }> {}
export interface OrderRuleBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}

// =====================
// OrderSchedule Projection & Trigger
// =====================

export type OrderScheduleCascadeMode = "GAP_ONLY" | "GAP_PLUS_CYCLE";

export interface OrderScheduleProjectionItem {
  itemId: string;
  itemName: string;
  unitPrice: number;
  // GAP_ONLY ("Executar agora" — cover only until the next run).
  quantityGapOnly: number;
  totalGapOnly: number;
  reasonGapOnly: string | null;
  skippedGapOnly: boolean;
  // GAP_PLUS_CYCLE ("Executar agora + ciclo" — gap + one full cycle).
  quantityGapPlusCycle: number;
  totalGapPlusCycle: number;
  reasonGapPlusCycle: string | null;
  skippedGapPlusCycle: boolean;
}

export interface OrderScheduleProjectionMeta {
  nextRun: string | null;
  scheduledDate: string | null;
  gapDays: number;
  intervalDays: number | null;
  hasGap: boolean;
  // Column totals — each equals the order its trigger mode actually creates.
  gapOnlyTotal: number;
  gapOnlyCoverageDays: number;
  gapPlusCycleTotal: number;
  gapPlusCycleCoverageDays: number;
  // Forecast of the next automatic order (informational; matches "Preço esperado").
  scheduledTotal: number;
  scheduledCoverageDays: number;
}

export interface OrderScheduleProjectionResponse {
  success: boolean;
  message: string;
  data: {
    items: OrderScheduleProjectionItem[];
    meta: OrderScheduleProjectionMeta;
  };
}

export interface OrderScheduleTriggerData {
  order: Order;
  cascadeMode: OrderScheduleCascadeMode;
  coverageDays: number;
  gapDays: number;
  intervalDays: number | null;
  nextRun: string | null;
}

export interface OrderScheduleTriggerResponse {
  success: boolean;
  message: string;
  data: OrderScheduleTriggerData | null;
}

export interface OrderScheduleExpectedTotal {
  id: string;
  expectedTotal: number;
  nextRun: string | null;
  gapDays: number;
}

export interface OrderScheduleExpectedTotalsResponse {
  success: boolean;
  data: OrderScheduleExpectedTotal[];
}
