import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Badge } from "@/components/ui/badge";
import { getPositions, getSectors } from "../../../../api-client";
import { USER_STATUS_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconUser, IconBriefcase, IconBuilding, IconCalendar, IconX } from "@tabler/icons-react";
import type { UserGetManyFormData } from "../../../../schemas";

interface UserFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserGetManyFormData>;
  onFilterChange: (filters: Partial<UserGetManyFormData>) => void;
}

export function UserFilters({ open, onOpenChange, filters, onFilterChange }: UserFiltersProps) {
  // Cache refs for selected items in multiple mode
  const positionCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const sectorCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

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

  const handleSectorChange = (sectors: string[]) => {
    setLocalFilters({ ...localFilters, sectorId: sectors.length > 0 ? sectors : undefined });
  };

  // Status options (static, no async needed)
  const statusOptions = Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Async query function for positions
  const queryPositions = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPositions(queryParams);
      const positions = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = positions.map((position) => {
        const option = {
          value: position.id,
          label: position.name,
        };
        // Add to cache for multiple mode
        positionCacheRef.current.set(position.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching positions:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Async query function for sectors
  const querySectors = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getSectors(queryParams);
      const sectors = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = sectors.map((sector) => {
        const option = {
          value: sector.id,
          label: sector.name,
        };
        // Add to cache for multiple mode
        sectorCacheRef.current.set(sector.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching sectors:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros Avançados
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Filtre os usuários por status, cargo, setor, datas de nascimento, demissão e contratação
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconUser className="h-4 w-4" />
                Status
              </Label>
              <Combobox
                mode="multiple"
                options={statusOptions}
                value={selectedStatuses}
                onValueChange={handleStatusChange}
                placeholder="Selecione os status"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconBriefcase className="h-4 w-4" />
                Cargo
              </Label>
              <Combobox
                async={true}
                mode="multiple"
                queryKey={["positions"]}
                queryFn={queryPositions}
                initialOptions={[]}
                value={selectedPositions}
                onValueChange={handlePositionChange}
                placeholder="Selecione os cargos"
                searchable={true}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconBuilding className="h-4 w-4" />
                Setor
              </Label>
              <Combobox
                async={true}
                mode="multiple"
                queryKey={["sectors"]}
                queryFn={querySectors}
                initialOptions={[]}
                value={selectedSectors}
                onValueChange={handleSectorChange}
                placeholder="Selecione os setores"
                searchable={true}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
              />
            </div>

            <div className="space-y-6">
              {/* Birth Date Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  Data de Nascimento
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.birth?.gte}
                      onChange={(date: Date | null) => {
                        if (!date && !localFilters.birth?.lte) {
                          setLocalFilters({ ...localFilters, birth: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            birth: {
                              ...(date && { gte: date }),
                              ...(localFilters.birth?.lte && { lte: localFilters.birth.lte }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.birth?.lte}
                      onChange={(date: Date | null) => {
                        if (!date && !localFilters.birth?.gte) {
                          setLocalFilters({ ...localFilters, birth: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            birth: {
                              ...(localFilters.birth?.gte && { gte: localFilters.birth.gte }),
                              ...(date && { lte: date }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data final..."
                    />
                  </div>
                </div>
              </div>

              {/* Dismissed Date Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  Data de Demissão
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.dismissedAt?.gte}
                      onChange={(date: Date | null) => {
                        if (!date && !localFilters.dismissedAt?.lte) {
                          setLocalFilters({ ...localFilters, dismissedAt: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            dismissedAt: {
                              ...(date && { gte: date }),
                              ...(localFilters.dismissedAt?.lte && { lte: localFilters.dismissedAt.lte }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.dismissedAt?.lte}
                      onChange={(date: Date | null) => {
                        if (!date && !localFilters.dismissedAt?.gte) {
                          setLocalFilters({ ...localFilters, dismissedAt: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            dismissedAt: {
                              ...(localFilters.dismissedAt?.gte && { gte: localFilters.dismissedAt.gte }),
                              ...(date && { lte: date }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data final..."
                    />
                  </div>
                </div>
              </div>

              {/* Exp1 End Date Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  Data de Contratação
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.exp1EndAt?.gte}
                      onChange={(date: Date | null) => {
                        if (!date && !localFilters.exp1EndAt?.lte) {
                          setLocalFilters({ ...localFilters, exp1EndAt: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            exp1EndAt: {
                              ...(date && { gte: date }),
                              ...(localFilters.exp1EndAt?.lte && { lte: localFilters.exp1EndAt.lte }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.exp1EndAt?.lte}
                      onChange={(date: Date | null) => {
                        if (!date && !localFilters.exp1EndAt?.gte) {
                          setLocalFilters({ ...localFilters, exp1EndAt: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            exp1EndAt: {
                              ...(localFilters.exp1EndAt?.gte && { gte: localFilters.exp1EndAt.gte }),
                              ...(date && { lte: date }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data final..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={handleResetFilters} className="flex-1">
                <IconX className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
              <Button onClick={handleApplyFilters} className="flex-1">
                Aplicar Filtros
              </Button>
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}
