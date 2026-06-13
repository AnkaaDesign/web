import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBuildingBank,
  IconCash,
  IconUpload,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { MatchStatusBadge } from "@/components/financial/reconciliation/match-status-badge";
import {
  MonthNav,
  monthBounds,
  monthKey,
  parseMonthKey,
} from "@/components/financial/reconciliation/month-nav";
import { OfxImportDialog } from "@/components/financial/reconciliation/ofx-import-dialog";
import { useBankTransactions } from "@/hooks/financial/use-reconciliation";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { cn } from "@/lib/utils";
import {
  formatAccountNumber,
  formatCnpjCpf,
  formatCurrency,
  formatDate,
} from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";

// Mirrors the API DTO cap; a busy month fits in one fetch.
const PERIOD_PAGE_SIZE = 1000;

/** Stable identity of one bank account inside the statement data. */
function accountKeyOf(t: BankTransaction): string {
  return `${t.bankCode}|${t.agency}|${t.accountNumber}`;
}

function accountLabelOf(t: BankTransaction): string {
  const acct = t.accountNumber ? formatAccountNumber(t.accountNumber) : "";
  return `${t.bankName}${t.agency ? ` · Ag ${t.agency}` : ""}${acct ? ` / ${acct}` : ""}`;
}

/**
 * Extrato — the bank-statement view of Conciliação Bancária (spec §4.1).
 * Renders one account's transactions in statement order (oldest first) with
 * the running balance, credit/debit coloring and the per-row conciliation
 * status. Rows click through to the matching flow (transaction detail).
 */
export const ReconciliationStatementPage = () => {
  usePageTracker({ title: "Extrato - Conciliação", icon: "building-bank" });
  const navigate = useNavigate();
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
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const [importOpen, setImportOpen] = useState(false);

  // Keep month/account/search shareable in the URL.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("mes", monthKey(month));
    if (accountKey) params.set("conta", accountKey);
    else params.delete("conta");
    if (searchText) params.set("search", searchText);
    else params.delete("search");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, accountKey, searchText]);

  const { from, to } = useMemo(() => monthBounds(month), [month]);

  // Statement order: oldest first, so the running balance reads top-to-bottom.
  // `search` (memo/FITID) + `counterparty` (name/CNPJ) OR together server-side.
  const { data, isLoading, refetch } = useBankTransactions({
    page: 1,
    pageSize: PERIOD_PAGE_SIZE,
    sortBy: "postedAt",
    sortDir: "asc",
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

  const statementRows = useMemo(
    () => rows.filter(t => accountKeyOf(t) === effectiveAccountKey),
    [rows, effectiveAccountKey],
  );

  // The OFX import doesn't carry a per-row bank balance (runningBalance is
  // null across the dataset), so the statement falls back to the month's
  // accumulated net movement: Σ signed amounts in statement order. When the
  // bank-provided balance exists it always wins.
  const cumulativeById = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 0;
    for (const t of statementRows) {
      const amt = Math.abs(Number(t.amount) || 0);
      acc += t.type === "CREDIT" ? amt : -amt;
      map.set(t.id, acc);
    }
    return map;
  }, [statementRows]);
  const hasBankBalance = useMemo(
    () => statementRows.some(t => t.runningBalance != null),
    [statementRows],
  );

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

  // Columns depend on whether the bank supplied a per-row balance (header +
  // fallback rendering switch on it).

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
        key: "subtype",
        header: "Forma",
        width: "110px",
        align: "center",
        render: t => (
          <span className="text-xs text-muted-foreground">{t.subtype}</span>
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
      {
        key: "runningBalance",
        header: hasBankBalance ? "Saldo" : "Acumulado no mês",
        width: "160px",
        align: "right",
        render: t => {
          if (t.runningBalance != null) {
            return (
              <span
                className={cn(
                  "tabular-nums whitespace-nowrap text-sm",
                  Number(t.runningBalance) < 0 ? "text-red-700" : "text-foreground",
                )}
              >
                {formatCurrency(t.runningBalance)}
              </span>
            );
          }
          const acc = cumulativeById.get(t.id);
          if (acc === undefined)
            return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <span
              className={cn(
                "tabular-nums whitespace-nowrap text-sm text-muted-foreground",
                acc < 0 && "text-red-700/80",
              )}
              title="Movimentação acumulada no mês (o OFX não informa saldo por lançamento)"
            >
              {acc < 0 ? "−" : ""}
              {formatCurrency(Math.abs(acc))}
            </span>
          );
        },
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
    [hasBankBalance, cumulativeById],
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
              key: "import",
              label: "Importar OFX",
              icon: IconUpload,
              onClick: () => setImportOpen(true),
              variant: "outline" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <SummaryCards
          credits={totals.credits}
          debits={totals.debits}
          net={totals.net}
          closingBalance={totals.closingBalance}
          rowCount={statementRows.length}
          isLoading={isLoading}
        />

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
                <Select
                  value={effectiveAccountKey || undefined}
                  onValueChange={setAccountKey}
                >
                  <SelectTrigger className="h-10 w-full sm:w-[300px]">
                    <SelectValue placeholder="Conta bancária" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.key} value={a.key}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MonthNav month={month} onChange={setMonth} />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                <StandardizedTable<BankTransaction>
                  columns={columns}
                  data={statementRows}
                  getItemKey={t => t.id}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma transação no período — importe um OFX ou ajuste o mês"
                  emptyIcon={IconCash}
                  onRowClick={t =>
                    navigate(
                      routes.financial.reconciliation.transactionDetail(t.id),
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <OfxImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => refetch()}
      />
    </PrivilegeRoute>
  );
};

function SummaryCards({
  credits,
  debits,
  net,
  closingBalance,
  rowCount,
  isLoading,
}: {
  credits: number;
  debits: number;
  net: number;
  closingBalance: number | null;
  rowCount: number;
  isLoading: boolean;
}) {
  const items = [
    {
      label: "Entradas no mês",
      value: `+${formatCurrency(credits)}`,
      tone: "text-emerald-600 bg-emerald-500/10",
      Icon: IconArrowDownLeft,
    },
    {
      label: "Saídas no mês",
      value: `−${formatCurrency(debits)}`,
      tone: "text-red-600 bg-red-500/10",
      Icon: IconArrowUpRight,
    },
    {
      label: "Resultado do mês",
      value: `${net < 0 ? "−" : "+"}${formatCurrency(Math.abs(net))}`,
      tone: net < 0 ? "text-red-600 bg-red-500/10" : "text-emerald-600 bg-emerald-500/10",
      Icon: IconCash,
    },
    // The bank balance is rarely present in the OFX; fall back to the row
    // count so the card stays informative either way.
    closingBalance != null
      ? {
          label: "Saldo final (extrato)",
          value: formatCurrency(closingBalance),
          tone: "text-blue-600 bg-blue-500/10",
          Icon: IconBuildingBank,
        }
      : {
          label: "Lançamentos no mês",
          value: String(rowCount),
          tone: "text-blue-600 bg-blue-500/10",
          Icon: IconBuildingBank,
        },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(item => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn("p-2 rounded-lg", item.tone)}>
              <item.Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {item.label}
              </p>
              {isLoading ? (
                <Skeleton className="h-6 w-24 mt-1" />
              ) : (
                <p className="text-lg font-semibold truncate" title={item.value}>
                  {item.value}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReconciliationStatementPage;
