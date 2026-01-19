import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface PasswordInputProps {
  disabled?: boolean;
  required?: boolean;
}

export function PasswordInput({ disabled, required = false }: PasswordInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <FormField
      control={form.control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Senha {required && <span className="text-red-500">*</span>}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                value={field.value || ""}
                onChange={(value: string) => field.onChange(value || undefined)}
                type={showPassword ? "text" : "password"}
                placeholder={required ? "Digite a senha" : "Deixe em branco para manter a atual"}
                disabled={disabled}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={disabled}
              >
                {showPassword ? <IconEyeOff className="h-4 w-4 text-muted-foreground" /> : <IconEye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
