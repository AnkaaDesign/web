import { useEffect, useState } from "react";
import { IconLoader2, IconCash } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { formatCurrency } from "@/utils";

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Payee name shown for context. */
  payeeName?: string;
  /** Amount shown for context. */
  amount?: number;
  isPending?: boolean;
  /** Receipts are optional — the categorization happens later in Conciliação. */
  onConfirm: (receipts: File[]) => void;
}

/**
 * Settle an order payable as paid, optionally attaching the comprovante (receipt).
 * The receipt is optional and reconciliation/categorization is intentionally left
 * for the dedicated Conciliação flow — this dialog only records the payment.
 */
export function MarkPaidDialog({ open, onOpenChange, payeeName, amount, isPending, onConfirm }: MarkPaidDialogProps) {
  const [receipts, setReceipts] = useState<FileWithPreview[]>([]);

  // Start fresh every time the dialog opens.
  useEffect(() => {
    if (open) setReceipts([]);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como pago</DialogTitle>
          <DialogDescription>
            {payeeName ? `${payeeName} · ` : ""}
            {typeof amount === "number" ? `${formatCurrency(amount)} · ` : ""}
            Anexe o comprovante (opcional). A categorização pode ser feita depois na Conciliação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Comprovante (opcional)</Label>
          <FileUploadField
            onFilesChange={setReceipts}
            existingFiles={receipts}
            maxFiles={10}
            maxSize={10 * 1024 * 1024}
            acceptedFileTypes={{
              "application/pdf": [".pdf"],
              "image/*": [".jpg", ".jpeg", ".png"],
            }}
            showPreview
            variant="compact"
            placeholder="Adicionar comprovante"
            disabled={isPending}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" disabled={isPending} onClick={() => onConfirm(receipts.filter((f) => f instanceof File) as File[])}>
            {isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCash className="h-4 w-4 mr-2" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
