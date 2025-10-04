import { IconGasStation, IconTrendingUp, IconTrendingDown, IconCalendar, IconTruck } from "@tabler/icons-react";
import { formatCurrency } from "../../../utils";
import { FUEL_TYPE_LABELS } from "../../../constants";
import type { FuelStatistics, VehicleFuelSummary } from "../../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface FuelStatisticsProps {
  statistics: FuelStatistics;
  vehicleSummaries?: VehicleFuelSummary[];
  isLoading?: boolean;
}

export const FuelStatisticsComponent = ({
  statistics,
  vehicleSummaries = [],
  isLoading = false,
}: FuelStatisticsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconGasStation className="w-4 h-4" />
              Total de Abastecimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalEntries}</div>
            <p className="text-xs text-muted-foreground">
              registros no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconGasStation className="w-4 h-4" />
              Total de Litros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalLiters.toFixed(2)} L</div>
            <p className="text-xs text-muted-foreground">
              combustível consumido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconTrendingUp className="w-4 h-4" />
              Custo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(statistics.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              gasto com combustível
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconTrendingDown className="w-4 h-4" />
              Preço Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.averagePricePerLiter)}
            </div>
            <p className="text-xs text-muted-foreground">
              por litro
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuel Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconGasStation className="w-5 h-5" />
              Combustível por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statistics.fuelTypeBreakdown.map((breakdown) => (
              <div key={breakdown.fuelType} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {FUEL_TYPE_LABELS[breakdown.fuelType]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {breakdown.totalLiters.toFixed(2)} L
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(breakdown.totalCost)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {breakdown.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <Progress value={breakdown.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Monthly Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCalendar className="w-5 h-5" />
              Consumo Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statistics.monthlyUsage.slice(-6).map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{month.month}</div>
                    <div className="text-sm text-muted-foreground">
                      {month.liters.toFixed(2)} L
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(month.cost)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Summaries */}
      {vehicleSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTruck className="w-5 h-5" />
              Resumo por Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehicleSummaries.map((vehicle) => (
                <div
                  key={vehicle.vehicleId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconTruck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{vehicle.vehiclePlate}</div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.vehicleModel}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {vehicle.fuelEntries} abastecimento{vehicle.fuelEntries !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(vehicle.totalCost)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {vehicle.totalLiters.toFixed(2)} L
                    </div>
                    {vehicle.averageConsumption > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {vehicle.averageConsumption.toFixed(2)} km/L
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Consumo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {statistics.averageConsumption.toFixed(2)} km/L
            </div>
            <p className="text-xs text-muted-foreground">
              eficiência da frota
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Combustível Principal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {FUEL_TYPE_LABELS[statistics.mostUsedFuelType]}
            </div>
            <p className="text-xs text-muted-foreground">
              mais utilizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Veículos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{statistics.totalVehicles}</div>
            <p className="text-xs text-muted-foreground">
              na frota
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};