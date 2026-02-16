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
import { Badge } from "@/components/ui/badge";
import { getPositions, getSectors } from "../../../../api-client";
import { USER_STATUS_LABELS } from "../../../../constants";
import {
  SHIRT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconUser, IconBriefcase, IconBuilding, IconShirt, IconHanger, IconShoe, IconMask, IconHandGrab, IconUmbrella, IconX } from "@tabler/icons-react";
import type { UserGetManyFormData } from "../../../../schemas";

interface PpeSizesFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserGetManyFormData>;
  onFilterChange: (filters: Partial<UserGetManyFormData>) => void;
}

function enumToOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export function PpeSizesFilters({ open, onOpenChange, filters, onFilterChange }: PpeSizesFiltersProps) {
  const positionCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const sectorCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const selectedStatuses = localFilters.status || [];
  const selectedPositions = localFilters.positionId || [];
  const selectedSectors = localFilters.sectorId || [];

  // PPE size filter values stored in a custom field
  const ppeSizeFilters = (localFilters as any).ppeSizeFilters || {};

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleStatusChange = (statuses: string | string[] | null | undefined) => {
    const statusArray = Array.isArray(statuses) ? statuses : statuses ? [statuses] : [];
    setLocalFilters({ ...localFilters, status: statusArray.length > 0 ? statusArray : undefined });
  };

  const handlePositionChange = (positions: string | string[] | null | undefined) => {
    const positionArray = Array.isArray(positions) ? positions : positions ? [positions] : [];
    setLocalFilters({ ...localFilters, positionId: positionArray.length > 0 ? positionArray : undefined });
  };

  const handleSectorChange = (sectors: string | string[] | null | undefined) => {
    const sectorArray = Array.isArray(sectors) ? sectors : sectors ? [sectors] : [];
    setLocalFilters({ ...localFilters, sectorId: sectorArray.length > 0 ? sectorArray : undefined });
  };

  const handlePpeSizeChange = (field: string, values: string | string[] | null | undefined) => {
    const valuesArray = Array.isArray(values) ? values : values ? [values] : [];
    const newPpeSizeFilters = { ...ppeSizeFilters };
    if (valuesArray.length > 0) {
      newPpeSizeFilters[field] = valuesArray;
    } else {
      delete newPpeSizeFilters[field];
    }
    const hasAny = Object.keys(newPpeSizeFilters).length > 0;
    setLocalFilters({ ...localFilters, ppeSizeFilters: hasAny ? newPpeSizeFilters : undefined } as any);
  };

  const statusOptions = Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const queryPositions = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = { orderBy: { name: "asc" }, page, take: 50 };
      if (searchTerm?.trim()) queryParams.searchingFor = searchTerm.trim();
      const response = await getPositions(queryParams);
      const positions = response.data || [];
      const options = positions.map((p) => {
        const option = { value: p.id, label: p.name };
        positionCacheRef.current.set(p.id, option);
        return option;
      });
      return { data: options, hasMore: response.meta?.hasNextPage || false };
    } catch {
      return { data: [], hasMore: false };
    }
  }, []);

  const querySectors = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = { orderBy: { name: "asc" }, page, take: 50 };
      if (searchTerm?.trim()) queryParams.searchingFor = searchTerm.trim();
      const response = await getSectors(queryParams);
      const sectors = response.data || [];
      const options = sectors.map((s) => {
        const option = { value: s.id, label: s.name };
        sectorCacheRef.current.set(s.id, option);
        return option;
      });
      return { data: options, hasMore: response.meta?.hasNextPage || false };
    } catch {
      return { data: [], hasMore: false };
    }
  }, []);

  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  const shirtOptions = enumToOptions(SHIRT_SIZE_LABELS);
  const pantsOptions = enumToOptions(PANTS_SIZE_LABELS);
  const bootOptions = enumToOptions(BOOT_SIZE_LABELS);
  const sleevesOptions = enumToOptions(SLEEVES_SIZE_LABELS);
  const maskOptions = enumToOptions(MASK_SIZE_LABELS);
  const glovesOptions = enumToOptions(GLOVES_SIZE_LABELS);
  const rainBootsOptions = enumToOptions(RAIN_BOOTS_SIZE_LABELS);

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
            Filtre por status, cargo, setor e tamanhos de EPI
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

          {/* PPE Size Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconShirt className="h-4 w-4" />
              Tamanhos de EPI
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconShirt className="h-3.5 w-3.5" />Camisa</Label>
              <Combobox
                mode="multiple"
                options={shirtOptions}
                value={ppeSizeFilters.shirts || []}
                onValueChange={(v) => handlePpeSizeChange("shirts", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconHanger className="h-3.5 w-3.5" />Calça</Label>
              <Combobox
                mode="multiple"
                options={pantsOptions}
                value={ppeSizeFilters.pants || []}
                onValueChange={(v) => handlePpeSizeChange("pants", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconHanger className="h-3.5 w-3.5" />Bermuda</Label>
              <Combobox
                mode="multiple"
                options={pantsOptions}
                value={ppeSizeFilters.shorts || []}
                onValueChange={(v) => handlePpeSizeChange("shorts", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconShoe className="h-3.5 w-3.5" />Bota</Label>
              <Combobox
                mode="multiple"
                options={bootOptions}
                value={ppeSizeFilters.boots || []}
                onValueChange={(v) => handlePpeSizeChange("boots", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconHanger className="h-3.5 w-3.5" />Manguito</Label>
              <Combobox
                mode="multiple"
                options={sleevesOptions}
                value={ppeSizeFilters.sleeves || []}
                onValueChange={(v) => handlePpeSizeChange("sleeves", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconMask className="h-3.5 w-3.5" />Máscara</Label>
              <Combobox
                mode="multiple"
                options={maskOptions}
                value={ppeSizeFilters.mask || []}
                onValueChange={(v) => handlePpeSizeChange("mask", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconHandGrab className="h-3.5 w-3.5" />Luva</Label>
              <Combobox
                mode="multiple"
                options={glovesOptions}
                value={ppeSizeFilters.gloves || []}
                onValueChange={(v) => handlePpeSizeChange("gloves", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><IconUmbrella className="h-3.5 w-3.5" />Galocha</Label>
              <Combobox
                mode="multiple"
                options={rainBootsOptions}
                value={ppeSizeFilters.rainBoots || []}
                onValueChange={(v) => handlePpeSizeChange("rainBoots", v)}
                placeholder="Selecione tamanhos"
                searchable={true}
                minSearchLength={0}
              />
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
