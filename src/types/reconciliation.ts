import type { ACCOUNTING_TYPE } from "../constants";

// Lifecycle (independent from how it got there and what category it is).
export type ReconciliationStatus =
  | "PENDING"
  | "RECONCILED"
  | "PARTIAL"
  | "IGNORED"
  | "DISPUTED";

export type ReconciliationSource = "AUTO" | "MANUAL";

// Dynamic, DB-backed taxonomy. A category is either mirrored from an inventory
// ItemCategory (ITEM_DERIVED), a fiscal-service category (SERVICE), or a
// user-created transaction-only bucket like "Aluguel" (TRANSACTION_ONLY).
export type TransactionCategoryKind =
  | "ITEM_DERIVED"
  | "SERVICE"
  | "TRANSACTION_ONLY";

export interface TransactionCategory {
  id: string;
  name: string;
  slug: string;
  kind: TransactionCategoryKind;
  itemCategoryId: string | null;
  // Accounting (DRE) classification mirrored onto the transaction category.
  accountingType: ACCOUNTING_TYPE | null;
  // A "resolving" category self-justifies an NF-less transaction (reconciled by
  // virtue of being classified).
  isResolving: boolean;
  // Surfaced in the monthly payables / recurrence forecast view.
  isRecurring: boolean;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

// A transaction carries multiple category tags, each with its own source +
// confidence + allocated amount (for split NFs).
export interface BankTransactionCategoryTag {
  id: string;
  categoryId: string;
  source: ReconciliationSource;
  confidence: number | null;
  allocatedAmount: number | null;
  derivedFromFiscalItemId: string | null;
  category: Pick<
    TransactionCategory,
    "id" | "name" | "slug" | "kind" | "color" | "isResolving" | "isRecurring"
  >;
}

export type MatchType =
  | "EXACT"
  | "VALUE_DATE"
  | "FUZZY"
  | "MANUAL"
  | "BANK_SLIP_BRIDGE";

export type TransactionType = "CREDIT" | "DEBIT";

export type BankTransactionSubtype =
  | "PIX"
  | "TED"
  | "DOC"
  | "BOLETO"
  | "TARIFA"
  | "IOF"
  | "CARTAO"
  | "TRANSFERENCIA"
  | "ESTORNO"
  | "RENDIMENTO"
  | "OUTROS";

export type FiscalDocType = "NFE" | "NFSE" | "CTE" | "NFCE" | "CFE";
export type OperationType = "ENTRADA" | "SAIDA";
export type FiscalDocumentStatus =
  | "AUTHORIZED"
  | "CANCELLED"
  | "DENIED"
  | "PENDING";
export type FiscalDocumentSource = "SIEG_API" | "MANUAL_UPLOAD";

export interface BankTransaction {
  id: string;
  // Bank account identifier columns — denormalized from the OFX so dedup runs
  // on (bankCode, agency, accountNumber, fitId) without joining a statement.
  bankCode: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  ownerCnpj: string | null;
  fitId: string;
  postedAt: string;
  amount: number;
  type: TransactionType;
  subtype: BankTransactionSubtype;
  rawTrnType: string | null;
  memo: string | null;
  counterpartyCnpjCpf: string | null;
  counterpartyName: string | null;
  runningBalance: number | null;
  reconciliationStatus: ReconciliationStatus;
  reconciliationSource: ReconciliationSource | null;
  // Whether this transaction is expected to be backed by a fiscal document
  // (the old `category === 'NF'` concept).
  expectsFiscalDocument: boolean;
  categories: BankTransactionCategoryTag[];
  categorySource: ReconciliationSource | null;
  classifiedAt: string | null;
  ignoredReason: string | null;
  /** Best candidate confidence (0-100) when no auto-match succeeded. */
  topMatchScore?: number | null;
  bankSlipId: string | null;
  rawFileId: string | null;
  uploadedById: string | null;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  matches?: ReconciliationMatch[];
}

export interface ReconciliationMatch {
  id: string;
  transactionId: string;
  fiscalDocumentId: string | null;
  bankSlipId: string | null;
  allocatedAmount: number;
  matchType: MatchType;
  confidenceScore: number;
  matchedByUserId: string | null;
  notes: string | null;
  matchedAt: string;
  reversedAt: string | null;
  reversedById: string | null;
  fiscalDocument?: Partial<FiscalDocument> | null;
  bankSlip?: {
    id: string;
    nossoNumero: string;
    paidAmount: number | null;
  } | null;
}

/** Per-item tax group extracted from the NFe XML (`det.imposto`). */
export interface FiscalItemTaxGroup {
  vBC?: number | null;
  pICMS?: number | null;
  vICMS?: number | null;
  pIPI?: number | null;
  vIPI?: number | null;
  pPIS?: number | null;
  vPIS?: number | null;
  pCOFINS?: number | null;
  vCOFINS?: number | null;
  cst?: string | null;
}

export interface FiscalItemTaxes {
  icms?: FiscalItemTaxGroup | null;
  ipi?: FiscalItemTaxGroup | null;
  pis?: FiscalItemTaxGroup | null;
  cofins?: FiscalItemTaxGroup | null;
}

export interface FiscalDocumentItem {
  id: string;
  code: string | null;
  description: string;
  quantity: number | string | null;
  unit: string | null;
  unitValue: number | string | null;
  totalValue: number | string;
  // Fiscal classification (NFe only — null for NFSe service lines).
  ncm?: string | null;
  cfop?: string | null;
  cest?: string | null;
  ean?: string | null;
  cst?: string | null;
  discount?: number | string | null;
  freight?: number | string | null;
  taxes?: FiscalItemTaxes | null;
  categoryId?: string | null;
  categoryConfidence?: number | null;
  categorySource?: ReconciliationSource | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  } | null;
}

