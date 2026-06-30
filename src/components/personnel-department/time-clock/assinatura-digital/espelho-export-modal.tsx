import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  IconCalendar,
  IconFileTypePdf,
  IconFileZip,
  IconLoader2,
  IconUsers,
} from "@tabler/icons-react";
import { z } from "zod";

import type { User } from "../../../../types";
import { secullumService } from "../../../../api-client";
import { getUsers } from "@/api-client/user";
import {
  parseSecullumCalculations,
  type BuildHtmlOptions,
} from "@/components/personnel-department/time-clock-entry/time-clock-entry-edit-export";
import { createEspelhoRenderer } from "@/utils/espelho-ponto-pdf-generator";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const ALL_OPTION_ID = "__ALL__";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

// Start of the cartão-ponto cycle: the 26th of the month before `ref`.
function cartaoPontoStart(ref: Date): Date {
  const d = new Date(ref);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  d.setDate(26);
  d.setHours(0, 0, 0, 0);
  return d;
}

// The cartão-ponto cycle is fixed at 26 → 25, so the "month" mode only needs the
// cycle's end month. A period value is "YYYY-MM" of that end month.
//   DataInicio     = 26th of the previous month
//   end (last day) = 25th of that month
function periodEndBoundary(periodValue: string): Date {
  const [y, m] = periodValue.split("-").map(Number);
  return new Date(y, m - 1, 26, 0, 0, 0, 0);
}

function periodEndLastDay(periodValue: string): Date {
  const [y, m] = periodValue.split("-").map(Number);
  return new Date(y, m - 1, 25, 0, 0, 0, 0);
}

function periodRangeLabel(periodValue: string): string {
  if (!periodValue) return "";
  const firstDay = cartaoPontoStart(periodEndBoundary(periodValue));
  const lastDay = periodEndLastDay(periodValue);
  return `${format(firstDay, "dd/MM/yyyy")} a ${format(lastDay, "dd/MM/yyyy")}`;
}

// Only cycles that have already closed (their 26th boundary has passed) are
// offered — future/open months have no data yet, so they're left out entirely.
function buildPeriodOptions(): { value: string; label: string; description?: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = new Date(today.getFullYear(), today.getMonth(), 1);
  const opts: { value: string; label: string; description?: string }[] = [];
  for (let off = 1; off >= -15; off--) {
    const d = new Date(base.getFullYear(), base.getMonth() + off, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const closed = periodEndBoundary(value).getTime() <= today.getTime();
    if (!closed) continue;
    opts.push({
      value,
      label: `${MESES[d.getMonth()]}/${d.getFullYear()}`,
      description: periodRangeLabel(value),
    });
  }
  return opts;
}

const schema = z
  .object({
    userIds: z.array(z.string()).default([]),
    periodMode: z.enum(["month", "custom"]).default("month"),
    period: z.string().default(""),
    customStart: z.date().optional(),
    customEnd: z.date().optional(),
    output: z.enum(["zip", "single"]).default("zip"),
  })
  .refine((d) => d.userIds.length > 0, {
    message: "Selecione ao menos um colaborador",
    path: ["userIds"],
  })
  .refine((d) => d.periodMode !== "month" || !!d.period, {
    message: "Selecione um período",
    path: ["period"],
  })
  .refine((d) => d.periodMode !== "custom" || (!!d.customStart && !!d.customEnd), {
    message: "Selecione a data inicial e a final",
    path: ["customStart"],
  })
  .refine(
    (d) => d.periodMode !== "custom" || !d.customStart || !d.customEnd || d.customEnd >= d.customStart,
    {
      message: "A data final deve ser igual ou posterior à inicial",
      path: ["customEnd"],
    },
  );

type FormInput = z.input<typeof schema>;

// HH:mm:ss → HH:mm (Secullum returns full-precision times on the flattened horário).
function trimTime(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s === "00:00" || s === "00:00:00") return "";
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return s;
}

// Strip accents/illegal characters so the name is safe as a file/zip-entry name.
function sanitizeFilename(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, " ")
      .trim() || "colaborador"
  );
}

