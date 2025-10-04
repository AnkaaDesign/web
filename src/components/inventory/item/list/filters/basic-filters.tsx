import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS } from "../../../../../constants";
import { getStockLevelTextColor } from "../../../../../utils";
import { IconTriangleInverted, IconUser, IconPackages, IconAlertTriangle, IconXboxX } from "@tabler/icons-react";

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
  const handleStockLevelToggle = (level: STOCK_LEVEL) => {
    const currentLevels = stockLevels || [];
    const newLevels = currentLevels.includes(level) ? currentLevels.filter((l) => l !== level) : [...currentLevels, level];
    onStockLevelsChange(newLevels.length > 0 ? newLevels : undefined);
  };
  return (
    <div className="space-y-4">
      {/* Status Switches */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconTriangleInverted className="h-4 w-4" />
          Status e Características
        </Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="showInactive" className="text-sm font-normal flex items-center gap-2">
              <IconXboxX className="h-4 w-4 text-muted-foreground" />
              Mostrar também desativados
            </Label>
            <Switch id="showInactive" checked={showInactive ?? false} onCheckedChange={(checked) => onShowInactiveChange(checked)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="shouldAssignToUser" className="text-sm font-normal flex items-center gap-2">
              <IconUser className="h-4 w-4 text-muted-foreground" />
              Atribuir ao usuário
            </Label>
            <Switch id="shouldAssignToUser" checked={shouldAssignToUser ?? false} onCheckedChange={(checked) => onShouldAssignToUserChange(checked)} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Stock Status */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconPackages className="h-4 w-4" />
          Status de Estoque
        </Label>

        <div className="space-y-3">
          {Object.values(STOCK_LEVEL).map((level) => {
            const colorClass = getStockLevelTextColor(level);
            const isChecked = stockLevels?.includes(level) || false;

            return (
              <div key={level} className="flex items-center justify-between">
                <Label htmlFor={`stock-level-${level}`} className={`text-sm font-normal ${colorClass} flex items-center gap-2`}>
                  <IconPackages className="h-3 w-3" />
                  {STOCK_LEVEL_LABELS[level]}
                </Label>
                <Switch id={`stock-level-${level}`} checked={isChecked} onCheckedChange={() => handleStockLevelToggle(level)} />
              </div>
            );
          })}

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="nearReorderPoint" className="text-sm font-normal text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4" />
              Próximo ao Ponto de Reposição
            </Label>
            <Switch id="nearReorderPoint" checked={nearReorderPoint ?? false} onCheckedChange={(checked) => onNearReorderPointChange(checked)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="noReorderPoint" className="text-sm font-normal text-neutral-500 flex items-center gap-2">
              <IconXboxX className="h-4 w-4" />
              Sem Ponto de Reposição
            </Label>
            <Switch id="noReorderPoint" checked={noReorderPoint ?? false} onCheckedChange={(checked) => onNoReorderPointChange(checked)} />
          </div>
        </div>
      </div>
    </div>
  );
}
