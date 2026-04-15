import { useState, useRef } from 'react';
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
  IconUpload,
} from '@tabler/icons-react';
import { useRegenerateBoleto, useCancelBoleto, useChangeBankSlipDueDate, useMarkBoletoPaid, useUpdateInstallmentReceipt } from '@/hooks/production/use-invoice';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { invoiceService } from '@/api-client/invoice';
import { uploadSingleFile } from '@/api-client/file';
import { toast } from '@/components/ui/sonner';
import type { BankSlip, Installment } from '@/types/invoice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'OTHER', label: 'Outro' },
];

interface BoletoActionsProps {
  installmentId: string;
  bankSlip: BankSlip | null | undefined;
  /** Current installment due date — used as default for date change dialog */
  dueDate?: string | Date | null;
  /** Installment status for showing receipt actions on paid installments */
  installmentStatus?: string | null;
  /** Payment method used (PIX, CASH, TRANSFER, BANK_SLIP, etc.) */
  installmentPaymentMethod?: string | null;
  /** Receipt file attached to this installment */
  receiptFile?: Installment['receiptFile'];
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

export function BoletoActions({ installmentId, bankSlip, dueDate, installmentStatus, installmentPaymentMethod: _installmentPaymentMethod, receiptFile }: BoletoActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDueDateDialog, setShowDueDateDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [regenerateDate, setRegenerateDate] = useState<Date | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileForUpload, setReceiptFileForUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const regenerateBoleto = useRegenerateBoleto();
  const cancelBoleto = useCancelBoleto();
  const changeDueDate = useChangeBankSlipDueDate();
  const markPaid = useMarkBoletoPaid();
  const updateReceipt = useUpdateInstallmentReceipt();

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
          toast.success('Boleto será recriado em instantes.');
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
      }
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

  const [isViewing, setIsViewing] = useState(false);

