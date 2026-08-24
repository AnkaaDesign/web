import { useFieldArray, useWatch } from "react-hook-form";
import { useState, useRef } from "react";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { formatPlate, isValidPlate, maskPlateInput, PLATE_INVALID_MESSAGE } from "@/utils";
import { IconX, IconLicense } from "@tabler/icons-react";

interface PlateTagsInputProps {
  control: any;
  disabled?: boolean;
}

export function PlateTagsInput({ control, disabled }: PlateTagsInputProps) {
  const [newPlate, setNewPlate] = useState<string>("");
  const justCommittedRef = useRef(false);

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
    if (justCommittedRef.current) {
      justCommittedRef.current = false;
      return;
    }
    // O array do formulário guarda SEMPRE a placa limpa (ABC1234 / ABC1D23); o hífen
    // que aparece na tag vem de `formatPlate` e nunca é gravado — as colunas de busca
    // do banco preservam pontuação, então placa com hífen some da busca.
    const plate = maskPlateInput(newPlate);

    if (!plate) return;

    if (!isValidPlate(plate)) {
      // `id` fixo: Enter e o blur seguinte disparam a mesma rejeição — sem isso o
      // usuário levaria dois toasts idênticos empilhados.
      toast.error(PLATE_INVALID_MESSAGE, { id: "plate-tags-invalid" });
      return;
    }

    if (plates.includes(plate)) {
      toast.error("Esta placa já foi adicionada", { id: "plate-tags-duplicate" });
      return;
    }

    append(plate as any);
    setNewPlate("");
    justCommittedRef.current = true;
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
                type="plate"
                value={newPlate}
                onChange={(value) => {
                  // `type="plate"` já devolve o valor mascarado e limpo (ou null quando vazio).
                  setNewPlate(maskPlateInput(typeof value === "string" ? value : ""));
                }}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPlate();
                  }
                }}
                onBlur={handleAddPlate}
                placeholder={disabled ? "Desabilitado (remova números de série extras)" : "Digite uma placa e pressione Enter (ex: ABC-1234 ou ABC1D23)"}
                disabled={disabled}
                transparent={true}
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
                      <span>{formatPlate(plate)}</span>
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
