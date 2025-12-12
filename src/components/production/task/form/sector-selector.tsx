import { FormCombobox } from "@/components/ui/form-combobox";
import { useSectors } from "../../../../hooks";
import { createSector } from "../../../../api-client";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import { IconBuilding } from "@tabler/icons-react";
import { useMemo } from "react";

interface SectorSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  productionOnly?: boolean;
}

export function SectorSelector({ control: _control, disabled, required, productionOnly }: SectorSelectorProps) {
  // Fetch all sectors
  const {
    data: sectors,
    isLoading,
    refetch,
  } = useSectors({
    orderBy: { name: "asc" },
  });

  // Filter sectors based on productionOnly flag
  const filteredSectors = useMemo(() => {
    if (!productionOnly || !sectors?.data) return sectors?.data || [];

    return sectors.data.filter((sector) => {
      return sector.privileges === SECTOR_PRIVILEGES.PRODUCTION;
    });
  }, [sectors?.data, productionOnly]);

  const options = useMemo(
    () =>
      filteredSectors.map((sector) => ({
        value: sector.id,
        label: sector.name,
      })),
    [filteredSectors],
  );

  const handleCreateSector = async (name: string) => {
    const result = await createSector({
      name,
      privileges: productionOnly ? SECTOR_PRIVILEGES.PRODUCTION : SECTOR_PRIVILEGES.BASIC,
    });

    if (result.success && result.data) {
      // Refetch sectors to update the list
      await refetch();
    }
  };

  return (
    <FormCombobox
      name="sectorId"
      label="Setor"
      icon={<IconBuilding className="h-4 w-4" />}
      options={options}
      onCreate={handleCreateSector}
      allowCreate={true}
      createLabel={(value) => `Criar setor "${value}"`}
      disabled={disabled}
      required={required || false}
      loading={isLoading}
      placeholder={required ? "Selecione um setor" : "Selecione um setor ou deixe indefinido"}
      emptyText={isLoading ? "Carregando setores..." : productionOnly ? "Nenhum setor de produção encontrado" : "Nenhum setor encontrado"}
    />
  );
}
