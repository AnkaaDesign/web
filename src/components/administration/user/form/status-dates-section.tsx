import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { IconCalendar } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";
import { USER_STATUS } from "../../../../constants";
import { addDays, startOfDay, getDay, subDays } from "date-fns";

interface StatusDatesSectionProps {
  disabled?: boolean;
}

/**
 * Adjusts a date to the previous Friday if it falls on a weekend
 * @param date The date to adjust
 * @returns The adjusted date (Friday if weekend, original date otherwise)
 */
function adjustToFridayIfWeekend(date: Date): Date {
  const dayOfWeek = getDay(date);

  // Sunday = 0, Saturday = 6
  if (dayOfWeek === 0) {
    // Sunday -> move back to Friday (2 days)
    return subDays(date, 2);
  } else if (dayOfWeek === 6) {
    // Saturday -> move back to Friday (1 day)
    return subDays(date, 1);
  }

  return date;
}

/**
 * Calculates all status-related dates based on exp1StartAt
 * Each experience period is 45 days
 * End dates are adjusted to Friday if they fall on weekends
 */
function calculateStatusDates(exp1StartAt: Date | null) {
  if (!exp1StartAt) {
    return {
      exp1EndAt: null,
      exp2StartAt: null,
      exp2EndAt: null,
    };
  }

  // Normalize to start of day to avoid timezone issues
  const normalizedStart = startOfDay(exp1StartAt);

  // Calculate exp1 end date (45 days from start, so end is on day 46) and adjust to Friday if weekend
  const rawExp1EndAt = addDays(normalizedStart, 45);
  const exp1EndAt = adjustToFridayIfWeekend(rawExp1EndAt);

  // exp2 starts the day after exp1 ends
  const exp2StartAt = addDays(exp1EndAt, 1);

  // Calculate exp2 end date (45 days) and adjust to Friday if weekend
  const rawExp2EndAt = addDays(exp2StartAt, 45);
  const exp2EndAt = adjustToFridayIfWeekend(rawExp2EndAt);

  return {
    exp1EndAt,
    exp2StartAt,
    exp2EndAt,
  };
}

export function StatusDatesSection({ disabled }: StatusDatesSectionProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();
  const status = form.watch("status");
  const exp1StartAt = form.watch("exp1StartAt");
  const effectedAt = form.watch("effectedAt");

  // Track previous values to detect actual changes (not just initial mount)
  const prevExp1StartAtRef = useRef<Date | null | undefined>(undefined);
  const prevStatusRef = useRef<USER_STATUS | undefined>(undefined);
  const isFirstRenderRef = useRef(true);

  // Auto-calculate dates when exp1StartAt changes (but not on initial mount)
  useEffect(() => {
    // Skip on first render to avoid overwriting values loaded from API
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevExp1StartAtRef.current = exp1StartAt;
      return;
    }

    // Only recalculate if exp1StartAt actually changed
    const hasChanged = prevExp1StartAtRef.current?.getTime() !== exp1StartAt?.getTime();
    if (!hasChanged) return;

    prevExp1StartAtRef.current = exp1StartAt;

    if (exp1StartAt) {
      const dates = calculateStatusDates(exp1StartAt);

      // Recalculate these read-only fields when user changes exp1StartAt
      form.setValue("exp1EndAt", dates.exp1EndAt, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2StartAt", dates.exp2StartAt, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2EndAt", dates.exp2EndAt, { shouldValidate: false, shouldDirty: true });
    } else {
      // Clear dates if exp1StartAt is cleared
      form.setValue("exp1EndAt", null, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2StartAt", null, { shouldValidate: false, shouldDirty: true });
      form.setValue("exp2EndAt", null, { shouldValidate: false, shouldDirty: true });
    }
  }, [exp1StartAt, form]);

  // Update dates when status changes (but not on initial mount)
  useEffect(() => {
    // Skip if this is the first render or status hasn't changed
    if (prevStatusRef.current === undefined) {
      prevStatusRef.current = status;
      return;
    }

    const hasChanged = prevStatusRef.current !== status;
    if (!hasChanged) return;

    prevStatusRef.current = status;

    if (status === USER_STATUS.EFFECTED && !effectedAt) {
      // Set effectedAt to today if transitioning to EFFECTED
      form.setValue("effectedAt", startOfDay(new Date()), { shouldValidate: false });
    }

    if (status === USER_STATUS.DISMISSED && !form.getValues("dismissedAt")) {
      // Set dismissedAt to today if transitioning to DISMISSED
      form.setValue("dismissedAt", startOfDay(new Date()), { shouldValidate: false });
    }
  }, [status, effectedAt, form]);

  // Don't show section if status is not set
  if (!status) {
    return null;
  }

  const showExp1Dates = [
    USER_STATUS.EXPERIENCE_PERIOD_1,
    USER_STATUS.EXPERIENCE_PERIOD_2,
    USER_STATUS.EFFECTED,
    USER_STATUS.DISMISSED,
  ].includes(status);

  const showExp2Dates = [
    USER_STATUS.EXPERIENCE_PERIOD_2,
    USER_STATUS.EFFECTED,
    USER_STATUS.DISMISSED,
  ].includes(status);

  const showContractedDate = [USER_STATUS.EFFECTED, USER_STATUS.DISMISSED].includes(status);
  const showDismissedDate = status === USER_STATUS.DISMISSED;

  // Don't render if no dates should be shown
  if (!showExp1Dates && !showContractedDate && !showDismissedDate) {
    return null;
  }

  return (
    <div className="space-y-6 border-t border-border/30 pt-6">
        {/* Experience Period 1 */}
        {showExp1Dates && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Experiência 1 (45 dias)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
              <FormField
                control={form.control}
                name="exp1StartAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={field}
                    label={
                      <span className="flex items-center gap-1.5">
                        Início da Experiência 1
                        <span className="text-destructive ml-0.5">*</span>
                      </span>
                    }
                    disabled={disabled}
                    mode="date"
                    required
                  />
                )}
              />

              <FormField
                control={form.control}
                name="exp1EndAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={field}
                    label="Fim da Experiência 1"
                    disabled={true}
                    mode="date"
                    helperText="Calculado automaticamente (45 dias após o início)"
                  />
                )}
              />
            </div>
          </div>
        )}

        {/* Experience Period 2 */}
        {showExp2Dates && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Experiência 2 (45 dias)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
              <FormField
                control={form.control}
                name="exp2StartAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={field}
                    label="Início da Experiência 2"
                    disabled={true}
                    mode="date"
                    helperText="Calculado automaticamente (dia seguinte ao fim da Exp. 1)"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="exp2EndAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={field}
                    label="Fim da Experiência 2"
                    disabled={true}
                    mode="date"
                    helperText="Calculado automaticamente (45 dias após o início real da Exp. 2)"
                  />
                )}
              />
            </div>
          </div>
        )}

        {/* Contracted Date */}
        {showContractedDate && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Contratação Efetiva
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
              <FormField
                control={form.control}
                name="effectedAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={field}
                    label={
                      <span className="flex items-center gap-1.5">
                        Data de Contratação
                        <span className="text-destructive ml-0.5">*</span>
                      </span>
                    }
                    disabled={disabled}
                    mode="date"
                    required
                    helperText="Data em que o colaborador foi efetivado (padrão: hoje)"
                  />
                )}
              />
            </div>
          </div>
        )}

        {/* Dismissed Date */}
        {showDismissedDate && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Demissão
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6">
              <FormField
                control={form.control}
                name="dismissedAt"
                render={({ field }) => (
                  <DateTimeInput
                    field={field}
                    label={
                      <span className="flex items-center gap-1.5">
                        Data de Demissão
                        <span className="text-destructive ml-0.5">*</span>
                      </span>
                    }
                    disabled={disabled}
                    mode="date"
                    required
                    helperText="Data em que o colaborador foi demitido (padrão: hoje)"
                  />
                )}
              />
            </div>
          </div>
        )}
    </div>
  );
}
