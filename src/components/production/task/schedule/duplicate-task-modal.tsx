import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Task } from "../../../../types";

const duplicateTaskSchema = z.object({
  serialNumber: z.string().optional(),
  plate: z.string().optional(),
});

type DuplicateTaskFormData = z.infer<typeof duplicateTaskSchema>;

interface DuplicateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onConfirm: (data: DuplicateTaskFormData) => void;
}

export function DuplicateTaskModal({ open, onOpenChange, task, onConfirm }: DuplicateTaskModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DuplicateTaskFormData>({
    resolver: zodResolver(duplicateTaskSchema),
    defaultValues: {
      serialNumber: task?.serialNumber || "",
      plate: task?.plate || "",
    },
  });

  React.useEffect(() => {
    if (task) {
      reset({
        serialNumber: task.serialNumber || "",
        plate: task.plate || "",
      });
    }
  }, [task, reset]);

  const onSubmit = (data: DuplicateTaskFormData) => {
    onConfirm(data);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Duplicar Tarefa</DialogTitle>
          <DialogDescription>Informe o número de série e/ou placa para a nova tarefa. Os demais dados serão copiados da tarefa original.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="serialNumber">Número de Série</Label>
              <Input id="serialNumber" placeholder="Digite o número de série" {...register("serialNumber")} />
              {errors.serialNumber && <p className="text-sm text-destructive">{errors.serialNumber.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plate">Placa</Label>
              <Input id="plate" type="plate" {...register("plate")} />
              {errors.plate && <p className="text-sm text-destructive">{errors.plate.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Duplicar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
