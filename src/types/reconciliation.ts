export type MatchStatus =
  | "UNMATCHED"
  | "AUTO_MATCHED"
  | "MANUAL_MATCHED"
  | "PARTIAL"
  | "IGNORED"
  | "DISPUTED";

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
export type BankStatementImportStatus =
  | "PENDING"
  | "PARSING"
  | "MATCHING"
  | "COMPLETED"
  | "FAILED";
export type BankStatementSource = "OFX_SICREDI" | "MANUAL";
export type FiscalDocumentSource = "SIEG_API" | "MANUAL_UPLOAD";

export interface BankStatement {
  id: string;
  source: BankStatementSource;
  bankCode: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  ownerCnpj: string;
  rawFileId: string | null;
  periodStart: string;
  periodEnd: string;
  openingBalance: number | null;
  closingBalance: number | null;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
  matchedCount: number;
  debitTransactionCount: number;
  status: BankStatementImportStatus;
  errorMessage: string | null;
  uploadedById: string | null;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string | null } | null;
}

export interface BankTransaction {
  id: string;
  statementId: string;
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
  matchStatus: MatchStatus;
  ignoredReason: string | null;
  bankSlipId: string | null;
  createdAt: string;
  updatedAt: string;
  matches?: ReconciliationMatch[];
  statement?: Pick<BankStatement, "id" | "periodStart" | "periodEnd">;
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
      statementId?: string;
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

export interface ImportSummary {
  statementId: string;
  transactionCount: number;
  matchedCount: number;
  autoMatchedCount: number;
  unmatchedCount: number;
  totalCredits: number;
  totalDebits: number;
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
  matchStatusDistribution: Record<MatchStatus, number>;
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
  statementId?: string;
  matchStatus?: MatchStatus;
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

export interface StatementFilters {
  page?: number;
  pageSize?: number;
  status?: BankStatementImportStatus;
  source?: BankStatementSource;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "importedAt" | "periodStart";
  sortDir?: "asc" | "desc";
}

export interface SiegStatus {
  enabled: boolean;
  companyCnpj: boolean;
}
