import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { flexRender, type ExpandedState, type Header, type Row, type Table } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { notify } from "@/api-client";
import { IconChevronUp, IconChevronDown, IconSelector, IconPin, IconPinnedOff, IconChevronRight } from "@tabler/icons-react";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
import { usePrivileges } from "@/hooks/common/use-privileges";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { cn } from "@/lib/utils";
import { useDataTable } from "./use-data-table";
import { DataTableToolbar, type ShareAction } from "./data-table-toolbar";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableFilterSheet } from "./data-table-filter-sheet";
import { DataTableShareDialog, type ShareFormat } from "./data-table-share-dialog";
import { copyShareLink } from "./data-table-export";
import { DataTableContextMenu, type DataTableContextMenuState } from "./data-table-context-menu";
import {
  rowMatchesSearch,
  rowMatchesFilters,
  countActiveFilters,
  isEmptyFilter,
  formatFilterChipValue,
} from "./data-table-utils";
import type {
  ColumnAlign,
  DataTableColumnDef,
  DataTableFilterDef,
  DataTableFilterValues,
  DataTableMode,
  DataTableRowAction,
  PrivilegeGate,
  SectorDefaults,
} from "./data-table-types";

// 40px to match the global checkbox-cell width override in index.css.
const SELECT_COL_WIDTH = 40;
// Leading expander column (chevron) when row expansion is enabled.
const EXPAND_COL_WIDTH = 36;
// Stable empty defaults so a page that passes no filterDefs/rowActions doesn't allocate a
// fresh array each render (which would rebuild the TanStack row model on every scroll frame).
const EMPTY_FILTER_DEFS: DataTableFilterDef<unknown>[] = [];
const EMPTY_ROW_ACTIONS: DataTableRowAction<unknown>[] = [];

/** Context handed to `onRowClick`: the table's current filtered+sorted row order + this row's index in it. */
export interface DataTableRowClickMeta {
  orderedIds: string[];
  index: number;
}

export interface DataTableProps<TData> {
  /** Stable id for this table — the persistence key (Preferences.tableConfigsWeb[tableId]). */
  tableId: string;
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  getRowId?: (row: TData) => string;
  mode?: DataTableMode;
  /** Server mode: total row count across all pages. */
  rowCount?: number;
  /**
   * Server mode: fetch EVERY row matching the current search/filters (across all pages) for an
   * "export all" — the engine only holds the current page, so the page owner supplies this (it calls
   * the same list endpoint with a large limit + the active query). Omit in client mode, where the
   * engine already has the full filtered set. When provided, the share dialog offers a "Todos os
   * registros" scope.
   */
  onExportFetchAll?: () => Promise<TData[]>;
  filterDefs?: DataTableFilterDef<TData>[];
  /** Right-click context-menu actions (in addition to the built-in pin/unpin). */
  rowActions?: DataTableRowAction<TData>[];
  /**
   * Row click. The second arg hands over the table's CURRENT filtered+sorted order so a
   * detail page can page prev/next within exactly the list the user sees:
   * `navigate(detail(row.id), { state: { ids: meta.orderedIds } })`.
   */
  onRowClick?: (row: TData, meta: DataTableRowClickMeta) => void;
  /**
   * Optional per-row className hook — the returned classes are merged onto the rendered row
   * (alongside the built-in striping/selection/hover classes). Additive and OPTIONAL: callers
   * that omit it are completely unaffected. Use for row-level tinting driven by row data (e.g. a
   * schedule tinting rows by deadline). Keep the returned classes purely visual (background/text);
   * layout/positioning is owned by the table.
   */
  getRowClassName?: (row: TData) => string;
  searchPlaceholder?: string;
  /**
   * Optional heading rendered INSIDE the card, above the toolbar/search input (e.g. a section
   * title for a stacked pair of tables). When set together with `titleCount`, a muted count is
   * appended (e.g. "Em Produção (5)").
   */
  title?: ReactNode;
  /** Count appended to `title` in muted parentheses. Ignored when `title` is unset. */
  titleCount?: number;
  /** Extra controls rendered in the toolbar (left of the column manager). */
  toolbarActions?: ReactNode;
  /** Extra content rendered at the TOP of the Filtros drawer, above the declarative filter fields. */
  filterContent?: ReactNode;
  enableSelection?: boolean;
  enableColumnReorder?: boolean;
  enableColumnResizing?: boolean;
  enableRowPinning?: boolean;
  enablePagination?: boolean;
  enableShare?: boolean;
  /**
   * Render ALL rows at natural height with NO internal scroll — the table grows to fit its content
   * and the surrounding page scrolls it (pagination is forced off). Use for the top table of a
   * stacked pair that should "show everything", while the bottom table keeps its own body scroll.
   */
  autoHeight?: boolean;
  /**
   * Enable generic, reusable row expand/collapse via TanStack native sub-rows. Pass `getSubRows`
   * to supply each row's children — they render as real, individually selectable/clickable rows,
   * indented under their parent. A leading chevron column appears; the header chevron toggles all.
   */
  enableExpansion?: boolean;
  /** Return a row's child rows (e.g. a name-cluster's hidden siblings). Required for expansion. */
  getSubRows?: (row: TData) => TData[] | undefined;
  /** Per-row expand gate; defaults to "has children". */
  getRowCanExpand?: (row: Row<TData>) => boolean;
  /** Initial expansion: `true` = all expanded, or a {rowId:true} map. Defaults to collapsed. */
  defaultExpanded?: boolean | Record<string, boolean>;
  /** Persist expansion to the saved layout (keyed by rowId). Defaults to false (transient). */
  persistExpansion?: boolean;
  defaultPageSize?: number;
  defaultSorting?: { id: string; desc: boolean }[];
  estimateRowHeight?: number;
  persist?: boolean;
  /**
   * Per-sector STARTING defaults (visible/ordered columns, sort, etc.), keyed by the user's single
   * sector privilege. Applied with precedence URL > localStorage > server config > SECTOR DEFAULT >
   * hardcoded(meta) defaults — so it NEVER overrides a user's saved or interacted-with layout. Omit a
   * sector key (e.g. ADMIN) to fall back to the hardcoded `meta.defaultVisible` defaults for it.
   */
  sectorDefaults?: SectorDefaults;
  /**
   * Render WITHOUT the outer card chrome (border/background/outer padding) — for embedding
   * inside another card, e.g. a detail-page section. The inner table frame is kept.
   */
  bare?: boolean;
  exportTitle?: string;
  exportFilename?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  /**
   * Sync search/filter/selection/sort to the URL. Turn OFF when two tables share one route so
   * their query params don't collide; server-side layout persistence (by `tableId`) still works.
   */
  syncUrl?: boolean;
  className?: string;
  /** Share the scroll container with a parent (e.g. `<DataTablePage>` for scroll-hide header). */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  /** Server mode: fired when search/filters change so the page can refetch. */
  onParamsChange?: (params: { search: string; filters: DataTableFilterValues }) => void;
}

