import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  IconRefresh,
  IconX,
  IconDownload,
  IconLoader2,
} from '@tabler/icons-react';
import { useRegenerateBoleto, useCancelBoleto } from '@/hooks/production/use-invoice';
import { invoiceService } from '@/api-client/invoice';
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
  const [isDownloading, setIsDownloading] = useState(false);
  const regenerateBoleto = useRegenerateBoleto();
  const cancelBoleto = useCancelBoleto();

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

  if (!canRegenerate && !canCancel && !canDownloadPdf) return null;

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
    </>
  );
}
