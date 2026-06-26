import React, { useState, useCallback, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormCombobox } from "@/components/ui/form-combobox";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconPercentage, IconAlertTriangle, IconCalendar, IconTag, IconBriefcase, IconNotes, IconLoader2, IconGift } from "@tabler/icons-react";
import { getPositions } from "../../../../api-client";
import { formatCurrency } from "../../../../utils";
import { SALARY_ADJUSTMENT_TYPE, SALARY_ADJUSTMENT_TYPE_LABELS } from "../../../../constants";
import { useSalaryAdjustmentMutations } from "../../../../hooks/personnel-department/use-salary-adjustment";
import { useApplyPeriodAdjustment } from "../../../../hooks/personnel-department/use-bonus";
import { toast } from "@/components/ui/sonner";
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
    // Bonificação: percentual + data de vigência (espelham os campos de salário).
    bonusPercentage: z
      .number({ invalid_type_error: "Percentual inválido" })
      .min(-100, "Percentual não pode ser menor que -100%")
      .max(100, "Percentual não pode ser maior que 100%")
      .nullable()
      .optional(),
    bonusEffectiveDate: z.date().nullable().optional(),
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

// O service da api não lança quando um valor fica abaixo do piso efetivo:
// devolve, por item, success=false com uma mensagem contendo "abaixo do piso"
// / "salário-mínimo" e o sufixo "Confirme para aplicar mesmo assim.". O front
// detecta esses itens e reapresenta com allowBelowFloor=true.
const isBelowFloorError = (message?: string): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("abaixo do piso") || normalized.includes("salário-mínimo") || normalized.includes("salario-minimo");
};

// Alvos do reajuste. A página de Reajustes aplica reajuste de SALÁRIO (cargos)
// e/ou de BONIFICAÇÃO (período do bônus). A bonificação é aplicada via
// POST /bonus/period-adjustment/:year/:month, que persiste um SalaryAdjustment
// do tipo BONUS (delta) — a mesma fonte lida pelo badge "+X%" e pela lista de
// Reajustes (sem sistema paralelo).
type AdjustmentTarget = "salary" | "bonus";

