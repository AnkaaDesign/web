import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  IconFileDownload,
  IconCopy,
  IconQrcode,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { toast } from '@/components/ui/sonner';
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
  const regenerateBoleto = useRegenerateBoleto();
  const cancelBoleto = useCancelBoleto();

  const handleViewPdf = async () => {
    try {
      const response = await invoiceService.getBoletoPdf(installmentId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast.error('Erro ao abrir PDF do boleto');
    }
  };

  const handleCopyBarcode = async () => {
    if (!bankSlip?.digitableLine) return;
    try {
      await navigator.clipboard.writeText(bankSlip.digitableLine);
      toast.success('Linha digitável copiada');
    } catch {
      toast.error('Erro ao copiar linha digitável');
    }
  };

  const handleCopyPix = async () => {
    if (!bankSlip?.pixQrCode) return;
    try {
      await navigator.clipboard.writeText(bankSlip.pixQrCode);
      toast.success('Código PIX copiado');
    } catch {
      toast.error('Erro ao copiar código PIX');
    }
  };

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

  if (!bankSlip) return null;

  const isActive = bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE';
  const canRegenerate = bankSlip.status === 'ERROR' || bankSlip.status === 'REJECTED';
  const canCancel = bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE';

  return (
    <>
      <div className="flex items-center gap-1">
        {bankSlip.pdfFileId && isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewPdf}
            title="Ver PDF"
            className="h-7 w-7 p-0"
          >
            <IconFileDownload className="h-4 w-4" />
          </Button>
        )}

        {bankSlip.digitableLine && isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyBarcode}
            title="Copiar Linha Digitável"
            className="h-7 w-7 p-0"
          >
            <IconCopy className="h-4 w-4" />
          </Button>
        )}

        {bankSlip.pixQrCode && isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyPix}
            title="Copiar PIX"
            className="h-7 w-7 p-0"
          >
            <IconQrcode className="h-4 w-4" />
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
