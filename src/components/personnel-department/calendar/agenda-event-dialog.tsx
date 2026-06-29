// agenda-event-dialog.tsx
// Criação/edição de eventos da agenda com lembretes configuráveis:
// um único seletor múltiplo de lembretes ("No dia", N dias antes e aviso de
// atraso), canais (in-app, push, e-mail, WhatsApp) e alvos (setores/
// colaboradores — vazio = somente o criador recebe).
// Codificação em notifyDaysBefore (Int[]): 0 = no dia; N > 0 = N dias antes;
// -1 = atraso (1 dia após). notifyOnDay é derivado (= 0 ∈ seleção) apenas por
// compatibilidade com leitores legados.
// Sem toasts nas mutations — o interceptor do api-client já notifica.

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCalendarEvent } from "@tabler/icons-react";
import { z } from "zod";

import { NOTIFICATION_CHANNEL, NOTIFICATION_CHANNEL_LABELS, CONTRACT_STATUS } from "../../../constants";
import type { AgendaEvent } from "../../../types";
import { useAgendaEventMutations, useSectors, useUsers } from "../../../hooks";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";

// Opções fixas de lembrete. "No dia" (0) substitui o antigo toggle
// "Avisar no dia"; -1 é o aviso de atraso (1 dia após o evento).
const reminderLabel = (d: number): string => {
  if (d === 0) return "No dia";
  if (d === -1) return "Avisar atraso (1 dia após)";
  return d === 1 ? "1 dia antes" : `${d} dias antes`;
};
const NOTIFY_DAYS_OPTIONS: ComboboxOption[] = [0, 1, 3, 7, 15, 30, -1].map((d) => ({
  value: String(d),
  label: reminderLabel(d),
}));

const CHANNEL_OPTIONS: ComboboxOption[] = Object.values(NOTIFICATION_CHANNEL).map((c) => ({
  value: c,
  label: NOTIFICATION_CHANNEL_LABELS[c as NOTIFICATION_CHANNEL] ?? c,
}));

const agendaEventFormSchema = z.object({
  title: z.string().min(1, "O título é obrigatório").max(200, "Máximo de 200 caracteres"),
  description: z.string().max(1000, "Máximo de 1000 caracteres").optional().default(""),
  eventDate: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
  notifyDaysBefore: z.array(z.string()).default([]),
  channels: z.array(z.string()).min(1, "Selecione pelo menos um canal").default([NOTIFICATION_CHANNEL.IN_APP]),
  targetSectorIds: z.array(z.string()).default([]),
  targetUserIds: z.array(z.string()).default([]),
});

type AgendaEventFormInput = z.input<typeof agendaEventFormSchema>;

interface AgendaEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, o diálogo opera em modo edição. */
  editing?: AgendaEvent | null;
  /** Data inicial sugerida para novos eventos (ex.: dia clicado no calendário). */
  defaultDate?: Date | null;
}