/** Address blob extracted from the NFe XML (emit/dest). */
export interface FiscalAddress {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  fone?: string | null;
}

/** NFe ICMSTot totals breakdown. */
export interface FiscalTotals {
  vBC?: number;
  vICMS?: number;
  vICMSDeson?: number;
  vProd?: number;
  vFrete?: number;
  vSeg?: number;
  vDesc?: number;
  vOutro?: number;
  vST?: number;
  vIPI?: number;
  vPIS?: number;
  vCOFINS?: number;
  vNF?: number;
  vTotTrib?: number;
}

export interface FiscalDocument {
  id: string;
  accessKey: string;
  docType: FiscalDocType;
  operationType: OperationType;
  status: FiscalDocumentStatus;
  source: FiscalDocumentSource;
  issueDate: string;
  totalValue: number;
  emitCnpj: string;
  emitName: string | null;
  destCnpj: string | null;
  destCpf: string | null;
  destName: string | null;
  nfNumber: string | null;
  paymentMethods: unknown;
  siegId: string | null;
  rawXmlFileId: string | null;
  fetchedAt: string;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  // --- Rich XML-derived fields (backfilled) ---
  series?: string | null;
  model?: string | null;
  naturezaOperacao?: string | null;
  /** infNFe/infAdic/infCpl — complementary free-text info of taxpayer interest. */
  infCpl?: string | null;
  /** Purchase-order codes parsed from infCpl `#Ped:` (NFe/NFCe). */
  orderCodes?: { code: string }[];
  protocolNumber?: string | null;
  authorizationDate?: string | null;
  cStat?: string | null;
  xMotivo?: string | null;
  dateInferred?: boolean;
  emitIE?: string | null;
  emitAddress?: FiscalAddress | null;
  destIE?: string | null;
  destEmail?: string | null;
  destAddress?: FiscalAddress | null;
  totals?: FiscalTotals | null;
  // NFSe-specific
  issValue?: number | string | null;
  issRetained?: boolean | null;
  issRate?: number | string | null;
  baseCalculo?: number | string | null;
  valorLiquido?: number | string | null;
  valorServicos?: number | string | null;
  codigoTributacaoMunicipio?: string | null;
  municipioPrestacao?: string | null;
  itemListaServico?: string | null;
  items?: FiscalDocumentItem[];
  matches?: Array<{
    id: string;
    allocatedAmount?: number;
    matchType?: MatchType;
    confidenceScore?: number;
    notes?: string | null;
    transaction?: {
      id: string;
      postedAt: string;
      amount: number;
      type?: TransactionType;
      memo?: string | null;
      counterpartyName?: string | null;
      counterpartyCnpjCpf?: string | null;
      bankCode?: string;
      bankName?: string;
      accountNumber?: string;
    };
  }>;
}

export interface MatchCandidateItem {
  id: string;
  code: string | null;
  description: string;
  totalValue: number;
  quantity: number | null;
  unit: string | null;
  unitValue: number | null;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  } | null;
}

export interface SetFiscalItemCategoryPayload {
  categoryId: string | null;
  saveAlias?: boolean;
}

