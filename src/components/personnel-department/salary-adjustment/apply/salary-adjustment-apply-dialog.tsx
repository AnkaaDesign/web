import React, { useState, useCallback, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormCombobox } from "@/components/ui/form-combobox";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconPercentage, IconAlertTriangle, IconCalendar, IconTag, IconBriefcase, IconNotes, IconLoader2 } from "@tabler/icons-react";
import { getPositions } from "../../../../api-client";
import { formatCurrency } from "../../../../utils";
import { SALARY_ADJUSTMENT_TYPE, SALARY_ADJUSTMENT_TYPE_LABELS } from "../../../../constants";
import { useSalaryAdjustmentMutations } from "../../../../hooks/personnel-department/use-salary-adjustment";
import type { SalaryAdjustmentApplyFormData } from "../../../../schemas/salary-adjustment";
import type { Position } from "../../../../types";

// =====================
// Local form schema (mode is UI-only; payload is built on submit)
// =====================

const applyFormSchema = z
  .object({
    type: z.enum(Object.values(SALARY_ADJUSTMENT_TYPE) as [string, ...string[]], {
      errorMap: () => ({ message: "Tipo de reajuste inválido" }),
    }),
    mode: z.enum(["percentage", "custom"]),
    percentage: z
      .number({ invalid_type_error: "Percentual inválido" })
      .min(-100, "Percentual não pode ser menor que -100%")
      .max(1000, "Percentual não pode ser maior que 1000%")
      .nullable()
      .optional(),
    positionIds: z.array(z.string()).min(1, "Selecione pelo menos um cargo"),
    customValues: z
      .array(
        z.object({
          positionId: z.string(),
          newValue: z.number().nullable(),
        }),
      )
      .optional(),
    effectiveDate: z.date().nullable().optional(),
    note: z.string().max(1000, "Observação deve ter no máximo 1000 caracteres").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "percentage") {
      if (data.percentage === null || data.percentage === undefined || Number.isNaN(data.percentage)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentage"], message: "Percentual é obrigatório" });
      } else if (data.percentage === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentage"], message: "Percentual não pode ser zero" });
      }
    } else {
      (data.customValues || []).forEach((customValue, index) => {
        if (customValue.newValue === null || customValue.newValue === undefined || customValue.newValue <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["customValues", index, "newValue"],
            message: "Informe um valor maior que zero",
          });
        }
      });
    }
  });

type ApplyFormData = z.infer<typeof applyFormSchema>;

interface SalaryAdjustmentApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalaryAdjustmentApplyDialog({ open, onOpenChange }: SalaryAdjustmentApplyDialogProps) {
  const { applyAsync, isApplying } = useSalaryAdjustmentMutations();

  // Cache of full Position objects (for names + current remuneration preview)
  const [positionCache, setPositionCache] = useState<Record<string, Position>>({});

