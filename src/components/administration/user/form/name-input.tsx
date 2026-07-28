import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconUser } from "@tabler/icons-react";
import { toBrazilianNameCase } from "@/utils/formatters";
import type { UserCreateFormData, UserUpdateFormData } from "../../../../schemas";

interface NameInputProps {
  disabled?: boolean;
}

/**
 * The single shared "Nome" field for BOTH the administração collaborator form and the
 * admission (cadastro de colaborador) form.
 *
 * Casing is normalized on BLUR, not on every keystroke: per-keystroke casing fights the
 * typist mid-word ("da" would flip to "Da" and back). The blur pass is only a preview —
 * `userCreateSchema`/`userUpdateSchema` apply the same transform on submit, and the API
 * applies it again, so a name typed and submitted without ever blurring still lands
 * normalized.
 */
export function NameInput({ disabled }: NameInputProps) {
  const form = useFormContext<UserCreateFormData | UserUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconUser className="h-4 w-4 text-muted-foreground" />
            Nome
            <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              onBlur={() => {
                const normalized = toBrazilianNameCase(field.value ?? "");
                // Skip the onChange when nothing changed, so a plain focus/blur never
                // dirties the field (which would send `name` on an edit submit).
                if (normalized !== field.value) field.onChange(normalized);
                field.onBlur();
              }}
              placeholder="Digite o nome completo do colaborador"
              disabled={disabled}
              typewriterPlaceholder={false}
              naturalTyping={false}
              typingSpeed={40}
              transparent={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
