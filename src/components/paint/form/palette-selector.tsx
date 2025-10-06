import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { PaintCreateFormData, PaintUpdateFormData } from "../../../schemas";
import { COLOR_PALETTE, COLOR_PALETTE_LABELS, COLOR_PALETTE_ORDER } from "../../../constants";
import { IconPalette } from "@tabler/icons-react";

interface PaletteSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

const paletteColors: Record<COLOR_PALETTE, string> = {
  [COLOR_PALETTE.BLACK]: "#000000",
  [COLOR_PALETTE.GRAY]: "#6B7280",
  [COLOR_PALETTE.WHITE]: "#FFFFFF",
  [COLOR_PALETTE.SILVER]: "#C0C0C0",
  [COLOR_PALETTE.GOLDEN]: "#FFD700",
  [COLOR_PALETTE.YELLOW]: "#FFEB3B",
  [COLOR_PALETTE.ORANGE]: "#FF9800",
  [COLOR_PALETTE.BROWN]: "#8B4513",
  [COLOR_PALETTE.RED]: "#EF4444",
  [COLOR_PALETTE.PINK]: "#EC4899",
  [COLOR_PALETTE.PURPLE]: "#9333EA",
  [COLOR_PALETTE.BLUE]: "#3B82F6",
  [COLOR_PALETTE.GREEN]: "#22C55E",
  [COLOR_PALETTE.BEIGE]: "#F5F5DC",
};

export function PaletteSelector({ control, disabled, required }: PaletteSelectorProps) {
  const options = Object.values(COLOR_PALETTE)
    .sort((a, b) => COLOR_PALETTE_ORDER[a] - COLOR_PALETTE_ORDER[b])
    .map((palette) => ({
      value: palette,
      label: COLOR_PALETTE_LABELS[palette],
      metadata: {
        color: paletteColors[palette],
      },
    }));

  return (
    <FormField
      control={control}
      name="palette"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconPalette className="h-4 w-4" />
            Paleta de Cores
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              options={options}
              value={field.value}
              onValueChange={field.onChange}
              placeholder="Selecione a paleta de cores"
              disabled={disabled}
              mode="single"
              searchable={true}
              clearable={true}
              emptyText="Nenhuma paleta encontrada"
              searchPlaceholder="Pesquisar paleta..."
              className="bg-transparent"
              renderOption={(option, isSelected) => (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: option.metadata?.color }} />
                  <span>{option.label}</span>
                </div>
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
