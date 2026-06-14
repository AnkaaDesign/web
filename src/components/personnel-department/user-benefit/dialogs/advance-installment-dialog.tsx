import { IconListNumbers, IconLoader2, IconPlayerTrackNext } from "@tabler/icons-react";

import type { UserBenefit } from "../../../../types/benefit";
import { useAdvanceUserBenefitInstallment } from "../../../../hooks/personnel-department/use-user-benefits";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserBenefitAdvanceInstallmentDialogProps {
  userBenefit: UserBenefit | null;
  onOpenChange: (open: boolean) => void;
  onAdvanced?: () => void;
}

export function UserBenefitAdvanceInstallmentDialog({ userBenefit, onOpenChange, onAdvanced }: UserBenefitAdvanceInstallmentDialogProps) {
  const advanceMutation = useAdvanceUserBenefitInstallment();

  const total = userBenefit?.totalInstallments ?? null;
  const current = userBenefit?.currentInstallment ?? 1;
  const isLast = total !== null && current >= total;

  const handleConfirm = async () => {
    if (!userBenefit || isLast) return;

    try {
      await advanceMutation.mutateAsync({ id: userBenefit.id });
      onOpenChange(false);
      onAdvanced?.();
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error advancing installment:", error);
      }
    }
  };

  return (
    <Dialog open={!!userBenefit} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconListNumbers className="h-5 w-5 text-muted-foreground" />
            Avançar Parcela
          </DialogTitle>
          <DialogDescription>
            Avançar o parcelamento {userBenefit?.user?.name ? `de "${userBenefit.user.name}" ` : ""}
            {userBenefit?.benefit?.name ? `ao benefício "${userBenefit.benefit.name}"` : "do convênio"}. Esta ação registra mais uma folha descontada.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Parcela atual: </span>
            <span className="font-medium">
              {total !== null ? `${current}/${total}` : "—"}
            </span>
          </div>
          {isLast && <p className="text-xs text-muted-foreground mt-2">Esta já é a última parcela do parcelamento. Não há como avançar.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={advanceMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={advanceMutation.isPending || isLast}>
            {advanceMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconPlayerTrackNext className="h-4 w-4 mr-2" />}
            Avançar parcela
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
