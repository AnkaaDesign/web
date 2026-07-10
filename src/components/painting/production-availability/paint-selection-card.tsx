import { IconX } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAINT_FINISH_LABELS, type PAINT_FINISH } from "@/constants";

import type { PaintStatus, SelectionRow } from "./types";

interface PaintSelectionCardProps {
  row: SelectionRow;
  status: PaintStatus;
  onVolumeChange: (paintId: string, volume: number) => void;
  onRemove: (paintId: string) => void;
  onOpenDetail: (paintId: string) => void;
}

// Solid, white-text status badges (same treatment as the app's status badges).
const STATUS_META: Record<
  PaintStatus,
  { label: string; variant: "success" | "destructive" | "amber" | "secondary" }
> = {
  producible: { label: "Produzível", variant: "success" },
  insufficient: { label: "Insuficiente", variant: "destructive" },
  "no-formula": { label: "Sem fórmula", variant: "amber" },
  pending: { label: "Calculando…", variant: "secondary" },
};

export function PaintSelectionCard({
  row,
  status,
  onVolumeChange,
  onRemove,
  onOpenDetail,
}: PaintSelectionCardProps) {
  const meta = STATUS_META[status];
  const finishLabel = PAINT_FINISH_LABELS[row.finish as PAINT_FINISH] ?? row.finish;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(row.paintId)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpenDetail(row.paintId);
        }
      }}
      className="flex w-[300px] flex-shrink-0 cursor-pointer flex-col border bg-muted/30 transition-colors hover:bg-muted/60"
    >
      <CardContent className="flex flex-1 flex-col gap-2.5 p-3">
        {/* Name + solid status badge, justified between */}
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 flex-shrink-0 rounded-md shadow-sm ring-1 ring-border"
            style={{ backgroundColor: row.hex || "#888888" }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={row.paintName}>
            {row.paintName}
          </span>
          <Badge variant={meta.variant} size="sm" className="flex-shrink-0">
            {meta.label}
          </Badge>
          <button
            type="button"
            aria-label={`Remover ${row.paintName}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(row.paintId);
            }}
            className="flex-shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Type / finish / brand — same badge coloring */}
        <div className="flex flex-wrap items-center gap-1">
          {row.typeName ? (
            <Badge variant="secondary" size="sm" className="font-normal">
              {row.typeName}
            </Badge>
          ) : null}
          <Badge variant="secondary" size="sm" className="font-normal">
            {finishLabel}
          </Badge>
          {row.brandName ? (
            <Badge variant="secondary" size="sm" className="font-normal">
              {row.brandName}
            </Badge>
          ) : null}
        </div>

        {/* Volume input. Only the input itself must not open the detail modal. */}
        <div className="mt-auto space-y-1">
          <Label htmlFor={`vol-${row.paintId}`} className="text-xs text-muted-foreground">
            Volume a produzir
          </Label>
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Input
              id={`vol-${row.paintId}`}
              type="decimal"
              decimals={2}
              min={0}
              value={row.volumeLiters}
              onChange={(v) =>
                onVolumeChange(row.paintId, typeof v === "number" ? v : Number(v) || 0)
              }
              className="pr-8 text-right font-medium"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              L
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
