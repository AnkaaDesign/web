import React, { useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { Task } from "../../../../types";

// Schema for a single copy entry
const copyEntrySchema = z.object({
  serialNumber: z
    .string()
    .optional()
    .transform((val) => val?.trim().toUpperCase() || undefined),
  plate: z
    .string()
    .optional()
    .transform((val) => val?.trim().toUpperCase() || undefined),
});

// Schema for multiple copies
const duplicateTaskSchema = z.object({
  copies: z.array(copyEntrySchema).min(1, "Adicione pelo menos uma cópia"),
});

type DuplicateTaskFormData = z.infer<typeof duplicateTaskSchema>;

// Type for what the parent component receives (array of copies)
export type DuplicateTaskCopyData = { serialNumber?: string; plate?: string }[];

interface DuplicateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onConfirm: (copies: DuplicateTaskCopyData) => void;
}

export function DuplicateTaskModal({ open, onOpenChange, task, onConfirm }: DuplicateTaskModalProps) {
  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<DuplicateTaskFormData>({
    resolver: zodResolver(duplicateTaskSchema),
    defaultValues: {
      copies: [{ serialNumber: "", plate: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "copies",
  });

  // Add a new copy entry
  const handleAddCopy = useCallback(() => {
    append({ serialNumber: "", plate: "" });
  }, [append]);

  React.useEffect(() => {
    if (task && open) {
      reset({
        copies: [{ serialNumber: "", plate: "" }],
      });
    }
  }, [task, open, reset]);

  const onSubmit = (data: DuplicateTaskFormData) => {
    onConfirm(data.copies);
    onOpenChange(false);
    reset({ copies: [{ serialNumber: "", plate: "" }] });
  };

  const copyCount = fields.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Cópias</DialogTitle>
          <DialogDescription>
            Criando {copyCount > 1 ? `${copyCount} cópias` : "uma cópia"}{task ? ` de "${task.name}"` : ""}. Informe o número de série e placa para cada cópia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
          <div className="max-h-[40vh] overflow-y-auto space-y-2 py-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-end gap-2"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    {index === 0 && <Label htmlFor={`serialNumber-${index}`}>Nº Série</Label>}
                    <Controller
                      control={control}
                      name={`copies.${index}.serialNumber`}
                      render={({ field: controllerField }) => (
                        <Input
                          id={`serialNumber-${index}`}
                          placeholder="Ex: ABC-12345"
                          className="uppercase"
                          value={controllerField.value || ""}
                          onChange={(val) => controllerField.onChange(typeof val === 'string' ? val.toUpperCase() : val)}
                        />
                      )}
                    />
                    {errors.copies?.[index]?.serialNumber && (
                      <p className="text-sm text-destructive">{errors.copies[index].serialNumber?.message}</p>
                    )}
                  </div>
                  <div className="grid gap-1">
                    {index === 0 && <Label htmlFor={`plate-${index}`}>Placa</Label>}
                    <Controller
                      control={control}
                      name={`copies.${index}.plate`}
                      render={({ field: controllerField }) => (
                        <Input
                          id={`plate-${index}`}
                          placeholder="Ex: ABC1D23"
                          className="uppercase"
                          value={controllerField.value || ""}
                          onChange={(val) => controllerField.onChange(typeof val === 'string' ? val.toUpperCase() : val)}
                        />
                      )}
                    />
                    {errors.copies?.[index]?.plate && (
                      <p className="text-sm text-destructive">{errors.copies[index].plate?.message}</p>
                    )}
                  </div>
                </div>

                {/* Remove Button - always show to maintain layout consistency */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  className={fields.length > 1 ? "text-destructive shrink-0" : "text-muted-foreground/30 shrink-0 cursor-not-allowed"}
                  title={fields.length > 1 ? "Remover cópia" : "Não é possível remover a única cópia"}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Adicionar Button - full width */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCopy}
            className="w-full mt-2"
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {copyCount > 1 ? `Criar ${copyCount} Cópias` : "Criar Cópia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
