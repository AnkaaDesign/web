import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconSend, IconX, IconAlertTriangle } from '@tabler/icons-react';
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
  const [cancelError, setCancelError] = useState<string | null>(null);
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

  const handleCancel = (force = false) => {
    if (!cancelReason.trim() || cancelReason.trim().length < 15) {
      toast.error('Motivo do cancelamento é obrigatório e deve ter no mínimo 15 caracteres.');
      return;
    }
    if (!authorizedNfse) return;
    cancelNfse.mutate(
      {
        invoiceId,
        nfseDocumentId: authorizedNfse.id,
        data: { reason: cancelReason, reasonCode: Number(cancelReasonCode), ...(force && { force: true }) },
      },
      {
        onSuccess: (data: any) => {
          setShowCancelDialog(false);
          setCancelReason('');
          setCancelReasonCode('1');
          setCancelError(null);
          if (data?.forceCancel) {
            toast.warning(data.message ?? 'NFS-e cancelada localmente. Cancele manualmente no Elotech OXY.');
          }
        },
        onError: (err: any) => {
          const msg: string =
            err?.response?.data?.message ||
            err?.message ||
            'Erro ao cancelar NFS-e.';
          setCancelError(msg);
        },
      }
    );
  };

  const resetCancelDialog = (open: boolean) => {
    setShowCancelDialog(open);
    if (!open) {
      setCancelReason('');
      setCancelReasonCode('1');
      setCancelError(null);
    }
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

      <Dialog open={showCancelDialog} onOpenChange={resetCancelDialog}>
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

            {cancelError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <IconAlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Elotech recusou o cancelamento:</p>
                    <p className="text-xs mt-0.5 text-amber-700">{cancelError}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-700 pl-6">
                  Isso pode ocorrer para NFS-e emitidas há mais de 30 dias. Você pode forçar o cancelamento local — a NFS-e permanecerá válida no Elotech e deverá ser cancelada manualmente no portal.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => resetCancelDialog(false)}>
              Voltar
            </Button>
            {cancelError && (
              <Button
                variant="outline"
                className="border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={() => handleCancel(true)}
                disabled={cancelNfse.isPending}
              >
                {cancelNfse.isPending ? 'Cancelando...' : 'Forçar Cancelamento Local'}
              </Button>
            )}
            {!cancelError && (
              <Button
                variant="destructive"
                onClick={() => handleCancel(false)}
                disabled={cancelNfse.isPending}
              >
                {cancelNfse.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
