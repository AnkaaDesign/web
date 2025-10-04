import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconHome, IconMapPin, IconCar } from "@tabler/icons-react";

interface TruckBasicFiltersProps {
  hasGarage?: boolean;
  hasPosition?: boolean;
  isParked?: boolean;
  onHasGarageChange: (value: boolean | undefined) => void;
  onHasPositionChange: (value: boolean | undefined) => void;
  onIsParkedChange: (value: boolean | undefined) => void;
}

export function TruckBasicFilters({ hasGarage, hasPosition, isParked, onHasGarageChange, onHasPositionChange, onIsParkedChange }: TruckBasicFiltersProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconHome className="h-5 w-5" />
            Status de Localização
          </CardTitle>
          <CardDescription>Filtrar caminhões por status de alocação e posicionamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Tem Garagem</Label>
              <div className="text-sm text-muted-foreground">Caminhões alocados a uma garagem</div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="hasGarage-false" className="text-sm text-muted-foreground">
                Não
              </Label>
              <Switch
                id="hasGarage"
                checked={hasGarage === true}
                onCheckedChange={(checked) => {
                  if (hasGarage === undefined) {
                    onHasGarageChange(checked);
                  } else if (hasGarage === true && !checked) {
                    onHasGarageChange(false);
                  } else if (hasGarage === false && checked) {
                    onHasGarageChange(true);
                  } else {
                    onHasGarageChange(undefined);
                  }
                }}
              />
              <Label htmlFor="hasGarage-true" className="text-sm text-muted-foreground">
                Sim
              </Label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Tem Posição</Label>
              <div className="text-sm text-muted-foreground">Caminhões com posição X e Y definidas</div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="hasPosition-false" className="text-sm text-muted-foreground">
                Não
              </Label>
              <Switch
                id="hasPosition"
                checked={hasPosition === true}
                onCheckedChange={(checked) => {
                  if (hasPosition === undefined) {
                    onHasPositionChange(checked);
                  } else if (hasPosition === true && !checked) {
                    onHasPositionChange(false);
                  } else if (hasPosition === false && checked) {
                    onHasPositionChange(true);
                  } else {
                    onHasPositionChange(undefined);
                  }
                }}
              />
              <Label htmlFor="hasPosition-true" className="text-sm text-muted-foreground">
                Sim
              </Label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Estacionado</Label>
              <div className="text-sm text-muted-foreground">Caminhões completamente estacionados (garagem + posição)</div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="isParked-false" className="text-sm text-muted-foreground">
                Não
              </Label>
              <Switch
                id="isParked"
                checked={isParked === true}
                onCheckedChange={(checked) => {
                  if (isParked === undefined) {
                    onIsParkedChange(checked);
                  } else if (isParked === true && !checked) {
                    onIsParkedChange(false);
                  } else if (isParked === false && checked) {
                    onIsParkedChange(true);
                  } else {
                    onIsParkedChange(undefined);
                  }
                }}
              />
              <Label htmlFor="isParked-true" className="text-sm text-muted-foreground">
                Sim
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
