// Lifecycle (independent from how it got there and what category it is).
export type ReconciliationStatus =
  | "PENDING"
  | "RECONCILED"
  | "PARTIAL"
  | "IGNORED"
  | "DISPUTED";

export type ReconciliationSource = "AUTO" | "MANUAL";

// What kind of payment. Drives whether NF matching applies. Non-NF categories
// are self-justifying — reconciled by virtue of being classified.
export type ReconciliationCategory =
  | "NF"
  | "TRIBUTO"
  | "FOLHA"
  | "TRANSFERENCIA"
  | "TARIFA_BANCARIA"
  | "CONVENIO"
  | "PRO_LABORE"
  | "ALUGUEL"
  | "ESTORNO"
  | "OUTROS"
  | "UNCLASSIFIED";

export type MatchType = "EXACT" | "VALUE_DATE" | "FUZZY" | "MANUAL" | "BANK_SLIP_BRIDGE";

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
export type FiscalDocumentStatus = "AUTHORIZED" | "CANCELLED" | "DENIED" | "PENDING";
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
  category: ReconciliationCategory;
  categorySource: ReconciliationSource | null;
  classifiedAt: string | null;
  ignoredReason: string | null;
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
  bankSlip?: { id: string; nossoNumero: string; paidAmount: number | null } | null;
}

export interface FiscalDocumentItem {
  id: string;
  code: string | null;
  description: string;
  quantity: number | string | null;
  unit: string | null;
  unitValue: number | string | null;
  totalValue: number | string;
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

export interface MatchCandidate {
  fiscalDocumentId: string;
  accessKey: string;
  docType: FiscalDocType;
  issueDate: string;
  totalValue: number;
  emitCnpj: string;
  emitName: string | null;
  destCnpj: string | null;
  destName: string | null;
  confidence: number;
  matchType: MatchType;
  rationale: string;
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

export interface XmlImportResult {
  created: number;
  skipped: number;
  failed: number;
  failedFiles: string[];
}

export interface ReconciliationStatistics {
  totalConciliadoMes: number;
  pendenteConciliacao: number;
  notasRecebidas: number;
  ultimaImportacao: string | null;
  matchedOverTime: Array<{ period: string; matched: number; unmatched: number }>;
  topUnmatchedByCounterparty: Array<{ counterparty: string; amount: number; count: number }>;
  matchTypeDistribution: Record<MatchType, number>;
  statusDistribution: Record<ReconciliationStatus, number>;
  categoryDistribution: Record<ReconciliationCategory, number>;
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
  category?: ReconciliationCategory | ReconciliationCategory[];
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
  category: ReconciliationCategory;
  saveAlias?: boolean;
  notes?: string;
}

export interface ClassifyBatchPayload {
  transactionIds?: string[];
  reconciliationStatus?: ReconciliationStatus;
  category?: ReconciliationCategory;
  dateFrom?: string;
  dateTo?: string;
}

export interface ClassifyBatchResult {
  processed: number;
  reconciled: number;
  byCategory: Record<string, number>;
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
