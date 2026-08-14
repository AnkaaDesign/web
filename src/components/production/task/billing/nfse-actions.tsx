import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconRefresh, IconSend, IconX } from '@tabler/icons-react';
import { toast } from '@/components/ui/sonner';
import { useEmitNfse, useCancelNfse, useReconcileNfse } from '@/hooks/production/use-invoice';
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
  /** When false, all mutating actions (emit/cancel) are hidden — read-only
   *  viewers (e.g. ACCOUNTING on Faturamento). Defaults to true. */
  canManage?: boolean;
  /** When false, only emit/reconcile are offered. Used where a TaskNfseHistoryCard sits
   *  alongside and already exposes a per-note Cancelar (which also reaches orphan notes),
   *  so the screen does not show two cancel buttons for the same note. Defaults to true. */
  showCancel?: boolean;
}

export function NfseActions({
  invoiceId,
  nfseDocuments,
  canManage = true,
  showCancel = true,
}: NfseActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonCode, setCancelReasonCode] = useState('1');
  const [cancelSubstituteNumber, setCancelSubstituteNumber] = useState('');
  const emitNfse = useEmitNfse();
  const cancelNfse = useCancelNfse();
  const reconcileNfse = useReconcileNfse();

  // Substitute NF number is required by the prefeitura for Duplicidade (code 4)
  const substituteRequired = cancelReasonCode === '4';

  // Nota VIVA na prefeitura — a que pode receber um pedido de cancelamento.
  // CANCEL_REJECTED conta: o fiscal recusou o cancelamento, então a nota continua valendo e
  // é justamente a que precisa de um reenvio corrigido (o backend aceita esse reenvio —
  // invoice.controller.ts admite AUTHORIZED, CANCEL_REJECTED e CANCEL_REQUESTED). Enquanto
  // isso procurava só por AUTHORIZED, uma nota rejeitada não tinha Cancelar, nem Emitir, nem
  // Reconciliar: o componente inteiro caía no `return null` e a tela ficava sem ação alguma.
  const authorizedNfse =
    nfseDocuments?.find((d) => d.status === 'AUTHORIZED') ??
    nfseDocuments?.find((d) => d.status === 'CANCEL_REJECTED') ??
    null;

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
  const canCancel = !!authorizedNfse && showCancel;

  // A doc left in PROCESSING is the one state with no way out: emission is a
  // non-transactional POST, so a crash between the request and the response leaves the
  // note possibly live at the prefeitura with no local link. "Emitir" refuses a
  // PROCESSING doc on purpose (it must never double-emit), so before this button the
  // panel rendered no actions at all and the invoice was stuck. Reconciling reads the
  // prefeitura's live state and links or rewinds — it never emits.
  const stuckNfse =
    nfseDocuments?.find((d) => d.status === 'PROCESSING') ??
    nfseDocuments?.find((d) => d.status === 'ERROR') ??
    null;
  const canReconcile = !!stuckNfse;

  const handleEmit = () => {
    emitNfse.mutate(invoiceId);
  };

  const handleCancel = () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 15) {
      toast.error('Motivo do cancelamento é obrigatório e deve ter no mínimo 15 caracteres.');
      return;
    }
    if (substituteRequired && !cancelSubstituteNumber.trim()) {
      toast.error('Informe o número da nota fiscal substituta para cancelamento por duplicidade.');
      return;
    }
    if (!authorizedNfse) return;
    cancelNfse.mutate(
      {
        invoiceId,
        nfseDocumentId: authorizedNfse.id,
        data: {
          reason: cancelReason,
          reasonCode: Number(cancelReasonCode),
          substituteNfseNumber: cancelSubstituteNumber.trim()
            ? Number(cancelSubstituteNumber)
            : undefined,
        },
      },
      {
        // The backend message states the outcome (pending/rejected/cancelled).
        onSuccess: (result: any) => {
          if (result?.message) {
            if (result.rejected) {
              toast.error(result.message);
            } else {
              toast.success(result.message);
            }
          }
          setShowCancelDialog(false);
          setCancelReason('');
          setCancelReasonCode('1');
          setCancelSubstituteNumber('');
        },
      }
    );
  };

  const handleReconcile = () => {
    reconcileNfse.mutate(invoiceId, {
      onSuccess: (result: any) => {
        const message = result?.message ?? result?.data?.message;
        // AMBIGUOUS comes back success=false: two live notes tie and a human must pick,
        // so it must not read as "resolved".
        if (result?.success === false) {
          toast.error(message ?? 'A reconciliação precisa de conferência manual.');
        } else {
          toast.success(message ?? 'NFS-e reconciliada.');
        }
      },
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.message ?? 'Não foi possível reconciliar a NFS-e.',
        );
      },
    });
  };

  if (!canManage || (!canEmit && !canCancel && !canReconcile)) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        {canReconcile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReconcile}
            disabled={reconcileNfse.isPending}
            title={
              stuckNfse?.status === 'PROCESSING'
                ? 'Verificar na prefeitura e destravar (não emite nota nova)'
                : 'Reconciliar NFS-e com a prefeitura'
            }
            className="h-7 w-7 p-0"
          >
            <IconRefresh className={`h-4 w-4 ${reconcileNfse.isPending ? 'animate-spin' : ''}`} />
          </Button>
        )}

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
            <div>
              <label
                className={`text-sm font-medium mb-1.5 block ${substituteRequired ? 'text-destructive' : ''}`}
              >
                Nota fiscal substituta (Nº)
                {substituteRequired && <span className="text-destructive"> *</span>}
              </label>
              <Input
                type="number"
                value={cancelSubstituteNumber}
                onChange={(value) => setCancelSubstituteNumber(String(value ?? ''))}
                placeholder="Número da NFS-e que substitui esta nota"
                className={substituteRequired ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {substituteRequired && (
                <p className="text-xs text-destructive mt-1">
                  Obrigatório para cancelamento por duplicidade.
                </p>
              )}
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
