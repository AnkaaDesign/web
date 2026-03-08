export type INVOICE_STATUS = 'DRAFT' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type INSTALLMENT_STATUS = 'PENDING' | 'PROCESSING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BANK_SLIP_STATUS = 'CREATING' | 'ACTIVE' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'REJECTED' | 'ERROR';
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
  nfseDocument?: NfseDocument | null;
  customer?: { id: string; fantasyName: string; cnpj?: string | null };
  task?: { id: string; name?: string | null; serialNumber?: string | null };
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
  bankSlip?: BankSlip | null;
}

export interface BankSlip {
  id: string;
  installmentId: string;
  nossoNumero: string;
  barcode: string | null;
  digitableLine: string | null;
  pixQrCode: string | null;
  type: 'NORMAL' | 'HIBRIDO';
  amount: number;
  dueDate: Date;
  status: BANK_SLIP_STATUS;
  pdfFileId: string | null;
  pdfFile?: { id: string; filename: string; originalName: string; mimetype: string; path: string; size: number } | null;
  paidAmount: number | null;
  paidAt: Date | null;
  errorMessage: string | null;
  errorCount: number;
}

export interface NfseDocument {
  id: string;
  invoiceId: string;
  nfseNumber: string | null;
  chaveAcesso: string | null;
  verificationCode: string | null;
  nDps: number | null;
  status: NFSE_STATUS;
  issuedAt: Date | null;
  totalAmount: number;
  issRate: number | null;
  issAmount: number | null;
  pdfFileId: string | null;
  pdfFile?: { id: string; filename: string; originalName: string; mimetype: string; path: string; size: number } | null;
  errorMessage: string | null;
}