export function AgendaEventDialog({ open, onOpenChange, editing, defaultDate }: AgendaEventDialogProps) {
  const isEdit = !!editing;
  const mutations = useAgendaEventMutations();

  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, take: 100 } as any);
  const { data: usersData } = useUsers({
    statuses: [CONTRACT_STATUS.ACTIVE],
    orderBy: { name: "asc" },
    limit: 100,
  } as any);

  const sectorOptions = useMemo<ComboboxOption[]>(
    () => (sectorsData?.data ?? []).map((s: any) => ({ value: s.id, label: s.name })),
    [sectorsData],
  );
  const userOptions = useMemo<ComboboxOption[]>(
    () => (usersData?.data ?? []).map((u: any) => ({ value: u.id, label: u.name })),
    [usersData],
  );

  const form = useForm<AgendaEventFormInput>({
    resolver: zodResolver(agendaEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      eventDate: new Date(),
      notifyDaysBefore: ["0"],
      channels: [NOTIFICATION_CHANNEL.IN_APP],
      targetSectorIds: [],
      targetUserIds: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && editing) {
      // Migração de leitura: eventos antigos guardavam "avisar no dia" no
      // boolean notifyOnDay — aqui ele vira o item 0 da seleção unificada.
      const reminders = new Set((editing.notifyDaysBefore ?? []).map(String));
      if (editing.notifyOnDay) reminders.add("0");
      form.reset({
        title: editing.title,
        description: editing.description ?? "",
        eventDate: new Date(editing.eventDate),
        notifyDaysBefore: Array.from(reminders),
        channels: (editing.channels ?? []).length > 0 ? editing.channels : [NOTIFICATION_CHANNEL.IN_APP],
        targetSectorIds: editing.targetSectorIds ?? [],
        targetUserIds: editing.targetUserIds ?? [],
      });
    } else {
      form.reset({
        title: "",
        description: "",
        eventDate: defaultDate ?? new Date(),
        // Paridade com o comportamento antigo (notifyOnDay default true).
        notifyDaysBefore: ["0"],
        channels: [NOTIFICATION_CHANNEL.IN_APP],
        targetSectorIds: [],
        targetUserIds: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, editing?.id]);

  // Eventos legados podem ter antecedências fora do conjunto fixo (2, 5 dias
  // etc.) — mantém essas opções visíveis no seletor para não "sumir" valores.
  const reminderOptions = useMemo<ComboboxOption[]>(() => {
    const known = new Set(NOTIFY_DAYS_OPTIONS.map((o) => o.value));
    const extras = (editing?.notifyDaysBefore ?? [])
      .map(String)
      .filter((v) => !known.has(v))
      .map((v) => ({ value: v, label: reminderLabel(Number(v)) }));
    return [...NOTIFY_DAYS_OPTIONS, ...extras];
  }, [editing]);

  const onSubmit = async (data: AgendaEventFormInput) => {
    const reminderValues = (data.notifyDaysBefore ?? []).map(Number);
    const payload = {
      title: data.title,
      description: data.description?.trim() ? data.description.trim() : null,
      eventDate: data.eventDate instanceof Date ? data.eventDate : new Date(data.eventDate as string),
      // Maior antecedência primeiro (atraso -1 por último).
      notifyDaysBefore: reminderValues.sort((a, b) => b - a),
      // Compatibilidade: o boolean legado espelha a opção "No dia" (0).
      notifyOnDay: reminderValues.includes(0),
      channels: (data.channels ?? []) as any,
      targetSectorIds: data.targetSectorIds ?? [],
      targetUserIds: data.targetUserIds ?? [],
    };

    try {
      if (isEdit && editing) {
        await mutations.updateAsync({ id: editing.id, data: payload as any });
      } else {
        await mutations.createAsync(payload as any);
      }
      onOpenChange(false);
    } catch {
      // Error toast é emitido pelo interceptor do axios.
    }
  };

  const isSubmitting = mutations.isCreating || mutations.isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendarEvent className="h-5 w-5" />
            {isEdit ? "Editar Evento da Agenda" : "Novo Evento da Agenda"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Título <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex.: Reunião geral, vencimento de contrato..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Data do evento <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput value={field.value as any} onChange={field.onChange} mode="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Canais <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        mode="multiple"
                        options={CHANNEL_OPTIONS}
                        value={field.value as string[]}
                        onValueChange={field.onChange}
                        placeholder="Selecione os canais"
                        emptyText="Nenhum canal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Detalhes do evento..." className="resize-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notifyDaysBefore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lembretes</FormLabel>
                  <FormControl>
                    <Combobox
                      mode="multiple"
                      options={reminderOptions}
                      value={field.value as string[]}
                      onValueChange={field.onChange}
                      placeholder='Ex.: "No dia", 7 e 1 dia antes'
                      emptyText="Nenhuma opção"
                    />
                  </FormControl>
                  <FormDescription>
                    "No dia" avisa na data do evento; "Avisar atraso" envia um aviso 1 dia após, caso o evento já tenha passado.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="targetSectorIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setores-alvo</FormLabel>
                    <FormControl>
                      <Combobox
                        mode="multiple"
                        options={sectorOptions}
                        value={field.value as string[]}
                        onValueChange={field.onChange}
                        placeholder="Todos vazios = só você"
                        emptyText="Nenhum setor"
                        searchable
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetUserIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colaboradores-alvo</FormLabel>
                    <FormControl>
                      <Combobox
                        mode="multiple"
                        options={userOptions}
                        value={field.value as string[]}
                        onValueChange={field.onChange}
                        placeholder="Todos vazios = só você"
                        emptyText="Nenhum colaborador"
                        searchable
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormDescription>
              Sem setores e sem colaboradores selecionados, apenas você (criador) recebe os lembretes.
            </FormDescription>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : isEdit ? "Atualizar" : "Criar Evento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
