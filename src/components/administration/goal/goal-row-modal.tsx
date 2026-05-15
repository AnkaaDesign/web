import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { useSectors } from "@/hooks";
import { useUpsertGoalYear } from "@/hooks/administration/use-goal";
import {
  GOAL_METRIC,
  GOAL_METRIC_LABELS,
  GOAL_METRIC_DESCRIPTIONS,
  SECTOR_SCOPED_GOAL_METRICS,
} from "@/constants";

// Domain grouping for the metric picker. Keeping this here (and not in the
// enum module) so the admin UI controls its own ordering without imposing
// presentation concerns on the data layer.
const METRIC_GROUPS: Array<{ label: string; metrics: GOAL_METRIC[] }> = [
  {
    label: "Produção",
    metrics: [
      GOAL_METRIC.TASKS_COMPLETED,
      GOAL_METRIC.TASKS_PER_ACTIVE_USER,
      GOAL_METRIC.PRODUCTION_AVG_PERFORMANCE,
    ],
  },
  {
    label: "Recursos Humanos",
    metrics: [
      GOAL_METRIC.COLLABORATORS_PER_SECTOR,
      GOAL_METRIC.HR_HIRES_PER_MONTH,
      GOAL_METRIC.HR_DISMISSALS_PER_MONTH,
      GOAL_METRIC.HR_TURNOVER_RATE,
      GOAL_METRIC.HR_EXPERIENCE_FAILURE_RATE,
      GOAL_METRIC.HR_ABSENTEEISM_RATE,
      GOAL_METRIC.HR_PAYROLL_GROSS,
      GOAL_METRIC.HR_PAYROLL_BONUSES_TOTAL,
    ],
  },
  {
    label: "Financeiro",
    metrics: [
      GOAL_METRIC.INVOICES_PAID,
      GOAL_METRIC.FINANCE_DSO_DAYS,
      GOAL_METRIC.FINANCE_OVERDUE_AMOUNT,
      GOAL_METRIC.FINANCE_COLLECTION_RATE,
      GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD,
      GOAL_METRIC.FINANCE_CONVERSION_RATE,
    ],
  },
  {
    label: "Pedidos & Estoque",
    metrics: [
      GOAL_METRIC.ORDER_COUNT_PER_PERIOD,
      GOAL_METRIC.ORDER_TOTAL_VALUE,
      GOAL_METRIC.INVENTORY_CONSUMPTION_VALUE,
      GOAL_METRIC.INVENTORY_OUTBOUND_VALUE,
    ],
  },
];

const isSectorScoped = (m: GOAL_METRIC) =>
  (SECTOR_SCOPED_GOAL_METRICS as readonly string[]).includes(m);

const formSchema = z
  .object({
    metric: z.nativeEnum(GOAL_METRIC),
    sectorId: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (isSectorScoped(data.metric) && !data.sectorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectorId"],
        message: "Selecione um setor",
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

interface GoalRowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  /** (metric, sectorId) pairs already present in the grid for `year`. */
  existingRows: Array<{ metric: GOAL_METRIC; sectorId: string | null }>;
}

export function GoalRowModal({ open, onOpenChange, year, existingRows }: GoalRowModalProps) {
  const upsertYear = useUpsertGoalYear();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { metric: GOAL_METRIC.TASKS_COMPLETED, sectorId: null },
  });

  useEffect(() => {
    if (open) {
      form.reset({ metric: GOAL_METRIC.TASKS_COMPLETED, sectorId: null });
    }
  }, [open, form]);

  const metric = form.watch("metric");
  const sectorId = form.watch("sectorId");
  const requiresSector = isSectorScoped(metric);

  const { data: sectorsData } = useSectors(
    requiresSector ? { orderBy: { name: "asc" }, limit: 100 } : undefined,
  );

  const sectorOptions: ComboboxOption[] = useMemo(() => {
    const taken = new Set(
      existingRows.filter(r => r.metric === metric && r.sectorId).map(r => r.sectorId as string),
    );
    return (sectorsData?.data ?? []).map(s => ({
      value: s.id,
      label: taken.has(s.id) ? `${s.name} (já existe)` : s.name,
      disabled: taken.has(s.id),
    }));
  }, [sectorsData, existingRows, metric]);

  const conflictingCompanyWide =
    !requiresSector &&
    existingRows.some(r => r.metric === metric && r.sectorId === null);

  const handleSubmit = async (data: FormData) => {
    if (conflictingCompanyWide) {
      toast.error("Esta métrica já existe para o ano.");
      return;
    }
    try {
      await upsertYear.mutateAsync({
        metric: data.metric,
        year,
        sectorId: data.sectorId ?? null,
        values: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, targetValue: 0 })),
      });
      toast.success("Métrica adicionada.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao adicionar métrica.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Adicionar métrica</DialogTitle>
          <DialogDescription>
            Os 12 períodos do ano {year} começam com meta zerada. Edite cada célula na tabela com
            duplo clique.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="metric"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Métrica</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={value => {
                        field.onChange(value);
                        if (!isSectorScoped(value as GOAL_METRIC)) {
                          form.setValue("sectorId", null);
                        }
                      }}
                      className="max-h-[60vh] space-y-4 overflow-y-auto pr-2"
                    >
                      {METRIC_GROUPS.map(group => (
                        <div key={group.label} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </p>
                          <div className="grid gap-2">
                            {group.metrics.map(m => (
                              <Label
                                key={m}
                                htmlFor={`metric-${m}`}
                                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-accent/30"
                              >
                                <RadioGroupItem id={`metric-${m}`} value={m} className="mt-0.5" />
                                <div className="space-y-0.5">
                                  <div className="text-sm font-medium leading-none">{GOAL_METRIC_LABELS[m]}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {GOAL_METRIC_DESCRIPTIONS[m]}
                                  </div>
                                </div>
                              </Label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {requiresSector && (
              <FormField
                control={form.control}
                name="sectorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value ?? undefined}
                        onValueChange={v => field.onChange(v || null)}
                        options={sectorOptions}
                        placeholder="Selecione um setor"
                        searchable={sectorOptions.length > 10}
                        clearable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {conflictingCompanyWide && (
              <p className="text-sm text-destructive">
                Esta métrica já existe para o ano {year}.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  upsertYear.isPending ||
                  conflictingCompanyWide ||
                  (requiresSector && !sectorId)
                }
              >
                {upsertYear.isPending ? "Adicionando…" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
