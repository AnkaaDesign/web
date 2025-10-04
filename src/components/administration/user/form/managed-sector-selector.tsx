import { FormCombobox } from "@/components/ui/form-combobox";
import { useSectors } from "../../../../hooks";
import { IconShield } from "@tabler/icons-react";
import { useMemo } from "react";

interface ManagedSectorSelectorProps {
  disabled?: boolean;
}

export function ManagedSectorSelector({ disabled }: ManagedSectorSelectorProps) {
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
      label="Líder de Setor"
      description="Selecione se este usuário é líder de algum setor"
      icon={<IconShield className="h-4 w-4" />}
      options={options}
      disabled={disabled}
      loading={isLoading}
      placeholder="Selecione um setor"
      emptyText={isLoading ? "Carregando setores..." : "Nenhum setor encontrado"}
    />
  );
}
