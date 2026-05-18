import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import {
  IconArrowsExchange2,
  IconCheck,
  IconClockHour4,
  IconReceipt,
  IconUpload,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import { useChartTheme } from "@/hooks/common/use-chart-theme";
import { useReconciliationStatistics } from "@/hooks/financial/use-reconciliation";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { FAVORITE_PAGES, routes } from "@/constants";
import { formatCurrency, formatDate } from "@/utils";
import type {
  MatchType,
  ReconciliationStatistics,
} from "@/types/reconciliation";

const PERIOD_OPTIONS = [
  { value: "1", label: "Último mês" },
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Último ano" },
];

const MATCH_TYPE_COLORS: Record<MatchType, string> = {
  EXACT: "#10b981",
  VALUE_DATE: "#3b82f6",
  FUZZY: "#a855f7",
  MANUAL: "#f59e0b",
  BANK_SLIP_BRIDGE: "#06b6d4",
};

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  EXACT: "Exato",
  VALUE_DATE: "Valor + Data",
  FUZZY: "Aproximação",
  MANUAL: "Manual",
  BANK_SLIP_BRIDGE: "Boleto",
};

export const ReconciliationStatisticsPage = () => {
  usePageTracker({ title: "Conciliação - Estatísticas", icon: "arrows-exchange" });
  const navigate = useNavigate();
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useReconciliationStatistics({ months });

  // dateFrom param shared by the period-scoped KPI drill-downs. Always passes
  // the start of the selected period; statement-period filter on the list page
  // applies the same window the chart shows.
  const periodFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }, [months]);

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Conciliação Bancária"
          icon={IconArrowsExchange2}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_CONCILIACAO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estatísticas", href: routes.statistics.root },
            { label: "Financeiro", href: routes.statistics.financial.root },
            { label: "Conciliação Bancária" },
          ]}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto pb-4 min-h-0 gap-4 mt-4">
        <Card className="flex-shrink-0">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">Período:</span>
            <div className="w-64">
              <Combobox
                value={String(months)}
                onValueChange={v => setMonths(Number(v ?? "6"))}
                options={PERIOD_OPTIONS}
                searchable={false}
                clearable={false}
              />
            </div>
          </CardContent>
        </Card>

        <SummaryGrid stats={data} isLoading={isLoading} periodFrom={periodFrom} />

        <Card>
          <CardHeader>
            <CardTitle>Conciliação ao longo do tempo</CardTitle>
            <CardDescription>
              Volume conciliado vs pendente por mês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <MatchProgressChart data={data?.matchedOverTime ?? []} />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Maiores pendências por contraparte</CardTitle>
              <CardDescription>
                Top 10 contrapartes com transações ainda não conciliadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <UnmatchedByCounterpartyChart
                  data={data?.topUnmatchedByCounterparty ?? []}
                  onBarClick={counterparty =>
                    navigate(
                      `${routes.financial.reconciliation.transactions}?matchStatus=UNMATCHED&counterparty=${encodeURIComponent(counterparty)}`,
                    )
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por tipo de conciliação</CardTitle>
              <CardDescription>
                Como as conciliações estão sendo feitas no período.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <MatchTypeDistributionChart
                  data={
                    data?.matchTypeDistribution ?? {
                      EXACT: 0,
                      VALUE_DATE: 0,
                      FUZZY: 0,
                      MANUAL: 0,
                      BANK_SLIP_BRIDGE: 0,
                    }
                  }
                  onSliceClick={matchType =>
                    navigate(
                      `${routes.financial.reconciliation.transactions}?matchType=${matchType}`,
                    )
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function SummaryGrid({
  stats,
  isLoading,
  periodFrom,
}: {
  stats: ReconciliationStatistics | undefined;
  isLoading: boolean;
  periodFrom: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        label="Conciliado este mês"
        value={isLoading ? null : formatCurrency(stats?.totalConciliadoMes ?? 0)}
        Icon={IconCheck}
        tone="emerald"
        href={`${routes.financial.reconciliation.transactions}?matchStatus=AUTO_MATCHED`}
      />
      <KpiCard
        label="Pendente de conciliação"
        value={isLoading ? null : formatCurrency(stats?.pendenteConciliacao ?? 0)}
        Icon={IconClockHour4}
        tone="amber"
        href={`${routes.financial.reconciliation.transactions}?matchStatus=UNMATCHED`}
      />
      <KpiCard
        label="Notas recebidas"
        value={isLoading ? null : String(stats?.notasRecebidas ?? 0)}
        Icon={IconReceipt}
        tone="blue"
        href={`${routes.financial.reconciliation.fiscalDocuments}?dateFrom=${periodFrom}`}
      />
      <KpiCard
        label="Última importação"
        value={
          isLoading
            ? null
            : stats?.ultimaImportacao
              ? formatDate(stats.ultimaImportacao)
              : "—"
        }
        Icon={IconUpload}
        tone="sky"
        href={routes.financial.reconciliation.statements}
      />
    </div>
  );
}

const TONE_STYLES: Record<"emerald" | "amber" | "blue" | "sky", string> = {
  emerald: "text-emerald-600 bg-emerald-500/10",
  amber: "text-amber-600 bg-amber-500/10",
  blue: "text-blue-600 bg-blue-500/10",
  sky: "text-sky-600 bg-sky-500/10",
};

function KpiCard({
  label,
  value,
  Icon,
  tone,
  href,
}: {
  label: string;
  value: string | null;
  Icon: typeof IconCheck;
  tone: "emerald" | "amber" | "blue" | "sky";
  href?: string;
}) {
  const body = (
    <CardContent className="flex items-center gap-3 p-4">
      <div className={`p-2 rounded-lg ${TONE_STYLES[tone]}`}>
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
  );
  if (href) {
    return (
      <Link to={href} className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-md">
        <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
          {body}
        </Card>
      </Link>
    );
  }
  return <Card>{body}</Card>;
}

function MatchProgressChart({
  data,
}: {
  data: Array<{ period: string; matched: number; unmatched: number }>;
}) {
  const theme = useChartTheme();
  return (
    <ReactECharts
      style={{ height: 320 }}
      option={{
        backgroundColor: "transparent",
        textStyle: { color: theme.textColor },
        tooltip: {
          trigger: "axis",
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          textStyle: { color: theme.textColor },
          valueFormatter: (v: number) => formatCurrency(v),
        },
        legend: { textStyle: { color: theme.subTextColor }, top: 0 },
        grid: { left: 70, right: 20, top: 32, bottom: 24 },
        xAxis: {
          type: "category",
          data: data.map(d => d.period),
          axisLine: { lineStyle: { color: theme.axisLineColor } },
          axisLabel: { color: theme.subTextColor },
        },
        yAxis: {
          type: "value",
          axisLine: { lineStyle: { color: theme.axisLineColor } },
          axisLabel: { color: theme.subTextColor },
          splitLine: { lineStyle: { color: theme.gridLineColor, type: "dashed" } },
        },
        series: [
          {
            name: "Conciliado",
            type: "line",
            stack: "total",
            areaStyle: { color: "rgba(16, 185, 129, 0.35)" },
            itemStyle: { color: "#10b981" },
            data: data.map(d => d.matched),
            smooth: true,
          },
          {
            name: "Pendente",
            type: "line",
            stack: "total",
            areaStyle: { color: "rgba(245, 158, 11, 0.35)" },
            itemStyle: { color: "#f59e0b" },
            data: data.map(d => d.unmatched),
            smooth: true,
          },
        ],
      }}
    />
  );
}

function UnmatchedByCounterpartyChart({
  data,
  onBarClick,
}: {
  data: Array<{ counterparty: string; amount: number; count: number }>;
  onBarClick?: (counterparty: string) => void;
}) {
  const theme = useChartTheme();
  return (
    <ReactECharts
      style={{ height: 320 }}
      onEvents={{
        click: (params: { dataIndex?: number }) => {
          const idx = params.dataIndex;
          if (idx === undefined || !onBarClick) return;
          const row = data[idx];
          if (row) onBarClick(row.counterparty);
        },
      }}
      option={{
        backgroundColor: "transparent",
        textStyle: { color: theme.textColor },
        tooltip: {
          trigger: "axis",
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          textStyle: { color: theme.textColor },
          valueFormatter: (v: number) => formatCurrency(v),
        },
        grid: { left: 140, right: 20, top: 16, bottom: 24 },
        xAxis: {
          type: "value",
          axisLine: { lineStyle: { color: theme.axisLineColor } },
          axisLabel: { color: theme.subTextColor },
          splitLine: { lineStyle: { color: theme.gridLineColor, type: "dashed" } },
        },
        yAxis: {
          type: "category",
          data: data.map(d => d.counterparty.slice(0, 30)),
          axisLine: { lineStyle: { color: theme.axisLineColor } },
          axisLabel: { color: theme.subTextColor },
        },
        series: [
          {
            type: "bar",
            data: data.map(d => d.amount),
            itemStyle: { color: "#f43f5e" },
          },
        ],
      }}
    />
  );
}

function MatchTypeDistributionChart({
  data,
  onSliceClick,
}: {
  data: Record<MatchType, number>;
  onSliceClick?: (matchType: MatchType) => void;
}) {
  const theme = useChartTheme();
  const orderedKeys = Object.keys(data) as MatchType[];
  const entries = orderedKeys.map(k => ({
    value: data[k],
    name: MATCH_TYPE_LABELS[k],
    itemStyle: { color: MATCH_TYPE_COLORS[k] },
  }));

  return (
    <ReactECharts
      style={{ height: 320 }}
      onEvents={{
        click: (params: { dataIndex?: number }) => {
          const idx = params.dataIndex;
          if (idx === undefined || !onSliceClick) return;
          const key = orderedKeys[idx];
          if (key) onSliceClick(key);
        },
      }}
      option={{
        backgroundColor: "transparent",
        textStyle: { color: theme.textColor },
        tooltip: {
          trigger: "item",
          backgroundColor: theme.tooltipBg,
          borderColor: theme.tooltipBorder,
          textStyle: { color: theme.textColor },
        },
        legend: {
          orient: "vertical",
          right: 8,
          textStyle: { color: theme.subTextColor },
        },
        series: [
          {
            type: "pie",
            radius: ["50%", "70%"],
            center: ["35%", "50%"],
            label: { show: false },
            data: entries,
          },
        ],
      }}
    />
  );
}

export default ReconciliationStatisticsPage;
