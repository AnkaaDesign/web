import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, subDays } from "date-fns";
import {
  IconCalendar,
  IconCheck,
  IconCircleX,
  IconUsers,
} from "@tabler/icons-react";
import { z } from "zod";

import type { User } from "../../../../types";
import { userService } from "../../../../api-client";
import { useCreateAssinaturaForUsers } from "../../../../hooks";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const ALL_OPTION_ID = "__ALL__";

const schema = z
  .object({
    userIds: z.array(z.string()).default([]),
    startDate: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v : new Date(v))),
    endDate: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v : new Date(v))),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "A data final deve ser posterior ou igual à data inicial",
    path: ["endDate"],
  })
  .refine((d) => d.userIds.length > 0, {
    message: "Selecione ao menos um colaborador",
    path: ["userIds"],
  });

type FormInput = z.input<typeof schema>;

interface ResultRow {
  userId: string;
  userName: string;
  ok: boolean;
  apuracaoId?: number;
  error?: string;
}

interface AssinaturaCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssinaturaCreateModal({ open, onOpenChange }: AssinaturaCreateModalProps) {
  const createMut = useCreateAssinaturaForUsers();
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const defaultPeriod = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      startDate: subDays(today, 4),
      endDate: today,
    };
  }, []);

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      userIds: [],
      startDate: defaultPeriod.startDate,
      endDate: defaultPeriod.endDate,
    },
  });

  // Reset form + results whenever the modal is reopened.
  useEffect(() => {
    if (open) {
      setResults(null);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      form.reset({
        userIds: [],
        startDate: subDays(today, 4),
        endDate: today,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedIds = form.watch("userIds") ?? [];
  const isCollective = selectedIds.includes(ALL_OPTION_ID);

  // Searchable user picker scoped to Secullum-linked users. The first page
  // prepends a synthetic "Todos os colaboradores" option so users can pick
  // it like any other entry.
  const userQueryFn = useCallback(async (search: string, page: number = 1) => {
    const params: any = {
      page,
      take: 50,
      where: { isActive: true, secullumEmployeeId: { not: null } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        secullumEmployeeId: true,
        position: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
      },
    };
    if (search?.trim()) params.searchingFor = search.trim();
    const response = await userService.getUsers(params);
    const filtered = (response.data || []).filter(
      (u: any) => u.secullumEmployeeId != null,
    );

    const allOption: User = {
      id: ALL_OPTION_ID,
      name: "Todos os colaboradores",
    } as User;

    const term = search?.trim().toLowerCase() ?? "";
    const allMatches = !term || "todos os colaboradores".includes(term);
    const data: User[] = page === 1 && allMatches
      ? [allOption, ...filtered]
      : filtered;

    return { data, hasMore: response.meta?.hasNextPage || false };
  }, []);

  const handleSelectionChange = useCallback(
    (next: string[]) => {
      const wasAll = selectedIds.includes(ALL_OPTION_ID);
      const hasAll = next.includes(ALL_OPTION_ID);
      // If "Todos" was just added, drop everything else; if other options
      // were added while "Todos" was already selected, drop "Todos".
      if (hasAll && !wasAll) {
        form.setValue("userIds", [ALL_OPTION_ID], { shouldValidate: true });
        return;
      }
      if (hasAll && wasAll && next.length > 1) {
        form.setValue(
          "userIds",
          next.filter((id) => id !== ALL_OPTION_ID),
          { shouldValidate: true },
        );
        return;
      }
      form.setValue("userIds", next, { shouldValidate: true });
    },
    [form, selectedIds],
  );

  const onSubmit = async (raw: FormInput) => {
    setResults(null);
    const startDate =
      raw.startDate instanceof Date ? raw.startDate : new Date(raw.startDate);
    const endDate =
      raw.endDate instanceof Date ? raw.endDate : new Date(raw.endDate);

    const userIds = raw.userIds ?? [];
    const sendAll = userIds.includes(ALL_OPTION_ID);
    try {
      const response = await createMut.mutateAsync({
        ...(sendAll ? { applyToAll: true } : { userIds }),
        DataInicio: format(startDate, "yyyy-MM-dd"),
        DataFim: format(endDate, "yyyy-MM-dd"),
      });
      const r = response.data?.data;
      if (r?.results?.length) setResults(r.results);
      // If everything succeeded, close the modal so the user sees the new batches in the list.
      if (r && r.failed === 0 && (r.created ?? 0) > 0) {
        onOpenChange(false);
      }
    } catch {
      // Toast is shown by the mutation's onError; nothing else to do here.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!createMut.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Apuração para Assinatura</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userIds"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <IconUsers className="h-4 w-4" />
                    Colaboradores <span className="text-destructive">*</span>
                    {selectedIds.length > 0 && !isCollective && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        ({selectedIds.length} selecionado{selectedIds.length === 1 ? "" : "s"})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      mode="multiple"
                      async
                      queryKey={["assinatura-create-users"]}
                      value={field.value}
                      onValueChange={(v) =>
                        handleSelectionChange(Array.isArray(v) ? v : v ? [v] : [])
                      }
                      placeholder="Buscar colaboradores..."
                      emptyText="Nenhum colaborador vinculado ao Secullum"
                      queryFn={userQueryFn}
                      minSearchLength={0}
                      getOptionLabel={(u: User) => u.name}
                      getOptionValue={(u: User) => u.id}
                      renderOption={(u: User) => {
                        if (u.id === ALL_OPTION_ID) {
                          return (
                            <div>
                              <p className="font-medium">Todos os colaboradores</p>
                              <p className="text-xs text-muted-foreground">
                                Envia para todos os colaboradores ativos vinculados ao Secullum
                              </p>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              {u.position?.name && <span>{u.position.name}</span>}
                              {u.sector?.name && <span>· {u.sector.name}</span>}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Início do período <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput
                        value={field.value as any}
                        onChange={field.onChange}
                        mode="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Fim do período <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput
                        value={field.value as any}
                        onChange={field.onChange}
                        mode="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {results && results.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="px-4 py-2 border-b border-border bg-muted/40 text-sm font-medium">
                  Resultado
                </div>
                <ul className="divide-y divide-border max-h-48 overflow-auto">
                  {results.map((r) => (
                    <li
                      key={r.userId}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {r.ok ? (
                          <IconCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <IconCircleX className="h-4 w-4 text-destructive flex-shrink-0" />
                        )}
                        <span className="truncate">{r.userName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground ml-3 truncate">
                        {r.ok
                          ? r.apuracaoId
                            ? `Apuração #${r.apuracaoId}`
                            : "OK"
                          : (r.error ?? "Falhou")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMut.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending
                  ? "Enviando..."
                  : isCollective
                    ? "Enviar para todos"
                    : "Enviar para selecionados"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
