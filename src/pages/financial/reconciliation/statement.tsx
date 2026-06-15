import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBan,
  IconBuildingBank,
  IconCash,
  IconCategory,
  IconListDetails,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Combobox } from "@/components/ui/combobox";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { FinancialKpiCard } from "@/components/financial/common/financial-kpi-card";
import {
  CategoryChips,
  MatchStatusBadge,
} from "@/components/financial/reconciliation/match-status-badge";
import {
  MonthNav,
  monthBounds,
  monthKey,
  parseMonthKey,
} from "@/components/financial/reconciliation/month-nav";
import { OfxImportDialog } from "@/components/financial/reconciliation/ofx-import-dialog";
import { IgnoreTransactionDialog } from "@/components/financial/reconciliation/ignore-transaction-dialog";
import { CategoryPickerDialog } from "@/components/financial/reconciliation/category-picker-dialog";
import {
  ALL_BUCKETS,
  BUCKET_META,
  BUCKET_STATUSES,
  bucketOf,
  LinkedDocCell,
  parseBuckets,
  type BucketKey,
} from "@/components/financial/reconciliation/transaction-buckets";
import {
  useBankTransaction,
  useBankTransactions,
  useChangeCategory,
  useIgnoreTransaction,
  useRunAutoMatch,
} from "@/hooks/financial/use-reconciliation";
import { useUrlDialog } from "@/hooks/common/use-url-dialog";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useToast } from "@/hooks/common/use-toast";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { cn } from "@/lib/utils";
import {
  formatAccountNumber,
  formatCnpjCpf,
  formatCurrency,
  formatDate,
} from "@/utils";
import type { BankTransaction, TransactionType } from "@/types/reconciliation";

// Mirrors the API DTO cap; a busy month fits in one fetch.
const PERIOD_PAGE_SIZE = 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: string | null | undefined): string | undefined =>
  v && UUID_RE.test(v) ? v : undefined;

// CREDIT/DEBIT type filter — multi-select like the status buckets. Both on by
// default (Entradas + Saídas shown together); toggle either off to narrow.
const ALL_TYPES: TransactionType[] = ["CREDIT", "DEBIT"];

function parseTypes(raw: string | null): TransactionType[] {
  if (!raw) return ALL_TYPES;
  const parsed = raw
    .split(",")
    .filter((t): t is TransactionType => t === "CREDIT" || t === "DEBIT");
  return parsed.length ? parsed : ALL_TYPES;
}

/** Stable identity of one bank account inside the statement data. */
function accountKeyOf(t: BankTransaction): string {
  return `${t.bankCode}|${t.agency}|${t.accountNumber}`;
}

function accountLabelOf(t: BankTransaction): string {
  const acct = t.accountNumber ? formatAccountNumber(t.accountNumber) : "";
  return `${t.bankName}${t.agency ? ` · Ag ${t.agency}` : ""}${acct ? ` / ${acct}` : ""}`;
}

/**
 * Extrato — the single Conciliação Bancária view. It shows one account's
 * transactions in statement order (oldest first) with the running balance and
 * credit/debit coloring, and absorbs what used to be the Saídas/Entradas pages:
 * the Entradas/Saídas summary cards toggle a CREDIT/DEBIT type filter, the
 * status buckets (Pendentes/Parciais/Conciliadas/Ignoradas) filter by
 * conciliation status, and each row funnels into the matching flow, category
 * assignment or ignore — plus the "Verificar" auto-match pass.
 */
