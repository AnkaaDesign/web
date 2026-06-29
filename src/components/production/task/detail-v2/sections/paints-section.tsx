import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, routes } from "@/constants";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

// Unified neutral, subtle paint metadata badge (matches the legacy PAINT_BADGE_STYLE).
const PAINT_BADGE =
  "bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 border-0";

type PaintLike = {
  id?: string;
  name?: string | null;
  code?: string | null;
  hex?: string | null;
  colorPreview?: string | null;
  finish?: keyof typeof PAINT_FINISH_LABELS | null;
  manufacturer?: keyof typeof TRUCK_MANUFACTURER_LABELS | null;
  paintType?: { name?: string | null } | null;
  paintBrand?: { name?: string | null } | null;
  paintGrounds?: Array<{ id?: string; groundPaint?: PaintLike | null }> | null;
};

function PaintSwatch({ paint, size }: { paint: PaintLike; size: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-md ring-1 ring-border"
      style={{ width: size, height: size, background: paint.hex || "#888" }}
    >
      {paint.colorPreview ? (
        <img src={paint.colorPreview} alt={paint.name ?? ""} className="h-full w-full object-cover" loading="lazy" />
      ) : null}
    </div>
  );
}

function PaintBadges({ paint }: { paint: PaintLike }) {
  const badges = [
    paint.paintType?.name,
    paint.finish ? PAINT_FINISH_LABELS[paint.finish] : null,
    paint.paintBrand?.name,
    paint.manufacturer ? TRUCK_MANUFACTURER_LABELS[paint.manufacturer] : null,
  ].filter(Boolean) as string[];
  if (!badges.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((b, i) => (
        <Badge key={i} className={cn(PAINT_BADGE, "max-w-[12rem] truncate")} title={b}>
          {b}
        </Badge>
      ))}
    </div>
  );
}

/** Tintas: general painting (+ recommended grounds) and logo paints, with color swatches and
 *  metadata badges. Every paint card links to the paint catalog. */
export function PaintsSection({ task }: { task: Task }) {
  const navigate = useNavigate();
  const gp = task.generalPainting as PaintLike | undefined;
  const logos = (task.logoPaints ?? []) as PaintLike[];
  const grounds = (gp?.paintGrounds ?? []).map((g) => g.groundPaint).filter(Boolean) as PaintLike[];
  if (!gp && logos.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma tinta.</p>;

  const open = (id?: string) => id && navigate(routes.painting.catalog.details(id));

  return (
    <div className="space-y-4">
      {gp && (
        <div>
          <button
            type="button"
            onClick={() => open(gp.id)}
            className="flex w-full items-start gap-3 rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-muted"
          >
            <PaintSwatch paint={gp} size={96} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{gp.name || "—"}</span>
                {gp.code ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{gp.code}</span> : null}
              </div>
              <PaintBadges paint={gp} />
            </div>
          </button>

          {grounds.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Fundos Recomendados ({grounds.length})
              </h4>
              <div className="space-y-2">
                {grounds.map((g, i) => (
                  <button
                    key={g.id ?? i}
                    type="button"
                    onClick={() => open(g.id)}
                    className="flex w-full items-start gap-2 rounded-md bg-muted/50 p-2 text-left transition-colors hover:bg-muted"
                  >
                    <PaintSwatch paint={g} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-sm font-medium">{g.name || "—"}</span>
                        {g.code ? <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{g.code}</span> : null}
                      </div>
                      <PaintBadges paint={g} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {logos.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Tintas da Logomarca ({logos.length} {logos.length === 1 ? "cor" : "cores"})
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {logos.map((p, i) => (
              <button
                key={p.id ?? i}
                type="button"
                onClick={() => open(p.id)}
                className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-left transition-colors hover:bg-muted"
              >
                <PaintSwatch paint={p} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="min-w-0 truncate text-sm">{p.name || "—"}</span>
                    {p.code ? <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.code}</span> : null}
                  </div>
                  <PaintBadges paint={p} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