  const form = useForm<ApplyFormData>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      type: SALARY_ADJUSTMENT_TYPE.DISSIDIO_CCT,
      mode: "percentage",
      percentage: null,
      positionIds: [],
      customValues: [],
      effectiveDate: null,
      note: "",
    },
  });

  const mode = useWatch({ control: form.control, name: "mode" });
  const watchedPercentage = useWatch({ control: form.control, name: "percentage" });
  const positionIds = useWatch({ control: form.control, name: "positionIds" }) || [];
  const customValues = useWatch({ control: form.control, name: "customValues" }) || [];

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  // Keep customValues rows in sync with the selected positions
  React.useEffect(() => {
    const current = form.getValues("customValues") || [];
    const next = positionIds.map((positionId) => {
      const existing = current.find((customValue) => customValue.positionId === positionId);
      if (existing) return existing;
      const cached = positionCache[positionId];
      return { positionId, newValue: cached?.remuneration ?? null };
    });
    const changed = next.length !== current.length || next.some((entry, index) => entry.positionId !== current[index]?.positionId);
    if (changed) {
      form.setValue("customValues", next, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionIds.join(","), positionCache]);

  // Fetch any selected positions missing from the cache (e.g. restored form state)
  React.useEffect(() => {
    const missing = positionIds.filter((id) => !positionCache[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await getPositions({ where: { id: { in: missing } }, limit: missing.length } as any);
        if (cancelled) return;
        const fetched = response.data || [];
        if (fetched.length > 0) {
          setPositionCache((previous) => {
            const next = { ...previous };
            fetched.forEach((position) => {
              next[position.id] = position;
            });
            return next;
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Error fetching selected positions:", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionIds.join(",")]);

  // Async query function for the positions combobox — caches the full objects
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
      const positions = response.data || [];

      setPositionCache((previous) => {
        const next = { ...previous };
        positions.forEach((position) => {
          next[position.id] = position;
        });
        return next;
      });

      return positions.map((position) => ({
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

  const typeOptions = useMemo(
    () =>
      Object.entries(SALARY_ADJUSTMENT_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const getCurrentSalary = (positionId: string): number => {
    const position = positionCache[positionId];
    return position?.remuneration ?? position?.monetaryValues?.[0]?.value ?? 0;
  };

  // Live before/after preview per selected position (percentage mode)
  const percentValue = typeof watchedPercentage === "number" && !Number.isNaN(watchedPercentage) ? watchedPercentage : 0;
  const previewSalaries = positionIds.map((positionId) => {
    const currentSalary = getCurrentSalary(positionId);
    const adjustment = currentSalary * (percentValue / 100);
    return {
      positionId,
      positionName: positionCache[positionId]?.name ?? "...",
      currentSalary,
      newSalary: currentSalary + adjustment,
    };
  });
  const hasPositionsWithoutSalary = previewSalaries.some((preview) => preview.currentSalary === 0);

  const handleSubmit = async (data: ApplyFormData) => {
    const payload: SalaryAdjustmentApplyFormData = {
      type: data.type,
      positionIds: data.positionIds,
      percentage: data.mode === "percentage" ? data.percentage : null,
      customValues:
        data.mode === "custom"
          ? (data.customValues || []).map((customValue) => ({
              positionId: customValue.positionId,
              newValue: customValue.newValue as number,
            }))
          : undefined,
      effectiveDate: data.effectiveDate ?? undefined,
      note: data.note && data.note.trim().length > 0 ? data.note.trim() : undefined,
    };

    try {
      await applyAsync(payload);
      // Success toast handled by the API client interceptor
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error toast handled by the API client interceptor
      if (process.env.NODE_ENV !== "production") {
        console.error("Error applying salary adjustment:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar Reajuste Salarial</DialogTitle>
          <DialogDescription>Reajuste a remuneração dos cargos selecionados por percentual ou com valores personalizados por cargo.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            {/* Type */}
            <FormCombobox
              name="type"
              label="Tipo de Reajuste"
              icon={<IconTag className="h-4 w-4 text-muted-foreground" />}
              options={typeOptions}
              placeholder="Selecione o tipo de reajuste"
              required
              searchable={false}
            />

            {/* Positions (multiple, async) */}
            <FormCombobox
              name="positionIds"
              label="Cargos"
              icon={<IconBriefcase className="h-4 w-4 text-muted-foreground" />}
              async
              multiple
              queryKey={["positions", "salary-adjustment-apply"]}
              queryFn={queryPositions}
              minSearchLength={0}
              placeholder="Selecione os cargos"
              emptyText="Nenhum cargo encontrado"
              required
            />

            {/* Mode toggle: percentage vs custom values */}
            <div className="space-y-2">
              <Label>Forma do Reajuste</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "percentage" ? "default" : "outline"}
                  onClick={() => form.setValue("mode", "percentage", { shouldValidate: true })}
                >
                  Percentual
                </Button>
                <Button
                  type="button"
                  variant={mode === "custom" ? "default" : "outline"}
                  onClick={() => form.setValue("mode", "custom", { shouldValidate: true })}
                >
                  Valores Personalizados
                </Button>
              </div>
            </div>

            {mode === "percentage" ? (
              <>
                <FormInput<ApplyFormData>
                  name="percentage"
                  label={
                    <span className="flex items-center gap-2">
                      <IconPercentage className="h-4 w-4 text-muted-foreground" />
                      Percentual de Reajuste
                    </span>
                  }
                  type="percentage"
                  placeholder="0"
                  decimals={2}
                  description="Use valores positivos para aumentar e negativos para reduzir"
                />

                {hasPositionsWithoutSalary && positionIds.length > 0 && (
                  <Alert variant="warning">
                    <IconAlertTriangle className="h-4 w-4" />
                    <AlertDescription>Alguns cargos não possuem remuneração definida e serão ignorados no reajuste.</AlertDescription>
                  </Alert>
                )}

                {positionIds.length > 0 && percentValue !== 0 && (
                  <div className="space-y-2">
                    <Label>Prévia do Reajuste</Label>
                    <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-3">
                      {previewSalaries.slice(0, 5).map(({ positionId, positionName, currentSalary, newSalary }) => (
                        <div key={positionId} className="flex justify-between items-center text-sm">
                          <span className="truncate flex-1 mr-2">{positionName}</span>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{currentSalary > 0 ? formatCurrency(currentSalary) : "—"}</span>
                            <span className="font-enhanced-unicode">→</span>
                            <span className={currentSalary === 0 ? "text-muted-foreground" : percentValue > 0 ? "text-destructive" : "text-emerald-600"}>
                              {currentSalary > 0 ? formatCurrency(newSalary) : "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                      {previewSalaries.length > 5 && (
                        <div className="text-sm text-muted-foreground text-center pt-2">
                          ... e mais {previewSalaries.length - 5} {previewSalaries.length - 5 === 1 ? "cargo" : "cargos"}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label>Novos Valores por Cargo</Label>
                {positionIds.length === 0 ? (
                  <div className="text-sm text-muted-foreground border rounded-lg p-3">Selecione os cargos para informar os novos valores.</div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto space-y-3 border rounded-lg p-3">
                    {customValues.map((customValue, index) => {
                      const currentSalary = getCurrentSalary(customValue.positionId);
                      return (
                        <div key={customValue.positionId} className="grid grid-cols-2 gap-3 items-end">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate" title={positionCache[customValue.positionId]?.name}>
                              {positionCache[customValue.positionId]?.name ?? "..."}
                            </div>
                            <div className="text-xs text-muted-foreground">Atual: {currentSalary > 0 ? formatCurrency(currentSalary) : "—"}</div>
                          </div>
                          <FormMoneyInput<ApplyFormData> name={`customValues.${index}.newValue` as any} label="Novo Valor" required />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Effective Date */}
            <FormField
              control={form.control}
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    Data de Vigência
                  </FormLabel>
                  <FormControl>
                    <DateTimeInput
                      mode="date"
                      value={field.value ?? null}
                      onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                      hideLabel
                      placeholder="Hoje (padrão)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Note */}
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
                    <Textarea {...field} value={field.value ?? ""} placeholder="Observação sobre o reajuste (opcional)" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancelar
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isApplying || positionIds.length === 0}>
            {isApplying ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              "Aplicar Reajuste"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
