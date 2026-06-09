import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { IconBuildingStore } from "@tabler/icons-react";

interface BasicFiltersProps {
  hasLogo?: boolean;
  onHasLogoChange: (value: boolean | undefined) => void;
  hasItems?: boolean;
  onHasItemsChange: (value: boolean | undefined) => void;
  hasOrders?: boolean;
  onHasOrdersChange: (value: boolean | undefined) => void;
}

export function BasicFilters({ hasLogo, onHasLogoChange, hasItems, onHasItemsChange, hasOrders, onHasOrdersChange }: BasicFiltersProps) {
  const selected: string[] = [];
  if (hasLogo) selected.push("hasLogo");
  if (hasItems) selected.push("hasItems");
  if (hasOrders) selected.push("hasOrders");

  const handleChange = (value: string | string[] | null | undefined) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    onHasLogoChange(values.includes("hasLogo") ? true : false);
    onHasItemsChange(values.includes("hasItems") ? true : false);
    onHasOrdersChange(values.includes("hasOrders") ? true : false);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium flex items-center gap-2">
        <IconBuildingStore className="h-4 w-4" />
        Características
      </Label>
      <Combobox
        mode="multiple"
        value={selected}
        onValueChange={handleChange}
        options={[
          { value: "hasLogo", label: "Tem logotipo" },
          { value: "hasItems", label: "Tem itens cadastrados" },
          { value: "hasOrders", label: "Tem pedidos realizados" },
        ]}
        placeholder="Selecione..."
        searchable={false}
        clearable
      />
    </div>
  );
}
