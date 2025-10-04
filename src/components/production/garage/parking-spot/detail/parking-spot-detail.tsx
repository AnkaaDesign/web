import { useParams, useNavigate } from "react-router-dom";
import { useParkingSpot } from "../../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../../constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAlertTriangle, IconCar, IconRefresh, IconEdit, IconRuler, IconRoad } from "@tabler/icons-react";
// IconClock will be needed when truck-parking relationship is implemented
import { toast } from "sonner";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "../../../../../utils";
// formatRelativeTime will be needed when truck-parking relationship is implemented
import { Badge } from "@/components/ui/badge";

export const ParkingSpotDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useParkingSpot(id!, {
    include: {
      garageLane: {
        include: {
          garage: true,
        },
      },
      truck: {
        include: {
          task: {
            include: {
              customer: true,
              services: true,
            },
          },
        },
      },
    },
    enabled: !!id,
  });

  const parkingSpot = response?.data;

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
          <div className="h-64 bg-muted rounded-xl"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl lg:col-span-2"></div>
        </div>
      </div>
    );
  }

  if (error || !parkingSpot) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="text-center px-4 max-w-md mx-auto">
          <div className="animate-in fade-in-50 duration-500">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <IconAlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Vaga não encontrada</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A vaga que você está procurando não existe ou foi removida do sistema.</p>
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
    navigate(routes.production.garages.parkingSpots.edit(parkingSpot.garageLane?.garageId || "", parkingSpot.id));
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Dados atualizados com sucesso");
  };

  // TODO: Implement truck-parking spot relationship
  // const isOccupied = !!parkingSpot.truck;
  const isOccupied = false; // Placeholder until truck-parking relationship is implemented

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Section */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          entity={parkingSpot}
          title={`Vaga ${parkingSpot.name}`}
          icon={IconCar}
          status={isOccupied ? { label: "Ocupada", variant: "destructive" } : { label: "Livre", variant: "outline" }}
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
            {
              label: parkingSpot.garageLane?.garage?.name || "Garagem",
              href: routes.production.garages.details(parkingSpot.garageLane?.garageId || ""),
            },
            {
              label: `Faixa ${parkingSpot.garageLane?.id.slice(0, 8)}`,
              href: routes.production.garages.lanes.details(parkingSpot.garageLane?.garageId || "", parkingSpot.garageLaneId),
            },
            { label: `Vaga ${parkingSpot.name}` },
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
                      <IconRuler className="h-5 w-5 text-primary" />
                    </div>
                    Especificações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome/Número</p>
                    <p className="text-2xl font-bold">{parkingSpot.name}</p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Comprimento</p>
                    <p className="text-lg font-semibold">{parkingSpot.length.toFixed(2)} m</p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Faixa</p>
                    <div className="flex items-center gap-2 mt-1">
                      <IconRoad className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Faixa {parkingSpot.garageLane?.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Posição: ({parkingSpot.garageLane?.xPosition}m, {parkingSpot.garageLane?.yPosition}m)
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Garagem</p>
                    <p className="text-sm font-medium">{parkingSpot.garageLane?.garage?.name || "—"}</p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Criada em</p>
                    <p className="text-sm">{formatDateTime(parkingSpot.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Occupation Status Card */}
              <Card className="shadow-sm border border-border" level={1}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconCar className="h-5 w-5 text-primary" />
                    </div>
                    Status de Ocupação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    {isOccupied ? (
                      <>
                        <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mx-auto mb-4">
                          <IconCar className="h-10 w-10 text-orange-600" />
                        </div>
                        <Badge variant="destructive" className="mb-4">
                          OCUPADA
                        </Badge>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                          <IconCar className="h-10 w-10 text-green-600" />
                        </div>
                        <Badge variant="success" className="mb-4">
                          LIVRE
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* TODO: Implement truck-parking spot relationship
                  Required imports when implementing:
                  - import { IconClock } from "@tabler/icons-react";
                  - import { formatRelativeTime } from "../../../../../utils";
              */}
                  {/* isOccupied && parkingSpot.truck && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Veículo</p>
                    <p className="text-lg font-semibold">{parkingSpot.truck.plate}</p>
                    {parkingSpot.truck.task && (
                      <p className="text-sm text-muted-foreground mt-1">
                        OS: {parkingSpot.truck.task.serialNumber}
                      </p>
                    )}
                  </div>

                  {parkingSpot.truck.createdAt && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Tempo de Ocupação</p>
                      <div className="flex items-center gap-2 mt-1">
                        <IconClock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {formatRelativeTime(parkingSpot.truck.createdAt)}
                        </span>
                      </div>
                    </div>
                  )}

                  {parkingSpot.truck.task?.customer && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="text-sm font-medium">
                        {parkingSpot.truck.task.customer.fantasyName || parkingSpot.truck.task.customer.corporateName}
                      </p>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(routes.production.trucks.details(parkingSpot.truck!.id))}
                    >
                      Ver Detalhes do Caminhão
                    </Button>
                  </div>
                </div>
              ) */}
                </CardContent>
              </Card>

              {/* Changelog History */}
              <div className="lg:col-span-2">
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.PARKING_SPOT}
                  entityId={parkingSpot.id}
                  entityName={`Vaga ${parkingSpot.name}`}
                  entityCreatedAt={parkingSpot.createdAt}
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
