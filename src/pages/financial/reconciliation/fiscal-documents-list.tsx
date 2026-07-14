import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCheck,
  IconClockHour4,
  IconCloudDownload,
  IconCopy,
  IconEqual,
  IconEye,
  IconReceipt,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import type { FiscalDocumentsFiltersUi } from "@/components/financial/reconciliation/fiscal-documents-filter-sheet";
import { isLinked } from "@/components/financial/reconciliation/fiscal-documents-by-date-accordion";
import { FISCAL_DOCUMENT_COLUMNS, isMoneyIn } from "@/components/financial/reconciliation/fiscal-documents-columns";
import { DataTable, type DataTableColumnDef } from "@/components/ui/datatable";
import {
  buildDateGroups,
  pruneDateGroup,
  isDateGroup,
  GroupDateLabel,
  GroupProgressBar,
  type GroupedRow,
} from "@/components/financial/common/date-grouped-rows";
import { deriveDateRange } from "@/components/financial/reconciliation/date-utils";
import {
  PeriodNav,
  periodLabel,
  currentPeriod,
  type Period,
} from "@/components/financial/reconciliation/period-nav";
import { FinancialKpiCard } from "@/components/financial/common/financial-kpi-card";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XmlImportDialog } from "@/components/financial/reconciliation/xml-import-dialog";
import {
  useFiscalDocuments,
  useSiegFetch,
  useSiegStatus,
} from "@/hooks/financial/use-reconciliation";
import { useToast } from "@/hooks/common/use-toast";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, FAVORITE_PAGES, routes } from "@/constants";
import { formatCurrency } from "@/utils";
import type {
  FiscalDocType,
  FiscalDocument,
  FiscalDocumentStatus,
  OperationType,
} from "@/types/reconciliation";

// Upper bound passed to the API in period mode — a busy month/year still fits in
// a single fetch, so the whole payload feeds both the summary cards and the
// accordion and toggling a card never refetches (mirrors the Extrato page).
const PERIOD_PAGE_SIZE = 1000;

// Day-grouping options — shared by buildDateGroups (initial grouping) and
// pruneDateGroup (search-narrowed regrouping) so the recomputed day totals stay
// consistent. Green/red follow the CASH direction (isMoneyIn): emitted notes
// (money in) are green, notes against our CNPJ (money out) are red.
const DAY_GROUP_OPTS = {
  getDate: (d: FiscalDocument) => d.issueDate,
  getGreen: (d: FiscalDocument) => (isMoneyIn(d) ? Number(d.totalValue) || 0 : 0),
  getRed: (d: FiscalDocument) => (!isMoneyIn(d) ? Number(d.totalValue) || 0 : 0),
  getResolved: (d: FiscalDocument) => isLinked(d),
  direction: "desc" as const,
};

// --- Operation cards (Entradas / Saídas by operationType) ------------------
// ENTRADA = purchases / incoming notes, SAIDA = our sales. Multi-select toggle
// like the Extrato CREDIT/DEBIT cards — both on by default, click to narrow.
// The cards own the operation axis (client-side), so it's dropped from the sheet.
const ALL_OPERATIONS: OperationType[] = ["ENTRADA", "SAIDA"];

function parseOperations(raw: string | null): OperationType[] {
  if (!raw) return ALL_OPERATIONS;
  const parsed = raw
    .split(",")
    .filter((o): o is OperationType => o === "ENTRADA" || o === "SAIDA");
  return parsed.length ? parsed : ALL_OPERATIONS;
}

// --- Conciliation buckets (derived per-doc from its matches) ----------------
// Replaces the Extrato lifecycle buckets with NF conciliation buckets:
//   Pendentes  — no vínculo (no open bank match / no faturamento link)
//   Parciais   — vinculada but settled for LESS than the note total
//   Conciliadas— vinculada and covered
type NfBucketKey = "PENDING" | "PARTIAL" | "RECONCILED";

const ALL_NF_BUCKETS: NfBucketKey[] = ["PENDING", "PARTIAL", "RECONCILED"];

const NF_BUCKET_META: Record<
  NfBucketKey,
  { label: string; Icon: typeof IconCheck; tone: string }
