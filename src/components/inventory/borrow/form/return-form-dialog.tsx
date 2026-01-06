import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { IconLoader, IconPackageImport } from "@tabler/icons-react";
import { type Borrow } from "../../../../types";
import { formatDate } from "../../../../utils";
import { useBorrowMutations } from "../../../../hooks";
import { BORROW_STATUS } from "../../../../constants";
import { toast } from "sonner";

// Define return condition enum
enum RETURN_CONDITION {
  EXCELLENT = "EXCELLENT",
  GOOD = "GOOD",
  FAIR = "FAIR",
  POOR = "POOR",
  DAMAGED = "DAMAGED",
}

// Labels for return conditions
const RETURN_CONDITION_LABELS: Record<RETURN_CONDITION, string> = {
  [RETURN_CONDITION.EXCELLENT]: "Excelente",
  [RETURN_CONDITION.GOOD]: "Bom",
  [RETURN_CONDITION.FAIR]: "Regular",
  [RETURN_CONDITION.POOR]: "Ruim",
  [RETURN_CONDITION.DAMAGED]: "Danificado",
};

// Define the return form schema
const returnFormSchema = z.object({
  condition: z.enum(Object.values(RETURN_CONDITION) as [string, ...string[]], {
    required_error: "Condição é obrigatória",
  }),
  notes: z.string().max(500, "Notas devem ter no máximo 500 caracteres").optional(),
  returnedAt: z.date().default(() => new Date()),
});

type ReturnFormData = z.infer<typeof returnFormSchema>;

interface ReturnFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrow: Borrow & {
    item?: {
      name: string;
      barcode?: string | null;
    };
    user?: {
      name: string;
      email: string;
    };
  };
}

export function ReturnFormDialog({ open, onOpenChange, borrow }: ReturnFormDialogProps) {
  const { updateAsync } = useBorrowMutations();

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      condition: RETURN_CONDITION.GOOD,
      notes: "",
      returnedAt: new Date(),
    },
  });

  const handleSubmit = async (data: ReturnFormData) => {
    try {
      // Update the borrow with return details
      await updateAsync({
        id: borrow.id,
        data: {
          status: BORROW_STATUS.RETURNED, // Set status to RETURNED when processing return
          returnedAt: data.returnedAt,
          // Note: You may need to extend the borrow schema to include condition and return notes
          // For now, we'll include this information in the notes or create a separate return record
        },
      });

      // Close the dialog
      onOpenChange(false);

      // Reset form
      form.reset();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error processing return:", error);
      }
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPackageImport className="h-5 w-5" />
            Registrar Devolução
          </DialogTitle>
          <DialogDescription>Registre os detalhes da devolução do item emprestado.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Item Information */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Item:</span>
                <span className="text-sm font-medium">{borrow.item?.name}</span>
              </div>
              {borrow.item?.barcode && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Código:</span>
                  <span className="text-sm font-medium">{borrow.item.barcode}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Quantidade:</span>
                <span className="text-sm font-medium">{borrow.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Emprestado para:</span>
                <span className="text-sm font-medium">{borrow.user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Data do empréstimo:</span>
                <span className="text-sm font-medium">{formatDate(borrow.createdAt)}</span>
              </div>
            </div>

            {/* Condition Select */}
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condição do Item</FormLabel>
                  <FormControl>
                    <Combobox
                      disabled={isSubmitting}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={Object.entries(RETURN_CONDITION_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Selecione a condição"
                      searchable={false}
                      clearable={false}
                    />
                  </FormControl>
                  <FormDescription>Informe a condição em que o item está sendo devolvido</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes Textarea */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={isSubmitting}
                      placeholder="Adicione observações sobre a devolução..."
                      className="resize-none"
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>Registre qualquer observação relevante sobre o estado do item ou a devolução</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <IconLoader className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Devolução
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
