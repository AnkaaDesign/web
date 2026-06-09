import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS } from "../../../../../constants";
import { IconTriangleInverted, IconPackages } from "@tabler/icons-react";

// Plain-Portuguese helpers for each stock band — explain inline (no jargon).
// Mirrors algorithm-spec §15 bands.
const STOCK_LEVEL_FILTER_HELPERS: Record<STOCK_LEVEL, string> = {
  [STOCK_LEVEL.NEGATIVE_STOCK]: "Quantidade abaixo de zero — provável erro de lançamento",
  [STOCK_LEVEL.OUT_OF_STOCK]: "Sem nenhuma unidade em estoque",
  [STOCK_LEVEL.CRITICAL]: "Estoque atingiu o ponto de reposição — precisa de pedido",
  [STOCK_LEVEL.LOW]: "Estoque um pouco acima do ponto de reposição",
  [STOCK_LEVEL.OPTIMAL]: "Estoque dentro do nível esperado",
  [STOCK_LEVEL.OVERSTOCKED]: "Estoque acima da quantidade máxima",
};

interface BasicFiltersProps {
  showInactive?: boolean;
  onShowInactiveChange: (value: boolean | undefined) => void;
  shouldAssignToUser?: boolean;
  onShouldAssignToUserChange: (value: boolean | undefined) => void;
  stockLevels?: STOCK_LEVEL[];
  onStockLevelsChange: (value: STOCK_LEVEL[] | undefined) => void;
  nearReorderPoint?: boolean;
  onNearReorderPointChange: (value: boolean | undefined) => void;
  noReorderPoint?: boolean;
  onNoReorderPointChange: (value: boolean | undefined) => void;
}

export function BasicFilters({
  showInactive,
  onShowInactiveChange,
  shouldAssignToUser,
  onShouldAssignToUserChange,
  stockLevels,
  onStockLevelsChange,
  nearReorderPoint,
  onNearReorderPointChange,
  noReorderPoint,
  onNoReorderPointChange,
}: BasicFiltersProps) {
  const charSelected: string[] = [];
  if (showInactive) charSelected.push("showInactive");
  if (shouldAssignToUser) charSelected.push("shouldAssignToUser");
  if (nearReorderPoint) charSelected.push("nearReorderPoint");
  if (noReorderPoint) charSelected.push("noReorderPoint");

  const handleCharChange = (value: string | string[] | null | undefined) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    onShowInactiveChange(values.includes("showInactive") ? true : false);
    onShouldAssignToUserChange(values.includes("shouldAssignToUser") ? true : false);
    onNearReorderPointChange(values.includes("nearReorderPoint") ? true : false);
    onNoReorderPointChange(values.includes("noReorderPoint") ? true : false);
  };

  return (
    <div className="space-y-4">
      {/* Status and Characteristics */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconTriangleInverted className="h-4 w-4" />
          Status e Características
        </Label>
        <Combobox
          mode="multiple"
          value={charSelected}
          onValueChange={handleCharChange}
          options={[
            { value: "showInactive", label: "Mostrar também desativados" },
            { value: "shouldAssignToUser", label: "Atribuir ao usuário" },
            { value: "nearReorderPoint", label: "Próximo ao Ponto de Reposição" },
            { value: "noReorderPoint", label: "Sem Ponto de Reposição" },
          ]}
          placeholder="Selecione..."
          searchable={false}
          clearable
        />
      </div>

      <Separator />

      {/* Stock Status */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconPackages className="h-4 w-4" />
          Status de Estoque
        </Label>
        <Combobox
          mode="multiple"
          value={stockLevels || []}
          onValueChange={(value) => {
            const values = Array.isArray(value) ? (value as STOCK_LEVEL[]) : [];
            onStockLevelsChange(values.length > 0 ? values : undefined);
          }}
          options={Object.values(STOCK_LEVEL).map((level) => ({
            value: level,
            label: STOCK_LEVEL_LABELS[level],
            description: STOCK_LEVEL_FILTER_HELPERS[level],
          }))}
          placeholder="Selecione..."
          searchable={false}
          clearable
        />
      </div>
    </div>
  );
}
