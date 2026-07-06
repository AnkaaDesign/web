import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconChevronRight,
  IconCopy,
  IconEye,
  IconLink,
  IconReceipt,
  IconReceipt2,
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
import { useToast } from "@/hooks/common/use-toast";
import { cn } from "@/lib/utils";
import { routes } from "@/constants";
import { formatCNPJ, formatCnpjCpf, formatCurrency } from "@/utils";
import type { FiscalDocument } from "@/types/reconciliation";
import { docTypeLabel, docTypeVariant } from "./fiscal-doc-badge";
import { formatDayHeader, toLocalDateKey } from "./date-utils";

const DATE_COLUMN_WIDTH = 170;

/**
 * Direction-aware "vinculada" for a fiscal document. The API now returns a
 * derived `linked` boolean (single source of truth): ENTRADA → has an open bank
 * match; SAIDA (emitted) → its NfseDocument carries an Invoice/Task. We consume
 * that when present, falling back to the same derivation so the column stays
 * correct against an older API response that hasn't shipped `linked` yet.
 */
export function isLinked(doc: FiscalDocument): boolean {
  if (typeof doc.linked === "boolean") return doc.linked;
  if (doc.operationType === "SAIDA") {
    return !!doc.nfseDocument?.invoiceId || !!doc.nfseDocument?.taskId;
  }
  return (doc.matches?.length ?? 0) > 0;
}

interface Props {
  data: FiscalDocument[];
  /** Every date in the selected period (YYYY-MM-DD), newest first. Days with
   *  no documents still render (collapsed). When a search is active the list
   *  page passes only the matching days. */
  dates: string[];
  isLoading?: boolean;
  /** When true (search active), all rendered day-groups start expanded. */
  autoExpand?: boolean;
  onViewDetails?: (doc: FiscalDocument) => void;
}

interface ColumnSpec {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
}

interface DaySummary {
  count: number;
  entradaTotal: number;
  saidaTotal: number;
  linked: number;
  unlinked: number;
}

/**
 * Maps a day's vinculação ratio (linked/count, 0–100) to a red→orange→yellow→
 * green tier, identical to the transactions list progress bar, so the fill color
 * encodes "how linked is this day" at a glance. 100% gets the strongest green;
 * partial days warm toward red as the backlog grows.
 */