// "<Nome> - <Matrícula>.pdf", de-duplicated within the zip.
function pdfFilename(user: User, used: Set<string>): string {
  const mat = user.payrollNumber != null ? ` - ${user.payrollNumber}` : "";
  const base = sanitizeFilename(`${user.name}${mat}`);
  let name = `${base}.pdf`;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base} (${n}).pdf`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Single-date popover field. Closing on selection is the intended behaviour here
// (one click = one date) — the start and end are picked independently.
function DateField({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <IconCalendar className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          {...({
            mode: "single",
            selected: value,
            defaultMonth: value,
            onSelect: (d: Date | undefined) => {
              onChange(d ?? undefined);
              setOpen(false);
            },
            initialFocus: true,
          } as any)}
        />
      </PopoverContent>
    </Popover>
  );
}

interface EspelhoExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EspelhoExportModal({ open, onOpenChange }: EspelhoExportModalProps) {
  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const defaultPeriod = useMemo(() => periodOptions[0]?.value ?? "", [periodOptions]);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      userIds: [],
      periodMode: "month",
      period: defaultPeriod,
      customStart: undefined,
      customEnd: undefined,
      output: "zip",
    },
  });

  useEffect(() => {
    if (open) {
      setExporting(false);
      setProgress({ current: 0, total: 0 });
      form.reset({
        userIds: [],
        periodMode: "month",
        period: defaultPeriod,
        customStart: undefined,
        customEnd: undefined,
        output: "zip",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedIds = form.watch("userIds") ?? [];
  const periodMode = form.watch("periodMode");
  const output = form.watch("output");
  const isAll = selectedIds.includes(ALL_OPTION_ID);

  // Searchable user picker scoped to Secullum-linked, non-dismissed employees.
  const userQueryFn = useCallback(async (search: string, page: number = 1) => {
    const response = await secullumService.getAssinaturaEligibleUsers({
      search: search?.trim() || undefined,
      page,
      take: 50,
    });
    const filtered = (response.data?.data ?? []) as unknown as User[];
    const allOption: User = { id: ALL_OPTION_ID, name: "Todos os colaboradores" } as User;
    const term = search?.trim().toLowerCase() ?? "";
    const synthetic: User[] =
      page === 1 && (!term || "todos os colaboradores".includes(term)) ? [allOption] : [];
    return { data: [...synthetic, ...filtered], hasMore: response.data?.meta?.hasNextPage || false };
  }, []);

  const handleSelectionChange = useCallback(
    (next: string[]) => {
      const wasAll = selectedIds.includes(ALL_OPTION_ID);
      const addedAll = next.includes(ALL_OPTION_ID) && !wasAll;
      if (addedAll) {
        form.setValue("userIds", [ALL_OPTION_ID], { shouldValidate: true });
        return;
      }
      if (wasAll && next.length > 1) {
        form.setValue("userIds", next.filter((id) => id !== ALL_OPTION_ID), { shouldValidate: true });
        return;
      }
      form.setValue("userIds", next, { shouldValidate: true });
    },
    [form, selectedIds],
  );

  // Resolve the concrete list of user IDs. When "Todos" is selected we page
  // through every eligible (Secullum-linked) collaborator.
  const resolveUserIds = useCallback(async (rawIds: string[]): Promise<string[]> => {
    if (!rawIds.includes(ALL_OPTION_ID)) return rawIds;
    const ids: string[] = [];
    let page = 1;
    while (page <= 40) {
      const resp = await secullumService.getAssinaturaEligibleUsers({ page, take: 100 });
      const batch = (resp.data?.data ?? []) as unknown as { id: string }[];
      ids.push(...batch.map((u) => u.id));
      if (!resp.data?.meta?.hasNextPage) break;
      page += 1;
    }
    return ids;
  }, []);

  const onSubmit = async (raw: FormInput) => {
    // Derive the export window from whichever period mode is active.
    let startDate: Date;
    let endDate: Date;
    let tag: string;
    if (raw.periodMode === "custom") {
      startDate = raw.customStart as Date;
      endDate = raw.customEnd as Date;
      tag = `${format(startDate, "yyyy-MM-dd")}_a_${format(endDate, "yyyy-MM-dd")}`;
    } else {
      startDate = cartaoPontoStart(periodEndBoundary(raw.period as string));
      endDate = periodEndLastDay(raw.period as string);
      tag = raw.period as string;
    }
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");

    setExporting(true);
    const loadingId = toast.loading("Preparando espelhos de ponto…");
    try {
      const userIds = await resolveUserIds(raw.userIds ?? []);
      if (userIds.length === 0) {
        toast.dismiss(loadingId);
        toast.error("Nenhum colaborador para exportar");
        setExporting(false);
        return;
      }

      // Full user records (cpf/pis/matrícula/admissão + position/sector) for the header.
      const usersResp = await getUsers({
        where: { id: { in: userIds } },
        include: { position: true, sector: true, currentContract: true },
        take: userIds.length,
      });
      const users = (usersResp.data ?? []) as User[];
      const userById = new Map(users.map((u) => [u.id, u]));
      const orderedUsers = userIds.map((id) => userById.get(id)).filter(Boolean) as User[];

      // Fetch Secullum employees + horários once and reuse across all collaborators.
      const [empResp, horResp] = await Promise.all([
        secullumService.getEmployees(),
        secullumService.getHorarios({ incluirDesativados: true }),
      ]);
      const empList: any[] = (empResp?.data as any)?.data ?? [];
      const horList: any[] = (horResp?.data as any)?.data ?? [];
      const horarioIdByEmp = new Map<string, any>();
      empList.forEach((e: any) => horarioIdByEmp.set(String(e?.Id), e?.HorarioId));
      const horById = new Map<string, any>();
      horList.forEach((h: any) => horById.set(String(h?.Id), h));

      const resolveHorario = (user: User): BuildHtmlOptions["horario"] => {
        if (!user.secullumEmployeeId) return null;
        const horarioId = horarioIdByEmp.get(String(user.secullumEmployeeId));
        if (!horarioId) return null;
        const h = horById.get(String(horarioId));
        if (!h) return null;
        return {
          entrada1: trimTime(h.Entrada1),
          saida1: trimTime(h.Saida1),
          entrada2: trimTime(h.Entrada2),
          saida2: trimTime(h.Saida2),
          entrada3: trimTime(h.Entrada3),
          saida3: trimTime(h.Saida3),
          cargaDiaria: trimTime(h.CargaHorariaDiaria),
          cargaSemanal: trimTime(h.CargaHorariaSemanal),
          descricao: h.Descricao || h.Codigo || undefined,
        };
      };

      setProgress({ current: 0, total: orderedUsers.length });

      // Vector PDF renderer (real, selectable text). Assets loaded once and reused.
      const renderer = await createEspelhoRenderer();
      const single = raw.output === "single" ? renderer.newDoc() : null;
      let zip: any = null;
      const usedNames = new Set<string>();
      if (raw.output === "zip") {
        const JSZip = (await import("jszip")).default;
        zip = new JSZip();
      }

      let made = 0;
      const skipped: string[] = [];
      for (let i = 0; i < orderedUsers.length; i++) {
        const user = orderedUsers[i];
        try {
          const calcResp = await secullumService.getCalculations({
            userId: user.id,
            startDate: startStr,
            endDate: endStr,
            page: 1,
            take: 100,
          });
          const { rows, totals } = parseSecullumCalculations(calcResp?.data);
          if (rows.length > 0) {
            const item: BuildHtmlOptions = {
              user,
              startDate,
              endDate,
              rows,
              totals,
              horario: resolveHorario(user),
            };
            if (single) {
              if (made > 0) renderer.addPage(single);
              renderer.drawPage(single, item);
            } else {
              const doc = renderer.newDoc();
              renderer.drawPage(doc, item);
              zip.file(pdfFilename(user, usedNames), doc.output("blob"));
            }
            made += 1;
          } else {
            skipped.push(user.name);
          }
        } catch {
          skipped.push(user.name);
        }
        setProgress({ current: i + 1, total: orderedUsers.length });
      }

      if (made === 0) {
        toast.dismiss(loadingId);
        toast.error("Nenhum registro encontrado para o período selecionado");
        setExporting(false);
        return;
      }

      if (single) {
        triggerDownload(single.output("blob"), `espelhos-de-ponto-${tag}.pdf`);
      } else {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, `espelhos-de-ponto-${tag}.zip`);
      }

      toast.dismiss(loadingId);
      const base = `${made} espelho${made === 1 ? "" : "s"} gerado${made === 1 ? "" : "s"}`;
      toast.success(
        skipped.length > 0 ? `${base} — ${skipped.length} sem registros ignorados` : `${base} — download iniciado`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error((err as any)?.message || "Erro ao gerar os espelhos de ponto");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!exporting) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar Espelho de Ponto</DialogTitle>
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
                    {selectedIds.length > 0 && !isAll && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        ({selectedIds.length} selecionado{selectedIds.length === 1 ? "" : "s"})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      mode="multiple"
                      async
                      queryKey={["espelho-export-users"]}
                      value={field.value}
                      onValueChange={(v) =>
                        handleSelectionChange(Array.isArray(v) ? v : v ? [v] : [])
                      }
                      placeholder="Buscar colaboradores..."
                      emptyText="Nenhum colaborador vinculado ao Secullum"
                      queryFn={userQueryFn}
                      minSearchLength={0}
                      disabled={exporting}
                      getOptionLabel={(u: User) => u.name}
                      getOptionValue={(u: User) => u.id}
                      renderOption={(u: User) => {
                        if (u.id === ALL_OPTION_ID) {
                          return (
                            <div>
                              <p className="font-medium">Todos os colaboradores</p>
                              <p className="text-xs text-muted-foreground">
                                Exporta o espelho de todos os colaboradores vinculados ao Secullum
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

            {/* Period: closed-month preset (default) or a custom date range. */}
            <FormItem className="flex flex-col">
              <FormLabel className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Período <span className="text-destructive">*</span>
              </FormLabel>
              <div className="inline-flex w-fit rounded-md border border-input p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={periodMode === "month" ? "default" : "ghost"}
                  className="h-7"
                  disabled={exporting}
                  onClick={() => form.setValue("periodMode", "month", { shouldValidate: true })}
                >
                  Mês fechado
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={periodMode === "custom" ? "default" : "ghost"}
                  className="h-7"
                  disabled={exporting}
                  onClick={() => form.setValue("periodMode", "custom", { shouldValidate: true })}
                >
                  Datas personalizadas
                </Button>
              </div>

              {periodMode === "month" ? (
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Combobox
                          mode="single"
                          options={periodOptions}
                          value={field.value}
                          onValueChange={(v) => field.onChange((Array.isArray(v) ? v[0] : v) ?? "")}
                          placeholder="Selecione o mês"
                          searchPlaceholder="Buscar mês..."
                          emptyText="Nenhum período fechado disponível"
                          clearable={false}
                          disabled={exporting}
                        />
                      </FormControl>
                      <FormDescription>
                        O cartão-ponto vai do dia 26 ao 25
                        {field.value ? ` (${periodRangeLabel(field.value)})` : ""}.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="customStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Data inicial</FormLabel>
                          <FormControl>
                            <DateField
                              value={field.value}
                              onChange={(d) => field.onChange(d)}
                              placeholder="Início"
                              disabled={exporting}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Data final</FormLabel>
                          <FormControl>
                            <DateField
                              value={field.value}
                              onChange={(d) => field.onChange(d)}
                              placeholder="Fim"
                              disabled={exporting}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {(form.formState.errors.customStart || form.formState.errors.customEnd) && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.customStart?.message ||
                        form.formState.errors.customEnd?.message}
                    </p>
                  )}
                </div>
              )}
            </FormItem>

            {/* Output format. */}
            <FormItem className="flex flex-col">
              <FormLabel>Formato do download</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => form.setValue("output", "zip")}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                    output === "zip" ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40",
                  )}
                >
                  <IconFileZip className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Um PDF por colaborador</p>
                    <p className="text-xs text-muted-foreground">Baixa um arquivo .zip</p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => form.setValue("output", "single")}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                    output === "single" ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40",
                  )}
                >
                  <IconFileTypePdf className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">PDF único</p>
                    <p className="text-xs text-muted-foreground">Várias páginas em um arquivo</p>
                  </div>
                </button>
              </div>
            </FormItem>

            {exporting && (
              <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                <IconLoader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Gerando espelhos de ponto…</p>
                  <p className="text-xs text-muted-foreground">
                    Renderizando o cartão de cada colaborador. Não feche esta janela.
                  </p>
                </div>
                {progress.total > 0 && (
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums shrink-0">
                    {progress.current}/{progress.total}
                  </span>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={exporting}>
                {output === "zip" ? (
                  <IconFileZip className="h-4 w-4 mr-2" />
                ) : (
                  <IconFileTypePdf className="h-4 w-4 mr-2" />
                )}
                {exporting ? "Gerando..." : output === "zip" ? "Baixar .zip" : "Baixar PDF"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
