import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBuildingBank,
  IconHelpCircle,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconBan, IconCategory } from "@tabler/icons-react";
import { DataTable, type DataTableColumnDef } from "@/components/ui/datatable";
import { FinancialKpiCard } from "@/components/financial/common/financial-kpi-card";
import { parseMonthKey } from "@/components/financial/reconciliation/month-nav";
import {
  PeriodNav,
  currentPeriod,
  type Period,
} from "@/components/financial/reconciliation/period-nav";
import { STATEMENT_COLUMNS } from "@/components/financial/reconciliation/statement-columns";
import {
  buildDateGroups,
  pruneDateGroup,
  isDateGroup,
  GroupDateLabel,
  GroupProgressBar,
  type GroupedRow,
} from "@/components/financial/common/date-grouped-rows";
import { deriveDateRange } from "@/components/financial/reconciliation/date-utils";
import { OfxImportDialog } from "@/components/financial/reconciliation/ofx-import-dialog";
import { ScoringWorkflowDialog } from "@/components/financial/reconciliation/scoring-workflow-dialog";
import { IgnoreTransactionDialog } from "@/components/financial/reconciliation/ignore-transaction-dialog";
import { CategoryPickerDialog } from "@/components/financial/reconciliation/category-picker-dialog";
import {
  ALL_BUCKETS,
  BUCKET_META,
  BUCKET_STATUSES,
  bucketOf,
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
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useToast } from "@/hooks/common/use-toast";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "@/constants";
import { formatAccountNumber, formatCurrency } from "@/utils";
import type { BankTransaction, TransactionType } from "@/types/reconciliation";

// Mirrors the API DTO cap; a busy month fits in one fetch.
const PERIOD_PAGE_SIZE = 1000;

// Day-grouping options — shared by buildDateGroups (initial grouping) and
// pruneDateGroup (search-narrowed regrouping) so the recomputed day totals /
// progress bar stay consistent with how the groups were built.
const DAY_GROUP_OPTS = {
  getDate: (t: BankTransaction) => t.postedAt,
  getGreen: (t: BankTransaction) => (t.type === "CREDIT" ? Math.abs(Number(t.amount) || 0) : 0),
  getRed: (t: BankTransaction) => (t.type !== "CREDIT" ? Math.abs(Number(t.amount) || 0) : 0),
  getResolved: (t: BankTransaction) =>
    t.reconciliationStatus === "RECONCILED" ||
    t.reconciliationStatus === "PARTIAL" ||
    t.reconciliationStatus === "IGNORED",
  direction: "desc" as const,
};

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

// The card selection (Entradas/Saídas + status buckets) + the chosen period
// persist across visits in localStorage so the user's view sticks. A URL param
// still wins when present (shared/deep links); otherwise we fall back to the
// stored value, then to the defaults.
const TYPES_STORAGE_KEY = "reconciliation-statement:types";
const BUCKETS_STORAGE_KEY = "reconciliation-statement:buckets";
const PERIOD_STORAGE_KEY = "reconciliation-statement:period";
const MONTHS_RE = /^(0[1-9]|1[0-2])$/;

/** Parse the year+months period from URL params (JSON or CSV months). */
function parsePeriodFromUrl(params: URLSearchParams): Period | null {
  const yearRaw = params.get("year");
  const monthsRaw = params.get("months");
  if (!yearRaw || !monthsRaw) return null;
  const year = Number(yearRaw);
  if (!Number.isFinite(year)) return null;
  let months: string[] = [];
  try {
    const parsed = JSON.parse(monthsRaw);
    if (Array.isArray(parsed)) months = parsed.map(String);
  } catch {
    months = monthsRaw.split(",").map(s => s.trim()).filter(Boolean);
  }
  months = months.filter(m => MONTHS_RE.test(m));
  if (!months.length) return null;
  return { year, months };
}

function readStoredPeriod(): Period | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.year === "number" && Array.isArray(p.months)) {
      const months = p.months.map(String).filter((m: string) => MONTHS_RE.test(m));
      if (months.length) return { year: p.year, months };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readStoredSelection<T extends string>(key: string, allowed: readonly T[]): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is T => allowed.includes(v as T));
  } catch {
    return null;
  }
}

