import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconFilter, IconX } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";
import { CUT_STATUS, CUT_TYPE, CUT_ORIGIN, SECTOR_PRIVILEGES } from "../../../../constants";
import { CUT_STATUS_LABELS, CUT_TYPE_LABELS, CUT_ORIGIN_LABELS } from "../../../../constants";
import type { CutGetManyFormData } from "../../../../schemas";
import type { Sector } from "../../../../types";
import { useSectors } from "../../../../hooks";

interface CutItemFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<CutGetManyFormData>;
  onFilterChange: (filters: Partial<CutGetManyFormData>) => void;
}

interface FilterState {
  statuses: CUT_STATUS[];
  types: CUT_TYPE[];
  origin: string;
  sectorIds: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

// Special value for tasks without a sector
const UNDEFINED_SECTOR_VALUE = "__UNDEFINED__";

export function CutItemFilters({ open, onOpenChange, filters, onFilterChange }: CutItemFiltersProps) {
  // Fetch production sectors
  const { data: sectorsData } = useSectors({ limit: 100, orderBy: { name: "asc" } });
  const sectors = (sectorsData?.data || []).filter(
    (sector: Sector) => sector.privileges === SECTOR_PRIVILEGES.PRODUCTION
  );

  const [localState, setLocalState] = useState<FilterState>({
    statuses: [],
    types: [],
    origin: "all",
    sectorIds: [],
    createdAfter: undefined,
    createdBefore: undefined,
  });

  // Initialize local state from filters when dialog opens
  useEffect(() => {
    if (!open) return;

    const where = filters.where as any;

    // Parse sector filter - handle both regular IDs and the special "undefined" value
    let sectorIds: string[] = [];
    if (where?.task?.sectorId?.in) {
      sectorIds = where.task.sectorId.in;
    }
    // Check if filtering for tasks without sector
    if (where?.task?.sectorId === null) {
      sectorIds = [UNDEFINED_SECTOR_VALUE];
    }

    setLocalState({
      statuses: where?.status?.in || [],
      types: where?.type?.in || [],
      origin: where?.origin || "all",
      sectorIds,
      createdAfter: filters.createdAt?.gte,
      createdBefore: filters.createdAt?.lte,
    });
  }, [open, filters]);

  const handleApply = () => {
    const newFilters: Partial<CutGetManyFormData> = {
      ...filters,
      where: {},
    };

    // Status
    if (localState.statuses.length > 0) {
      (newFilters.where as any).status = { in: localState.statuses };
    }

    // Type
    if (localState.types.length > 0) {
      (newFilters.where as any).type = { in: localState.types };
    }

    // Origin
    if (localState.origin !== "all") {
      (newFilters.where as any).origin = localState.origin;
    }

    // Sector filter - filter cuts by task's sector
    if (localState.sectorIds.length > 0) {
      const hasUndefined = localState.sectorIds.includes(UNDEFINED_SECTOR_VALUE);
      const realSectorIds = localState.sectorIds.filter((id) => id !== UNDEFINED_SECTOR_VALUE);

      if (hasUndefined && realSectorIds.length === 0) {
        // Only filtering for tasks without sector
        (newFilters.where as any).task = { sectorId: null };
      } else if (hasUndefined && realSectorIds.length > 0) {
        // Filtering for both undefined and specific sectors - use OR
        (newFilters.where as any).OR = [
          { task: { sectorId: null } },
          { task: { sectorId: { in: realSectorIds } } },
        ];
      } else {
        // Only filtering for specific sectors
        (newFilters.where as any).task = { sectorId: { in: realSectorIds } };
      }
    }

    // Date range
    if (localState.createdAfter || localState.createdBefore) {
      newFilters.createdAt = {};
      if (localState.createdAfter) {
        newFilters.createdAt.gte = localState.createdAfter;
      }
      if (localState.createdBefore) {
        newFilters.createdAt.lte = localState.createdBefore;
      }
    } else {
      delete newFilters.createdAt;
    }

    // Clean up empty where
    if (Object.keys(newFilters.where || {}).length === 0) {
      delete newFilters.where;
    }

    onFilterChange(newFilters);
    setTimeout(() => onOpenChange(false), 0); // Use timeout to prevent state update conflicts
  };

  const handleReset = () => {
    setLocalState({
      statuses: [],
      types: [],
      origin: "all",
      sectorIds: [],
      createdAfter: undefined,
      createdBefore: undefined,
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localState.statuses.length > 0) count++;
    if (localState.types.length > 0) count++;
    if (localState.origin !== "all") count++;
    if (localState.sectorIds.length > 0) count++;
    if (localState.createdAfter || localState.createdBefore) count++;
    return count;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Cortes
            {getActiveFilterCount() > 0 && <Badge variant="secondary">{getActiveFilterCount()}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para visualizar cortes específicos
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Status
              {localState.statuses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {localState.statuses.length}
                </Badge>
              )}
            </Label>
            <Combobox
              mode="multiple"
              options={Object.entries(CUT_STATUS_LABELS).map(([value, label]) => ({
                value: value,
                label: label,
              }))}
              value={localState.statuses}
              onValueChange={(statuses: string | string[] | null | undefined) => {
                const statusArray = Array.isArray(statuses) ? statuses : [];
                setLocalState((prev) => ({ ...prev, statuses: statusArray as CUT_STATUS[] }));
              }}
              placeholder="Selecionar status..."
              searchPlaceholder="Buscar status..."
              emptyText="Nenhum status encontrado"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">
              Tipo de Corte
              {localState.types.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {localState.types.length}
                </Badge>
              )}
            </Label>
            <Combobox
              mode="multiple"
              options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                value: value,
                label: label,
              }))}
              value={localState.types}
              onValueChange={(types: string | string[] | null | undefined) => {
                const typeArray = Array.isArray(types) ? types : [];
                setLocalState((prev) => ({ ...prev, types: typeArray as CUT_TYPE[] }));
              }}
              placeholder="Selecionar tipos..."
              searchPlaceholder="Buscar tipos..."
              emptyText="Nenhum tipo encontrado"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Origem</Label>
            <Combobox
              value={localState.origin}
              onValueChange={(origin: string | string[] | null | undefined) => {
                const originValue = typeof origin === 'string' ? origin : 'all';
                setLocalState((prev) => ({ ...prev, origin: originValue }));
              }}
              options={[
                { value: "all", label: "Todas" },
                { value: CUT_ORIGIN.PLAN, label: CUT_ORIGIN_LABELS[CUT_ORIGIN.PLAN] },
                { value: CUT_ORIGIN.REQUEST, label: CUT_ORIGIN_LABELS[CUT_ORIGIN.REQUEST] },
              ]}
              placeholder="Selecionar origem..."
              emptyText="Nenhuma origem encontrada"
              searchable={false}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">
              Setor da Tarefa
              {localState.sectorIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {localState.sectorIds.length}
                </Badge>
              )}
            </Label>
            <Combobox
              mode="multiple"
              options={[
                { value: UNDEFINED_SECTOR_VALUE, label: "Indefinido (sem setor)" },
                ...sectors.map((sector: Sector) => ({
                  value: sector.id,
                  label: sector.name,
                })),
              ]}
              value={localState.sectorIds}
              onValueChange={(sectorIds: string | string[] | null | undefined) => {
                const sectorIdArray = Array.isArray(sectorIds) ? sectorIds : [];
                setLocalState((prev) => ({ ...prev, sectorIds: sectorIdArray }));
              }}
              placeholder="Selecionar setores..."
              searchPlaceholder="Buscar setores..."
              emptyText="Nenhum setor encontrado"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <div className="text-base font-medium">Data de Criação</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdAfter}
                  onChange={(date: Date | DateRange | null) => {
                    const dateValue = date instanceof Date ? date : null;
                    setLocalState((prev) => ({
                      ...prev,
                      createdAfter: dateValue || undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdBefore}
                  onChange={(date: Date | DateRange | null) => {
                    const dateValue = date instanceof Date ? date : null;
                    setLocalState((prev) => ({
                      ...prev,
                      createdBefore: dateValue || undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar todos
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
