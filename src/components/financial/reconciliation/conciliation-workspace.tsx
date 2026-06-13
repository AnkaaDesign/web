import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBan,
  IconCash,
  IconCategory,
  IconCheck,
  IconClockHour4,
  IconEqual,
  IconListDetails,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import {
  CategoryChips,
  MatchStatusBadge,
  getCategoryTextColor,
} from "./match-status-badge";
import { MonthNav, monthBounds, monthKey, parseMonthKey } from "./month-nav";
import { IgnoreTransactionDialog } from "./ignore-transaction-dialog";
import { CategoryPickerDialog } from "./category-picker-dialog";
import {
  useBankTransaction,
  useBankTransactions,
  useChangeCategory,
  useConfirmSuggestion,
  useIgnoreTransaction,
  useReconciliationSuggestions,
  useRunAutoMatch,
} from "@/hooks/financial/use-reconciliation";
import { useUrlDialog } from "@/hooks/common/use-url-dialog";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
import { useToast } from "@/hooks/common/use-toast";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCNPJ, formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type {
  BankTransaction,
  ReconciliationStatus,
  TransactionType,
} from "@/types/reconciliation";

// Status buckets shown as clickable KPI cards. DISPUTED rides along with
// PENDING — both mean "ainda não explicada".
type BucketKey = "PENDING" | "PARTIAL" | "RECONCILED" | "IGNORED";

const BUCKET_STATUSES: Record<BucketKey, ReconciliationStatus[]> = {
  PENDING: ["PENDING", "DISPUTED"],
  PARTIAL: ["PARTIAL"],
  RECONCILED: ["RECONCILED"],
  IGNORED: ["IGNORED"],
};

const BUCKET_META: Record<
  BucketKey,
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
  IGNORED: {
    label: "Ignoradas",
    Icon: IconBan,
    tone: "text-neutral-500 bg-neutral-500/10",
  },
};

const DEFAULT_BUCKETS: BucketKey[] = ["PENDING", "PARTIAL"];
const ALL_BUCKETS: BucketKey[] = ["PENDING", "PARTIAL", "RECONCILED", "IGNORED"];

// Period-mode fetch cap — mirrors the transactions list page / API DTO cap.
const PERIOD_PAGE_SIZE = 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: string | null | undefined): string | undefined =>
  v && UUID_RE.test(v) ? v : undefined;

function parseBuckets(raw: string | null): BucketKey[] {
  if (!raw) return DEFAULT_BUCKETS;
  const parsed = raw
    .split(",")
    .filter((s): s is BucketKey => (ALL_BUCKETS as string[]).includes(s));
  return parsed.length > 0 ? parsed : DEFAULT_BUCKETS;
}

interface ConciliationWorkspaceProps {
  /** DEBIT → "Saídas" (pagamentos × NFs de entrada); CREDIT → "Conciliação de
   *  Entrada" (recebimentos × boletos/NFs emitidas). */
  direction: TransactionType;
}

/**
 * The conciliation WORKFLOW page, shared by Saídas (DEBIT) and Conciliação de
 * Entrada (CREDIT). Its goal is driving unmatched → matched: it opens on the
 * current month's pending rows, surfaces the learning layer's one-click
 * category suggestions, and funnels each row into the matching flow (detail
 * page with NF candidates), category assignment or ignore.
 */
