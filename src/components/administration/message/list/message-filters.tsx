import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { IconX, IconFilter } from "@tabler/icons-react";
import type { MessageGetManyFormData } from "@/schemas/message";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface MessageFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<MessageGetManyFormData>;
  onFilterChange: (filters: Partial<MessageGetManyFormData>) => void;
}

export function MessageFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: MessageFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const cleared = {};
    setLocalFilters(cleared);
    onFilterChange(cleared);
  };

  const toggleStatus = (status: string) => {
    const currentStatuses = localFilters.status || [];
    const newStatuses = currentStatuses.includes(status as any)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status as any];

    setLocalFilters({
      ...localFilters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
          </SheetTitle>
          <SheetDescription>
            Aplique filtros para refinar os resultados da busca
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status</Label>
            <div className="space-y-2">
              {[
                { value: "draft", label: "Rascunho" },
                { value: "active", label: "Ativa" },
                { value: "archived", label: "Arquivada" },
              ].map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={localFilters.status?.includes(option.value as any) || false}
                    onCheckedChange={() => toggleStatus(option.value)}
                  />
                  <label
                    htmlFor={`status-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Filter - Commented out as not supported by MessageGetManyFormData schema
          <div className="space-y-3">
            <Label className="text-sm font-medium">Prioridade</Label>
            <div className="space-y-2">
              {[
                { value: "low", label: "Baixa" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "Alta" },
              ].map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`priority-${option.value}`}
                    checked={false}
                    onCheckedChange={() => togglePriority(option.value)}
                  />
                  <label
                    htmlFor={`priority-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          */}

          {/* Date Range Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Período de Criação</Label>
            <DateRangePicker
              from={localFilters.createdAt?.gte ? new Date(localFilters.createdAt.gte) : undefined}
              to={localFilters.createdAt?.lte ? new Date(localFilters.createdAt.lte) : undefined}
              onDateRangeChange={(range) => {
                if (range?.from || range?.to) {
                  setLocalFilters({
                    ...localFilters,
                    createdAt: {
                      gte: range.from?.toISOString(),
                      lte: range.to?.toISOString(),
                    },
                  });
                } else {
                  const { createdAt, ...rest } = localFilters;
                  setLocalFilters(rest);
                }
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
              <IconX className="mr-2 h-4 w-4" />
              Limpar
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
