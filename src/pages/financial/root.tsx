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
  AlertTriangle as LucideAlertTriangle,
  Percent as LucidePercent,
  Activity as LucideActivity,
  ClipboardList as LucideClipboardList,
  FileCheck as LucideFileCheck,
} from "lucide-react";
import {
  TrendCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  ActivityPatternCard,
  RecentActivitiesCard,
  DashboardSection,
  TimePeriodSelector,
  type AnalysisData,
  type Activity,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const deriveTrend = (value: number, threshold: number = 0): "up" | "down" | "stable" => {
  if (value > threshold) return "up";
  if (value < 0) return "down";
  return "stable";
};

const LoadingSkeleton = () => (
  <div className="space-y-6">
    {/* KPI row skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
    {/* Quick access skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
    {/* Metrics skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
    {/* Status cards skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
    {/* Charts skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
    {/* Analysis skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  </div>
);

export const FinancialRootPage = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  usePageTracker({
    title: "Dashboard Financeiro",
    icon: "financial",
  });

  const { data: dashboard, isLoading, error } = useFinancialDashboard({ timePeriod });

  const requiredPrivilege = [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL];

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
      <PrivilegeRoute requiredPrivilege={requiredPrivilege}>
        <div className="h-full flex flex-col bg-background">
          {headerContent}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <LoadingSkeleton />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={requiredPrivilege}>
        <div className="h-full flex flex-col bg-background">
          {headerContent}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Alert variant="destructive">
              <AlertDescription>Erro ao carregar dashboard: {error.message}</AlertDescription>
            </Alert>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  const data = dashboard?.data;

  // --- Derived KPIs ---
  const totalInvoiced = data?.revenueMetrics?.totalInvoiced?.value ?? 0;
  const totalPaid = data?.revenueMetrics?.totalPaid?.value ?? 0;
  const totalPending = data?.revenueMetrics?.totalPending?.value ?? 0;
  const overdueAmount = data?.revenueMetrics?.overdueAmount?.value ?? 0;

  const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
  const overdueRate = totalInvoiced > 0 ? (overdueAmount / totalInvoiced) * 100 : 0;
  const pendingRate = totalInvoiced > 0 ? (totalPending / totalInvoiced) * 100 : 0;

  const totalInvoices = data?.invoiceMetrics?.totalInvoices?.value ?? 0;
  const activeInvoices = data?.invoiceMetrics?.activeInvoices?.value ?? 0;
  const paidInvoices = data?.invoiceMetrics?.paidInvoices?.value ?? 0;
  const cancelledInvoices = data?.invoiceMetrics?.cancelledInvoices?.value ?? 0;
  const partiallyPaid = Math.max(0, totalInvoices - activeInvoices - paidInvoices - cancelledInvoices);

  // --- Invoice Status ---
  const invoiceStatusData = [
    { status: "Ativas", quantity: activeInvoices, total: totalInvoices, icon: LucideFileText, color: "blue" as const },
    { status: "Parc. Pagas", quantity: partiallyPaid, total: totalInvoices, icon: LucideClock, color: "orange" as const },
    { status: "Pagas", quantity: paidInvoices, total: totalInvoices, icon: LucideCheckCircle, color: "green" as const },
    { status: "Canceladas", quantity: cancelledInvoices, total: totalInvoices, icon: LucideXCircle, color: "red" as const },
  ];

  // --- NFS-e Status ---
  const totalNfse = data?.nfseMetrics?.totalNfse?.value ?? 0;
  const nfseStatusData = [
    { status: "Autorizadas", quantity: data?.nfseMetrics?.authorizedNfse?.value ?? 0, total: totalNfse, icon: LucideCheckCircle, color: "green" as const },
    { status: "Pendentes", quantity: data?.nfseMetrics?.pendingNfse?.value ?? 0, total: totalNfse, icon: LucideClock, color: "orange" as const },
    { status: "Canceladas", quantity: data?.nfseMetrics?.cancelledNfse?.value ?? 0, total: totalNfse, icon: LucideXCircle, color: "red" as const },
  ];

  // --- Bank Slip Status ---
  const totalBankSlips = data?.bankSlipMetrics?.totalBankSlips?.value ?? 0;
  const bankSlipStatusData = [
    { status: "Ativos", quantity: data?.bankSlipMetrics?.activeBankSlips?.value ?? 0, total: totalBankSlips, icon: LucideCreditCard, color: "blue" as const },
    { status: "Vencidos", quantity: data?.bankSlipMetrics?.overdueBankSlips?.value ?? 0, total: totalBankSlips, icon: LucideAlertTriangle, color: "red" as const },
    { status: "Pagos", quantity: data?.bankSlipMetrics?.paidBankSlips?.value ?? 0, total: totalBankSlips, icon: LucideCheckCircle, color: "green" as const },
  ];

  // --- Quote Status ---
  const totalQuotes = data?.quoteMetrics?.totalQuotes?.value ?? 0;
  const quoteStatusData = [
    { status: "Pendentes", quantity: data?.quoteMetrics?.pendingQuotes?.value ?? 0, total: totalQuotes, icon: LucideClock, color: "orange" as const },
    { status: "Aprovados", quantity: data?.quoteMetrics?.approvedQuotes?.value ?? 0, total: totalQuotes, icon: LucideCheckCircle, color: "green" as const },
    { status: "Liquidados", quantity: data?.quoteMetrics?.settledQuotes?.value ?? 0, total: totalQuotes, icon: LucideDollarSign, color: "blue" as const },
  ];

  // --- Customer Analysis ---
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

  // --- Monthly Revenue Analysis ---
  const getMonthlyRevenueAnalysis = (): AnalysisData[] => {
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
  };

  // --- Recent Activities ---
  const getRecentActivities = (): Activity[] => {
    if (!data?.recentActivities?.length) return [];
    return data.recentActivities.map((activity) => ({
      item: activity.title,
      info: activity.description,
      quantity: activity.type ?? "",
      time: new Date(activity.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    }));
  };

  return (
    <PrivilegeRoute requiredPrivilege={requiredPrivilege}>
      <div className="h-full flex flex-col bg-background">
        {headerContent}

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
          {/* Financial Health KPIs */}
          <DashboardSection title="Saude Financeira">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TrendCard
                title="Taxa de Recebimento"
                value={formatPercent(collectionRate)}
                trend={deriveTrend(collectionRate, 70)}
                percentage={Math.round(collectionRate)}
                icon={LucidePercent}
                subtitle={`${formatCurrency(totalPaid)} de ${formatCurrency(totalInvoiced)}`}
              />
              <TrendCard
                title="Taxa de Inadimplencia"
                value={formatPercent(overdueRate)}
                trend={overdueRate > 10 ? "down" : overdueRate > 0 ? "stable" : "up"}
                percentage={Math.round(overdueRate)}
                icon={LucideAlertTriangle}
                subtitle={overdueAmount > 0 ? `${formatCurrency(overdueAmount)} vencido` : "Nenhum vencido"}
              />
              <TrendCard
                title="Pendente de Recebimento"
                value={formatCurrency(totalPending)}
                trend={pendingRate > 50 ? "down" : "stable"}
                percentage={Math.round(pendingRate)}
                icon={LucideClock}
                subtitle={`${formatPercent(pendingRate)} do faturado`}
              />
              <TrendCard
                title="Total de Orcamentos"
                value={totalQuotes}
                trend={totalQuotes > 0 ? "up" : "stable"}
                percentage={totalQuotes > 0 && data?.quoteMetrics?.approvedQuotes?.value ? Math.round((data.quoteMetrics.approvedQuotes.value / totalQuotes) * 100) : 0}
                icon={LucideClipboardList}
                subtitle={`${data?.quoteMetrics?.approvedQuotes?.value ?? 0} aprovados`}
              />
            </div>
          </DashboardSection>

          {/* Quick Access */}
          <DashboardSection title="Acesso Rapido">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                count={totalInvoices}
                color="green"
              />
              <QuickAccessCard
                title="Notas Fiscais"
                icon={LucideReceipt}
                onClick={() => navigate(routes.financial.nfse.root)}
                count={totalNfse}
                color="purple"
              />
              <QuickAccessCard
                title="Orcamentos"
                icon={LucideClipboardList}
                onClick={() => navigate(routes.financial.budget.root)}
                count={totalQuotes}
                color="orange"
              />
            </div>
          </DashboardSection>

          {/* Revenue Metrics */}
          <DashboardSection title="Metricas de Receita">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <TrendCard
                title="Total Faturado"
                value={formatCurrency(totalInvoiced)}
                trend={totalInvoiced > 0 ? "up" : "stable"}
                percentage={0}
                icon={LucideDollarSign}
                subtitle="Valor total faturado"
              />
              <TrendCard
                title="Total Recebido"
                value={formatCurrency(totalPaid)}
                trend={totalPaid > 0 ? "up" : "stable"}
                percentage={Math.round(collectionRate)}
                icon={LucideTrendingUp}
                subtitle={`${formatPercent(collectionRate)} do faturado`}
              />
              <TrendCard
                title="Total Pendente"
                value={formatCurrency(totalPending)}
                trend={pendingRate > 50 ? "down" : "stable"}
                percentage={Math.round(pendingRate)}
                icon={LucideClock}
                subtitle="A receber"
              />
              <TrendCard
                title="Boletos Vencidos"
                value={formatCurrency(overdueAmount)}
                trend={overdueAmount > 0 ? "down" : "up"}
                percentage={Math.round(overdueRate)}
                icon={LucideTrendingDown}
                subtitle={overdueAmount > 0 ? `${formatPercent(overdueRate)} do faturado` : "Sem atraso"}
              />
              <TrendCard
                title="NFS-e Autorizadas"
                value={data?.revenueMetrics?.authorizedNfse?.value ?? 0}
                trend={(data?.revenueMetrics?.authorizedNfse?.value ?? 0) > 0 ? "up" : "stable"}
                percentage={totalNfse > 0 ? Math.round(((data?.revenueMetrics?.authorizedNfse?.value ?? 0) / totalNfse) * 100) : 0}
                icon={LucideReceipt}
                subtitle={`de ${totalNfse} notas emitidas`}
              />
            </div>
          </DashboardSection>

          {/* Invoice Status Distribution */}
          <DashboardSection title="Status das Faturas">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {invoiceStatusData.map((status, index) => (
                <StatusCard
                  key={index}
                  status={status.status}
                  quantity={status.quantity}
                  total={status.total}
                  icon={status.icon}
                  color={status.color}
                  unit="faturas"
                />
              ))}
            </div>
          </DashboardSection>

          {/* Bank Slips & NFS-e Status — side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashboardSection title="Status dos Boletos">
              <div className="grid grid-cols-3 gap-4">
                {bankSlipStatusData.map((status, index) => (
                  <StatusCard
                    key={index}
                    status={status.status}
                    quantity={status.quantity}
                    total={status.total}
                    icon={status.icon}
                    color={status.color}
                    unit="boletos"
                  />
                ))}
              </div>
            </DashboardSection>

            <DashboardSection title="Status das NFS-e">
              <div className="grid grid-cols-3 gap-4">
                {nfseStatusData.map((status, index) => (
                  <StatusCard
                    key={index}
                    status={status.status}
                    quantity={status.quantity}
                    total={status.total}
                    icon={status.icon}
                    color={status.color}
                    unit="notas"
                  />
                ))}
              </div>
            </DashboardSection>
          </div>

          {/* Quote Metrics */}
          <DashboardSection title="Orcamentos">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatusCard
                status="Total"
                quantity={totalQuotes}
                total={totalQuotes}
                icon={LucideClipboardList}
                color="blue"
                unit="orcamentos"
              />
              {quoteStatusData.map((status, index) => (
                <StatusCard
                  key={index}
                  status={status.status}
                  quantity={status.quantity}
                  total={status.total}
                  icon={status.icon}
                  color={status.color}
                  unit="orcamentos"
                />
              ))}
            </div>
          </DashboardSection>

          {/* Activity Patterns */}
          <DashboardSection title="Padroes de Atividade">
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
                title="Faturas por Status"
                data={
                  data?.invoicesByStatus?.labels?.map((label, index) => ({
                    label: label,
                    value: data.invoicesByStatus.datasets[0]?.data[index] || 0,
                  })) || []
                }
                icon={LucideFileCheck}
                color="purple"
              />
            </div>
          </DashboardSection>

          {/* Analysis & Recent Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DashboardSection title="Analises">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnalysisCard
                    title="Receita por Cliente"
                    type="REVENUE"
                    data={getCustomerAnalysis()}
                    icon={LucidePieChart}
                    onDetailsClick={() => navigate(routes.financial.customers.root)}
                  />
                  <AnalysisCard
                    title="Faturamento Mensal"
                    type="REVENUE"
                    data={getMonthlyRevenueAnalysis()}
                    icon={LucideChartBar}
                    onDetailsClick={() => navigate(routes.financial.billing.root)}
                  />
                </div>
              </DashboardSection>
            </div>

            <DashboardSection title="Atividades Recentes">
              <RecentActivitiesCard
                title="Ultimas Movimentacoes"
                activities={getRecentActivities()}
                icon={LucideActivity}
                color="blue"
              />
            </DashboardSection>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