  const fetchBoletoPdf = async () => {
    const response = await invoiceService.getBoletoPdf(installmentId);
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const fetchReceipt = async () => {
    const response = await invoiceService.getInstallmentReceipt(installmentId);
    return new Blob([response.data], { type: receiptFile?.mimetype || 'application/pdf' });
  };

  const handleViewPdf = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchBoletoPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error('Erro ao visualizar boleto.');
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
    } catch {
      toast.error('Erro ao baixar boleto.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewReceipt = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchReceipt();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error('Erro ao visualizar comprovante.');
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchReceipt();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = receiptFile?.originalName || `comprovante-${installmentId.slice(0, 8)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao baixar comprovante.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentMethod) {
      toast.error('Selecione o método de pagamento.');
      return;
    }

    setIsUploading(true);
    try {
      let receiptFileId: string | undefined;

      // Upload receipt file if provided
      if (receiptFileForUpload) {
        const uploadResult = await uploadSingleFile(receiptFileForUpload, {
          fileContext: 'receipt',
          entityId: installmentId,
          entityType: 'installment',
        });
        if (uploadResult.success && uploadResult.data) {
          receiptFileId = uploadResult.data.id;
        }
      }

      markPaid.mutate(
        { installmentId, paymentMethod, receiptFileId },
        {
          onSuccess: () => {
            setShowMarkPaidDialog(false);
            setPaymentMethod('');
            setReceiptFileForUpload(null);
            setReceiptFileName('');
          },
        },
      );
    } catch {
      toast.error('Erro ao enviar comprovante.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileForUpload(file);
      setReceiptFileName(file.name);
    }
  };

  const handleAttachReceipt = async () => {
    const input = receiptFileInputRef.current;
    if (!input?.files?.[0]) {
      toast.error('Selecione um arquivo.');
      return;
    }

    setIsUploading(true);
    try {
      const uploadResult = await uploadSingleFile(input.files[0], {
        fileContext: 'receipt',
        entityId: installmentId,
        entityType: 'installment',
      });
      if (uploadResult.success && uploadResult.data) {
        updateReceipt.mutate(
          { installmentId, receiptFileId: uploadResult.data.id },
          {
            onSuccess: () => {
              setShowReceiptDialog(false);
              toast.success('Comprovante anexado com sucesso.');
            },
          },
        );
      }
    } catch {
      toast.error('Erro ao enviar comprovante.');
    } finally {
      setIsUploading(false);
    }
  };

  // Determine what actions to show
  const isPaid = installmentStatus === 'PAID';
  const isPaidByBankSlip = isPaid && bankSlip?.status === 'PAID';
  const hasReceipt = !!receiptFile;

  const canRegenerate = bankSlip && ['ERROR', 'REJECTED', 'CANCELLED'].includes(bankSlip.status);
  const canCancel = bankSlip && (bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE');
  const canDownloadPdf = bankSlip && (bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE');
  const canChangeDueDate = bankSlip && (bankSlip.status === 'OVERDUE' || bankSlip.status === 'ACTIVE');
  // Allow mark-as-paid whenever the installment itself is unpaid (ACTIVE or OVERDUE),
  // regardless of whether a bankSlip exists — the API handles the null-bankSlip case gracefully.
  const canMarkPaid = installmentStatus === 'ACTIVE' || installmentStatus === 'OVERDUE';

  // Receipt actions: only for paid installments
  const showReceiptView = isPaid && hasReceipt;
  const showAttachReceipt = isPaid && !hasReceipt;
  const showBoletoPdfForPaid = isPaidByBankSlip && !hasReceipt;

  const hasAnyAction = canRegenerate || canCancel || canDownloadPdf || canChangeDueDate || canMarkPaid || showBoletoPdfForPaid || showReceiptView || showAttachReceipt;

  if (!hasAnyAction) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {/* For PAID installments: receipt view/download/attach + boleto PDF fallback */}
        {isPaid && (
          <>
            {showReceiptView && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewReceipt}
                  disabled={isViewing}
                  title="Visualizar Comprovante"
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
                  onClick={handleDownloadReceipt}
                  disabled={isDownloading}
                  title="Baixar Comprovante"
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

            {showAttachReceipt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReceiptDialog(true)}
                title="Anexar Comprovante"
                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700"
              >
                <IconPaperclip className="h-4 w-4" />
              </Button>
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
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelBoleto.isPending}
            >
              {cancelBoleto.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
            <DialogDescription>
              O boleto será cancelado no banco e a parcela será marcada como paga.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Método de Pagamento</Label>
              <Combobox
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod((v as string) || '')}
                options={PAYMENT_METHOD_OPTIONS}
                placeholder="Selecione o método..."
                searchable={false}
                clearable={false}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Comprovante (opcional)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconUpload className="h-3.5 w-3.5" />
                  {receiptFileName || 'Selecionar arquivo'}
                </Button>
                {receiptFileName && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={() => {
                      setReceiptFileForUpload(null);
                      setReceiptFileName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleReceiptFileChange}
              />
              <p className="text-xs text-muted-foreground mt-1">PDF ou imagem do comprovante de pagamento</p>
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

      {/* Attach Receipt Dialog (for already-paid installments) */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar Comprovante</DialogTitle>
            <DialogDescription>
              Anexe o comprovante de pagamento para esta parcela.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => receiptFileInputRef.current?.click()}
              >
                <IconUpload className="h-3.5 w-3.5" />
                Selecionar arquivo
              </Button>
              {receiptFileInputRef.current?.files?.[0] && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {receiptFileInputRef.current.files[0].name}
                </span>
              )}
            </div>
            <input
              ref={receiptFileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={() => {
                setReceiptFileName(receiptFileInputRef.current?.files?.[0]?.name || '');
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">PDF ou imagem do comprovante de pagamento</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAttachReceipt}
              disabled={isUploading || updateReceipt.isPending}
            >
              {isUploading || updateReceipt.isPending ? 'Enviando...' : 'Anexar Comprovante'}
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

      {/* Regenerate Boleto Dialog (with date picker) */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar Boleto</DialogTitle>
            <DialogDescription>
              O boleto será recriado com a data de vencimento selecionada. Selecione uma data válida (igual ou posterior a hoje).
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
              {regenerateBoleto.isPending ? 'Regenerando...' : 'Regenerar Boleto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
