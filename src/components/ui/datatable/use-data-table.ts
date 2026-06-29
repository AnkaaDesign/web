import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  type ColumnOrderState,
  type ColumnSizingState,
  type ColumnSizingInfoState,
  type VisibilityState,
  type SortingState,
  type RowSelectionState,
  type RowPinningState,
  type PaginationState,
  type ExpandedState,
  type Updater,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSearchParams } from "react-router-dom";
import { useTablePreferences } from "@/hooks/common/use-table-preferences";
import type { ColumnAlign, DataTableColumnDef, DataTableMode, PersistedTableConfig } from "./data-table-types";

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** Resolve a TanStack `Updater<T>` (value or fn) against the previous value. */
function applyUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}

/** Keep stored ids that still exist (in their order), then append any new ids. */
function reconcileOrder(stored: string[] | undefined, current: string[]): string[] {
  if (!stored || stored.length === 0) return current;
  // Keep ALL stored ids — even ones not currently present. A privilege-gated column can be briefly
  // absent during a cold load (privilege resolves async); dropping it here would lose the user's
  // saved column order once it reappears (and persist the damage). Stale ids are harmless: TanStack
  // ignores columnOrder entries that match no column.
  const storedSet = new Set(stored);
  return [...stored, ...current.filter((id) => !storedSet.has(id))];
}

function buildDefaultVisibility<TData>(columns: DataTableColumnDef<TData>[]): VisibilityState {
  const v: VisibilityState = {};
  for (const c of columns) v[c.id] = c.meta?.defaultVisible !== false;
  return v;
}

/** Merge a persisted visibility map with defaults so newly-added columns appear. */
function mergeVisibility<TData>(
  columns: DataTableColumnDef<TData>[],
  stored: Record<string, boolean> | undefined,
): VisibilityState {
  const base = buildDefaultVisibility(columns);
  if (!stored) return base;
  for (const c of columns) if (c.id in stored) base[c.id] = stored[c.id];
  return base;
}

function parseJSON<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export interface UseDataTableParams<TData> {
  tableId: string;
  /** Rows to render. In client mode this is the already search/filter-narrowed list. */
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  /** The scroll container the virtualizer measures (owned by the renderer). */
  scrollRef: RefObject<HTMLDivElement | null>;
  getRowId?: (row: TData, index: number) => string;
  mode?: DataTableMode;
  /** Server mode: total row count (for pagination math). */
  rowCount?: number;
  defaultPageSize?: number;
  defaultSorting?: SortingState;
  enableSorting?: boolean;
  enableColumnResizing?: boolean;
  enableColumnReorder?: boolean;
  enableRowSelection?: boolean;
  enableRowPinning?: boolean;
  enablePagination?: boolean;
  /**
   * Render ALL rows at natural height with no internal scroll (the page scrolls the table). The
   * virtualizer still measures/positions rows, but every row is rendered — used for a table that
   * should "show everything it has" and flow in the page (e.g. the top table of a stacked pair).
   */
  autoHeight?: boolean;
  /** Enable native child-row expansion (TanStack sub-rows). Requires `getSubRows`. */
  enableExpansion?: boolean;
  /** Return a row's child rows (e.g. a name-cluster's hidden siblings). Children are real rows. */
  getSubRows?: (row: TData) => TData[] | undefined;
  /** Per-row expand gate; defaults to "has children" (`getSubRows(row)?.length > 0`). */
  getRowCanExpand?: (row: Row<TData>) => boolean;
  /** Initial expanded state: `true` = all expanded, or a {rowId:true} map. Defaults to collapsed. */
  defaultExpanded?: boolean | Record<string, boolean>;
  /** Persist expanded state to the saved layout (keyed by rowId). Defaults to false (transient). */
  persistExpansion?: boolean;
  estimateRowHeight?: number;
  persist?: boolean;
  /**
   * Sync view state (sort/page/selection) to the URL query string. Turn OFF when two tables share
   * one route so their params don't collide; layout still persists server-side via `tableId`.
   */
  syncUrl?: boolean;
  /**
   * Resolved per-sector starting defaults (the entry for the current user's sector), applied with
   * precedence URL > localStorage > server config > SECTOR DEFAULT > hardcoded(meta) defaults. It is
   * NEVER applied over a user's saved (server/local) config or after they've interacted.
   */
  sectorDefault?: Partial<PersistedTableConfig>;
  /**
   * Whether the current privilege has resolved (the user loads async). The one-shot sector-default
   * effect waits for this so it can't apply against an un-gated column set. Defaults to true.
   */
  sectorReady?: boolean;
}

