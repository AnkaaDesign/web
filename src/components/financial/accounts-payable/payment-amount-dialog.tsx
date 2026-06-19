import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLoader2, IconCash } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { formatCurrency } from "@/utils";

// VARIABLE recurrent bills are settled with the real paid amount, pre-filled
// with the stored estimate. The value is always a positive currency number.
const paymentAmountSchema = z.object({
  paidAmount: z
    .coerce.number({ invalid_type_error: "valor inválido" })
    .positive({ message: "Informe um valor maior que zero" }),
});

type PaymentAmountFormData = z.infer<typeof paymentAmountSchema>;

interface PaymentAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled estimate (the row's current amount). */
  estimate: number;
  /** Payee name shown for context. */
  payeeName?: string;
  isPending?: boolean;
  onConfirm: (paidAmount: number) => void;
}

export function PaymentAmountDialog({ open, onOpenChange, estimate, payeeName, isPending, onConfirm }: PaymentAmountDialogProps) {
  const form = useForm<PaymentAmountFormData>({
    resolver: zodResolver(paymentAmountSchema),
    defaultValues: { paidAmount: estimate || (undefined as unknown as number) },
  });

  // Reset to the current estimate whenever the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset({ paidAmount: estimate || (undefined as unknown as number) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, estimate]);

  const handleSubmit = (data: PaymentAmountFormData) => {
    onConfirm(Math.abs(data.paidAmount));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como pago</DialogTitle>
          <DialogDescription>
            {payeeName ? `${payeeName} · ` : ""}
            Conta variável — informe o valor efetivamente pago. A estimativa exibida é {formatCurrency(estimate)}.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormMoneyInput<PaymentAmountFormData> name="paidAmount" label="Valor pago" required disabled={isPending} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCash className="h-4 w-4 mr-2" />}
                Confirmar pagamento
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
