import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useRegenerateBoleto, useCancelBoleto } from '@/hooks/production/use-invoice';
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

  const canRegenerate = bankSlip.status === 'ERROR' || bankSlip.status === 'REJECTED';
  const canCancel = bankSlip.status === 'ACTIVE' || bankSlip.status === 'OVERDUE';

  if (!canRegenerate && !canCancel) return null;

  return (
    <>
      <div className="flex items-center gap-1">
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