export interface MatchCandidate {
  fiscalDocumentId: string;
  accessKey: string;
  docType: FiscalDocType;
  operationType: OperationType;
  issueDate: string;
  totalValue: number;
  emitCnpj: string;
  emitName: string | null;
  destCnpj: string | null;
  destCpf: string | null;
  destName: string | null;
  nfNumber: string | null;
  orderCodes?: { code: string }[];
  confidence: number;
  matchType: MatchType;
  rationale: string;
  amountDelta: number;
  daysDelta: number;
  aliasAssisted: boolean;
  items: MatchCandidateItem[];
  // --- Order-group candidates (several NFs of one purchase order summed) ---
  /** True when this candidate is a synthetic group of NFs sharing one order
   *  code (`#Ped:` in infCpl), summed into a single matchable unit. */
  isOrderGroup?: boolean;
  /** The shared purchase-order code, when isOrderGroup. */
  orderCode?: string;
  /** The fiscal-document ids of every NF in the group (sent on accept). */
  memberFiscalDocumentIds?: string[];
  /** Per-member NF id + value, so the UI can send accurate per-NF allocations. */
  members?: {
    fiscalDocumentId: string;
    nfNumber: string | null;
    totalValue: number;
  }[];
  /** Number of NFs in the group. */
  memberCount?: number;
  /** True when no member NF belongs to more than one order; unclean groups are
   *  surfaced for manual review only (summing double-counts a shared NF). */
  cleanGroup?: boolean;
}

export interface OfxImportFileResult {
  fileName: string;
  statements: Array<{
    bankCode: string;
    bankName: string;
    agency: string;
    accountNumber: string;
    periodStart: string;
    periodEnd: string;
    parsed: number;
    inserted: number;
    duplicates: number;
  }>;
  error?: string;
}

export interface ImportSummary {
  filesProcessed: number;
  transactionsParsed: number;
  transactionsInserted: number;
  duplicatesSkipped: number;
  autoMatchedCount: number;
  totalCredits: number;
  totalDebits: number;
  files: OfxImportFileResult[];
  failedFiles: string[];
}

export interface XmlImportFailure {
  name: string;
  reason: string;
}

export interface XmlImportResult {
  created: number;
  /** Existing NFs whose status/fields changed on re-import (incl. an applied
   *  cancellation event). */
  updated: number;
  skipped: number;
  failed: number;
  failedFiles: XmlImportFailure[];
}

export interface CategoryDistributionEntry {
  categoryId: string;
  name: string;
  slug: string;
  kind: string;
  count: number;
  amount: number;
}

export interface ReconciliationStatistics {
  totalConciliadoMes: number;
  pendenteConciliacao: number;
  notasRecebidas: number;
  ultimaImportacao: string | null;
  matchedOverTime: Array<{
    period: string;
    matched: number;
    unmatched: number;
  }>;
  topUnmatchedByCounterparty: Array<{
    counterparty: string;
    amount: number;
    count: number;
  }>;
  matchTypeDistribution: Record<MatchType, number>;
  statusDistribution: Record<ReconciliationStatus, number>;
  categoryDistribution: CategoryDistributionEntry[];
}

export interface ReconciliationPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReconciliationPaginatedResponse<T> {
  data: T[];
  meta: ReconciliationPaginationMeta;
}

export interface TransactionFilters {
  page?: number;
  pageSize?: number;
  reconciliationStatus?: ReconciliationStatus | ReconciliationStatus[];
  categoryIds?: string[];
  categoryMatch?: "any" | "all";
  categorySource?: ReconciliationSource;
  expectsFiscalDocument?: boolean;
  reconciliationSource?: ReconciliationSource;
  matchType?: MatchType;
  type?: TransactionType;
  subtype?: BankTransactionSubtype;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  counterparty?: string;
  search?: string;
  sortBy?: "postedAt" | "amount";
  sortDir?: "asc" | "desc";
}

export interface ChangeCategoryPayload {
  categoryIds: string[];
  /** Per-category amount split (sent when >1 category is selected). */
  allocations?: { categoryId: string; allocatedAmount: number }[];
  saveAlias?: boolean;
  notes?: string;
}

export interface ClassifyBatchPayload {
  transactionIds?: string[];
  reconciliationStatus?: ReconciliationStatus;
  dateFrom?: string;
  dateTo?: string;
}

// Category CRUD payloads (base path /financial/reconciliation/categories).
export interface CreateTransactionCategoryPayload {
  name: string;
  kind: "TRANSACTION_ONLY" | "SERVICE";
  // Accounting (DRE) rollup. ITEM_DERIVED categories inherit it from the mirror;
  // SERVICE/TRANSACTION_ONLY categories set it explicitly.
  accountingType?: ACCOUNTING_TYPE | null;
  isResolving?: boolean;
  isRecurring?: boolean;
  color?: string | null;
  sortOrder?: number;
}

