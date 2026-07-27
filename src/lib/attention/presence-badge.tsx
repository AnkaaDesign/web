// =====================================================
// Attention system — <IsEditingBadge> "someone else has this open" indicator
// =====================================================
//
// The READ side of presence: render it anywhere an entity can be concurrently
// edited — the detail page, the table row, and the edit form itself.
//
// Shows WHO and SINCE WHEN. The duration matters: "Ana está editando" is ambiguous
// (did she just open it, or has it been sitting there since this morning?), and that
// ambiguity is what makes people ignore the warning and save anyway.

import { useEffect, useState } from "react";
import { IconEdit } from "@tabler/icons-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { formatEditingSince, useOtherEditors, type PresenceEditor } from "./presence";
import type { AttentionEntityType } from "./types";

/** Re-render on a timer so "há 3 min" doesn't sit frozen at "agora". Only ticks while
 * something is actually being edited, and only once a minute. */
function useMinuteTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}

/**
 * Who else is editing this entity right now — excluding THIS tab's own announcement.
 * Re-exported from `presence.ts`, where the de-duplication lives, so the badge and the
 * lock predicates can never disagree about who counts as "someone else".
 */
export { useOtherEditors };

export function IsEditingBadge({
  type,
  id,
  className,
  compact,
}: {
  type: AttentionEntityType;
  id: string | undefined;
  className?: string;
  /** Icon-only (no name/count text) — for tight spaces like a table cell. A plain
   * text badge (Badge component) is built for label text, not a lone icon — its
   * default px-2.5 padding around a 12px icon reads as an oversized, misaligned
   * blob. Compact mode uses a fixed-size round chip instead. */
  compact?: boolean;
}) {
  const others = useOtherEditors(type, id);
  const now = useMinuteTick(others.length > 0);
  if (others.length === 0) return null;

  const label = describe(others, now);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {compact ? (
          // Bare pencil icon (no bordered circle) so it aligns cleanly inline with the row text.
          // BLUE = "is editing" (distinct from amber/red attention).
          <IconEdit
            className={cn("h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400", className)}
            role="img"
            aria-label={label}
          />
        ) : (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-none",
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
              className,
            )}
            role="status"
          >
            <IconEdit className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="leading-none">{label}</span>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{describeLong(others, now)}</TooltipContent>
    </Tooltip>
  );
}

function describe(others: ReadonlyArray<PresenceEditor>, now: number): string {
  if (others.length === 1) return `${others[0].userName} está editando ${formatEditingSince(others[0].since, now)}`;
  return `${others.length} pessoas editando`;
}

function describeLong(others: ReadonlyArray<PresenceEditor>, now: number): string {
  return others.map((e) => `${e.userName} — ${formatEditingSince(e.since, now)}`).join(" · ");
}
