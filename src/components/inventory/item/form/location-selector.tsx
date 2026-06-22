import { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useFormContext } from "react-hook-form";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import { getWarehouseLocations } from "../../../../api-client";
import { warehouseLocationKeys, useWarehouseLocationDetail, useWarehouseLocations } from "../../../../hooks";
import type { WarehouseLocation } from "../../../../types";
import { WAREHOUSE_LOCATION_TYPE } from "../../../../constants";
import { columnsForLevel } from "../../warehouse-location/map/warehouse-type-style";
import { cn } from "@/lib/utils";
import { IconMapPin, IconBuildingWarehouse } from "@tabler/icons-react";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface LocationSelectorProps {
  disabled?: boolean;
  initialWarehouseLocation?: WarehouseLocation;
}

export function ItemLocationSelector({ disabled, initialWarehouseLocation }: LocationSelectorProps) {
  const form = useFormContext<FormData>();

  const initialOptions = useMemo(
    () =>
      initialWarehouseLocation
        ? [
            {
              value: initialWarehouseLocation.id,
              label: initialWarehouseLocation.name,
            },
          ]
        : [],
    [initialWarehouseLocation?.id],
  );

  const cacheRef = useRef<Map<string, WarehouseLocation>>(new Map());

  useMemo(() => {
    if (initialWarehouseLocation) {
      cacheRef.current.set(initialWarehouseLocation.id, initialWarehouseLocation);
    }
  }, [initialWarehouseLocation?.id]);

  // ---- Setor filter: narrows the localização list to one warehouse sector ----
  const [sector, setSector] = useState<string | null>(initialWarehouseLocation?.section ?? null);
  const { data: allLocations } = useWarehouseLocations({ isActive: true, orderBy: { section: "asc" }, limit: 100 });
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of allLocations?.data ?? []) if (l.section) set.add(l.section);
    if (initialWarehouseLocation?.section) set.add(initialWarehouseLocation.section);
    return Array.from(set).sort().map((s) => ({ value: s, label: s }));
  }, [allLocations, initialWarehouseLocation?.section]);

  const fetchLocations = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getWarehouseLocations({
        page,
        take: 50,
        orderBy: { name: "asc" },
        where: { isActive: true, ...(sector ? { section: sector } : {}) },
        ...(searchTerm && searchTerm.trim()
          ? {
              searchingFor: searchTerm.trim(),
            }
          : {}),
      });

      const locations = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = locations.map((location: WarehouseLocation) => {
        cacheRef.current.set(location.id, location);
        return {
          value: location.id,
          label: location.name,
        };
      });

      return {
        data: options,
        hasMore,
      };
    } catch (error) {
      return {
        data: [],
        hasMore: false,
      };
    }
  }, [sector]);

  // Watch the chosen location + cell fields.
  const warehouseLocationId = form.watch("warehouseLocationId");

  // Changing the setor clears a chosen localização that doesn't belong to it.
  useEffect(() => {
    if (!sector || !warehouseLocationId) return;
    const sel = cacheRef.current.get(warehouseLocationId);
    if (sel && sel.section && sel.section !== sector) form.setValue("warehouseLocationId", null, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);
  const locationLevel = form.watch("locationLevel");

  // Fetch the chosen location's grid (levels / columns / columnsPerLevel).
  const { data: locationDetail } = useWarehouseLocationDetail(warehouseLocationId || "", {
    enabled: !!warehouseLocationId,
  });

  const grid = useMemo<WarehouseLocation | undefined>(
    () => locationDetail?.data ?? (warehouseLocationId ? cacheRef.current.get(warehouseLocationId) : undefined),
    [locationDetail, warehouseLocationId],
  );

  // Clear cell selection when the location is cleared or changed.
  const prevLocationRef = useRef<string | null | undefined>(warehouseLocationId);
  useEffect(() => {
    if (prevLocationRef.current !== warehouseLocationId) {
      prevLocationRef.current = warehouseLocationId;
      form.setValue("locationLevel", null, { shouldDirty: true });
      form.setValue("locationColumn", null, { shouldDirty: true });
    }
  }, [warehouseLocationId, form]);

  const levelOptions = useMemo(() => {
    const levels = grid?.levels ?? 0;
    return Array.from({ length: levels }, (_, i) => i + 1);
  }, [grid?.levels]);

  // Columns (the "C" — caixa kanban) only exist on kanban racks.
  const isKanban = grid?.type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN;
  const isPanel = grid?.type === WAREHOUSE_LOCATION_TYPE.PAINEL;
  const levelLabel = isPanel ? "Linha" : "Prateleira";

  const columnOptions = useMemo(() => {
    if (!grid || !isKanban || locationLevel == null) return [] as number[];
    const cols = columnsForLevel(grid, Number(locationLevel));
    return Array.from({ length: cols }, (_, i) => i + 1);
  }, [grid, isKanban, locationLevel]);

  // A non-kanban location has no column — keep it null.
  useEffect(() => {
    if (grid && !isKanban && form.getValues("locationColumn") != null) form.setValue("locationColumn", null, { shouldDirty: true });
  }, [grid, isKanban, form]);

  const showCellSelectors = !!warehouseLocationId && (grid?.levels ?? 0) > 0;
  const cellCols = (showCellSelectors ? 1 : 0) + (showCellSelectors && isKanban ? 1 : 0);
  const cellGridCls = cn("grid gap-4", cellCols === 2 ? "md:grid-cols-2" : "grid-cols-1");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Setor — a local filter (not an item field); narrows the localização list to one sector. */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <IconBuildingWarehouse className="h-4 w-4" />
            Setor
          </Label>
          <Combobox
            value={sector ?? ""}
            onValueChange={(v) => {
              const s = Array.isArray(v) ? v[0] : v;
              setSector(s || null);
            }}
            options={sectorOptions}
            mode="single"
            placeholder="Todos os setores"
            emptyText="Nenhum setor"
            searchable={false}
            clearable
            disabled={disabled}
          />
        </div>

        <FormField
          control={form.control}
          name="warehouseLocationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <IconMapPin className="h-4 w-4" />
                Localização
              </FormLabel>
              <FormControl>
                <Combobox
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  async={true}
                  queryKey={["warehouseLocations", "selector", sector ?? "all"]}
                  queryFn={fetchLocations}
                  initialOptions={initialOptions}
                  minSearchLength={0}
                  pageSize={50}
                  debounceMs={300}
                  placeholder={sector ? `Localizações do ${sector}` : "Selecione a localização"}
                  emptyText="Nenhuma localização encontrada"
                  searchPlaceholder="Digite o nome ou código..."
                  disabled={disabled}
                  clearable
                  queryKeysToInvalidate={[[warehouseLocationKeys.all]] as unknown[][]}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {showCellSelectors && (
        <div className={cellGridCls}>
        <FormField
          control={form.control}
          name="locationLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{levelLabel}</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value != null ? String(field.value) : ""}
                  onValueChange={(v) => {
                    const s = Array.isArray(v) ? v[0] : v;
                    field.onChange(s ? Number(s) : null);
                    form.setValue("locationColumn", null, { shouldDirty: true });
                  }}
                  options={levelOptions.map((lvl) => ({ value: String(lvl), label: `${levelLabel} ${lvl}` }))}
                  placeholder={`Selecione a ${levelLabel.toLowerCase()}`}
                  emptyText="Nenhuma opção"
                  searchable
                  clearable
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isKanban && (
        <FormField
          control={form.control}
          name="locationColumn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caixa (Coluna)</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value != null ? String(field.value) : ""}
                  onValueChange={(v) => {
                    const s = Array.isArray(v) ? v[0] : v;
                    field.onChange(s ? Number(s) : null);
                  }}
                  options={columnOptions.map((col) => ({ value: String(col), label: `Caixa ${col}` }))}
                  placeholder={locationLevel == null ? "Selecione a prateleira primeiro" : "Selecione a caixa"}
                  emptyText="Nenhuma opção"
                  searchable
                  clearable
                  disabled={disabled || locationLevel == null}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        )}
        </div>
      )}
    </div>
  );
}
