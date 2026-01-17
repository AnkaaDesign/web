import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useFormContext } from "react-hook-form";
import { IconShieldCheck } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

type FormData = UserCreateFormData | UserUpdateFormData;

interface VerifiedSwitchProps {
  disabled?: boolean;
}

export function VerifiedSwitch({ disabled }: VerifiedSwitchProps) {
  const form = useFormContext<FormData>();

  return (
    <FormField
      control={form.control}
      name="verified"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/40 bg-card p-4 shadow-sm">
          <div className="space-y-0.5">
            <FormLabel className="text-base font-medium flex items-center gap-2">
              <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
              Verificação Manual do Usuário
            </FormLabel>
            <p className="text-sm text-muted-foreground">
              Marque para verificar o usuário manualmente, sem exigir confirmação por email/SMS
            </p>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
