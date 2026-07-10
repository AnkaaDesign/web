import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconBuilding, IconCalendarTime, IconHash, IconX } from "@tabler/icons-react";

import type {
  PaintPlanDetailComponent,
  ProductionAvailabilityComponent,
} from "@/api-client/paint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  PAINT_FINISH_LABELS,
  TASK_STATUS_LABELS,
  routes,
  type PAINT_FINISH,
  type TASK_STATUS,
} from "@/constants";
import { usePaintPlanDetail } from "@/hooks";

import { formatGrams, formatLiters, formatRatioPct, formatUnits } from "./format";

interface PaintPlanDetailModalProps {
  paintId: string | null;
  paintName: string;
  hex: string;
  volumeLiters: number;
  forecastDate?: string;
  /** Global (shared-stock) component availability, so the modal matches the card/table. */
  globalComponents: ProductionAvailabilityComponent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TASK_STATUS_VARIANT: Record<string, "preparation" | "pending" | "inProgress" | "secondary"> = {
  PREPARATION: "preparation",
  WAITING_PRODUCTION: "pending",
  IN_PRODUCTION: "inProgress",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Sem previsão";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "Sem previsão" : d.toLocaleDateString("pt-BR");
}

/**
 * A formula row. `required` is THIS paint's demand (standalone), but availability
 * (`ratio`/`missing`/stock) comes from the GLOBAL shared-stock calc when available,
 * so a component that's short across the whole plan shows as short here too — which
 * is why the paint's card can read "Insuficiente" even though this paint alone is small.
 */
function FormulaRow({
  c,
  global,
}: {
  c: PaintPlanDetailComponent;
  global: ProductionAvailabilityComponent | undefined;
}) {
  const ratio = global?.availableRatio ?? c.availableRatio;
  const availableUnits = global?.availableUnits ?? c.availableUnits;
  const availableGrams = global?.availableGrams ?? c.availableGrams;
  const missingGrams = global
    ? global.availableGrams == null
      ? null
      : Math.max(0, global.requiredGrams - global.availableGrams)
    : c.missingGrams;

  const short = ratio != null && ratio < 1;
  const tone =
    ratio == null
      ? "text-amber-600 dark:text-amber-400"
      : short
        ? "text-red-600 dark:text-red-400"
        : "text-green-600 dark:text-green-400";

  return (
    <tr className={cn(short && "bg-red-500/[0.05]")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 flex-shrink-0 rounded-full",
              ratio == null ? "bg-amber-500" : short ? "bg-red-500" : "bg-green-500",
            )}
          />
          <span className="truncate font-medium">{c.itemName}</span>
          {c.uniCode ? (
            <span className="flex-shrink-0 text-xs text-muted-foreground">{c.uniCode}</span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
        {c.ratio.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {formatGrams(c.requiredGrams)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {availableGrams != null ? formatGrams(availableGrams) : formatUnits(availableUnits)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
        {missingGrams == null || missingGrams <= 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-medium text-red-600 dark:text-red-400">
            {formatGrams(missingGrams)}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {ratio == null ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">s/ medida</span>
        ) : (
          <span className={cn("text-xs font-semibold tabular-nums", tone)}>
            {formatRatioPct(Math.min(ratio, 1))}
          </span>
        )}
      </td>
    </tr>
  );
}

export function PaintPlanDetailModal({
  paintId,
  paintName,
  hex,
  volumeLiters,
  forecastDate,
  globalComponents,
  open,
  onOpenChange,
}: PaintPlanDetailModalProps) {
  const navigate = useNavigate();
  const { data, isLoading } = usePaintPlanDetail(open ? paintId : null, volumeLiters, forecastDate);
  const detail = data?.data ?? null;
  const paint = detail?.paint;

  const goToTask = (taskId: string) => {
    onOpenChange(false);
    navigate(routes.production.schedule.details(taskId));
  };
  const finishLabel = paint ? PAINT_FINISH_LABELS[paint.finish as PAINT_FINISH] ?? paint.finish : null;

  const globalMap = useMemo(
    () => new Map(globalComponents.map((c) => [c.itemId, c])),
    [globalComponents],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="h-7 w-7 flex-shrink-0 rounded-md shadow-sm ring-1 ring-border"
                style={{ backgroundColor: hex || "#888888" }}
              />
              <span className="truncate">{paint?.name ?? paintName}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <IconX className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-1.5">
            {paint?.typeName ? (
              <Badge variant="secondary" size="sm" className="font-normal">
                {paint.typeName}
              </Badge>
            ) : null}
            {finishLabel ? (
              <Badge variant="secondary" size="sm" className="font-normal">
                {finishLabel}
              </Badge>
            ) : null}
            {paint?.brandName ? (
              <Badge variant="secondary" size="sm" className="font-normal">
                {paint.brandName}
              </Badge>
            ) : null}
            {paint?.code ? (
              <Badge variant="outline" size="sm" className="font-normal">
                {paint.code}
              </Badge>
            ) : null}
            <span className="ml-auto text-sm text-muted-foreground">
              Volume:{" "}
              <span className="font-semibold text-foreground">{formatLiters(volumeLiters)}</span>
            </span>
          </div>

          {/* Tasks — capped height with its own scroll */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              Tarefas no cronograma{" "}
              <span className="text-muted-foreground">({detail?.tasks.length ?? 0})</span>
            </h3>
            {isLoading ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : detail && detail.tasks.length > 0 ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {detail.tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goToTask(t.id)}
                    className="w-full rounded-lg bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold">{t.name}</span>
                      <Badge
                        variant={TASK_STATUS_VARIANT[t.status] ?? "secondary"}
                        size="sm"
                        className="flex-shrink-0"
                      >
                        {TASK_STATUS_LABELS[t.status as TASK_STATUS] ?? t.status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.serialNumber ? (
                        <span className="flex items-center gap-1">
                          <IconHash className="h-3.5 w-3.5" />
                          {t.serialNumber}
                        </span>
                      ) : null}
                      {t.customerName ? (
                        <span className="flex items-center gap-1">
                          <IconBuilding className="h-3.5 w-3.5" />
                          {t.customerName}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1">
                        <IconCalendarTime className="h-3.5 w-3.5" />
                        {formatDate(t.forecastDate)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/50 px-4 py-4 text-center text-sm text-muted-foreground">
                Nenhuma tarefa no cronograma usa esta tinta.
              </p>
            )}
          </section>

          {/* Formula (availability shown is the shared-stock / global value) */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Fórmula · componentes</h3>
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : detail?.formula ? (
              <div className="overflow-x-auto rounded-lg bg-muted/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-[11px] uppercase text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Componente</th>
                      <th className="px-3 py-2 text-right font-medium">Prop.</th>
                      <th className="px-3 py-2 text-right font-medium">Necessário</th>
                      <th className="px-3 py-2 text-right font-medium">Estoque</th>
                      <th className="px-3 py-2 text-right font-medium">Falta</th>
                      <th className="px-3 py-2 text-right font-medium">Disp.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {detail.formula.components.map((c) => (
                      <FormulaRow key={c.itemId} c={c} global={globalMap.get(c.itemId)} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg bg-muted/50 px-4 py-4 text-center text-sm text-muted-foreground">
                Esta tinta não possui fórmula cadastrada.
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
