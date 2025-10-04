import { useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconPlus, IconTrash, IconPhone } from "@tabler/icons-react";
import { formatPhone } from "../../../../utils";
interface PhonesManagerProps {
  disabled?: boolean;
}

export function PhonesManager({ disabled }: PhonesManagerProps) {
  const form = useFormContext();
  const [newPhone, setNewPhone] = useState("");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "phones",
  });

  const handleAddPhone = () => {
    if (!newPhone.trim()) return;

    // Remove all formatting to get just numbers
    const cleanPhone = newPhone.replace(/\D/g, "");

    // Basic validation - Brazilian phone numbers
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return;
    }

    // Check for duplicates
    const currentPhones = form.getValues("phones") || [];
    if (currentPhones.includes(cleanPhone)) {
      return;
    }

    append(cleanPhone);
    setNewPhone("");
  };

  const handleRemovePhone = (index: number) => {
    remove(index);
  };

  const handlePhoneInputChange = (value: string) => {
    const formatted = formatPhone(value);
    setNewPhone(formatted);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPhone();
    }
  };

  return (
    <FormItem>
      <FormLabel className="flex items-center gap-2">
        <IconPhone className="h-4 w-4" />
        Telefones
      </FormLabel>

      <div className="space-y-3">
        {/* Add Phone Input */}
        <div className="flex gap-2">
          <Input
            value={newPhone}
            onChange={(e) => handlePhoneInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="(11) 99999-9999"
            disabled={disabled}
            className="flex-1 font-mono"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAddPhone} disabled={disabled || !newPhone.trim()} className="px-3">
            <IconPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Phone List */}
        {fields.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const phoneValue = form.watch(`phones.${index}`) || "";
                  const formattedPhone = formatPhone(phoneValue);

                  return (
                    <div key={field.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <IconPhone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 font-mono text-sm">{formattedPhone || phoneValue}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePhone(index)}
                        disabled={disabled}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <IconTrash className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {fields.length === 0 && <p className="text-sm text-muted-foreground">Nenhum telefone adicionado. Digite um telefone acima e clique em adicionar.</p>}
      </div>

      <FormMessage />
    </FormItem>
  );
}
