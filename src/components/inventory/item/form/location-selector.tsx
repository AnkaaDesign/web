import { useMemo, useRef, useCallback, useEffect } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useFormContext } from "react-hook-form";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import { getWarehouseLocations } from "../../../../api-client";
import { warehouseLocationKeys, useWarehouseLocationDetail } from "../../../../hooks";
import type { WarehouseLocation } from "../../../../types";
import { WAREHOUSE_LOCATION_TYPE } from "../../../../constants";
import { columnsForLevel } from "../../warehouse-location/map/warehouse-type-style";
import { cn } from "@/lib/utils";
import { IconMapPin } from "@tabler/icons-react";

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

  const fetchLocations = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getWarehouseLocations({
        page,
        take: 50,
        orderBy: { name: "asc" },
        where: { isActive: true },
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
  }, []);

  // Watch the chosen location + cell fields.
  const warehouseLocationId = form.watch("warehouseLocationId");
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
  const colCount = 1 + (showCellSelectors ? 1 : 0) + (showCellSelectors && isKanban ? 1 : 0);
  const gridCls = cn("grid gap-4", colCount === 3 ? "md:grid-cols-3" : colCount === 2 ? "md:grid-cols-2" : "grid-cols-1");

  return (
    <div className={gridCls}>
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
                queryKey={["warehouseLocations", "selector"]}
                queryFn={fetchLocations}
                initialOptions={initialOptions}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
                placeholder="Selecione a localização"
                emptyText="Nenhuma localização encontrada"
                searchPlaceholder="Digite o nome ou setor..."
                disabled={disabled}
                clearable
                queryKeysToInvalidate={[[warehouseLocationKeys.all]] as unknown[][]}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {showCellSelectors && (
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
      )}

      {showCellSelectors && isKanban && (
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
  );
}
