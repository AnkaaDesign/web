import { useState, useEffect } from "react";
import { IconX } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES, SECTOR_PRIVILEGES_LABELS } from "../../../../constants";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filtrar Setores</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              name="privileges"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleClear}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>Aplicar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
