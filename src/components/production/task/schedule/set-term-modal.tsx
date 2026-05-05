import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { Task } from "../../../../types";

const setTermSchema = z.object({
  term: z.date().nullable(),
});

type SetTermFormData = z.infer<typeof setTermSchema>;

interface SetTermModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onConfirm: (term: Date | null) => void;
}

export function SetTermModal({ open, onOpenChange, tasks, onConfirm }: SetTermModalProps) {
  const initialTerm = React.useMemo<Date | null>(() => {
    if (tasks.length === 0) return null;
    const firstTerm = tasks[0].term ?? null;
    const allSame = tasks.every((t) => {
      const a = t.term ? new Date(t.term).getTime() : null;
      const b = firstTerm ? new Date(firstTerm).getTime() : null;
      return a === b;
    });
    return allSame && firstTerm ? new Date(firstTerm) : null;
  }, [tasks]);

  const form = useForm<SetTermFormData>({
    resolver: zodResolver(setTermSchema),
    defaultValues: { term: initialTerm },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ term: initialTerm });
    }
  }, [open, initialTerm, form]);

  const handleSubmit = (data: SetTermFormData) => {
    onConfirm(data.term ?? null);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Definir Prazo</DialogTitle>
          <DialogDescription>
            Selecione o prazo de entrega para {tasks.length === 1 ? "a tarefa" : `as ${tasks.length} tarefas`} selecionada{tasks.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="term"
              render={({ field }) => (
                <FormItem>
                  <DateTimeInput
                    {...({
                      field: {
                        onChange: (value: Date | null) => field.onChange(value),
                        onBlur: () => field.onBlur(),
                        value: field.value ?? null,
                        name: field.name,
                      },
                      mode: "datetime",
                      context: "due",
                      label: "Prazo de Entrega",
                      allowManualInput: true,
                      showClearButton: true,
                    } as any)}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Confirmar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
