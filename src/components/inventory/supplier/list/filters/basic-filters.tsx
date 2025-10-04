import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { IconPhoto, IconPackages, IconShoppingCart, IconBuildingStore } from "@tabler/icons-react";

interface BasicFiltersProps {
  hasLogo?: boolean;
  onHasLogoChange: (value: boolean | undefined) => void;
  hasItems?: boolean;
  onHasItemsChange: (value: boolean | undefined) => void;
  hasOrders?: boolean;
  onHasOrdersChange: (value: boolean | undefined) => void;
}

export function BasicFilters({ hasLogo, onHasLogoChange, hasItems, onHasItemsChange, hasOrders, onHasOrdersChange }: BasicFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Business Information */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconBuildingStore className="h-4 w-4" />
          Informações da Empresa
        </Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasLogo" className="text-sm font-normal flex items-center gap-2">
              <IconPhoto className="h-4 w-4 text-muted-foreground" />
              Tem logotipo
            </Label>
            <Switch id="hasLogo" checked={hasLogo ?? false} onCheckedChange={(checked) => onHasLogoChange(checked)} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Business Activity */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <IconShoppingCart className="h-4 w-4" />
          Atividade Comercial
        </Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasItems" className="text-sm font-normal flex items-center gap-2">
              <IconPackages className="h-4 w-4 text-muted-foreground" />
              Tem itens cadastrados
            </Label>
            <Switch id="hasItems" checked={hasItems ?? false} onCheckedChange={(checked) => onHasItemsChange(checked)} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="hasOrders" className="text-sm font-normal flex items-center gap-2">
              <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
              Tem pedidos realizados
            </Label>
            <Switch id="hasOrders" checked={hasOrders ?? false} onCheckedChange={(checked) => onHasOrdersChange(checked)} />
          </div>
        </div>
      </div>
    </div>
  );
}
