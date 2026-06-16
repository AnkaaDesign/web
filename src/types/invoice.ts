export type INVOICE_STATUS = 'DRAFT' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type INSTALLMENT_STATUS = 'PENDING' | 'PROCESSING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BANK_SLIP_STATUS = 'CREATING' | 'REGISTERING' | 'ACTIVE' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'REJECTED' | 'ERROR';
export type BANK_SLIP_TYPE = 'NORMAL' | 'HIBRIDO';
export type NFSE_STATUS = 'PENDING' | 'PROCESSING' | 'AUTHORIZED' | 'CANCEL_REQUESTED' | 'CANCEL_REJECTED' | 'CANCELLED' | 'ERROR';

// Full NFS-e cancellation lifecycle status (mirrors backend NfseStatus enum).
// AUTHORIZED → CANCEL_REQUESTED (aguardando fiscal) → CANCEL_REJECTED | CANCELLED.
export type NfseStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'CANCEL_REQUESTED'
  | 'CANCEL_REJECTED'
  | 'CANCELLED'
  | 'ERROR';

export interface Invoice {
  id: string;
  customerConfigId: string | null;
  taskId: string | null;
  externalOperationId?: string | null;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  status: INVOICE_STATUS;
  notes: string | null;
  createdById: string | null;
  installments?: Installment[];
  nfseDocuments?: NfseDocument[];
  customer?: { id: string; fantasyName: string; cnpj?: string | null; state?: string | null };
  task?: { id: string; name?: string | null; serialNumber?: string | null };
  createdBy?: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Installment {
  id: string;
  customerConfigId: string | null;
  externalOperationId?: string | null;
  invoiceId: string | null;
  number: number;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  paidAt: Date | null;
  status: INSTALLMENT_STATUS;
  paymentMethod?: string | null;
  observations?: string | null;
  receiptFiles?: Array<{ id: string; filename: string; originalName: string; mimetype: string; path: string; size: number }>;
  bankSlip?: BankSlip | null;
}

export interface BankSlip {
  id: string;
  installmentId: string;
  nossoNumero: string;
  seuNumero: string | null;
  barcode: string | null;
  digitableLine: string | null;
  pixQrCode: string | null;
  txid: string | null;
  type: BANK_SLIP_TYPE;
  amount: number;
  dueDate: Date;
  status: BANK_SLIP_STATUS;
  sicrediStatus: string | null;
  pdfFileId: string | null;
  pdfFile?: { id: string; filename: string; originalName: string; mimetype: string; path: string; size: number } | null;
  paidAmount: number | null;
  paidAt: Date | null;
  liquidationData: Record<string, unknown> | null;
  errorMessage: string | null;
  errorCount: number;
  lastSyncAt: Date | null;
}

export interface NfseDocument {
  id: string;
  // invoiceId is nullable: a note survives as task history even if its invoice is removed.
  invoiceId: string | null;
  // Durable link to the task so the full NFS-e history is always visible on the quote page.
  taskId: string | null;
  elotechNfseId: number | null;
  nfseNumber: number | null;
  status: NFSE_STATUS;
  errorMessage: string | null;
  errorCount?: number;
  retryAfter?: Date | null;
  // Cancellation request lifecycle (Elotech "solicitação de cancelamento").
  cancelRequestId?: number | null;
  cancelRequestStatus?: string | null;
  cancelReason?: string | null;
  cancelReasonCode?: number | null;
  cancelRejectionMessage?: string | null;
  cancelSubstituteNfseNumber?: number | null;
  cancelRequestedAt?: Date | null;
  cancelResolvedAt?: Date | null;
}

export interface ElotechNfseListItem {
  id: number;
  numeroNotaFiscal: number;
  tipoDocumento: string;
  dataEmissao: string;
  situacao: number;
  descricaoSituacao: string;
  cancelada: boolean;
  emitida: boolean;
  tomadorCnpjCpf: string;
  tomadorRazaoNome: string;
  valorDoc: number;
  valorServico: number;
  valorISS: number;
  issRetido: string;
  // Enriched from local DB
  invoiceId?: string | null;
  taskId?: string | null;
  taskName?: string | null;
  taskSerialNumber?: string | null;
  customerName?: string | null;
  nfseDocumentId?: string | null;
  localStatus?: NfseStatus | string | null;
  idMotivoSituacao?: number;
  descricaoMotivoSituacao?: string;
  // Local cancellation lifecycle — surfaced when Elotech still shows the note active
  cancelRequestStatus?: 'AGUARDANDO_FISCAL' | 'AUTORIZADO' | 'REJEITADO' | string | null;
  cancelRejectionMessage?: string | null;
  cancelSubstituteNfseNumber?: number | null;
}

// Response of PUT /invoices/:invoiceId/nfse/cancel
export interface CancelNfseResult {
  message: string;
  cancelled: boolean;
  pending: boolean;
  rejected: boolean;
  status: NfseStatus;
  elotechNfseId: number;
  requestStatus: 'AGUARDANDO_FISCAL' | 'AUTORIZADO' | 'REJEITADO' | null;
  rejectionMessage: string | null;
}

// Single entry in the cancellation-request timeline (GET /nfse/:id/cancellation)
export interface NfseCancellationHistorico {
  data: string | null;
  status: string | null;
  descricaoStatus: string | null;
  motivo: string | null;
}

// Response of GET /nfse/:elotechNfseId/cancellation
export interface NfseCancellationStatus {
  elotechNfseId: number;
  nfseNumber: number | null;
  notaSituacao: string;
  cancelada: boolean;
  request: {
    id: number | null;
    ultimoStatus: string | null;
    motivo: string | null;
    data: string | null;
    codigoMotivoSituacao: number | null;
    historicos: NfseCancellationHistorico[];
  } | null;
  nfseDocumentId: string | null;
}

// Single note in the task NFS-e history (GET /invoices/task/:taskId/nfse-history)
export interface TaskNfseHistoryItem {
  id: string;
  invoiceId: string | null;
  elotechNfseId: number | null;
  nfseNumber: number | null;
  status: NfseStatus;
  errorMessage: string | null;
  cancelRequestStatus: string | null;
  cancelReason: string | null;
  cancelReasonCode: number | null;
  cancelRejectionMessage: string | null;
  cancelSubstituteNfseNumber: number | null;
  cancelRequestedAt: string | null;
  cancelResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOrphan: boolean;
  // Enriched from Elotech (the live fiscal record at the prefeitura)
  dataEmissao: string | null;
  valorDoc: number | null;
  valorISS: number | null;
  tomadorRazaoNome: string | null;
  cancelada: boolean;
}

// Response of GET /invoices/task/:taskId/nfse-history
export interface TaskNfseHistory {
  taskId: string;
  total: number;
  nfses: TaskNfseHistoryItem[];
}
