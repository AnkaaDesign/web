import { useFormContext, useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, X } from "lucide-react";
import { useState } from "react";
import { formatPhone, cleanPhone } from "../../../../utils";

export function PhoneInput() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "phones",
  });

  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const handleAddPhone = () => {
    if (!newPhone.trim()) {
      setPhoneError("Digite um número de telefone");
      return;
    }

    const cleaned = cleanPhone(newPhone);
    const formatted = formatPhone(cleaned);

    // Validate phone format
    const phoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
    if (!phoneRegex.test(formatted)) {
      setPhoneError("Formato inválido. Use: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX");
      return;
    }

    // Check for duplicates
    const currentPhones = form.getValues("phones") || [];
    if (currentPhones.includes(formatted)) {
      setPhoneError("Este telefone já foi adicionado");
      return;
    }

    append(formatted);
    setNewPhone("");
    setPhoneError("");
  };

  const handlePhoneInputChange = (value: string) => {
    setNewPhone(value);
    setPhoneError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPhone();
    }
  };

  return (
    <FormField
      control={form.control}
      name="phones"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Telefones</FormLabel>
          <FormControl>
            <div className="space-y-4">
              {/* Add new phone input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={newPhone}
                    onChange={(e) => handlePhoneInputChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="(XX) XXXXX-XXXX"
                    className="pl-10"
                    autoComplete="tel"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddPhone}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Error message for phone input */}
              {phoneError && (
                <p className="text-sm text-red-500">{phoneError}</p>
              )}

              {/* Display existing phones */}
              {fields.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Telefones adicionados:</p>
                  <div className="flex flex-wrap gap-2">
                    {fields.map((field, index) => (
                      <Badge
                        key={field.id}
                        variant="secondary"
                        className="flex items-center gap-2"
                      >
                        <Phone className="h-3 w-3" />
                        {form.getValues(`phones.${index}`)}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => remove(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}