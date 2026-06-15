import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  IconCalendarRepeat,
  IconCheck,
  IconGift,
  IconInfoCircle,
  IconPackage,
  IconReceiptTax,
  IconTrendingDown,
  IconUsers,
} from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { FinancialKpiCard as KpiCard } from "@/components/financial/common/financial-kpi-card";
import { MonthNav, monthKey, parseMonthKey } from "@/components/financial/reconciliation/month-nav";
import { useOutflowForecast } from "@/hooks/financial/use-reconciliation";
import { useOrderScheduleExpectedTotals } from "@/hooks/inventory/use-order-schedule";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils";

/** Max open-order rows rendered on this composite page (full list lives in
 *  Contas a Pagar). Totals always cover every open order. */
const ORDER_DISPLAY_CAP = 50;

/**
 * Unified forecast row — EVERY section on this page renders through the same
 * four columns (Descrição · Tomador · Vencimento · Valor) so the design is
 * consistent across pedidos, agendamentos, impostos, folha e recorrentes.
 */
interface ForecastRow {
  id: string;
  descricao: string;
  tomador: string | null;
  vencimento: string | Date | null;
  valor: number;
  /** Synthesized/statutory due date → rendered as "previsão" (italic). */
  isForecastDate?: boolean;
  /** Estimated value (taxes / recurrents / schedules) → "Estimado" badge. */
  isEstimate?: boolean;
  /** Category color dot (recurrents). */
  color?: string | null;
  /** Small badge appended to the description (e.g. status). */
  badge?: string | null;
  /** Row navigation target. */
  linkTo?: string;
}

/**
 * Previsão de Saídas — composite forward view for one competence month:
 * pedidos (contas a pagar + agendamentos), impostos, folha com bonificação,
 * folha programada (13º e férias) e recorrentes. Every section uses the same
 * unified table. Sections with no data are hidden.
 */
