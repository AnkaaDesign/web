import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES, SECTOR_PRIVILEGES_LABELS } from "../../../../constants";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

interface SectorFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: { privileges?: SECTOR_PRIVILEGES }) => void;
  currentPrivilege?: SECTOR_PRIVILEGES;
}

export function SectorFilters({ open, onOpenChange, onApply, currentPrivilege }: SectorFiltersProps) {
  const [privileges, setPrivileges] = useState<SECTOR_PRIVILEGES | undefined>(currentPrivilege);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPrivileges(currentPrivilege);
    }
  }, [open, currentPrivilege]);

  const handleApply = () => {
    onApply({
      privileges: privileges,
    });
    // Close dialog after applying
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleClear = () => {
    setPrivileges(undefined);
    onApply({});
    // Close dialog after clearing
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Setores"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os setores por privilégios"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
          <div className="space-y-2">
            <Label htmlFor="privileges">Privilégios</Label>
            <Combobox
              value={privileges || "all"}
              onValueChange={(value) => setPrivileges(value === "all" ? undefined : (value as SECTOR_PRIVILEGES))}
              options={[
                { value: "all", label: "Todos" },
                ...Object.entries(SECTOR_PRIVILEGES_LABELS).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
              placeholder="Selecione um privilégio"
              searchable={true}
              clearable={false}
              minSearchLength={0}
              name="privileges"
            />
          </div>
    </FilterDrawer>
  );
}
