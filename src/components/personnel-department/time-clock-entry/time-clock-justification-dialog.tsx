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
  originalTime: string | null;
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

type ChangeKind = "inclusion" | "modification" | "deletion";

function detectChangeKind(originalTime: string | null, newTime: string | null): ChangeKind {
  const orig = (originalTime ?? "").trim();
  const next = (newTime ?? "").trim();
  if (orig === "" && next !== "") return "inclusion";
  if (orig !== "" && next === "") return "deletion";
  return "modification";
}

const COPY: Record<ChangeKind, { tipo: string; description: string; placeholder: string }> = {
  inclusion: {
    tipo: "Inclusão",
    description: "Informe o motivo da inclusão manual",
    placeholder: "Descreva o motivo da inclusão...",
  },
  modification: {
    tipo: "Alteração",
    description: "Informe o motivo do descarte do registro original",
    placeholder: "Descreva o motivo da alteração...",
  },
  deletion: {
    tipo: "Exclusão",
    description: "Informe o motivo da exclusão do registro",
    placeholder: "Descreva o motivo da exclusão...",
  },
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
      originalTime: originalTime ?? "",
      newTime,
      field,
      reason: "",
    },
  });

  const kind = detectChangeKind(originalTime, newTime);
  const copy = COPY[kind];

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
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Marcação:</span>
                  <span className="font-medium">{getFieldDisplayName(field)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="font-medium">{copy.tipo}</span>
                </div>
                {originalTime && originalTime.trim() !== "" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Registro original:</span>
                    <span className="font-medium">{originalTime}</span>
                  </div>
                )}
                {newTime && newTime.trim() !== "" && (
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
                      placeholder={copy.placeholder}
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