export const ReconciliationOutflowForecastPage = () => {
  usePageTracker({ title: "Previsão de Saídas", icon: "trending-down" });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState<Date>(() => parseMonthKey(searchParams.get("mes")) ?? new Date());
  const [searchText, setSearchText] = useState(() => searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(searchText.trim().toLowerCase(), 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("mes", monthKey(month));
    if (searchText) params.set("search", searchText);
    else params.delete("search");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, searchText]);

  // Search filters every section by description / tomador (payee).
  const rowMatches = (r: ForecastRow) =>
    !debouncedSearch || r.descricao.toLowerCase().includes(debouncedSearch) || (r.tomador?.toLowerCase().includes(debouncedSearch) ?? false);

  const { data, isLoading } = useOutflowForecast(monthKey(month));

  const pedidos = data?.pedidos;
  const impostos = data?.impostos;
  const folha = data?.folha;
  const folhaProgramada = data?.folhaProgramada;
  const recorrentes = data?.recorrentes;
  const learned = data?.learned;

  // The pipeline can hold hundreds of open orders; show the biggest ones and
  // point to Contas a Pagar for the full list. KPI totals cover ALL open orders.
  const matchedOrders = useMemo(() => {
    const all = pedidos?.orders ?? [];
    if (!debouncedSearch) return all;
    return all.filter(
      (o) =>
        (o.description?.toLowerCase().includes(debouncedSearch) ?? false) ||
        (o.orderNumber ? `#${o.orderNumber}`.toLowerCase().includes(debouncedSearch) : false) ||
        (o.supplierName?.toLowerCase().includes(debouncedSearch) ?? false),
    );
  }, [pedidos, debouncedSearch]);
  const displayedOrders = useMemo(() => {
    if (matchedOrders.length <= ORDER_DISPLAY_CAP) return matchedOrders;
    return [...matchedOrders].sort((a, b) => b.total - a.total).slice(0, ORDER_DISPLAY_CAP);
  }, [matchedOrders]);
  const hiddenOrderCount = matchedOrders.length - displayedOrders.length;

  // Expected value per scheduled order (recomputed from the forecast calc).
  const scheduleIds = useMemo(() => (pedidos?.schedules ?? []).map((s) => s.id), [pedidos]);
  const { data: expectedTotalsResp } = useOrderScheduleExpectedTotals(scheduleIds, { enabled: scheduleIds.length > 0 });
  const expectedByScheduleId = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expectedTotalsResp?.data ?? []) map.set(e.id, e.expectedTotal);
    return map;
  }, [expectedTotalsResp]);

  // --- One column set, shared by every section ------------------------------
  const forecastColumns: StandardizedColumn<ForecastRow>[] = useMemo(
    () => [
      {
        key: "descricao",
        header: "Descrição",
        render: (r) => (
          <div className="flex items-center gap-2 min-w-0">
            {r.color && <span className="h-3 w-3 rounded-full flex-shrink-0 border border-border" style={{ backgroundColor: r.color }} />}
            <span className="truncate text-sm font-medium">{r.descricao}</span>
            {r.isEstimate && (
              <Badge variant="secondary" size="sm" className="flex-shrink-0 text-[10px]">
                Estimado
              </Badge>
            )}
            {r.badge && (
              <Badge variant="completed" size="sm" className="flex-shrink-0 text-[10px]">
                {r.badge}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "tomador",
        header: "Tomador",
        width: "220px",
        render: (r) => (r.tomador ? <span className="truncate text-sm block">{r.tomador}</span> : <span className="text-muted-foreground text-xs">—</span>),
      },
      {
        key: "vencimento",
        header: "Vencimento",
        width: "150px",
        align: "center",
        render: (r) =>
          r.vencimento ? (
            <span
              className={cn("tabular-nums text-sm", r.isForecastDate && "text-muted-foreground italic")}
              title={r.isForecastDate ? "Data prevista" : undefined}
            >
              {formatDate(new Date(r.vencimento))}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "valor",
        header: "Valor",
        width: "150px",
        align: "right",
        render: (r) => <span className="font-semibold tabular-nums text-sm">{formatCurrency(r.valor)}</span>,
      },
    ],
    [],
  );

  // --- Per-section rows mapped into the unified shape -----------------------
  const pedidoRows: ForecastRow[] = useMemo(
    () =>
      displayedOrders.map((o) => ({
        id: `order-${o.id}`,
        descricao: o.orderNumber ? `#${o.orderNumber} — ${o.description}` : o.description,
        tomador: o.supplierName ?? null,
        vencimento: o.forecast ?? null,
        isForecastDate: true,
        valor: o.total,
        linkTo: routes.inventory.orders.details(o.id),
      })),
    [displayedOrders],
  );

  const agendamentoRows: ForecastRow[] = useMemo(
    () =>
      (pedidos?.schedules ?? []).map((s) => ({
        id: `sched-${s.id}`,
        descricao: s.name || "Pedido programado",
        tomador: s.supplierName ?? null,
        vencimento: s.nextRun ?? null,
        isForecastDate: true,
        isEstimate: true,
        valor: expectedByScheduleId.get(s.id) ?? 0,
      })),
    [pedidos, expectedByScheduleId],
  );

  const impostoRows: ForecastRow[] = useMemo(() => {
    const inv = impostos?.invoicedServices;
    if (!inv || inv.invoiceCount === 0) return [];
    const rows: ForecastRow[] = [
      {
        id: "imposto-iss",
        descricao: `ISS ${inv.issRatePercent}% sobre faturamento (${inv.invoiceCount} NFS-e)`,
        tomador: "Prefeitura",
        vencimento: null,
        isEstimate: true,
        valor: inv.totalEstimated - inv.federalTotal,
      },
    ];
    if (inv.federalTotal > 0) {
      rows.push({ id: "imposto-fed", descricao: "Retenções federais", tomador: "Receita Federal", vencimento: null, isEstimate: true, valor: inv.federalTotal });
    }
    return rows;
  }, [impostos]);

  const folhaRows: ForecastRow[] = useMemo(() => {
    if (!folha?.available) return [];
    return [
      { id: "folha-bruto", descricao: `Folha (com bonificação) — ${folha.employeeCount} colaboradores`, tomador: "Colaboradores", vencimento: null, valor: folha.total },
      { id: "folha-bonus", descricao: "Das quais bonificações", tomador: null, vencimento: null, valor: folha.bonusTotal },
      { id: "folha-liq", descricao: "Total líquido", tomador: null, vencimento: null, valor: folha.netTotal },
    ];
  }, [folha]);

  const folhaProgRows: ForecastRow[] = useMemo(() => {
    if (!folhaProgramada || folhaProgramada.total <= 0) return [];
    const rows: ForecastRow[] = [];
    if (folhaProgramada.thirteenth.firstInstallmentNovember > 0)
      rows.push({ id: "13-1", descricao: "13º — 1ª parcela (nov)", tomador: "Colaboradores", vencimento: null, isForecastDate: true, valor: folhaProgramada.thirteenth.firstInstallmentNovember });
    if (folhaProgramada.thirteenth.secondInstallmentDecember > 0)
      rows.push({ id: "13-2", descricao: "13º — 2ª parcela (dez)", tomador: "Colaboradores", vencimento: null, isForecastDate: true, valor: folhaProgramada.thirteenth.secondInstallmentDecember });
    if (folhaProgramada.vacation.dueThisMonth > 0)
      rows.push({ id: "fer", descricao: `Férias (${folhaProgramada.vacation.recordCount} recibos)`, tomador: "Colaboradores", vencimento: null, isForecastDate: true, valor: folhaProgramada.vacation.dueThisMonth });
    return rows;
  }, [folhaProgramada]);

  const recorrenteRows: ForecastRow[] = useMemo(
    () =>
      (recorrentes?.items ?? []).map((item) => ({
        id: `rec-${item.category.id}`,
        descricao: item.category.name,
        tomador: null,
        vencimento: item.paymentDate ?? null,
        isForecastDate: item.isPaymentDateForecast,
        isEstimate: true,
        color: item.category.color,
        badge: item.status === "PAID" ? "Pago" : null,
        valor: item.forecastAmount,
        linkTo: `${routes.financial.reconciliation.transactions}?categoryIds=${item.category.id}`,
      })),
    [recorrentes],
  );

  // Search-filtered section rows (pedidoRows is already filtered via matchedOrders).
  const fAgendamento = agendamentoRows.filter(rowMatches);
  const fImposto = impostoRows.filter(rowMatches);
  const fFolha = folhaRows.filter(rowMatches);
  const fFolhaProg = folhaProgRows.filter(rowMatches);
  const fRecorrente = recorrenteRows.filter(rowMatches);

  const onRowClick = (r: ForecastRow) => {
    if (r.linkTo) navigate(r.linkTo);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Previsão de Saídas"
          icon={IconTrendingDown}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Previsão de Saídas" },
          ]}
          className="flex-shrink-0"
        />

        {/* Composite month total + the slices that build it. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard
            label="Total previsto no mês"
            value={isLoading || !data ? null : formatCurrency(data.total)}
            Icon={IconTrendingDown}
            tone="text-red-600 bg-red-500/10"
            hint="Pedidos em aberto + impostos (aprox.) + folha + folha programada (13º e férias) + recorrentes"
          />
          <KpiCard label="Pedidos em aberto" value={isLoading || !pedidos ? null : formatCurrency(pedidos.totalOpen)} Icon={IconPackage} tone="text-amber-600 bg-amber-500/10" />
          <KpiCard
            label="Impostos (estimado)"
            value={isLoading || !impostos ? null : formatCurrency(impostos.invoicedServices?.totalEstimated ?? 0)}
            Icon={IconReceiptTax}
            tone="text-violet-600 bg-violet-500/10"
            hint="Estimado sobre o faturamento do mês (NFS-e emitidas)"
          />
          <KpiCard
            label="Folha (com bonificação)"
            value={isLoading || !folha ? null : folha.available ? formatCurrency(folha.total) : "Indisponível"}
            Icon={IconUsers}
            tone="text-blue-600 bg-blue-500/10"
          />
          <KpiCard
            label="Folha programada (13º e férias)"
            value={isLoading || !folhaProgramada ? null : formatCurrency(folhaProgramada.total)}
            Icon={IconGift}
            tone="text-pink-600 bg-pink-500/10"
            hint="13º (parcela do mês) + recibos de férias com vencimento no mês"
          />
          <KpiCard
            label="Recorrentes"
            value={isLoading || !recorrentes ? null : formatCurrency(recorrentes.totalForecast)}
            Icon={IconCalendarRepeat}
            tone="text-emerald-600 bg-emerald-500/10"
          />
        </div>

        {/* Period selector + search live here (main content), not the page header. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
          <div className="flex flex-1 min-w-0">
            <TableSearchInput value={searchText} onChange={setSearchText} placeholder="Buscar por descrição ou tomador..." />
          </div>
          <MonthNav month={month} onChange={setMonth} className="flex-shrink-0" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-6 space-y-4">
          {/* (a) Pedidos em aberto */}
          {(isLoading || pedidoRows.length > 0) && (
            <ForecastSectionCard
              title="Pedidos — em aberto"
              Icon={IconPackage}
              link={{ to: routes.financial.accountsPayable.root, label: "Ver Contas a Pagar" }}
              columns={forecastColumns}
              rows={pedidoRows}
              isLoading={isLoading}
              onRowClick={onRowClick}
              footer={
                hiddenOrderCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Mostrando os {displayedOrders.length} pedidos de maior valor — {hiddenOrderCount} pedido(s) menores somam no total acima. Lista completa em{" "}
                    <Link to={routes.financial.accountsPayable.root} className="text-primary hover:underline">
                      Contas a Pagar
                    </Link>
                    .
                  </p>
                ) : undefined
              }
            />
          )}

          {/* (a2) Pedidos agendados (recorrentes) */}
          {fAgendamento.length > 0 && (
            <ForecastSectionCard
              title="Pedidos agendados (recorrentes)"
              Icon={IconCalendarRepeat}
              hint="Valor estimado pela previsão — vira pedido real quando o agendamento é executado."
              columns={forecastColumns}
              rows={fAgendamento}
              isLoading={isLoading}
            />
          )}

          {/* (b) Impostos */}
          {(isLoading || fImposto.length > 0) && (
            <ForecastSectionCard
              title="Impostos — estimado sobre faturamento"
              Icon={IconReceiptTax}
              hint="Estimativa sobre o faturamento do mês (NFS-e emitidas). Não substitui a apuração contábil."
              columns={forecastColumns}
              rows={fImposto}
              isLoading={isLoading}
            />
          )}

          {/* (c) Folha */}
          {(isLoading || fFolha.length > 0) && (
            <ForecastSectionCard
              title="Folha de pagamento (com bonificação)"
              Icon={IconUsers}
              hint="Total agregado da competência — sem detalhamento individual nesta página."
              columns={forecastColumns}
              rows={fFolha}
              isLoading={isLoading}
            />
          )}

          {/* (c2) Folha programada (13º e férias) */}
          {fFolhaProg.length > 0 && (
            <ForecastSectionCard
              title="Folha programada (13º e férias)"
              Icon={IconGift}
              hint="Aditiva à folha mensal — só a parcela com vencimento neste mês entra no total."
              columns={forecastColumns}
              rows={fFolhaProg}
              isLoading={isLoading}
            />
          )}

          {/* (d) Recorrentes e afins */}
          {fRecorrente.length > 0 && (
            <ForecastSectionCard
              title="Recorrentes e afins"
              Icon={IconCalendarRepeat}
              link={{ to: routes.financial.reconciliation.recurring, label: "Ver Recorrentes" }}
              hint={
                "Categorias recorrentes da conciliação (média dos últimos 3 meses)." +
                ((recorrentes?.excludedCount ?? 0) > 0
                  ? ` ${recorrentes!.excludedCount} categoria(s) de impostos/folha já contam acima e foram excluídas.`
                  : "") +
                (learned && learned.itemCount > 0 ? ` Recorrência aprendida: ${formatCurrency(learned.expectedMonthlyTotal)}/mês — comparativo, não soma no total.` : "")
              }
              columns={forecastColumns}
              rows={fRecorrente}
              isLoading={isLoading}
              onRowClick={onRowClick}
            />
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
};

function ForecastSectionCard({
  title,
  Icon,
  columns,
  rows,
  isLoading,
  hint,
  link,
  footer,
  onRowClick,
}: {
  title: string;
  Icon: typeof IconCheck;
  columns: StandardizedColumn<ForecastRow>[];
  rows: ForecastRow[];
  isLoading: boolean;
  hint?: string;
  link?: { to: string; label: string };
  footer?: ReactNode;
  onRowClick?: (r: ForecastRow) => void;
}) {
  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            {title}
          </CardTitle>
          {link && (
            <Link to={link.to} className="text-sm text-primary hover:underline">
              {link.label}
            </Link>
          )}
        </div>
        {hint && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-1">
            <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            {hint}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <StandardizedTable<ForecastRow>
          columns={columns}
          data={rows}
          getItemKey={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="Sem lançamentos"
          onRowClick={onRowClick}
        />
        {footer}
      </CardContent>
    </Card>
  );
}

export default ReconciliationOutflowForecastPage;
