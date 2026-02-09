import { useFieldArray, useWatch } from "react-hook-form";
import { useState } from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconX, IconLicense } from "@tabler/icons-react";

interface PlateTagsInputProps {
  control: any;
  disabled?: boolean;
}

export function PlateTagsInput({ control, disabled }: PlateTagsInputProps) {
  const [newPlate, setNewPlate] = useState<string>("");

  // Watch the plates array
  const watchedPlates = useWatch({
    control,
    name: "plates",
  });

  // Ensure plates is always an array
  const plates: string[] = Array.isArray(watchedPlates) ? watchedPlates : [];

  const { append, remove } = useFieldArray({
    control,
    name: "plates",
  });

  const handleAddPlate = () => {
    const trimmedPlate = newPlate.trim().toUpperCase();

    // Simple validation: just check if not empty and not duplicate
    if (trimmedPlate && !plates.includes(trimmedPlate)) {
      append(trimmedPlate as any);
      setNewPlate("");
    }
  };

  return (
    <FormField
      control={control}
      name="plates"
      render={({ field }) => {
        // Ensure field.value is always an array
        const fieldValue: string[] = Array.isArray(field.value) ? field.value : [];

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconLicense className="h-4 w-4" />
              Placas
            </FormLabel>

            <div className="space-y-2">
              <Input
                type="text"
                value={newPlate}
                onChange={(value) => {
                  // Handle both event and direct value from custom Input component
                  const newValue = typeof value === "string"
                    ? value
                    : (value as any)?.target?.value || "";
                  setNewPlate(newValue.toUpperCase());
                }}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPlate();
                  }
                }}
                placeholder={disabled ? "Desabilitado (remova números de série extras)" : "Digite uma placa e pressione Enter (ex: ABC1234)"}
                disabled={disabled}
                transparent={true}
                className="uppercase"
              />
              {disabled && (
                <p className="text-xs text-muted-foreground">
                  Você só pode adicionar placas se tiver no máximo 1 número de série
                </p>
              )}

              {fieldValue.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fieldValue.map((plate: string, index: number) => (
                    <Badge
                      key={`plate-${index}`}
                      variant="secondary"
                      className="flex items-center gap-1.5 text-sm pr-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => remove(index)}
                    >
                      <span>{plate}</span>
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
