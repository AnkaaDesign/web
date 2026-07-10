import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  IconRefresh,
  IconX,
  IconDownload,
  IconEye,
  IconLoader2,
  IconCalendarEvent,
  IconCurrencyReal,
  IconPaperclip,
  IconCopy,
  IconFile,
  IconTrash,
} from '@tabler/icons-react';
import {
  useRegenerateBoleto,
  useCancelBoleto,
  useChangeBankSlipDueDate,
  useMarkBoletoPaid,
  useUpdateInstallmentReceipts,
} from '@/hooks/production/use-invoice';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { invoiceService } from '@/api-client/invoice';
import { uploadSingleFile } from '@/api-client/file';
import { toast } from '@/components/ui/sonner';
import type { BankSlip, Installment } from '@/types/invoice';
import { MANUAL_PAYMENT_METHOD_OPTIONS } from '@/utils/installment-payment-method';
import { FileUploadField } from '@/components/common/file/file-upload-field';
import type { FileWithPreview } from '@/components/common/file/file-uploader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const RECEIPT_ACCEPTED_TYPES: Record<string, string[]> = {
  'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
  'application/pdf': ['.pdf'],
};
const RECEIPT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const RECEIPT_MAX_FILES = 20;

type AttachedReceipt = NonNullable<Installment['receiptFiles']>[number];

interface BoletoActionsProps {
  installmentId: string;
  bankSlip: BankSlip | null | undefined;
  /** Current installment due date — used as default for date change dialog */
  dueDate?: string | Date | null;
  /** Installment status for showing receipt actions on paid installments */
  installmentStatus?: string | null;
  /** Payment method used (PIX, CASH, TRANSFER, BANK_SLIP, etc.) */
  installmentPaymentMethod?: string | null;
  /** Receipt files attached to this installment */
  receiptFiles?: Installment['receiptFiles'];
  /** Free-text observations on the installment */
  observations?: string | null;
  /** When false, all mutating actions (generate/regenerate/cancel/change due
   *  date/mark paid/manage receipts) are hidden, leaving only read-only
   *  view/download/copy — for read-only viewers (e.g. ACCOUNTING). Default true. */
  canManage?: boolean;
}

function getDefaultRegenerateDate(dueDate?: string | Date | null, bankSlipDueDate?: string | Date | null): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If the original due date is in the future, keep it
  const original = dueDate || bankSlipDueDate;
  if (original) {
    const d = typeof original === 'string' ? new Date(original) : original;
    if (d >= today) return d;
  }

  // Otherwise default to tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

