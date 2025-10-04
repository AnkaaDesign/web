import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGarage } from "../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAlertTriangle, IconBuilding, IconRefresh, IconEdit, IconRuler2, IconMapPin, IconCar, IconRoad } from "@tabler/icons-react";
import { toast } from "sonner";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "../../../../utils";
import { Badge } from "@/components/ui/badge";
import { GarageLayoutPreview } from "../layout-preview";

export const GarageDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useGarage(id!, {
    include: {
      lanes: {
        include: {
          parkingSpots: true,
        },
        orderBy: { createdAt: "asc" },
      },
      trucks: {
        include: {
          task: {
            include: {
              customer: true,
            },
          },
        },
      },
    },
    enabled: !!id,
  });

  const garage = response?.data;

  // Calculate garage metrics
  const metrics = useMemo(() => {
    if (!garage) return null;

    const totalLanes = garage.lanes?.length || 0;
    const totalSpots = garage.lanes?.reduce((sum, lane) => sum + (lane.parkingSpots?.length || 0), 0) || 0;

    // TODO: Implement truck-parking spot relationship
    const occupiedSpots = 0; // Placeholder until truck-parking relationship is implemented
    const availableSpots = totalSpots - occupiedSpots;
    const occupancyRate = totalSpots > 0 ? (occupiedSpots / totalSpots) * 100 : 0;

    // Calculate area
    const area = garage.width * garage.length;

    // Calculate average lane dimensions
    const avgLaneWidth = totalLanes > 0 ? garage.lanes!.reduce((sum, lane) => sum + lane.width, 0) / totalLanes : 0;
    const avgLaneLength = totalLanes > 0 ? garage.lanes!.reduce((sum, lane) => sum + lane.length, 0) / totalLanes : 0;

    return {
      totalLanes,
      totalSpots,
      occupiedSpots,
      availableSpots,
      occupancyRate,
      area,
      avgLaneWidth,
      avgLaneLength,
    };
  }, [garage]);

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
          <div className="h-96 bg-muted rounded-xl lg:col-span-2"></div>
          <div className="h-96 bg-muted rounded-xl lg:col-span-2"></div>
        </div>
      </div>
    );
  }

  if (error || !garage) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="text-center px-4 max-w-md mx-auto">
          <div className="animate-in fade-in-50 duration-500">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <IconAlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Garagem não encontrada</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A garagem que você está procurando não existe ou foi removida do sistema.</p>
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
    navigate(routes.production.garages.edit(garage.id));
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Dados atualizados com sucesso");
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Section */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={garage.name}
          icon={IconBuilding}
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
            { label: garage.name },
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
                      <p className="text-lg font-semibold">{garage.width.toFixed(2)} m</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comprimento</p>
                      <p className="text-lg font-semibold">{garage.length.toFixed(2)} m</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Área Total</p>
                    <p className="text-lg font-semibold">{metrics?.area.toFixed(2)} m²</p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Criada em</p>
                    <p className="text-sm">{formatDateTime(garage.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Capacity Metrics Card */}
              <Card className="shadow-sm border border-border" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconMapPin className="h-5 w-5 text-primary" />
                    </div>
                    Capacidade e Ocupação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{metrics?.totalLanes}</p>
                      <p className="text-sm text-muted-foreground">Faixas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{metrics?.totalSpots}</p>
                      <p className="text-sm text-muted-foreground">Total Vagas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{metrics?.availableSpots}</p>
                      <p className="text-sm text-muted-foreground">Disponíveis</p>
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

                  {metrics && metrics.totalLanes > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Dimensões Médias das Faixas</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">{metrics.avgLaneWidth.toFixed(1)} m largura</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{metrics.avgLaneLength.toFixed(1)} m comprimento</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Layout Preview Card */}
              <GarageLayoutPreview garage={garage} className="shadow-sm border border-border lg:col-span-2" />

              {/* Lanes Overview Card */}
              <Card className="shadow-sm border border-border lg:col-span-2" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconRoad className="h-5 w-5 text-primary" />
                    </div>
                    Faixas de Estacionamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {garage.lanes && garage.lanes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {garage.lanes.map((lane, index) => {
                        const laneSpots = lane.parkingSpots?.length || 0;
                        // TODO: Calculate occupied spots when truck-parking relationship is implemented
                        const laneOccupied = 0;
                        const laneOccupancyRate = laneSpots > 0 ? (laneOccupied / laneSpots) * 100 : 0;

                        return (
                          <div
                            key={lane.id}
                            className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() => navigate(routes.production.garages.lanes.details(garage.id, lane.id))}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold">Faixa {index + 1}</h4>
                              <IconRoad className="h-4 w-4 text-muted-foreground" />
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Vagas:</span>
                                <span className="font-medium">{laneSpots}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Disponíveis:</span>
                                <span className="font-medium text-green-600">{laneSpots - laneOccupied}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Dimensões:</span>
                                <span className="font-medium">
                                  {lane.width}×{lane.length}m
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Posição:</span>
                                <span className="font-medium">
                                  ({lane.xPosition}, {lane.yPosition})
                                </span>
                              </div>
                            </div>

                            {laneSpots > 0 && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-muted-foreground">Ocupação</span>
                                  <span className="text-xs font-medium">{laneOccupancyRate.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${laneOccupancyRate}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhuma faixa cadastrada nesta garagem</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(routes.production.garages.lanes.create(garage.id))}>
                        Cadastrar Faixas
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trucks Overview Card */}
              <Card className="shadow-sm border border-border lg:col-span-2" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconCar className="h-5 w-5 text-primary" />
                    </div>
                    Caminhões na Garagem
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {garage.trucks && garage.trucks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {garage.trucks.map((truck) => (
                        <div
                          key={truck.id}
                          className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => navigate(routes.production.trucks.details(truck.id))}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{truck.plate}</h4>
                            <IconCar className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="space-y-1 text-sm">
                            {truck.task && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">OS:</span>
                                  <span className="font-medium">{truck.task.serialNumber}</span>
                                </div>
                                {truck.task.customer && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cliente:</span>
                                    <span className="font-medium truncate">{truck.task.customer.fantasyName || truck.task.customer.corporateName}</span>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Entrada:</span>
                              <span className="font-medium">{formatDateTime(truck.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhum caminhão na garagem no momento</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Changelog History */}
              <div className="lg:col-span-2">
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.GARAGE}
                  entityId={garage.id}
                  entityName={garage.name}
                  entityCreatedAt={garage.createdAt}
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
