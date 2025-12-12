import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { timeClockJustificationSchema } from "../../../schemas";
import type { TimeClockJustificationFormData } from "../../../schemas";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconLoader2 } from "@tabler/icons-react";

interface TimeClockJustificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (justification: TimeClockJustificationFormData) => void;
  originalTime: string;
  newTime: string | null;
  field: string;
  fieldLabel: string;
  isLoading?: boolean;
}

const getFieldDisplayName = (field: string): string => {
  const fieldMap: Record<string, string> = {
    entry1: "Entrada 1",
    exit1: "Saída 1",
    entry2: "Entrada 2",
    exit2: "Saída 2",
    entry3: "Entrada 3",
    exit3: "Saída 3",
    entry4: "Entrada 4",
    exit4: "Saída 4",
    entry5: "Entrada 5",
    exit5: "Saída 5",
  };
  return fieldMap[field] || field;
};

export function TimeClockJustificationDialog({
  open,
  onOpenChange,
  onConfirm,
  originalTime,
  newTime,
  field,
  fieldLabel: _fieldLabel,
  isLoading = false,
}: TimeClockJustificationDialogProps) {
  const form = useForm<TimeClockJustificationFormData>({
    resolver: zodResolver(timeClockJustificationSchema),
    defaultValues: {
      originalTime,
      newTime,
      field,
      reason: "",
    },
  });

  const handleSubmit = (data: TimeClockJustificationFormData) => {
    onConfirm(data);
    form.reset();
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Justificativa de Alteração de Ponto</DialogTitle>
          <DialogDescription>Informe o motivo do descarte do seguinte registro original</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registro:</span>
                  <span className="font-medium">{originalTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{getFieldDisplayName(field)}</span>
                </div>
                {newTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Novo valor:</span>
                    <span className="font-medium">{newTime}</span>
                  </div>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="Descreva o motivo da alteração..."
                      className="min-h-[100px] resize-none"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
