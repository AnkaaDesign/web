import React from "react";
import type { TaskGetManyFormData } from "../../../../schemas";
import type { Sector } from "../../../../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Filtros do Cronograma</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Nome, número de série..."
              value={localFilters.searchingFor || ""}
              onChange={(e) => setLocalFilters({ ...localFilters, searchingFor: e.target.value })}
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

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Limpar
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