> = {
  PENDING: {
    label: "Pendentes",
    Icon: IconClockHour4,
    tone: "text-amber-600 bg-amber-500/10",
  },
  PARTIAL: {
    label: "Parciais",
    Icon: IconEqual,
    tone: "text-blue-600 bg-blue-500/10",
  },
  RECONCILED: {
    label: "Conciliadas",
    Icon: IconCheck,
    tone: "text-emerald-600 bg-emerald-500/10",
  },
};

function parseNfBuckets(raw: string | null): NfBucketKey[] {
  if (!raw) return ALL_NF_BUCKETS;
  const parsed = raw
    .split(",")
    .filter(
      (b): b is NfBucketKey =>
        b === "PENDING" || b === "PARTIAL" || b === "RECONCILED",
    );
  return parsed.length ? parsed : ALL_NF_BUCKETS;
}

/**
 * Conciliation bucket for one NF, derived from the list payload.
 *
 * LIMITATION: the list payload's `matches[]` carries `allocatedAmount` but NOT
 * `reversedAt`, and `allocatedAmount` is optional — so we cannot fully split
 * Parcial vs Conciliada from allocations alone (a reversed allocation can't be
 * excluded here). We therefore lean on the API's derived `linked` flag (single
 * source of truth for "vinculada") for the Pendente split, and only demote a
 * linked doc to Parcial when we DO have allocation numbers that fall short of
 * the note total. SAIDA (emitted) notes have no bank-match/allocation concept —
 * their vínculo is the faturamento/orçamento — so a linked SAIDA is always
 * Conciliada. When no allocation detail is present, a linked doc defaults to
 * Conciliada.
 */
function nfBucketOf(doc: FiscalDocument): NfBucketKey {
  if (!isLinked(doc)) return "PENDING";
  if (doc.operationType === "SAIDA") return "RECONCILED";
  const matches = doc.matches ?? [];
  const allocated = matches.reduce(
    (sum, m) => sum + (Number(m.allocatedAmount) || 0),
    0,
  );
  const total = Number(doc.totalValue) || 0;
  if (allocated > 0 && total > 0 && allocated < total - 0.01) return "PARTIAL";
  return "RECONCILED";
}

// --- Persisted card selection (localStorage) --------------------------------
// The operation + bucket cards persist across visits so the chosen view sticks;
// a URL param still wins when present (shared/deep links). Mirrors the Extrato.
const OPERATIONS_STORAGE_KEY = "reconciliation-nf:operations";
const BUCKETS_STORAGE_KEY = "reconciliation-nf:buckets";

function readStoredSelection<T extends string>(
  key: string,
  allowed: readonly T[],
): T[] | null {
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

function writeStoredSelection(key: string, value: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private-mode — non-fatal */
  }
}

function parseMonthsParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Sheet-managed filters (everything that doesn't fit a card): period (year +
 * months, also driven by the inline PeriodNav), price range, docType, CNPJ,
 * doc-authorization status and vínculo. Operation is intentionally omitted — the
 * ENTRADA/SAÍDA cards own it.
 */
function parseFiltersFromUrl(params: URLSearchParams): FiscalDocumentsFiltersUi {
  const def = currentPeriod();
  const yearParam = params.get("year");
  const monthsParam = parseMonthsParam(params.get("months"));
  return {
    docType: (params.get("docType") as FiscalDocType | null) || undefined,
    status: (params.get("status") as FiscalDocumentStatus | null) || undefined,
    year: yearParam ? Number(yearParam) : def.year,
    months: monthsParam ?? def.months,
    valueMin: params.get("valueMin") ? Number(params.get("valueMin")) : undefined,
    valueMax: params.get("valueMax") ? Number(params.get("valueMax")) : undefined,
    emitCnpj: params.get("emitCnpj") || undefined,
    destCnpj: params.get("destCnpj") || undefined,
    hasMatch:
      params.get("hasMatch") === "true"
        ? true
        : params.get("hasMatch") === "false"
          ? false
          : undefined,
  };
}

