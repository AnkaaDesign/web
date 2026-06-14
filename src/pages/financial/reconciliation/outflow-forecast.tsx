import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  IconCalendarRepeat,
  IconCheck,
  IconClockHour4,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  StandardizedTable,
  type StandardizedColumn,
} from "@/components/ui/standardized-table";
import { OrderPaymentStatusBadge } from "@/components/inventory/order/common/order-payment-status-badge";
import {
  MonthNav,
  monthKey,
  parseMonthKey,
} from "@/components/financial/reconciliation/month-nav";
import { useOutflowForecast } from "@/hooks/financial/use-reconciliation";
import { useOrderScheduleExpectedTotals } from "@/hooks/inventory/use-order-schedule";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import {
  ORDER_PAYMENT_STATUS,
  ORDER_PAYMENT_STATUS_LABELS,
  SECTOR_PRIVILEGES,
  routes,
} from "@/constants";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils";
import type {
  OutflowForecastOrderRow,
  OutflowForecastScheduleRow,
  RecurringForecastItem,
} from "@/types/reconciliation";

/** Max open-order rows rendered on this composite page (full list lives in
 *  Contas a Pagar). Totals always cover every open order. */
const ORDER_DISPLAY_CAP = 50;

/** A simple label/value row for the aggregate (folha) tables. */
type KvRow = { id: string; label: string; value: string; emphasized?: boolean };

/**
 * Previsão de Saídas (spec §4.3) — composite forward view for one competence
 * month: pedidos (contas a pagar + agendamentos), impostos (média transparente
 * dos últimos 3 meses), folha com bonificação (agregado) e recorrentes. All
 * composition happens server-side in GET /financial/reconciliation/outflow-forecast.
 */
