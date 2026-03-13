import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  IconRefresh,
  IconX,
  IconDownload,
  IconLoader2,
  IconCalendarEvent,
} from '@tabler/icons-react';
import { useRegenerateBoleto, useCancelBoleto, useChangeBankSlipDueDate } from '@/hooks/production/use-invoice';
import { invoiceService } from '@/api-client/invoice';
import { toast } from '@/components/ui/sonner';
import type { BankSlip } from '@/types/invoice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BoletoActionsProps {
  installmentId: string;
  bankSlip: BankSlip | null | undefined;
}

export function BoletoActions({ installmentId, bankSlip }: BoletoActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDueDateDialog, setShowDueDateDialog] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const regenerateBoleto = useRegenerateBoleto();
  const cancelBoleto = useCancelBoleto();
  const changeDueDate = useChangeBankSlipDueDate();

  const handleRegenerate = () => {
    regenerateBoleto.mutate(installmentId);
  };

  const handleCancel = () => {
    cancelBoleto.mutate(
      { installmentId },
      {
        onSuccess: () => setShowCancelDialog(false),
      }
    );
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
        newDueDate: newDueDate.toISOString().split('T')[0],
      },
      {
        onSuccess: () => {
          setShowDueDateDialog(false);
          setNewDueDate(null);
          toast.success('Data de vencimento alterada com sucesso.');
        },
      },
    );
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const response = await invoiceService.getBoletoPdf(installmentId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      console.error('Failed to download boleto PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!bankSlip) return null;

  const canRegenerate = bankSlip.status === 'ERROR' || bankSlip.status === 'REJECTED';
  const canCancel = bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE';
  const canDownloadPdf = bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE';
  const canChangeDueDate = bankSlip.status === 'OVERDUE';

  if (!canRegenerate && !canCancel && !canDownloadPdf && !canChangeDueDate) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {canDownloadPdf && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            title="Ver Boleto PDF"
            className="h-7 w-7 p-0"
          >
            {isDownloading ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconDownload className="h-4 w-4" />
            )}
          </Button>
        )}

        {canChangeDueDate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDueDateDialog(true)}
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
            onClick={handleRegenerate}
            disabled={regenerateBoleto.isPending}
            title="Regenerar Boleto"
            className="h-7 w-7 p-0"
          >
            <IconRefresh className="h-4 w-4" />
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

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Boleto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este boleto? Esta acao nao pode ser desfeita.
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

      <Dialog open={showDueDateDialog} onOpenChange={setShowDueDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Vencimento do Boleto</DialogTitle>
            <DialogDescription>
              Selecione a nova data de vencimento para este boleto. A data deve ser igual ou posterior a hoje.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-1.5 block">Nova Data de Vencimento</label>
            <input
              type="date"
              value={newDueDate ? newDueDate.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const dateStr = e.target.value;
                setNewDueDate(dateStr ? new Date(dateStr + 'T00:00:00') : null);
              }}
              min={new Date().toISOString().split('T')[0]}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
    </>
  );
}
