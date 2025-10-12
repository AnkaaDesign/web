/**
 * Orders Statistics Page
 *
 * Comprehensive order analytics with:
 * - Order overview and metrics
 * - Fulfillment tracking
 * - Supplier performance
 * - Spending analysis
 * - Item analysis
 * - Lead time tracking
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconShoppingCart,
  IconClock,
  IconCurrencyDollar,
  IconTruck,
  IconChartBar,
  IconChartLine,
  IconPackage,
  IconAlertCircle,
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
 * Orders Statistics Page Component
 */
export function OrdersStatisticsPage() {
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
    pendingOrders: 23,
    previousPendingOrders: 28,
    ordersThisMonth: 45,
    previousOrdersThisMonth: 38,
    totalSpending: 125000,
    previousTotalSpending: 118000,
    avgLeadTime: 7.5, // days
    previousAvgLeadTime: 8.2,
    supplierCount: 15,
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    console.log("Export orders statistics");
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    console.log("Date range changed:", start, end);
  };

  return (
    <StatisticsPageLayout
      title="Estatísticas de Pedidos"
      onRefresh={handleRefresh}
      onExport={handleExport}
      onDateRangeChange={handleDateRangeChange}
      lastUpdated={new Date()}
    >
      {/* Overview KPI Cards */}
      <DashboardGrid>
        <KPICard
          title="Pedidos Pendentes"
          data={{
            current: overview.pendingOrders,
            previous: overview.previousPendingOrders,
            format: "number",
          }}
          icon={IconShoppingCart}
        />
        <KPICard
          title="Pedidos Este Mês"
          data={{
            current: overview.ordersThisMonth,
            previous: overview.previousOrdersThisMonth,
            format: "number",
          }}
          icon={IconPackage}
        />
        <KPICard
          title="Gasto Total"
          data={{
            current: overview.totalSpending,
            previous: overview.previousTotalSpending,
            format: "currency",
          }}
          icon={IconCurrencyDollar}
        />
        <KPICard
          title="Lead Time Médio"
          data={{
            current: overview.avgLeadTime,
            previous: overview.previousAvgLeadTime,
            format: "number",
            unit: "dias",
          }}
          icon={IconClock}
        />
      </DashboardGrid>

      {/* Order Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Pedidos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { status: "Pendente", count: 8, color: "bg-yellow-500", percentage: 34.8 },
                { status: "Processando", count: 10, color: "bg-blue-500", percentage: 43.5 },
                { status: "Enviado", count: 3, color: "bg-purple-500", percentage: 13.0 },
                { status: "Entregue", count: 2, color: "bg-green-500", percentage: 8.7 },
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

        {/* Orders by Supplier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTruck className="h-5 w-5" />
              Pedidos por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { supplier: "Fornecedor A", count: 15, value: 45000 },
                { supplier: "Fornecedor B", count: 12, value: 35000 },
                { supplier: "Fornecedor C", count: 10, value: 28000 },
                { supplier: "Fornecedor D", count: 8, value: 17000 },
              ].map((item) => (
                <div key={item.supplier} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium">{item.supplier}</div>
                    <div className="text-sm text-muted-foreground">{item.count} pedidos</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatKPIValue(item.value, "currency")}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fulfillment Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPackage className="h-5 w-5" />
            Análise de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Taxa de Atendimento</div>
              <div className="text-3xl font-bold text-green-600">94.5%</div>
              <TrendIndicator current={94.5} previous={92.8} size="sm" className="mt-2" />
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Atendimentos Parciais</div>
              <div className="text-3xl font-bold text-yellow-600">8</div>
              <div className="text-xs text-muted-foreground mt-2">5.5% do total</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Pedidos em Atraso</div>
              <div className="text-3xl font-bold text-red-600">3</div>
              <div className="text-xs text-muted-foreground mt-2">2.1% do total</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Tempo Médio de Atendimento</div>
              <div className="text-3xl font-bold">6.5</div>
              <div className="text-xs text-muted-foreground mt-2">dias</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTruck className="h-5 w-5" />
            Desempenho de Fornecedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailedDataTable
            columns={[
              { key: "supplier", label: "Fornecedor", sortable: true },
              {
                key: "onTimeRate",
                label: "Taxa de Entrega no Prazo",
                sortable: true,
                align: "right",
                render: (value: number) => `${value}%`
              },
              {
                key: "avgLeadTime",
                label: "Lead Time Médio",
                sortable: true,
                align: "right",
                render: (value: number) => `${value} dias`
              },
              {
                key: "qualityScore",
                label: "Qualidade",
                sortable: true,
                align: "right",
                render: (value: number) => (
                  <Badge variant={value >= 4.5 ? "default" : value >= 3.5 ? "secondary" : "destructive"}>
                    {value}/5
                  </Badge>
                )
              },
              {
                key: "totalOrders",
                label: "Total de Pedidos",
                sortable: true,
                align: "right"
              },
              {
                key: "totalValue",
                label: "Valor Total",
                sortable: true,
                align: "right",
                render: (value: number) => formatKPIValue(value, "currency")
              },
            ]}
            data={[
              { supplier: "Fornecedor A", onTimeRate: 95.5, avgLeadTime: 6.5, qualityScore: 4.8, totalOrders: 15, totalValue: 45000 },
              { supplier: "Fornecedor B", onTimeRate: 92.0, avgLeadTime: 7.2, qualityScore: 4.5, totalOrders: 12, totalValue: 35000 },
              { supplier: "Fornecedor C", onTimeRate: 88.5, avgLeadTime: 8.5, qualityScore: 4.2, totalOrders: 10, totalValue: 28000 },
              { supplier: "Fornecedor D", onTimeRate: 85.0, avgLeadTime: 9.0, qualityScore: 3.8, totalOrders: 8, totalValue: 17000 },
            ]}
            paginated={true}
            pageSize={10}
            searchable={true}
            exportable={true}
            exportFilename="desempenho-fornecedores.csv"
          />
        </CardContent>
      </Card>

      {/* Spending Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5" />
            Análise de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Spending Trends - Chart would go here */}
            <div className="h-48 flex items-center justify-center border rounded-lg">
              <div className="text-muted-foreground">Gráfico de tendência de gastos</div>
            </div>

            {/* Spending by Category */}
            <div>
              <h4 className="text-sm font-medium mb-3">Gastos por Categoria</h4>
              <div className="space-y-2">
                {[
                  { category: "Matéria Prima", value: 55000, percentage: 44.0 },
                  { category: "Ferramentas", value: 28000, percentage: 22.4 },
                  { category: "Tintas", value: 25000, percentage: 20.0 },
                  { category: "Outros", value: 17000, percentage: 13.6 },
                ].map((item) => (
                  <div key={item.category} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent">
                    <div className="flex-1">
                      <div className="font-medium">{item.category}</div>
                      <div className="text-sm text-muted-foreground">{item.percentage}% do total</div>
                    </div>
                    <div className="font-semibold">{formatKPIValue(item.value, "currency")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPackage className="h-5 w-5" />
            Análise de Itens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailedDataTable
            columns={[
              { key: "item", label: "Item", sortable: true },
              { key: "category", label: "Categoria", sortable: true },
              {
                key: "ordersCount",
                label: "Qtd. Pedidos",
                sortable: true,
                align: "right"
              },
              {
                key: "totalQuantity",
                label: "Quantidade Total",
                sortable: true,
                align: "right"
              },
              {
                key: "avgPrice",
                label: "Preço Médio",
                sortable: true,
                align: "right",
                render: (value: number) => formatKPIValue(value, "currency")
              },
              {
                key: "totalValue",
                label: "Valor Total",
                sortable: true,
                align: "right",
                render: (value: number) => formatKPIValue(value, "currency")
              },
            ]}
            data={[
              { item: "Tinta Acrílica Branca", category: "Tintas", ordersCount: 8, totalQuantity: 120, avgPrice: 45.50, totalValue: 5460 },
              { item: "Lixa Grão 120", category: "Abrasivos", ordersCount: 6, totalQuantity: 500, avgPrice: 2.50, totalValue: 1250 },
              { item: "Verniz Brilhante", category: "Acabamento", ordersCount: 5, totalQuantity: 80, avgPrice: 65.00, totalValue: 5200 },
              { item: "Disco de Corte", category: "Ferramentas", ordersCount: 4, totalQuantity: 200, avgPrice: 8.50, totalValue: 1700 },
            ]}
            paginated={true}
            pageSize={10}
            searchable={true}
            exportable={true}
            exportFilename="analise-itens-pedidos.csv"
          />
        </CardContent>
      </Card>

      {/* Comparison View */}
      <ComparisonView
        title="Comparativo Mensal"
        periodA={{
          label: "Este Mês",
          data: {
            orders: 45,
            value: 125000,
            avgLeadTime: 7.5,
            fulfillmentRate: 94.5,
          },
        }}
        periodB={{
          label: "Mês Anterior",
          data: {
            orders: 38,
            value: 118000,
            avgLeadTime: 8.2,
            fulfillmentRate: 92.8,
          },
        }}
        metrics={[
          { key: "orders", label: "Total de Pedidos", format: "number" },
          { key: "value", label: "Valor Total", format: "currency" },
          { key: "avgLeadTime", label: "Lead Time Médio", format: "number", unit: "dias", higherIsBetter: false },
          { key: "fulfillmentRate", label: "Taxa de Atendimento", format: "percentage" },
        ]}
        showDifference={true}
        showCharts={false}
      />

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

export default OrdersStatisticsPage;
