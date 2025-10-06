import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { usePositions, useSectors } from "../../../../hooks";
import { USER_STATUS_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconUser, IconBriefcase, IconBuilding, IconCalendar } from "@tabler/icons-react";
import type { UserGetManyFormData } from "../../../../schemas";

interface UserFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserGetManyFormData>;
  onFilterChange: (filters: Partial<UserGetManyFormData>) => void;
}

export function UserFilters({ open, onOpenChange, filters, onFilterChange }: UserFiltersProps) {

  // Load positions and sectors for dropdowns
  const { data: positions } = usePositions({ limit: 100 });
  const { data: sectors } = useSectors({ limit: 100 });

  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Get current values for multi-select components
  const selectedStatuses = localFilters.status || [];
  const selectedPositions = localFilters.positionId || [];
  const selectedSectors = localFilters.sectorId || [];

  const handleApplyFilters = () => {
    // Apply all filters at once using the external callback
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    // Reset using the external callback
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleStatusChange = (statuses: string[]) => {
    setLocalFilters({ ...localFilters, status: statuses.length > 0 ? statuses : undefined });
  };

  const handlePositionChange = (positions: string[]) => {
    setLocalFilters({ ...localFilters, positionId: positions.length > 0 ? positions : undefined });
  };

  const handleSectorChange = (sectors: Set<string>) => {
    const sectorArray = Array.from(sectors);
    setLocalFilters({ ...localFilters, sectorId: sectorArray.length > 0 ? sectorArray : undefined });
  };

  const statusOptions = Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const positionOptions =
    positions?.data?.map((position) => ({
      value: position.id,
      label: position.name,
    })) || [];

  const sectorOptions =
    sectors?.data?.map((sector) => ({
      value: sector.id,
      label: sector.name,
    })) || [];

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros Avançados
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4" style={{ maxHeight: "calc(90vh - 140px)" }}>
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconUser className="h-4 w-4" />
                Status
              </Label>
              <Combobox mode="multiple" options={statusOptions} value={selectedStatuses} onValueChange={handleStatusChange} placeholder="Selecione os status" />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconBriefcase className="h-4 w-4" />
                Cargo
              </Label>
              <Combobox mode="multiple" options={positionOptions} value={selectedPositions} onValueChange={handlePositionChange} placeholder="Selecione os cargos" />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconBuilding className="h-4 w-4" />
                Setor
              </Label>
              <Combobox
                mode="multiple"
                options={sectorOptions}
                value={selectedSectors}
                onValueChange={(sectors) => handleSectorChange(new Set(sectors))}
                placeholder="Selecione os setores"
              />
            </div>

            <div className="space-y-4">
              <DateTimeInput
                mode="date-range"
                value={{
                  from: localFilters.birthDate?.gte,
                  to: localFilters.birthDate?.lte,
                }}
                onChange={(dateRange: DateRange | null) => {
                  if (!dateRange || (!dateRange.from && !dateRange.to)) {
                    setLocalFilters({ ...localFilters, birthDate: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      birthDate: {
                        ...(dateRange.from && { gte: dateRange.from }),
                        ...(dateRange.to && { lte: dateRange.to }),
                      },
                    });
                  }
                }}
                label={
                  <div className="flex items-center gap-2 mb-2">
                    <IconCalendar className="h-4 w-4" />
                    Data de Nascimento
                  </div>
                }
                placeholder="Selecionar período..."
                description="Filtra por período de nascimento do usuário"
                context="birth"
                numberOfMonths={2}
              />

              <DateTimeInput
                mode="date-range"
                value={{
                  from: localFilters.hireDate?.gte,
                  to: localFilters.hireDate?.lte,
                }}
                onChange={(dateRange: DateRange | null) => {
                  if (!dateRange || (!dateRange.from && !dateRange.to)) {
                    setLocalFilters({ ...localFilters, hireDate: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      hireDate: {
                        ...(dateRange.from && { gte: dateRange.from }),
                        ...(dateRange.to && { lte: dateRange.to }),
                      },
                    });
                  }
                }}
                label={
                  <div className="flex items-center gap-2 mb-2">
                    <IconCalendar className="h-4 w-4" />
                    Data de Admissão
                  </div>
                }
                placeholder="Selecionar período..."
                description="Filtra por período de admissão do usuário"
                context="hire"
                numberOfMonths={2}
              />

              <DateTimeInput
                mode="date-range"
                value={{
                  from: localFilters.dismissedAt?.gte,
                  to: localFilters.dismissedAt?.lte,
                }}
                onChange={(dateRange: DateRange | null) => {
                  if (!dateRange || (!dateRange.from && !dateRange.to)) {
                    setLocalFilters({ ...localFilters, dismissedAt: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      dismissedAt: {
                        ...(dateRange.from && { gte: dateRange.from }),
                        ...(dateRange.to && { lte: dateRange.to }),
                      },
                    });
                  }
                }}
                label={
                  <div className="flex items-center gap-2 mb-2">
                    <IconCalendar className="h-4 w-4" />
                    Data de Demissão
                  </div>
                }
                placeholder="Selecionar período..."
                description="Filtra por período de demissão do usuário"
                numberOfMonths={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleResetFilters}>
            Limpar Filtros
          </Button>
          <Button onClick={handleApplyFilters}>Aplicar Filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
