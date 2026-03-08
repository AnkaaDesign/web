import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconFileDownload, IconSend, IconX } from '@tabler/icons-react';
import { toast } from '@/components/ui/sonner';
import { useEmitNfse, useCancelNfse } from '@/hooks/production/use-invoice';
import { invoiceService } from '@/api-client/invoice';
import type { NfseDocument } from '@/types/invoice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface NfseActionsProps {
  invoiceId: string;
  nfseDocument: NfseDocument | null | undefined;
}

export function NfseActions({ invoiceId, nfseDocument }: NfseActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const emitNfse = useEmitNfse();
  const cancelNfse = useCancelNfse();

  const handleViewDanfse = async () => {
    try {
      const response = await invoiceService.getNfsePdf(invoiceId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast.error('Erro ao abrir DANFSE');
    }
  };

  const handleEmit = () => {
    emitNfse.mutate(invoiceId);
  };

  const handleCancel = () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 15) {
      toast.error('Motivo do cancelamento é obrigatório e deve ter no mínimo 15 caracteres.');
      return;
    }
    cancelNfse.mutate(
      { invoiceId, data: { reason: cancelReason } },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
          setCancelReason('');
        },
      }
    );
  };

  const hasNfse = !!nfseDocument;
  const isAuthorized = nfseDocument?.status === 'AUTHORIZED';
  const canEmit = hasNfse && (nfseDocument?.status === 'ERROR' || nfseDocument?.status === 'PENDING');
  const canCancel = isAuthorized;

  return (
    <>
      <div className="flex items-center gap-1">
        {isAuthorized && nfseDocument.pdfFileId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewDanfse}
            title="Ver DANFSE"
            className="h-7 w-7 p-0"
          >
            <IconFileDownload className="h-4 w-4" />
          </Button>
        )}

        {canEmit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEmit}
            disabled={emitNfse.isPending}
            title={hasNfse ? 'Reemitir NFS-e' : 'Emitir NFS-e'}
            className="h-7 w-7 p-0"
          >
            <IconSend className="h-4 w-4" />
          </Button>
        )}

        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
            title="Cancelar NFS-e"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <IconX className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NFS-e</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento da NFS-e. Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={cancelReason}
              onChange={(value) => setCancelReason(String(value ?? ''))}
              placeholder="Motivo do cancelamento..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelNfse.isPending}
            >
              {cancelNfse.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
