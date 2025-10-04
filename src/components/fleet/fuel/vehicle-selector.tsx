import { useState, useEffect } from "react";
import { IconTruck, IconSearch, IconLoader2 } from "@tabler/icons-react";
import type { Truck } from "../../../types";
import { TRUCK_MANUFACTURER_LABELS } from "../../../constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface VehicleSelectorProps {
  selectedVehicleId?: string;
  onSelect: (vehicleId: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  vehicles?: Truck[];
  isLoading?: boolean;
  onSearch?: (query: string) => void;
}

export const VehicleSelector = ({
  selectedVehicleId,
  onSelect,
  onClear,
  placeholder = "Selecione um veículo",
  disabled = false,
  vehicles = [],
  isLoading = false,
  onSearch,
}: VehicleSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  useEffect(() => {
    if (onSearch) {
      const timeoutId = setTimeout(() => {
        onSearch(searchQuery);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, onSearch]);

  const handleSelect = (vehicleId: string) => {
    onSelect(vehicleId);
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear?.();
    setSearchQuery("");
    setIsOpen(false);
  };

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (vehicle.task?.customer?.fantasyName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (vehicle.task?.customer?.corporateName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedVehicle ? (
            <div className="flex items-center gap-2">
              <IconTruck className="w-4 h-4" />
              <span>{selectedVehicle.plate}</span>
              <span className="text-muted-foreground">- {selectedVehicle.model}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <IconSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <Input
            placeholder="Buscar por placa, modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="h-60">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery ? "Nenhum veículo encontrado" : "Nenhum veículo disponível"}
            </div>
          ) : (
            <div className="p-1">
              {selectedVehicle && onClear && (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-auto p-2 mb-1"
                  onClick={handleClear}
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Limpar seleção</span>
                  </div>
                </Button>
              )}
              {filteredVehicles.map((vehicle) => (
                <Card
                  key={vehicle.id}
                  className={`mb-1 cursor-pointer transition-colors hover:bg-accent ${
                    selectedVehicleId === vehicle.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleSelect(vehicle.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconTruck className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{vehicle.plate}</div>
                          <div className="text-sm text-muted-foreground">
                            {vehicle.model} - {TRUCK_MANUFACTURER_LABELS[vehicle.manufacturer] || vehicle.manufacturer}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {vehicle.task?.customer && (
                          <div className="text-xs text-muted-foreground">
                            {vehicle.task.customer.fantasyName || vehicle.task.customer.corporateName}
                          </div>
                        )}
                        {vehicle.garage && (
                          <Badge variant="outline" className="text-xs">
                            {vehicle.garage.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {vehicle.task && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                          Tarefa: {vehicle.task.name}
                          {vehicle.task.serialNumber && (
                            <span className="ml-2">#{vehicle.task.serialNumber}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};