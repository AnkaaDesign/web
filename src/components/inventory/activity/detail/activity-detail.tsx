import { useParams, useNavigate } from "react-router-dom";
import { useActivity } from "../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconPackage, IconRefresh, IconEdit } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { ActivitySpecificationsCard } from "./activity-specifications-card";
import { ActivityItemCard } from "./activity-item-card";
import { ChangelogHistory } from "@/components/ui/changelog-history";

const ActivityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useActivity(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
          supplier: true,
          prices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      order: true,
      orderItem: true,
    },
    enabled: !!id,
  });

  const activity = response?.data;

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
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="text-center px-4 max-w-md mx-auto">
          <div className="animate-in fade-in-50 duration-500">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <IconAlertTriangle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Movimentação não encontrada</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A movimentação que você está procurando não existe ou foi removida do sistema.</p>
            <div className="space-y-3">
              <Button onClick={() => navigate(routes.inventory.movements.list)} className="w-full sm:w-auto">
                Ir para Lista de Movimentações
              </Button>
              <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                Ir para Estoque
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    navigate(routes.inventory.movements.edit(activity.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Hero Section - Enhanced Header with Actions */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={`Movimentação #${activity.id.slice(0, 8)}`}
          icon={IconPackage}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Movimentações", href: routes.inventory.movements.list },
            { label: `Movimentação #${activity.id.slice(0, 8)}` },
          ]}
          actions={[
            {
              label: "Atualizar",
              key: "refresh",
              icon: IconRefresh,
              onClick: handleRefresh,
              variant: "outline",
            },
            {
              label: "Editar",
              key: "edit",
              icon: IconEdit,
              onClick: handleEdit,
              variant: "default",
            },
          ]}
          className="shadow-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Core Information Grid - Specifications and Item */}
          <div className="animate-in fade-in-50 duration-700">
            {/* Mobile: Single column stacked */}
            <div className="block lg:hidden space-y-4">
              <ActivitySpecificationsCard activity={activity} className="h-full" />
              <ActivityItemCard activity={activity} className="h-full" />
            </div>

            {/* Desktop/Tablet: 2 columns grid */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-6">
                <ActivitySpecificationsCard activity={activity} className="h-full" />
                <ActivityItemCard activity={activity} className="h-full" />
              </div>
            </div>
          </div>

          {/* History Section - Changelog only */}
          <div className="animate-in fade-in-50 duration-900">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.ACTIVITY}
                entityId={activity.id}
                entityName={`Movimentação #${activity.id.slice(0, 8)}`}
                entityCreatedAt={activity.createdAt}
                className="h-full shadow-sm"
              />
              {/* Empty space for half-width layout */}
              <div className="hidden lg:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityDetail;
