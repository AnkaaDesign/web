import React from "react";
import { Label } from "@/components/ui/label";
import { useItems } from "../../../../../hooks";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface MaintenanceEntitySelectorsProps {
  itemIds: string[];
  onItemIdsChange: (ids: string[]) => void;
}

export function MaintenanceEntitySelectors({ itemIds, onItemIdsChange }: MaintenanceEntitySelectorsProps) {
  // Fetch items for the combobox
  const { data: itemsData } = useItems({
    limit: 40,
    orderBy: { name: "asc" },
    where: { isActive: true },
  });

  const itemOptions = React.useMemo((): ComboboxOption[] => {
    if (!itemsData?.data) return [];

    return itemsData.data.map((item) => ({
      value: item.id,
      label: item.name,
      description: item.uniCode ? `Código: ${item.uniCode}` : undefined,
    }));
  }, [itemsData?.data]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Itens de Manutenção</Label>
        <Combobox
          mode="multiple"
          options={itemOptions}
          value={itemIds}
          onValueChange={onItemIdsChange}
          placeholder="Selecione os itens..."
          searchPlaceholder="Buscar itens..."
          searchable={true}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Filtra manutenções dos itens selecionados</p>
      </div>
    </div>
  );
}