export function BoletoActions({
  installmentId,
  bankSlip,
  dueDate,
  installmentStatus,
  installmentPaymentMethod: _installmentPaymentMethod,
  receiptFiles,
  observations: observationsProp,
  canManage = true,
}: BoletoActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDueDateDialog, setShowDueDateDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [showReceiptsDialog, setShowReceiptsDialog] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [regenerateDate, setRegenerateDate] = useState<Date | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Mark Paid dialog state
  const [markPaidFiles, setMarkPaidFiles] = useState<FileWithPreview[]>([]);
  const [markPaidObservations, setMarkPaidObservations] = useState<string>('');

  // Manage Receipts dialog state — initialized from props when the dialog opens.
  // Existing files are tracked outside the FileUploadField so they keep view/download
  // affordances; the FileUploadField is used only to pick new uploads.
  const [keptReceipts, setKeptReceipts] = useState<AttachedReceipt[]>([]);
  const [newReceiptFiles, setNewReceiptFiles] = useState<FileWithPreview[]>([]);
  const [receiptObservations, setReceiptObservations] = useState<string>('');

  const regenerateBoleto = useRegenerateBoleto();
  const cancelBoleto = useCancelBoleto();
  const changeDueDate = useChangeBankSlipDueDate();
  const markPaid = useMarkBoletoPaid();
  const updateReceipts = useUpdateInstallmentReceipts();

  // Sync the Manage Receipts dialog state with the latest props every time it opens.
  useEffect(() => {
    if (showReceiptsDialog) {
      setKeptReceipts(receiptFiles ?? []);
      setNewReceiptFiles([]);
      setReceiptObservations(observationsProp ?? '');
    }
  }, [showReceiptsDialog, receiptFiles, observationsProp]);

  const openRegenerateDialog = () => {
    setRegenerateDate(getDefaultRegenerateDate(dueDate, bankSlip?.dueDate));
    setShowRegenerateDialog(true);
  };

  const handleRegenerate = () => {
    if (!regenerateDate) {
      toast.error('Selecione a data de vencimento.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (regenerateDate < today) {
      toast.error('A data de vencimento deve ser igual ou posterior a hoje.');
      return;
    }
    regenerateBoleto.mutate(
      {
        installmentId,
        newDueDate: regenerateDate.toLocaleDateString('en-CA'),
      },
      {
        onSuccess: () => {
          setShowRegenerateDialog(false);
          setRegenerateDate(null);
        },
      },
    );
  };

  const handleCancel = () => {
    cancelBoleto.mutate(
      { installmentId },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
        },
      },
    );
  };

  const openDueDateDialog = () => {
    if (dueDate) {
      const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
      setNewDueDate(d);
    } else if (bankSlip?.dueDate) {
      setNewDueDate(new Date(bankSlip.dueDate));
    } else {
      setNewDueDate(null);
    }
    setShowDueDateDialog(true);
  };

  const handleChangeDueDate = () => {
    if (!newDueDate) {
      toast.error('Selecione a nova data de vencimento.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (newDueDate < today) {
      toast.error('A nova data de vencimento deve ser igual ou posterior a hoje.');
      return;
    }
    changeDueDate.mutate(
      {
        installmentId,
        newDueDate: newDueDate.toLocaleDateString('en-CA'),
      },
      {
        onSuccess: () => {
          setShowDueDateDialog(false);
          setNewDueDate(null);
        },
      },
    );
  };

  const fetchBoletoPdf = async () => {
    const response = await invoiceService.getBoletoPdf(installmentId);
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handleViewPdf = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchBoletoPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchBoletoPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleto-${installmentId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchReceiptBlob = async (file: AttachedReceipt) => {
    const response = await invoiceService.getInstallmentReceipt(installmentId, file.id);
    return new Blob([response.data], { type: file.mimetype || 'application/pdf' });
  };

  const handleViewReceipt = async (file: AttachedReceipt) => {
    setIsViewing(true);
    try {
      const blob = await fetchReceiptBlob(file);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownloadReceipt = async (file: AttachedReceipt) => {
    setIsDownloading(true);
    try {
      const blob = await fetchReceiptBlob(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName || `comprovante-${file.id.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const uploadFiles = async (files: Array<File | FileWithPreview>): Promise<string[]> => {
    const uploadedIds: string[] = [];
    for (const file of files) {
      const result = await uploadSingleFile(file as File, {
        fileContext: 'receipt',
        entityId: installmentId,
        entityType: 'installment',
      });
      if (result.success && result.data) {
        uploadedIds.push(result.data.id);
      } else {
        throw new Error(`Falha ao enviar ${file.name}`);
      }
    }
    return uploadedIds;
  };

  const handleMarkPaid = async () => {
    if (!paymentMethod) {
      toast.error('Selecione o método de pagamento.');
      return;
    }

    setIsUploading(true);
    try {
      const filesToUpload = markPaidFiles.filter((f) => !f.uploaded && !f.error);
      const uploadedIds = filesToUpload.length > 0 ? await uploadFiles(filesToUpload) : [];

      markPaid.mutate(
        {
          installmentId,
          paymentMethod,
          receiptFileIds: uploadedIds.length > 0 ? uploadedIds : undefined,
          observations: markPaidObservations.trim() ? markPaidObservations.trim() : undefined,
        },
        {
          onSuccess: () => {
            setShowMarkPaidDialog(false);
            setPaymentMethod('');
            setMarkPaidFiles([]);
            setMarkPaidObservations('');
          },
        },
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveReceipts = async () => {
    setIsUploading(true);
    try {
      const filesToUpload = newReceiptFiles.filter((f) => !f.uploaded && !f.error);
      const newUploadedIds = filesToUpload.length > 0 ? await uploadFiles(filesToUpload) : [];
      const finalReceiptIds = [...keptReceipts.map((r) => r.id), ...newUploadedIds];
      const trimmedObservations = receiptObservations.trim();

      updateReceipts.mutate(
        {
          installmentId,
          receiptFileIds: finalReceiptIds,
          observations:
            trimmedObservations === (observationsProp ?? '')
              ? undefined
              : trimmedObservations || null,
        },
        {
          onSuccess: () => {
            setShowReceiptsDialog(false);
            setNewReceiptFiles([]);
          },
        },
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyDigitableLine = async () => {
    const line = bankSlip?.digitableLine;
    if (!line) {
      toast.error('Linha digitável indisponível.');
      return;
    }
    try {
      await navigator.clipboard.writeText(line);
      toast.success('Linha digitável copiada.');
    } catch {
      toast.error('Não foi possível copiar a linha digitável.');
    }
  };

  // Determine what actions to show
  const isPaid = installmentStatus === 'PAID';
  const isPaidByBankSlip = isPaid && bankSlip?.status === 'PAID';
  const receiptCount = receiptFiles?.length ?? 0;
  const hasReceipts = receiptCount > 0;

  // Mutating actions are gated by `canManage`; read-only ones (view/download
  // PDF, copy digitable line) stay available to read-only viewers.
  const canGenerate = canManage && !bankSlip && !isPaid && installmentStatus !== 'CANCELLED';
  const canRegenerate = canManage && bankSlip && ['ERROR', 'REJECTED', 'CANCELLED'].includes(bankSlip.status);
  const canCancel = canManage && bankSlip && (bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE');
  const canDownloadPdf = bankSlip && (bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE');
  const canCopyDigitableLine =
    !!bankSlip?.digitableLine && (bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE');
  const canChangeDueDate = canManage && bankSlip && (bankSlip.status === 'OVERDUE' || bankSlip.status === 'ACTIVE');
  // Allow mark-as-paid whenever the installment is not already paid: PENDING, ACTIVE,
  // OVERDUE — or CANCELLED. PENDING is the generateBankSlip=false flow (PIX/transfer, no
  // bank slip). CANCELLED is included so a cancelled installment can be revived straight
  // to PAID (boleto cancelled but customer paid by PIX/cash); receipts are then attached
  // via this same dialog or the manage-receipts button that appears once it is paid.
  const canMarkPaid =
    canManage &&
    (installmentStatus === 'ACTIVE' ||
      installmentStatus === 'OVERDUE' ||
      installmentStatus === 'PENDING' ||
      installmentStatus === 'CANCELLED');

  // Receipt management: any paid installment can open the manage-receipts dialog.
  const canManageReceipts = canManage && isPaid;
  // Sicredi removes the PDF after payment; only show boleto PDF if we have a locally stored copy
  // and the user hasn't already attached their own receipts.
  const showBoletoPdfForPaid = isPaidByBankSlip && !hasReceipts && !!bankSlip?.pdfFileId;

  const hasAnyAction =
    canGenerate ||
    canRegenerate ||
    canCancel ||
    canDownloadPdf ||
    canCopyDigitableLine ||
    canChangeDueDate ||
    canMarkPaid ||
    showBoletoPdfForPaid ||
    canManageReceipts;

  if (!hasAnyAction) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {/* For PAID installments: receipt management + boleto PDF fallback */}
        {isPaid && (
          <>
            {canManageReceipts && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReceiptsDialog(true)}
                title={
                  hasReceipts
                    ? `Comprovantes (${receiptCount})${observationsProp ? ' / Observações' : ''}`
                    : 'Anexar Comprovantes'
                }
                className={`h-7 ${hasReceipts ? 'px-1.5' : 'w-7 p-0'} ${
                  hasReceipts ? 'text-foreground' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <IconPaperclip className="h-4 w-4" />
                {hasReceipts && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {receiptCount}
                  </Badge>
                )}
              </Button>
            )}

            {showBoletoPdfForPaid && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewPdf}
                  disabled={isViewing}
                  title="Visualizar Boleto"
                  className="h-7 w-7 p-0"
                >
                  {isViewing ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  title="Baixar Boleto"
                  className="h-7 w-7 p-0"
                >
                  {isDownloading ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconDownload className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </>
        )}

        {/* For ACTIVE/OVERDUE: show boleto actions */}
        {canDownloadPdf && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewPdf}
              disabled={isViewing}
              title="Visualizar Boleto"
              className="h-7 w-7 p-0"
            >
              {isViewing ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconEye className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              title="Baixar Boleto"
              className="h-7 w-7 p-0"
            >
              {isDownloading ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconDownload className="h-4 w-4" />
              )}
            </Button>
          </>
        )}

        {canCopyDigitableLine && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyDigitableLine}
            title="Copiar linha digitável"
            className="h-7 w-7 p-0"
          >
            <IconCopy className="h-4 w-4" />
          </Button>
        )}

        {canChangeDueDate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openDueDateDialog}
            title="Alterar Vencimento"
            className="h-7 w-7 p-0"
          >
            <IconCalendarEvent className="h-4 w-4" />
          </Button>
        )}

        {canGenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openRegenerateDialog}
            disabled={regenerateBoleto.isPending}
            title="Gerar Boleto"
            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700"
          >
            {regenerateBoleto.isPending ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
          </Button>
        )}

        {canRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openRegenerateDialog}
            disabled={regenerateBoleto.isPending}
            title="Regenerar Boleto"
            className="h-7 w-7 p-0"
          >
            {regenerateBoleto.isPending ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
          </Button>
        )}

        {canMarkPaid && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMarkPaidDialog(true)}
            title="Marcar como Pago (PIX/Dinheiro)"
            className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
          >
            <IconCurrencyReal className="h-4 w-4" />
          </Button>
        )}

        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
            title="Cancelar Boleto"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <IconX className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Boleto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este boleto? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelBoleto.isPending}>
              {cancelBoleto.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog — payment method + optional multi-receipt + observations */}
      <Dialog
        open={showMarkPaidDialog}
        onOpenChange={(open) => {
          setShowMarkPaidDialog(open);
          if (!open) {
            setPaymentMethod('');
            setMarkPaidFiles([]);
            setMarkPaidObservations('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
            <DialogDescription>
              O boleto será cancelado no banco e a parcela será marcada como paga.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Método de Pagamento</Label>
              <Combobox
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod((v as string) || '')}
                options={MANUAL_PAYMENT_METHOD_OPTIONS as { value: string; label: string }[]}
                placeholder="Selecione o método..."
                searchable={false}
                clearable={false}
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Comprovantes (opcional)</Label>
              <FileUploadField
                onFilesChange={setMarkPaidFiles}
                existingFiles={markPaidFiles}
                maxFiles={RECEIPT_MAX_FILES}
                maxSize={RECEIPT_MAX_SIZE}
                acceptedFileTypes={RECEIPT_ACCEPTED_TYPES}
                variant="compact"
                placeholder="Arraste ou clique para enviar os comprovantes (PDF ou imagens)"
                showPreview
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Observações (opcional)</Label>
              <Textarea
                value={markPaidObservations}
                onChange={(e) => setMarkPaidObservations(e.target.value)}
                placeholder="Detalhes adicionais sobre o pagamento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkPaidDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={markPaid.isPending || isUploading || !paymentMethod}
            >
              {markPaid.isPending || isUploading ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Receipts Dialog — view, add, remove receipts + edit observations */}
      <Dialog open={showReceiptsDialog} onOpenChange={setShowReceiptsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovantes e Observações</DialogTitle>
            <DialogDescription>
              Anexe, visualize ou remova comprovantes e edite as observações desta parcela.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {keptReceipts.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Comprovantes anexados
                </Label>
                <ul className="space-y-1">
                  {keptReceipts.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-sm"
                    >
                      <IconFile className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{file.originalName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleViewReceipt(file)}
                        disabled={isViewing}
                        title="Visualizar"
                      >
                        {isViewing ? (
                          <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <IconEye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleDownloadReceipt(file)}
                        disabled={isDownloading}
                        title="Baixar"
                      >
                        {isDownloading ? (
                          <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <IconDownload className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setKeptReceipts((prev) => prev.filter((r) => r.id !== file.id))
                        }
                        title="Remover"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                {keptReceipts.length > 0 ? 'Adicionar novos comprovantes' : 'Comprovantes'}
              </Label>
              <FileUploadField
                onFilesChange={setNewReceiptFiles}
                existingFiles={newReceiptFiles}
                maxFiles={RECEIPT_MAX_FILES}
                maxSize={RECEIPT_MAX_SIZE}
                acceptedFileTypes={RECEIPT_ACCEPTED_TYPES}
                variant="compact"
                placeholder="Arraste ou clique para enviar comprovantes (PDF ou imagens)"
                showPreview
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Observações</Label>
              <Textarea
                value={receiptObservations}
                onChange={(e) => setReceiptObservations(e.target.value)}
                placeholder="Detalhes adicionais sobre o pagamento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptsDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveReceipts}
              disabled={isUploading || updateReceipts.isPending}
            >
              {isUploading || updateReceipts.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Due Date Dialog */}
      <Dialog open={showDueDateDialog} onOpenChange={setShowDueDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Vencimento do Boleto</DialogTitle>
            <DialogDescription>
              Selecione a nova data de vencimento para este boleto. A data deve ser igual ou posterior a hoje.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DateTimeInput
              label="Nova Data de Vencimento"
              mode="date"
              value={newDueDate}
              onChange={(date) => setNewDueDate(date as Date | null)}
              constraints={{ minDate: new Date() }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDueDateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangeDueDate}
              disabled={changeDueDate.isPending || !newDueDate}
            >
              {changeDueDate.isPending ? 'Alterando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate / Regenerate Boleto Dialog (with date picker) */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canGenerate ? 'Gerar Boleto' : 'Regenerar Boleto'}</DialogTitle>
            <DialogDescription>
              O boleto será {canGenerate ? 'gerado' : 'recriado'} com a data de vencimento selecionada. Selecione uma data válida (igual ou posterior a hoje).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DateTimeInput
              label="Data de Vencimento"
              mode="date"
              value={regenerateDate}
              onChange={(date) => setRegenerateDate(date as Date | null)}
              constraints={{ minDate: new Date() }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={regenerateBoleto.isPending || !regenerateDate}
            >
              {regenerateBoleto.isPending
                ? (canGenerate ? 'Gerando...' : 'Regenerando...')
                : (canGenerate ? 'Gerar Boleto' : 'Regenerar Boleto')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
