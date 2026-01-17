import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useFormContext } from "react-hook-form";
import { IconUserCheck, IconUserX } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

type FormData = UserCreateFormData | UserUpdateFormData;

interface ActiveSwitchProps {
  disabled?: boolean;
}

export function ActiveSwitch({ disabled }: ActiveSwitchProps) {
  const form = useFormContext<FormData>();
  const isActive = form.watch("isActive");

  return (
    <FormField
      control={form.control}
      name="isActive"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/40 bg-card p-4 shadow-sm">
          <div className="space-y-0.5">
            <FormLabel className="text-base font-medium flex items-center gap-2">
              {isActive ? (
                <IconUserCheck className="h-4 w-4 text-green-600" />
              ) : (
                <IconUserX className="h-4 w-4 text-red-600" />
              )}
              Status do Usuário
            </FormLabel>
            <p className="text-sm text-muted-foreground">
              {isActive
                ? "Usuário ativo - pode fazer login e acessar o sistema"
                : "Usuário inativo - não poderá fazer login no sistema"}
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
