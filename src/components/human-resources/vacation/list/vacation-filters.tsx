import { useState } from "react";
import { IconX } from "@tabler/icons-react";

import { VACATION_STATUS, VACATION_STATUS_LABELS, VACATION_TYPE, VACATION_TYPE_LABELS } from "../../../../constants";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";

interface VacationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: { status?: VACATION_STATUS; type?: VACATION_TYPE; isCollective?: boolean; year?: number }) => void;
  currentStatus?: VACATION_STATUS;
  currentType?: VACATION_TYPE;
  currentIsCollective?: boolean;
  currentYear?: number;
}

export function VacationFilters({ open, onOpenChange, onApply, currentStatus, currentType, currentIsCollective, currentYear }: VacationFiltersProps) {
  const [status, setStatus] = useState<VACATION_STATUS | "">(currentStatus || "");
  const [type, setType] = useState<VACATION_TYPE | "">(currentType || "");
  const [isCollective, setIsCollective] = useState(currentIsCollective || false);
  const [year, setYear] = useState<string>(currentYear?.toString() || new Date().getFullYear().toString());

  // Generate year options (current year +/- 5 years)
  const currentYearNum = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYearNum - 5 + i);

  const handleApply = () => {
    onApply({
      status: status || undefined,
      type: type || undefined,
      isCollective: isCollective || undefined,
      year: year ? parseInt(year) : undefined,
    });
  };

  const handleClear = () => {
    setStatus("");
    setType("");
    setIsCollective(false);
    setYear(new Date().getFullYear().toString());
    onApply({
      status: undefined,
      type: undefined,
      isCollective: undefined,
      year: undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filtrar Férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Combobox
              value={status}
              onValueChange={(value) => setStatus((value as VACATION_STATUS) || "")}
              options={[
                { value: "", label: "Todos" },
                ...Object.entries(VACATION_STATUS_LABELS).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
              placeholder="Todos os status"
              searchable={false}
              clearable={false}
              name="status"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Combobox
              value={type}
              onValueChange={(value) => setType((value as VACATION_TYPE) || "")}
              options={[
                { value: "", label: "Todos" },
                ...Object.entries(VACATION_TYPE_LABELS).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
              placeholder="Todos os tipos"
              searchable={false}
              clearable={false}
              name="type"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Ano</Label>
            <Combobox
              value={year}
              onValueChange={(value) => setYear(value || new Date().getFullYear().toString())}
              options={yearOptions.map((yearOption) => ({
                value: yearOption.toString(),
                label: yearOption.toString(),
              }))}
              placeholder="Selecione o ano"
              searchable={false}
              clearable={false}
              name="year"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="collective" checked={isCollective} onCheckedChange={(checked) => setIsCollective(checked as boolean)} />
            <Label htmlFor="collective" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Apenas férias coletivas
            </Label>
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