function writeStoredSelection(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private-mode — non-fatal */
  }
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
 * transactions for the selected period, grouped into expandable/collapsible day
 * rows, and absorbs what used to be the Saídas/Entradas/Transações pages: the
 * Entradas/Saídas summary cards toggle a CREDIT/DEBIT type filter, the status
 * buckets (Pendentes/Parciais/Conciliadas/Ignoradas) filter by conciliação
 * status, and each row funnels into the matching flow, category assignment or
 * ignore. An inline period stepper browses month-to-month; the "Filtros" sheet
 * holds the multi-month period + the value range.
 */
export const ReconciliationStatementPage = () => {
  usePageTracker({ title: "Extrato - Conciliação", icon: "building-bank" });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [period, setPeriod] = useState<Period>(() => {
    const fromUrl = parsePeriodFromUrl(searchParams);
    if (fromUrl) return fromUrl;
    // Backward-compat: a legacy single-month `?mes=YYYY-MM` deeplink.
    const mes = parseMonthKey(searchParams.get("mes"));
    if (mes) {
      return { year: mes.getFullYear(), months: [String(mes.getMonth() + 1).padStart(2, "0")] };
    }
    return readStoredPeriod() ?? currentPeriod();
  });
  // Price range (magnitude, R$) set in the Filtros sheet. Applied client-side on
  // the absolute amount — the same basis the totals/type/bucket filters use — so
  // it narrows credits and debits alike without fighting the signed row value.
  const [amountMin, setAmountMin] = useState<number | null>(() => {
    const raw = searchParams.get("valorMin");
    const n = Number(raw);
    return raw && Number.isFinite(n) ? n : null;
  });
  const [amountMax, setAmountMax] = useState<number | null>(() => {
    const raw = searchParams.get("valorMax");
    const n = Number(raw);
    return raw && Number.isFinite(n) ? n : null;
  });
  const [types, setTypes] = useState<TransactionType[]>(() => {
    const raw = searchParams.get("tipo");
    if (raw !== null) return parseTypes(raw);
    return readStoredSelection(TYPES_STORAGE_KEY, ALL_TYPES) ?? ALL_TYPES;
  });
  const [buckets, setBuckets] = useState<BucketKey[]>(() => {
    const raw = searchParams.get("status");
    if (raw !== null) return parseBuckets(raw, ALL_BUCKETS);
    return readStoredSelection(BUCKETS_STORAGE_KEY, ALL_BUCKETS) ?? ALL_BUCKETS;
  });
  const [importOpen, setImportOpen] = useState(false);
  const [scoringHelpOpen, setScoringHelpOpen] = useState(false);

  // Keep period/account/search/value/type/status shareable in the URL.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("mes"); // superseded by year/months
    params.set("year", String(period.year));
    params.set("months", JSON.stringify(period.months));
    params.delete("conta"); // account selector removed — statement is Sicredi-only
    if (amountMin != null) params.set("valorMin", String(amountMin));
    else params.delete("valorMin");
    if (amountMax != null) params.set("valorMax", String(amountMax));
    else params.delete("valorMax");
    if (types.length !== ALL_TYPES.length)
      params.set("tipo", [...types].sort().join(","));
    else params.delete("tipo");
    const bucketCsv = [...buckets].sort().join(",");
    if (buckets.length !== ALL_BUCKETS.length) params.set("status", bucketCsv);
    else params.delete("status");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, amountMin, amountMax, types, buckets]);

  // Persist the card selection + period so the chosen view sticks across visits.
  useEffect(() => {
    writeStoredSelection(TYPES_STORAGE_KEY, types);
  }, [types]);
  useEffect(() => {
    writeStoredSelection(BUCKETS_STORAGE_KEY, buckets);
  }, [buckets]);
  useEffect(() => {
    writeStoredSelection(PERIOD_STORAGE_KEY, period);
  }, [period]);

  // Inclusive [dateFrom, dateTo] over the selected month(s) for the server query.
  const dateRange = useMemo(
    () => deriveDateRange(period.year, period.months),
    [period],
  );

  // Newest first. `search` (memo/FITID) + `counterparty` (name/CNPJ) OR together
  // server-side. No type/status filter server-side — the same payload feeds the
  // cards and the table, so toggling a card never refetches.
  const { data, isLoading, refetch } = useBankTransactions({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "postedAt",
    sortDir: "desc",
    dateFrom: dateRange?.dateFrom,
    dateTo: dateRange?.dateTo,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  // Accounts present in the period — drives the selector. The statement only
  // makes sense per account, so we always narrow to one.
  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of rows) {
      const key = accountKeyOf(t);
      if (!map.has(key)) map.set(key, accountLabelOf(t));
    }
    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }, [rows]);

  // Statement is Sicredi-only (bank code 748) — pick that account by default,
  // falling back to the first account present when no Sicredi row is in view.
  const effectiveAccountKey = useMemo(() => {
    const sicredi = rows.find(t => t.bankCode === "748" || /sicredi/i.test(t.bankName ?? ""));
    if (sicredi) return accountKeyOf(sicredi);
    return accounts[0]?.key ?? "";
  }, [rows, accounts]);

  // The full account set — drives the period totals (credits/debits),
  // independent of the active type/status filter.
  const statementRows = useMemo(
    () => rows.filter(t => accountKeyOf(t) === effectiveAccountKey),
    [rows, effectiveAccountKey],
  );

  // Narrow by the selected CREDIT/DEBIT types, then by the price range, then by
  // the status buckets.
  const typedRows = useMemo(
    () =>
      types.length === ALL_TYPES.length
        ? statementRows
        : statementRows.filter(t => types.includes(t.type)),
    [statementRows, types],
  );
  // Price range on the absolute amount (magnitude). Feeds both the bucket summary
  // and the table so the counts agree with what the range shows.
  const rangeRows = useMemo(() => {
    if (amountMin == null && amountMax == null) return typedRows;
    return typedRows.filter(t => {
      const amt = Math.abs(Number(t.amount) || 0);
      if (amountMin != null && amt < amountMin) return false;
      if (amountMax != null && amt > amountMax) return false;
      return true;
    });
  }, [typedRows, amountMin, amountMax]);
  const visibleRows = useMemo(() => {
    const allowed = new Set(buckets.flatMap(b => BUCKET_STATUSES[b]));
    return rangeRows.filter(t => allowed.has(t.reconciliationStatus));
  }, [rangeRows, buckets]);

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const t of statementRows) {
      const amt = Math.abs(Number(t.amount) || 0);
      if (t.type === "CREDIT") credits += amt;
      else debits += amt;
    }
    return { credits, debits };
  }, [statementRows]);

  // Status buckets summarized over the current type + price-range selection, so
  // the counts reflect what the table will show once a bucket is toggled.
  const bucketSummary = useMemo(() => {
    const out: Record<BucketKey, { count: number; total: number }> = {
      PENDING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      RECONCILED: { count: 0, total: 0 },
      IGNORED: { count: 0, total: 0 },
    };
    for (const t of rangeRows) {
      const b = bucketOf(t.reconciliationStatus);
      out[b].count += 1;
      out[b].total += Math.abs(Number(t.amount) || 0);
    }
    return out;
  }, [rangeRows]);

  const toggleType = useCallback(
    (t: TransactionType) =>
      setTypes(prev =>
        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
      ),
    [],
  );
  const toggleBucket = useCallback((key: BucketKey) => {
    setBuckets(prev =>
      prev.includes(key) ? prev.filter(b => b !== key) : [...prev, key],
    );
  }, []);

  // Day grouping — one banner per posted day (newest first), entradas green /
  // saídas red — the same accordion the Notas Fiscais / Contas a Receber use.
  const groupedRows = useMemo(
    () => buildDateGroups(visibleRows, DAY_GROUP_OPTS),
    [visibleRows],
  );

  // ----- row quick actions (URL-driven dialogs) ----------------------------
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
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_EXTRATO}
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
                if (!dateRange) return;
                // Single pipeline (classify → match → categorize) scoped to the
                // visible period. The endpoint suppresses the interceptor toast;
                // we summarize the three stages ourselves.
                runMut.mutate(
                  { dateStart: dateRange.dateFrom, dateEnd: dateRange.dateTo },
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
              key: "scoring-help",
              label: "Como funciona",
              icon: IconHelpCircle,
              onClick: () => setScoringHelpOpen(true),
              variant: "outline" as const,
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
          <DataTable<GroupedRow<BankTransaction>>
            tableId="reconciliation-statement"
            data={groupedRows}
            columns={STATEMENT_COLUMNS as unknown as DataTableColumnDef<GroupedRow<BankTransaction>>[]}
            getRowId={row => row.id}
            isLoading={isLoading}
            enablePagination={false}
            enableSelection={false}
            enableRowPinning={false}
            enableShare={false}
            enableExpansion
            defaultExpanded
            getSubRows={row => (isDateGroup(row) ? row.children : undefined)}
            pruneSubRows={(row, kept) =>
              isDateGroup(row)
                ? pruneDateGroup(row, kept as BankTransaction[], DAY_GROUP_OPTS)
                : row
            }
            isGroupRow={isDateGroup}
            renderGroupCell={(row, columnId, { isExpanded }) => {
              if (!isDateGroup(row)) return null;
              switch (columnId) {
                case "date":
                  return <GroupDateLabel group={row} />;
                // Day totals sit under their columns and hide once the day is expanded (rows show them).
                case "credit":
                  return !isExpanded && row.greenTotal > 0 ? (
                    <span className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(row.greenTotal)}</span>
                  ) : null;
                case "debit":
                  return !isExpanded && row.redTotal > 0 ? (
                    <span className="tabular-nums text-red-700 dark:text-red-400">{formatCurrency(row.redTotal)}</span>
                  ) : null;
                case "reconciliationStatus":
                  return <GroupProgressBar resolved={row.resolvedCount} count={row.count} />;
                default:
                  return null;
              }
            }}
            searchPlaceholder="Buscar por contraparte, descrição ou categoria..."
            toolbarActions={
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="currency"
                    value={amountMin}
                    onChange={v => setAmountMin(typeof v === "number" ? v : null)}
                    placeholder="Valor mín"
                    className="h-9 w-32"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="currency"
                    value={amountMax}
                    onChange={v => setAmountMax(typeof v === "number" ? v : null)}
                    placeholder="Valor máx"
                    className="h-9 w-32"
                  />
                </div>
                <PeriodNav period={period} onChange={setPeriod} className="flex-shrink-0" />
              </div>
            }
            rowActions={[
              {
                key: "change-category",
                label: "Alterar categoria",
                icon: <IconCategory className="h-4 w-4" />,
                hidden: rows => {
                  const r = rows[0];
                  return !r || isDateGroup(r);
                },
                onClick: rows => {
                  const r = rows[0];
                  if (r && !isDateGroup(r)) categoryDialog.set(r.id);
                },
              },
              {
                key: "ignore",
                label: "Ignorar",
                icon: <IconBan className="h-4 w-4" />,
                hidden: rows => {
                  const r = rows[0];
                  return !r || isDateGroup(r) || r.reconciliationStatus === "IGNORED";
                },
                onClick: rows => {
                  const r = rows[0];
                  if (r && !isDateGroup(r)) ignoreDialog.set(r.id);
                },
              },
            ]}
            onRowClick={row => {
              if (!isDateGroup(row)) navigate(routes.financial.reconciliation.transactionDetail(row.id));
            }}
            emptyMessage="Nenhuma transação encontrada"
            exportTitle="Extrato"
            exportFilename="extrato"
            className="h-full"
          />
        </div>
      </div>

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

      <ScoringWorkflowDialog
        open={scoringHelpOpen}
        onOpenChange={setScoringHelpOpen}
      />
    </PrivilegeRoute>
  );
};

export default ReconciliationStatementPage;