export interface UpdateTransactionCategoryPayload {
  name?: string;
  kind?: "TRANSACTION_ONLY" | "SERVICE";
  accountingType?: ACCOUNTING_TYPE | null;
  isResolving?: boolean;
  isRecurring?: boolean;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TransactionCategoryListParams {
  kind?: TransactionCategoryKind;
  isRecurring?: boolean;
  includeInactive?: boolean;
}

// POST /categorize — auto-tags transactions.
export interface CategorizePayload {
  transactionIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface CategorizeResult {
  processed: number;
  categorized: number;
}

// GET /recurring/forecast — monthly payables view.
export interface RecurringForecastItem {
  category: TransactionCategory;
  paidAmount: number;
  /** Expected amount, averaged from the past 3 months of the same category. */
  forecastAmount: number;
  transactionCount: number;
  status: "PAID" | "PENDING";
  /** ISO date: the actual last-paid date, or the predicted date when pending. */
  paymentDate: string | null;
  /** true when paymentDate is a prediction (category not yet paid this period). */
  isPaymentDateForecast: boolean;
}

export interface RecurringForecast {
  from: string;
  to: string;
  totalPaid: number;
  totalForecast: number;
  items: RecurringForecastItem[];
}

export interface ClassifyBatchResult {
  processed: number;
  reconciled: number;
  byCategory: Record<string, number>;
}

// GET /suggestions — medium-confidence category proposals awaiting one-click
// confirm. Rows are full BankTransactions plus the proposed category.
export interface ReconciliationSuggestion extends BankTransaction {
  suggestedCategoryId: string | null;
  suggestionConfidence: number | null;
  suggestedCategory: Pick<
    TransactionCategory,
    "id" | "name" | "slug" | "kind" | "color" | "isResolving"
  > | null;
}

// GET /outflow-forecast — composite "Previsão de Saídas" (spec §4.3).
export type OrderPaymentStatusKey =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "AWAITING_PAYMENT"
  | "PAID";

export interface OutflowForecastOrderRow {
  id: string;
  orderNumber: number | null;
  description: string;
  supplierName: string | null;
  paymentStatus: OrderPaymentStatusKey;
  forecast: string | null;
  total: number;
}

export interface OutflowForecastScheduleRow {
  id: string;
  name: string | null;
  supplierName: string | null;
  nextRun: string | null;
  itemCount: number;
}

export interface OutflowForecastTaxRow {
  category: { id: string; name: string; slug: string; color: string | null };
  monthlyAverage: number;
  perMonth: { month: string; amount: number }[];
  paidThisMonth: number;
  lastAmount: number | null;
  lastPaidAt: string | null;
}

export interface OutflowForecast {
  reference: string; // YYYY-MM
  from: string;
  to: string;
  /** pedidos.totalOpen + impostos.totalForecast + folha.total + folhaProgramada.total + recorrentes.totalForecast */
  total: number;
  pedidos: {
    totalOpen: number;
    byStatus: Record<
      "NOT_REQUESTED" | "REQUESTED" | "AWAITING_PAYMENT",
      { count: number; total: number }
    >;
    orders: OutflowForecastOrderRow[];
    schedules: OutflowForecastScheduleRow[];
  };
  impostos: {
    basis: string;
    lookbackMonths: string[];
    totalForecast: number;
    totalPaidThisMonth: number;
    items: OutflowForecastTaxRow[];
  };
  folha: {
    available: boolean;
    /** Gross payroll total — bonus already included ("com bonificação"). */
    total: number;
    bonusTotal: number;
    netTotal: number;
    employeeCount: number;
  };
  /**
   * Folha programada (13º + férias) — ADDITIVE and distinct from `folha`
   * (which only covers the reference month's base wages). Aggregate-only,
   * with a per-source breakdown for auditing.
   */
  folhaProgramada: {
    /** thirteenth.dueThisMonth + vacation.dueThisMonth */
    total: number;
    thirteenth: {
      available: boolean;
      year: number;
      /** Full-year split (always exposed for auditing). */
      firstInstallmentNovember: number;
      secondInstallmentDecember: number;
      /** The 13º slice that actually lands in the reference month total. */
      dueThisMonth: number;
      recordCount: number;
    };
    vacation: {
      available: boolean;
      dueThisMonth: number;
      recordCount: number;
    };
  };
  recorrentes: {
    totalPaid: number;
    totalForecast: number;
    /** Recurring categories folded into Impostos/Folha (excluded here). */
    excludedCount: number;
    items: RecurringForecastItem[];
  };
  learned: {
    expectedMonthlyTotal: number;
    itemCount: number;
    overdueCount: number;
  };
}

export interface FiscalDocumentFilters {
  page?: number;
  pageSize?: number;
  docType?: FiscalDocType;
  operationType?: OperationType;
  status?: FiscalDocumentStatus;
  dateFrom?: string;
  dateTo?: string;
  emitCnpj?: string;
  destCnpj?: string;
  search?: string;
  valueMin?: number;
  valueMax?: number;
  hasMatch?: boolean;
  sortBy?: "issueDate" | "totalValue";
  sortDir?: "asc" | "desc";
}

export interface SiegStatus {
  enabled: boolean;
  companyCnpj: boolean;
}
