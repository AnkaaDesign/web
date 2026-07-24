// =====================================================
// Attention system — <IsEditingBadge> "someone else has this open" indicator
// =====================================================
//
// Small, reusable presence display. The transport (gateway + socket + store) and
// the announce side (useAnnouncePresence, called from the edit route) already
// work; this is the missing READ side — render it anywhere an entity can be
// concurrently edited: the detail page, the table row, and the edit form itself.

import { IconEdit } from "@tabler/icons-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { ATTENTION_CLIENT_ID } from "./attention-socket";
import { useEntityPresence, type PresenceEditor } from "./presence";
import type { AttentionEntityType } from "./types";

/**
 * Who else is editing this entity right now — excluding THIS tab's own announcement.
 * Keyed by the stable per-tab ATTENTION_CLIENT_ID (a module constant, never undefined,
 * never changes on reconnect), so self-exclusion is reliable — the original bug was
 * comparing against socket.id, which is undefined until connect and re-generated on
 * every reconnect, so the tab's own entry randomly survived the filter and it warned
 * about itself. "My account in a DIFFERENT tab" (different clientId, same userId) is a
 * real conflict and is kept, collapsed to one entry per user.
 */
export function useOtherEditors(type: AttentionEntityType, id: string | undefined): ReadonlyArray<PresenceEditor> {
  const editors = useEntityPresence(type, id);
  const others = editors.filter((e) => e.clientId !== ATTENTION_CLIENT_ID);
  // Collapse multiple tabs of the SAME user (other than this one) into one badge entry.
  const seen = new Set<string>();
  return others.filter((e) => (seen.has(e.userId) ? false : (seen.add(e.userId), true)));
}

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
  if (others.length === 0) return null;
  const names = others.map((e) => e.userName).join(", ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {compact ? (
          // Bare pencil icon (no bordered circle) so it aligns cleanly inline with the row text.
          // BLUE = "is editing" (distinct from amber/red attention).
          <IconEdit className={cn("h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400", className)} aria-label="Sendo editado" />
        ) : (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-none",
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
              className,
            )}
          >
            <IconEdit className="h-3 w-3 shrink-0" />
            <span className="leading-none">{others.length === 1 ? `${others[0].userName} está editando` : `${others.length} pessoas editando`}</span>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {names} {others.length === 1 ? "está editando isso agora" : "estão editando isso agora"}
      </TooltipContent>
    </Tooltip>
  );
}
