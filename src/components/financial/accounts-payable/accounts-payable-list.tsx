import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconAlertTriangle, IconReceipt2, IconRepeat, IconSpray } from "@tabler/icons-react";

import type { PayableRow, PayableState } from "../../../types";
import { routes } from "../../../constants";
import { useOrderPayables } from "../../../hooks";
import { formatCurrency, formatDate } from "../../../utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

// --- Payable state metadata (5 states: the order request pipeline +
// PARTIALLY_PAID + the EXPECTED/recurring bucket). ---------------------------
const PAYABLE_STATE_LABELS: Record<PayableState, string> = {
  NOT_REQUESTED: "Não Solicitado",
  REQUESTED: "Solicitado",
  AWAITING_PAYMENT: "Aguardando Pagamento",
  PARTIALLY_PAID: "Parcialmente Pago",
  EXPECTED: "Previsto/Recorrente",
};

const PAYABLE_STATE_BADGE: Record<PayableState, "default" | "secondary" | "warning" | "success" | "outline"> = {
  NOT_REQUESTED: "secondary",
  REQUESTED: "warning",
  AWAITING_PAYMENT: "warning",
  PARTIALLY_PAID: "success",
  EXPECTED: "outline",
};

// Summary card states per active view: real bills for "A Pagar", the single
// forecast bucket for "Previstos / Recorrentes".
const PAYABLE_SUMMARY_STATES: PayableState[] = ["NOT_REQUESTED", "REQUESTED", "AWAITING_PAYMENT", "PARTIALLY_PAID"];
const EXPECTED_STATE: PayableState = "EXPECTED";

const SEARCH_PARAM = "search";
const VIEW_PARAM = "view";

type PayableView = "payable" | "expected";

interface PayeeGroup {
  payeeName: string;
  rows: PayableRow[];
  subtotal: number;
  /** Earliest due date among the group's rows (for overdue-first sorting). */
  earliestDue: number;
  hasOverdue: boolean;
}

function PayableStateBadge({ state }: { state: PayableState }) {
  return (
    <Badge variant={PAYABLE_STATE_BADGE[state]} className="font-medium whitespace-nowrap">
      {PAYABLE_STATE_LABELS[state]}
    </Badge>
  );
}

function isOverdueRow(row: PayableRow): boolean {
  if (row.paymentState === "EXPECTED" || !row.dueDate) return false;
  return new Date(row.dueDate) < new Date();
}

interface AccountsPayableListProps {
  className?: string;
}

