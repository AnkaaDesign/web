import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { IconCalendar } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CONTRACT_TYPE } from "../../../../constants";
import { addDays, startOfDay, getDay, subDays } from "date-fns";

interface StatusDatesSectionProps {
  disabled?: boolean;
}

/**
 * Adjusts a date to the previous Friday if it falls on a weekend.
 */
function adjustToFridayIfWeekend(date: Date): Date {
  const dayOfWeek = getDay(date);
  if (dayOfWeek === 0) {
    // Sunday -> Friday
    return subDays(date, 2);
  } else if (dayOfWeek === 6) {
    // Saturday -> Friday
    return subDays(date, 1);
  }
  return date;
}

/**
 * Calculates the CLT experience-period dates from the admission date.
 * First experience period is 30 days, second is 50 days; end dates are pushed
 * to the previous Friday if they land on a weekend; effectedAt is the day after
 * exp2 ends.
 */
function calculateStatusDates(admissionDate: Date | null) {
  if (!admissionDate) {
    return { exp1EndAt: null, exp2StartAt: null, exp2EndAt: null, effectedAt: null };
  }

  const normalizedStart = startOfDay(admissionDate);
  const rawExp1EndAt = addDays(normalizedStart, 30);
  const exp1EndAt = adjustToFridayIfWeekend(rawExp1EndAt);
  const exp2StartAt = addDays(exp1EndAt, 1);
  const rawExp2EndAt = addDays(exp2StartAt, 50);
  const exp2EndAt = adjustToFridayIfWeekend(rawExp2EndAt);
  const effectedAt = addDays(exp2EndAt, 1);

  return { exp1EndAt, exp2StartAt, exp2EndAt, effectedAt };
}

/**
 * CLT period dates bound to the current vínculo. `exp1StartAt` doubles as the
 * admission date and drives the auto-calculated exp1/exp2/effected dates.
 *
 * Post-binary-status model: the dates shown are driven by the contract MODALITY
 * (`contractType`), since experiência is now a modality (EXPERIENCE_PERIOD_1/_2),
 * NOT a status:
 *   - EXPERIENCE_PERIOD_1/_2 → admissão + experiência 1/2 dates (phase derived
 *     from the modality: EXPERIENCE_PERIOD_2 ⇒ fase 2);
 *   - INDETERMINATE (efetivado) → admissão + data de efetivação;
 *   - everything else → admissão only.
 * The termination date is NOT editable here — it is set by the termination flow.
 */
