/**
 * Production Statistics Page
 *
 * Comprehensive production analytics with:
 * - Task overview and metrics
 * - Performance tracking
 * - Sector analysis
 * - Paint analytics
 * - Customer analytics
 * - Cycle time analysis
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconClipboardList,
  IconClockHour4,
  IconTrendingUp,
  IconUsers,
  IconChartBar,
  IconChartPie,
  IconPaint,
  IconChecklist,
} from "@tabler/icons-react";
import {
  StatisticsPageLayout,
  KPICard,
  DetailedDataTable,
  DrillDownModal,
  DashboardGrid,
  TrendIndicator,
} from "./components";
import { formatKPIValue } from "./utils/dashboard-helpers";
import { cn } from "@/lib/utils";

/**
 * Production Statistics Page Component
 */
export function ProductionStatisticsPage() {
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
    activeTasks: 45,
    previousActiveTasks: 42,
    completedThisMonth: 128,
    previousCompletedThisMonth: 115,
    avgCycleTime: 3.5, // days
    previousAvgCycleTime: 4.2,
    onTimeRate: 87.5, // percentage
    previousOnTimeRate: 82.3,
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    console.log("Export production statistics");
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    console.log("Date range changed:", start, end);
  };

  return (
    <StatisticsPageLayout
      title="Estatísticas de Produção"
      onRefresh={handleRefresh}
      onExport={handleExport}
      onDateRangeChange={handleDateRangeChange}
      lastUpdated={new Date()}
    >
      {/* Overview KPI Cards */}
      <DashboardGrid>
        <KPICard
          title="Tarefas Ativas"
          data={{
            current: overview.activeTasks,
            previous: overview.previousActiveTasks,
            format: "number",
          }}
          icon={IconClipboardList}
        />
        <KPICard
          title="Concluídas Este Mês"
          data={{
            current: overview.completedThisMonth,
            previous: overview.previousCompletedThisMonth,
            format: "number",
          }}
          icon={IconChecklist}
        />
        <KPICard
          title="Tempo Médio de Ciclo"
          data={{
            current: overview.avgCycleTime,
            previous: overview.previousAvgCycleTime,
            format: "number",
            unit: "dias",
          }}
          icon={IconClockHour4}
        />
        <KPICard
          title="Taxa de Conclusão no Prazo"
          data={{
            current: overview.onTimeRate,
            previous: overview.previousOnTimeRate,
            format: "percentage",
          }}
          icon={IconTrendingUp}
        />
      </DashboardGrid>

      {/* Task Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartPie className="h-5 w-5" />
              Tarefas por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { status: "Pendente", count: 12, color: "bg-yellow-500", percentage: 26.7 },
                { status: "Em Progresso", count: 18, color: "bg-blue-500", percentage: 40.0 },
                { status: "Em Revisão", count: 8, color: "bg-purple-500", percentage: 17.8 },
                { status: "Concluída", count: 7, color: "bg-green-500", percentage: 15.5 },
              ].map((item) => (
                <div key={item.status} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", item.color)} />
                    <span className="font-medium">{item.status}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{item.count}</div>
                    <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Sector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Tarefas por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { sector: "Pintura", count: 25, percentage: 55.6 },
                { sector: "Montagem", count: 12, percentage: 26.7 },
                { sector: "Acabamento", count: 8, percentage: 17.7 },
              ].map((item) => (
                <div key={item.sector} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium">{item.sector}</div>
                    <div className="text-sm text-muted-foreground">{item.count} tarefas</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{item.percentage}%</div>
                    <TrendIndicator current={item.count} previous={item.count - 2} size="sm" />
                  </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cycle Time Trends */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tempo de Ciclo por Tipo</h4>
              <div className="space-y-2">
                {[
                  { type: "Pintura Simples", time: 2.5, unit: "dias" },
                  { type: "Pintura Complexa", time: 5.2, unit: "dias" },
                  { type: "Montagem", time: 3.1, unit: "dias" },
                ].map((item) => (
                  <div key={item.type} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.type}</span>
                    <span className="font-medium">{item.time} {item.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Completion Rate by Sector */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Taxa de Conclusão por Setor</h4>
              <div className="space-y-2">
                {[
                  { sector: "Pintura", rate: 92.5 },
                  { sector: "Montagem", rate: 85.3 },
                  { sector: "Acabamento", rate: 88.7 },
                ].map((item) => (
                  <div key={item.sector} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.sector}</span>
                    <span className="font-medium">{item.rate}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Efficiency Trends */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tendências de Eficiência</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Esta semana</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">89.5%</span>
                    <TrendIndicator current={89.5} previous={87.2} size="sm" showPercentage={false} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Este mês</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">87.8%</span>
                    <TrendIndicator current={87.8} previous={85.1} size="sm" showPercentage={false} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Média trimestral</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">86.3%</span>
                    <TrendIndicator current={86.3} previous={83.9} size="sm" showPercentage={false} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sector Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Análise por Setor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailedDataTable
            columns={[
              { key: "sector", label: "Setor", sortable: true },
              { key: "activeTasks", label: "Tarefas Ativas", sortable: true, align: "right" },
              { key: "completedTasks", label: "Concluídas", sortable: true, align: "right" },
              {
                key: "avgCycleTime",
                label: "Tempo Médio",
                sortable: true,
                align: "right",
                render: (value: number) => `${value} dias`
              },
              {
                key: "efficiency",
                label: "Eficiência",
                sortable: true,
                align: "right",
                render: (value: number) => (
                  <div className="flex items-center justify-end gap-2">
                    <span>{value}%</span>
                    <Badge variant={value >= 90 ? "default" : value >= 75 ? "secondary" : "destructive"}>
                      {value >= 90 ? "Alta" : value >= 75 ? "Média" : "Baixa"}
                    </Badge>
                  </div>
                )
              },
            ]}
            data={[
              { sector: "Pintura", activeTasks: 25, completedTasks: 78, avgCycleTime: 3.2, efficiency: 92.5 },
              { sector: "Montagem", activeTasks: 12, completedTasks: 35, avgCycleTime: 2.8, efficiency: 85.3 },
              { sector: "Acabamento", activeTasks: 8, completedTasks: 15, avgCycleTime: 1.5, efficiency: 88.7 },
            ]}
            paginated={false}
            searchable={false}
            exportable={true}
            exportFilename="analise-setores.csv"
          />
        </CardContent>
      </Card>

      {/* Paint Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPaint className="h-5 w-5" />
            Análise de Pintura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Most Used Colors */}
            <div>
              <h4 className="text-sm font-medium mb-3">Cores Mais Utilizadas</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { color: "Branco", hex: "#FFFFFF", usage: 35 },
                  { color: "Preto", hex: "#000000", usage: 28 },
                  { color: "Azul", hex: "#0066CC", usage: 18 },
                  { color: "Vermelho", hex: "#CC0000", usage: 12 },
                ].map((item) => (
                  <div key={item.color} className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: item.hex }}
                      />
                      <span className="font-medium text-sm">{item.color}</span>
                    </div>
                    <div className="text-2xl font-bold">{item.usage}%</div>
                    <div className="text-xs text-muted-foreground">do total</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paint Types Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-3">Distribuição por Tipo de Tinta</h4>
              <DetailedDataTable
                columns={[
                  { key: "type", label: "Tipo", sortable: true },
                  { key: "usageCount", label: "Usos", sortable: true, align: "right" },
                  {
                    key: "percentage",
                    label: "Percentual",
                    sortable: true,
                    align: "right",
                    render: (value: number) => `${value}%`
                  },
                ]}
                data={[
                  { type: "Esmalte Sintético", usageCount: 125, percentage: 45.5 },
                  { type: "Tinta Acrílica", usageCount: 95, percentage: 34.5 },
                  { type: "Tinta Epóxi", usageCount: 35, percentage: 12.7 },
                  { type: "Tinta PU", usageCount: 20, percentage: 7.3 },
                ]}
                paginated={false}
                searchable={false}
                exportable={true}
                exportFilename="tipos-tinta.csv"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Análise de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailedDataTable
            columns={[
              { key: "customer", label: "Cliente", sortable: true },
              { key: "totalTasks", label: "Total de Tarefas", sortable: true, align: "right" },
              { key: "completedTasks", label: "Concluídas", sortable: true, align: "right" },
              {
                key: "avgSatisfaction",
                label: "Satisfação",
                sortable: true,
                align: "right",
                render: (value: number) => (
                  <div className="flex items-center justify-end gap-2">
                    <span>{value}/5</span>
                    <Badge variant={value >= 4.5 ? "default" : value >= 3.5 ? "secondary" : "destructive"}>
                      {value >= 4.5 ? "Excelente" : value >= 3.5 ? "Bom" : "Regular"}
                    </Badge>
                  </div>
                )
              },
              {
                key: "revenue",
                label: "Receita",
                sortable: true,
                align: "right",
                render: (value: number) => formatKPIValue(value, "currency")
              },
            ]}
            data={[
              { customer: "Empresa A", totalTasks: 45, completedTasks: 42, avgSatisfaction: 4.8, revenue: 125000 },
              { customer: "Empresa B", totalTasks: 38, completedTasks: 35, avgSatisfaction: 4.5, revenue: 98000 },
              { customer: "Empresa C", totalTasks: 25, completedTasks: 23, avgSatisfaction: 4.2, revenue: 65000 },
              { customer: "Empresa D", totalTasks: 20, completedTasks: 18, avgSatisfaction: 4.0, revenue: 52000 },
            ]}
            paginated={true}
            pageSize={10}
            searchable={true}
            exportable={true}
            exportFilename="analise-clientes.csv"
          />
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

export default ProductionStatisticsPage;
