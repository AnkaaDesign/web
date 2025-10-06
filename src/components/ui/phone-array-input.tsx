import React, { useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconPhone, IconPlus, IconTrash } from "@tabler/icons-react";
import { formatPhone } from "../../utils";

interface PhoneArrayInputProps<TFieldValues extends FieldValues = FieldValues> {
  control: any;
  disabled?: boolean;
  maxPhones?: number;
  label?: string;
  placeholder?: string;
}

export function PhoneArrayInput<TFieldValues extends FieldValues = FieldValues>({
  control,
  disabled,
  maxPhones = 5,
  label = "Telefones",
  placeholder = "(00) 00000-0000",
}: PhoneArrayInputProps<TFieldValues>) {
  const [newPhone, setNewPhone] = useState("");

  // Watch the phones array
  const watchedPhones = useWatch({
    control,
    name: "phones" as any,
  });

  // Ensure phones is always an array
  const phones = Array.isArray(watchedPhones) ? watchedPhones : [];

  const { append, remove } = useFieldArray({
    control,
    name: "phones" as any,
  });

  const handleAddPhone = () => {
    const cleanPhone = newPhone.replace(/\D/g, "");
    if (cleanPhone && !phones.includes(cleanPhone) && phones.length < maxPhones) {
      append(cleanPhone as any);
      setNewPhone("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPhone();
    }
  };

  const canAddMore = phones.length < maxPhones;
  const cleanNewPhone = newPhone.replace(/\D/g, "");
  const isDuplicate = phones.includes(cleanNewPhone);
  const isAddDisabled = disabled || !cleanNewPhone || isDuplicate || !canAddMore;

  return (
    <FormField
      control={control}
      name="phones"
      as
      any
      render={({ field }) => {
        // Ensure field.value is always an array
        if (!Array.isArray(field.value)) {
          field.onChange([]);
        }

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1">
                <IconPhone className="h-4 w-4" />
                {label}
                {phones.length > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({phones.length}/{maxPhones})
                  </span>
                )}
              </div>
              {!canAddMore && <span className="text-xs text-muted-foreground">Limite atingido</span>}
            </FormLabel>

            <div className="space-y-3">
              {/* Add new phone input */}
              {canAddMore && (
                <div className="flex gap-2">
                  <Input
                    type="phone"
                    value={newPhone}
                    onChange={(value) => setNewPhone(String(value || ""))}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    disabled={disabled}
                    transparent={true}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddPhone}
                    disabled={isAddDisabled}
                    size="icon"
                    variant="outline"
                    title={isDuplicate ? "Telefone já existe" : !cleanNewPhone ? "Digite um telefone válido" : "Adicionar telefone"}
                  >
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Show validation message for new phone */}
              {isDuplicate && newPhone && <p className="text-sm text-muted-foreground">Este telefone já foi adicionado</p>}

              {/* List existing phones */}
              {Array.isArray(phones) && phones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{label} adicionados:</p>
                  {phones.map((phone: string, index: number) => {
                    const formatted = formatPhone(phone);

                    return (
                      <div key={`phone-${index}`} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <IconPhone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 font-mono">{formatted}</span>
                        <Button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={disabled}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover telefone"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