export const FiscalDocumentsListContent = () => {
  usePageTracker({ title: "Notas Fiscais", icon: "receipt" });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [operations, setOperations] = useState<OperationType[]>(() => {
    const raw = searchParams.get("operacao");
    if (raw !== null) return parseOperations(raw);
    return (
      readStoredSelection(OPERATIONS_STORAGE_KEY, ALL_OPERATIONS) ??
      ALL_OPERATIONS
    );
  });
  const [buckets, setBuckets] = useState<NfBucketKey[]>(() => {
    const raw = searchParams.get("conc");
    if (raw !== null) return parseNfBuckets(raw);
    return (
      readStoredSelection(BUCKETS_STORAGE_KEY, ALL_NF_BUCKETS) ?? ALL_NF_BUCKETS
    );
  });
  // Sheet-managed filters + period (shared with the inline PeriodNav).
  const [filters, setFilters] = useState<FiscalDocumentsFiltersUi>(() =>
    parseFiltersFromUrl(searchParams),
  );

  const [importOpen, setImportOpen] = useState(false);

  // Backward-compat: a legacy `?nfId=` deeplink (old detail sheet) now routes to
  // the standalone detail page.
  useEffect(() => {
    const nfId = searchParams.get("nfId");
    // Guard the raw param: a malformed ?nfId= would navigate to a bad detail
    // route and trigger an error fetch. Only redirect on a valid UUID.
    if (
      nfId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nfId)
    ) {
      navigate(routes.financial.reconciliation.fiscalDocumentDetail(nfId), {
        replace: true,
      });
    }
  }, [searchParams, navigate]);

  // Keep the whole view shareable in the URL (single sync effect, Extrato-style).
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("search"); // search now handled by the DataTable toolbar
    if (operations.length !== ALL_OPERATIONS.length)
      params.set("operacao", [...operations].sort().join(","));
    else params.delete("operacao");
    if (buckets.length !== ALL_NF_BUCKETS.length)
      params.set("conc", [...buckets].sort().join(","));
    else params.delete("conc");
    if (filters.docType) params.set("docType", filters.docType);
    else params.delete("docType");
    if (filters.status) params.set("status", filters.status);
    else params.delete("status");
    if (filters.year) params.set("year", String(filters.year));
    else params.delete("year");
    if (filters.months && filters.months.length > 0)
      params.set("months", JSON.stringify(filters.months));
    else params.delete("months");
    if (filters.valueMin !== undefined)
      params.set("valueMin", String(filters.valueMin));
    else params.delete("valueMin");
    if (filters.valueMax !== undefined)
      params.set("valueMax", String(filters.valueMax));
    else params.delete("valueMax");
    if (filters.emitCnpj) params.set("emitCnpj", filters.emitCnpj);
    else params.delete("emitCnpj");
    if (filters.destCnpj) params.set("destCnpj", filters.destCnpj);
    else params.delete("destCnpj");
    if (filters.hasMatch !== undefined)
      params.set("hasMatch", String(filters.hasMatch));
    else params.delete("hasMatch");
    // Operation is now a card (persisted as `operacao`), not a sheet param.
    params.delete("operationType");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operations, buckets, filters]);

  // Persist the card selection so the chosen view sticks across visits.
  useEffect(() => {
    writeStoredSelection(OPERATIONS_STORAGE_KEY, operations);
  }, [operations]);
  useEffect(() => {
    writeStoredSelection(BUCKETS_STORAGE_KEY, buckets);
  }, [buckets]);

  const dateRange = useMemo(() => {
    if (!filters.year || !filters.months?.length) return null;
    return deriveDateRange(filters.year, filters.months);
  }, [filters.year, filters.months]);

  // Server query: date range + the sheet's filters (docType, price, CNPJ, status,
  // vínculo). Operation and conciliation bucket are applied CLIENT-side over this
  // payload, so toggling a card is instant and the totals reflect the whole
  // period. Free-text search is handled client-side by the DataTable toolbar.
  const { data, isLoading, refetch } = useFiscalDocuments({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "issueDate",
    sortDir: "desc",
    docType: filters.docType,
    status: filters.status,
    dateFrom: dateRange?.dateFrom,
    dateTo: dateRange?.dateTo,
    valueMin: filters.valueMin,
    valueMax: filters.valueMax,
    emitCnpj: filters.emitCnpj,
    destCnpj: filters.destCnpj,
    hasMatch: filters.hasMatch,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  // Narrow by the selected operations, then the conciliation buckets.
  const operationRows = useMemo(
    () =>
      operations.length === ALL_OPERATIONS.length
        ? rows
        : rows.filter(d => operations.includes(d.operationType)),
    [rows, operations],
  );
  const visibleRows = useMemo(
    () =>
      buckets.length === ALL_NF_BUCKETS.length
        ? operationRows
        : operationRows.filter(d => buckets.includes(nfBucketOf(d))),
    [operationRows, buckets],
  );

  // Cash-direction totals over the whole period payload (independent of the
  // active operation/bucket selection), so the cards read as period summaries.
  // Entrada = money in (notes we emitted); Saída = money out (against our CNPJ).
  const totals = useMemo(() => {
    let entrada = 0;
    let saida = 0;
    for (const d of rows) {
      const v = Math.abs(Number(d.totalValue) || 0);
      if (isMoneyIn(d)) entrada += v;
      else saida += v;
    }
    return { entrada, saida };
  }, [rows]);

  // Bucket counts summarized over the operation selection, so they match what
  // the table shows once a bucket is toggled.
  const bucketSummary = useMemo(() => {
    const out: Record<NfBucketKey, { count: number; total: number }> = {
      PENDING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      RECONCILED: { count: 0, total: 0 },
    };
    for (const d of operationRows) {
      const b = nfBucketOf(d);
      out[b].count += 1;
      out[b].total += Math.abs(Number(d.totalValue) || 0);
    }
    return out;
  }, [operationRows]);

  const toggleOperation = useCallback(
    (op: OperationType) =>
      setOperations(prev =>
        prev.includes(op) ? prev.filter(x => x !== op) : [...prev, op],
      ),
    [],
  );
  const toggleBucket = useCallback(
    (key: NfBucketKey) =>
      setBuckets(prev =>
        prev.includes(key) ? prev.filter(b => b !== key) : [...prev, key],
      ),
    [],
  );

  // Day grouping — one banner per emission day (newest first), entradas (money
  // in / emitted) green / saídas (money out / against our CNPJ) red — the same
  // accordion the Extrato / Contas a Receber use.
  const groupedRows = useMemo(
    () => buildDateGroups(visibleRows, DAY_GROUP_OPTS),
    [visibleRows],
  );

  const handleCopyKey = useCallback(
    (accessKey: string) => {
      navigator.clipboard
        .writeText(accessKey)
        .then(() => toast({ title: "Chave copiada", variant: "success" }))
        .catch(() => toast({ title: "Não foi possível copiar a chave", variant: "destructive" }));
    },
    [toast],
  );

  const siegStatus = useSiegStatus();
  const siegFetch = useSiegFetch();

  const handleSiegFetch = () => {
    const today = new Date();
    const past = new Date(today.getTime() - 30 * 86_400_000);
    siegFetch.mutate(
      {
        dateStart: past.toISOString().slice(0, 10),
        dateEnd: today.toISOString().slice(0, 10),
      },
      {
        onSuccess: r =>
          toast({
            title: "Sincronização SIEG concluída",
            description: `${r.created} criadas, ${r.skipped} duplicadas`,
            variant: "success",
          }),
        // Error toast is emitted by the axios error interceptor.
      },
    );
  };

  // Period shared by the inline PeriodNav and the sheet's month picker.
  const period = useMemo<Period>(
    () => ({
      year: filters.year ?? currentPeriod().year,
      months: filters.months ?? [],
    }),
    [filters.year, filters.months],
  );

  const periodTitle = useMemo(
    () => `Notas Fiscais - ${periodLabel(period)}`,
    [period],
  );

  return (
    <>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title={periodTitle}
          icon={IconReceipt}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_NOTAS_FISCAIS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            // The accounting (recebidas) NF list lives under Conciliação Bancária —
            // it's the fiscal-document side of the two-way reconciliation.
            {
              label: "Conciliação Bancária",
              href: routes.financial.reconciliation.root,
            },
            { label: "Notas Fiscais", href: routes.financial.reconciliation.fiscalDocuments },
          ]}
          actions={[
            {
              key: "import",
              label: "Importar Notas",
              icon: IconUpload,
              onClick: () => setImportOpen(true),
              variant: "default" as const,
            },
            ...(siegStatus.data?.enabled
              ? [
                  {
                    key: "sieg",
                    label: "Buscar SIEG",
                    icon: IconCloudDownload,
                    onClick: handleSiegFetch,
                    variant: "outline" as const,
                    loading: siegFetch.isPending,
                  },
                ]
              : []),
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: "outline" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        {/* Summary cards — Entradas/Saídas (operationType) + the 3 conciliation
            buckets. Every card is a toggle; click again to clear. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 flex-shrink-0">
          {/* Entradas = money in = notes we emitted (operationType SAIDA); Saídas
              = money out = notes against our CNPJ (operationType ENTRADA). */}
          <FinancialKpiCard
            label="Entradas"
            value={isLoading ? null : formatCurrency(totals.entrada)}
            Icon={IconArrowDownLeft}
            tone="text-emerald-600 bg-emerald-500/10"
            active={operations.includes("SAIDA")}
            onClick={() => toggleOperation("SAIDA")}
          />
          <FinancialKpiCard
            label="Saídas"
            value={isLoading ? null : formatCurrency(totals.saida)}
            Icon={IconArrowUpRight}
            tone="text-red-600 bg-red-500/10"
            active={operations.includes("ENTRADA")}
            onClick={() => toggleOperation("ENTRADA")}
          />
          {ALL_NF_BUCKETS.map(key => {
            const meta = NF_BUCKET_META[key];
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
          <DataTable<GroupedRow<FiscalDocument>>
            tableId="reconciliation-fiscal-documents"
            data={groupedRows}
            columns={FISCAL_DOCUMENT_COLUMNS as unknown as DataTableColumnDef<GroupedRow<FiscalDocument>>[]}
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
                ? pruneDateGroup(row, kept as FiscalDocument[], DAY_GROUP_OPTS)
                : row
            }
            isGroupRow={isDateGroup}
            renderGroupCell={(row, columnId, { isExpanded }) => {
              if (!isDateGroup(row)) return null;
              switch (columnId) {
                case "date":
                  return <GroupDateLabel group={row} />;
                case "entrada":
                  return !isExpanded && row.greenTotal > 0 ? (
                    <span className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(row.greenTotal)}</span>
                  ) : null;
                case "saida":
                  return !isExpanded && row.redTotal > 0 ? (
                    <span className="tabular-nums text-red-700 dark:text-red-400">{formatCurrency(row.redTotal)}</span>
                  ) : null;
                case "linked":
                  return <GroupProgressBar resolved={row.resolvedCount} count={row.count} />;
                default:
                  return null;
              }
            }}
            searchPlaceholder="Buscar por razão social, CNPJ, destinatário ou tipo..."
            toolbarActions={
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="currency"
                    value={filters.valueMin ?? null}
                    onChange={v => setFilters(f => ({ ...f, valueMin: typeof v === "number" ? v : undefined }))}
                    placeholder="Valor mín"
                    className="h-9 w-32"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="currency"
                    value={filters.valueMax ?? null}
                    onChange={v => setFilters(f => ({ ...f, valueMax: typeof v === "number" ? v : undefined }))}
                    placeholder="Valor máx"
                    className="h-9 w-32"
                  />
                </div>
                <PeriodNav
                  period={period}
                  onChange={next => setFilters(f => ({ ...f, year: next.year, months: next.months }))}
                  className="flex-shrink-0"
                />
              </div>
            }
            rowActions={[
              {
                key: "view",
                label: "Ver detalhes",
                icon: <IconEye className="h-4 w-4" />,
                hidden: rows => {
                  const r = rows[0];
                  return !r || isDateGroup(r);
                },
                onClick: rows => {
                  const r = rows[0];
                  if (r && !isDateGroup(r)) navigate(routes.financial.reconciliation.fiscalDocumentDetail(r.id));
                },
              },
              {
                key: "copy-key",
                label: "Copiar chave",
                icon: <IconCopy className="h-4 w-4" />,
                hidden: rows => {
                  const r = rows[0];
                  return !r || isDateGroup(r);
                },
                onClick: rows => {
                  const r = rows[0];
                  if (r && !isDateGroup(r)) handleCopyKey(r.accessKey);
                },
              },
            ]}
            onRowClick={row => {
              if (!isDateGroup(row)) navigate(routes.financial.reconciliation.fiscalDocumentDetail(row.id));
            }}
            emptyMessage="Nenhuma nota fiscal encontrada"
            exportTitle="Notas Fiscais"
            exportFilename="notas-fiscais"
            className="h-full"
          />
        </div>
      </div>

      <XmlImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};

export const ReconciliationFiscalDocumentsListPage = () => (
  <PrivilegeRoute
    requiredPrivilege={[
      SECTOR_PRIVILEGES.ADMIN,
      SECTOR_PRIVILEGES.FINANCIAL,
      SECTOR_PRIVILEGES.ACCOUNTING,
    ]}
  >
    <FiscalDocumentsListContent />
  </PrivilegeRoute>
);

export default ReconciliationFiscalDocumentsListPage;
