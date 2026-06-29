import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Prev/next record navigation for detail pages — generalizes the hand-rolled logic on
 * the Cronograma task page. The ordered id list is handed in by the list/table (via
 * `location.state.ids`); this hook computes neighbours, navigates (forwarding the same
 * id list so paging continues), drives ←/→ keyboard nav, and prefetches neighbours.
 */

// Don't hijack ←/→ while the user is typing in a field or interacting with a combobox /
// listbox / dialog / menu — exactly the guard the task page uses.
const EDITING_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="dialog"], [role="menu"]';

export interface UseRecordNavigationParams {
  /** Ordered ids of the list this record belongs to (from `location.state.ids`). */
  ids: string[] | undefined;
  currentId: string;
  /** Build the detail route for a given id. */
  toRoute: (id: string) => string;
  /** Extra state forwarded with each navigation (the id list is always forwarded). */
  state?: Record<string, unknown>;
  /** Prefetch neighbours — e.g. `queryClient.prefetchQuery` on the detail query key. */
  onPrefetch?: (id: string) => void;
  /** Enable ←/→ keyboard navigation (default true). */
  keyboard?: boolean;
  enabled?: boolean;
}

export interface RecordNavigation {
  /** 0-based index in the list, or -1 if unknown. */
  index: number;
  total: number;
  /** 1-based position for display ("N / total"), or 0 if unknown. */
  position: number;
  prevId: string | null;
  nextId: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
}

export function useRecordNavigation(params: UseRecordNavigationParams): RecordNavigation {
  const { ids, currentId, toRoute, state, onPrefetch, keyboard = true, enabled = true } = params;
  const navigate = useNavigate();

  const nav = useMemo(() => {
    const list = ids ?? [];
    const index = list.indexOf(currentId);
    const prevId = index > 0 ? list[index - 1] : null;
    const nextId = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
    return { list, index, prevId, nextId };
  }, [ids, currentId]);

  const go = useCallback(
    (id: string | null) => {
      if (!id) return;
      navigate(toRoute(id), { state: { ...(state ?? {}), ids: nav.list } });
    },
    [navigate, toRoute, state, nav.list],
  );

  const goPrev = useCallback(() => go(nav.prevId), [go, nav.prevId]);
  const goNext = useCallback(() => go(nav.nextId), [go, nav.nextId]);

  // Prefetch neighbours so paging is instant.
  useEffect(() => {
    if (!enabled || !onPrefetch) return;
    if (nav.prevId) onPrefetch(nav.prevId);
    if (nav.nextId) onPrefetch(nav.nextId);
  }, [enabled, onPrefetch, nav.prevId, nav.nextId]);

  // ←/→ keyboard nav (ignored while editing a field or inside a combobox/dialog).
  useEffect(() => {
    if (!enabled || !keyboard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const target = e.target as Element | null;
      const active = document.activeElement;
      if (target?.closest?.(EDITING_SELECTOR) || active?.closest?.(EDITING_SELECTOR)) return;
      e.preventDefault();
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, keyboard, goPrev, goNext]);

  return {
    index: nav.index,
    total: nav.list.length,
    position: nav.index >= 0 ? nav.index + 1 : 0,
    prevId: nav.prevId,
    nextId: nav.nextId,
    hasPrev: !!nav.prevId,
    hasNext: !!nav.nextId,
    goPrev,
    goNext,
  };
}
