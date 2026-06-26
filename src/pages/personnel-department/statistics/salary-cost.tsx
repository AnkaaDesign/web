import { useMemo, useState } from "react";
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconFilter,
  IconRefresh,
  IconAlertCircle,
  IconBuilding,
  IconCalendarStats,
  IconCoin,
  IconUsers,
  IconReportMoney,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { StatisticsChart } from "@/components/statistics/statistics-chart";
import type { StatisticsChartType } from "@/types/statistics-common";
import { formatCurrency, formatNumber } from "@/types/statistics-common";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useSalaryCostAnalytics } from "@/hooks/personnel-department/use-hr-analytics";
import { useSectors } from "@/hooks/administration/use-sector";
import type { HeadcountFilters } from "@/types/hr-analytics";

const CHART_TYPE_OPTIONS: { value: StatisticsChartType; label: string; icon: React.ElementType }[] = [
  { value: "area", label: "Área", icon: IconChartArea },
  { value: "line", label: "Linha", icon: IconChartLine },
  { value: "bar", label: "Barra", icon: IconChartBar },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, index) => {
  const year = currentYear - index;
  return { value: String(year), label: String(year) };
});

const SalaryCostStatisticsContent = () => {
  usePageTracker({ title: "Custo de Folha ao Longo do Tempo", icon: "coin" });

  const [year, setYear] = useState<string>(String(currentYear));
  const [sectorIds, setSectorIds] = useState<string[]>([]);
  const [chartType, setChartType] = useState<StatisticsChartType>("area");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: sectorsData } = useSectors({ limit: 100, orderBy: { name: "asc" } });
  const sectorOptions = useMemo(
    () => (sectorsData?.data || []).map((sector) => ({ value: sector.id, label: sector.name })),
    [sectorsData?.data],
  );

  const filters = useMemo<HeadcountFilters>(() => {
    const numericYear = Number(year);
    return {
      startDate: new Date(numericYear, 0, 1),
      endDate: new Date(numericYear, 11, 31, 23, 59, 59),
      sectorIds: sectorIds.length > 0 ? sectorIds : undefined,
    };
  }, [year, sectorIds]);

  const { data, isLoading, isError, refetch, isFetching } = useSalaryCostAnalytics(filters);

  const timeseries = data?.data?.timeseries || [];
  const summary = data?.data?.summary;

  // Custo histórico: cada ponto usa o salário que cada colaborador TINHA naquele
  // período (UserPositionHistory × valor do cargo na data).
  const chartData = useMemo(
    () =>
      timeseries.map((item) => ({
        name: item.label,
        value: item.monthlyCost,
        secondaryValue: item.headcount,
      })),
    [timeseries],
  );

  const hasUnresolved = useMemo(() => timeseries.some((item) => item.unresolvedCount > 0), [timeseries]);

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Custo de Folha ao Longo do Tempo"
          icon={IconReportMoney}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estatísticas", href: routes.statistics.root },
            { label: "Departamento Pessoal", href: routes.statistics.personnelDepartment.root },
            { label: "Custo de Folha" },
          ]}
          actions={[
            {
              key: "filters",
              label: "Filtros",
              icon: IconFilter,
              onClick: () => setFiltersOpen(true),
              variant: "outline" as const,
            },
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: "outline" as const,
              disabled: isFetching,
            },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6 space-y-4 mt-4">
        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconCoin className="h-4 w-4" />
                Custo Mensal Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold">{formatCurrency(summary?.currentMonthlyCost ?? 0)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconReportMoney className="h-4 w-4" />
                Custo Médio no Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold">{formatCurrency(summary?.averageMonthlyCost ?? 0)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconCalendarStats className="h-4 w-4" />
                Períodos Analisados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{formatNumber(summary?.periodCount ?? 0)}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <IconChartLine className="h-5 w-5 text-muted-foreground" />
              Evolução do Custo de Folha — {year}
            </CardTitle>
            <div className="w-40">
              <Combobox
                mode="single"
                value={chartType}
                onValueChange={(value) => typeof value === "string" && value && setChartType(value as StatisticsChartType)}
                options={CHART_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                searchable={false}
                clearable={false}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <IconAlertCircle className="h-10 w-10 mb-2" />
                <p>Não foi possível carregar o custo de folha.</p>
                <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : isLoading ? (
              <Skeleton className="h-[420px] w-full" />
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <IconChartBar className="h-10 w-10 mb-2" />
                <p>Sem dados de custo de folha para o período selecionado.</p>
              </div>
            ) : (
              <>
                {hasUnresolved && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                    <IconAlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Alguns colaboradores não tiveram o salário histórico resolvido em determinados períodos (sem cargo/valor registrado na
                      data). Esses valores foram ignorados no total.
                    </span>
                  </div>
                )}
                <StatisticsChart
                  data={chartData}
                  chartType={chartType}
                  yAxisMode="value"
                  isComparisonMode={false}
                  height="420px"
                  yAxisLabel="Custo mensal"
                  tooltipLabels={{ primary: "Custo mensal", secondary: "Colaboradores" }}
                  secondaryValueFormatter={(value) => `${formatNumber(value)} colaborador(es)`}
                  trendLine="sma3"
                  xAxisKind="temporal"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters drawer */}
      <FilterDrawer open={filtersOpen} onOpenChange={setFiltersOpen} title="Filtros">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconCalendarStats className="h-4 w-4" />
              Ano
            </Label>
            <Combobox
              mode="single"
              value={year}
              onValueChange={(value) => typeof value === "string" && value && setYear(value)}
              options={YEAR_OPTIONS}
              searchable={false}
              clearable={false}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Setores
            </Label>
            <Combobox
              mode="multiple"
              value={sectorIds}
              onValueChange={(value) => setSectorIds((value as string[]) || [])}
              options={sectorOptions}
              placeholder="Todos os setores"
              emptyText="Nenhum setor encontrado"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconUsers className="h-4 w-4" />
              Tipo de Gráfico
            </Label>
            <Combobox
              mode="single"
              value={chartType}
              onValueChange={(value) => typeof value === "string" && value && setChartType(value as StatisticsChartType)}
              options={CHART_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              searchable={false}
              clearable={false}
            />
          </div>
        </div>
      </FilterDrawer>
    </div>
  );
};

export const SalaryCostStatisticsPage = () => (
  <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
    <SalaryCostStatisticsContent />
  </PrivilegeRoute>
);

export default SalaryCostStatisticsPage;