export function SalaryAdjustmentApplyDialog({ open, onOpenChange }: SalaryAdjustmentApplyDialogProps) {
  const { applyAsync, isApplying } = useSalaryAdjustmentMutations();
  const applyPeriodAdjustment = useApplyPeriodAdjustment();

  // Alvo do reajuste (mutuamente exclusivo): salário OU bonificação. Padrão: salário.
  const [target, setTarget] = useState<AdjustmentTarget>("salary");

  // Cache of full Position objects (for names + current remuneration preview)
  const [positionCache, setPositionCache] = useState<Record<string, Position>>({});

  // Below-floor confirmation: hold the payload while we ask the user to confirm.
  const [belowFloorConfirm, setBelowFloorConfirm] = useState<{
    payload: SalaryAdjustmentApplyFormData;
    messages: string[];
  } | null>(null);

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
      bonusPercentage: null,
      bonusEffectiveDate: new Date(),
    },
  });

  const mode = useWatch({ control: form.control, name: "mode" });
  const watchedPercentage = useWatch({ control: form.control, name: "percentage" });
  const positionIds = useWatch({ control: form.control, name: "positionIds" }) || [];
  const customValues = useWatch({ control: form.control, name: "customValues" }) || [];

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setTarget("salary");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      Object.entries(SALARY_ADJUSTMENT_TYPE_LABELS)
        // BONUS is system-applied (bonus period reajuste) — not selectable as a salary type.
        .filter(([value]) => value !== SALARY_ADJUSTMENT_TYPE.BONUS)
        .map(([value, label]) => ({
          value,
          label,
        })),
    [],
  );

  const getCurrentSalary = (positionId: string): number => {
    const position = positionCache[positionId];
    return position?.remuneration ?? position?.remunerations?.[0]?.value ?? 0;
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

  // Runs the salary apply mutation. If any position is rejected for being below
  // the effective floor (and we have NOT yet confirmed), surface a confirmation
  // dialog so the user can re-submit with allowBelowFloor=true.
  // Returns true if the apply completed (or no salary target was requested);
  // false if it stopped to ask for below-floor confirmation, so the caller does
  // NOT close the dialog prematurely.
  const runApply = async (payload: SalaryAdjustmentApplyFormData): Promise<boolean> => {
    try {
      const response = await applyAsync(payload);

      if (!payload.allowBelowFloor) {
        const floorFailures = (response?.data?.results || []).filter((item) => !item.success && isBelowFloorError(item.error));
        if (floorFailures.length > 0) {
          setBelowFloorConfirm({
            payload: { ...payload, allowBelowFloor: true },
            messages: floorFailures.map((item) => `${item.positionName}: ${item.error}`),
          });
          return false;
        }
      }
      return true;
    } catch (error) {
      // Error toast handled by the API client interceptor
      if (process.env.NODE_ENV !== "production") {
        console.error("Error applying salary adjustment:", error);
      }
      return false;
    }
  };

  // Applies the BONIFICATION reajuste by reusing the existing bonus engine
  // (POST /bonus/period-adjustment/:year/:month). Like a salary dissídio: a
  // single percentage applied to the bonus period of the chosen "Data de
  // Vigência" and ONWARD (the API carries the adjustment forward to later
  // periods). The percentage + vigência date live on the same RHF form as the
  // salary fields so they share styling.
  const runBonusApply = async (): Promise<boolean> => {
    const parsed = form.getValues("bonusPercentage");
    if (parsed === null || parsed === undefined || !Number.isFinite(parsed)) {
      toast.error("Informe um percentual de bonificação válido.");
      return false;
    }
    if (parsed < -100 || parsed > 100) {
      toast.error("Reajuste de bonificação deve estar entre -100% e +100%.");
      return false;
    }
    const vigencia = form.getValues("bonusEffectiveDate");
    if (!vigencia) {
      toast.error("Informe a data de vigência da bonificação.");
      return false;
    }
    // Período do bônus da data de vigência: o ciclo vai do dia 26 do mês
    // anterior ao dia 25 do mês/ano de referência. Se a vigência cai no dia
    // 26+, o período pertence ao PRÓXIMO mês civil (virada de ano dez→jan).
    let year = vigencia.getFullYear();
    let month = vigencia.getMonth() + 1; // 1..12
    if (vigencia.getDate() >= 26) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    try {
      await applyPeriodAdjustment.mutateAsync({ year, month, percentage: parsed, effectiveDate: vigencia });
      return true;
    } catch (error) {
      // Error toast handled by the API client interceptor
      if (process.env.NODE_ENV !== "production") {
        console.error("Error applying bonus adjustment:", error);
      }
      return false;
    }
  };

  // Orchestrates the selected target (mutually exclusive). Salary runs through
  // RHF validation (handleSalary); bonus runs via runBonusApply. The dialog only
  // closes when the requested target succeeds.
  const onApply = async () => {
    if (target === "salary") {
      // Validate + run the salary form. handleSalary returns whether it ran clean.
      const salaryOk = await new Promise<boolean>((resolve) => {
        form.handleSubmit(
          async (data) => resolve(await handleSalary(data)),
          () => resolve(false),
        )();
      });
      if (salaryOk) {
        onOpenChange(false);
        form.reset();
      }
      return;
    }

    const bonusOk = await runBonusApply();
    if (bonusOk) {
      onOpenChange(false);
      form.reset();
    }
  };

  const handleSalary = async (data: ApplyFormData): Promise<boolean> => {
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
      allowBelowFloor: false,
    };

    return runApply(payload);
  };

  const handleConfirmBelowFloor = async () => {
    if (!belowFloorConfirm) return;
    const { payload } = belowFloorConfirm;
    setBelowFloorConfirm(null);
    const salaryOk = await runApply(payload);
    if (!salaryOk) return;
    // Salary confirmed below floor — close.
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar Reajuste</DialogTitle>
          <DialogDescription>Reajuste o salário dos cargos selecionados e/ou a bonificação de um período.</DialogDescription>
        </DialogHeader>

        {/* Alvo do reajuste: salário (cargos) e/ou bonificação (período do bônus) */}
        <div className="space-y-2">
          <Label>O que reajustar?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={target === "salary" ? "default" : "outline"} onClick={() => setTarget("salary")}>
              <IconBriefcase className="h-4 w-4 mr-2" />
              Salário
            </Button>
            <Button type="button" variant={target === "bonus" ? "default" : "outline"} onClick={() => setTarget("bonus")}>
              <IconGift className="h-4 w-4 mr-2" />
              Bonificação
            </Button>
          </div>
        </div>

        {target === "salary" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSalary)} className="space-y-4 py-2">
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
        )}

        {/* Bonificação — reaproveita o motor de reajuste de bônus por período
            (SalaryAdjustment tipo BONUS). Como um dissídio: um percentual + data
            de vigência; aplica à bonificação do período da vigência em diante.
            Os campos espelham EXATAMENTE os de salário (FormInput percentage +
            DateTimeInput de Data de Vigência). */}
        {target === "bonus" && (
          <Form {...form}>
            <div className="space-y-4 py-2 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconGift className="h-4 w-4 text-muted-foreground" />
                Reajuste de Bonificação
              </div>

              <FormInput<ApplyFormData>
                name="bonusPercentage"
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

              {/* Data de Vigência (idêntica à de salário) */}
              <FormField
                control={form.control}
                name="bonusEffectiveDate"
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

              <p className="text-xs text-muted-foreground">Aumenta a bonificação a partir do período da data de vigência.</p>
            </div>
          </Form>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying || applyPeriodAdjustment.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={onApply}
            disabled={isApplying || applyPeriodAdjustment.isPending || (target === "salary" && positionIds.length === 0)}
          >
            {isApplying || applyPeriodAdjustment.isPending ? (
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

      {/* Below-floor confirmation (piso / salário-mínimo) */}
      <AlertDialog open={belowFloorConfirm !== null} onOpenChange={(value) => !value && setBelowFloorConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-warning" />
              Remuneração abaixo do piso
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Os valores abaixo ficam abaixo do piso efetivo (maior entre o salário-mínimo nacional e o piso da categoria):</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {(belowFloorConfirm?.messages || []).map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
                <p>Deseja aplicar o reajuste mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBelowFloor} disabled={isApplying}>
              Aplicar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