export const ReconciliationOutflowForecastPage = () => {
  usePageTracker({ title: "Previsão de Saídas", icon: "trending-down" });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState<Date>(
    () => parseMonthKey(searchParams.get("mes")) ?? new Date(),
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("mes", monthKey(month));
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const { data, isLoading } = useOutflowForecast(monthKey(month));

  const orderColumns: StandardizedColumn<OutflowForecastOrderRow>[] = useMemo(
    () => [
      {
        key: "order",
        header: "Pedido",
        render: o => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {o.orderNumber ? `#${o.orderNumber} — ` : ""}
              {o.description}
            </p>
          </div>
        ),
      },
      {
        key: "supplier",
        header: "Fornecedor",
        width: "220px",
        render: o => (
          <span className="truncate text-sm block">{o.supplierName ?? "—"}</span>
        ),
      },
      {
        key: "paymentStatus",
        header: "Pagamento",
        width: "180px",
        align: "center",
        render: o => (
          <OrderPaymentStatusBadge
            status={o.paymentStatus as ORDER_PAYMENT_STATUS}
            size="sm"
          />
        ),
      },
      {
        key: "forecast",
        header: "Previsão de entrega",
        width: "160px",
        align: "center",
        render: o =>
          o.forecast ? (
            <span className="tabular-nums text-sm">{formatDate(o.forecast)}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "total",
        header: "Valor",
        width: "150px",
        align: "right",
        render: o => (
          <span className="font-semibold tabular-nums text-sm">
            {formatCurrency(o.total)}
          </span>
        ),
      },
    ],
    [],
  );

  // Expected value per scheduled order (recomputed from the forecast calculation).
  // Declared before scheduleColumns since the column reads from this map.
  const scheduleIds = useMemo(
    () => (data?.pedidos?.schedules ?? []).map(s => s.id),
    [data],
  );
  const { data: expectedTotalsResp } = useOrderScheduleExpectedTotals(scheduleIds, {
    enabled: scheduleIds.length > 0,
  });
  const expectedByScheduleId = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expectedTotalsResp?.data ?? []) map.set(e.id, e.expectedTotal);
    return map;
  }, [expectedTotalsResp]);

  const scheduleColumns: StandardizedColumn<OutflowForecastScheduleRow>[] =
    useMemo(
      () => [
        {
          key: "name",
          header: "Agendamento",
          render: s => (
            <span className="truncate text-sm font-medium block">
              {s.name || "Agendamento de pedido"}
            </span>
          ),
        },
        {
          key: "supplier",
          header: "Fornecedor",
          width: "220px",
          render: s => (
            <span className="truncate text-sm block">{s.supplierName ?? "—"}</span>
          ),
        },
        {
          key: "nextRun",
          header: "Próxima execução",
          width: "160px",
          align: "center",
          render: s =>
            s.nextRun ? (
              <span className="tabular-nums text-sm">{formatDate(s.nextRun)}</span>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            ),
        },
        {
          key: "items",
          header: "Itens",
          width: "100px",
          align: "center",
          render: s => <span className="tabular-nums text-sm">{s.itemCount}</span>,
        },
        {
          key: "expected",
          header: "Valor estimado",
          width: "150px",
          align: "right",
          render: s => {
            const v = expectedByScheduleId.get(s.id);
            return v != null ? (
              <span className="tabular-nums text-sm font-medium">{formatCurrency(v)}</span>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            );
          },
        },
      ],
      [expectedByScheduleId],
    );

  // Shared label/value columns for the aggregate (folha / folha programada) tables,
  // so they match the look of the other StandardizedTables on the page.
  const kvColumns: StandardizedColumn<KvRow>[] = useMemo(
    () => [
      {
        key: "label",
        header: "Item",
        render: r => (
          <span className={cn("text-sm", r.emphasized && "font-semibold")}>{r.label}</span>
        ),
      },
      {
        key: "value",
        header: "Valor",
        align: "right",
        render: r => (
          <span className={cn("tabular-nums text-sm", r.emphasized && "font-semibold")}>
            {r.value}
          </span>
        ),
      },
    ],
    [],
  );

  const recurringColumns: StandardizedColumn<RecurringForecastItem>[] = useMemo(
    () => [
      {
        key: "category",
        header: "Categoria",
        render: item => (
          <div className="flex items-center gap-2 min-w-0">
            {item.category.color && (
              <span
                className="h-3 w-3 rounded-full flex-shrink-0 border border-border"
                style={{ backgroundColor: item.category.color }}
              />
            )}
            <span className="truncate text-sm font-medium">
              {item.category.name}
            </span>
          </div>
        ),
      },
      {
        key: "paymentDate",
        header: "Data",
        width: "120px",
        render: item => {
          if (!item.paymentDate)
            return <span className="text-muted-foreground text-sm">—</span>;
          const label = formatDate(item.paymentDate);
          return item.isPaymentDateForecast ? (
            <span
              className="tabular-nums text-sm text-muted-foreground italic"
              title="Data prevista com base nos meses anteriores"
            >
              {label}
            </span>
          ) : (
            <span className="tabular-nums text-sm">{label}</span>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        width: "140px",
        align: "center",
        render: item =>
          item.status === "PAID" ? (
            <Badge variant="completed" size="sm">
              <IconCheck className="h-3 w-3 mr-1" /> Pago
            </Badge>
          ) : (
            <Badge variant="pending" size="sm">
              <IconClockHour4 className="h-3 w-3 mr-1" /> Pendente
            </Badge>
          ),
      },
      {
        key: "forecastAmount",
        header: "Previsão",
        width: "150px",
        align: "right",
        render: item => (
          <span
            className="font-semibold tabular-nums text-sm"
            title="Média dos últimos 3 meses"
          >
            {formatCurrency(item.forecastAmount)}
          </span>
        ),
      },
      {
        key: "paidAmount",
        header: "Pago no mês",
        width: "150px",
        align: "right",
        render: item => (
          <span
            className={cn(
              "tabular-nums text-sm",
              item.paidAmount > 0 ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {formatCurrency(item.paidAmount)}
          </span>
        ),
      },
    ],
    [],
  );

  const pedidos = data?.pedidos;
  // The pipeline can hold hundreds of open orders; this composite page shows
  // the biggest ones and points to Contas a Pagar for the full list. The
  // by-status totals above always cover ALL open orders.
  const displayedOrders = useMemo(() => {
    const all = pedidos?.orders ?? [];
    if (all.length <= ORDER_DISPLAY_CAP) return all;
    return [...all].sort((a, b) => b.total - a.total).slice(0, ORDER_DISPLAY_CAP);
  }, [pedidos]);
  const hiddenOrderCount = (pedidos?.orders.length ?? 0) - displayedOrders.length;
  const impostos = data?.impostos;
  const folha = data?.folha;
  const folhaProgramada = data?.folhaProgramada;
  const recorrentes = data?.recorrentes;
  const learned = data?.learned;

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
          title="Previsão de Saídas"
          icon={IconTrendingDown}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Previsão de Saídas" },
          ]}
          headerExtra={<MonthNav month={month} onChange={setMonth} />}
          className="flex-shrink-0"
        />

        {/* Composite month total + the four slices that build it. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard
            label="Total previsto no mês"
            value={isLoading || !data ? null : formatCurrency(data.total)}
            Icon={IconTrendingDown}
            tone="text-red-600 bg-red-500/10"
            hint="Pedidos em aberto + impostos (aprox.) + folha + folha programada (13º e férias) + recorrentes"
          />
          <KpiCard
            label="Pedidos em aberto"
            value={isLoading || !pedidos ? null : formatCurrency(pedidos.totalOpen)}
            Icon={IconPackage}
            tone="text-amber-600 bg-amber-500/10"
          />
          <KpiCard
            label="Impostos (estimado)"
            value={
              isLoading || !impostos
                ? null
                : formatCurrency(impostos.invoicedServices?.totalEstimated ?? 0)
            }
            Icon={IconReceiptTax}
            tone="text-violet-600 bg-violet-500/10"
            hint="Estimado sobre o faturamento do mês (NFS-e emitidas)"
          />
          <KpiCard
            label="Folha (com bonificação)"
            value={
              isLoading || !folha
                ? null
                : folha.available
                  ? formatCurrency(folha.total)
                  : "Indisponível"
            }
            Icon={IconUsers}
            tone="text-blue-600 bg-blue-500/10"
          />
          <KpiCard
            label="Folha programada (13º e férias)"
            value={
              isLoading || !folhaProgramada
                ? null
                : formatCurrency(folhaProgramada.total)
            }
            Icon={IconGift}
            tone="text-pink-600 bg-pink-500/10"
            hint="13º (parcela do mês) + recibos de férias com vencimento no mês"
          />
          <KpiCard
            label="Recorrentes"
            value={
              isLoading || !recorrentes
                ? null
                : formatCurrency(recorrentes.totalForecast)
            }
            Icon={IconCalendarRepeat}
            tone="text-emerald-600 bg-emerald-500/10"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-6 space-y-4">
          {/* (a) Pedidos */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <IconPackage className="h-5 w-5 text-muted-foreground" />
                  Pedidos — pipeline de pagamento
                </CardTitle>
                <Link
                  to={routes.financial.accountsPayable.root}
                  className="text-sm text-primary hover:underline"
                >
                  Ver Contas a Pagar
                </Link>
              </div>
              {pedidos && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {(
                    [
                      ORDER_PAYMENT_STATUS.NOT_REQUESTED,
                      ORDER_PAYMENT_STATUS.REQUESTED,
                      ORDER_PAYMENT_STATUS.AWAITING_PAYMENT,
                    ] as const
                  ).map(status => {
                    const bucket =
                      pedidos.byStatus[
                        status as keyof typeof pedidos.byStatus
                      ];
                    return (
                      <Badge key={status} variant="secondary" className="gap-1.5">
                        {ORDER_PAYMENT_STATUS_LABELS[status]}:
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(bucket?.total ?? 0)}
                        </span>
                        <span className="text-muted-foreground">
                          · {bucket?.count ?? 0}
                        </span>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <StandardizedTable<OutflowForecastOrderRow>
                columns={orderColumns}
                data={displayedOrders}
                getItemKey={o => o.id}
                isLoading={isLoading}
                emptyMessage="Nenhum pedido com pagamento em aberto"
                emptyIcon={IconPackage}
                onRowClick={o => navigate(routes.inventory.orders.details(o.id))}
              />
              {hiddenOrderCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando os {displayedOrders.length} pedidos de maior valor —{" "}
                  {hiddenOrderCount} pedido(s) menores somam no total acima. Veja a
                  lista completa em{" "}
                  <Link
                    to={routes.financial.accountsPayable.root}
                    className="text-primary hover:underline"
                  >
                    Contas a Pagar
                  </Link>
                  .
                </p>
              )}
              {(pedidos?.schedules.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Pedidos agendados para o mês (valor estimado pela previsão)
                  </p>
                  <StandardizedTable<OutflowForecastScheduleRow>
                    columns={scheduleColumns}
                    data={pedidos?.schedules ?? []}
                    getItemKey={s => s.id}
                    isLoading={isLoading}
                    emptyMessage="Nenhum agendamento no mês"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* (b) Impostos */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <IconReceiptTax className="h-5 w-5 text-muted-foreground" />
                Impostos — estimado sobre faturamento
              </CardTitle>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-1">
                <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Estimativa de impostos sobre o faturamento do mês (NFS-e emitidas).
                Não substitui a apuração contábil.
              </p>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Forward estimate (primary): taxes on services invoiced this month (NFS-e). */}
              {impostos?.invoicedServices && impostos.invoicedServices.invoiceCount > 0 && (
                <div className="rounded-md border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <IconReceiptTax className="h-4 w-4 text-violet-600" />
                    Impostos sobre serviços faturados (estimado):{" "}
                    <span className="tabular-nums">{formatCurrency(impostos.invoicedServices.totalEstimated)}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ISS {impostos.invoicedServices.issRatePercent}% sobre{" "}
                    {formatCurrency(impostos.invoicedServices.invoicedBase)} ({impostos.invoicedServices.invoiceCount}{" "}
                    {impostos.invoicedServices.invoiceCount === 1 ? "NFS-e" : "NFS-e"}) + retenções federais{" "}
                    {formatCurrency(impostos.invoicedServices.federalTotal)}. Estimativa informativa — não substitui a apuração contábil.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* (c) Folha */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <IconUsers className="h-5 w-5 text-muted-foreground" />
                Folha de pagamento (com bonificação)
              </CardTitle>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-1">
                <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Total agregado da competência — sem detalhamento individual nesta
                página.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {!isLoading && folha && !folha.available ? (
                <p className="text-sm text-muted-foreground">
                  Não foi possível calcular a folha desta competência no momento.
                </p>
              ) : (
                <StandardizedTable<KvRow>
                  columns={kvColumns}
                  data={
                    folha
                      ? [
                          { id: "bruto", label: "Total bruto (com bonificação)", value: formatCurrency(folha.total), emphasized: true },
                          { id: "bonus", label: "Das quais bonificações", value: formatCurrency(folha.bonusTotal) },
                          { id: "liquido", label: "Total líquido", value: formatCurrency(folha.netTotal) },
                          { id: "colab", label: "Colaboradores", value: String(folha.employeeCount) },
                        ]
                      : []
                  }
                  getItemKey={r => r.id}
                  isLoading={isLoading}
                />
              )}
            </CardContent>
          </Card>

          {/* (c2) Folha programada (13º e férias) — hidden when nothing is due this month */}
          {(folhaProgramada?.total ?? 0) > 0 && (
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <IconGift className="h-5 w-5 text-muted-foreground" />
                Folha programada (13º e férias)
              </CardTitle>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-1">
                <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Aditiva à folha mensal — sem sobreposição. Só a parcela com
                vencimento neste mês entra no total: 13º 1ª parcela em novembro,
                2ª parcela em dezembro, e recibos de férias com vencimento no mês.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading || !folhaProgramada ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-3">
                  <StandardizedTable<KvRow>
                    columns={kvColumns}
                    data={[
                      { id: "total", label: "Total previsto no mês", value: formatCurrency(folhaProgramada.total), emphasized: true },
                      { id: "n1", label: "13º — 1ª parcela (nov)", value: formatCurrency(folhaProgramada.thirteenth.firstInstallmentNovember) },
                      { id: "n2", label: "13º — 2ª parcela (dez)", value: formatCurrency(folhaProgramada.thirteenth.secondInstallmentDecember) },
                      { id: "fer", label: "Férias (recibos no mês)", value: formatCurrency(folhaProgramada.vacation.dueThisMonth) },
                    ]}
                    getItemKey={r => r.id}
                  />
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      13º no mês:{" "}
                      <strong className="tabular-nums">
                        {formatCurrency(folhaProgramada.thirteenth.dueThisMonth)}
                      </strong>{" "}
                      · {folhaProgramada.thirteenth.recordCount} colaborador(es)
                    </span>
                    <span>
                      Férias: {folhaProgramada.vacation.recordCount} recibo(s)
                    </span>
                    {(!folhaProgramada.thirteenth.available ||
                      !folhaProgramada.vacation.available) && (
                      <span className="text-amber-600">
                        Projeção parcial — alguma fonte indisponível.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* (d) Recorrentes e afins */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <IconCalendarRepeat className="h-5 w-5 text-muted-foreground" />
                  Recorrentes e afins
                </CardTitle>
                <Link
                  to={routes.financial.reconciliation.recurring}
                  className="text-sm text-primary hover:underline"
                >
                  Ver Recorrentes
                </Link>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-1">
                <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Categorias recorrentes da conciliação (média dos últimos 3 meses).
                {(recorrentes?.excludedCount ?? 0) > 0 &&
                  ` ${recorrentes!.excludedCount} categoria(s) de impostos/folha já contam nas seções acima e foram excluídas para não duplicar o total.`}
                {learned && learned.itemCount > 0 && (
                  <span>
                    {" "}
                    Recorrência aprendida (por contraparte):{" "}
                    <strong>{formatCurrency(learned.expectedMonthlyTotal)}</strong>
                    /mês em {learned.itemCount} cadência(s)
                    {learned.overdueCount > 0 &&
                      `, ${learned.overdueCount} atrasada(s)`}
                    {" — comparativo, não soma no total."}
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <StandardizedTable<RecurringForecastItem>
                columns={recurringColumns}
                data={recorrentes?.items ?? []}
                getItemKey={item => item.category.id}
                isLoading={isLoading}
                emptyMessage="Nenhuma categoria recorrente configurada"
                emptyIcon={IconCalendarRepeat}
                onRowClick={item =>
                  navigate(
                    `${routes.financial.reconciliation.transactions}?categoryIds=${item.category.id}`,
                  )
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

function KpiCard({
  label,
  value,
  Icon,
  tone,
  hint,
}: {
  label: string;
  value: string | null;
  Icon: typeof IconCheck;
  tone: string;
  hint?: string;
}) {
  return (
    <Card title={hint}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("p-2 rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {value === null ? (
            <Skeleton className="h-6 w-24 mt-1" />
          ) : (
            <p className="text-lg font-semibold truncate" title={value}>
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ReconciliationOutflowForecastPage;
