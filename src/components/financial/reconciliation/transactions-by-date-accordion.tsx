import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowUpRight,
  IconBan,
  IconCash,
  IconCategory,
  IconChevronRight,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { CategoryChips, MatchStatusBadge } from "./match-status-badge";
import { cn } from "@/lib/utils";
import { routes } from "@/constants";
import {
  formatAccountNumber,
  formatCNPJ,
  formatCnpjCpf,
  formatCurrency,
} from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";
import { formatDayHeader, toLocalDateKey } from "./date-utils";

interface Props {
  data: BankTransaction[];
  /** Every date in the selected period (YYYY-MM-DD), in display order.
   *  Days with no transactions still get rendered (collapsed, with hint). When
   *  a search is active the list page passes only the matching days. */
  dates: string[];
  isLoading?: boolean;
  /** When true (search active), all rendered day-groups start expanded. */
  autoExpand?: boolean;
  /** Whether to show the bank account column (only on global view). */
  showAccountColumn?: boolean;
  /** User-controlled column visibility (column key set). When provided, a
   *  column is rendered only if it's both structurally enabled (`show`) and
   *  present in this set. The DATA column is always kept (see RECONCILIATION_LOCKED_COLUMNS). */
  visibleColumns?: Set<string>;
  onIgnore?: (tx: BankTransaction) => void;
  onViewDetails?: (tx: BankTransaction) => void;
  onChangeCategory?: (tx: BankTransaction) => void;
  /** When set, the open day-groups and the scroll offset are persisted to
   *  sessionStorage under this key, so navigating to a transaction detail and
   *  back restores the exact accordion + scroll state the user left behind.
   *  Omit it to keep the accordion stateless across mounts. */
  persistKey?: string;
}

// --- Navigation-state persistence (sessionStorage) ---------------------------
// The list→detail→back round-trip remounts the list, so the open day-groups and
// scroll offset (both in-memory) would otherwise reset. We mirror them into
// sessionStorage keyed by `persistKey` and restore on mount. sessionStorage (not
// localStorage) so the restore is scoped to the browsing session/tab.

const OPEN_DATES_SUFFIX = ":openDates";
const SCROLL_SUFFIX = ":scroll";

function readOpenDates(key: string | undefined): Set<string> {
  if (!key || typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(`${key}${OPEN_DATES_SUFFIX}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeOpenDates(key: string | undefined, set: Set<string>) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${key}${OPEN_DATES_SUFFIX}`, JSON.stringify([...set]));
  } catch {
    // sessionStorage may be unavailable (private mode / quota) — non-fatal.
  }
}

