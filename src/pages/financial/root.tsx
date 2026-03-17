import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useFinancialDashboard } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { IconCurrencyDollar } from "@tabler/icons-react";
import {
  Users as LucideUsers,
  FileText as LucideFileText,
  Receipt as LucideReceipt,
  DollarSign as LucideDollarSign,
  CreditCard as LucideCreditCard,
  TrendingUp as LucideTrendingUp,
  TrendingDown as LucideTrendingDown,
  CheckCircle as LucideCheckCircle,
  XCircle as LucideXCircle,
  Clock as LucideClock,
  BarChart3 as LucideChartBar,
  PieChart as LucidePieChart,
} from "lucide-react";
import {
  TrendCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  ActivityPatternCard,
  TimePeriodSelector,
  type AnalysisData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const FinancialRootPage = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  usePageTracker({
    title: "Dashboard Financeiro",
    icon: "financial",
  });

  const { data: dashboard, isLoading, error } = useFinancialDashboard({ timePeriod });

  const headerContent = (
    <div className="flex-shrink-0 bg-background px-4 pt-4 pb-4">
      <PageHeader
        title="Financeiro"
        icon={IconCurrencyDollar}
        favoritePage={FAVORITE_PAGES.FINANCEIRO_FATURAMENTO}
        breadcrumbs={[{ label: "Inicio", href: routes.home }, { label: "Financeiro" }]}
        actions={[
          {
            key: "time-period",
            label: <TimePeriodSelector value={timePeriod} onChange={(val) => setTimePeriod(val as DASHBOARD_TIME_PERIOD)} /> as any,
          },
        ]}
      />
    </div>
  );

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col bg-background">
          {headerContent}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6 space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col bg-background">
          {headerContent}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6">
                <Alert variant="destructive">
                  <AlertDescription>Erro ao carregar dashboard: {error.message}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  const data = dashboard?.data;

  const getInvoiceStatus = () => {
    if (!data?.invoiceMetrics) return [];
    const { totalInvoices, activeInvoices, paidInvoices, cancelledInvoices } = data.invoiceMetrics;
    return [
      { status: "Ativas", quantity: activeInvoices?.value || 0, total: totalInvoices?.value || 0, icon: LucideFileText, color: "blue" as const },
      { status: "Parc. Pagas", quantity: (totalInvoices?.value || 0) - (activeInvoices?.value || 0) - (paidInvoices?.value || 0) - (cancelledInvoices?.value || 0), total: totalInvoices?.value || 0, icon: LucideClock, color: "orange" as const },
      { status: "Pagas", quantity: paidInvoices?.value || 0, total: totalInvoices?.value || 0, icon: LucideCheckCircle, color: "green" as const },
      { status: "Canceladas", quantity: cancelledInvoices?.value || 0, total: totalInvoices?.value || 0, icon: LucideXCircle, color: "red" as const },
    ];
  };

  const getCustomerAnalysis = (): AnalysisData[] => {
    if (!data?.customerAnalysis?.topCustomers) return [];
    const topCustomers = data.customerAnalysis.topCustomers;
    const total = topCustomers.reduce((sum, c) => sum + c.value, 0);
    const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-red-500", "bg-teal-500"];

    return topCustomers.slice(0, 6).map((customer, index) => ({
      label: customer.name.substring(0, 20),
      value: customer.value,
      percentage: total > 0 ? Math.round((customer.value / total) * 100) : 0,
      info: formatCurrency(customer.value),
      color: colors[index % colors.length],
    }));
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col bg-background">
        {headerContent}

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Quick Access */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rapido</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <QuickAccessCard
                    title="Clientes"
                    icon={LucideUsers}
                    onClick={() => navigate(routes.financial.customers.root)}
                    count={data?.customerAnalysis?.topCustomers?.length ?? 0}
                    color="blue"
                  />
                  <QuickAccessCard
                    title="Faturamento"
                    icon={LucideFileText}
                    onClick={() => navigate(routes.financial.billing.root)}
                    count={data?.invoiceMetrics?.totalInvoices?.value ?? 0}
                    color="green"
                  />
                  <QuickAccessCard
                    title="Notas Fiscais"
                    icon={LucideReceipt}
                    onClick={() => navigate(routes.financial.nfse.root)}
                    count={data?.nfseMetrics?.totalNfse?.value ?? 0}
                    color="purple"
                  />
                </div>
              </div>

              {/* Revenue Metrics */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Metricas Financeiras</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <TrendCard
                    title="Total Faturado"
                    value={formatCurrency(data?.revenueMetrics?.totalInvoiced?.value ?? 0)}
                    trend="stable"
                    percentage={0}
                    icon={LucideDollarSign}
                    subtitle="Valor total faturado"
                  />
                  <TrendCard
                    title="Total Recebido"
                    value={formatCurrency(data?.revenueMetrics?.totalPaid?.value ?? 0)}
                    trend="up"
                    percentage={0}
                    icon={LucideTrendingUp}
                    subtitle="Valor recebido"
                  />
                  <TrendCard
                    title="Total Pendente"
                    value={formatCurrency(data?.revenueMetrics?.totalPending?.value ?? 0)}
                    trend="stable"
                    percentage={0}
                    icon={LucideClock}
                    subtitle="A receber"
                  />
                  <TrendCard
                    title="Boletos Vencidos"
                    value={formatCurrency(data?.revenueMetrics?.overdueAmount?.value ?? 0)}
                    trend={data?.revenueMetrics?.overdueAmount?.value ? "down" : "stable"}
                    percentage={0}
                    icon={LucideTrendingDown}
                    subtitle="Valor vencido"
                  />
                  <TrendCard
                    title="NFS-e Autorizadas"
                    value={data?.revenueMetrics?.authorizedNfse?.value ?? 0}
                    trend="stable"
                    percentage={0}
                    icon={LucideReceipt}
                    subtitle="Notas autorizadas"
                  />
                </div>
              </div>

              {/* Invoice Status Distribution */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Status das Faturas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {getInvoiceStatus().map((status, index) => (
                    <StatusCard key={index} status={status.status} quantity={status.quantity} total={status.total} icon={status.icon} color={status.color} unit="faturas" />
                  ))}
                </div>
              </div>

              {/* Activity Patterns */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Padroes de Atividade</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActivityPatternCard
                    title="Faturamento por Cliente"
                    data={
                      data?.customerAnalysis?.revenueByCustomer?.labels?.map((label, index) => ({
                        label: label,
                        value: data.customerAnalysis.revenueByCustomer.datasets[0]?.data[index] || 0,
                      })) || []
                    }
                    icon={LucideUsers}
                    color="blue"
                  />
                  <ActivityPatternCard
                    title="Status dos Orcamentos"
                    data={
                      data?.quotesByStatus?.labels?.map((label, index) => ({
                        label: label,
                        value: data.quotesByStatus.datasets[0]?.data[index] || 0,
                      })) || []
                    }
                    icon={LucideChartBar}
                    color="green"
                  />
                  <ActivityPatternCard
                    title="Boletos por Status"
                    data={[
                      { label: "Ativos", value: data?.bankSlipMetrics?.activeBankSlips?.value || 0 },
                      { label: "Vencidos", value: data?.bankSlipMetrics?.overdueBankSlips?.value || 0 },
                      { label: "Pagos", value: data?.bankSlipMetrics?.paidBankSlips?.value || 0 },
                    ]}
                    icon={LucideCreditCard}
                    color="purple"
                  />
                </div>
              </div>

              {/* Analysis */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Analises</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnalysisCard
                    title="Receita por Cliente"
                    type="custom"
                    data={getCustomerAnalysis()}
                    icon={LucidePieChart}
                    onDetailsClick={() => navigate(routes.financial.customers.root)}
                  />
                  <AnalysisCard
                    title="Faturamento Mensal"
                    type="custom"
                    data={(() => {
                      const monthlyData = data?.monthlyRevenue;
                      if (!monthlyData?.labels || !monthlyData?.datasets?.[0]) return [];
                      const total = monthlyData.datasets[0].data.reduce((sum, v) => sum + v, 0);
                      const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-red-500", "bg-teal-500"];

                      return monthlyData.labels.map((label, index) => {
                        const value = monthlyData.datasets[0].data[index] || 0;
                        return {
                          label,
                          value,
                          percentage: total > 0 ? Math.round((value / total) * 100) : 0,
                          info: formatCurrency(value),
                          color: colors[index % colors.length],
                        };
                      });
                    })()}
                    icon={LucideChartBar}
                    onDetailsClick={() => navigate(routes.financial.billing.root)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
