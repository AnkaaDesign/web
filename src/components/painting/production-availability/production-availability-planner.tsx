import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCalculator, IconRefresh } from "@tabler/icons-react";

import type { ProductionScheduleDefaultSelection } from "@/api-client/paint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { routes } from "@/constants";
import { useDebounce } from "@/hooks/common/use-debounce";
import { useProductionAvailability, useProductionScheduleDefaults } from "@/hooks";

import { AddPaintCard } from "./add-paint-card";
import { AvailabilitySummary } from "./availability-summary";
import { ComponentsAvailabilityTable } from "./components-availability-table";
import { PaintPlanDetailModal } from "./paint-plan-detail-modal";
import { PaintSelectionCard } from "./paint-selection-card";
import type { AddPaintPayload, PaintStatus, SelectionRow } from "./types";

const DEFAULT_LITERS_PER_TASK = 3 * 3.6; // 10.8 L — mirrors the server rule.
const round2 = (n: number) => Math.round(n * 100) / 100;

function scheduleRow(d: ProductionScheduleDefaultSelection): SelectionRow {
  return {
    paintId: d.paintId,
    paintName: d.paintName,
    hex: d.hex,
    finish: d.finish,
    typeName: d.typeName,
    brandName: d.brandName,
    taskCount: d.taskCount,
    volumeLiters: round2(d.volumeLiters),
    hasFormula: d.hasFormula,
    source: "schedule",
  };
}

const dateKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "all");

