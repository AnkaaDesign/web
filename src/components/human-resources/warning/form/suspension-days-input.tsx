import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { IconCalendarOff } from "@tabler/icons-react";

import { WARNING_SEVERITY } from "../../../../constants";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface SuspensionDaysInputProps {
  control: any;
  disabled?: boolean;
}

/**
 * Dias de suspensão — só habilitado quando severity = SUSPENSION. CLT art. 474
 * limita a 30 dias. Limpa o valor automaticamente quando a severidade deixa de
 * ser SUSPENSION.
 */
export function SuspensionDaysInput({ control, disabled }: SuspensionDaysInputProps) {
  const form = useFormContext();
  const severity = useWatch({ control, name: "severity" });
  const isSuspension = severity === WARNING_SEVERITY.SUSPENSION;

  // Clear the value whenever the warning is no longer a suspension.
  useEffect(() => {
    if (!isSuspension) {
      const current = form.getValues("suspensionDays");
      if (current !== null && current !== undefined) {
        form.setValue("suspensionDays", null, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [isSuspension, form]);

  return (
    <FormField
      control={control}
      name="suspensionDays"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconCalendarOff className="h-4 w-4" />
              Dias de Suspensão
            </div>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={30}
              step={1}
              placeholder={isSuspension ? "Ex: 3" : "Disponível apenas para suspensão"}
              disabled={disabled || !isSuspension}
              value={field.value ?? ""}
              onChange={(value) => {
                const parsed = typeof value === "number" ? value : Number(value);
                field.onChange(Number.isNaN(parsed) || parsed === 0 ? null : parsed);
              }}
            />
          </FormControl>
          <FormDescription>CLT art. 474: a suspensão disciplinar não pode exceder 30 dias.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
