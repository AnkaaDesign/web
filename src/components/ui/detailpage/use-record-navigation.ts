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
  /**
   * Navigate through something other than a bare `navigate` — e.g. a form page's
   * `guardedNavigate`, so paging away from a dirty form prompts instead of discarding it.
   * (The unsaved-changes guard's `history.pushState` patch does catch a bare `navigate`, but it
   * replays only the URL and drops the state — which would silently lose the id list.)
   */
  onNavigate?: (to: string, options: { state: Record<string, unknown> }) => void;
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
  const { ids, currentId, toRoute, state, onPrefetch, keyboard = true, enabled = true, onNavigate } = params;
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
      const to = toRoute(id);
      // `replace` so a skim does not bury the list under one history entry per record — Back from
      // the 20th record should reach the list, not walk back through all 19. The list is still
      // reachable by the breadcrumb and by `returnTo`, which ride along in `state`.
      const options = { state: { ...(state ?? {}), ids: nav.list }, replace: true };
      if (onNavigate) onNavigate(to, options);
      else navigate(to, options);
    },
    [navigate, onNavigate, toRoute, state, nav.list],
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
    // Report a navigable total only when the current record is actually in the list. A stale deep-link
    // (currentId not found, index = -1) otherwise rendered the widget as "0 / N" with both arrows dead;
    // treating it as no-context (total 0) hides the widget cleanly, like the no-ids case.
    total: nav.index >= 0 ? nav.list.length : 0,
    position: nav.index >= 0 ? nav.index + 1 : 0,
    prevId: nav.prevId,
    nextId: nav.nextId,
    hasPrev: !!nav.prevId,
    hasNext: !!nav.nextId,
    goPrev,
    goNext,
  };
}
