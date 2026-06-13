import { useEffect, useMemo } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLoader2 } from "@tabler/icons-react";

import { TERMINATION_ITEM_TYPE_LABELS } from "../../../../constants";
import type { TerminationItem } from "../../../../types/termination";
import { useTerminationItemCreate, useTerminationItemUpdate } from "../../../../hooks/personnel-department/use-terminations";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { FormMoneyInput } from "@/components/ui/form-money-input";

/** Discount types are stored with negative amounts (the user always types a positive value). */
export function isDiscountItemType(type: string | undefined | null): boolean {
  return !!type && type.endsWith("_DISCOUNT");
}

// Dialog-local schema: the amount is always entered as a positive value; the
// sign is derived from the chosen type before submitting.
const itemDialogSchema = z.object({
  type: z.string().min(1, { message: "Selecione o tipo de verba" }),
  description: z.string().max(500).optional(),
  amount: z.coerce.number({ invalid_type_error: "valor inválido" }).positive({ message: "Informe um valor maior que zero" }),
});

type ItemDialogFormData = z.infer<typeof itemDialogSchema>;

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminationId: string;
  /** When provided the dialog edits an existing custom item. */
  item?: TerminationItem | null;
}

export function ItemFormDialog({ open, onOpenChange, terminationId, item }: ItemFormDialogProps) {
  const createItem = useTerminationItemCreate();
  const updateItem = useTerminationItemUpdate();
  const isEditing = !!item;
  const isPending = createItem.isPending || updateItem.isPending;

  const form = useForm<ItemDialogFormData>({
    resolver: zodResolver(itemDialogSchema),
    defaultValues: {
      type: "",
      description: "",
      amount: undefined as unknown as number,
    },
  });

  // Reset form whenever the dialog opens (create or edit)
  useEffect(() => {
    if (open) {
      form.reset({
        type: item?.type ?? "",
        description: item?.description ?? "",
        amount: item ? Math.abs(item.amount) : (undefined as unknown as number),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const typeOptions = useMemo(() => Object.entries(TERMINATION_ITEM_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);

  const watchedType = useWatch({ control: form.control, name: "type" });
  const isDiscount = isDiscountItemType(watchedType);

  const handleSubmit = async (data: ItemDialogFormData) => {
    // Sign-aware: discounts are submitted as negative amounts
    const signedAmount = isDiscountItemType(data.type) ? -Math.abs(data.amount) : Math.abs(data.amount);

    try {
      if (isEditing && item) {
        await updateItem.mutateAsync({
          itemId: item.id,
          data: {
            type: data.type,
            description: data.description?.trim() ? data.description.trim() : null,
            amount: signedAmount,
          },
        });
      } else {
        await createItem.mutateAsync({
          id: terminationId,
          data: {
            type: data.type,
            description: data.description?.trim() ? data.description.trim() : null,
            amount: signedAmount,
          },
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error saving termination item:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Verba" : "Adicionar Verba"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Edite os dados da verba manual."
              : "Adicione uma verba manual ao cálculo (ex.: INSS, IRRF, adiantamentos). Verbas manuais são mantidas ao recalcular."}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tipo de Verba <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      mode="single"
                      value={field.value || undefined}
                      onValueChange={(value) => field.onChange(value || "")}
                      options={typeOptions}
                      disabled={isPending}
                      placeholder="Selecione o tipo de verba"
                      emptyText="Nenhum tipo encontrado"
                      searchPlaceholder="Buscar tipo..."
                      clearable={false}
                      searchable={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value === null ? "" : String(value))}
                      disabled={isPending}
                      placeholder="Descrição da verba (opcional)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1">
              <FormMoneyInput<ItemDialogFormData> name="amount" label="Valor" required disabled={isPending} />
              <p className="text-xs text-muted-foreground">
                Informe sempre um valor positivo.{" "}
                {isDiscount
                  ? "Como o tipo escolhido é um desconto, o valor será lançado como negativo automaticamente."
                  : "Tipos de desconto são lançados automaticamente como valores negativos."}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
