import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BasePhoneInput } from "@/components/ui/phone-input";
import { IconPhone, IconPlus, IconTrash } from "@tabler/icons-react";
import { useSupplierForm } from "./supplier-form-context";

interface PhoneInputProps {
  disabled?: boolean;
}

export function PhoneInput({ disabled }: PhoneInputProps) {
  const { values, setValue, errors, setError, clearError } = useSupplierForm();
  const [newPhone, setNewPhone] = useState("");

  // Ensure phones is always an array
  const phones = Array.isArray(values.phones) ? values.phones : [];

  const handleAddPhone = () => {
    const cleanPhone = newPhone.replace(/\D/g, "");
    
    if (!cleanPhone) {
      setError("phones", "Digite um número de telefone válido");
      return;
    }

    // Check for duplicates
    if (phones.includes(cleanPhone)) {
      setError("phones", "Este telefone já foi adicionado");
      return;
    }

    // Check max limit
    if (phones.length >= 5) {
      setError("phones", "Máximo de 5 telefones permitidos");
      return;
    }

    // Add phone to array
    setValue("phones", [...phones, cleanPhone]);
    setNewPhone("");
    clearError("phones");
  };

  const handleRemovePhone = (index: number) => {
    const newPhones = phones.filter((_, i) => i !== index);
    setValue("phones", newPhones);
    clearError("phones");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPhone();
    }
  };

  const canAddMore = phones.length < 5;
  const cleanNewPhone = newPhone.replace(/\D/g, "");
  const isDuplicate = phones.includes(cleanNewPhone);
  const isAddDisabled = disabled || !cleanNewPhone || isDuplicate || !canAddMore;

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1">
          <IconPhone className="h-4 w-4" />
          Telefones
          {phones.length > 0 && (
            <span className="text-sm text-muted-foreground ml-2">
              ({phones.length}/5)
            </span>
          )}
        </div>
        {!canAddMore && (
          <span className="text-xs text-muted-foreground">
            Limite atingido
          </span>
        )}
      </Label>

      <div className="space-y-3">
        {/* Add new phone input */}
        {canAddMore && (
          <div className="flex gap-2">
            <BasePhoneInput
              value={newPhone}
              onChange={(value) => {
                setNewPhone(value || "");
                clearError("phones");
              }}
              onKeyPress={handleKeyPress}
              placeholder="(00) 00000-0000"
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddPhone}
              disabled={isAddDisabled}
              size="icon"
              variant="outline"
              title={
                isDuplicate 
                  ? "Telefone já existe" 
                  : !cleanNewPhone 
                  ? "Digite um telefone válido" 
                  : "Adicionar telefone"
              }
            >
              <IconPlus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {errors.phones && <p className="text-sm text-destructive">{errors.phones}</p>}

        {/* Show validation message for new phone */}
        {isDuplicate && newPhone && (
          <p className="text-sm text-muted-foreground">
            Este telefone já foi adicionado
          </p>
        )}

        {/* List existing phones */}
        {phones.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Telefones adicionados:
            </p>
            {phones.map((phone, index) => {
              const formatted = phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") || 
                              phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3") ||
                              phone;
              
              return (
                <div key={`phone-${index}`} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <IconPhone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 font-mono">{formatted}</span>
                  <Button
                    type="button"
                    onClick={() => handleRemovePhone(index)}
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

        {phones.length === 0 && <p className="text-sm text-muted-foreground">Nenhum telefone adicionado</p>}
      </div>
    </div>
  );
}
