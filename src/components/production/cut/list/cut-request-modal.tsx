import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { Cut } from "../../../../types";
import { CUT_REQUEST_REASON } from "../../../../constants";
import { CUT_REQUEST_REASON_LABELS, CUT_TYPE_LABELS } from "../../../../constants";

const requestSchema = z.object({
  quantity: z.coerce.number().int("Quantidade deve ser um número inteiro").min(1, "Quantidade deve ser maior que zero").max(100, "Quantidade não pode exceder 100"),
  reason: z.nativeEnum(CUT_REQUEST_REASON, {
    errorMap: () => ({ message: "Motivo inválido" }),
  }),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface CutRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RequestFormData) => void;
  cutItem: Cut | null;
}

export function CutRequestModal({ open, onOpenChange, onSubmit, cutItem }: CutRequestModalProps) {
  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      quantity: 1,
      reason: CUT_REQUEST_REASON.WRONG_APPLY,
    },
  });

  const handleSubmit = (data: RequestFormData) => {
    onSubmit(data);
    form.reset();
  };

  const cutType = cutItem?.type;
  const fileName = cutItem?.file?.filename || "arquivo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Solicitar Novo Corte</DialogTitle>
          <DialogDescription>
            Solicite um novo corte para o arquivo {fileName}
            {cutType && ` (${CUT_TYPE_LABELS[cutType]})`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1" ref={field.ref} value={field.value} onChange={(value) => field.onChange(typeof value === "number" ? value : 1)} onBlur={field.onBlur} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={Object.entries(CUT_REQUEST_REASON_LABELS).map(
                        ([value, label]): ComboboxOption => ({
                          value,
                          label: label as string,
                        }),
                      )}
                      placeholder="Selecione o motivo"
                      searchable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Solicitar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
