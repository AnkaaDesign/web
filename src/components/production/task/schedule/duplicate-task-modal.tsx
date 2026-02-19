import React, { useState, useCallback } from "react";
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
  chassisNumber: z
    .string()
    .optional()
    .transform((val) => val?.trim().replace(/\s/g, "").toUpperCase() || undefined),
});

// Schema for multiple copies
const duplicateTaskSchema = z.object({
  copies: z.array(copyEntrySchema).min(1, "Adicione pelo menos uma cópia"),
});

type DuplicateTaskFormData = z.infer<typeof duplicateTaskSchema>;

// Type for what the parent component receives (array of copies)
export type DuplicateTaskCopyData = { serialNumber?: string; plate?: string; chassisNumber?: string }[];

interface DuplicateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onConfirm: (copies: DuplicateTaskCopyData) => void;
}

export function DuplicateTaskModal({ open, onOpenChange, task, onConfirm }: DuplicateTaskModalProps) {
  const [mode, setMode] = useState<'quantity' | 'detailed'>('quantity');
  const [quantity, setQuantity] = useState<number | ''>('');

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<DuplicateTaskFormData>({
    resolver: zodResolver(duplicateTaskSchema),
    defaultValues: {
      copies: [{ serialNumber: "", plate: "", chassisNumber: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "copies",
  });

  // Add a new copy entry
  const handleAddCopy = useCallback(() => {
    append({ serialNumber: "", plate: "", chassisNumber: "" });
  }, [append]);

  React.useEffect(() => {
    if (task && open) {
      reset({
        copies: [{ serialNumber: "", plate: "", chassisNumber: "" }],
      });
      setMode('quantity');
      setQuantity('');
    }
  }, [task, open, reset]);

  // Submit for detailed mode (via form validation)
  const onDetailedSubmit = (data: DuplicateTaskFormData) => {
    onConfirm(data.copies);
    onOpenChange(false);
    reset({ copies: [{ serialNumber: "", plate: "", chassisNumber: "" }] });
  };

  // Submit for quantity mode
  const onQuantitySubmit = () => {
    if (!quantity || quantity < 1) return;
    const blankCopies: DuplicateTaskCopyData = Array.from({ length: quantity }, () => ({}));
    onConfirm(blankCopies);
    onOpenChange(false);
    reset({ copies: [{ serialNumber: "", plate: "", chassisNumber: "" }] });
    setQuantity('');
  };

  const handleSubmitClick = () => {
    if (mode === 'quantity') {
      onQuantitySubmit();
    } else {
      handleSubmit(onDetailedSubmit)();
    }
  };

  const submitLabel = mode === 'quantity'
    ? (quantity && quantity > 1 ? `Criar ${quantity} Cópias` : quantity === 1 ? "Criar Cópia" : "Criar Cópias")
    : (fields.length > 1 ? `Criar ${fields.length} Cópias` : "Criar Cópia");

  const isSubmitDisabled = mode === 'quantity' && (!quantity || quantity < 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Cópias</DialogTitle>
          <DialogDescription>
            Criando cópias{task ? ` de "${task.name}"` : ""}.
            {mode === 'quantity'
              ? " Informe a quantidade de cópias idênticas a criar."
              : " Informe placa, nº série e chassi para cada cópia (opcionais)."}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'quantity' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('quantity')}
          >
            Quantidade
          </Button>
          <Button
            type="button"
            variant={mode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('detailed')}
          >
            Detalhado
          </Button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'quantity' ? (
            /* Quantity Mode */
            <div className="flex items-center gap-3 py-4">
              <Label className="whitespace-nowrap text-sm font-medium">Quantidade de cópias</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(val) => {
                  const num = Number(val);
                  setQuantity(num > 0 ? Math.min(num, 50) : '');
                }}
                className="w-24"
                placeholder="Ex: 5"
                autoFocus
              />
            </div>
          ) : (
            /* Detailed Mode */
            <>
              <div className="max-h-[40vh] overflow-y-auto space-y-2 py-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-end gap-2"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
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
                              autoFocus={index === 0}
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
                      <div className="grid gap-1">
                        {index === 0 && <Label htmlFor={`chassisNumber-${index}`}>Nº Chassi</Label>}
                        <Controller
                          control={control}
                          name={`copies.${index}.chassisNumber`}
                          render={({ field: controllerField }) => (
                            <Input
                              id={`chassisNumber-${index}`}
                              placeholder="Ex: 9BWZZZ377VT004251"
                              className="uppercase"
                              value={controllerField.value || ""}
                              onChange={(val) => controllerField.onChange(typeof val === 'string' ? val.toUpperCase() : val)}
                            />
                          )}
                        />
                        {errors.copies?.[index]?.chassisNumber && (
                          <p className="text-sm text-destructive">{errors.copies[index].chassisNumber?.message}</p>
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
            </>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmitClick} disabled={isSubmitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