function reconciliationTier(pct: number): { bar: string; text: string } {
  if (pct >= 100)
    return { bar: "bg-green-600", text: "text-green-700 dark:text-green-400" };
  if (pct >= 75)
    return { bar: "bg-green-500", text: "text-green-700 dark:text-green-400" };
  if (pct >= 50)
    return {
      bar: "bg-yellow-500",
      text: "text-yellow-700 dark:text-yellow-500",
    };
  if (pct >= 25)
    return {
      bar: "bg-orange-500",
      text: "text-orange-700 dark:text-orange-400",
    };
  return { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

/**
 * Compact progress strip mirroring the transactions list — used in the
 * Vinculada column on each day banner. The fill and the X/Y counter are tinted
 * by the day's vinculação tier (red→orange→yellow→green), exactly like the
 * transactions page progress bar.
 */
function DayProgressBar({ summary }: { summary: DaySummary }) {
  const { count, linked } = summary;
  if (count === 0) return null;
  const linkedPct = (linked / count) * 100;
  const tier = reconciliationTier(linkedPct);
  return (
    <div
      className="flex items-center gap-2 w-full"
      title={`${linked} vinculada(s), ${count - linked} sem vínculo`}
    >
      <div className="relative flex-1 h-2 rounded-full overflow-hidden bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 transition-all", tier.bar)}
          style={{ width: `${linkedPct}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums whitespace-nowrap",
          tier.text,
        )}
      >
        {linked}/{count}
      </span>
    </div>
  );
}

export function FiscalDocumentsByDateAccordion({
  data,
  dates,
  isLoading,
  autoExpand,
  onViewDetails,
}: Props) {
  const { toast } = useToast();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    doc: FiscalDocument;
  } | null>(null);
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());

  // While a search is active, expand every matching day so results are visible
  // without clicking each banner; collapse back to all-closed when it clears.
  useEffect(() => {
    setOpenDates(autoExpand ? new Set(dates) : new Set());
  }, [autoExpand, dates]);

  const docsByDate = useMemo(() => {
    const map = new Map<string, FiscalDocument[]>();
    for (const doc of data) {
      const key = toLocalDateKey(doc.issueDate);
      const list = map.get(key);
      if (list) list.push(doc);
      else map.set(key, [doc]);
    }
    return map;
  }, [data]);

  const summaries = useMemo(() => {
    const out = new Map<string, DaySummary>();
    for (const [day, docs] of docsByDate) {
      let entradaTotal = 0;
      let saidaTotal = 0;
      let linked = 0;
      for (const doc of docs) {
        const v = Number(doc.totalValue) || 0;
        if (doc.operationType === "ENTRADA") entradaTotal += v;
        else saidaTotal += v;
        if (isLinked(doc)) linked += 1;
      }
      out.set(day, {
        count: docs.length,
        entradaTotal,
        saidaTotal,
        linked,
        unlinked: docs.length - linked,
      });
    }
    return out;
  }, [docsByDate]);

  const columns = useMemo<ColumnSpec[]>(
    () => [
      { key: "issueDate", header: "Data", width: `${DATE_COLUMN_WIDTH}px` },
      { key: "docType", header: "Tipo", width: "90px", align: "center" },
      {
        key: "operationType",
        header: "Operação",
        width: "110px",
        align: "center",
      },
      { key: "emitter", header: "Emitente" },
      { key: "destinatario", header: "Destinatário" },
      { key: "entrada", header: "Entrada", width: "140px", align: "right" },
      { key: "saida", header: "Saída", width: "140px", align: "right" },
      { key: "status", header: "Status", width: "120px", align: "center" },
      { key: "linked", header: "Vinculada", width: "220px" },
    ],
    [],
  );

  const toggleDate = (date: string) => {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const closeContextMenu = () => setContextMenu(null);
  const handleContextMenu = (e: React.MouseEvent, doc: FiscalDocument) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: "Chave copiada", variant: "success" });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Copie manualmente a chave de acesso.",
        variant: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm border border-border rounded-lg bg-card">
        Carregando notas fiscais...
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2 border border-border rounded-lg bg-card">
        <IconReceipt className="h-8 w-8 opacity-50" />
        Selecione um período para visualizar as notas fiscais.
      </div>
    );
  }

  const ctxDoc = contextMenu?.doc;

  return (
    <>
      <div className="h-full border border-border rounded-lg overflow-hidden bg-card">
        <div className="h-full overflow-auto">
          <Table
            className={cn(
              "w-full [&>div]:border-0 [&>div]:rounded-none",
              TABLE_LAYOUT.tableLayout,
            )}
          >
            <colgroup>
              {columns.map((c) => (
                <col
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                />
              ))}
            </colgroup>
            <TableHeader className="sticky top-0 z-10 [&_tr]:border-b [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className="whitespace-nowrap text-foreground font-medium text-sm p-0 bg-muted !border-r-0"
                  >
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        c.align === "right" && "justify-end text-right",
                        c.align === "center" && "justify-center text-center",
                        (!c.align || c.align === "left") &&
                          "justify-start text-left",
                      )}
                    >
                      {c.header}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map((date) => {
                const docs = docsByDate.get(date) ?? [];
                const summary = summaries.get(date) ?? {
                  count: 0,
                  entradaTotal: 0,
                  saidaTotal: 0,
                  linked: 0,
                  unlinked: 0,
                };
                const isOpen = openDates.has(date);
                const isEmpty = summary.count === 0;
                const { dayLabel, weekday } = formatDayHeader(date);

                return (
                  <DayGroup
                    key={date}
                    dayLabel={dayLabel}
                    weekday={weekday}
                    isOpen={isOpen}
                    isEmpty={isEmpty}
                    summary={summary}
                    docs={docs}
                    columns={columns}
                    onToggle={() => toggleDate(date)}
                    onViewDetails={onViewDetails}
                    onContextMenu={handleContextMenu}
                    onCopyKey={handleCopyKey}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {contextMenu && ctxDoc && (
        <DropdownMenu open onOpenChange={(open) => !open && closeContextMenu()}>
          <PositionedDropdownMenuContent
            position={contextMenu}
            isOpen
            className="w-56"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {onViewDetails && (
              <DropdownMenuItem
                onClick={() => {
                  onViewDetails(ctxDoc);
                  closeContextMenu();
                }}
              >
                <IconEye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                handleCopyKey(ctxDoc.accessKey);
                closeContextMenu();
              }}
            >
              <IconCopy className="h-4 w-4 mr-2" />
              Copiar chave
            </DropdownMenuItem>
          </PositionedDropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

interface DayGroupProps {
  dayLabel: string;
  weekday: string;
  isOpen: boolean;
  isEmpty: boolean;
  summary: DaySummary;
  docs: FiscalDocument[];
  columns: ColumnSpec[];
  onToggle: () => void;
  onViewDetails?: (doc: FiscalDocument) => void;
  onContextMenu: (e: React.MouseEvent, doc: FiscalDocument) => void;
  onCopyKey: (key: string) => void;
}

function DayGroup({
  dayLabel,
  weekday,
  isOpen,
  isEmpty,
  summary,
  docs,
  columns,
  onToggle,
  onViewDetails,
  onContextMenu,
  onCopyKey,
}: DayGroupProps) {
  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors border-t-2 border-b border-border bg-muted/60",
          "hover:bg-muted/80",
          isEmpty && "bg-muted/30 hover:bg-muted/50",
        )}
        onClick={onToggle}
      >
        {columns.map((c) => {
          if (c.key === "issueDate") {
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
                      isEmpty
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground",
                    )}
                  >
                    {weekday}
                  </span>
                </div>
              </TableCell>
            );
          }
          if (c.key === "entrada") {
            return (
              <TableCell key={c.key} className="p-0 !border-r-0 text-right">
                {/* Hide the day's aggregate once expanded so it doesn't compete
                    with each note's own value in the rows below (mirrors Extrato). */}
                {!isOpen && !isEmpty && summary.entradaTotal > 0 ? (
                  <div className="px-4 py-2.5 text-right leading-tight">
                    <span className="text-sm font-semibold tabular-nums text-emerald-700 whitespace-nowrap">
                      {formatCurrency(summary.entradaTotal)}
                    </span>
                  </div>
                ) : null}
              </TableCell>
            );
          }
          if (c.key === "saida") {
            return (
              <TableCell key={c.key} className="p-0 !border-r-0 text-right">
                {!isOpen && !isEmpty && summary.saidaTotal > 0 ? (
                  <div className="px-4 py-2.5 text-right leading-tight">
                    <span className="text-sm font-semibold tabular-nums text-red-700 whitespace-nowrap">
                      {formatCurrency(summary.saidaTotal)}
                    </span>
                  </div>
                ) : null}
              </TableCell>
            );
          }
          if (c.key === "linked") {
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
          return <TableCell key={c.key} className="p-0 !border-r-0" />;
        })}
      </TableRow>

      {isOpen &&
        docs.map((doc, idx) => (
          <TableRow
            key={doc.id}
            className={cn(
              "cursor-pointer transition-colors border-b border-border",
              idx % 2 === 1 ? "bg-muted/10" : "bg-transparent",
              "hover:bg-muted/30",
            )}
            onClick={() => onViewDetails?.(doc)}
            onContextMenu={(e) => onContextMenu(e, doc)}
          >
            {columns.map((c) => (
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
                  {renderCell(c.key, doc, onCopyKey)}
                </div>
              </TableCell>
            ))}
          </TableRow>
        ))}
    </>
  );
}

function renderCell(
  key: string,
  d: FiscalDocument,
  onCopyKey: (key: string) => void,
): React.ReactNode {
  switch (key) {
    case "issueDate":
      // Day group banner already displays the date — leave the body cell blank
      // so it visually doubles as the indent marker for children of that day.
      return null;
    case "docType":
      return (
        <Badge size="sm" variant={docTypeVariant(d.docType)}>
          {docTypeLabel(d.docType)}
        </Badge>
      );
    case "operationType":
      return (
        <Badge
          size="sm"
          variant={d.operationType === "ENTRADA" ? "completed" : "cancelled"}
        >
          {d.operationType === "ENTRADA" ? "Entrada" : "Saída"}
        </Badge>
      );
    case "accessKey":
      return (
        <button
          type="button"
          aria-label="Copiar chave de acesso"
          onClick={(e) => {
            e.stopPropagation();
            onCopyKey(d.accessKey);
          }}
          className="font-mono text-xs font-medium inline-flex items-center gap-1.5 hover:underline whitespace-nowrap"
          title={d.accessKey}
        >
          …{d.accessKey.slice(-12)}
          <IconCopy className="h-3 w-3 flex-shrink-0" />
        </button>
      );
    case "emitter":
      return (
        <span
          className="block truncate text-sm"
          title={
            d.emitName
              ? `${d.emitName}${d.emitCnpj ? ` (${formatCNPJ(d.emitCnpj)})` : ""}`
              : d.emitCnpj
                ? formatCNPJ(d.emitCnpj)
                : undefined
          }
        >
          {d.emitName || (d.emitCnpj ? formatCNPJ(d.emitCnpj) : "—")}
        </span>
      );
    case "destinatario":
      return (
        <span className="block truncate text-sm">
          {d.destName ||
            (d.destCnpj
              ? formatCNPJ(d.destCnpj)
              : d.destCpf
                ? formatCnpjCpf(d.destCpf)
                : "—")}
        </span>
      );
    case "entrada":
      // Entrada column — only ENTRADA documents carry a value here (the column
      // header conveys direction, so no sign is needed).
      return d.operationType === "ENTRADA" ? (
        <span className="font-semibold tabular-nums whitespace-nowrap text-sm text-emerald-700">
          {formatCurrency(d.totalValue)}
        </span>
      ) : null;
    case "saida":
      // Saída column — only SAIDA documents carry a value here.
      return d.operationType === "ENTRADA" ? null : (
        <span className="font-semibold tabular-nums whitespace-nowrap text-sm text-red-700">
          {formatCurrency(d.totalValue)}
        </span>
      );
    case "status":
      return (
        <Badge
          size="sm"
          variant={d.status === "AUTHORIZED" ? "completed" : "cancelled"}
        >
          {d.status === "AUTHORIZED"
            ? "Autorizada"
            : d.status === "CANCELLED"
              ? "Cancelada"
              : d.status === "DENIED"
                ? "Denegada"
                : d.status === "PENDING"
                  ? "Pendente"
                  : d.status}
        </Badge>
      );
    case "linked": {
      // SAIDA (emitted) notes can never carry a bank match — their "vinculada"
      // is the faturamento/orçamento the note was generated from. Surface a link
      // to the invoice (billing) or the task quote (budget) instead.
      if (d.operationType === "SAIDA") {
        const invoiceId = d.nfseDocument?.invoiceId ?? null;
        const taskId = d.nfseDocument?.taskId ?? null;
        if (!invoiceId && !taskId) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        const to = invoiceId
          ? routes.financial.billing.details(invoiceId)
          : routes.financial.budget.details(taskId as string);
        const badge = (
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-500/30 px-2 py-0.5 text-xs font-semibold"
            title={invoiceId ? "Faturamento vinculado" : "Orçamento vinculado"}
          >
            <IconReceipt2 className="h-3 w-3" />
            {invoiceId ? "Faturamento" : "Orçamento"}
          </span>
        );
        return (
          <Link
            to={to}
            onClick={(e) => e.stopPropagation()}
            className="hover:opacity-80 transition-opacity"
          >
            {badge}
          </Link>
        );
      }
      const matches = d.matches ?? [];
      const count = matches.length;
      if (count === 0) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }
      const onlyTxId = count === 1 ? matches[0].transaction?.id : null;
      const badge = (
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-500/30 px-2 py-0.5 text-xs font-semibold"
          title={`${count} ${count === 1 ? "transação vinculada" : "transações vinculadas"}`}
        >
          <IconLink className="h-3 w-3" />
          {count === 1 ? "1 transação" : `${count} transações`}
        </span>
      );
      if (onlyTxId) {
        return (
          <Link
            to={routes.financial.reconciliation.transactionDetail(onlyTxId)}
            onClick={(e) => e.stopPropagation()}
            className="hover:opacity-80 transition-opacity"
          >
            {badge}
          </Link>
        );
      }
      return badge;
    }
    default:
      return null;
  }
}
