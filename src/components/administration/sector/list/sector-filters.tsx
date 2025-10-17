import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES, SECTOR_PRIVILEGES_LABELS } from "../../../../constants";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtrar Setores
          </SheetTitle>
          <SheetDescription>
            Filtre os setores por privilégios
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
