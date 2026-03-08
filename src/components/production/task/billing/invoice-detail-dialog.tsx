import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { IconX } from '@tabler/icons-react';
import { formatCurrency } from '@/utils';
import { InvoiceStatusBadge } from './invoice-status-badge';
import { NfseStatusBadge } from './nfse-status-badge';
import { NfseActions } from './nfse-actions';
import { InstallmentRow } from './installment-row';
import { useCancelInvoice } from '@/hooks/production/use-invoice';
import type { Invoice } from '@/types/invoice';
import { useState } from 'react';

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailDialog({ invoice, open, onOpenChange }: InvoiceDetailDialogProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const cancelInvoice = useCancelInvoice();

  if (!invoice) return null;

  const canCancel = invoice.status === 'DRAFT' || invoice.status === 'ACTIVE';

  const handleCancel = () => {
    cancelInvoice.mutate(
      { id: invoice.id },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Fatura</span>
              <InvoiceStatusBadge status={invoice.status} />
            </DialogTitle>
            <DialogDescription>
              {invoice.customer?.fantasyName || 'Cliente'}
              {invoice.task?.serialNumber && ` - OS #${invoice.task.serialNumber}`}
            </DialogDescription>
          </DialogHeader>

          {/* Invoice Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total</p>
              <p className="text-lg font-bold">{formatCurrency(invoice.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Pago</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(invoice.paidAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Parcelas</p>
              <p className="text-lg font-bold">{invoice.installments?.length ?? 0}</p>
            </div>
          </div>

          {/* NFS-e Section */}
          {(invoice.nfseDocument || invoice.status === 'ACTIVE' || invoice.status === 'PAID') && (
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">NFS-e</span>
                {invoice.nfseDocument ? (
                  <>
                    <NfseStatusBadge status={invoice.nfseDocument.status} size="sm" />
                    {invoice.nfseDocument.nfseNumber && (
                      <span className="text-sm text-muted-foreground">
                        #{invoice.nfseDocument.nfseNumber}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Nao emitida</span>
                )}
              </div>
              <NfseActions invoiceId={invoice.id} nfseDocument={invoice.nfseDocument} />
            </div>
          )}

          {/* Installments Table */}
          {invoice.installments && invoice.installments.length > 0 && (
            <div className="py-2">
              <h4 className="text-sm font-medium mb-3">Parcelas</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Boleto</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.installments
                    .sort((a, b) => a.number - b.number)
                    .map((installment) => (
                      <InstallmentRow
                        key={installment.id}
                        installment={installment}
                      />
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="py-3 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observacoes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}

          {/* Actions */}
          {canCancel && (
            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
              >
                <IconX className="h-4 w-4 mr-1" />
                Cancelar Fatura
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Fatura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta fatura? Todos os boletos pendentes serao cancelados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelInvoice.isPending}
            >
              {cancelInvoice.isPending ? 'Cancelando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
