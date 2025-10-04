import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { toast } from "sonner";
import { adjustItemPrices } from "../../../../api-client";
import { formatCurrency } from "../../../../utils";
import { IconPercentage, IconAlertTriangle } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Item } from "../../../../types";

// Schema for price adjustment validation
const priceAdjustmentSchema = z.object({
  percentage: z
    .number({ required_error: "Percentual é obrigatório" })
    .min(-100, "Percentual não pode ser menor que -100%")
    .max(1000, "Percentual não pode ser maior que 1000%")
    .refine((val) => val !== 0, "Percentual não pode ser zero"),
});

type PriceAdjustmentFormData = z.infer<typeof priceAdjustmentSchema>;

interface PriceAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: Item[];
  onSuccess?: () => void;
}

export function PriceAdjustmentModal({ open, onOpenChange, selectedItems, onSuccess }: PriceAdjustmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PriceAdjustmentFormData>({
    resolver: zodResolver(priceAdjustmentSchema),
    defaultValues: {
      percentage: 0,
    },
  });

  const watchedPercentage = form.watch("percentage");

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  // Calculate preview of price changes
  const getPreviewPrices = () => {
    const percentValue = watchedPercentage || 0;
    return selectedItems.map((item) => {
      const currentPrice = item.prices?.[0]?.value || 0;
      const adjustment = currentPrice * (percentValue / 100);
      const newPrice = currentPrice + adjustment;
      return {
        item,
        currentPrice,
        newPrice,
        adjustment,
      };
    });
  };

  const handleSubmit = async (data: PriceAdjustmentFormData) => {
    // Additional validation for items without price
    const itemsWithoutPrice = selectedItems.filter((item) => !item.prices || item.prices.length === 0 || item.prices[0].value === 0);
    if (itemsWithoutPrice.length === selectedItems.length) {
      toast.error("Nenhum item selecionado possui preço para ajustar");
      return;
    }

    setIsSubmitting(true);

    try {
      const itemIds = selectedItems.map((item) => item.id);
      const response = await adjustItemPrices(itemIds, data.percentage);

      if (response.data) {
        const { totalSuccess, totalFailed, results } = response.data;

        // Show main message (success or error)
        if (response.success) {
          toast.success(response.message);

          // Only show individual errors if there are few failures (less than 3)
          if (totalFailed > 0 && totalFailed <= 3 && results) {
            const failedItems = results.filter((r: any) => !r.success);
            failedItems.forEach((item: any) => {
              toast.error(`${item.itemName}: ${item.error}`);
            });
          }

          // Close modal if at least one succeeded
          if (totalSuccess > 0) {
            onOpenChange(false);
            onSuccess?.();
            // Reset form
            form.reset();
          }
        } else {
          toast.error(response.message || "Erro ao ajustar preços");
        }
      } else {
        // This should only show if response.success is true but no data
        if (response.success) {
          toast.success(response.message);
          onOpenChange(false);
          onSuccess?.();
          form.reset();
        } else {
          toast.error(response.message || "Erro ao ajustar preços");
        }
      }
    } catch (error: any) {
      console.error("Error adjusting prices:", error);
      const errorMessage = error.response?.data?.message || error.message || "Erro ao ajustar preços";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewPrices = getPreviewPrices();
  const hasItemsWithoutPrice = previewPrices.some((p) => p.currentPrice === 0);
  const percentValue = watchedPercentage || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Aplicar Ajuste de Preço</DialogTitle>
          <DialogDescription>
            Ajustar o preço de {selectedItems.length} {selectedItems.length === 1 ? "item" : "itens"} selecionado{selectedItems.length === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormInput<PriceAdjustmentFormData>
              name="percentage"
              label={
                <span className="flex items-center gap-2">
                  <IconPercentage className="h-4 w-4 text-muted-foreground" />
                  Percentual de Ajuste
                </span>
              }
              type="percentage"
              placeholder="0"
              autoFocus
              decimals={2}
              description="Use valores positivos para aumentar e negativos para reduzir"
            />

            {hasItemsWithoutPrice && (
              <Alert variant="warning">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>Alguns itens não possuem preço definido e serão ignorados no ajuste.</AlertDescription>
              </Alert>
            )}

            {watchedPercentage != null && !isNaN(percentValue) && percentValue !== 0 && (
              <div className="space-y-2">
                <Label>Prévia do Ajuste</Label>
                <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-3">
                  {previewPrices.slice(0, 5).map(({ item, currentPrice, newPrice }) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span className="truncate flex-1 mr-2">{item.name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{formatCurrency(currentPrice)}</span>
                        <span className="font-enhanced-unicode">→</span>
                        <span className={percentValue > 0 ? "text-destructive" : percentValue < 0 ? "text-emerald-600" : ""}>{formatCurrency(newPrice)}</span>
                      </div>
                    </div>
                  ))}
                  {previewPrices.length > 5 && (
                    <div className="text-sm text-muted-foreground text-center pt-2">
                      ... e mais {previewPrices.length - 5} {previewPrices.length - 5 === 1 ? "item" : "itens"}
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
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={watchedPercentage == null || watchedPercentage === 0 || isSubmitting || !form.formState.isValid}>
            {isSubmitting ? "Aplicando..." : "Aplicar Ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