export interface UseDataTableResult<TData> {
  table: ReturnType<typeof useReactTable<TData>>;
  columnSizeVars: Record<string, number>;
  isResizing: boolean;
  rowVirtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
  /** Pinned (top) rows first, then center rows — one list, virtualized together. */
  rows: Row<TData>[];
  dataColumnIds: string[];
  defaultVisibility: VisibilityState;
  /** User per-column alignment overrides (id -> left|center|right). */
  columnAlignment: Record<string, ColumnAlign>;
  setColumnAlignment: (next: Record<string, ColumnAlign>) => void;
  /** Reset layout (order/sizing/visibility/alignment/pins) to defaults and clear persistence. */
  resetLayout: () => void;
  enableColumnReorder: boolean;
  enableRowSelection: boolean;
  enablePagination: boolean;
  pageSizeOptions: number[];
}

export function useDataTable<TData>(params: UseDataTableParams<TData>): UseDataTableResult<TData> {
  const {
    tableId,
    data,
    columns,
    scrollRef,
    getRowId,
    mode = "client",
    rowCount,
    defaultPageSize = 40,
    defaultSorting = [],
    enableSorting = true,
    enableColumnResizing = true,
    enableColumnReorder = true,
    enableRowSelection = true,
    enableRowPinning = true,
    enablePagination = true,
    autoHeight = false,
    enableExpansion = false,
    getSubRows,
    getRowCanExpand,
    defaultExpanded,
    persistExpansion = false,
    estimateRowHeight = 41,
    persist = true,
    syncUrl = true,
    sectorDefault,
    sectorReady = true,
  } = params;

  const dataColumnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const defaultVisibility = useMemo(() => buildDefaultVisibility(columns), [columns]);
  const pageSizeOptions = useMemo(() => [10, 20, 40, 60, 100], []);

  const prefs = useTablePreferences(tableId, persist);
  const { localConfig, localDirty, serverConfig, isServerLoaded } = prefs;

  // --- URL: parse once so it can seed initial state and define precedence ---
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSeed = useRef<{
    sort?: SortingState;
    page?: number;
    pageSize?: number;
    selection?: RowSelectionState;
  }>(null as never);
  if (urlSeed.current === (null as never)) {
    const sort = syncUrl ? parseJSON<SortingState>(searchParams.get("sort")) : undefined;
    const pageRaw = syncUrl ? searchParams.get("page") : null;
    const pageSizeRaw = syncUrl ? searchParams.get("pageSize") : null;
    const selRaw = syncUrl ? searchParams.get("sel") : null;
    const selIds = selRaw ? selRaw.split(",").filter(Boolean) : undefined;
    urlSeed.current = {
      sort,
      page: pageRaw ? Math.max(0, Number(pageRaw) - 1) : undefined,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
      selection: selIds ? Object.fromEntries(selIds.map((id) => [id, true])) : undefined,
    };
  }
  const seed = urlSeed.current;

  // --- Controlled state (seeded: URL > localStorage > sector default > hardcoded defaults) ---
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    reconcileOrder(localConfig?.columnOrder ?? sectorDefault?.columnOrder, dataColumnIds),
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => localConfig?.columnSizing ?? sectorDefault?.columnSizing ?? {});
  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>({
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: [],
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    mergeVisibility(columns, localConfig?.columnVisibility ?? sectorDefault?.columnVisibility),
  );
  const [columnAlignment, setColumnAlignment] = useState<Record<string, ColumnAlign>>(
    () => localConfig?.columnAlignment ?? sectorDefault?.columnAlignment ?? {},
  );
  const [sorting, setSorting] = useState<SortingState>(() => seed.sort ?? localConfig?.sorting ?? sectorDefault?.sorting ?? defaultSorting);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => seed.selection ?? {});
  const [rowPinning, setRowPinning] = useState<RowPinningState>(() => ({
    top: localConfig?.rowPinning?.top ?? sectorDefault?.rowPinning?.top ?? [],
    bottom: [],
  }));
  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: seed.page ?? 0,
    pageSize: seed.pageSize ?? localConfig?.pageSize ?? sectorDefault?.pageSize ?? defaultPageSize,
  }));
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    if (persistExpansion && localConfig?.expanded) return localConfig.expanded;
    if (defaultExpanded === true) return true;
    return typeof defaultExpanded === "object" && defaultExpanded ? defaultExpanded : {};
  });

  // Reconcile order when the column set changes (e.g. permission-gated columns appear).
  const prevIdsRef = useRef(dataColumnIds);
  useEffect(() => {
    const prev = new Set(prevIdsRef.current);
    if (dataColumnIds.some((id) => !prev.has(id)) || prevIdsRef.current.some((id) => !new Set(dataColumnIds).has(id))) {
      setColumnOrder((o) => reconcileOrder(o, dataColumnIds));
      setColumnVisibility((v) => mergeVisibility(columns, v as Record<string, boolean>));
    }
    prevIdsRef.current = dataColumnIds;
  }, [dataColumnIds, columns]);

  // --- Server precedence: apply the user's saved server layout once it loads,
  //     unless the user already interacted, and never overriding URL-provided view. ---
  const userInteracted = useRef(false);
  const serverApplied = useRef(false);
  // Captures whether the server actually returned a saved config — gates the sector-default effect
  // so a sector default can NEVER apply over a user's saved (server) layout.
  const serverHadConfig = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (serverApplied.current || !isServerLoaded) return;
    serverApplied.current = true;
    const cfg: PersistedTableConfig | null = serverConfig;
    serverHadConfig.current = !!cfg;
    // Skip when the local copy holds unsynced (dirty) changes — they may be NEWER than
    // the server (a save that failed last session), so a stale server config must not
    // overwrite them. The dirty layout (already seeded into state) stays and re-syncs.
    if (cfg && !userInteracted.current && !localDirty) {
      setColumnOrder(reconcileOrder(cfg.columnOrder, dataColumnIds));
      setColumnSizing(cfg.columnSizing ?? {});
      setColumnVisibility(mergeVisibility(columns, cfg.columnVisibility));
      setColumnAlignment(cfg.columnAlignment ?? {});
      setRowPinning({ top: cfg.rowPinning?.top ?? [], bottom: [] });
      if (persistExpansion && cfg.expanded) setExpanded(cfg.expanded);
      if (seed.sort === undefined && cfg.sorting) setSorting(cfg.sorting);
      if (seed.pageSize === undefined && cfg.pageSize) {
        setPagination((p) => ({ ...p, pageSize: cfg.pageSize as number }));
      }
    }
    setReady(true);
  }, [isServerLoaded, serverConfig, localDirty, dataColumnIds, columns, seed.sort, seed.pageSize]);

  // --- Sector default (one-shot): `currentPrivilege` (and thus `sectorDefault`) can resolve AFTER
  //     mount, so the useState seed above may have run before it was available. Apply the sector
  //     default to in-memory state once the privilege resolves — but ONLY when there is no server
  //     config, no local config, and the user hasn't interacted. It sits below server/local/user
  //     in precedence and never forces a save (the persist effect's normal behavior is unchanged).
  //     Ordered after the server effect so `serverApplied`/`serverHadConfig` are already settled. ---
  const sectorApplied = useRef(false);
  useEffect(() => {
    if (sectorApplied.current) return;
    // Wait for the privilege (so columns are gated) AND the server load (so we know whether a saved
    // config exists). Until both resolve, leave the seeded state in place.
    if (!sectorReady || !serverApplied.current) return;
    sectorApplied.current = true;
    if (serverHadConfig.current || localConfig || userInteracted.current || localDirty || !sectorDefault) return;
    if (sectorDefault.columnOrder) setColumnOrder(reconcileOrder(sectorDefault.columnOrder, dataColumnIds));
    if (sectorDefault.columnVisibility) setColumnVisibility(mergeVisibility(columns, sectorDefault.columnVisibility));
    if (seed.sort === undefined && sectorDefault.sorting) setSorting(sectorDefault.sorting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorReady, ready, sectorDefault, localConfig, localDirty, dataColumnIds, columns, seed.sort]);

  // --- Persist layout (debounced inside the hook) once the server baseline is known. ---
  useEffect(() => {
    if (!persist || !ready) return;
    prefs.save({
      columnOrder,
      columnSizing,
      columnVisibility: columnVisibility as Record<string, boolean>,
      columnAlignment,
      rowPinning: { top: rowPinning.top ?? [] },
      pageSize: pagination.pageSize,
      sorting: sorting.map((s) => ({ id: s.id, desc: s.desc })),
      // Only persist a finite map (never `true`/all-expanded, which can't be reconciled by id).
      expanded: persistExpansion && expanded && typeof expanded === "object" ? expanded : undefined,
    });
    // prefs.save is stable; intentionally excluded to avoid resave loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, ready, columnOrder, columnSizing, columnVisibility, columnAlignment, rowPinning, pagination.pageSize, sorting, expanded]);

  // --- URL writers (functional updater so concurrent writers don't clobber) ---
  const writeUrl = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      if (!syncUrl) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, syncUrl],
  );

  const handleSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      userInteracted.current = true;
      setSorting((prev) => {
        const next = applyUpdater(updater, prev);
        writeUrl((p) => (next.length ? p.set("sort", JSON.stringify(next)) : p.delete("sort")));
        return next;
      });
      // sorting changes invalidate the current page
      setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
      writeUrl((p) => p.delete("page"));
    },
    [writeUrl],
  );

  const handlePaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      setPagination((prev) => {
        const next = applyUpdater(updater, prev);
        writeUrl((p) => {
          next.pageIndex ? p.set("page", String(next.pageIndex + 1)) : p.delete("page");
          next.pageSize !== defaultPageSize ? p.set("pageSize", String(next.pageSize)) : p.delete("pageSize");
        });
        if (next.pageSize !== prev.pageSize) userInteracted.current = true;
        return next;
      });
    },
    [writeUrl, defaultPageSize],
  );

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      setRowSelection((prev) => {
        const next = applyUpdater(updater, prev);
        const ids = Object.keys(next).filter((k) => next[k]);
        // comma-joined to match the reader (`sel.split(",")`); row ids contain no commas.
        writeUrl((p) => (ids.length ? p.set("sel", ids.join(",")) : p.delete("sel")));
        return next;
      });
    },
    [writeUrl],
  );

  // --- Build the table ---
  const isClient = mode === "client";
  const resolveRowId = useMemo(
    () => getRowId ?? ((row: TData) => (row as { id?: string }).id ?? ""),
    [getRowId],
  );
  // The table only ever sees pins whose row exists in the current data, so
  // `getTopRows()` can never throw "could not find row" when a pinned row is
  // filtered out. The user's full pin intent stays in `rowPinning` (persisted)
  // and reappears automatically when the row returns to the data.
  const dataIds = useMemo(() => {
    const s = new Set<string>();
    data.forEach((r, i) => s.add(resolveRowId(r, i)));
    return s;
  }, [data, resolveRowId]);
  const safeRowPinning: RowPinningState = useMemo(
    () => ({
      top: (rowPinning.top ?? []).filter((id) => dataIds.has(id)),
      bottom: (rowPinning.bottom ?? []).filter((id) => dataIds.has(id)),
    }),
    [rowPinning, dataIds],
  );

  const table = useReactTable<TData>({
    data,
    columns,
    getRowId: resolveRowId,
    state: {
      columnOrder,
      columnSizing,
      columnSizingInfo,
      columnVisibility,
      sorting,
      rowSelection,
      rowPinning: safeRowPinning,
      pagination,
      expanded,
    },
    onExpandedChange: (u) => setExpanded((p) => { userInteracted.current = true; return applyUpdater(u, p); }),
    onColumnOrderChange: (u) => setColumnOrder((p) => { userInteracted.current = true; return applyUpdater(u, p); }),
    onColumnSizingChange: (u) => setColumnSizing((p) => { userInteracted.current = true; return applyUpdater(u, p); }),
    onColumnSizingInfoChange: (u) => setColumnSizingInfo((p) => applyUpdater(u, p)),
    onColumnVisibilityChange: (u) => setColumnVisibility((p) => { userInteracted.current = true; return applyUpdater(u, p); }),
    onSortingChange: handleSortingChange,
    onRowSelectionChange: handleRowSelectionChange,
    onRowPinningChange: (u) => setRowPinning((p) => { userInteracted.current = true; return applyUpdater(u, p); }),
    onPaginationChange: handlePaginationChange,

    getCoreRowModel: getCoreRowModel(),
    // Native child-row expansion: getSubRows builds the tree, getExpandedRowModel flattens the
    // visible (expanded) descendants into getRowModel().rows — so the rest of the table (selection,
    // overlays, click nav) treats children as ordinary rows with no special-casing.
    ...(enableExpansion
      ? { getSubRows, getExpandedRowModel: getExpandedRowModel(), ...(getRowCanExpand ? { getRowCanExpand } : {}) }
      : {}),
    ...(isClient
      ? {
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
        }
      : {
          manualSorting: true,
          manualFiltering: true,
          manualPagination: true,
          rowCount: rowCount ?? data.length,
          autoResetPageIndex: false,
        }),

    enableSorting,
    enableMultiSort: true,
    isMultiSortEvent: () => true,
    enableSortingRemoval: true,
    maxMultiSortColCount: 5,

    enableColumnResizing,
    columnResizeMode: "onChange",

    enableRowSelection,
    enableMultiRowSelection: true,

    enableRowPinning,
    keepPinnedRows: true,

    // We own pagination/expansion + their URL sync (sorting manually resets the page). Disabling
    // TanStack's auto-resets prevents an autoReset firing `setSearchParams` DURING render — toggling
    // expansion changes the row model, which would otherwise trigger a page-reset mid-render.
    autoResetPageIndex: false,
    autoResetExpanded: false,

    defaultColumn: {
      minSize: 60,
      size: 160,
      maxSize: 800,
    },
  });

  // --- Resize perf: CSS variables recomputed only when sizing changes ---
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const vars: Record<string, number> = {};
    for (const header of headers) {
      vars[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return vars;
    // Must recompute when the visible/ordered column SET changes (a newly-shown or reordered column
    // would otherwise lack its `--col-<id>-size` var → invalid flex-basis → broken width until a resize).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, columnSizing, columnSizingInfo, columnOrder, columnVisibility]);

  const isResizing = !!columnSizingInfo.isResizingColumn;

  // --- One virtualized list: pinned (top) rows first, then center rows. They are
  // NOT sticky — they scroll, but stay at the top of the list. Folding them into a
  // single tbody right after the sticky header keeps the virtualizer's start offset
  // masked by the sticky header (no "empty space at top" drift).
  const rows = enableRowPinning ? [...table.getTopRows(), ...table.getCenterRows()] : table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    // autoHeight: render EVERY row (no windowing) so the table grows to its full content height and
    // the page — not the table — scrolls. Rows keep their measured positions, so overlays still work.
    ...(autoHeight ? { rangeExtractor: (range) => Array.from({ length: range.count }, (_, i) => i) } : {}),
  });

  const resetLayout = useCallback(() => {
    userInteracted.current = true;
    // "Restaurar padrão" resets to the SECTOR default when present (so existing users can adopt it),
    // falling back to the hardcoded defaults per field. Persistence is cleared either way.
    setColumnOrder(reconcileOrder(sectorDefault?.columnOrder, dataColumnIds));
    setColumnSizing(sectorDefault?.columnSizing ?? {});
    setColumnVisibility(sectorDefault?.columnVisibility ? mergeVisibility(columns, sectorDefault.columnVisibility) : defaultVisibility);
    setColumnAlignment(sectorDefault?.columnAlignment ?? {});
    setRowPinning({ top: sectorDefault?.rowPinning?.top ?? [], bottom: [] });
    if (sectorDefault?.sorting) setSorting(sectorDefault.sorting);
    else setSorting(defaultSorting);
    setPagination((p) => ({ ...p, pageSize: sectorDefault?.pageSize ?? defaultPageSize }));
    prefs.clear();
  }, [dataColumnIds, defaultVisibility, prefs, sectorDefault, columns, defaultSorting, defaultPageSize]);

  const applyAlignment = useCallback((next: Record<string, ColumnAlign>) => {
    userInteracted.current = true;
    setColumnAlignment(next);
  }, []);

  return {
    table,
    columnSizeVars,
    isResizing,
    rowVirtualizer,
    rows,
    dataColumnIds,
    defaultVisibility,
    columnAlignment,
    setColumnAlignment: applyAlignment,
    resetLayout,
    enableColumnReorder,
    enableRowSelection,
    enablePagination,
    pageSizeOptions,
  };
}
