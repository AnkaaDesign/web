import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconSend, IconX } from '@tabler/icons-react';
import { toast } from '@/components/ui/sonner';
import { useEmitNfse, useCancelNfse } from '@/hooks/production/use-invoice';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CANCEL_REASONS = [
  { code: '1', label: 'Erro na emissão' },
  { code: '2', label: 'Serviço não prestado' },
  { code: '4', label: 'Duplicidade da nota' },
];

interface NfseActionsProps {
  invoiceId: string;
  nfseDocuments: NfseDocument[] | null | undefined;
}

export function NfseActions({ invoiceId, nfseDocuments }: NfseActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonCode, setCancelReasonCode] = useState('1');
  const emitNfse = useEmitNfse();
  const cancelNfse = useCancelNfse();

  // Find the latest authorized NFSe (for cancel action)
  const authorizedNfse = nfseDocuments?.find((d) => d.status === 'AUTHORIZED') ?? null;

  // Find if there's an NFSe in error or pending state (for re-emit action)
  const errorOrPendingNfse = nfseDocuments?.find(
    (d) => d.status === 'ERROR' || d.status === 'PENDING'
  ) ?? null;

  // Check if all NFSe documents are cancelled (allows re-emission)
  const allCancelled = (nfseDocuments?.length ?? 0) > 0 &&
    nfseDocuments!.every((d) => d.status === 'CANCELLED');

  // Can emit if: no NFSe documents yet, latest is in error/pending state, or all are cancelled
  const hasAnyNfse = (nfseDocuments?.length ?? 0) > 0;
  const canEmit = !hasAnyNfse || !!errorOrPendingNfse || allCancelled;
  const canCancel = !!authorizedNfse;

  const handleEmit = () => {
    emitNfse.mutate(invoiceId);
  };

  const handleCancel = () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 15) {
      toast.error('Motivo do cancelamento é obrigatório e deve ter no mínimo 15 caracteres.');
      return;
    }
    if (!authorizedNfse) return;
    cancelNfse.mutate(
      {
        invoiceId,
        nfseDocumentId: authorizedNfse.id,
        data: { reason: cancelReason, reasonCode: Number(cancelReasonCode) },
      },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
          setCancelReason('');
          setCancelReasonCode('1');
        },
      }
    );
  };

  if (!canEmit && !canCancel) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {canEmit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEmit}
            disabled={emitNfse.isPending}
            title={hasAnyNfse ? 'Reemitir NFS-e' : 'Emitir NFS-e'}
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
          <div className="space-y-3 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Motivo</label>
              <Select value={cancelReasonCode} onValueChange={setCancelReasonCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Justificativa</label>
              <Input
                value={cancelReason}
                onChange={(value) => setCancelReason(String(value ?? ''))}
                placeholder="Descreva o motivo do cancelamento..."
              />
            </div>
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
