import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTablePreferences } from "@/hooks/common/use-table-preferences";
import type { PersistedTableConfig } from "@/components/ui/datatable/data-table-types";

/**
 * Reusable column-resize engine for the hand-rolled tables used across detail/form
 * pages (the ones built on the raw `@/components/ui/table` primitives, NOT the
 * TanStack-powered DataTable). It gives those tables the SAME drag-to-resize +
 * per-user persistence the main lists already have.
 *
 * Widths persist through the very same store the DataTable uses — `useTablePreferences`
 * → `Preferences.tableConfigsWeb[tableId].columnSizing` — so a table id is all a caller
 * needs and the layout survives reloads and follows the user across devices. Only the
 * `columnSizing` slice is touched; any other persisted layout on that id is preserved.
 *
 * Rendering model (mirrors the DataTable): the hook exposes `columnSizeVars`, a map of
 * `--col-<id>-size` CSS custom properties to spread on a common ancestor of the header
 * AND body tables. Each cell then sizes itself with `width: var(--col-<id>-size)` (via
 * `getColumnStyle`). Because the vars live on a shared ancestor, a fixed-header table
 * and its separate scrollable-body table stay pixel-aligned automatically.
 */

export interface ResizableColumnDef {
  /** Stable column id — used for the CSS var name and the persisted width key. */
  id: string;
  /** Width in px used until the user drags this column. */
  defaultWidth: number;
  /** Lower clamp while dragging. Defaults to 60px. */
  minWidth?: number;
  /** Upper clamp while dragging. Defaults to unbounded. */
  maxWidth?: number;
  /** Set false for fixed columns (checkbox, scrollbar spacer) that never resize. */
  resizable?: boolean;
}

const DEFAULT_MIN_WIDTH = 60;

export interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

export interface UseResizableColumnsOptions {
  /** Stable persistence key (shared namespace with the DataTable's `tableId`). */
  tableId: string;
  columns: ResizableColumnDef[];
  /** Disable persistence (widths stay session-only). Default true. */
  enabled?: boolean;
}

export interface UseResizableColumnsResult {
  /** Spread on a common ancestor of the header + body tables. */
  columnSizeVars: CSSProperties;
  /** Resolved width (px) for a column — persisted value, else its default. */
  getWidth: (id: string) => number;
  /** Style for any header/body cell of a column. */
  getColumnStyle: (id: string) => CSSProperties;
  /** Props for the column's <ColumnResizeHandle>. */
  getResizeHandleProps: (id: string) => ResizeHandleProps;
  /** Whether a column is being dragged right now. */
  isResizing: (id: string) => boolean;
  /** Reset every column to its default width and drop the persisted layout. */
  resetWidths: () => void;
}

export function useResizableColumns({ tableId, columns, enabled = true }: UseResizableColumnsOptions): UseResizableColumnsResult {
  const prefs = useTablePreferences(tableId, enabled);

  const colMap = useMemo(() => {
    const m = new Map<string, ResizableColumnDef>();
    for (const c of columns) m.set(c.id, c);
    return m;
  }, [columns]);

  const [sizing, setSizing] = useState<Record<string, number>>(() => prefs.localConfig?.columnSizing ?? {});
  const [resizingId, setResizingId] = useState<string | null>(null);

  // A ref mirror of `sizing` so the drag listeners (registered once per drag) always
  // read the freshest widths without being torn down and re-added on every mousemove.
  const sizingRef = useRef(sizing);
  useEffect(() => {
    sizingRef.current = sizing;
  }, [sizing]);

  // Once the user drags, the server layout must not clobber their in-progress widths.
  const userInteracted = useRef(false);
  const serverApplied = useRef(false);
  useEffect(() => {
    if (serverApplied.current || !prefs.isServerLoaded) return;
    serverApplied.current = true;
    if (prefs.serverConfig?.columnSizing && !userInteracted.current && !prefs.localDirty) {
      const next = prefs.serverConfig.columnSizing;
      sizingRef.current = next;
      setSizing(next);
    }
  }, [prefs.isServerLoaded, prefs.serverConfig, prefs.localDirty]);

  const getWidth = useCallback((id: string) => sizing[id] ?? colMap.get(id)?.defaultWidth ?? 120, [sizing, colMap]);

  const columnSizeVars = useMemo(() => {
    const vars: Record<string, string> = {};
    for (const c of columns) vars[`--col-${c.id}-size`] = `${sizing[c.id] ?? c.defaultWidth}px`;
    return vars as CSSProperties;
  }, [columns, sizing]);

  const getColumnStyle = useCallback((id: string): CSSProperties => ({ width: `var(--col-${id}-size)` }), []);

  const persist = useCallback(
    (next: Record<string, number>) => {
      const base: PersistedTableConfig = prefs.serverConfig ?? prefs.localConfig ?? {};
      prefs.save({ ...base, columnSizing: next });
    },
    [prefs],
  );

  // Active drag state + the teardown for the current drag's window listeners.
  const drag = useRef<{ id: string; startX: number; startWidth: number; min: number; max: number } | null>(null);
  const teardown = useRef<() => void>(() => {});

  const beginDrag = useCallback(
    (id: string, clientX: number) => {
      const def = colMap.get(id);
      if (!def || def.resizable === false) return;
      userInteracted.current = true;
      drag.current = {
        id,
        startX: clientX,
        startWidth: getWidth(id),
        min: def.minWidth ?? DEFAULT_MIN_WIDTH,
        max: def.maxWidth ?? Number.POSITIVE_INFINITY,
      };
      setResizingId(id);

      const move = (cx: number) => {
        const d = drag.current;
        if (!d) return;
        const width = Math.min(d.max, Math.max(d.min, d.startWidth + (cx - d.startX)));
        const next = { ...sizingRef.current, [d.id]: width };
        sizingRef.current = next;
        setSizing(next);
      };
      const onMouseMove = (e: MouseEvent) => move(e.clientX);
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) move(e.touches[0].clientX);
      };
      const finish = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", finish);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", finish);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        const wasDragging = drag.current;
        drag.current = null;
        teardown.current = () => {};
        setResizingId(null);
        if (wasDragging) persist(sizingRef.current);
      };
      teardown.current = finish;

      // Kill text selection + force the resize cursor for the whole drag.
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", finish);
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", finish);
    },
    [colMap, getWidth, persist],
  );

  const getResizeHandleProps = useCallback(
    (id: string): ResizeHandleProps => ({
      onMouseDown: (e) => {
        e.preventDefault();
        e.stopPropagation();
        beginDrag(id, e.clientX);
      },
      onTouchStart: (e) => {
        e.stopPropagation();
        if (e.touches[0]) beginDrag(id, e.touches[0].clientX);
      },
    }),
    [beginDrag],
  );

  const isResizing = useCallback((id: string) => resizingId === id, [resizingId]);

  const resetWidths = useCallback(() => {
    userInteracted.current = true;
    sizingRef.current = {};
    setSizing({});
    prefs.clear();
  }, [prefs]);

  // Clean up a drag left in flight if the table unmounts mid-gesture.
  useEffect(() => () => teardown.current(), []);

  return { columnSizeVars, getWidth, getColumnStyle, getResizeHandleProps, isResizing, resetWidths };
}
