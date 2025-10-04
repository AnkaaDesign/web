import { FormCombobox } from "@/components/ui/form-combobox";
import { useSectors } from "../../../../hooks";
import { IconBuilding } from "@tabler/icons-react";
import { useMemo } from "react";

interface SectorSelectorProps {
  disabled?: boolean;
  required?: boolean;
}

export function SectorSelector({ disabled, required }: SectorSelectorProps) {
  const { data: sectors, isLoading } = useSectors({
    orderBy: { name: "asc" },
  });

  const options = useMemo(
    () =>
      (sectors?.data || []).map((sector) => ({
        value: sector.id,
        label: sector.name,
      })),
    [sectors?.data],
  );

  return (
    <FormCombobox
      name="sectorId"
      label="Setor"
      icon={<IconBuilding className="h-4 w-4 text-muted-foreground" />}
      options={options}
      disabled={disabled}
      loading={isLoading}
      placeholder="Selecione o setor do colaborador"
      required={required}
      emptyText={isLoading ? "Carregando setores..." : "Nenhum setor encontrado"}
    />
  );
}
