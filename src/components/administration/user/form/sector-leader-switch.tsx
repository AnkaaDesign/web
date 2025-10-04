import { FormCombobox } from "@/components/ui/form-combobox";
import { useSectors } from "../../../../hooks";
import { IconCrown } from "@tabler/icons-react";
import { useMemo } from "react";

interface SectorLeaderSwitchProps {
  disabled?: boolean;
}

export function SectorLeaderSwitch({ disabled }: SectorLeaderSwitchProps) {
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
      name="managedSectorId"
      label="Líder do Setor"
      icon={<IconCrown className="h-4 w-4 text-muted-foreground" />}
      options={options}
      disabled={disabled}
      loading={isLoading}
      placeholder="Selecione o setor que será gerenciado"
      required={false}
      emptyText={isLoading ? "Carregando setores..." : "Nenhum setor encontrado"}
      description="Selecione qual setor este colaborador irá liderar (opcional)"
    />
  );
}