export function ConciliationWorkspace({ direction }: ConciliationWorkspaceProps) {
  const isOutflow = direction === "DEBIT";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [month, setMonth] = useState<Date>(
    () => parseMonthKey(searchParams.get("mes")) ?? new Date(),
  );
  const [buckets, setBuckets] = useState<BucketKey[]>(() =>
    parseBuckets(searchParams.get("status")),
  );
  const [searchText, setSearchText] = useState(
    () => searchParams.get("search") || "",
  );
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);

  // Mirror month/status/search into the URL for shareability (replace — these
  // are filter tweaks, not navigation).
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("mes", monthKey(month));
    const bucketCsv = [...buckets].sort().join(",");
    if (bucketCsv !== [...DEFAULT_BUCKETS].sort().join(",")) {
      params.set("status", bucketCsv);
    } else {
      params.delete("status");
    }
    if (searchText) params.set("search", searchText);
    else params.delete("search");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, buckets, searchText]);

  const { from, to } = useMemo(() => monthBounds(month), [month]);

  // Single month-wide fetch (no status filter server-side): the same payload
  // feeds the KPI buckets AND the table, so toggling a bucket never refetches.
  // `search` matches memo/FITID and `counterparty` matches name/CNPJ — passing
  // the text in both ORs them together server-side.
  const { data, isLoading, refetch } = useBankTransactions({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "postedAt",
    sortDir: "desc",
    type: direction,
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    search: debouncedSearch || undefined,
    counterparty: debouncedSearch || undefined,
  });

  const rows = data?.data ?? [];

  const summary = useMemo(() => {
    const out: Record<BucketKey, { count: number; total: number }> = {
      PENDING: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0 },
      RECONCILED: { count: 0, total: 0 },
      IGNORED: { count: 0, total: 0 },
    };
    for (const t of rows) {
      const bucket: BucketKey =
        t.reconciliationStatus === "PARTIAL"
          ? "PARTIAL"
          : t.reconciliationStatus === "RECONCILED"
            ? "RECONCILED"
            : t.reconciliationStatus === "IGNORED"
              ? "IGNORED"
              : "PENDING";
      out[bucket].count += 1;
      out[bucket].total += Math.abs(Number(t.amount) || 0);
    }
    return out;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const allowed = new Set(buckets.flatMap(b => BUCKET_STATUSES[b]));
    return rows.filter(t => allowed.has(t.reconciliationStatus));
  }, [rows, buckets]);

  const toggleBucket = useCallback((key: BucketKey) => {
    setBuckets(prev =>
      prev.includes(key) ? prev.filter(b => b !== key) : [...prev, key],
    );
  }, []);

  // ----- learning-layer suggestion inbox (filtered to this direction) -------
  const { data: suggestions } = useReconciliationSuggestions();
  const directionSuggestions = useMemo(
    () => (suggestions ?? []).filter(s => s.type === direction && s.suggestedCategory),
    [suggestions, direction],
  );
  const confirmMut = useConfirmSuggestion();

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

  const title = isOutflow ? "Saídas — Conciliação" : "Conciliação de Entrada";
  const TitleIcon = isOutflow ? IconArrowUpRight : IconArrowDownLeft;

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
        key: "counterparty",
        header: "Contraparte / Descrição",
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
        width: "140px",
        align: "right",
        render: t => (
          <span
            className={cn(
              "font-semibold tabular-nums whitespace-nowrap text-sm",
              t.type === "CREDIT" ? "text-emerald-700" : "text-red-700",
            )}
          >
            {formatCurrency(t.amount)}
          </span>
        ),
      },
      {
        key: "category",
        header: "Categoria",
        width: "220px",
        render: t => <CategoryChips categories={t.categories} maxVisible={2} />,
      },
      {
        key: "linked",
        header: isOutflow ? "NF vinculada" : "NF / Boleto",
        width: "220px",
        render: t => <LinkedDocCell tx={t} />,
      },
      {
        key: "status",
        header: "Status",
        width: "170px",
        render: t => (
          <MatchStatusBadge
            status={t.reconciliationStatus}
            topMatchScore={t.topMatchScore}
          />
        ),
      },
    ],
    [isOutflow],
  );

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title={title}
        icon={TitleIcon}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          {
            label: "Conciliação Bancária",
            href: routes.financial.reconciliation.root,
          },
          { label: isOutflow ? "Saídas" : "Entradas" },
        ]}
        actions={[
          {
            key: "verify",
            label: "Verificar",
            icon: IconRefresh,
            onClick: () => {
              // Single pipeline (classify → match → categorize) scoped to the
              // visible month. The endpoint suppresses the interceptor toast;
              // we summarize the three stages ourselves (same convention as
              // the Transações page).
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
        ]}
        className="flex-shrink-0"
      />

      {/* Clickable status buckets — they both summarize the month and filter
          the table below (toggle on click). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_BUCKETS.map(key => {
          const meta = BUCKET_META[key];
          const bucket = summary[key];
          const active = buckets.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleBucket(key)}
              className="text-left focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md"
            >
              <Card
                className={cn(
                  "transition-all cursor-pointer hover:shadow-md",
                  active ? "border-primary/60 shadow-sm" : "opacity-70",
                )}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn("p-2 rounded-lg", meta.tone)}>
                    <meta.Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {meta.label}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-6 w-24 mt-1" />
                    ) : (
                      <p className="text-lg font-semibold truncate">
                        {formatCurrency(bucket.total)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          · {bucket.count}
                        </span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
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
              <MonthNav month={month} onChange={setMonth} />
            </div>

            {directionSuggestions.length > 0 && (
              <SuggestionStrip
                suggestions={directionSuggestions}
                pendingId={confirmMut.isPending ? confirmMut.variables ?? null : null}
                onConfirm={id => confirmMut.mutate(id)}
              />
            )}

            <div className="flex-1 min-h-0 overflow-auto">
              <StandardizedTable<BankTransaction>
                columns={columns}
                data={visibleRows}
                getItemKey={t => t.id}
                isLoading={isLoading}
                emptyMessage={
                  isOutflow
                    ? "Nenhuma saída no período/filtros selecionados"
                    : "Nenhuma entrada no período/filtros selecionados"
                }
                emptyIcon={IconCash}
                onRowClick={t =>
                  navigate(routes.financial.reconciliation.transactionDetail(t.id))
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
    </div>
  );
}

// ----- pieces ----------------------------------------------------------------

function LinkedDocCell({ tx }: { tx: BankTransaction }) {
  const docMatches = (tx.matches ?? []).filter(m => m.fiscalDocument);
  const slipMatch = (tx.matches ?? []).find(m => m.bankSlip);
  const firstDoc = docMatches[0]?.fiscalDocument;
  if (firstDoc?.id) {
    const label = firstDoc.emitName
      ? firstDoc.emitName
      : firstDoc.emitCnpj
        ? formatCNPJ(firstDoc.emitCnpj)
        : "NF";
    return (
      <Link
        to={routes.financial.reconciliation.fiscalDocumentDetail(firstDoc.id)}
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs hover:underline max-w-[13rem]"
        title={label}
      >
        <span className="truncate">{label}</span>
        {docMatches.length > 1 && (
          <span className="text-muted-foreground">(+{docMatches.length - 1})</span>
        )}
        <IconArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  if (slipMatch?.bankSlip) {
    return (
      <Badge variant="secondary" size="sm" className="whitespace-nowrap">
        Boleto {slipMatch.bankSlip.nossoNumero}
      </Badge>
    );
  }
  return <span className="text-muted-foreground text-xs">—</span>;
}

const SUGGESTION_DISPLAY_CAP = 5;

function SuggestionStrip({
  suggestions,
  pendingId,
  onConfirm,
}: {
  suggestions: Array<
    BankTransaction & {
      suggestionConfidence?: number | null;
      suggestedCategory?: { id: string; name: string; color: string | null } | null;
    }
  >;
  pendingId: string | null;
  onConfirm: (transactionId: string) => void;
}) {
  const visible = suggestions.slice(0, SUGGESTION_DISPLAY_CAP);
  const hidden = suggestions.length - visible.length;
  return (
    <div className="flex-shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <IconSparkles className="h-4 w-4 text-amber-600" />
        Sugestões de categoria ({suggestions.length})
        <span className="text-xs font-normal text-muted-foreground">
          — propostas da camada de aprendizado; aplicar também treina o sistema
        </span>
      </p>
      <div className="space-y-1">
        {visible.map(s => {
          const color = s.suggestedCategory?.color ?? null;
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-md bg-background/60 px-3 py-1.5"
            >
              <span className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(s.postedAt)}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm">
                {s.counterpartyName || s.memo || "—"}
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums text-xs whitespace-nowrap",
                  s.type === "CREDIT" ? "text-emerald-700" : "text-red-700",
                )}
              >
                {formatCurrency(s.amount)}
              </span>
              {s.suggestedCategory && (
                <Badge
                  variant={color ? undefined : "secondary"}
                  size="sm"
                  className="whitespace-nowrap border-transparent"
                  style={
                    color
                      ? {
                          backgroundColor: color,
                          color: getCategoryTextColor(color) ?? "#fff",
                        }
                      : undefined
                  }
                >
                  {s.suggestedCategory.name}
                  {typeof s.suggestionConfidence === "number" && (
                    <span className="ml-1 opacity-80">
                      {Math.round(s.suggestionConfidence)}%
                    </span>
                  )}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={pendingId === s.id}
                onClick={() => onConfirm(s.id)}
              >
                <IconCheck className="h-3.5 w-3.5 mr-1" />
                Aplicar
              </Button>
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          + {hidden} sugestão(ões) adicional(is) — aplique as visíveis para ver as
          próximas.
        </p>
      )}
    </div>
  );
}