export const ReconciliationStatementPage = () => {
  usePageTracker({ title: "Extrato - Conciliação", icon: "building-bank" });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [month, setMonth] = useState<Date>(
    () => parseMonthKey(searchParams.get("mes")) ?? new Date(),
  );
  const [accountKey, setAccountKey] = useState<string>(
    () => searchParams.get("conta") || "",
  );
  const [searchText, setSearchText] = useState(
    () => searchParams.get("search") || "",
  );
  const [types, setTypes] = useState<TransactionType[]>(() =>
    parseTypes(searchParams.get("tipo")),
  );
  const [buckets, setBuckets] = useState<BucketKey[]>(() =>
    parseBuckets(searchParams.get("status"), ALL_BUCKETS),
  );
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const [importOpen, setImportOpen] = useState(false);

  // Keep month/account/search/type/status shareable in the URL.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("mes", monthKey(month));
    if (accountKey) params.set("conta", accountKey);
    else params.delete("conta");
    if (searchText) params.set("search", searchText);
    else params.delete("search");
    if (types.length !== ALL_TYPES.length) params.set("tipo", [...types].sort().join(","));
    else params.delete("tipo");
    const bucketCsv = [...buckets].sort().join(",");
    if (buckets.length !== ALL_BUCKETS.length) params.set("status", bucketCsv);
    else params.delete("status");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, accountKey, searchText, types, buckets]);

  const { from, to } = useMemo(() => monthBounds(month), [month]);

  // Newest first (most recent lançamentos on top). `search` (memo/FITID) +
  // `counterparty` (name/CNPJ) OR together server-side. No `type` filter
  // server-side — the same payload feeds both type cards and the table, so
  // toggling a filter never refetches.
  const { data, isLoading, refetch } = useBankTransactions({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "postedAt",
    sortDir: "desc",
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    search: debouncedSearch || undefined,
    counterparty: debouncedSearch || undefined,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  // Accounts present in the month — drives the selector. The statement (running
  // balance) only makes sense per account, so we always narrow to one.
  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of rows) {
      const key = accountKeyOf(t);
      if (!map.has(key)) map.set(key, accountLabelOf(t));
    }
    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }, [rows]);

  // Default to the first account of the month (and recover when the persisted
  // account has no rows in the selected month).
  const effectiveAccountKey = useMemo(() => {
    if (accountKey && accounts.some(a => a.key === accountKey)) return accountKey;
    return accounts[0]?.key ?? "";
  }, [accountKey, accounts]);

  // The full account set — drives the running balance and the absolute month
  // totals (credits/debits/net), independent of the active type/status filter.
  const statementRows = useMemo(
    () => rows.filter(t => accountKeyOf(t) === effectiveAccountKey),
    [rows, effectiveAccountKey],
  );

  // Narrow by the selected CREDIT/DEBIT types, then by the status buckets.
  const typedRows = useMemo(
    () =>
      types.length === ALL_TYPES.length
        ? statementRows
        : statementRows.filter(t => types.includes(t.type)),
    [statementRows, types],
  );
  const visibleRows = useMemo(() => {
    const allowed = new Set(buckets.flatMap(b => BUCKET_STATUSES[b]));
    return typedRows.filter(t => allowed.has(t.reconciliationStatus));
  }, [typedRows, buckets]);

  // The OFX import doesn't carry a per-row bank balance (runningBalance is
  // null across the dataset), so the "Saldo" column only appears when the bank
  // supplies it. A running balance is meaningless on a filtered subset, so the
  // column also hides whenever a type/status filter is active.
  const hasBankBalance = useMemo(
    () => statementRows.some(t => t.runningBalance != null),
    [statementRows],
  );
  const filterActive =
    types.length !== ALL_TYPES.length || buckets.length !== ALL_BUCKETS.length;
  const showBalance = hasBankBalance && !filterActive;

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const t of statementRows) {
      const amt = Math.abs(Number(t.amount) || 0);
      if (t.type === "CREDIT") credits += amt;
      else debits += amt;
    }
    const last = statementRows[statementRows.length - 1];
    return {
      credits,
      debits,
      net: credits - debits,
      closingBalance: last?.runningBalance ?? null,
    };
  }, [statementRows]);

  // Status buckets summarized over the current type selection, so the counts
  // reflect what the table will show once a bucket is toggled.
  const bucketSummary = useMemo(() => {
    const out: Record<BucketKey, { count: number; total: number }> = {
      PENDING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      RECONCILED: { count: 0, total: 0 },
      IGNORED: { count: 0, total: 0 },
    };
    for (const t of typedRows) {
      const b = bucketOf(t.reconciliationStatus);
      out[b].count += 1;
      out[b].total += Math.abs(Number(t.amount) || 0);
    }
    return out;
  }, [typedRows]);

  const toggleType = useCallback(
    (t: TransactionType) =>
      setTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])),
    [],
  );
  const toggleBucket = useCallback((key: BucketKey) => {
    setBuckets(prev =>
      prev.includes(key) ? prev.filter(b => b !== key) : [...prev, key],
    );
  }, []);

  // ----- row quick actions (URL-driven dialogs, same keys as transações) ----
  const ignoreDialog = useUrlDialog("ignore");
  const categoryDialog = useUrlDialog("editCategory");
  const ignoreMut = useIgnoreTransaction();
  const categoryMut = useChangeCategory();
  const runMut = useRunAutoMatch();

  const ignoreDialogId = asUuid(ignoreDialog.value);
  const ignoreTxFromList = useMemo<BankTransaction | null>(
    () => (ignoreDialogId ? rows.find(t => t.id === ignoreDialogId) ?? null : null),
    [ignoreDialogId, rows],
  );
  const { data: fetchedIgnoreTx } = useBankTransaction(
    ignoreDialogId && !ignoreTxFromList ? ignoreDialogId : undefined,
  );
  const ignoreTx = ignoreTxFromList ?? fetchedIgnoreTx ?? null;

  const categoryDialogId = asUuid(categoryDialog.value);
  const categoryTxFromList = useMemo<BankTransaction | null>(
    () =>
      categoryDialogId ? rows.find(t => t.id === categoryDialogId) ?? null : null,
    [categoryDialogId, rows],
  );
  const { data: fetchedCategoryTx } = useBankTransaction(
    categoryDialogId && !categoryTxFromList ? categoryDialogId : undefined,
  );
  const categoryTx = categoryTxFromList ?? fetchedCategoryTx ?? null;

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tx: BankTransaction;
  } | null>(null);

  const columns: StandardizedColumn<BankTransaction>[] = useMemo(
    () => [
      {
        key: "postedAt",
        header: "Data",
        width: "110px",
        render: t => (
          <span className="tabular-nums text-sm whitespace-nowrap">
            {formatDate(t.postedAt)}
          </span>
        ),
      },
      {
        key: "description",
        header: "Histórico / Contraparte",
        render: t => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {t.counterpartyName ||
                (t.counterpartyCnpjCpf
                  ? formatCnpjCpf(t.counterpartyCnpjCpf)
                  : t.memo || "—")}
            </p>
            {t.counterpartyName && t.memo && (
              <p className="truncate text-xs text-muted-foreground">{t.memo}</p>
            )}
          </div>
        ),
      },
      {
        key: "amount",
        header: "Valor",
        width: "150px",
        align: "right",
        render: t => {
          const isCredit = t.type === "CREDIT";
          const amount = Math.abs(Number(t.amount) || 0);
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold tabular-nums whitespace-nowrap text-sm",
                isCredit ? "text-emerald-700" : "text-red-700",
              )}
            >
              {isCredit ? (
                <IconArrowDownLeft className="h-3.5 w-3.5" />
              ) : (
                <IconArrowUpRight className="h-3.5 w-3.5" />
              )}
              {isCredit ? "+" : "−"}
              {formatCurrency(amount)}
            </span>
          );
        },
      },
      // "Saldo" only when the bank statement carries per-line balances AND no
      // filter is active (a running total over a filtered subset is noise).
      ...(showBalance
        ? [
            {
              key: "runningBalance",
              header: "Saldo",
              width: "160px",
              align: "right" as const,
              render: (t: BankTransaction) =>
                t.runningBalance != null ? (
                  <span
                    className={cn(
                      "tabular-nums whitespace-nowrap text-sm",
                      Number(t.runningBalance) < 0 ? "text-red-700" : "text-foreground",
                    )}
                  >
                    {formatCurrency(t.runningBalance)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                ),
            } as StandardizedColumn<BankTransaction>,
          ]
        : []),
      {
        key: "category",
        header: "Categoria",
        width: "200px",
        render: t => <CategoryChips categories={t.categories} maxVisible={2} />,
      },
      {
        key: "linked",
        header: "NF / Boleto",
        width: "200px",
        render: t => <LinkedDocCell tx={t} />,
      },
      {
        key: "status",
        header: "Conciliação",
        width: "170px",
        render: t => (
          <MatchStatusBadge
            status={t.reconciliationStatus}
            topMatchScore={t.topMatchScore}
          />
        ),
      },
    ],
    [showBalance],
  );

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Extrato Bancário"
          icon={IconBuildingBank}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            {
              label: "Conciliação Bancária",
              href: routes.financial.reconciliation.root,
            },
            { label: "Extrato" },
          ]}
          actions={[
            {
              key: "verify",
              label: "Verificar",
              icon: IconRefresh,
              onClick: () => {
                // Single pipeline (classify → match → categorize) scoped to the
                // visible month. The endpoint suppresses the interceptor toast;
                // we summarize the three stages ourselves.
                runMut.mutate(
                  { dateStart: from.toISOString(), dateEnd: to.toISOString() },
                  {
                    onSuccess: r => {
                      const classified = r.classified?.processed ?? 0;
                      toast({
                        title: "Verificação concluída",
                        description: `${classified} classificadas · ${r.matched} conciliadas · ${r.categorized} categorizadas`,
                        variant: "success",
                      });
                      refetch();
                    },
                  },
                );
              },
              variant: "default" as const,
              loading: runMut.isPending,
            },
            {
              key: "import",
              label: "Importar OFX",
              icon: IconUpload,
              onClick: () => setImportOpen(true),
              variant: "outline" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        {/* Compact month totals — informational (the cards below are filters). */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground flex-shrink-0">
          <span>
            Resultado do mês:{" "}
            <span
              className={cn(
                "font-semibold tabular-nums",
                totals.net < 0 ? "text-red-600" : "text-emerald-600",
              )}
            >
              {totals.net < 0 ? "−" : "+"}
              {formatCurrency(Math.abs(totals.net))}
            </span>
          </span>
          {totals.closingBalance != null ? (
            <span>
              Saldo final:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(totals.closingBalance)}
              </span>
            </span>
          ) : (
            <span>
              Lançamentos:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {statementRows.length}
              </span>
            </span>
          )}
        </div>

        {/* Filters in one row — Entradas/Saídas (CREDIT/DEBIT type) + the 4
            status buckets. Every card is a toggle; click again to clear. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 flex-shrink-0">
          <FinancialKpiCard
            label="Entradas"
            value={isLoading ? null : `+${formatCurrency(totals.credits)}`}
            Icon={IconArrowDownLeft}
            tone="text-emerald-600 bg-emerald-500/10"
            active={types.includes("CREDIT")}
            onClick={() => toggleType("CREDIT")}
          />
          <FinancialKpiCard
            label="Saídas"
            value={isLoading ? null : `−${formatCurrency(totals.debits)}`}
            Icon={IconArrowUpRight}
            tone="text-red-600 bg-red-500/10"
            active={types.includes("DEBIT")}
            onClick={() => toggleType("DEBIT")}
          />
          {ALL_BUCKETS.map(key => {
            const meta = BUCKET_META[key];
            const bucket = bucketSummary[key];
            return (
              <FinancialKpiCard
                key={key}
                label={meta.label}
                value={isLoading ? null : formatCurrency(bucket.total)}
                count={bucket.count}
                Icon={meta.Icon}
                tone={meta.tone}
                active={buckets.includes(key)}
                onClick={() => toggleBucket(key)}
              />
            );
          })}
        </div>

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
                <div className="flex flex-1 min-w-0">
                  <TableSearchInput
                    value={searchText}
                    onChange={setSearchText}
                    placeholder="Buscar por contraparte, descrição ou FITID..."
                  />
                </div>
                <Combobox
                  mode="single"
                  value={effectiveAccountKey || undefined}
                  onValueChange={(v) => {
                    const key = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
                    if (key) setAccountKey(key);
                  }}
                  options={accounts.map(a => ({ value: a.key, label: a.label }))}
                  placeholder="Conta bancária"
                  searchPlaceholder="Buscar conta..."
                  clearable={false}
                  className="w-full sm:w-[300px] flex-shrink-0"
                  triggerClassName="h-10 w-full"
                />
                <MonthNav month={month} onChange={setMonth} className="flex-shrink-0" />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable<BankTransaction>
                  columns={columns}
                  data={visibleRows}
                  getItemKey={t => t.id}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma transação no período/filtros selecionados — importe um OFX ou ajuste o mês"
                  emptyIcon={IconCash}
                  onRowClick={t =>
                    navigate(
                      routes.financial.reconciliation.transactionDetail(t.id),
                    )
                  }
                  onContextMenu={(e, t) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, tx: t });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {contextMenu && (
        <DropdownMenu open onOpenChange={open => !open && setContextMenu(null)}>
          <PositionedDropdownMenuContent
            position={contextMenu}
            isOpen
            className="w-60"
            onCloseAutoFocus={e => e.preventDefault()}
          >
            <DropdownMenuItem
              onClick={() => {
                navigate(
                  routes.financial.reconciliation.transactionDetail(
                    contextMenu.tx.id,
                  ),
                );
                setContextMenu(null);
              }}
            >
              <IconListDetails className="h-4 w-4 mr-2" />
              Conciliar / ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                categoryDialog.set(contextMenu.tx.id);
                setContextMenu(null);
              }}
            >
              <IconCategory className="h-4 w-4 mr-2" />
              Alterar categoria
            </DropdownMenuItem>
            {contextMenu.tx.reconciliationStatus !== "IGNORED" && (
              <DropdownMenuItem
                onClick={() => {
                  ignoreDialog.set(contextMenu.tx.id);
                  setContextMenu(null);
                }}
              >
                <IconBan className="h-4 w-4 mr-2" />
                Ignorar
              </DropdownMenuItem>
            )}
          </PositionedDropdownMenuContent>
        </DropdownMenu>
      )}

      <IgnoreTransactionDialog
        open={ignoreDialog.open}
        onOpenChange={open => !open && ignoreDialog.clear()}
        isLoading={ignoreMut.isPending}
        onConfirm={reason => {
          if (!ignoreTx) return;
          ignoreMut.mutate(
            { transactionId: ignoreTx.id, payload: { reason } },
            // Success/error toasts come from the axios interceptors.
            { onSuccess: () => ignoreDialog.clear() },
          );
        }}
      />

      <CategoryPickerDialog
        open={categoryDialog.open}
        onOpenChange={open => !open && categoryDialog.clear()}
        transaction={categoryTx}
        isLoading={categoryMut.isPending}
        onConfirm={payload => {
          if (!categoryTx) return;
          categoryMut.mutate(
            { transactionId: categoryTx.id, payload },
            // Success/error toasts come from the axios interceptors.
            { onSuccess: () => categoryDialog.clear() },
          );
        }}
      />

      <OfxImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => refetch()}
      />
    </PrivilegeRoute>
  );
};

export default ReconciliationStatementPage;
