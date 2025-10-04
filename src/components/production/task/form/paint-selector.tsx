import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { usePaints } from "../../../../hooks";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import { Badge } from "@/components/ui/badge";
import { COLOR_PALETTE_LABELS } from "../../../../constants";

interface PaintSelectorProps {
  control: any;
  disabled?: boolean;
}

const paletteColors: Record<string, string> = {
  BLACK: "#000000",
  GRAY: "#6B7280",
  WHITE: "#FFFFFF",
  SILVER: "#C0C0C0",
  GOLDEN: "#FFD700",
  YELLOW: "#FFEB3B",
  ORANGE: "#FF9800",
  BROWN: "#8B4513",
  RED: "#EF4444",
  PINK: "#EC4899",
  PURPLE: "#9333EA",
  BLUE: "#3B82F6",
  GREEN: "#22C55E",
  BEIGE: "#F5F5DC",
};

export function PaintSelector({ control, disabled }: PaintSelectorProps) {
  // Fetch paints
  const { data: paints, isLoading } = usePaints({
    orderBy: { name: "asc" },
    take: 100,
  });

  const paintOptions =
    paints?.data?.map((paint) => ({
      value: paint.id,
      label: paint.name,
      metadata: paint, // Store full paint object for rendering
    })) || [];

  // Custom render for paint option to show color
  const renderOption = (option: { value: string; label: string; metadata?: any }, isSelected: boolean) => {
    const paint = option.metadata;
    if (!paint) return <span>{option.label}</span>;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {paint.palette && (
            <div
              className="w-4 h-4 rounded-full border border-border shrink-0"
              style={{ backgroundColor: paletteColors[paint.palette] || "#ccc" }}
              title={COLOR_PALETTE_LABELS[paint.palette]}
            />
          )}
          <span>{option.label}</span>
        </div>
        {paint.palette && (
          <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
            {COLOR_PALETTE_LABELS[paint.palette]}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <FormField
      control={control}
      name="paintIds"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tintas do Logo</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || []}
              onValueChange={field.onChange}
              options={paintOptions}
              mode="multiple"
              placeholder="Selecione as tintas..."
              emptyText="Nenhuma tinta disponível"
              searchPlaceholder="Pesquisar por código ou nome..."
              disabled={disabled || isLoading}
              className="w-full"
              renderOption={renderOption}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
