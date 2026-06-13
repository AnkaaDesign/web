import { useState, useEffect } from "react";
import { IconCircleX, IconLoader2 } from "@tabler/icons-react";

import type { UserBenefit } from "../../../../types/benefit";
import { useTerminateUserBenefit } from "../../../../hooks/personnel-department/use-user-benefits";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserBenefitTerminateDialogProps {
  userBenefit: UserBenefit | null;
  onOpenChange: (open: boolean) => void;
  onTerminated?: () => void;
}

export function UserBenefitTerminateDialog({ userBenefit, onOpenChange, onTerminated }: UserBenefitTerminateDialogProps) {
  const terminateMutation = useTerminateUserBenefit();
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Reset the end date to today whenever the dialog opens for a new enrollment
  useEffect(() => {
    if (userBenefit) {
      setEndDate(new Date());
    }
  }, [userBenefit?.id]);

  const handleConfirm = async () => {
    if (!userBenefit || !endDate) return;

    try {
      await terminateMutation.mutateAsync({ id: userBenefit.id, endDate });
      onOpenChange(false);
      onTerminated?.();
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error terminating enrollment:", error);
      }
    }
  };

  return (
    <Dialog open={!!userBenefit} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCircleX className="h-5 w-5 text-destructive" />
            Encerrar Adesão
          </DialogTitle>
          <DialogDescription>
            Encerrar a adesão {userBenefit?.user?.name ? `de "${userBenefit.user.name}" ` : ""}
            {userBenefit?.benefit?.name ? `ao benefício "${userBenefit.benefit.name}"` : "ao benefício"}. Informe a data de encerramento. Esta ação muda o status para
            "Encerrada" e não pode ser revertida pela tela de edição.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="mb-2 block">Data de Encerramento</Label>
          <DateTimeInput
            mode="date"
            value={endDate}
            onChange={(date) => {
              if (date instanceof Date) setEndDate(date);
            }}
            hideLabel
            placeholder="Selecionar data..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={terminateMutation.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={terminateMutation.isPending || !endDate}>
            {terminateMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCircleX className="h-4 w-4 mr-2" />}
            Encerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
