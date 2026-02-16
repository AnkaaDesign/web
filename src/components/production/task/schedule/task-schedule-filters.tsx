import React from "react";
import type { TaskGetManyFormData } from "../../../../schemas";
import type { Sector } from "../../../../types";
import type { DateRange } from "react-day-picker";
import { IconFilter, IconX } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { TASK_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";

interface TaskScheduleFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TaskGetManyFormData>;
  onFilterChange: (filters: Partial<TaskGetManyFormData>) => void;
  sectors: Sector[];
}

export function TaskScheduleFilters({ open, onOpenChange, filters, onFilterChange, sectors }: TaskScheduleFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState<Partial<TaskGetManyFormData>>(filters);

  // Sync local filters when modal opens
  React.useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: Partial<TaskGetManyFormData> = {
      status: [TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.IN_PRODUCTION],
      limit: 1000,
    };
    setLocalFilters(resetFilters);
  };

  const handleFromChange = (date: Date | DateRange | null) => {
    if (date && !(date instanceof Date)) return;
    if (!date && !localFilters.termRange?.to) {
      const { termRange, ...rest } = localFilters;
      setLocalFilters(rest);
    } else {
      setLocalFilters({
        ...localFilters,
        termRange: {
          ...(date && { from: date }),
          ...(localFilters.termRange?.to && { to: localFilters.termRange.to }),
        },
      });
    }
  };

  const handleToChange = (date: Date | DateRange | null) => {
    if (date && !(date instanceof Date)) return;
    if (!date && !localFilters.termRange?.from) {
      const { termRange, ...rest } = localFilters;
      setLocalFilters(rest);
    } else {
      setLocalFilters({
        ...localFilters,
        termRange: {
          ...(localFilters.termRange?.from && { from: localFilters.termRange.from }),
          ...(date && { to: date }),
        },
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros do Cronograma
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar sua busca por tarefas no cronograma
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Sectors */}
          <div className="space-y-2">
            <Label>Setores</Label>
            <Combobox
              mode="multiple"
              options={sectors
                .filter((sector) => sector.privileges === SECTOR_PRIVILEGES.PRODUCTION)
                .map((sector) => ({
                  value: sector.id,
                  label: sector.name,
                }))}
              value={localFilters.sectorIds || []}
              onValueChange={(value) => {
                if (Array.isArray(value)) {
                  setLocalFilters({ ...localFilters, sectorIds: value });
                }
              }}
              placeholder="Selecione os setores"
            />
          </div>

          {/* Term Range */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Período do Prazo</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localFilters.termRange?.from as Date | undefined}
                  onChange={handleFromChange}
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={localFilters.termRange?.to as Date | undefined}
                  onChange={handleToChange}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Show Overdue Only */}
          <div className="flex items-center space-x-2 mb-4">
            <Switch id="overdue" checked={localFilters.isOverdue || false} onCheckedChange={(checked) => setLocalFilters({ ...localFilters, isOverdue: checked })} />
            <Label htmlFor="overdue">Mostrar apenas tarefas atrasadas</Label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