function readScroll(key: string | undefined): number {
  if (!key || typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(`${key}${SCROLL_SUFFIX}`);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeScroll(key: string | undefined, top: number) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${key}${SCROLL_SUFFIX}`, String(top));
  } catch {
    // non-fatal
  }
}

// Width assigned to the leading column. The day banner reserves the same width
// for the chevron + date so the date label sits *inside* the DATA column space
// instead of bleeding into CONTA.
const DATE_COLUMN_WIDTH = 170;

interface ColumnSpec {
  key: string;
  header: string;
  /** Total width of the column — must mirror the active visual width or the
   *  body cells will drift from the header. */
  width?: string;
  align?: "left" | "center" | "right";
  show: boolean;
}

/** Column keys that can never be hidden (anchor the day banner + indent). */
export const RECONCILIATION_LOCKED_COLUMNS = new Set<string>(["postedAt"]);

/** {key, header} list for the column-visibility manager. `account` is only
 *  offered when the global account column is in play. */
export function getReconciliationColumnsMeta(
  showAccountColumn?: boolean,
): { key: string; header: string }[] {
  return [
    { key: "postedAt", header: "Data" },
    ...(showAccountColumn ? [{ key: "account", header: "Conta" }] : []),
    { key: "type", header: "Tipo" },
    { key: "subtype", header: "Forma" },
    { key: "amount", header: "Valor" },
    { key: "counterparty", header: "Contraparte / Descrição" },
    { key: "linkedNf", header: "NF vinculada" },
    { key: "category", header: "Categoria" },
    { key: "reconciliationStatus", header: "Status" },
  ];
}

/** Columns visible by default. TIPO and FORMA are intentionally hidden — they
 *  add little signal day-to-day, so users opt back in via the manager. */
export function getDefaultVisibleReconciliationColumns(
  showAccountColumn?: boolean,
): Set<string> {
  return new Set(
    getReconciliationColumnsMeta(showAccountColumn)
      .map(c => c.key)
      .filter(key => key !== "type" && key !== "subtype"),
  );
}

export function TransactionsByDateAccordion({
  data,
  dates,
  isLoading,
  autoExpand,
  showAccountColumn,
  visibleColumns: visibleColumnKeys,
  onIgnore,
  onViewDetails,
  onChangeCategory,
  persistKey,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tx: BankTransaction;
  } | null>(null);
  // Tracks which date rows are expanded. Defaults to all collapsed —
  // opening 30+ days at once is loud and slows the first paint. When a
  // persistKey is set, seed from the last persisted set so a back-navigation
  // restores the open day-groups.
  const [openDates, setOpenDates] = useState<Set<string>>(() => readOpenDates(persistKey));

  // Drives the auto-expand reset off *transitions* of `autoExpand`, not the
  // raw `dates` identity. This matters for restore: when `autoExpand` is false
  // and `dates` merely repopulates (async fetch settles) we must NOT wipe the
  // restored/manual open set. We only force-collapse when search is actively
  // cleared (true → false), and force-expand while search stays active.
  const prevAutoExpand = useRef<boolean>(autoExpand);
  useEffect(() => {
    if (autoExpand) {
      // Search active: keep every currently-matching day expanded.
      setOpenDates(new Set(dates));
    } else if (prevAutoExpand.current) {
      // Search just cleared: collapse back to all-closed.
      setOpenDates(new Set());
    }
    // else: not searching and wasn't searching → leave the restored/manual set.
    prevAutoExpand.current = autoExpand;
  }, [autoExpand, dates]);

  // Persist the open set on every change so it survives the next remount.
  useEffect(() => {
    writeOpenDates(persistKey, openDates);
  }, [persistKey, openDates]);

  // --- Scroll persistence --------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  // Persist the scroll offset (rAF-throttled) and flush it on unmount.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !persistKey) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        writeScroll(persistKey, el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      writeScroll(persistKey, el.scrollTop);
    };
  }, [persistKey]);

  // Restore the scroll offset once, after the first non-loading render so the
  // rows (and their height) exist. Double rAF lets layout settle before we set
  // scrollTop, otherwise the container may not yet be tall enough to scroll.
  const didRestoreScroll = useRef(false);
  useEffect(() => {
    if (didRestoreScroll.current || isLoading || !persistKey) return;
    const el = scrollRef.current;
    if (!el) return;
    didRestoreScroll.current = true;
    const saved = readScroll(persistKey);
    if (saved <= 0) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = saved;
      }),
    );
  }, [isLoading, persistKey]);

  const txByDate = useMemo(() => {
    const map = new Map<string, BankTransaction[]>();
    for (const tx of data) {
      const key = toLocalDateKey(tx.postedAt);
      const list = map.get(key);
      if (list) list.push(tx);
      else map.set(key, [tx]);
    }
    return map;
  }, [data]);

  // Per-day summaries cached so the header doesn't recompute on every render.
  const summaries = useMemo(() => {
    const out = new Map<
      string,
      {
        count: number;
        credits: number;
        debits: number;
        matched: number;
        ignored: number;
        pending: number;
      }
    >();
    for (const [day, txs] of txByDate) {
      let credits = 0;
      let debits = 0;
      let matched = 0;
      let ignored = 0;
      let pending = 0;
      for (const t of txs) {
        // OFX debits are stored as negative amounts. The banner shows them
        // as absolute totals (the sign is conveyed by the −/+ prefix).
        const amt = Math.abs(Number(t.amount) || 0);
        if (t.type === "CREDIT") credits += amt;
        else debits += amt;
        // RECONCILED + PARTIAL both count as resolved in the daily counter —
        // they're explained, even if partially. Only PENDING/DISPUTED pull
        // their weight against the ratio.
        if (t.reconciliationStatus === "RECONCILED" || t.reconciliationStatus === "PARTIAL")
          matched += 1;
        else if (t.reconciliationStatus === "IGNORED") ignored += 1;
        else pending += 1;
      }
      out.set(day, { count: txs.length, credits, debits, matched, ignored, pending });
    }
    return out;
  }, [txByDate]);

  const columns = useMemo<ColumnSpec[]>(() => {
    // A column shows when it's structurally enabled AND (no visibility set is
    // supplied OR the user kept it visible). Locked columns (DATA) ignore the
    // user's set so the day banner + indent never lose their anchor.
    const isVisible = (key: string, structural: boolean) => {
      if (!structural) return false;
      if (RECONCILIATION_LOCKED_COLUMNS.has(key)) return true;
      return visibleColumnKeys ? visibleColumnKeys.has(key) : true;
    };
    return [
      // Date column is wide enough to host the group header's chevron + date
      // (e.g. "26/04/26 Dom.") so the date label stays inside the DATA column
      // space — keeping CONTA cleanly separated from the date visually.
      { key: "postedAt", header: "Data", width: `${DATE_COLUMN_WIDTH}px`, show: isVisible("postedAt", true) },
      { key: "account", header: "Conta", width: "240px", show: isVisible("account", !!showAccountColumn) },
      { key: "type", header: "Tipo", width: "110px", align: "center", show: isVisible("type", true) },
      { key: "subtype", header: "Forma", width: "120px", align: "center", show: isVisible("subtype", true) },
      { key: "amount", header: "Valor", width: "140px", align: "right", show: isVisible("amount", true) },
      { key: "counterparty", header: "Contraparte / Descrição", show: isVisible("counterparty", true) },
      // Wider so longer emitter names ("FARBEN S/A INDUSTRIA QUIMICA") fit
      // without truncation. The freed space comes from Contraparte (flex).
      { key: "linkedNf", header: "NF vinculada", width: "220px", show: isVisible("linkedNf", true) },
      { key: "category", header: "Categoria", width: "240px", show: isVisible("category", true) },
      { key: "reconciliationStatus", header: "Status", width: "180px", show: isVisible("reconciliationStatus", true) },
    ];
  }, [showAccountColumn, visibleColumnKeys]);
  const visibleColumns = useMemo(() => columns.filter(c => c.show), [columns]);
  const colSpan = visibleColumns.length;

  const toggleDate = (date: string) => {
    setOpenDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const closeContextMenu = () => setContextMenu(null);
  const handleContextMenu = (e: React.MouseEvent, tx: BankTransaction) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tx });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm border border-border rounded-lg bg-card">
        Carregando transações...
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2 border border-border rounded-lg bg-card">
        <IconCash className="h-8 w-8 opacity-50" />
        Selecione um período para visualizar as transações.
      </div>
    );
  }

  const ctxTx = contextMenu?.tx;

  return (
    <>
      {/* Single table with a sticky header avoids the column drift that the
          two-table split caused (different effective widths once the body got
          a scrollbar). The parent already provides the scroll container. */}
      <div className="h-full border border-border rounded-lg overflow-hidden bg-card">
        <div ref={scrollRef} className="h-full overflow-auto">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <colgroup>
              {visibleColumns.map(c => (
                <col key={c.key} style={c.width ? { width: c.width } : undefined} />
              ))}
            </colgroup>
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                {visibleColumns.map(c => (
                  <TableHead
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap text-foreground font-medium text-sm p-0 bg-muted !border-r-0",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        c.align === "right" && "justify-end text-right",
                        c.align === "center" && "justify-center text-center",
                        (!c.align || c.align === "left") && "justify-start text-left",
                      )}
                    >
                      {c.header}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map(date => {
                const txs = txByDate.get(date) ?? [];
                const summary =
                  summaries.get(date) ??
                  { count: 0, credits: 0, debits: 0, matched: 0, ignored: 0, pending: 0 };
                const isOpen = openDates.has(date);
                const isEmpty = summary.count === 0;
                const { dayLabel, weekday } = formatDayHeader(date);

                return (
                  <DayGroup
                    key={date}
                    date={date}
                    dayLabel={dayLabel}
                    weekday={weekday}
                    isOpen={isOpen}
                    isEmpty={isEmpty}
                    summary={summary}
                    txs={txs}
                    columns={visibleColumns}
                    colSpan={colSpan}
                    onToggle={() => toggleDate(date)}
                    onViewDetails={onViewDetails}
                    onContextMenu={handleContextMenu}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {contextMenu && ctxTx && (
        <DropdownMenu open onOpenChange={open => !open && closeContextMenu()}>
          <PositionedDropdownMenuContent
            position={contextMenu}
            isOpen
            className="w-56"
            onCloseAutoFocus={e => e.preventDefault()}
          >
            {onChangeCategory && (
              <DropdownMenuItem
                onClick={() => {
                  onChangeCategory(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconCategory className="h-4 w-4 mr-2" />
                Alterar categoria
              </DropdownMenuItem>
            )}
            {onIgnore && ctxTx.reconciliationStatus !== "IGNORED" && (
              <DropdownMenuItem
                onClick={() => {
                  onIgnore(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconBan className="h-4 w-4 mr-2" />
                Ignorar
              </DropdownMenuItem>
            )}
          </PositionedDropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

interface DaySummary {
  count: number;
  credits: number;
  debits: number;
  matched: number;
  ignored: number;
  pending: number;
}

interface DayGroupProps {
  date: string;
  dayLabel: string;
  weekday: string;
  isOpen: boolean;
  isEmpty: boolean;
  summary: DaySummary;
  txs: BankTransaction[];
  columns: ColumnSpec[];
  colSpan: number;
  onToggle: () => void;
  onViewDetails?: (tx: BankTransaction) => void;
  onContextMenu: (e: React.MouseEvent, tx: BankTransaction) => void;
}

/**
 * Maps a day's reconciliation ratio (resolved/count, 0–100) to a
 * red→orange→yellow→green tier so the fill color encodes "how reconciled is
 * this day" at a glance, complementing the X/Y counter. 100% gets the strongest
 * green; partial days warm toward red as the backlog grows.
 */
function reconciliationTier(pct: number): { bar: string; text: string } {
  if (pct >= 100) return { bar: "bg-green-600", text: "text-green-700 dark:text-green-400" };
  if (pct >= 75) return { bar: "bg-green-500", text: "text-green-700 dark:text-green-400" };
  if (pct >= 50) return { bar: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-500" };
  if (pct >= 25) return { bar: "bg-orange-500", text: "text-orange-700 dark:text-orange-400" };
  return { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

/**
 * Compact progress strip that lives inside the day-group banner's Status
 * column. The matched segment is colored by the day's reconciliation tier
 * (red→orange→yellow→green); ignored transactions render as a gray segment, and
 * a "X/Y" counter — tinted to the same tier — sits alongside.
 */
function DayProgressBar({ summary }: { summary: DaySummary }) {
  const { count, matched, ignored } = summary;
  if (count === 0) return null;
  const resolved = matched + ignored;
  const resolvedPct = (resolved / count) * 100;
  const matchedPct = (matched / count) * 100;
  const ignoredPct = (ignored / count) * 100;
  const counterText = `${resolved}/${count}`;
  const tier = reconciliationTier(resolvedPct);
  return (
    <div className="flex items-center gap-2 w-full" title={`${matched} conciliada(s), ${ignored} ignorada(s), ${count - resolved} pendente(s)`}>
      <div className="relative flex-1 h-2 rounded-full overflow-hidden bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 transition-all", tier.bar)}
          style={{ width: `${matchedPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-neutral-400 dark:bg-neutral-500 transition-all"
          style={{ left: `${matchedPct}%`, width: `${ignoredPct}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums whitespace-nowrap",
          tier.text,
        )}
      >
        {counterText}
      </span>
    </div>
  );
}

function DayGroup({
  dayLabel,
  weekday,
  isOpen,
  isEmpty,
  summary,
  txs,
  columns,
  onToggle,
  onViewDetails,
  onContextMenu,
}: DayGroupProps) {
  return (
    <>
      {/* Group banner — distinct background + heavier border so it reads as a
          sub-header. We render one TableCell per column (instead of a single
          colSpan one) so the day's total value lands under VALOR and the
          progress bar lands under STATUS, matching the underlying table layout. */}
      <TableRow
        className={cn(
          "cursor-pointer transition-colors border-t-2 border-b border-border bg-muted/60",
          "hover:bg-muted/80",
          isEmpty && "bg-muted/30 hover:bg-muted/50",
        )}
        onClick={onToggle}
      >
        {columns.map(c => {
          if (c.key === "postedAt") {
            return (
              <TableCell key={c.key} className="p-0 !border-r-0">
                <div className="flex items-center gap-2 px-4 py-3">
                  <IconChevronRight
                    className={cn(
                      "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-150",
                      isOpen && "rotate-90",
                      isEmpty && "opacity-50",
                    )}
                  />
                  <span
                    className={cn(
                      "font-semibold tabular-nums text-sm whitespace-nowrap",
                      isEmpty ? "text-muted-foreground/70" : "text-foreground",
                    )}
                  >
                    {dayLabel}
                  </span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums text-sm whitespace-nowrap",
                      isEmpty ? "text-muted-foreground/60" : "text-muted-foreground",
                    )}
                  >
                    {weekday}
                  </span>
                </div>
              </TableCell>
            );
          }
          if (c.key === "amount") {
            return (
              <TableCell key={c.key} className="p-0 !border-r-0 text-right">
                {!isEmpty && (summary.credits > 0 || summary.debits > 0) ? (
                  <div className="flex flex-col items-end gap-0.5 px-4 py-2.5 leading-tight">
                    {summary.credits > 0 && (
                      <span className="text-xs font-semibold tabular-nums text-emerald-700 whitespace-nowrap">
                        +{formatCurrency(summary.credits)}
                      </span>
                    )}
                    {summary.debits > 0 && (
                      <span
                        className={cn(
                          "tabular-nums whitespace-nowrap font-semibold",
                          // The debit total is the headline number on the day
                          // banner — saídas drive reconciliation, so render it
                          // a notch larger than credits when both are present.
                          summary.credits > 0 ? "text-xs" : "text-sm",
                          "text-red-700",
                        )}
                      >
                        −{formatCurrency(summary.debits)}
                      </span>
                    )}
                  </div>
                ) : null}
              </TableCell>
            );
          }
          if (c.key === "reconciliationStatus") {
            return (
              <TableCell key={c.key} className="p-0 !border-r-0">
                {!isEmpty ? (
                  <div className="px-4 py-3">
                    <DayProgressBar summary={summary} />
                  </div>
                ) : null}
              </TableCell>
            );
          }
          // Account / type / subtype / counterparty / linkedNf / category —
          // intentionally blank so the banner reads as a sub-header, not data.
          return <TableCell key={c.key} className="p-0 !border-r-0" />;
        })}
      </TableRow>

      {isOpen &&
        txs.map((tx, idx) => (
          <TableRow
            key={tx.id}
            className={cn(
              "cursor-pointer transition-colors border-b border-border",
              idx % 2 === 1 ? "bg-muted/10" : "bg-transparent",
              "hover:bg-muted/30",
            )}
            onClick={() => onViewDetails?.(tx)}
            onContextMenu={e => onContextMenu(e, tx)}
          >
            {columns.map(c => (
              <TableCell
                key={c.key}
                className={cn(
                  "p-0 !border-r-0 overflow-hidden",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  (!c.align || c.align === "left") && "text-left",
                )}
              >
                <div className="px-4 py-2.5 overflow-hidden">
                  {renderCell(c.key, tx)}
                </div>
              </TableCell>
            ))}
          </TableRow>
        ))}
    </>
  );
}

function renderCell(key: string, t: BankTransaction): React.ReactNode {
  switch (key) {
    case "postedAt":
      // Date column kept blank inside expanded rows — the group header already
      // calls out the day, and the empty cell visually doubles as the indent
      // marker for children of that group.
      return null;
    case "account":
      return (
        <span className="text-sm whitespace-nowrap truncate block">
          {t.bankName}
          {t.agency ? ` · Ag ${t.agency}` : ""}
          {t.accountNumber ? ` / ${formatAccountNumber(t.accountNumber)}` : ""}
        </span>
      );
    case "type":
      return (
        <Badge variant={t.type === "CREDIT" ? "completed" : "cancelled"} size="sm">
          {t.type === "CREDIT" ? "Crédito" : "Débito"}
        </Badge>
      );
    case "subtype":
      return <span className="text-xs text-muted-foreground">{t.subtype}</span>;
    case "amount":
      return (
        <span
          className={cn(
            "font-semibold tabular-nums whitespace-nowrap text-sm",
            t.type === "CREDIT" ? "text-emerald-700" : "text-red-700",
          )}
        >
          {formatCurrency(t.amount)}
        </span>
      );
    case "counterparty":
      return (
        <span className="block truncate text-sm">
          {t.counterpartyName ||
            (t.counterpartyCnpjCpf
              ? formatCnpjCpf(t.counterpartyCnpjCpf)
              : t.memo || "—")}
        </span>
      );
    case "linkedNf": {
      const firstDoc = t.matches?.find(m => m.fiscalDocument)?.fiscalDocument;
      const extraCount =
        (t.matches?.filter(m => m.fiscalDocument).length ?? 0) - 1;
      if (!firstDoc?.id) {
        // No linked fiscal doc — show a plain dash. Category tags live in the
        // dedicated "Categoria" column, never leaking into this NF column.
        return <span className="text-muted-foreground text-xs">—</span>;
      }
      const emitDisplay = firstDoc.emitName
        ? firstDoc.emitName
        : firstDoc.emitCnpj
          ? formatCNPJ(firstDoc.emitCnpj)
          : "NF";
      return (
        <Link
          to={routes.financial.reconciliation.fiscalDocumentDetail(firstDoc.id)}
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-foreground hover:text-foreground hover:underline max-w-[17rem] truncate"
          title={emitDisplay}
        >
          <span className="truncate">{emitDisplay}</span>
          {extraCount > 0 && (
            <span className="text-muted-foreground">(+{extraCount})</span>
          )}
          <IconArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        </Link>
      );
    }
    case "category":
      return <CategoryChips categories={t.categories} maxVisible={2} />;
    case "reconciliationStatus": {
      return <MatchStatusBadge status={t.reconciliationStatus} topMatchScore={t.topMatchScore} />;
    }
    default:
      return null;
  }
}
