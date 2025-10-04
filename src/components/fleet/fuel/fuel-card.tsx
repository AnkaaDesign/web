import { IconGasStation, IconTruck, IconReceipt, IconMapPin, IconCalendar, IconEdit, IconTrash } from "@tabler/icons-react";
import { formatCurrency, formatDate, formatDateTime } from "../../../utils";
import {
  FUEL_TYPE_LABELS,
  FUEL_TRANSACTION_TYPE_LABELS,
  FUEL_ENTRY_STATUS_LABELS,
  type FUEL_ENTRY_STATUS,
  type FUEL_TRANSACTION_TYPE,
} from "../../../constants";
import type { Fuel } from "../../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface FuelCardProps {
  fuel: Fuel;
  onEdit?: (fuel: Fuel) => void;
  onDelete?: (fuel: Fuel) => void;
  showActions?: boolean;
  compact?: boolean;
}

export const FuelCard = ({
  fuel,
  onEdit,
  onDelete,
  showActions = true,
  compact = false,
}: FuelCardProps) => {
  const getStatusBadge = (status: FUEL_ENTRY_STATUS) => {
    const variants = {
      PENDING: "secondary",
      CONFIRMED: "success",
      CANCELLED: "destructive",
    } as const;

    return (
      <Badge variant={variants[status] || "secondary"}>
        {FUEL_ENTRY_STATUS_LABELS[status]}
      </Badge>
    );
  };

  const getTransactionTypeBadge = (type: FUEL_TRANSACTION_TYPE) => {
    const variants = {
      REFUEL: "default",
      FUEL_PURCHASE: "outline",
      FUEL_ADJUSTMENT: "secondary",
    } as const;

    return (
      <Badge variant={variants[type] || "default"}>
        {FUEL_TRANSACTION_TYPE_LABELS[type]}
      </Badge>
    );
  };

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <IconGasStation className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {FUEL_TYPE_LABELS[fuel.fuelType]}
                  </span>
                  {getTransactionTypeBadge(fuel.transactionType)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(fuel.fuelDate)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{formatCurrency(fuel.totalCost)}</p>
              <p className="text-sm text-muted-foreground">
                {fuel.quantity.toFixed(2)} L
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconGasStation className="w-5 h-5" />
            Abastecimento - {formatDate(fuel.fuelDate)}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(fuel.status)}
            {getTransactionTypeBadge(fuel.transactionType)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Combustível</p>
              <p className="text-lg font-semibold">
                {FUEL_TYPE_LABELS[fuel.fuelType]}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Quantidade</p>
              <p className="text-lg font-semibold">{fuel.quantity.toFixed(2)} Litros</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Preço por Litro</p>
              <p className="text-lg font-semibold">{formatCurrency(fuel.pricePerLiter)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(fuel.totalCost)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Data/Hora</p>
              <div className="flex items-center gap-2">
                <IconCalendar className="w-4 h-4 text-muted-foreground" />
                <p>{formatDateTime(fuel.fuelDate)}</p>
              </div>
            </div>

            {fuel.odometer && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Odômetro</p>
                <p className="font-semibold">{fuel.odometer.toLocaleString()} km</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Vehicle Information */}
        {fuel.vehicle && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <IconTruck className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{fuel.vehicle.plate}</p>
              <p className="text-sm text-muted-foreground">{fuel.vehicle.model}</p>
            </div>
          </div>
        )}

        {/* Location and Supplier */}
        {(fuel.location || fuel.supplier) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fuel.location && (
              <div className="flex items-center gap-2">
                <IconMapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Local</p>
                  <p>{fuel.location}</p>
                </div>
              </div>
            )}

            {fuel.supplier && (
              <div className="flex items-center gap-2">
                <IconGasStation className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fornecedor</p>
                  <p>{fuel.supplier}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Receipt Information */}
        {fuel.receiptNumber && (
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
            <IconReceipt className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Número do Recibo</p>
              <p className="font-mono text-sm">{fuel.receiptNumber}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {fuel.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Observações</p>
            <p className="text-sm bg-muted/30 p-3 rounded-lg">{fuel.notes}</p>
          </div>
        )}

        {/* User Information */}
        {fuel.user && (
          <div className="text-xs text-muted-foreground">
            <p>Registrado por: {fuel.user.name}</p>
            <p>Em: {formatDateTime(fuel.createdAt)}</p>
          </div>
        )}

        {/* Actions */}
        {showActions && (onEdit || onDelete) && (
          <>
            <Separator />
            <div className="flex justify-end gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(fuel)}
                >
                  <IconEdit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(fuel)}
                >
                  <IconTrash className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};