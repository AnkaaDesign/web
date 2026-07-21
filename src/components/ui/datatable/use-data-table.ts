import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
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
  // Overlay ALL stored entries onto the defaults — including ones for columns not currently
  // present. A privilege-gated column can be briefly absent during a cold load (the privilege
  // resolves async, AFTER the saved config is applied); dropping its stored entry here would lose
  // the user's saved visibility once the column reappears (and re-persist the damage). Stale ids
  // are harmless: TanStack ignores columnVisibility entries that match no column, and gating is
  // enforced upstream (gated columns are filtered out of `columns`), so a preserved `true` can
  // never reveal a column the user isn't allowed to see. Mirrors `reconcileOrder` above.
  return { ...base, ...stored };
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
  /**
   * Windowed (page-scroll) mode: this table has no inner scroll and virtualizes against an EXTERNAL
   * shared scroll container (`scrollRef`) using `scrollMargin` (this list's offset within it). Used to
   * stack several tables inside ONE page scrollbar while every table still renders only its visible
   * rows. Requires `listRef` (the tbody) so the offset can be measured.
   */
  windowed?: boolean;
  /** The list element (tbody) whose offset within the shared scroll container is the `scrollMargin`. */
  listRef?: RefObject<HTMLElement | null>;
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
  /** Allow selecting more than one row (default true). False → single-select (picking clears others). */
  enableMultiRowSelection?: boolean;
  /** One-shot selection seed applied on mount when `syncUrl` is off (the URL `sel` param wins when on). */
  initialSelectedIds?: string[];
  enableRowPinning?: boolean;
  enablePagination?: boolean;
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
  /** When true, disable virtualization windowing (mount all loaded rows) so drag-reorder droppables
   * are all present and their positions don't churn mid-drag. Set by DataTable when `rowReorder` is on. */
  reorderEnabled?: boolean;
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
  /**
   * In windowed mode, the offset (px) of this table's list within the shared scroll container — the
   * value fed to the virtualizer's `scrollMargin`. Row/overlay positions are `virtualItem.start -
   * scrollMargin`. Always 0 in the normal (inner-scroll) mode.
   */
  scrollMargin: number;
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
    windowed = false,
    listRef,
    getRowId,
    mode = "client",
    rowCount,
    defaultPageSize = 40,
    defaultSorting = [],
    enableSorting = true,
    enableColumnResizing = true,
    enableColumnReorder = true,
    enableRowSelection = true,
    enableMultiRowSelection = true,
    initialSelectedIds,
    enableRowPinning = true,
    enablePagination = true,
    enableExpansion = false,
    getSubRows,
    getRowCanExpand,
    defaultExpanded,
    persistExpansion = false,
    estimateRowHeight = 41,
    reorderEnabled = false,
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
    // URL `sel` wins when syncing; otherwise fall back to the one-shot `initialSelectedIds` seed
    // (lets a syncUrl:false picker pre-select rows from a form/wizard's state on mount).
    const selIds = selRaw ? selRaw.split(",").filter(Boolean) : !syncUrl && initialSelectedIds?.length ? initialSelectedIds : undefined;
    // Guard against a hand-edited / malformed URL (`?page=abc`): Number("abc") is NaN, which would
    // poison pageIndex/pageSize. Fall back to undefined (→ the saved/default value) on non-finite input.
    const pageNum = pageRaw ? Number(pageRaw) : NaN;
    const pageSizeNum = pageSizeRaw ? Number(pageSizeRaw) : NaN;
    urlSeed.current = {
      sort,
      page: Number.isFinite(pageNum) ? Math.max(0, pageNum - 1) : undefined,
      pageSize: Number.isFinite(pageSizeNum) && pageSizeNum > 0 ? pageSizeNum : undefined,
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
  // What we PERSIST for sort/pageSize — seeded from the saved layout (NOT the URL). The `sorting`/
  // `pagination` STATE may hold a share-link's URL-seeded values so the link renders correctly, but
  // these refs hold the user's own choice, updated only on a genuine sort/page-size gesture or a
  // server/sector restore. Without this, opening a colleague's sorted link and then (say) resizing a
  // column would save the link's sort as your personal default.
  const persistSortRef = useRef<SortingState>(localConfig?.sorting ?? sectorDefault?.sorting ?? defaultSorting);
  const persistPageSizeRef = useRef<number>(localConfig?.pageSize ?? sectorDefault?.pageSize ?? defaultPageSize);
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
      // Track the saved sort/pageSize as the persist baseline even when a URL seed overrides the
      // DISPLAY below — so a later unrelated interaction re-persists the saved value, not the link's.
      if (cfg.sorting) persistSortRef.current = cfg.sorting;
      if (cfg.pageSize) persistPageSizeRef.current = cfg.pageSize;
      if (seed.sort === undefined && cfg.sorting) {
        setSorting(cfg.sorting);
        // Server-mode pages build their query from the URL, so the restored sort must also reach the
        // URL or the fetch silently runs the default order. Guarded by `seed.sort === undefined`, so
        // this can never fight a share-link's explicit sort.
        if (syncUrl && cfg.sorting.length) writeUrl((p) => p.set("sort", JSON.stringify(cfg.sorting)));
      }
      if (seed.pageSize === undefined && cfg.pageSize) {
        setPagination((p) => ({ ...p, pageSize: cfg.pageSize as number }));
        if (syncUrl && cfg.pageSize !== defaultPageSize) writeUrl((p) => p.set("pageSize", String(cfg.pageSize)));
      }
    }
    setReady(true);
    // writeUrl is referenced in the body only (runs post-mount, after its declaration); this effect
    // is one-shot (serverApplied) so the extra deps can't cause a re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (sectorDefault.sorting) persistSortRef.current = sectorDefault.sorting;
    if (sectorDefault.pageSize) persistPageSizeRef.current = sectorDefault.pageSize;
    if (seed.sort === undefined && sectorDefault.sorting) {
      setSorting(sectorDefault.sorting);
      // Same as the server restore: a server-mode page reads sort from the URL, so the sector default
      // must reach the URL too (no URL seed here, so it can't override a share-link).
      if (syncUrl && sectorDefault.sorting.length) writeUrl((p) => p.set("sort", JSON.stringify(sectorDefault.sorting)));
    }
    if (seed.pageSize === undefined && sectorDefault.pageSize) {
      // Mirror the sorting branch: a sector pageSize default must reach live pagination AND the URL
      // (server-mode pages read pageSize from the URL), not just the persist ref.
      setPagination((p) => ({ ...p, pageSize: sectorDefault.pageSize as number }));
      if (syncUrl && sectorDefault.pageSize !== defaultPageSize) writeUrl((p) => p.set("pageSize", String(sectorDefault.pageSize)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorReady, ready, sectorDefault, localConfig, localDirty, dataColumnIds, columns, seed.sort, seed.pageSize]);

  // --- Mirror the resolved INITIAL sort/pageSize from localStorage into the URL at mount (server-mode
  //     pages read the fetch params from the URL). The server/sector restore effects above cover the
  //     server-config & fresh-user cases; this covers a localStorage layout — notably an unsynced
  //     (dirty) one, where the server-restore block is intentionally skipped. Guarded by "no URL seed"
  //     so a share-link's explicit view always wins, and one-shot so it never loops. ---
  const urlMirrorDone = useRef(false);
  useEffect(() => {
    if (urlMirrorDone.current || !syncUrl) return;
    urlMirrorDone.current = true;
    if (seed.sort === undefined && localConfig?.sorting?.length) {
      writeUrl((p) => p.set("sort", JSON.stringify(localConfig.sorting)));
    }
    if (seed.pageSize === undefined && localConfig?.pageSize && localConfig.pageSize !== defaultPageSize) {
      writeUrl((p) => p.set("pageSize", String(localConfig.pageSize)));
    }
    // one-shot, mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Persist layout (debounced inside the hook) once the server baseline is known. ---
  useEffect(() => {
    if (!persist || !ready) return;
    // Persist ONLY after a genuine user customization. Before any interaction the in-memory layout is
    // just the resolved default (or a share-link's URL-seeded view), and writing it back would
    //   (a) freeze the current default into every user's prefs on first visit — so a later default
    //       improvement would never reach them — and
    //   (b) save a colleague's shared-link sort/pageSize as this user's own layout.
    // Unsynced (dirty) local changes from a prior session are re-pushed by useTablePreferences itself
    // (its `reSynced` effect), so they don't need this effect to fire.
    if (!userInteracted.current) return;
    prefs.save({
      columnOrder,
      columnSizing,
      columnVisibility: columnVisibility as Record<string, boolean>,
      columnAlignment,
      rowPinning: { top: rowPinning.top ?? [] },
      // sort/pageSize come from the persist-baseline refs (the user's own choice), never the live
      // state, which may hold a share-link's URL-seeded view.
      pageSize: persistPageSizeRef.current,
      sorting: persistSortRef.current.map((s) => ({ id: s.id, desc: s.desc })),
      // Only persist a finite map (never `true`/all-expanded, which can't be reconciled by id).
      expanded: persistExpansion && expanded && typeof expanded === "object" ? expanded : undefined,
    });
    // prefs.save is stable; intentionally excluded to avoid resave loops. `sorting`/`pagination.pageSize`
    // stay in deps so a user sort/page-size change re-runs this (the refs are updated in their handlers).
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
        persistSortRef.current = next; // user's own sort → this is what we persist
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
        if (next.pageSize !== prev.pageSize) {
          userInteracted.current = true;
          persistPageSizeRef.current = next.pageSize; // user's own page-size → persist this
        }
        return next;
      });
    },
    [writeUrl, defaultPageSize],
  );

  // Pure reducer — NO side effects. The `sel` URL param is mirrored in a follow-up effect below, keyed
  // on `rowSelection`. Calling `writeUrl` (a router `setSearchParams`) from inside the state updater made
  // the reducer impure and kept the render/URL pipeline hot on every selection write (double-invoked
  // under StrictMode/concurrent), which fed the "Maximum update depth" loop.
  const handleRowSelectionChange = useCallback((updater: Updater<RowSelectionState>) => {
    setRowSelection((prev) => applyUpdater(updater, prev));
  }, []);
  useEffect(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    // comma-joined to match the reader (`sel.split(",")`); row ids contain no commas.
    writeUrl((p) => (ids.length ? p.set("sel", ids.join(",")) : p.delete("sel")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

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
    // Only treat expansion as a persisted customization when it IS persisted; otherwise it's a
    // transient view action (like selection/page-index) that must not flip userInteracted.
    onExpandedChange: (u) => setExpanded((p) => { if (persistExpansion) userInteracted.current = true; return applyUpdater(u, p); }),
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
    enableMultiRowSelection,

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

  // --- Windowed (page-scroll) mode: measure this list's offset within the shared scroll container so
  //     the virtualizer can window against the PAGE scroll while the table flows at natural height.
  //     Recomputed whenever the container OR any sibling table above it changes size (a sibling growing
  //     pushes this list down → its scrollMargin changes), so several stacked tables stay windowed
  //     under a single scrollbar. In normal (inner-scroll) mode this stays 0. ---
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const list = listRef?.current;
    if (!windowed || !container || !list) {
      setScrollMargin((prev) => (prev !== 0 ? 0 : prev));
      return;
    }
    const measure = () => {
      const offset = list.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - offset) > 0.5 ? offset : prev));
    };
    measure();
    // Observe the container AND each of its direct children (the stacked table wrappers): when a table
    // above this one grows/shrinks, this list moves, so its margin must be re-measured. Re-runs on row
    // count changes to re-observe if the set of tables changed.
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    for (const child of Array.from(container.children)) ro.observe(child);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowed, scrollRef, listRef, rows.length]);

  // Keep the virtualizer's option callbacks IDENTITY-STABLE. react-virtual reads them each render, and
  // unstable closures (plus a churning `rows` array) keep the measure/ResizeObserver pipeline hot — a
  // selection's layout perturbation can then spiral into "Maximum update depth exceeded". `getItemKey`
  // reads the latest rows via a ref so it never needs to change identity.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const getScrollElement = useCallback(() => scrollRef.current, [scrollRef]);
  const estimateSize = useCallback(() => estimateRowHeight, [estimateRowHeight]);
  const getItemKey = useCallback((index: number) => rowsRef.current[index]?.id ?? index, []);
  const rowVirtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: rows.length,
    getScrollElement,
    estimateSize,
    // Reorder needs every loaded row mounted as a droppable (see `reorderEnabled`); otherwise off-screen
    // drop targets don't exist and dnd-kit's rects go sparse, producing "messy" drops. Non-reorder
    // tables keep the windowed overscan of 10 — zero behavior change.
    overscan: reorderEnabled ? rows.length : 10,
    getItemKey,
    // Windowed mode: window against the shared page scroll using this list's offset. `virtualItem.start`
    // then includes this margin (positions subtract it); `getTotalSize()` excludes it (tbody height
    // stays this list's own height). 0 in normal mode → identical to the plain inner-scroll virtualizer.
    scrollMargin: windowed ? scrollMargin : 0,
  });

  const resetLayout = useCallback(() => {
    // "Restaurar padrão" resets to the SECTOR default when present (so existing users can adopt it),
    // falling back to the hardcoded defaults per field. Persistence is CLEARED and left cleared:
    // flipping userInteracted off makes the trailing persist effect no-op, so we don't immediately
    // re-save the snapshot (which would re-pin the user to today's default and block future default
    // improvements). A later genuine change re-enables persistence.
    userInteracted.current = false;
    setColumnOrder(reconcileOrder(sectorDefault?.columnOrder, dataColumnIds));
    setColumnSizing(sectorDefault?.columnSizing ?? {});
    setColumnVisibility(sectorDefault?.columnVisibility ? mergeVisibility(columns, sectorDefault.columnVisibility) : defaultVisibility);
    setColumnAlignment(sectorDefault?.columnAlignment ?? {});
    setRowPinning({ top: sectorDefault?.rowPinning?.top ?? [], bottom: [] });
    const resetSort = sectorDefault?.sorting ?? defaultSorting;
    setSorting(resetSort);
    persistSortRef.current = resetSort;
    const resetPageSize = sectorDefault?.pageSize ?? defaultPageSize;
    setPagination((p) => ({ ...p, pageSize: resetPageSize }));
    persistPageSizeRef.current = resetPageSize;
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
    scrollMargin,
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
