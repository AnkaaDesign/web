import { useState } from "react";

import type { SectorCreateFormData, SectorUpdateFormData } from "../../../../types";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface NameInputProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function NameInput({ control, disabled, required }: NameInputProps) {
  const [characterCount, setCharacterCount] = useState(0);

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nome do Setor {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Ex: Recursos Humanos, Produção, Financeiro"
              disabled={disabled}
              maxLength={100}
              value={field.value || ""}
              onChange={(e) => {
                const trimmedValue = e.target.value.replace(/\s+/g, " "); // Replace multiple spaces with single space
                setCharacterCount(trimmedValue.length);
                field.onChange(trimmedValue);
              }}
              onBlur={(e) => {
                // Trim leading/trailing spaces on blur
                const trimmedValue = e.target.value.trim();
                field.onChange(trimmedValue);
                setCharacterCount(trimmedValue.length);
              }}
              transparent={true}
            />
          </FormControl>
          <FormDescription className="flex justify-between text-xs">
            <span>Nome único para identificar o setor</span>
            <span className={characterCount > 90 ? "text-orange-500" : "text-muted-foreground"}>{characterCount}/100</span>
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