export function DataTable<TData>(props: DataTableProps<TData>) {
  const {
    tableId,
    data,
    columns: rawColumns,
    getRowId,
    mode = "client",
    rowCount,
    onExportFetchAll,
    filterDefs: rawFilterDefs = EMPTY_FILTER_DEFS,
    rowActions = EMPTY_ROW_ACTIONS,
    onRowClick,
    getRowClassName,
    searchPlaceholder,
    title,
    titleCount,
    toolbarActions,
    filterContent,
    enableSelection = true,
    enableColumnReorder = true,
    enableColumnResizing = true,
    enableRowPinning = true,
    enablePagination = true,
    enableShare = true,
    autoHeight = false,
    enableExpansion = false,
    getSubRows,
    getRowCanExpand,
    defaultExpanded,
    persistExpansion = false,
    defaultPageSize = 40,
    defaultSorting = [],
    estimateRowHeight = 41,
    persist = true,
    sectorDefaults,
    bare = false,
    exportTitle = "Dados",
    exportFilename = tableId,
    isLoading = false,
    emptyMessage = "Nenhum resultado encontrado",
    syncUrl = true,
    className,
    scrollContainerRef,
    onParamsChange,
  } = props;

  const [searchParams, setSearchParams] = useSearchParams();
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  // Windowed mode: `autoHeight` + a shared (external) scroll container → this table has NO inner scroll
  // and virtualizes against that page container via scrollMargin, so several tables stack under one
  // scrollbar. Otherwise the table owns its inner scroll (`scrollContainerRef` may still alias it so a
  // parent like DataTablePage can watch it, e.g. for scroll-hide header).
  const windowed = autoHeight && !!scrollContainerRef;
  const scrollRef = windowed ? scrollContainerRef : (scrollContainerRef ?? internalScrollRef);
  // The body tbody, whose offset within the shared container is measured as the scrollMargin (windowed).
  const listRef = useRef<HTMLTableSectionElement | null>(null);

  // --- Privilege gating: drop columns / filters / row-actions the user may not see BEFORE
  //     the table is built, so a gated item never reaches the render, the column-visibility
  //     picker, the filter sheet, the context menu, OR the export. ADMIN passes everything;
  //     a column/filter/action just lists the sector privileges allowed to see it.
  //     Async-safe: when the user resolves, `currentPrivilege` changes → these recompute and
  //     useDataTable's reconcile effect folds the newly-visible columns in cleanly. ---
  const { canAccess, currentPrivilege } = usePrivileges();
  const isAllowed = (gate?: PrivilegeGate) => !gate || canAccess(gate);
  // Resolve this user's sector starting defaults (null until the privilege loads — `sectorReady`
  // below gates the engine's one-shot apply on it).
  const sectorDefault = currentPrivilege ? sectorDefaults?.[currentPrivilege] : undefined;
  const columns = useMemo(
    () => rawColumns.filter((c) => isAllowed(c.meta?.requiredPrivilege)),
    // keyed by the privilege state — `canAccess`/`isAllowed` are fresh closures each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawColumns, currentPrivilege],
  );
  const filterDefs = useMemo(
    () => rawFilterDefs.filter((d) => isAllowed(d.requiredPrivilege)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawFilterDefs, currentPrivilege],
  );

  const getId = useMemo(() => getRowId ?? ((r: TData) => (r as { id?: string }).id ?? ""), [getRowId]);

  // --- search (URL `q`, debounced) + filters (URL `filters`) ---
  const [displaySearch, setDisplaySearch] = useState(() => (syncUrl ? (searchParams.get("q") ?? "") : ""));
  const debouncedSearch = useDebouncedValue(displaySearch, 250);
  const [filters, setFilters] = useState<DataTableFilterValues>(() => {
    if (!syncUrl) return {};
    try {
      return JSON.parse(searchParams.get("filters") ?? "{}") as DataTableFilterValues;
    } catch {
      return {};
    }
  });

  // "View selected only": narrow to the selected rows. Sourced from the URL `sel` param
  // (selection lives there) since `filtered` is computed before the table exists. The toggle itself
  // is mirrored to the URL `selOnly` param so a shared link reproduces the filtered view.
  const [viewSelectedOnly, _setViewSelectedOnly] = useState(() => syncUrl && searchParams.get("selOnly") === "1");
  // Mirror of the table's live selection — lets "view selected only" work even without URL sync
  // (two-table pages run syncUrl:false, so the URL `sel` param is unavailable). An effect keeps it in
  // sync once the table exists; for syncUrl tables `selectedIds` keeps reading the URL as before.
  const [mirroredSelection, setMirroredSelection] = useState<Set<string>>(new Set());
  const selectedIds = useMemo(() => {
    if (syncUrl) {
      const raw = searchParams.get("sel");
      return raw ? new Set(raw.split(",").filter(Boolean)) : null;
    }
    return mirroredSelection.size ? mirroredSelection : null;
  }, [searchParams, syncUrl, mirroredSelection]);

  const writeParam = useCallback(
    (key: string, value: string | null) => {
      if (!syncUrl) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, syncUrl],
  );

  // Mirror the "view selected only" toggle to the URL so it persists across reloads and is encoded
  // in a shared link (copyShareLink copies window.location.href).
  const setViewSelectedOnly = useCallback(
    (value: boolean) => {
      _setViewSelectedOnly(value);
      writeParam("selOnly", value ? "1" : null);
    },
    [writeParam],
  );

  // Returns the table to page 1. Wired to `dt.table` once the engine is built (below). Narrowing the
  // result set must reset the page or you land on a now-empty out-of-range page — server mode reads
  // `page` from the URL and would refetch page N of a shorter set; client mode would strand you on an
  // empty page. `setPageIndex(0)` covers both (it clears the URL `page` AND resets internal state).
  const resetToFirstPage = useRef<() => void>(() => {});

  useEffect(() => {
    writeParam("q", debouncedSearch || null);
  }, [debouncedSearch, writeParam]);

  // Reset to page 1 when the (debounced) search changes — skipping the initial mount so a deep-linked
  // `?q=…&page=N` still opens on page N.
  const searchPageResetMounted = useRef(false);
  useEffect(() => {
    if (!searchPageResetMounted.current) {
      searchPageResetMounted.current = true;
      return;
    }
    resetToFirstPage.current();
  }, [debouncedSearch]);

  useEffect(() => {
    onParamsChange?.({ search: debouncedSearch, filters });
  }, [debouncedSearch, filters, onParamsChange]);

  const applyFilters = useCallback(
    (next: DataTableFilterValues) => {
      setFilters(next);
      writeParam("filters", countActiveFilters(next) > 0 ? JSON.stringify(next) : null);
      resetToFirstPage.current(); // any filter change → back to page 1
    },
    [writeParam],
  );

  // --- client-mode narrowing (search + filters + view-selected-only) ---
  const filtered = useMemo(() => {
    if (mode !== "client") {
      // Server mode narrows search/filters/pagination server-side, but "view selected only" can
      // still filter the currently-loaded page client-side. This only sees selections on the page
      // in view (cross-page selections aren't loaded), which matches the toggle's count.
      if (viewSelectedOnly && selectedIds) return data.filter((r) => selectedIds.has(getId(r)));
      return data;
    }
    let rows = data;
    if (debouncedSearch) {
      // Match DEEPLY: a grouped/clustered parent has its members in sub-rows (getSubRows). Searching
      // must find a match anywhere in the subtree, otherwise a child that matches (e.g. a task's
      // serial that only exists on a grouped child) is invisible because the parent's own cells
      // don't contain it. Keep the row when it — or any descendant — matches.
      const matchesDeep = (r: TData): boolean => {
        if (rowMatchesSearch(r, columns, debouncedSearch)) return true;
        const kids = getSubRows?.(r);
        return Array.isArray(kids) && kids.some(matchesDeep);
      };
      rows = rows.filter(matchesDeep);
    }
    if (filterDefs.length) rows = rows.filter((r) => rowMatchesFilters(r, filterDefs, filters));
    if (viewSelectedOnly && selectedIds) rows = rows.filter((r) => selectedIds.has(getId(r)));
    return rows;
  }, [mode, data, columns, debouncedSearch, filterDefs, filters, viewSelectedOnly, selectedIds, getId, getSubRows]);

  const dt = useDataTable<TData>({
    tableId,
    data: filtered,
    columns,
    scrollRef,
    windowed,
    listRef,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    mode,
    rowCount,
    defaultPageSize,
    defaultSorting,
    enableColumnResizing,
    enableColumnReorder,
    enableRowSelection: enableSelection,
    enableRowPinning,
    enablePagination: enablePagination && !autoHeight,
    enableExpansion,
    getSubRows,
    getRowCanExpand,
    defaultExpanded,
    persistExpansion,
    estimateRowHeight,
    persist,
    syncUrl,
    sectorDefault,
    sectorReady: !!currentPrivilege,
  });

  const { table, columnSizeVars, rowVirtualizer, scrollMargin, rows, columnAlignment, setColumnAlignment } = dt;
  // Wire the page-1 reset now that the engine exists (used by the search + filter effects above).
  resetToFirstPage.current = () => table.setPageIndex(0);

  // Auto-expand groups while a search is active. The deep-match above keeps a grouped parent when a
  // descendant matches, but the matching child stays collapsed (hidden) until the group is expanded.
  // Snapshot the pre-search expansion and restore it once the search clears so we don't clobber the
  // user's manual/persisted expand state.
  const preSearchExpanded = useRef<ExpandedState | null>(null);
  const searchExpandActive = !!debouncedSearch && !!getSubRows;
  useEffect(() => {
    if (!getSubRows) return;
    if (searchExpandActive) {
      if (preSearchExpanded.current === null) preSearchExpanded.current = table.getState().expanded;
      table.toggleAllRowsExpanded(true);
    } else if (preSearchExpanded.current !== null) {
      table.setExpanded(preSearchExpanded.current);
      preSearchExpanded.current = null;
    }
  }, [searchExpandActive, getSubRows, table]);

  // Hand the table's CURRENT filtered+sorted order to onRowClick so a detail page can page
  // prev/next through exactly the list the user sees (across pages, not just the page).
  const handleRowClick = useMemo(
    () =>
      onRowClick
        ? (row: Row<TData>) => {
            // Full filtered+sorted order across pages. With expansion on, use the expanded model so
            // the order matches what's on screen (top-level rows + currently-expanded children).
            const orderedIds = (enableExpansion ? table.getExpandedRowModel() : table.getSortedRowModel()).rows.map((r) => r.id);
            onRowClick(row.original, { orderedIds, index: orderedIds.indexOf(row.id) });
          }
        : undefined,
    [onRowClick, table, enableExpansion],
  );

  // Keep the current VISUAL row order ([...pinned, ...center]) in a ref so the shift-click
  // handler reads exactly what's on screen, without going stale or churning the callback.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // --- effective alignment (user override > column meta > left) ---
  const alignMap = useMemo(() => {
    const m: Record<string, ColumnAlign> = {};
    for (const c of columns) m[c.id] = columnAlignment[c.id] ?? c.meta?.align ?? "left";
    return m;
  }, [columns, columnAlignment]);
  const alignKey = useMemo(() => Object.entries(alignMap).map(([k, v]) => `${k}:${v}`).join(","), [alignMap]);

  // --- selection / counts / export rows ---
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Keep the selection mirror in sync (the guard makes it a no-op when nothing changed). Only the
  // !syncUrl path reads it, but updating it always is harmless and keeps the logic simple.
  useEffect(() => {
    const ids = selectedRows.map((r) => r.id);
    setMirroredSelection((prev) => (prev.size === ids.length && ids.every((id) => prev.has(id)) ? prev : new Set(ids)));
  }, [selectedRows]);
  const totalItems = mode === "client" ? filtered.length : rowCount ?? filtered.length;
  // Export row sources — the share dialog lets the user pick the scope (selected / current page /
  // ALL filtered rows). "Selected" and "All" are resolved lazily on export: client mode reads the
  // in-memory pre-pagination model; server mode calls the page's fetch-all hook (one request).
  const exportSelectedRows = selectedRows.map((r) => r.original);
  const exportPageRows = table.getRowModel().rows.map((r) => r.original);
  // Full selection count across ALL pages. Selection ids persist in the URL `sel` param (or the
  // mirror) even for rows not currently loaded, so the export's "Selecionados" scope reflects the
  // whole selection — not just the rows materialised on the current page (server mode).
  const selectedAllCount = selectedIds ? selectedIds.size : selectedCount;
  const canExportAll = mode === "client" || !!onExportFetchAll;
  const resolveAllRows = useCallback(async (): Promise<TData[]> => {
    if (mode === "client") return table.getPrePaginationRowModel().rows.map((r) => r.original);
    if (onExportFetchAll) return onExportFetchAll();
    return table.getRowModel().rows.map((r) => r.original);
  }, [mode, table, onExportFetchAll]);
  // Resolve the FULL selection for export. Client mode already holds every row, so the in-memory
  // selected model is complete. Server mode may have selected rows on unloaded pages: fetch the
  // full filtered set and narrow it to the selected ids (kept in the URL across pages).
  const resolveSelectedRows = useCallback(async (): Promise<TData[]> => {
    if (mode === "client" || !selectedIds || !onExportFetchAll) return exportSelectedRows;
    const all = await onExportFetchAll();
    return all.filter((r) => selectedIds.has(getId(r)));
  }, [mode, selectedIds, onExportFetchAll, exportSelectedRows, getId]);

  // Auto-disable the "view selected only" filter only when the WHOLE selection is empty (keyed off
  // the URL/mirror selection, not the loaded-page count). Using the loaded count would wrongly fire
  // on a reload/shared link in server mode, where the page data arrives async and the selected rows
  // aren't materialised on the first render yet — clearing the toggle before the selection loads.
  useEffect(() => {
    if (selectedAllCount === 0 && viewSelectedOnly) setViewSelectedOnly(false);
  }, [selectedAllCount, viewSelectedOnly, setViewSelectedOnly]);

  const order = table.getState().columnOrder;
  const orderedColumns = useMemo(() => {
    const idx = new Map(order.map((id, i) => [id, i] as const));
    return [...columns].sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
  }, [columns, order]);
  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => c.id);

  // --- selection helpers (shift-click range + single toggle) ---
  const selectionAnchorRef = useRef<string | null>(null);
  const handleSelectRow = useCallback(
    (row: Row<TData>, shiftKey: boolean) => {
      const pageRows = rowsRef.current; // current VISUAL order ([...pinned, ...center])
      const anchorId = selectionAnchorRef.current;
      if (shiftKey) window.getSelection()?.removeAllRanges(); // clear any text highlight from the shift-click
      if (shiftKey && anchorId) {
        const a = pageRows.findIndex((r) => r.id === anchorId);
        const b = pageRows.findIndex((r) => r.id === row.id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          table.setRowSelection((prev) => {
            const next = { ...prev };
            for (let i = lo; i <= hi; i++) next[pageRows[i].id] = true;
            return next;
          });
          return; // keep the anchor so the range can be re-extended
        }
      }
      row.toggleSelected();
      selectionAnchorRef.current = row.id;
    },
    [table],
  );

  // Stable expand togglers (passed to the memoized row/toolbar so they don't churn props).
  const handleToggleExpand = useCallback((row: Row<TData>) => row.toggleExpanded(), []);
  const handleToggleExpandAll = useCallback(() => table.toggleAllRowsExpanded(), [table]);

  // --- context menu (single positioned) ---
  const [contextMenu, setContextMenu] = useState<DataTableContextMenuState<TData> | null>(null);
  const handleRowContext = useCallback(
    (e: ReactMouseEvent, row: Row<TData>) => {
      e.preventDefault();
      const sel = table.getSelectedRowModel().rows;
      if (sel.length > 0 && row.getIsSelected()) {
        setContextMenu({ x: e.clientX, y: e.clientY, rows: sel.map((r) => r.original), isBulk: true });
      } else {
        setContextMenu({ x: e.clientX, y: e.clientY, rows: [row.original], isBulk: false });
      }
    },
    [table],
  );

  const pinnedTop = table.getState().rowPinning.top ?? [];
  const menuActions: DataTableRowAction<TData>[] = useMemo(() => {
    const builtin: DataTableRowAction<TData>[] = enableRowPinning
      ? [
          {
            key: "pin",
            label: "Fixar no topo",
            icon: <IconPin className="h-4 w-4" />,
            hidden: (rs) => rs.every((r) => pinnedTop.includes(getId(r))),
            onClick: (rs) => {
              const ids = rs.map(getId);
              table.setRowPinning((p) => ({ top: [...new Set([...(p.top ?? []), ...ids])], bottom: p.bottom }));
              // pinned rows leave the selection — they get their own "pinned" treatment.
              table.setRowSelection((prev) => {
                const next = { ...prev };
                for (const id of ids) delete next[id];
                return next;
              });
            },
          },
          {
            key: "unpin",
            label: "Desafixar",
            icon: <IconPinnedOff className="h-4 w-4" />,
            hidden: (rs) => rs.every((r) => !pinnedTop.includes(getId(r))),
            onClick: (rs) => {
              const ids = rs.map(getId);
              const idSet = new Set(ids);
              table.setRowPinning((p) => ({ top: (p.top ?? []).filter((id) => !idSet.has(id)), bottom: p.bottom }));
              // unpinning also drops the rows from the selection (mirrors pin).
              table.setRowSelection((prev) => {
                const next = { ...prev };
                for (const id of ids) delete next[id];
                return next;
              });
            },
          },
        ]
      : [];
    // Page actions are privilege-gated (built-in pin/unpin are NEVER gated). Filter BEFORE
    // the map so `separatorBefore` lands on the first SURVIVING action.
    const extras = rowActions
      .filter((a) => isAllowed(a.requiredPrivilege))
      .map((a, i) => (i === 0 && builtin.length ? { ...a, separatorBefore: true } : a));
    return [...builtin, ...extras];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableRowPinning, pinnedTop, getId, table, rowActions, currentPrivilege]);

  // --- active filter chips ---
  const activeChips = useMemo(
    () =>
      filterDefs
        .filter((d) => !isEmptyFilter(filters[d.key]))
        .map((d) => ({
          key: d.key,
          label: d.label,
          value: formatFilterChipValue(d, filters[d.key]),
          icon: d.icon,
          onRemove: () => applyFilters({ ...filters, [d.key]: undefined }),
        })),
    [filterDefs, filters, applyFilters],
  );

  // --- view state ---
  const [filterOpen, setFilterOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFormat, setShareFormat] = useState<ShareFormat>("xlsx");
  const openFilters = useCallback(() => setFilterOpen(true), []);

  const handleShare = useCallback((action: ShareAction) => {
    if (action === "link") {
      copyShareLink().then((ok) =>
        ok
          ? notify.success("Link copiado", "O link da visualização atual foi copiado para a área de transferência.")
          : notify.error("Erro", "Não foi possível copiar o link."),
      );
      return;
    }
    setShareFormat(action);
    setShareOpen(true);
  }, []);

  const headerCheckedState = table.getIsAllPageRowsSelected()
    ? true
    : table.getIsSomePageRowsSelected()
      ? "indeterminate"
      : false;

  const totalSize = table.getVisibleLeafColumns().reduce((sum, col) => sum + col.getSize(), 0);
  const rowWidth = totalSize + (enableSelection ? SELECT_COL_WIDTH : 0) + (enableExpansion ? EXPAND_COL_WIDTH : 0);
  const allRowsExpanded = enableExpansion && table.getIsAllRowsExpanded();
  const headerGroups = table.getHeaderGroups();
  const virtualItems = rowVirtualizer.getVirtualItems();
  const multiSort = table.getState().sorting.length > 1;
  const columnsKey = `${visibleColumnIds.join(",")}|${alignKey}`;
  const isEmpty = !isLoading && rows.length === 0;

  // Row/overlay positions inside the tbody are `virtualItem.start - scrollMargin` (0 in normal mode;
  // in windowed mode `start` includes this list's offset within the shared page scroll container).
  const posOf = (vi: (typeof virtualItems)[number]) => vi.start - scrollMargin;

  // Contiguous runs of selected rows → one bordered overlay per block.
  const selectedBlocks: { top: number; height: number }[] = [];
  for (let k = 0; k < virtualItems.length; ) {
    const vi = virtualItems[k];
    if (rows[vi.index]?.getIsSelected()) {
      const top = posOf(vi);
      let bottom = posOf(vi) + vi.size;
      let j = k + 1;
      while (
        j < virtualItems.length &&
        virtualItems[j].index === virtualItems[j - 1].index + 1 &&
        rows[virtualItems[j].index]?.getIsSelected()
      ) {
        bottom = posOf(virtualItems[j]) + virtualItems[j].size;
        j++;
      }
      selectedBlocks.push({ top, height: bottom - top });
      k = j;
    } else {
      k++;
    }
  }

  // Pinned rows are a contiguous run at the top → ONE continuous green left-bar overlay.
  let pinnedTopPx: number | null = null;
  let pinnedBottomPx = 0;
  for (const vi of virtualItems) {
    if (rows[vi.index]?.getIsPinned() === "top") {
      if (pinnedTopPx === null) pinnedTopPx = posOf(vi);
      pinnedBottomPx = posOf(vi) + vi.size;
    } else {
      break;
    }
  }
  const pinnedBar = pinnedTopPx !== null ? { top: pinnedTopPx, height: pinnedBottomPx - pinnedTopPx } : null;

  // --- shared render fragments (composed into the normal single-table OR the windowed split layout) ---
  const tableStyle = { ...columnSizeVars, width: rowWidth, minWidth: "100%" } as CSSProperties;

  const headerBar = (
    <>
      {title != null && (
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {title}
          {titleCount != null && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({titleCount})</span>}
        </h2>
      )}
      <DataTableToolbar
        table={table}
        columns={columns}
        search={displaySearch}
        onSearchChange={setDisplaySearch}
        searchPlaceholder={searchPlaceholder}
        isSearchPending={displaySearch !== debouncedSearch}
        enableColumnReorder={enableColumnReorder}
        columnAlignment={columnAlignment}
        onColumnAlignmentChange={setColumnAlignment}
        onResetLayout={dt.resetLayout}
        hasFilters={filterDefs.length > 0 || !!filterContent}
        filterCount={countActiveFilters(filters)}
        onOpenFilters={openFilters}
        shareEnabled={enableShare}
        onShare={handleShare}
        canShareLink={syncUrl}
        selectedCount={selectedCount}
        showSelectedOnly={viewSelectedOnly}
        onToggleSelectedOnly={setViewSelectedOnly}
        canViewSelectedOnly={true}
        enableExpansion={enableExpansion}
        allExpanded={allRowsExpanded}
        onToggleExpandAll={handleToggleExpandAll}
        customActions={toolbarActions}
      />
      {activeChips.length > 0 && (
        <div className="mt-3">
          <FilterIndicators filters={activeChips} onClearAll={() => applyFilters({})} />
        </div>
      )}
    </>
  );

  const headerRowEls = headerGroups.map((hg) => (
    <tr key={hg.id} className="flex w-full border-b border-border">
      {enableSelection && (
        <th
          className="flex h-10 w-10 min-w-10 shrink-0 cursor-pointer items-center justify-center bg-muted"
          onClick={() => table.toggleAllPageRowsSelected()}
        >
          <Checkbox checked={headerCheckedState} tabIndex={-1} className="pointer-events-none" aria-label="Selecionar todos" />
        </th>
      )}
      {enableExpansion && (
        <th
          className="flex h-10 w-9 min-w-9 shrink-0 cursor-pointer items-center justify-center bg-muted text-muted-foreground"
          onClick={table.getToggleAllRowsExpandedHandler()}
          title={allRowsExpanded ? "Recolher todos" : "Expandir todos"}
        >
          <IconChevronRight className={cn("h-4 w-4 transition-transform", allRowsExpanded && "rotate-90")} />
        </th>
      )}
      {hg.headers.map((header, i) => (
        <HeaderCell
          key={header.id}
          header={header}
          showSortOrder={multiSort}
          align={alignMap[header.column.id] ?? "left"}
          isLast={i === hg.headers.length - 1}
        />
      ))}
    </tr>
  ));

  const bodyRowEls = (
    <>
      {virtualItems.map((vi) => {
        const row = rows[vi.index];
        if (!row) return null;
        return (
          <DataRow
            key={row.id}
            row={row}
            enableSelection={enableSelection}
            enableExpansion={enableExpansion}
            canExpand={enableExpansion && row.getCanExpand()}
            isExpanded={enableExpansion && row.getIsExpanded()}
            selected={row.getIsSelected()}
            selectedBelow={vi.index < rows.length - 1 ? (rows[vi.index + 1]?.getIsSelected() ?? false) : false}
            // Only drop the last row's border when it sits FLUSH against a self-bordering boundary — i.e.
            // autoHeight (content-tight frame). In the scrolling layout the last row floats above the
            // pagination/frame (empty space when content is short), so it must keep its own separator; the
            // pagination bar's `-mt-px` collapses the doubled line when content DOES fill and scrolls flush.
            dropBottomBorder={autoHeight && !windowed && vi.index === rows.length - 1}
            absoluteIndex={vi.index}
            virtualStart={vi.start - scrollMargin}
            measureRef={rowVirtualizer.measureElement}
            columnsKey={columnsKey}
            alignMap={alignMap}
            rowClassName={getRowClassName?.(row.original)}
            onSelectRow={handleSelectRow}
            onToggleExpand={handleToggleExpand}
            onContextMenu={handleRowContext}
            onRowClick={handleRowClick}
          />
        );
      })}
      {/* selected-block wrapping borders (one per contiguous run) */}
      {selectedBlocks.map((b, idx) => (
        <tr
          key={`sel-${idx}`}
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 z-20 block rounded-md border-2 border-primary"
          style={{ top: b.top, height: b.height }}
        />
      ))}
      {/* pinned green left bar — one continuous overlay above the stripe shadow */}
      {pinnedBar && (
        <tr
          aria-hidden
          className="pointer-events-none absolute left-0 z-20 block w-[3px] bg-primary"
          style={{ top: pinnedBar.top, height: pinnedBar.height }}
        />
      )}
    </>
  );

  const stateOverlay = (
    <>
      {isEmpty && <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{emptyMessage}</div>}
      {isLoading && <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Carregando…</div>}
    </>
  );

  return (
    <div className={cn("flex flex-col", autoHeight ? "" : "h-full", className)}>
      {/* Outer card: padded toolbar + an inset, framed table whose left/right/bottom margins match the toolbar. */}
      <div className={cn("flex flex-col", autoHeight ? "" : "min-h-0 flex-1", !bare && "rounded-lg border border-border bg-card")}>
        {windowed ? (
          // WINDOWED (page-scroll) LAYOUT — the toolbar AND the column header live in ONE sticky block,
          // so they can never separate: no measured offset, no see-through gap. The body rows sit in a
          // sibling element below and scroll UNDER the block (page scroll). Header/body are two separate
          // <table>s that align because both use the same columnSizeVars + rowWidth.
          <>
            <div className="sticky top-0 z-30 bg-card">
              <div className="px-4 pb-3 pt-3">{headerBar}</div>
              <div className="px-4">
                <table className="grid border-collapse text-sm" style={tableStyle}>
                  <thead className="m-0 grid bg-muted">{headerRowEls}</thead>
                </table>
              </div>
            </div>
            <div className="relative px-4 pb-4">
              <table className="grid border-collapse text-sm" style={tableStyle}>
                <tbody
                  ref={listRef}
                  className="relative grid overflow-clip"
                  style={{ height: rowVirtualizer.getTotalSize(), width: rowWidth, minWidth: "100%" } as CSSProperties}
                >
                  {bodyRowEls}
                </tbody>
              </table>
              {stateOverlay}
            </div>
          </>
        ) : (
          // NORMAL LAYOUT — single table, sticky <thead> inside the table's OWN inner scroll (unchanged).
          <>
            <div className={cn("pb-3", bare ? "pt-0" : "px-4 pt-3")}>{headerBar}</div>
            <div className={cn("flex flex-col", autoHeight ? "" : "min-h-0 flex-1", bare ? "pb-0" : "px-4 pb-4")}>
              <div className={cn("flex flex-col rounded-lg border border-border", autoHeight ? "" : "min-h-0 flex-1 overflow-hidden")}>
                <div ref={scrollRef} className={cn("relative", autoHeight ? "" : "min-h-0 flex-1 overflow-auto")}>
                  <table className="grid border-collapse text-sm" style={tableStyle}>
                    <thead className={cn("z-30 m-0 grid bg-muted", !autoHeight && "sticky top-0")}>{headerRowEls}</thead>
                    <tbody
                      className="relative grid"
                      style={{ height: rowVirtualizer.getTotalSize(), width: rowWidth, minWidth: "100%" } as CSSProperties}
                    >
                      {bodyRowEls}
                    </tbody>
                  </table>
                  {stateOverlay}
                </div>

                {enablePagination && !autoHeight && (
                  // `-mt-px` lets this divider overlap (not stack on top of) the last row's bottom border
                  // when content fills and scrolls flush; over empty space (short content) it's invisible.
                  <div className="-mt-px border-t border-border bg-muted/40 px-4">
                    <DataTablePagination table={table} totalItems={totalItems} pageSizeOptions={dt.pageSizeOptions} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {(filterDefs.length > 0 || filterContent) && (
        <DataTableFilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          defs={filterDefs}
          values={filters}
          onApply={applyFilters}
          onReset={() => applyFilters({})}
          filterContent={filterContent}
        />
      )}

      {enableShare && (
        <DataTableShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          format={shareFormat}
          columns={orderedColumns}
          visibleColumnIds={visibleColumnIds}
          pageRows={exportPageRows}
          selectedRows={exportSelectedRows}
          selectedCount={selectedAllCount}
          resolveSelectedRows={resolveSelectedRows}
          totalCount={totalItems}
          resolveAllRows={canExportAll ? resolveAllRows : undefined}
          title={exportTitle}
          filename={exportFilename}
        />
      )}

      <DataTableContextMenu state={contextMenu} onClose={() => setContextMenu(null)} actions={menuActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header cell — sortable (click) + resizable (handle). Reorder is column-manager
// only. The LAST visible column fills + has no resize handle. The <th> needs its
// OWN min-w-0 (a flex item's default min-width:auto floors it at the label's text
// width, so without this the header refuses to shrink below the text on resize).
// ---------------------------------------------------------------------------
function HeaderCell<TData>({
  header,
  showSortOrder,
  align,
  isLast,
}: {
  header: Header<TData, unknown>;
  showSortOrder: boolean;
  align: ColumnAlign;
  isLast: boolean;
}) {
  const column = header.column;
  const canSort = column.getCanSort();
  const sorted = column.getIsSorted();

  const sortIndicator = canSort ? (
    <span
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground",
        align === "right" && "w-4 justify-center",
      )}
    >
      {sorted === "asc" ? (
        <IconChevronUp className="h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <IconChevronDown className="h-3.5 w-3.5" />
      ) : (
        <IconSelector className="h-3.5 w-3.5 opacity-40" />
      )}
      {sorted && showSortOrder && column.getSortIndex() >= 0 && (
        <span className="ml-0.5 text-[10px] font-semibold">{column.getSortIndex() + 1}</span>
      )}
    </span>
  ) : null;

  const label = (
    <span className="min-w-0 truncate text-xs font-bold uppercase text-foreground">
      {flexRender(column.columnDef.header, header.getContext())}
    </span>
  );

  return (
    <th
      colSpan={header.colSpan}
      style={{ flexGrow: isLast ? 1 : 0, flexShrink: 0, flexBasis: `calc(var(--col-${column.id}-size) * 1px)` }}
      className="relative flex h-10 min-w-0 items-center bg-muted"
    >
      <div
        onClick={canSort ? column.getToggleSortingHandler() : undefined}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-1 px-4",
          canSort && "cursor-pointer select-none",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
        )}
      >
        {/* Sort icon always AFTER the title. For right-aligned columns it sits in a fixed
            slot and the body cells reserve the same slot (below), so the body values line
            up with the header TITLE text — not the sort icon. */}
        {label}
        {sortIndicator}
      </div>
      {column.getCanResize() && !isLast && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40",
            column.getIsResizing() && "bg-primary",
          )}
        />
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Row — memoized. Even (striped) rows extend their bg 1px up to cover the sub-pixel
// hairline between virtual rows. The selected-block wrap + pinned bar are drawn as
// overlays in the tbody (not here). The whole checkbox cell is the hit target and
// owns the click, so Shift+click range selection works.
// ---------------------------------------------------------------------------
interface DataRowProps<TData> {
  row: Row<TData>;
  enableSelection: boolean;
  enableExpansion: boolean;
  canExpand: boolean;
  isExpanded: boolean;
  selected: boolean;
  selectedBelow: boolean;
  /** Drop this row's bottom separator because it sits flush against a self-bordering boundary. */
  dropBottomBorder: boolean;
  absoluteIndex: number;
  virtualStart: number;
  measureRef: (node: Element | null) => void;
  columnsKey: string;
  alignMap: Record<string, ColumnAlign>;
  /** Optional caller-supplied per-row classes (e.g. deadline tint) merged onto the row. */
  rowClassName?: string;
  onSelectRow: (row: Row<TData>, shiftKey: boolean) => void;
  onToggleExpand: (row: Row<TData>) => void;
  onContextMenu: (e: ReactMouseEvent, row: Row<TData>) => void;
  onRowClick?: (row: Row<TData>) => void;
}

function DataRowInner<TData>({
  row,
  enableSelection,
  enableExpansion,
  canExpand,
  isExpanded,
  selected,
  selectedBelow,
  dropBottomBorder,
  absoluteIndex,
  virtualStart,
  measureRef,
  alignMap,
  rowClassName,
  onSelectRow,
  onToggleExpand,
  onContextMenu,
  onRowClick,
}: DataRowProps<TData>) {
  const cells = row.getVisibleCells();
  return (
    <tr
      ref={measureRef}
      data-index={absoluteIndex}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      onContextMenu={(e) => onContextMenu(e, row)}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualStart}px)` }}
      className={cn(
        "flex transition-colors hover:bg-muted/70",
        // Every row draws its own bottom separator. The last row drops it ONLY when flush against a
        // self-bordering boundary (autoHeight frame) — see `dropBottomBorder` at the call site — otherwise
        // the two would stack into a doubled line.
        !(selected && selectedBelow) && !dropBottomBorder && "border-b border-border",
        // Zebra striping by absolute position — applies uniformly to parents AND child rows so the
        // even/odd alternation is never broken (child rows are distinguished by the indent/chevron).
        absoluteIndex % 2 === 1 && "bg-muted/50 shadow-[0_-1px_0_0_hsl(var(--muted)/0.5)]",
        onRowClick && "cursor-pointer",
        // Caller-supplied per-row classes (e.g. deadline tint) — last so they can override the bg above.
        rowClassName,
      )}
    >
      {enableSelection && (
        // Whole cell is the hit target; the checkbox is visual only so the td owns the
        // click (and thus e.shiftKey for range selection).
        <td
          className="flex w-10 min-w-10 shrink-0 cursor-pointer select-none items-center justify-center"
          onMouseDown={(e) => {
            // Shift+click would otherwise start a browser text selection across the rows.
            if (e.shiftKey) e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectRow(row, e.shiftKey);
          }}
        >
          <Checkbox checked={selected} tabIndex={-1} className="pointer-events-none" aria-label="Selecionar linha" />
        </td>
      )}
      {enableExpansion && (
        // Expander cell: chevron toggles this row's children; click never bubbles to row-click.
        <td
          className="flex w-9 min-w-9 shrink-0 items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {canExpand ? (
            <button
              type="button"
              aria-label={isExpanded ? "Recolher" : "Expandir"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(row);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <IconChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
            </button>
          ) : null}
        </td>
      )}
      {cells.map((cell, i) => {
        const isLast = i === cells.length - 1;
        const align = alignMap[cell.column.id] ?? "left";
        // Right-aligned sortable columns reserve a trailing slot the same width as the
        // header's sort icon, so the value lines up with the header TITLE (not the icon).
        const rightSortable = align === "right" && cell.column.getCanSort();
        return (
          <td
            key={cell.id}
            style={{ flexGrow: isLast ? 1 : 0, flexShrink: 0, flexBasis: `calc(var(--col-${cell.column.id}-size) * 1px)` }}
            className={cn(
              // Rows never break to a second line — content stays single-line and clips (cells
              // truncate). Keeps every row the same height and stops wide content (e.g. a progress
              // bar) from spilling into the neighbouring column.
              "flex min-w-0 items-center overflow-hidden whitespace-nowrap px-4 py-2",
              align === "center" && "justify-center",
              align === "right" && "justify-end",
              rightSortable && "gap-1",
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
            {rightSortable && <span className="w-4 shrink-0" aria-hidden />}
          </td>
        );
      })}
    </tr>
  );
}

const DataRow = memo(DataRowInner, (prev, next) => {
  return (
    prev.row.original === next.row.original &&
    prev.selected === next.selected &&
    prev.selectedBelow === next.selectedBelow &&
    prev.dropBottomBorder === next.dropBottomBorder &&
    prev.virtualStart === next.virtualStart &&
    prev.absoluteIndex === next.absoluteIndex &&
    prev.enableSelection === next.enableSelection &&
    prev.enableExpansion === next.enableExpansion &&
    prev.canExpand === next.canExpand &&
    prev.isExpanded === next.isExpanded &&
    prev.columnsKey === next.columnsKey &&
    prev.rowClassName === next.rowClassName &&
    prev.onSelectRow === next.onSelectRow &&
    prev.onToggleExpand === next.onToggleExpand &&
    prev.onContextMenu === next.onContextMenu &&
    prev.onRowClick === next.onRowClick
  );
}) as typeof DataRowInner;

export type { Table };
