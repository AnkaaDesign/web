import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { toast } from "@/components/ui/sonner";
import { adjustPositionSalaries } from "../../../../api-client";
import { formatCurrency } from "../../../../utils";
import { IconPercentage, IconAlertTriangle } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Position } from "../../../../types";

const salaryAdjustmentSchema = z.object({
  percentage: z
    .number({ required_error: "Percentual é obrigatório" })
    .min(-100, "Percentual não pode ser menor que -100%")
    .max(1000, "Percentual não pode ser maior que 1000%")
    .refine((val) => val !== 0, "Percentual não pode ser zero"),
});

type SalaryAdjustmentFormData = z.infer<typeof salaryAdjustmentSchema>;

interface SalaryAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPositions: Position[];
  onSuccess?: () => void;
}

export function SalaryAdjustmentModal({ open, onOpenChange, selectedPositions, onSuccess }: SalaryAdjustmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SalaryAdjustmentFormData>({
    resolver: zodResolver(salaryAdjustmentSchema),
    defaultValues: { percentage: 0 },
  });

  const watchedPercentage = form.watch("percentage");

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const getCurrentSalary = (position: Position): number => {
    // Virtual remuneration field from backend, or fallback to latest remuneration
    return position.remuneration ?? position.remunerations?.[0]?.value ?? 0;
  };

  const getPreviewSalaries = () => {
    const percentValue = watchedPercentage || 0;
    return selectedPositions.map((position) => {
      const currentSalary = getCurrentSalary(position);
      const adjustment = currentSalary * (percentValue / 100);
      const newSalary = currentSalary + adjustment;
      return { position, currentSalary, newSalary, adjustment };
    });
  };

  const handleSubmit = async (data: SalaryAdjustmentFormData) => {
    const positionsWithoutSalary = selectedPositions.filter((p) => getCurrentSalary(p) === 0);
    if (positionsWithoutSalary.length === selectedPositions.length) {
      toast.error("Nenhum cargo selecionado possui remuneração para reajustar");
      return;
    }

    setIsSubmitting(true);

    try {
      const positionIds = selectedPositions.map((p) => p.id);
      const response = await adjustPositionSalaries(positionIds, data.percentage);

      // O sucesso/erro geral já é informado pelo interceptor do api-client
      // (convenção anti-duplicação de toast). Aqui só emitimos os detalhes
      // por-cargo que o interceptor não tem como mostrar.
      if (response.data) {
        const { totalSuccess, totalFailed, results } = response.data;

        if (response.success) {
          if (totalFailed > 0 && totalFailed <= 3 && results) {
            const failedPositions = results.filter((r: any) => !r.success);
            failedPositions.forEach((p: any) => {
              toast.error(`${p.positionName}: ${p.error}`);
            });
          }

          if (totalSuccess > 0) {
            onOpenChange(false);
            onSuccess?.();
            form.reset();
          }
        }
      } else if (response.success) {
        onOpenChange(false);
        onSuccess?.();
        form.reset();
      }
    } catch (error: any) {
      // Erro já tratado/toasted pelo interceptor do api-client.
      if (process.env.NODE_ENV !== "production") {
        console.error("Error adjusting salaries:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewSalaries = getPreviewSalaries();
  const hasPositionsWithoutSalary = previewSalaries.some((p) => p.currentSalary === 0);
  const percentValue = watchedPercentage || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Aplicar Reajuste de Remuneração</DialogTitle>
          <DialogDescription>
            Reajustar a remuneração de {selectedPositions.length} {selectedPositions.length === 1 ? "cargo" : "cargos"} selecionado{selectedPositions.length === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormInput<SalaryAdjustmentFormData>
              name="percentage"
              label={
                <span className="flex items-center gap-2">
                  <IconPercentage className="h-4 w-4 text-muted-foreground" />
                  Percentual de Reajuste
                </span>
              }
              type="percentage"
              placeholder="0"
              autoFocus
              decimals={2}
              description="Use valores positivos para aumentar e negativos para reduzir"
            />

            {hasPositionsWithoutSalary && (
              <Alert variant="warning">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>Alguns cargos não possuem remuneração definida e serão ignorados no reajuste.</AlertDescription>
              </Alert>
            )}

            {watchedPercentage != null && !isNaN(percentValue) && percentValue !== 0 && (
              <div className="space-y-2">
                <Label>Prévia do Reajuste</Label>
                <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-3">
                  {previewSalaries.slice(0, 5).map(({ position, currentSalary, newSalary }) => (
                    <div key={position.id} className="flex justify-between items-center text-sm">
                      <span className="truncate flex-1 mr-2">{position.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{currentSalary > 0 ? formatCurrency(currentSalary) : "—"}</span>
                        <span className="font-enhanced-unicode">→</span>
                        <span className={currentSalary === 0 ? "text-muted-foreground" : percentValue > 0 ? "text-destructive" : "text-emerald-600"}>
                          {currentSalary > 0 ? formatCurrency(newSalary) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {previewSalaries.length > 5 && (
                    <div className="text-sm text-muted-foreground text-center pt-2">
                      ... e mais {previewSalaries.length - 5} {previewSalaries.length - 5 === 1 ? "cargo" : "cargos"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={watchedPercentage == null || watchedPercentage === 0 || isSubmitting || !form.formState.isValid}
          >
            {isSubmitting ? "Aplicando..." : "Aplicar Reajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
