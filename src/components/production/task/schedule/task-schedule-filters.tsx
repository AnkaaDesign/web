import React from "react";
import type { TaskGetManyFormData } from "../../../../schemas";
import type { Sector } from "../../../../types";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { TASK_STATUS } from "../../../../constants";

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
      status: [TASK_STATUS.PENDING, TASK_STATUS.IN_PRODUCTION],
      limit: 1000,
    };
    setLocalFilters(resetFilters);
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
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Nome, número de série..."
              value={localFilters.searchingFor || ""}
              onChange={(value) => setLocalFilters({ ...localFilters, searchingFor: value as string })}
            />
          </div>

          {/* Sectors */}
          <div className="space-y-2">
            <Label>Equipes</Label>
            <Combobox
              mode="multiple"
              options={sectors.map((sector) => ({
                value: sector.id,
                label: sector.name,
              }))}
              value={localFilters.sectorIds || []}
              onValueChange={(value: string[]) => setLocalFilters({ ...localFilters, sectorIds: value })}
              placeholder="Selecione as equipes"
            />
          </div>

          {/* Term Range */}
          <div className="space-y-2">
            <Label>Período do Prazo</Label>
            <DateTimeInput
              mode="date-range"
              value={
                localFilters.termRange
                  ? {
                      from: localFilters.termRange.from as Date | undefined,
                      to: localFilters.termRange.to as Date | undefined,
                    }
                  : undefined
              }
              onChange={(range) => {
                if (range && typeof range === "object" && "from" in range && (range.from || range.to)) {
                  setLocalFilters({
                    ...localFilters,
                    termRange: {
                      from: range.from || undefined,
                      to: range.to || undefined,
                    },
                  });
                } else {
                  const { termRange, ...rest } = localFilters;
                  setLocalFilters(rest);
                }
              }}
              placeholder="Selecionar período do prazo"
              numberOfMonths={2}
            />
          </div>

          {/* Show Overdue Only */}
          <div className="flex items-center space-x-2">
            <Switch id="overdue" checked={localFilters.isOverdue || false} onCheckedChange={(checked) => setLocalFilters({ ...localFilters, isOverdue: checked })} />
            <Label htmlFor="overdue">Mostrar apenas tarefas atrasadas</Label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
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
