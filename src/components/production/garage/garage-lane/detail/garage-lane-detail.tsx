import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGarageLane } from "../../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../../constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAlertTriangle, IconRoad, IconRefresh, IconEdit, IconRuler2, IconMapPin, IconPackageExport } from "@tabler/icons-react";
import { toast } from "sonner";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "../../../../../utils";
import { GarageLaneLayoutPreview } from "../../layout-preview";

export const GarageLaneDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useGarageLane(id!, {
    include: {
      garage: true,
      parkingSpots: {
        include: {
          truck: true,
        },
        orderBy: { name: "asc" },
      },
    },
    enabled: !!id,
  });

  const garageLane = response?.data;

  // Calculate occupancy metrics
  const metrics = useMemo(() => {
    if (!garageLane) return null;

    const totalSpots = garageLane.parkingSpots?.length || 0;
    // TODO: Implement truck-parking spot relationship
    // const occupiedSpots = garageLane.parkingSpots?.filter(spot => spot.truck)?.length || 0;
    const occupiedSpots = 0; // Placeholder until truck-parking relationship is implemented
    const availableSpots = totalSpots - occupiedSpots;
    const occupancyRate = totalSpots > 0 ? (occupiedSpots / totalSpots) * 100 : 0;

    // Calculate area
    const area = garageLane.width * garageLane.length;

    return {
      totalSpots,
      occupiedSpots,
      availableSpots,
      occupancyRate,
      area,
    };
  }, [garageLane]);

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
            </div>
          </div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !garageLane) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="text-center px-4 max-w-md mx-auto">
          <div className="animate-in fade-in-50 duration-500">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <IconAlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Faixa não encontrada</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A faixa que você está procurando não existe ou foi removida do sistema.</p>
            <div className="space-y-3">
              <Button onClick={() => navigate(routes.production.garages.list)} className="w-full sm:w-auto">
                Ir para Lista de Garagens
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    navigate(routes.production.garages.lanes.edit(garageLane.garageId, garageLane.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Section */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={`Faixa ${garageLane.id.slice(0, 8)}`}
          icon={IconRoad}
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
            { label: "Produção", href: routes.production.root },
            { label: "Garagens", href: routes.production.garages.list },
            { label: garageLane.garage?.name || "Garagem", href: routes.production.garages.details(garageLane.garageId) },
            { label: `Faixa ${garageLane.id.slice(0, 8)}` },
          ]}
          className="shadow-lg"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Core Information Grid */}
          <div className="animate-in fade-in-50 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Specifications Card */}
              <Card className="shadow-sm border border-border" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconRuler2 className="h-5 w-5 text-primary" />
                    </div>
                    Especificações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Largura</p>
                      <p className="text-lg font-semibold">{garageLane.width.toFixed(2)} m</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comprimento</p>
                      <p className="text-lg font-semibold">{garageLane.length.toFixed(2)} m</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Área Total</p>
                    <p className="text-lg font-semibold">{metrics?.area.toFixed(2)} m²</p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Posição na Garagem</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <IconMapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">X: {garageLane.xPosition}m</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconMapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Y: {garageLane.yPosition}m</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Criada em</p>
                    <p className="text-sm">{formatDateTime(garageLane.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Occupancy Metrics Card */}
              <Card className="shadow-sm border border-border" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconPackageExport className="h-5 w-5 text-primary" />
                    </div>
                    Ocupação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{metrics?.totalSpots}</p>
                      <p className="text-sm text-muted-foreground">Total de Vagas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{metrics?.availableSpots}</p>
                      <p className="text-sm text-muted-foreground">Disponíveis</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">{metrics?.occupiedSpots}</p>
                      <p className="text-sm text-muted-foreground">Ocupadas</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Taxa de Ocupação</p>
                      <p className="text-lg font-semibold">{metrics?.occupancyRate.toFixed(1)}%</p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${metrics?.occupancyRate}%` }} />
                    </div>
                  </div>

                  {metrics && metrics.totalSpots === 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground text-center">Nenhuma vaga cadastrada nesta faixa</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Layout Preview Card */}
              <GarageLaneLayoutPreview garageLane={garageLane} className="shadow-sm border border-border lg:col-span-2" />

              {/* Parking Spots Card */}
              <Card className="shadow-sm border border-border lg:col-span-2" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconPackageExport className="h-5 w-5 text-primary" />
                    </div>
                    Vagas de Estacionamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {garageLane.parkingSpots && garageLane.parkingSpots.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {garageLane.parkingSpots.map((spot) => (
                        <div
                          key={spot.id}
                          className={`
                        p-3 rounded-lg border-2 transition-all cursor-pointer
                        ${
                          // TODO: Implement truck-parking spot relationship
                          // spot.truck
                          false
                            ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:border-orange-300"
                            : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300"
                        }
                      `}
                          onClick={() => navigate(routes.production.garages.parkingSpots.details(garageLane.garageId, spot.id))}
                        >
                          <p className="font-semibold text-sm text-center">{spot.name}</p>
                          <p className="text-xs text-center text-muted-foreground mt-1">
                            {/* TODO: Implement truck-parking spot relationship */}
                            {/* {spot.truck ? "Ocupada" : "Livre"} */}
                            Livre
                          </p>
                          {/* TODO: Implement truck-parking spot relationship */}
                          {/* {spot.truck && (
                        <p className="text-xs text-center font-medium mt-1 truncate">
                          {spot.truck.plate}
                        </p>
                      )} */}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhuma vaga cadastrada nesta faixa</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(routes.production.garages.parkingSpots.create(garageLane.garageId))}>
                        Cadastrar Vagas
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Changelog History */}
              <div className="lg:col-span-2">
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.GARAGE_LANE}
                  entityId={garageLane.id}
                  entityName={`Faixa ${garageLane.id.slice(0, 8)}`}
                  entityCreatedAt={garageLane.createdAt}
                  className="shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
