import type { PositionCreateFormData, PositionUpdateFormData } from "../../../../schemas";
import { useSectors } from "../../../../hooks";
import { FormCombobox } from "@/components/ui/form-combobox";
import { useMemo } from "react";

interface SectorSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function SectorSelector({ control, disabled, required }: SectorSelectorProps) {
  const { data: sectors, isLoading } = useSectors({
    limit: 100, // Load all sectors for selection
  });

  const options = useMemo(() => {
    const sectorOptions = (sectors?.data || []).map((sector) => ({
      value: sector.id,
      label: sector.name,
    }));

    // Add "none" option at the beginning
    return [{ value: "none", label: "Nenhum setor" }, ...sectorOptions];
  }, [sectors?.data]);

  return (
    <FormCombobox
      name="sectorId"
      label="Setor"
      options={options}
      disabled={disabled || isLoading}
      loading={isLoading}
      required={required}
      placeholder="Selecione um setor"
      emptyText={isLoading ? "Carregando setores..." : "Nenhum setor encontrado"}
    />
  );
}
