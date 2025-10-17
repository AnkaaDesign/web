import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useSectors } from "../../../../hooks";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import type { Task } from "../../../../types";

const setSectorSchema = z.object({
  sectorId: z.string().uuid("Setor inválido").nullable().optional(),
});

type SetSectorFormData = z.infer<typeof setSectorSchema>;

interface SetSectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onConfirm: (sectorId: string | null) => void;
}

export function SetSectorModal({ open, onOpenChange, tasks, onConfirm }: SetSectorModalProps) {
  const form = useForm<SetSectorFormData>({
    resolver: zodResolver(setSectorSchema),
    defaultValues: {
      sectorId: null,
    },
  });

  // Load production sectors
  const { data: sectorsData } = useSectors({
    where: {
      privileges: {
        in: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER],
      },
    },
    orderBy: { name: "asc" },
  });

  const sectors = sectorsData?.data || [];

  const handleSubmit = (data: SetSectorFormData) => {
    onConfirm(data.sectorId || null);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Definir Setor</DialogTitle>
          <DialogDescription>
            Selecione o setor de produção para {tasks.length === 1 ? "a tarefa" : `as ${tasks.length} tarefas`} selecionada{tasks.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sectorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setor de Produção</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ?? undefined}
                      onValueChange={(value) => field.onChange(value || null)}
                      options={[
                        { value: "", label: "Indefinido (sem setor)" },
                        ...sectors.map(
                          (sector): ComboboxOption => ({
                            value: sector.id,
                            label: sector.name,
                          }),
                        ),
                      ]}
                      placeholder="Selecione um setor"
                      searchable={sectors.length > 10}
                      clearable={true}
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
              <Button type="submit">Confirmar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
