import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowUpRight,
  IconBan,
  IconCash,
  IconCategory,
  IconChevronRight,
  IconEye,
  IconLink,
  IconLinkOff,
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
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { CATEGORY_LABEL, MatchStatusBadge } from "./match-status-badge";
import { cn } from "@/lib/utils";
import { routes } from "@/constants";
import {
  formatAccountNumber,
  formatCNPJ,
  formatCnpjCpf,
  formatCurrency,
} from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";

interface Props {
  data: BankTransaction[];
  /** Every date in the selected period (YYYY-MM-DD), in display order.
   *  Days with no transactions still get rendered (collapsed, with hint). */
  dates: string[];
  isLoading?: boolean;
  /** Whether to show the bank account column (only on global view). */
  showAccountColumn?: boolean;
  onMatch?: (tx: BankTransaction) => void;
  onUnmatch?: (tx: BankTransaction) => void;
  onIgnore?: (tx: BankTransaction) => void;
  onViewDetails?: (tx: BankTransaction) => void;
  onChangeCategory?: (tx: BankTransaction) => void;
}

const WEEKDAYS_SHORT = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];

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

function toLocalDateKey(input: string | Date): string {
  // Bank transactions arrive as ISO strings. Group by the day they fall on in
  // the user's local timezone — that's what `formatDate` shows in the UI.
  const d = typeof input === "string" ? new Date(input) : input;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayHeader(dateStr: string): { dayLabel: string; weekday: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Compact form: "26/04/26" (2-digit year) and abbreviated weekday like "Dom.".
  const yy = String(y).slice(-2);
  const dayLabel = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${yy}`;
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  return { dayLabel, weekday };
}

export function TransactionsByDateAccordion({
  data,
  dates,
  isLoading,
  showAccountColumn,
  onMatch,
  onUnmatch,
  onIgnore,
  onViewDetails,
  onChangeCategory,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tx: BankTransaction;
  } | null>(null);
  // Tracks which date rows are expanded. Defaults to all collapsed —
  // opening 30+ days at once is loud and slows the first paint.
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());

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

  const columns = useMemo<ColumnSpec[]>(
    () => [
      // Date column is wide enough to host the group header's chevron + date
      // (e.g. "26/04/26 Dom.") so the date label stays inside the DATA column
      // space — keeping CONTA cleanly separated from the date visually.
      { key: "postedAt", header: "Data", width: `${DATE_COLUMN_WIDTH}px`, show: true },
      { key: "account", header: "Conta", width: "240px", show: !!showAccountColumn },
      { key: "type", header: "Tipo", width: "110px", align: "center", show: true },
      { key: "subtype", header: "Forma", width: "120px", align: "center", show: true },
      { key: "amount", header: "Valor", width: "140px", align: "right", show: true },
      { key: "counterparty", header: "Contraparte / Descrição", show: true },
      // Wider so longer emitter names ("FARBEN S/A INDUSTRIA QUIMICA") fit
      // without truncation. The freed space comes from Contraparte (flex).
      { key: "linkedNf", header: "NF vinculada", width: "300px", show: true },
      { key: "reconciliationStatus", header: "Status", width: "260px", show: true },
    ],
    [showAccountColumn],
  );
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
  const ctxHasMatches = (ctxTx?.matches?.length ?? 0) > 0;

  return (
    <>
      {/* Single table with a sticky header avoids the column drift that the
          two-table split caused (different effective widths once the body got
          a scrollbar). The parent already provides the scroll container. */}
      <div className="h-full border border-border rounded-lg overflow-hidden bg-card">
        <div className="h-full overflow-auto">
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
            {onViewDetails && (
              <DropdownMenuItem
                onClick={() => {
                  onViewDetails(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconEye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
            )}
            {onMatch && !(ctxTx.reconciliationStatus === "RECONCILED" && ctxTx.reconciliationSource === "MANUAL") && (
              <DropdownMenuItem
                onClick={() => {
                  onMatch(ctxTx);
                  closeContextMenu();
                }}
              >
                <IconLink className="h-4 w-4 mr-2" />
                Conciliar manualmente
              </DropdownMenuItem>
            )}
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
            {onUnmatch && ctxHasMatches && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onUnmatch(ctxTx);
                    closeContextMenu();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <IconLinkOff className="h-4 w-4 mr-2" />
                  Desfazer conciliação
                </DropdownMenuItem>
              </>
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
 * Compact progress strip that lives inside the day-group banner's Status
 * column. Shows two stacked segments — matched (green) and ignored (gray) —
 * over a pending base, with a "X/Y" counter alongside.
 */
function DayProgressBar({ summary }: { summary: DaySummary }) {
  const { count, matched, ignored } = summary;
  if (count === 0) return null;
  const resolved = matched + ignored;
  const matchedPct = (matched / count) * 100;
  const ignoredPct = (ignored / count) * 100;
  const isComplete = resolved === count;
  const counterText = `${resolved}/${count}`;
  return (
    <div className="flex items-center gap-2 w-full" title={`${matched} conciliada(s), ${ignored} ignorada(s), ${count - resolved} pendente(s)`}>
      <div className="relative flex-1 h-2 rounded-full overflow-hidden bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-600 transition-all"
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
          isComplete ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
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
          // Account / type / subtype / counterparty / linkedNf — intentionally
          // blank so the banner reads as a sub-header, not as data.
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
        // For self-justifying categories surface the category label so the
        // column carries real info instead of a dash.
        if (t.category && t.category !== "UNCLASSIFIED" && t.category !== "NF") {
          return (
            <span className="text-muted-foreground text-xs italic">
              {CATEGORY_LABEL[t.category]}
            </span>
          );
        }
        return <span className="text-muted-foreground text-xs">—</span>;
      }
      const emitDisplay = firstDoc.emitName
        ? firstDoc.emitName
        : firstDoc.emitCnpj
          ? formatCNPJ(firstDoc.emitCnpj)
          : "NF";
      return (
        <Link
          to={`${routes.financial.reconciliation.fiscalDocuments}?nfId=${firstDoc.id}`}
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
    case "reconciliationStatus": {
      const conf = t.matches?.[0]?.confidenceScore;
      return (
        <MatchStatusBadge
          status={t.reconciliationStatus}
          category={t.category}
          source={t.reconciliationSource}
          confidence={conf}
        />
      );
    }
    default:
      return null;
  }
}
