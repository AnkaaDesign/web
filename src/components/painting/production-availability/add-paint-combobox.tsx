import { useCallback, useRef } from "react";
import { IconFlask } from "@tabler/icons-react";

import { getPaints } from "@/api-client";
import { Combobox } from "@/components/ui/combobox";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { cn } from "@/lib/utils";
import { PAINT_FINISH_LABELS, type PAINT_FINISH } from "@/constants";
import type { Paint } from "@/types";

import type { AddPaintPayload } from "./types";

interface AddPaintComboboxProps {
  existingIds: Set<string>;
  onAdd: (paint: AddPaintPayload) => void;
  /** Bumped by the parent after each add to remount + clear the search. */
  resetKey: number;
  className?: string;
}

/**
 * Async paint search for adding a paint to the plan. The combobox only reports the
 * selected id, so we cache the paints it loads to hand the full display payload back.
 * Options are rendered to match the task-form paint selector.
 */
export function AddPaintCombobox({
  existingIds,
  onAdd,
  resetKey,
  className,
}: AddPaintComboboxProps) {
  const cacheRef = useRef<Map<string, Paint>>(new Map());

  const queryPaints = useCallback(async (searchTerm: string, page = 1) => {
    const params: Record<string, unknown> = {
      orderBy: { name: "asc" },
      page,
      take: 50,
      include: { paintType: true, paintBrand: true, _count: { select: { formulas: true } } },
    };
    if (searchTerm?.trim()) params.searchingFor = searchTerm.trim();

    const response = await getPaints(params);
    const data = (response.data ?? []) as Paint[];
    data.forEach((p) => cacheRef.current.set(p.id, p));
    return { data, hasMore: response.meta?.hasNextPage ?? false };
  }, []);

  const handleSelect = useCallback(
    (value: string | string[] | null | undefined) => {
      const id = Array.isArray(value) ? value[0] : value;
      if (!id || existingIds.has(id)) return;
      const paint = cacheRef.current.get(id);
      if (!paint) return;
      onAdd({
        id: paint.id,
        name: paint.name,
        hex: paint.hex,
        finish: paint.finish as string,
        typeName: paint.paintType?.name ?? null,
        brandName: paint.paintBrand?.name ?? null,
      });
    },
    [existingIds, onAdd],
  );

  const renderOption = useCallback((paint: Paint) => {
    const color = paint.hex || "#888888";
    const hasFormula = (paint._count?.formulas ?? 0) > 0 || (paint.formulas?.length ?? 0) > 0;
    return (
      <div className="flex w-full items-center gap-3">
        {paint.colorPreview ? (
          <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded shadow-sm ring-1 ring-border">
            <img
              src={paint.colorPreview}
              alt={paint.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : paint.finish ? (
          <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded shadow-sm ring-1 ring-border">
            <CanvasNormalMapRenderer
              baseColor={color}
              finish={paint.finish as PAINT_FINISH}
              width={24}
              height={24}
              quality="low"
              className="h-full w-full"
            />
          </div>
        ) : (
          <div
            className="h-6 w-6 flex-shrink-0 rounded shadow-sm ring-1 ring-border"
            style={{ backgroundColor: color }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{paint.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {paint.paintType?.name ? <span className="font-medium">{paint.paintType.name}</span> : null}
            {paint.finish ? (
              <>
                <span className="opacity-60">•</span>
                <span>{PAINT_FINISH_LABELS[paint.finish as PAINT_FINISH]}</span>
              </>
            ) : null}
            {paint.paintBrand?.name ? (
              <>
                <span className="opacity-60">•</span>
                <span>{paint.paintBrand.name}</span>
              </>
            ) : null}
          </div>
        </div>

        <IconFlask
          className={cn(
            "h-4 w-4 flex-shrink-0",
            hasFormula ? "text-green-600" : "text-destructive",
          )}
        />
      </div>
    );
  }, []);

  return (
    <Combobox<Paint>
      key={resetKey}
      value=""
      onValueChange={handleSelect}
      async
      queryKey={["paints", "availability-add"]}
      queryFn={queryPaints}
      getOptionLabel={(p) => p.name}
      getOptionValue={(p) => p.id}
      renderOption={renderOption}
      placeholder="Adicionar tinta…"
      emptyText="Nenhuma tinta encontrada"
      searchPlaceholder="Pesquisar por nome ou código…"
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
      clearable={false}
      className={className}
    />
  );
}
