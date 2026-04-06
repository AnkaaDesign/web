export type INVOICE_STATUS = 'DRAFT' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type INSTALLMENT_STATUS = 'PENDING' | 'PROCESSING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BANK_SLIP_STATUS = 'CREATING' | 'ACTIVE' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'REJECTED' | 'ERROR';
export type BANK_SLIP_TYPE = 'NORMAL' | 'HIBRIDO';
export type NFSE_STATUS = 'PENDING' | 'PROCESSING' | 'AUTHORIZED' | 'CANCELLED' | 'ERROR';

export interface Invoice {
  id: string;
  customerConfigId: string;
  taskId: string;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  status: INVOICE_STATUS;
  notes: string | null;
  createdById: string | null;
  installments?: Installment[];
  nfseDocuments?: NfseDocument[];
  customer?: { id: string; fantasyName: string; cnpj?: string | null };
  task?: { id: string; name?: string | null; serialNumber?: string | null };
  createdBy?: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Installment {
  id: string;
  customerConfigId: string;
  invoiceId: string | null;
  number: number;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  paidAt: Date | null;
  status: INSTALLMENT_STATUS;
  paymentMethod?: string | null;
  receiptFileId?: string | null;
  receiptFile?: { id: string; filename: string; originalName: string; mimetype: string; path: string; size: number } | null;
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
  invoiceId: string;
  elotechNfseId: number | null;
  status: NFSE_STATUS;
  errorMessage: string | null;
  errorCount?: number;
  retryAfter?: Date | null;
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
  localStatus?: string | null;
  idMotivoSituacao?: number;
  descricaoMotivoSituacao?: string;
}
