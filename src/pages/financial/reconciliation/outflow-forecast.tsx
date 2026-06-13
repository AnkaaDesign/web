import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  IconCalendarRepeat,
  IconCheck,
  IconClockHour4,
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
  OutflowForecastTaxRow,
  RecurringForecastItem,
} from "@/types/reconciliation";

/** Max open-order rows rendered on this composite page (full list lives in
 *  Contas a Pagar). Totals always cover every open order. */
const ORDER_DISPLAY_CAP = 50;

/** "2026-03" → "mar/26" for the tax-basis column headers. */
function shortMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
  return `${label.replace(".", "")}/${String(y).slice(-2)}`;
}

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
      ],
      [],
    );

  const lookbackMonths = data?.impostos.lookbackMonths ?? [];
  const taxColumns: StandardizedColumn<OutflowForecastTaxRow>[] = useMemo(
    () => [
      {
        key: "category",
        header: "Categoria",
        render: t => (
          <div className="flex items-center gap-2 min-w-0">
            {t.category.color && (
              <span
                className="h-3 w-3 rounded-full flex-shrink-0 border border-border"
                style={{ backgroundColor: t.category.color }}
              />
            )}
            <span className="truncate text-sm font-medium">{t.category.name}</span>
          </div>
        ),
      },
      ...lookbackMonths.map((m, idx) => ({
        key: `m-${m}`,
        header: shortMonthLabel(m),
        width: "120px",
        align: "right" as const,
        render: (t: OutflowForecastTaxRow) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {formatCurrency(t.perMonth[idx]?.amount ?? 0)}
          </span>
        ),
      })),
      {
        key: "average",
        header: "Média mensal",
        width: "150px",
        align: "right",
        render: t => (
          <span className="font-semibold tabular-nums text-sm">
            {formatCurrency(t.monthlyAverage)}
          </span>
        ),
      },
      {
        key: "paid",
        header: "Pago no mês",
        width: "140px",
        align: "right",
        render: t => (
          <span
            className={cn(
              "tabular-nums text-sm",
              t.paidThisMonth > 0 ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {formatCurrency(t.paidThisMonth)}
          </span>
        ),
      },
    ],
    [lookbackMonths],
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
            {
              label: "Conciliação Bancária",
              href: routes.financial.reconciliation.root,
            },
            { label: "Previsão de Saídas" },
          ]}
          headerExtra={<MonthNav month={month} onChange={setMonth} />}
          className="flex-shrink-0"
        />

        {/* Composite month total + the four slices that build it. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Total previsto no mês"
            value={isLoading || !data ? null : formatCurrency(data.total)}
            Icon={IconTrendingDown}
            tone="text-red-600 bg-red-500/10"
            hint="Pedidos em aberto + impostos (aprox.) + folha + recorrentes"
          />
          <KpiCard
            label="Pedidos em aberto"
            value={isLoading || !pedidos ? null : formatCurrency(pedidos.totalOpen)}
            Icon={IconPackage}
            tone="text-amber-600 bg-amber-500/10"
          />
          <KpiCard
            label="Impostos (aprox.)"
            value={
              isLoading || !impostos ? null : formatCurrency(impostos.totalForecast)
            }
            Icon={IconReceiptTax}
            tone="text-violet-600 bg-violet-500/10"
            hint="Média dos últimos 3 meses"
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
                    Pedidos agendados para o mês (valor definido na geração)
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
                Impostos e tarifas — cálculo aproximado
              </CardTitle>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground pt-1">
                <IconInfoCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Base transparente: média simples das saídas classificadas como
                Impostos/Tarifas nos últimos 3 meses (
                {lookbackMonths.map(shortMonthLabel).join(", ")}). Não substitui a
                apuração contábil.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <StandardizedTable<OutflowForecastTaxRow>
                columns={taxColumns}
                data={impostos?.items ?? []}
                getItemKey={t => t.category.id}
                isLoading={isLoading}
                emptyMessage="Nenhuma saída classificada como imposto/tarifa nos últimos meses"
                emptyIcon={IconReceiptTax}
                onRowClick={t =>
                  navigate(
                    `${routes.financial.reconciliation.transactions}?categoryIds=${t.category.id}`,
                  )
                }
              />
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
              {isLoading || !folha ? (
                <Skeleton className="h-20 w-full" />
              ) : !folha.available ? (
                <p className="text-sm text-muted-foreground">
                  Não foi possível calcular a folha desta competência no momento.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatBlock
                    label="Total bruto (com bonificação)"
                    value={formatCurrency(folha.total)}
                    emphasized
                  />
                  <StatBlock
                    label="Das quais bonificações"
                    value={formatCurrency(folha.bonusTotal)}
                  />
                  <StatBlock
                    label="Total líquido"
                    value={formatCurrency(folha.netTotal)}
                  />
                  <StatBlock
                    label="Colaboradores"
                    value={String(folha.employeeCount)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

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

function StatBlock({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="bg-muted/50 rounded-lg px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular-nums font-semibold",
          emphasized ? "text-lg" : "text-base",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default ReconciliationOutflowForecastPage;
