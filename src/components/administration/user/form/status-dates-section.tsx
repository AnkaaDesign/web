import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { IconCalendar } from "@tabler/icons-react";
import { FormField } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";
import { USER_STATUS } from "../../../../constants";
import { addDays, max as maxDate, startOfDay } from "date-fns";

interface StatusDatesSectionProps {
  disabled?: boolean;
}

/**
 * Calculates all status-related dates based on exp1StartAt
 * Each experience period is 45 days
 */
function calculateStatusDates(exp1StartAt: Date | null) {
  if (!exp1StartAt) {
    return {
      exp1EndAt: null,
      exp2StartAt: null,
      exp2EndAt: null,
    };
  }

  const exp1EndAt = addDays(exp1StartAt, 45);
  const today = startOfDay(new Date());

  // exp2StartAt should be at least today, but normally the day after exp1 ends
  const calculatedExp2Start = addDays(exp1EndAt, 1);
  const exp2StartAt = maxDate([calculatedExp2Start, today]);

  const exp2EndAt = addDays(exp2StartAt, 45); // 45 days from actual exp2 start

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
  const contractedAt = form.watch("contractedAt");

  // Auto-calculate dates when exp1StartAt changes
  useEffect(() => {
    if (exp1StartAt) {
      const dates = calculateStatusDates(exp1StartAt);

      // Only update if values are not manually set
      if (!form.getValues("exp1EndAt")) {
        form.setValue("exp1EndAt", dates.exp1EndAt, { shouldValidate: false });
      }
      if (!form.getValues("exp2StartAt")) {
        form.setValue("exp2StartAt", dates.exp2StartAt, { shouldValidate: false });
      }
      if (!form.getValues("exp2EndAt")) {
        form.setValue("exp2EndAt", dates.exp2EndAt, { shouldValidate: false });
      }
    }
  }, [exp1StartAt, form]);

  // Update dates when status changes
  useEffect(() => {
    if (status === USER_STATUS.EXPERIENCE_PERIOD_2 && exp1StartAt) {
      // Recalculate exp2 dates to ensure exp2StartAt is at least today
      const dates = calculateStatusDates(exp1StartAt);
      form.setValue("exp2StartAt", dates.exp2StartAt, { shouldValidate: false });
      form.setValue("exp2EndAt", dates.exp2EndAt, { shouldValidate: false });
    }

    if (status === USER_STATUS.CONTRACTED && !contractedAt) {
      // Set contractedAt to today if transitioning to CONTRACTED
      form.setValue("contractedAt", startOfDay(new Date()), { shouldValidate: false });
    }

    if (status === USER_STATUS.DISMISSED && !form.getValues("dismissedAt")) {
      // Set dismissedAt to today if transitioning to DISMISSED
      form.setValue("dismissedAt", startOfDay(new Date()), { shouldValidate: false });
    }
  }, [status, exp1StartAt, contractedAt, form]);

  // Don't show section if status is not set
  if (!status) {
    return null;
  }

  const showExp1Dates = [
    USER_STATUS.EXPERIENCE_PERIOD_1,
    USER_STATUS.EXPERIENCE_PERIOD_2,
    USER_STATUS.CONTRACTED,
    USER_STATUS.DISMISSED,
  ].includes(status);

  const showExp2Dates = [
    USER_STATUS.EXPERIENCE_PERIOD_2,
    USER_STATUS.CONTRACTED,
    USER_STATUS.DISMISSED,
  ].includes(status);

  const showContractedDate = [USER_STATUS.CONTRACTED, USER_STATUS.DISMISSED].includes(status);
  const showDismissedDate = status === USER_STATUS.DISMISSED;

  // Don't render if no dates should be shown
  if (!showExp1Dates && !showContractedDate && !showDismissedDate) {
    return null;
  }

  return (
    <div className="space-y-6 border-t pt-6">
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
                    helperText="Calculado automaticamente (dia seguinte ao fim da Exp. 1, ou hoje se já passou)"
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
                name="contractedAt"
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
