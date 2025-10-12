/**
 * HR Statistics Page
 *
 * Comprehensive HR analytics with:
 * - Employee overview and metrics
 * - Performance tracking
 * - Bonus analytics
 * - Payroll analysis
 * - Warning tracking
 * - Attendance patterns
 * - PPE analytics
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconUsers,
  IconUserPlus,
  IconTrendingUp,
  IconCurrencyDollar,
  IconAlertTriangle,
  IconChartBar,
  IconChartPie,
  IconCalendar,
  IconShield,
} from "@tabler/icons-react";
import {
  StatisticsPageLayout,
  KPICard,
  DetailedDataTable,
  DrillDownModal,
  DashboardGrid,
  TrendIndicator,
  ComparisonView,
} from "./components";
import { formatKPIValue } from "./utils/dashboard-helpers";
import { cn } from "@/lib/utils";

/**
 * HR Statistics Page Component
 */
export function HRStatisticsPage() {
  const [drillDownData, setDrillDownData] = useState<{
    open: boolean;
    title: string;
    data: any;
  }>({
    open: false,
    title: "",
    data: null,
  });

  // Mock data - would come from API hooks
  const overview = {
    totalEmployees: 125,
    previousTotalEmployees: 122,
    activeEmployees: 118,
    previousActiveEmployees: 115,
    newHires: 5,
    previousNewHires: 3,
    turnoverRate: 2.4, // percentage
    previousTurnoverRate: 3.1,
    avgTenure: 3.5, // years
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    console.log("Export HR statistics");
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    console.log("Date range changed:", start, end);
  };

  return (
    <StatisticsPageLayout
      title="Estatísticas de Recursos Humanos"
      onRefresh={handleRefresh}
      onExport={handleExport}
      onDateRangeChange={handleDateRangeChange}
      lastUpdated={new Date()}
    >
      {/* Overview KPI Cards */}
      <DashboardGrid>
        <KPICard
          title="Total de Colaboradores"
          data={{
            current: overview.totalEmployees,
            previous: overview.previousTotalEmployees,
            format: "number",
          }}
          icon={IconUsers}
        />
        <KPICard
          title="Colaboradores Ativos"
          data={{
            current: overview.activeEmployees,
            previous: overview.previousActiveEmployees,
            format: "number",
          }}
          icon={IconUsers}
        />
        <KPICard
          title="Novas Contratações"
          data={{
            current: overview.newHires,
            previous: overview.previousNewHires,
            format: "number",
          }}
          icon={IconUserPlus}
        />
        <KPICard
          title="Taxa de Rotatividade"
          data={{
            current: overview.turnoverRate,
            previous: overview.previousTurnoverRate,
            format: "percentage",
          }}
          icon={IconTrendingUp}
        />
      </DashboardGrid>

      {/* Employee Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employees by Sector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Colaboradores por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { sector: "Produção", count: 45, percentage: 36.0 },
                { sector: "Administração", count: 28, percentage: 22.4 },
                { sector: "Pintura", count: 25, percentage: 20.0 },
                { sector: "Montagem", count: 18, percentage: 14.4 },
                { sector: "Acabamento", count: 9, percentage: 7.2 },
              ].map((item) => (
                <div key={item.sector} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex-1">
                    <div className="font-medium">{item.sector}</div>
                    <div className="text-sm text-muted-foreground">{item.count} colaboradores</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{item.percentage}%</div>
                    <TrendIndicator current={item.count} previous={item.count - 1} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Employees by Position */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartPie className="h-5 w-5" />
              Colaboradores por Cargo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { position: "Operador de Produção", count: 35, color: "bg-blue-500" },
                { position: "Pintor", count: 25, color: "bg-purple-500" },
                { position: "Montador", count: 18, color: "bg-green-500" },
                { position: "Supervisor", count: 12, color: "bg-yellow-500" },
                { position: "Coordenador", count: 8, color: "bg-red-500" },
              ].map((item) => (
                <div key={item.position} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", item.color)} />
                    <span className="font-medium">{item.position}</span>
                  </div>
                  <div className="font-semibold">{item.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTrendingUp className="h-5 w-5" />
            Métricas de Desempenho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Performance Level Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-3">Distribuição de Níveis de Desempenho</h4>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { level: "Excelente", count: 28, percentage: 22.4, color: "bg-green-500" },
                  { level: "Muito Bom", count: 45, percentage: 36.0, color: "bg-blue-500" },
                  { level: "Bom", count: 35, percentage: 28.0, color: "bg-yellow-500" },
                  { level: "Regular", count: 12, percentage: 9.6, color: "bg-orange-500" },
                  { level: "Insatisfatório", count: 5, percentage: 4.0, color: "bg-red-500" },
                ].map((item) => (
                  <div key={item.level} className="p-3 border rounded-lg">
                    <div className={cn("w-full h-2 rounded-full mb-2", item.color)} />
                    <div className="text-2xl font-bold">{item.count}</div>
                    <div className="text-xs text-muted-foreground mb-1">{item.level}</div>
                    <div className="text-xs font-medium">{item.percentage}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performers */}
            <div>
              <h4 className="text-sm font-medium mb-3">Principais Destaques</h4>
              <DetailedDataTable
                columns={[
                  { key: "name", label: "Colaborador", sortable: true },
                  { key: "sector", label: "Setor", sortable: true },
                  { key: "position", label: "Cargo", sortable: true },
                  {
                    key: "performance",
                    label: "Desempenho",
                    sortable: true,
                    align: "right",
                    render: (value: string) => (
                      <Badge variant={value === "Excelente" ? "default" : "secondary"}>
                        {value}
                      </Badge>
                    )
                  },
                  {
                    key: "score",
                    label: "Pontuação",
                    sortable: true,
                    align: "right",
                    render: (value: number) => `${value}/100`
                  },
                ]}
                data={[
                  { name: "João Silva", sector: "Produção", position: "Operador", performance: "Excelente", score: 95 },
                  { name: "Maria Santos", sector: "Pintura", position: "Pintora", performance: "Excelente", score: 93 },
                  { name: "Carlos Oliveira", sector: "Montagem", position: "Montador", performance: "Excelente", score: 91 },
                ]}
                paginated={false}
                searchable={false}
                exportable={true}
                exportFilename="principais-destaques.csv"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bonus Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5" />
            Análise de Bonificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Bonus Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total de Bônus</div>
                <div className="text-3xl font-bold text-green-600">
                  {formatKPIValue(45000, "currency")}
                </div>
                <TrendIndicator current={45000} previous={42000} size="sm" className="mt-2" />
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Colaboradores Bonificados</div>
                <div className="text-3xl font-bold">85</div>
                <div className="text-xs text-muted-foreground mt-2">68% do total</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Bônus Médio</div>
                <div className="text-3xl font-bold">
                  {formatKPIValue(529.41, "currency")}
                </div>
                <div className="text-xs text-muted-foreground mt-2">por colaborador</div>
              </div>
            </div>

            {/* Bonus by Sector */}
            <div>
              <h4 className="text-sm font-medium mb-3">Bônus por Setor</h4>
              <div className="space-y-2">
                {[
                  { sector: "Produção", total: 18000, count: 35 },
                  { sector: "Pintura", total: 12500, count: 22 },
                  { sector: "Montagem", total: 9000, count: 15 },
                  { sector: "Acabamento", total: 5500, count: 13 },
                ].map((item) => (
                  <div key={item.sector} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent">
                    <div className="flex-1">
                      <div className="font-medium">{item.sector}</div>
                      <div className="text-sm text-muted-foreground">{item.count} colaboradores</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatKPIValue(item.total, "currency")}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatKPIValue(item.total / item.count, "currency")} médio
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5" />
            Análise de Folha de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Payroll Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Folha Total</div>
                <div className="text-2xl font-bold">{formatKPIValue(285000, "currency")}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Salário Médio</div>
                <div className="text-2xl font-bold">{formatKPIValue(2280, "currency")}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Encargos</div>
                <div className="text-2xl font-bold">{formatKPIValue(85500, "currency")}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Custo Total</div>
                <div className="text-2xl font-bold">{formatKPIValue(370500, "currency")}</div>
              </div>
            </div>

            {/* Costs by Sector */}
            <DetailedDataTable
              columns={[
                { key: "sector", label: "Setor", sortable: true },
                { key: "employees", label: "Colaboradores", sortable: true, align: "right" },
                {
                  key: "totalSalary",
                  label: "Salários",
                  sortable: true,
                  align: "right",
                  render: (value: number) => formatKPIValue(value, "currency")
                },
                {
                  key: "avgSalary",
                  label: "Salário Médio",
                  sortable: true,
                  align: "right",
                  render: (value: number) => formatKPIValue(value, "currency")
                },
                {
                  key: "totalCost",
                  label: "Custo Total",
                  sortable: true,
                  align: "right",
                  render: (value: number) => formatKPIValue(value, "currency")
                },
              ]}
              data={[
                { sector: "Produção", employees: 45, totalSalary: 102600, avgSalary: 2280, totalCost: 136000 },
                { sector: "Administração", employees: 28, totalSalary: 89600, avgSalary: 3200, totalCost: 118800 },
                { sector: "Pintura", employees: 25, totalSalary: 57500, avgSalary: 2300, totalCost: 76300 },
                { sector: "Montagem", employees: 18, totalSalary: 39600, avgSalary: 2200, totalCost: 52500 },
              ]}
              paginated={false}
              searchable={false}
              exportable={true}
              exportFilename="custos-setor.csv"
            />
          </div>
        </CardContent>
      </Card>

      {/* Warning Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconAlertTriangle className="h-5 w-5" />
            Análise de Advertências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Warning Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total de Advertências</div>
                <div className="text-3xl font-bold text-yellow-600">15</div>
                <div className="text-xs text-muted-foreground mt-2">Este mês</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Advertências por Colaborador</div>
                <div className="text-3xl font-bold">0.12</div>
                <div className="text-xs text-muted-foreground mt-2">Média</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Suspensões</div>
                <div className="text-3xl font-bold text-red-600">2</div>
                <div className="text-xs text-muted-foreground mt-2">Este mês</div>
              </div>
            </div>

            {/* Warnings by Category */}
            <div>
              <h4 className="text-sm font-medium mb-3">Advertências por Categoria</h4>
              <div className="space-y-2">
                {[
                  { category: "Atraso", count: 6, severity: "Leve" },
                  { category: "Não cumprimento de normas", count: 4, severity: "Moderada" },
                  { category: "Atitude inadequada", count: 3, severity: "Moderada" },
                  { category: "Segurança", count: 2, severity: "Grave" },
                ].map((item) => (
                  <div key={item.category} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent">
                    <div className="flex-1">
                      <div className="font-medium">{item.category}</div>
                      <div className="text-sm text-muted-foreground">Gravidade: {item.severity}</div>
                    </div>
                    <div className="font-semibold">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PPE Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconShield className="h-5 w-5" />
            Análise de EPIs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* PPE Deliveries */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Entregas Este Mês</div>
                <div className="text-3xl font-bold">128</div>
                <TrendIndicator current={128} previous={115} size="sm" className="mt-2" />
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Custo Total</div>
                <div className="text-3xl font-bold">{formatKPIValue(8500, "currency")}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Taxa de Conformidade</div>
                <div className="text-3xl font-bold text-green-600">98.5%</div>
              </div>
            </div>

            {/* PPE by Type */}
            <DetailedDataTable
              columns={[
                { key: "type", label: "Tipo de EPI", sortable: true },
                { key: "deliveries", label: "Entregas", sortable: true, align: "right" },
                {
                  key: "cost",
                  label: "Custo",
                  sortable: true,
                  align: "right",
                  render: (value: number) => formatKPIValue(value, "currency")
                },
                {
                  key: "avgCost",
                  label: "Custo Médio",
                  sortable: true,
                  align: "right",
                  render: (value: number) => formatKPIValue(value, "currency")
                },
              ]}
              data={[
                { type: "Luvas", deliveries: 45, cost: 1350, avgCost: 30 },
                { type: "Óculos de Proteção", deliveries: 28, cost: 1680, avgCost: 60 },
                { type: "Capacete", deliveries: 22, cost: 2200, avgCost: 100 },
                { type: "Botas", deliveries: 18, cost: 2700, avgCost: 150 },
                { type: "Máscara Respiratória", deliveries: 15, cost: 570, avgCost: 38 },
              ]}
              paginated={false}
              searchable={false}
              exportable={true}
              exportFilename="epis-tipo.csv"
            />
          </div>
        </CardContent>
      </Card>

      {/* Drill-Down Modal */}
      <DrillDownModal
        open={drillDownData.open}
        onClose={() => setDrillDownData({ open: false, title: "", data: null })}
        title={drillDownData.title}
        tableContent={
          drillDownData.data && (
            <div className="p-4">
              <pre className="text-sm">{JSON.stringify(drillDownData.data, null, 2)}</pre>
            </div>
          )
        }
      />
    </StatisticsPageLayout>
  );
}

export default HRStatisticsPage;
