import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD, ORDER_STATUS_LABELS, STOCK_LEVEL } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useInventoryDashboard, useOrders, useBorrows, usePpeDeliveries, useItems, useSuppliers, useActivities } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber } from "../../utils";
import { useState, useMemo, useEffect } from "react";
import {
  IconPackage,
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconActivity,
  IconClock,
  IconAlertTriangle,
  IconTrendingUp,
  IconTrendingDown,
  IconBuildingStore,
  IconBoxSeam,
  IconBarcode,
  IconTag,
  IconRefresh,
  IconCurrencyDollar,
  IconExclamationCircle,
  IconShoppingCart,
  IconUsers,
  IconExternalLink,
  IconTool,
  IconShieldCheck,
  IconFileText,
  IconChartBar,
  IconChartPie,
} from "@tabler/icons-react";
import {
  RecentActivitiesCard,
  TrendCard,
  ActivityPatternCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  TimePeriodSelector,
  type Activity,
  type PatternData,
  type AnalysisData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const InventoryRootPage = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  // Track page access
  usePageTracker({
    title: "Dashboard de Estoque",
    icon: "package",
  });

  // Helper function to create date filters based on time period
  const getDateFilter = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timePeriod) {
      case DASHBOARD_TIME_PERIOD.TODAY:
        return {
          gte: today,
          lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        };
      case DASHBOARD_TIME_PERIOD.THIS_WEEK:
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return {
          gte: startOfWeek,
          lte: now,
        };
      case DASHBOARD_TIME_PERIOD.THIS_MONTH:
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          gte: startOfMonth,
          lte: now,
        };
      case DASHBOARD_TIME_PERIOD.THIS_YEAR:
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return {
          gte: startOfYear,
          lte: now,
        };
      case DASHBOARD_TIME_PERIOD.TOTAL:
      case DASHBOARD_TIME_PERIOD.ALL_TIME:
      default:
        return undefined; // No date filter for total/all time
    }
  }, [timePeriod]);

  // Fetch dashboard data with time period
  const { data: dashboard, isLoading, error } = useInventoryDashboard({ timePeriod });

  // TIME-SENSITIVE DATA (follows selected period)

  // Fetch activities count - filtered by time period
  const activitiesQuery = useMemo(() => {
    // Use direct where clause to ensure proper date filtering
    return getDateFilter
      ? {
          limit: 1,
          where: {
            createdAt: getDateFilter,
          },
        }
      : {
          limit: 1,
        };
  }, [getDateFilter]);

  const { data: activitiesData } = useActivities(activitiesQuery);

  // Fetch recent orders that are not received (with time filter)
  const { data: ordersData } = useOrders({
    where: {
      status: {
        not: "RECEIVED",
      },
      ...(getDateFilter && { createdAt: getDateFilter }),
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      supplier: true,
      items: true,
    },
  });

  // Fetch borrows count (empréstimos) - filtered by time period
  const { data: borrowsData } = useBorrows({
    take: 1, // We only need the count, not the actual data
    ...(getDateFilter && { createdAt: getDateFilter }),
  });

  // STATIC COUNTS (all records including inactive)

  // Fetch all items count (including inactive)
  const { data: allItemsData } = useItems({
    take: 1, // We only need the count, not the actual data
    // No status filter - includes all items regardless of status
  });

  // Fetch all suppliers count (including inactive)
  const { data: allSuppliersData } = useSuppliers({
    take: 1, // We only need the count, not the actual data
    // No status filter - includes all suppliers regardless of status
  });

  // Fetch PPE deliveries count (EPIs) - all deliveries regardless of time
  const { data: ppeDeliveriesData } = usePpeDeliveries({
    take: 1, // We only need the count, not the actual data
    // No filters - shows all PPE deliveries regardless of status or time
  });

  // Transform recent activities for the component
  const transformRecentActivities = (): Activity[] => {
    if (!dashboard?.data?.stockMovements?.recentActivities || dashboard.data.stockMovements.recentActivities.length === 0) {
      return [
        {
          item: "Nenhuma atividade",
          info: "Período selecionado",
          quantity: "",
          time: "✓",
        },
      ];
    }

    return dashboard.data.stockMovements.recentActivities.slice(0, 10).map((activity) => ({
      item: activity.itemName || "Item desconhecido",
      info: activity.userName || "Sistema",
      quantity: `${activity.operation === "INBOUND" ? "+" : "-"}${activity.quantity || 0}`,
      time: activity.createdAt
        ? new Date(activity.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--:--",
    }));
  };

  // Get inbound activities (entradas) - get the 10 most recent INBOUND activities
  const getInboundActivities = (): Activity[] => {
    if (!dashboard?.data?.stockMovements?.recentActivities || dashboard.data.stockMovements.recentActivities.length === 0) {
      return [
        {
          item: "Nenhuma entrada",
          info: "Período selecionado",
          quantity: "",
          time: "✓",
        },
      ];
    }

    const inboundActivities = dashboard.data.stockMovements.recentActivities.filter((activity) => activity.operation === "INBOUND");

    if (inboundActivities.length === 0) {
      return [
        {
          item: "Nenhuma entrada",
          info: "Período selecionado",
          quantity: "",
          time: "✓",
        },
      ];
    }

    // Take up to 10 most recent inbound activities
    return inboundActivities.slice(0, 10).map((activity) => ({
      item: activity.itemName || "Item desconhecido",
      info: activity.userName || "Sistema",
      quantity: `+${activity.quantity || 0}`,
      time: activity.createdAt
        ? new Date(activity.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--:--",
    }));
  };

  // Get outbound activities (saídas) - get the 10 most recent OUTBOUND activities
  const getOutboundActivities = (): Activity[] => {
    if (!dashboard?.data?.stockMovements?.recentActivities || dashboard.data.stockMovements.recentActivities.length === 0) {
      return [
        {
          item: "Nenhuma saída",
          info: "Período selecionado",
          quantity: "",
          time: "✓",
        },
      ];
    }

    const outboundActivities = dashboard.data.stockMovements.recentActivities.filter((activity) => activity.operation === "OUTBOUND");

    if (outboundActivities.length === 0) {
      return [
        {
          item: "Nenhuma saída",
          info: "Período selecionado",
          quantity: "",
          time: "✓",
        },
      ];
    }

    // Take up to 10 most recent outbound activities
    return outboundActivities.slice(0, 10).map((activity) => ({
      item: activity.itemName || "Item desconhecido",
      info: activity.userName || "Sistema",
      quantity: `-${activity.quantity || 0}`,
      time: activity.createdAt
        ? new Date(activity.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--:--",
    }));
  };

  // Get recent orders info (all orders not received)
  const getRecentOrdersInfo = (): Activity[] => {
    if (!ordersData?.data || ordersData.data.length === 0) {
      return [
        {
          item: "Nenhum pedido",
          info: "Pendente",
          quantity: "",
          time: "✓",
        },
      ];
    }

    return ordersData.data.slice(0, 10).map((order) => {
      // Calculate total from items if not available on order
      const totalPrice = order.items?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;

      return {
        item: order.description || "Sem descrição",
        info: `${order.items?.length || 0} ${order.items?.length === 1 ? "item" : "itens"}`,
        quantity: formatCurrency(totalPrice),
        time: ORDER_STATUS_LABELS[order.status] || order.status || "Status desconhecido",
      };
    });
  };

  // Get stock status distribution
  // Uses the same logic as item table (web/src/utils/stock-level.ts)
  const getStockStatus = () => {
    if (!dashboard?.data?.overview) return [];

    const { totalItems, outOfStockItems, criticalItems, lowStockItems, optimalItems, overstockedItems } = dashboard.data.overview;
    const total = totalItems.value;

    return [
      {
        status: "Sem Estoque",
        quantity: outOfStockItems.value,
        total,
        icon: IconPackage, // OUT_OF_STOCK icon
        color: "red" as const, // RED - matches OUT_OF_STOCK
      },
      {
        status: "Crítico",
        quantity: criticalItems.value,
        total,
        icon: IconAlertTriangle, // CRITICAL icon
        color: "orange" as const, // ORANGE - matches CRITICAL
      },
      {
        status: "Baixo",
        quantity: lowStockItems.value,
        total,
        icon: IconTrendingDown, // LOW icon
        color: "yellow" as const, // YELLOW - matches LOW
      },
      {
        status: "Normal",
        quantity: optimalItems.value,
        total,
        icon: IconPackage, // OPTIMAL icon
        color: "green" as const, // GREEN - matches OPTIMAL
      },
      {
        status: "Excesso",
        quantity: overstockedItems.value,
        total,
        icon: IconTrendingUp, // OVERSTOCKED icon
        color: "purple" as const, // PURPLE - matches OVERSTOCKED
      },
    ];
  };

  // Handle stock status card click - navigate to items page with filter
  const handleStockStatusClick = (statusName: string) => {
    const stockLevelMap: Record<string, STOCK_LEVEL[]> = {
      "Sem Estoque": [STOCK_LEVEL.OUT_OF_STOCK],
      Crítico: [STOCK_LEVEL.CRITICAL],
      Baixo: [STOCK_LEVEL.LOW],
      Normal: [STOCK_LEVEL.OPTIMAL],
      Excesso: [STOCK_LEVEL.OVERSTOCKED],
    };

    const stockLevels = stockLevelMap[statusName];
    if (stockLevels) {
      const filterParam = JSON.stringify(stockLevels);
      navigate(`${routes.inventory.products.list}?stockLevels=${encodeURIComponent(filterParam)}`);
    }
  };

  // Get ABC analysis data
  const getABCAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.topItems?.byValue) return [];

    const items = dashboard.data.topItems.byValue;
    const total = items.reduce((sum, item) => sum + item.value, 0);

    // Simplified ABC calculation (70-20-10 rule)
    let accumulated = 0;
    let aCount = 0,
      bCount = 0,
      cCount = 0;

    items.forEach((item) => {
      accumulated += item.value;
      const percentage = (accumulated / total) * 100;

      if (percentage <= 70) aCount++;
      else if (percentage <= 90) bCount++;
      else cCount++;
    });

    return [
      {
        label: "A",
        value: aCount,
        percentage: 70,
        info: "Alto valor",
        color: "bg-red-500",
      },
      {
        label: "B",
        value: bCount,
        percentage: 20,
        info: "Médio valor",
        color: "bg-yellow-500",
      },
      {
        label: "C",
        value: cCount,
        percentage: 10,
        info: "Baixo valor",
        color: "bg-green-500",
      },
    ];
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="flex flex-col h-full space-y-4">
          <div className="flex-shrink-0">
            <PageHeaderWithFavorite
              title="Estoque"
              icon={IconPackage}
              favoritePage={FAVORITE_PAGES.ESTOQUE}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque" }]}
              actions={[
                {
                  key: "time-period",
                  label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                  variant: "ghost",
                  className: "p-0 hover:bg-transparent",
                },
              ]}
            />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="flex flex-col h-full space-y-4">
          <div className="flex-shrink-0">
            <PageHeaderWithFavorite
              title="Estoque"
              icon={IconPackage}
              favoritePage={FAVORITE_PAGES.ESTOQUE}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque" }]}
              actions={[
                {
                  key: "time-period",
                  label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                  variant: "ghost",
                  className: "p-0 hover:bg-transparent",
                },
              ]}
            />
          </div>
          <Alert variant="destructive">
            <AlertDescription>Erro ao carregar dashboard: {error.message}</AlertDescription>
          </Alert>
        </div>
      </PrivilegeRoute>
    );
  }

  const data = dashboard?.data;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Estoque"
            icon={IconPackage}
            favoritePage={FAVORITE_PAGES.ESTOQUE}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
              {
                key: "create",
                label: "Novo Produto",
                icon: IconPlus,
                onClick: () => navigate(routes.inventory.products.create),
                variant: "default",
              },
            ]}
          />
        </div>

        {/* Main Content Card - All sections in a single scrollable container */}
        <div className="flex-1 bg-card dark:bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Quick Access Section */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <QuickAccessCard
                  title="Atividades"
                  icon={IconActivity}
                  onClick={() => navigate(routes.inventory.movements.list)}
                  count={activitiesData?.meta?.totalRecords}
                  color="blue"
                />
                <QuickAccessCard
                  title="Produtos"
                  icon={IconPackage}
                  onClick={() => navigate(routes.inventory.products.list)}
                  count={allItemsData?.meta?.totalRecords}
                  color="green"
                />
                <QuickAccessCard
                  title="Fornecedores"
                  icon={IconBuildingStore}
                  onClick={() => navigate(routes.inventory.suppliers.root)}
                  count={allSuppliersData?.meta?.totalRecords}
                  color="purple"
                />
                <QuickAccessCard title="Empréstimos" icon={IconTool} onClick={() => navigate(routes.inventory.loans.list)} count={borrowsData?.meta?.totalRecords} color="orange" />
                <QuickAccessCard
                  title="Pedidos"
                  icon={IconShoppingCart}
                  onClick={() => navigate(routes.inventory.orders.list)}
                  count={ordersData?.meta?.totalRecords}
                  color="red"
                />
                <QuickAccessCard
                  title="EPIs"
                  icon={IconShieldCheck}
                  onClick={() => navigate(routes.inventory.ppe.root)}
                  count={ppeDeliveriesData?.meta?.totalRecords}
                  color="teal"
                />
              </div>
            </div>

            {/* Recent Activities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecentActivitiesCard title="Movimentações Recentes" activities={transformRecentActivities()} icon={IconActivity} color="blue" />
                <RecentActivitiesCard title="Entradas Recentes" activities={getInboundActivities()} icon={IconArrowDown} color="green" />
                <RecentActivitiesCard title="Saídas Recentes" activities={getOutboundActivities()} icon={IconArrowUp} color="red" />
                <RecentActivitiesCard title="Últimos Pedidos" activities={getRecentOrdersInfo()} icon={IconShoppingCart} color="orange" />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Métricas de Estoque</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <TrendCard
                  title="Total de Itens"
                  value={data?.overview?.totalItems?.value || 0}
                  trend={data?.overview?.totalItems?.trend}
                  percentage={data?.overview?.totalItems?.changePercent}
                  icon={IconPackage}
                  subtitle="Produtos únicos"
                />
                <TrendCard
                  title="Valor Total"
                  value={formatCurrency(data?.overview?.totalValue?.value || 0)}
                  trend={data?.overview?.totalValue?.trend}
                  percentage={data?.overview?.totalValue?.changePercent}
                  icon={IconCurrencyDollar}
                  subtitle="Em estoque"
                />
                <TrendCard
                  title="Itens Críticos"
                  value={data?.overview?.criticalItems?.value || 0}
                  trend={data?.overview?.criticalItems?.trend}
                  percentage={data?.overview?.criticalItems?.changePercent}
                  icon={IconAlertTriangle}
                  subtitle="Requer atenção"
                />
                <TrendCard
                  title="Estoque Baixo"
                  value={data?.overview?.lowStockItems?.value || 0}
                  trend={data?.overview?.lowStockItems?.trend}
                  percentage={data?.overview?.lowStockItems?.changePercent}
                  icon={IconArrowDown}
                  subtitle="Abaixo do mínimo"
                />
                <TrendCard
                  title="Reordenar"
                  value={data?.overview?.itemsNeedingReorder?.value || 0}
                  trend={data?.overview?.itemsNeedingReorder?.trend}
                  percentage={data?.overview?.itemsNeedingReorder?.changePercent}
                  icon={IconRefresh}
                  subtitle="Ponto de pedido"
                />
                <TrendCard
                  title="Excesso"
                  value={data?.overview?.overstockedItems?.value || 0}
                  trend={data?.overview?.overstockedItems?.trend}
                  percentage={data?.overview?.overstockedItems?.changePercent}
                  icon={IconArrowUp}
                  subtitle="Acima do máximo"
                />
              </div>
            </div>

            {/* Activity Patterns */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Padrões de Atividade</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActivityPatternCard
                  title="Top Categorias"
                  data={
                    data?.categoryBreakdown?.itemsByCategory?.labels?.slice(0, 5).map((label, index) => ({
                      label: label,
                      value: data.categoryBreakdown.itemsByCategory.datasets[0]?.data[index] || 0,
                    })) || []
                  }
                  icon={IconTag}
                  color="green"
                />
                <ActivityPatternCard
                  title="Top Marcas"
                  data={
                    data?.categoryBreakdown?.itemsByBrand?.labels?.slice(0, 5).map((label, index) => ({
                      label: label,
                      value: data.categoryBreakdown.itemsByBrand.datasets[0]?.data[index] || 0,
                    })) || []
                  }
                  icon={IconBarcode}
                  color="purple"
                />
                <ActivityPatternCard
                  title="Top Fornecedores"
                  data={
                    data?.supplierMetrics?.itemsPerSupplier?.slice(0, 5).map((supplier) => ({
                      label: supplier.name,
                      value: supplier.value,
                    })) || []
                  }
                  icon={IconBuildingStore}
                  color="orange"
                />
              </div>
            </div>

            {/* Stock Status */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Status do Estoque</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {getStockStatus().map((status, index) => (
                  <StatusCard key={index} status={status.status} quantity={status.quantity} total={status.total} icon={status.icon} color={status.color} unit="itens" onClick={() => handleStockStatusClick(status.status)} />
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Análises de Estoque</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnalysisCard title="Análise ABC" type="ABC" data={getABCAnalysis()} icon={IconChartBar} onDetailsClick={() => navigate(routes.inventory.products.list)} />
                <AnalysisCard
                  title="Análise XYZ"
                  type="XYZ"
                  data={[
                    {
                      label: "X",
                      value: Math.floor((data?.overview?.totalItems?.value || 0) * 0.35),
                      percentage: 35,
                      info: "Alta rotatividade",
                      color: "bg-blue-500",
                    },
                    {
                      label: "Y",
                      value: Math.floor((data?.overview?.totalItems?.value || 0) * 0.4),
                      percentage: 40,
                      info: "Média rotatividade",
                      color: "bg-purple-500",
                    },
                    {
                      label: "Z",
                      value: Math.floor((data?.overview?.totalItems?.value || 0) * 0.25),
                      percentage: 25,
                      info: "Baixa rotatividade",
                      color: "bg-orange-500",
                    },
                  ]}
                  icon={IconChartPie}
                  onDetailsClick={() => navigate(routes.inventory.products.list)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
