import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconFlask } from "@tabler/icons-react";

import { Combobox } from "@/components/ui/combobox";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { cn } from "@/lib/utils";

import { getPaints, getPaintById } from "@/api-client";
import {
  PAINT_FINISH_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  PAINT_FINISH,
} from "@/constants";
import type { Paint } from "@/types";

const PAINT_SELECT_FIELDS = {
  id: true,
  name: true,
  code: true,
  hex: true,
  finish: true,
  colorPreview: true,
  manufacturer: true,
  paintType: { select: { id: true, name: true, needGround: true } },
  paintBrand: { select: { id: true, name: true } },
  _count: { select: { formulas: true } },
} as const;

interface PaintMixPaintSelectorProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  paintTypeId: string | null;
  disabled?: boolean;
  placeholder?: string;
}

export function PaintMixPaintSelector({
  value,
  onValueChange,
  paintTypeId,
  disabled,
  placeholder,
}: PaintMixPaintSelectorProps) {
  const paintsCache = useRef<Map<string, Paint>>(new Map());

  const { data: selectedPaintData } = useQuery({
    queryKey: ["paint-mix", "paint-detail", value],
    queryFn: async () => {
      if (!value) return null;
      const response = await getPaintById(value, {
        select: PAINT_SELECT_FIELDS,
      } as any);
      return response.data || null;
    },
    enabled: !!value,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (selectedPaintData) {
      paintsCache.current.set(selectedPaintData.id, selectedPaintData);
    }
  }, [selectedPaintData]);

  const initialOptions = useMemo(() => {
    return selectedPaintData ? [selectedPaintData] : [];
  }, [selectedPaintData]);

  const getOptionLabel = useCallback((paint: Paint) => paint.name, []);
  const getOptionValue = useCallback((paint: Paint) => paint.id, []);

  const searchPaints = useCallback(
    async (search: string, page: number = 1) => {
      const params: any = {
        orderBy: { name: "asc" },
        page,
        take: 20,
        select: PAINT_SELECT_FIELDS,
      };

      if (paintTypeId) {
        params.paintTypeIds = [paintTypeId];
      }

      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }

      try {
        const response = await getPaints(params);
        const paints = response.data || [];
        paints.forEach((p: Paint) => paintsCache.current.set(p.id, p));
        return {
          data: paints,
          hasMore: response.meta?.hasNextPage || false,
        };
      } catch {
        return { data: [] as Paint[], hasMore: false };
      }
    },
    [paintTypeId],
  );

  const renderPaintItem = useCallback((paint: Paint) => {
    const color = paint.hex || "#888888";
    const hasFormulas =
      (paint._count?.formulas ?? 0) > 0 || (paint.formulas?.length ?? 0) > 0;
    return (
      <div className="flex items-center gap-3 w-full">
        {paint.colorPreview ? (
          <div className="w-6 h-6 rounded ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
            <img
              src={paint.colorPreview}
              alt={paint.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : paint.finish ? (
          <div className="w-6 h-6 rounded ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
            <CanvasNormalMapRenderer
              baseColor={color}
              finish={paint.finish as PAINT_FINISH}
              width={24}
              height={24}
              quality="low"
              className="w-full h-full"
            />
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded ring-1 ring-border shadow-sm flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{paint.name}</div>
          <div className="text-xs flex items-center gap-2 mt-0.5 flex-wrap">
            {paint.paintType?.name && (
              <span className="font-medium">{paint.paintType.name}</span>
            )}
            {paint.finish && (
              <>
                <span className="opacity-60">•</span>
                <span>{PAINT_FINISH_LABELS[paint.finish]}</span>
              </>
            )}
            {paint.manufacturer && (
              <>
                <span className="opacity-60">•</span>
                <span>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</span>
              </>
            )}
            {paint.paintBrand?.name && (
              <>
                <span className="opacity-60">•</span>
                <span>{paint.paintBrand.name}</span>
              </>
            )}
          </div>
        </div>

        <IconFlask
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-colors",
            hasFormulas
              ? "text-green-600 group-hover:text-primary-foreground"
              : "text-destructive",
          )}
        />
      </div>
    );
  }, []);

  return (
    <Combobox<Paint>
      value={value ?? undefined}
      onValueChange={(v) => onValueChange(typeof v === "string" ? v : null)}
      mode="single"
      async={true}
      queryKey={["paint-mix", "paint-search", paintTypeId ?? "all"]}
      queryFn={searchPaints}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      renderOption={renderPaintItem}
      initialOptions={initialOptions}
      minSearchLength={0}
      pageSize={20}
      debounceMs={500}
      clearable={true}
      disabled={disabled}
      placeholder={placeholder ?? "Selecione a tinta..."}
      searchPlaceholder="Pesquisar por código ou nome..."
      emptyText={
        paintTypeId
          ? "Nenhuma tinta encontrada para este tipo."
          : "Nenhuma tinta encontrada."
      }
    />
  );
}
