import { useFieldArray, useWatch } from "react-hook-form";
import { useState, useRef } from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconHash, IconX } from "@tabler/icons-react";

interface SerialNumberRangeInputProps {
  control: any;
  disabled?: boolean;
}

export function SerialNumberRangeInput({ control, disabled }: SerialNumberRangeInputProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const removedNumbersRef = useRef<Set<number>>(new Set());

  // Watch the serial numbers array
  const watchedSerialNumbers = useWatch({
    control,
    name: "serialNumbers",
  });

  // Ensure serialNumbers is always an array
  const serialNumbers: number[] = Array.isArray(watchedSerialNumbers) ? watchedSerialNumbers : [];

  const { append, remove } = useFieldArray({
    control,
    name: "serialNumbers",
  });

  const handleInputChange = (value: string) => {
    // Allow only numbers and spaces
    const sanitizedValue = value.replace(/[^\d\s]/g, "");
    setInputValue(sanitizedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGenerateRange();
    }
  };

  const handleGenerateRange = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    // Split by space
    const parts = trimmedValue.split(/\s+/).filter(p => p.length > 0);

    if (parts.length === 0) return;

    // Parse numbers
    const numbers = parts.map(p => parseInt(p, 10)).filter(n => !isNaN(n) && n > 0);

    if (numbers.length === 0) return;

    let newNumbers: number[] = [];

    if (numbers.length === 1) {
      // Single number case
      newNumbers = [numbers[0]];
    } else {
      // Range case: from first to last number
      const from = Math.min(...numbers);
      const to = Math.max(...numbers);

      for (let i = from; i <= to; i++) {
        newNumbers.push(i);
      }
    }

    // Filter out numbers that already exist or were removed
    const numbersToAdd = newNumbers.filter(
      num => !serialNumbers.includes(num) && !removedNumbersRef.current.has(num)
    );

    // Add new numbers
    numbersToAdd.forEach(num => {
      append(num as any);
    });

    // Clear input
    setInputValue("");
  };

  const handleRemoveBadge = (index: number) => {
    const numberToRemove = serialNumbers[index];
    removedNumbersRef.current.add(numberToRemove);
    remove(index);
  };

  return (
    <FormField
      control={control}
      name="serialNumbers"
      render={({ field }) => {
        // Ensure field.value is always an array
        const fieldValue: number[] = Array.isArray(field.value) ? field.value : [];

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconHash className="h-4 w-4" />
              Números de Série
            </FormLabel>

            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  value={inputValue}
                  onChange={(value) => {
                    const newValue = typeof value === "string"
                      ? value
                      : (value as any)?.target?.value || "";
                    handleInputChange(newValue);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={disabled ? "Desabilitado (remova placas extras)" : "Digite um número (ex: 5) ou intervalo (ex: 5 10) e pressione Enter"}
                  disabled={disabled}
                  transparent={true}
                  className="flex-1"
                />
                {disabled && (
                  <p className="text-xs text-muted-foreground">
                    Você só pode adicionar números de série se tiver no máximo 1 placa
                  </p>
                )}
              </div>

              {fieldValue.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fieldValue.map((serialNumber: number, index: number) => (
                    <Badge
                      key={`serial-${index}-${serialNumber}`}
                      variant="secondary"
                      className="flex items-center gap-1.5 text-sm pr-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleRemoveBadge(index)}
                    >
                      <span>{serialNumber}</span>
                      <IconX className="h-3.5 w-3.5" />
                    </Badge>
                  ))}
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
