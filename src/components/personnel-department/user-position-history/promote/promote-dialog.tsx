import React, { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormCombobox } from "@/components/ui/form-combobox";
import { Textarea } from "@/components/ui/textarea";
import { IconUser, IconBriefcase, IconTag, IconNotes, IconLoader2 } from "@tabler/icons-react";
import { getUsers, getPositions } from "../../../../api-client";
import { POSITION_CHANGE_REASON, POSITION_CHANGE_REASON_LABELS, CONTRACT_STATUS } from "../../../../constants";
import { useUserPositionHistoryMutations } from "../../../../hooks/personnel-department/use-user-position-history";
import type { UserPositionHistoryPromoteFormData } from "../../../../schemas/user-position-history";

// =====================
// Local form schema
// =====================

const promoteFormSchema = z.object({
  userId: z.string().uuid({ message: "Selecione o colaborador" }),
  toPositionId: z.string().uuid({ message: "Selecione o cargo de destino" }),
  reason: z.enum([POSITION_CHANGE_REASON.PROMOTION, POSITION_CHANGE_REASON.TRANSFER, POSITION_CHANGE_REASON.DEMOTION] as [string, ...string[]], {
    errorMap: () => ({ message: "Selecione o motivo" }),
  }),
  note: z.string().max(1000, "Observação deve ter no máximo 1000 caracteres").optional(),
});

type PromoteFormData = z.infer<typeof promoteFormSchema>;

interface PromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromoteDialog({ open, onOpenChange }: PromoteDialogProps) {
  const { promoteAsync, isPromoting } = useUserPositionHistoryMutations();

  const form = useForm<PromoteFormData>({
    resolver: zodResolver(promoteFormSchema),
    defaultValues: {
      userId: "",
      toPositionId: "",
      reason: POSITION_CHANGE_REASON.PROMOTION,
      note: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  // Async query function for active users
  const queryUsers = useCallback(async (searchTerm: string) => {
    try {
      const queryParams: any = {
        where: { isActive: true },
        statuses: [CONTRACT_STATUS.ACTIVE],
        orderBy: { name: "asc" },
        take: 50,
        include: { position: true },
      };
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      return (response.data || []).map((user) => ({
        value: user.id,
        label: user.name,
        description: user.position?.name,
      }));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching users:", error);
      }
      return [];
    }
  }, []);

  // Async query function for positions
  const queryPositions = useCallback(async (searchTerm: string) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        take: 50,
      };
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPositions(queryParams);
      return (response.data || []).map((position) => ({
        value: position.id,
        label: position.name,
      }));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching positions:", error);
      }
      return [];
    }
  }, []);

  const reasonOptions = useMemo(
    () =>
      [POSITION_CHANGE_REASON.PROMOTION, POSITION_CHANGE_REASON.TRANSFER, POSITION_CHANGE_REASON.DEMOTION].map((reason) => ({
        value: reason,
        label: POSITION_CHANGE_REASON_LABELS[reason],
      })),
    [],
  );

  const handleSubmit = async (data: PromoteFormData) => {
    const payload: UserPositionHistoryPromoteFormData = {
      userId: data.userId,
      toPositionId: data.toPositionId,
      reason: data.reason,
      note: data.note && data.note.trim().length > 0 ? data.note.trim() : undefined,
    };

    try {
      await promoteAsync(payload);
      // Success toast handled by the API client interceptor
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error toast handled by the API client interceptor
      if (process.env.NODE_ENV !== "production") {
        console.error("Error promoting user:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Promover Colaborador</DialogTitle>
          <DialogDescription>Altere o cargo do colaborador. A mudança é registrada no histórico de cargos.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            <FormCombobox
              name="userId"
              label="Colaborador"
              icon={<IconUser className="h-4 w-4 text-muted-foreground" />}
              async
              queryKey={["users", "promote-dialog"]}
              queryFn={queryUsers}
              minSearchLength={0}
              placeholder="Selecione o colaborador"
              emptyText="Nenhum colaborador encontrado"
              getOptionDescription={(option: any) => option.description}
              required
            />

            <FormCombobox
              name="toPositionId"
              label="Novo Cargo"
              icon={<IconBriefcase className="h-4 w-4 text-muted-foreground" />}
              async
              queryKey={["positions", "promote-dialog"]}
              queryFn={queryPositions}
              minSearchLength={0}
              placeholder="Selecione o cargo de destino"
              emptyText="Nenhum cargo encontrado"
              required
            />

            <FormCombobox
              name="reason"
              label="Motivo"
              icon={<IconTag className="h-4 w-4 text-muted-foreground" />}
              options={reasonOptions}
              placeholder="Selecione o motivo"
              searchable={false}
              required
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconNotes className="h-4 w-4 text-muted-foreground" />
                    Observação
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Observação sobre a mudança (opcional)" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPromoting}>
            Cancelar
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isPromoting}>
            {isPromoting ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