export function AccountsPayableList({ className }: AccountsPayableListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- URL state: view + debounced search -----------------------------------
  const urlView = (searchParams.get(VIEW_PARAM) === "expected" ? "expected" : "payable") as PayableView;
  const [view, setView] = useState<PayableView>(urlView);

  const urlSearch = searchParams.get(SEARCH_PARAM) || "";
  const [searchText, setSearchText] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  const handleViewChange = (next: string) => {
    const nextView = (next === "expected" ? "expected" : "payable") as PayableView;
    setView(nextView);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (nextView === "payable") {
          params.delete(VIEW_PARAM);
        } else {
          params.set(VIEW_PARAM, nextView);
        }
        return params;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchText);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const current = params.get(SEARCH_PARAM) || "";
          if (current === searchText) return prev;
          if (searchText) {
            params.set(SEARCH_PARAM, searchText);
          } else {
            params.delete(SEARCH_PARAM);
          }
          return params;
        },
        { replace: true },
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [searchText, setSearchParams]);

  // --- Unified payables endpoint (orders + airbrushing + scheduled) ---------
  const { data: response, isLoading, error } = useOrderPayables();
  const allRows = useMemo(() => response?.data?.rows ?? [], [response?.data?.rows]);
  const summary = response?.data?.summary;

  // --- Split: real obligations vs forecasts (NEVER interleaved) -------------
  const isExpectedView = view === "expected";
  const viewRows = useMemo(
    () => allRows.filter((row) => (isExpectedView ? row.source === "SCHEDULED" : row.source === "ORDER" || row.source === "AIRBRUSHING")),
    [allRows, isExpectedView],
  );

  // --- Client-side search across payee / description ------------------------
  const filteredRows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return viewRows;
    return viewRows.filter((row) => row.payeeName.toLowerCase().includes(term) || row.description.toLowerCase().includes(term));
  }, [viewRows, debouncedSearch]);

  // --- Group by payee -------------------------------------------------------
  const payeeGroups = useMemo<PayeeGroup[]>(() => {
    const groups = new Map<string, PayeeGroup>();
    filteredRows.forEach((row) => {
      const key = row.payeeId ?? `name:${row.payeeName}`;
      if (!groups.has(key)) {
        groups.set(key, { payeeName: row.payeeName, rows: [], subtotal: 0, earliestDue: Number.POSITIVE_INFINITY, hasOverdue: false });
      }
      const group = groups.get(key)!;
      group.rows.push(row);
      group.subtotal += row.amount;
      if (row.dueDate) group.earliestDue = Math.min(group.earliestDue, new Date(row.dueDate).getTime());
      if (isOverdueRow(row)) group.hasOverdue = true;
    });

    const result = [...groups.values()];
    if (isExpectedView) {
      // Forecasts: simple alphabetical by payee.
      result.sort((a, b) => a.payeeName.localeCompare(b.payeeName, "pt-BR"));
    } else {
      // Real bills: overdue groups first, then soonest due, then alphabetical.
      result.sort((a, b) => {
        if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
        if (a.earliestDue !== b.earliestDue) return a.earliestDue - b.earliestDue;
        return a.payeeName.localeCompare(b.payeeName, "pt-BR");
      });
    }
    // Within each group, sort overdue/soonest-due rows first for the real view.
    if (!isExpectedView) {
      result.forEach((group) =>
        group.rows.sort((a, b) => {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
          return da - db;
        }),
      );
    }
    return result;
  }, [filteredRows, isExpectedView]);

  const grandTotal = useMemo(() => filteredRows.reduce((sum, row) => sum + row.amount, 0), [filteredRows]);

  const handleRowClick = (row: PayableRow) => {
    if (row.source === "ORDER") {
      navigate(routes.inventory.orders.details(row.id));
    } else if (row.source === "AIRBRUSHING" && row.taskId) {
      navigate(routes.production.schedule.details(row.taskId));
    }
  };

  // --- Render ---------------------------------------------------------------
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* View switch: real obligations vs forecasts — never interleaved. */}
      <Tabs value={view} onValueChange={handleViewChange} className="flex-shrink-0">
        <TabsList>
          <TabsTrigger value="payable">A Pagar</TabsTrigger>
          <TabsTrigger value="expected">Previstos / Recorrentes</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary cards reflect the active view. */}
      {isExpectedView ? (
        <div className="grid grid-cols-1 gap-3 flex-shrink-0">
          <Card className="border border-border border-dashed">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="font-medium whitespace-nowrap">
                  <IconRepeat className="mr-1 h-3.5 w-3.5" />
                  Previsto / Recorrente
                </Badge>
                <Badge variant="default" className="justify-center min-w-8">
                  {isLoading || !summary ? "…" : summary[EXPECTED_STATE]?.count ?? 0}
                </Badge>
              </div>
              <p className="text-xl font-bold tabular-nums">{isLoading || !summary ? "—" : formatCurrency(summary[EXPECTED_STATE]?.total ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Valores estimados / recorrentes no período</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
          {PAYABLE_SUMMARY_STATES.map((state) => {
            const bucket = summary?.[state];
            return (
              <Card key={state} className="border border-border">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <PayableStateBadge state={state} />
                    <Badge variant="default" className="justify-center min-w-8">
                      {isLoading || !bucket ? "…" : bucket.count}
                    </Badge>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{isLoading || !bucket ? "—" : formatCurrency(bucket.total)}</p>
                  <p className="text-xs text-muted-foreground">Total em aberto</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search + grouped list */}
      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 min-h-0 flex flex-col p-4 space-y-4 overflow-hidden">
          {isExpectedView && (
            <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <IconRepeat className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Estes são valores estimados / recorrentes previstos no período — ainda não são obrigações efetivas de pagamento.</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TableSearchInput
              value={searchText}
              onChange={(value) => setSearchText(value)}
              placeholder={isExpectedView ? "Buscar por fornecedor ou descrição..." : "Buscar por fornecedor, pintor ou descrição..."}
              isPending={searchText !== debouncedSearch}
            />
            <div className="text-sm text-muted-foreground whitespace-nowrap sm:text-right">
              {filteredRows.length} {filteredRows.length === 1 ? "conta" : "contas"} •{" "}
              <span className="font-semibold text-foreground tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs min-w-[18rem]">Descrição</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-32 text-right">Valor</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-48">Pagamento</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-36">{isExpectedView ? "Próx. Vencimento" : "Vencimento"}</TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs w-36">Forma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                        <IconAlertTriangle className="h-8 w-8 mb-4" />
                        <div className="text-lg font-medium mb-2">Não foi possível carregar as contas a pagar</div>
                        <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : payeeGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <IconReceipt2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <div className="text-lg font-medium mb-2">
                          {isExpectedView ? "Nenhum valor previsto / recorrente" : "Nenhuma conta a pagar encontrada"}
                        </div>
                        <div className="text-sm">Ajuste a busca para ver mais resultados.</div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payeeGroups.map((group) => (
                    <React.Fragment key={group.payeeName}>
                      {/* Payee group header with subtotal */}
                      <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                        <TableCell colSpan={2} className="py-2 font-semibold">
                          {group.payeeName}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({group.rows.length} {group.rows.length === 1 ? "conta" : "contas"})
                          </span>
                        </TableCell>
                        <TableCell colSpan={3} className="py-2 text-right font-semibold tabular-nums">
                          {formatCurrency(group.subtotal)}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row, index) => {
                        const dueDate = row.dueDate ? new Date(row.dueDate) : null;
                        const overdue = isOverdueRow(row);
                        const isAirbrushing = row.source === "AIRBRUSHING";
                        const clickable = row.source === "ORDER" || (isAirbrushing && !!row.taskId);
                        return (
                          <TableRow
                            key={`${row.source}-${row.id}`}
                            className={cn(
                              "transition-colors border-b border-border",
                              index % 2 === 1 && "bg-muted/10",
                              "hover:bg-muted/20",
                              clickable && "cursor-pointer",
                              isExpectedView && "italic text-muted-foreground",
                            )}
                            onClick={clickable ? () => handleRowClick(row) : undefined}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isExpectedView && <IconRepeat className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                                <TruncatedTextWithTooltip text={row.description || "-"} className="text-sm" />
                                {isAirbrushing && (
                                  <Badge variant="purple" className="ml-1 whitespace-nowrap text-[10px]">
                                    <IconSpray className="mr-1 h-3 w-3" />
                                    Aerografia
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium tabular-nums text-right">{formatCurrency(row.amount)}</TableCell>
                            <TableCell>
                              <PayableStateBadge state={row.paymentState} />
                            </TableCell>
                            <TableCell>
                              {dueDate ? (
                                <span className={cn("text-sm whitespace-nowrap", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                                  {formatDate(dueDate)}
                                  {overdue && " (vencido)"}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.method || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