export function StatusDatesSection({ disabled }: StatusDatesSectionProps) {
  const form = useFormContext();
  const contractType = form.watch("contractType") as CONTRACT_TYPE | null | undefined;
  const exp1StartAt = form.watch("exp1StartAt") as Date | null | undefined;

  const prevExp1StartAtRef = useRef<Date | null | undefined>(undefined);
  const prevContractTypeRef = useRef<string | null | undefined>(undefined);
  const isFirstRenderRef = useRef(true);

  // Auto-calculate dates when exp1StartAt changes (but not on initial mount).
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevExp1StartAtRef.current = exp1StartAt;
      return;
    }

    const hasChanged = prevExp1StartAtRef.current?.getTime() !== exp1StartAt?.getTime();
    if (!hasChanged) return;
    prevExp1StartAtRef.current = exp1StartAt;

    // Keep the (required) admissionDate in sync with the admission/exp1 start.
    form.setValue("admissionDate", exp1StartAt ?? null, { shouldValidate: true, shouldDirty: true });

    if (exp1StartAt) {
      const dates = calculateStatusDates(exp1StartAt);
      form.setValue("exp1EndAt", dates.exp1EndAt, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2StartAt", dates.exp2StartAt, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2EndAt", dates.exp2EndAt, { shouldValidate: false, shouldDirty: true });
      form.setValue("effectedAt", dates.effectedAt, { shouldValidate: false, shouldDirty: true });
    } else {
      form.setValue("exp1EndAt", null, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2StartAt", null, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2EndAt", null, { shouldValidate: false, shouldDirty: true });
      form.setValue("effectedAt", null, { shouldValidate: false, shouldDirty: true });
    }
  }, [exp1StartAt, form]);

  // When the modality changes, stamp the effective date on efetivação
  // (INDETERMINATE). Experiência dates are always derived from the admission date.
  useEffect(() => {
    if (prevContractTypeRef.current === undefined) {
      prevContractTypeRef.current = contractType;
      return;
    }
    const hasChanged = prevContractTypeRef.current !== contractType;
    if (!hasChanged) return;
    prevContractTypeRef.current = contractType;

    if (contractType === CONTRACT_TYPE.INDETERMINATE && !form.getValues("effectedAt")) {
      form.setValue("effectedAt", startOfDay(new Date()), { shouldValidate: false, shouldDirty: true });
    }
  }, [contractType, form]);

  if (!contractType) {
    return null;
  }

  // Experiência dates are shown while the modality is EXPERIENCE_PERIOD_*. The
  // phase (1 vs 2) is derived from the modality (EXPERIENCE_PERIOD_2 ⇒ fase 2).
  const isExperience = contractType === CONTRACT_TYPE.EXPERIENCE_PERIOD_1 || contractType === CONTRACT_TYPE.EXPERIENCE_PERIOD_2;
  const inPhase2 = contractType === CONTRACT_TYPE.EXPERIENCE_PERIOD_2;

  // The effective-hire date is relevant once the bond is efetivado (INDETERMINATE).
  const showContractedDate = contractType === CONTRACT_TYPE.INDETERMINATE;

  // Admission is always shown; experiência windows only while in experiência.
  const showExp1Dates = true;
  const showExp2Dates = isExperience;

  return (
    <div className="space-y-6 border-t border-border/30 pt-6">
      {/* Experiência fase atual (derivada das datas) */}
      {isExperience && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Em experiência — fase {inPhase2 ? "2" : "1"} (a fase é derivada das datas de experiência).
        </div>
      )}

      {/* Experience Period 1 (doubles as admission date) */}
      {showExp1Dates && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            {isExperience ? "Admissão / Experiência 1" : showContractedDate ? "Admissão e Contratação Efetiva" : "Admissão"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
            <FormField
              control={form.control}
              name="exp1StartAt"
              render={({ field }) => (
                <DateTimeInput
                  field={{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null, name: field.name }}
                  label={
                    <span className="flex items-center gap-1.5">
                      Data de Admissão
                      <span className="text-destructive ml-0.5">*</span>
                    </span>
                  }
                  disabled={disabled}
                  mode="date"
                  required
                />
              )}
            />

            {isExperience ? (
              <FormField
                control={form.control}
                name="exp1EndAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null, name: field.name }}
                    label="Fim da Experiência 1"
                    disabled={true}
                    mode="date"
                  />
                )}
              />
            ) : showContractedDate ? (
              <FormField
                control={form.control}
                name="effectedAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null, name: field.name }}
                    label={
                      <span className="flex items-center gap-1.5">
                        Data de Contratação
                        <span className="text-destructive ml-0.5">*</span>
                      </span>
                    }
                    disabled={true}
                    mode="date"
                    required
                  />
                )}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Experience Period 2 */}
      {showExp2Dates && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Experiência 2
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
            <FormField
              control={form.control}
              name="exp2StartAt"
              render={({ field }) => (
                <DateTimeInput
                  field={{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null, name: field.name }}
                  label="Início da Experiência 2"
                  disabled={true}
                  mode="date"
                />
              )}
            />

            <FormField
              control={form.control}
              name="exp2EndAt"
              render={({ field }) => (
                <DateTimeInput
                  field={{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null, name: field.name }}
                  label="Fim da Experiência 2"
                  disabled={true}
                  mode="date"
                />
              )}
            />
          </div>
        </div>
      )}

    </div>
  );
}