export function ProductionAvailabilityPlanner() {
  const [forecastDate, setForecastDate] = useState<Date | null>(null);
  const forecastIso = forecastDate ? forecastDate.toISOString() : undefined;

  const { data: defaultsResp, isLoading: loadingDefaults } =
    useProductionScheduleDefaults(forecastIso);
  const litersPerTask = defaultsResp?.data?.litersPerTask ?? DEFAULT_LITERS_PER_TASK;

  const [rows, setRows] = useState<SelectionRow[]>([]);
  const [addKey, setAddKey] = useState(0);
  const [detailPaintId, setDetailPaintId] = useState<string | null>(null);
  // Re-seed the schedule paints whenever the forecast date changes (preserving any
  // manually-added paints), but NOT on a mere refetch of the same date.
  const seededKeyRef = useRef<string | null>(null);

  // Let a plain vertical wheel scroll the cards row horizontally (no Shift needed).
  const cardsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const defs = defaultsResp?.data?.selections;
    if (!defs) return;
    const key = dateKey(forecastDate);
    if (seededKeyRef.current === key) return;
    seededKeyRef.current = key;
    setRows((prev) => {
      const manual = prev.filter((r) => r.source === "manual");
      const manualIds = new Set(manual.map((m) => m.paintId));
      const schedule = defs.filter((d) => !manualIds.has(d.paintId)).map(scheduleRow);
      // Manually-added paints stay first (right after the add card).
      return [...manual, ...schedule];
    });
  }, [defaultsResp, forecastDate]);

  const debouncedRows = useDebounce(rows, 400);
  const selections = useMemo(
    () =>
      debouncedRows
        .filter((r) => r.volumeLiters > 0)
        .map((r) => ({ paintId: r.paintId, volumeLiters: r.volumeLiters })),
    [debouncedRows],
  );

  const { data: availResp, isFetching } = useProductionAvailability(selections, rows.length > 0);
  const result = rows.length > 0 ? (availResp?.data ?? null) : null;

  const paintStatusById = useMemo(() => {
    const map = new Map<string, PaintStatus>();
    result?.paints.forEach((p) => {
      map.set(
        p.paintId,
        !p.hasFormula ? "no-formula" : p.canProduce ? "producible" : "insufficient",
      );
    });
    return map;
  }, [result]);

  const statusOf = useCallback(
    (row: SelectionRow): PaintStatus =>
      row.volumeLiters <= 0 ? "pending" : paintStatusById.get(row.paintId) ?? "pending",
    [paintStatusById],
  );

  // Display order: sem fórmula → insuficiente → disponível → (pendente).
  // Sort is stable, so ties keep their insertion order (manual paints first).
  const orderedRows = useMemo(() => {
    const rank: Record<PaintStatus, number> = {
      "no-formula": 0,
      insufficient: 1,
      producible: 2,
      pending: 3,
    };
    return [...rows].sort((a, b) => rank[statusOf(a)] - rank[statusOf(b)]);
  }, [rows, statusOf]);

  const existingIds = useMemo(() => new Set(rows.map((r) => r.paintId)), [rows]);

  const handleVolumeChange = useCallback((paintId: string, volume: number) => {
    setRows((prev) =>
      prev.map((r) => (r.paintId === paintId ? { ...r, volumeLiters: round2(volume) } : r)),
    );
  }, []);

  const handleRemove = useCallback((paintId: string) => {
    setRows((prev) => prev.filter((r) => r.paintId !== paintId));
  }, []);

  const handleAdd = useCallback(
    (paint: AddPaintPayload) => {
      setRows((prev) => {
        if (prev.some((r) => r.paintId === paint.id)) {
          toast.info("Essa tinta já está na lista.");
          return prev;
        }
        // Prepend so the just-added paint sits at the left, next to the add card.
        return [
          {
            paintId: paint.id,
            paintName: paint.name,
            hex: paint.hex,
            finish: paint.finish,
            typeName: paint.typeName,
            brandName: paint.brandName,
            taskCount: 0,
            volumeLiters: round2(litersPerTask),
            hasFormula: true,
            source: "manual",
          },
          ...prev,
        ];
      });
      setAddKey((k) => k + 1); // remount the combobox so it clears the search
    },
    [litersPerTask],
  );

  const handleReset = useCallback(() => {
    const defs = defaultsResp?.data?.selections ?? [];
    setRows(defs.map(scheduleRow));
    seededKeyRef.current = dateKey(forecastDate);
    toast.success("Seleção restaurada a partir do cronograma.");
  }, [defaultsResp, forecastDate]);

  const showSeedSkeleton = loadingDefaults && seededKeyRef.current === null;
  const detailRow = detailPaintId ? rows.find((r) => r.paintId === detailPaintId) : null;

  return (
    <>
      <div className="flex-shrink-0">
        <PageHeader
          variant="list"
          title="Disponibilidade de Produção"
          icon={IconCalculator}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Pintura", href: routes.painting.root },
            { label: "Disponibilidade de Produção" },
          ]}
          actions={[
            {
              key: "reset",
              label: "Restaurar cronograma",
              icon: IconRefresh,
              onClick: handleReset,
              variant: "outline",
              group: "secondary",
              disabled: loadingDefaults,
            },
          ]}
          headerExtra={
            <div className="flex items-center justify-end gap-2">
              <Label className="whitespace-nowrap text-xs text-muted-foreground">
                Previsão até
              </Label>
              <DateTimeInput
                mode="date"
                value={forecastDate}
                onChange={(d) => setForecastDate((d as Date | null) ?? null)}
                placeholder="Todas as tarefas"
                showClearButton
                hideLabel
                className="w-52"
              />
            </div>
          }
        />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pb-4">
        <AvailabilitySummary
          result={result}
          litersPerTask={litersPerTask}
          isLoading={isFetching}
          hasRows={rows.length > 0}
        />

        <Card className="flex-shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Tintas selecionadas
              <Badge variant="secondary" className="font-normal">
                {rows.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div ref={cardsRef} className="flex gap-3 overflow-x-auto pb-1">
              {showSeedSkeleton ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-[300px] flex-shrink-0 rounded-lg" />
                ))
              ) : (
                <>
                  <AddPaintCard resetKey={addKey} existingIds={existingIds} onAdd={handleAdd} />
                  {orderedRows.map((row) => {
                    const status = statusOf(row);
                    return (
                      <PaintSelectionCard
                        key={row.paintId}
                        row={row}
                        status={status}
                        onVolumeChange={handleVolumeChange}
                        onRemove={handleRemove}
                        onOpenDetail={setDetailPaintId}
                      />
                    );
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <ComponentsAvailabilityTable
          className="min-h-0 flex-1"
          components={result?.components ?? []}
          isLoading={isFetching}
          hasRows={rows.length > 0}
        />
      </div>

      <PaintPlanDetailModal
        paintId={detailPaintId}
        paintName={detailRow?.paintName ?? ""}
        hex={detailRow?.hex ?? "#888888"}
        volumeLiters={detailRow?.volumeLiters ?? 0}
        forecastDate={forecastIso}
        globalComponents={result?.components ?? []}
        open={detailPaintId !== null}
        onOpenChange={(o) => {
          if (!o) setDetailPaintId(null);
        }}
      />
    </>
  );
}
