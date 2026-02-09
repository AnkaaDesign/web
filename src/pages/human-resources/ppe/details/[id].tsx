import { useParams, useNavigate } from "react-router-dom";
import { useItem } from "../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconRefresh, IconEdit } from "@tabler/icons-react";
import { SpecificationsCard } from "@/components/inventory/item/detail/specifications-card";
import { RelatedItemsCard } from "@/components/inventory/item/detail/related-items-card";
import { ActivityHistoryCard } from "@/components/inventory/item/detail/activity-history-card";
import { MetricsCard } from "@/components/inventory/item/detail/metrics-card";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PageHeader } from "@/components/ui/page-header";
import { PpeInfoCard } from "@/components/inventory/item/detail/ppe-info-card";

const EpiDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useItem(id!, {
    include: {
      brand: true,
      category: true,
      supplier: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      activities: {
        include: {
          user: { select: { name: true, id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      relatedItems: {
        include: {
          brand: true,
          category: true,
        },
      },
      relatedTo: {
        include: {
          brand: true,
          category: true,
        },
      },
      orderItems: {
        include: {
          order: {
            include: {
              supplier: true,
              items: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      borrows: {
        include: {
          user: { select: { name: true, id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      changeLogs: {
        include: {
          user: { select: { name: true, id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
    enabled: !!id,
  });

  const item = response?.data;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-16 bg-muted rounded"></div>
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-20 bg-muted rounded"></div>
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-24 bg-muted rounded"></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-muted rounded"></div>
              <div className="h-9 w-20 bg-muted rounded"></div>
              <div className="h-9 w-16 bg-muted rounded"></div>
            </div>
          </div>
        </div>

        {/* Enhanced Header Card Skeleton */}
        <div className="h-48 bg-muted rounded-xl"></div>

        {/* 2x2 Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>

        {/* Related Items Skeleton */}
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="flex gap-4 overflow-hidden">
            <div className="h-32 w-64 bg-muted rounded-xl flex-shrink-0"></div>
            <div className="h-32 w-64 bg-muted rounded-xl flex-shrink-0"></div>
            <div className="h-32 w-64 bg-muted rounded-xl flex-shrink-0"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="text-center px-4 max-w-md mx-auto">
          <div className="animate-in fade-in-50 duration-500">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <IconAlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">EPI não encontrado</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">O EPI que você está procurando não existe ou foi removido do sistema.</p>
            <div className="space-y-3">
              <Button onClick={() => navigate(routes.humanResources.ppe.root)} className="w-full sm:w-auto">
                Ir para Lista de EPIs
              </Button>
              <Button variant="outline" onClick={() => navigate(routes.humanResources.root)} className="w-full sm:w-auto">
                Ir para RH
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    navigate(routes.humanResources.ppe.edit(item.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      {/* Hero Section - Enhanced Header with Actions */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          entity={item}
          title={item.name}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: handleEdit,
            },
          ]}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "RH", href: routes.humanResources.root },
            { label: "EPIs", href: routes.humanResources.ppe.root },
            { label: item.name },
          ]}
          className="shadow-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          {/* Core Information Grid - Specifications and Metrics */}
          <div className="animate-in fade-in-50 duration-700">
            {/* Mobile: Single column stacked */}
            <div className="block lg:hidden space-y-4">
              <SpecificationsCard item={item} className="h-full" />
              <MetricsCard item={item} className="h-full" />
            </div>

            {/* Desktop/Tablet: 2 columns grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <SpecificationsCard item={item} className="h-full" />
                <MetricsCard item={item} className="h-full" />
              </div>
            </div>
          </div>

          {/* PPE Information - Always show for EPIs - Half width on desktop */}
          <div className="animate-in fade-in-50 duration-800">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PpeInfoCard item={item} className="shadow-sm" />
              {/* Empty space for half-width layout */}
              <div className="hidden lg:block" />
            </div>
          </div>

          {/* History Cards - Activity and Changelog */}
          <div className="animate-in fade-in-50 duration-900">
            {/* Mobile: Single column stacked */}
            <div className="block lg:hidden space-y-4">
              <ActivityHistoryCard item={item} className="h-full" />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.ITEM} entityId={item.id} entityName={item.name} entityCreatedAt={item.createdAt} className="h-full" />
            </div>

            {/* Desktop/Tablet: 2 columns grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <ActivityHistoryCard item={item} className="h-full" />
                <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.ITEM} entityId={item.id} entityName={item.name} entityCreatedAt={item.createdAt} className="h-full" />
              </div>
            </div>
          </div>

          {/* Related Items - Full Width Section */}
          <div className="animate-in fade-in-50 duration-1000">
            <RelatedItemsCard item={item} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpiDetailsPage;
