import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { IconPlus, IconX, IconClipboardList, IconHome, IconTruck } from "@tabler/icons-react";
import { TRUCK_MANUFACTURER, TRUCK_MANUFACTURER_LABELS } from "../../../../../constants";
import { useTasks, useGarages } from "../../../../../hooks";

interface TruckEntitySelectorsProps {
  taskIds: string[];
  garageIds: string[];
  manufacturers: TRUCK_MANUFACTURER[];
  plates: string[];
  models: string[];
  onTaskIdsChange: (value: string[]) => void;
  onGarageIdsChange: (value: string[]) => void;
  onManufacturersChange: (value: TRUCK_MANUFACTURER[]) => void;
  onPlatesChange: (value: string[]) => void;
  onModelsChange: (value: string[]) => void;
}

export function TruckEntitySelectors({
  taskIds,
  garageIds,
  manufacturers,
  plates,
  models,
  onTaskIdsChange,
  onGarageIdsChange,
  onManufacturersChange,
  onPlatesChange,
  onModelsChange,
}: TruckEntitySelectorsProps) {
  const [newPlate, setNewPlate] = useState("");
  const [newModel, setNewModel] = useState("");

  // Load entity data
  const { data: tasksData } = useTasks({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    limit: 100,
  });

  const { data: garagesData } = useGarages({
    orderBy: { name: "asc" },
  });

  const tasks = tasksData?.data || [];
  const garages = garagesData?.data || [];

  // Transform tasks for combobox
  const taskOptions = tasks.map((task) => ({
    value: task.id,
    label: `${task.plate || task.name || "Sem nome"} - ${task.customer?.fantasyName || task.customer?.corporateName || "Sem cliente"}`,
  }));

  // Transform garages for combobox
  const garageOptions = garages.map((garage) => ({
    value: garage.id,
    label: garage.name,
  }));

  // Transform manufacturers for combobox
  const manufacturerOptions = Object.values(TRUCK_MANUFACTURER).map((manufacturer) => ({
    value: manufacturer,
    label: TRUCK_MANUFACTURER_LABELS[manufacturer] || manufacturer,
  }));

  // Handle adding custom plates
  const handleAddPlate = () => {
    if (newPlate.trim() && !plates.includes(newPlate.trim().toUpperCase())) {
      onPlatesChange([...plates, newPlate.trim().toUpperCase()]);
      setNewPlate("");
    }
  };

  // Handle adding custom models
  const handleAddModel = () => {
    if (newModel.trim() && !models.includes(newModel.trim())) {
      onModelsChange([...models, newModel.trim()]);
      setNewModel("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tasks Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconClipboardList className="h-5 w-5" />
            Tarefas
          </CardTitle>
          <CardDescription>Selecione tarefas específicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tarefas Selecionadas</Label>
            <Combobox
              options={taskOptions}
              selectedValues={taskIds}
              onSelectionChange={onTaskIdsChange}
              placeholder="Selecione tarefas..."
              searchPlaceholder="Buscar tarefa..."
              multiple
            />
          </div>
          {taskIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {taskIds.map((taskId) => {
                const task = tasks.find((t) => t.id === taskId);
                const label = task ? `${task.plate || task.name || "Sem nome"}` : taskId;
                return (
                  <Badge key={taskId} variant="secondary" className="flex items-center gap-1">
                    {label}
                    <Button variant="ghost" size="sm" className="h-auto p-0 ml-1 hover:bg-transparent" onClick={() => onTaskIdsChange(taskIds.filter((id) => id !== taskId))}>
                      <IconX className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Garages Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconHome className="h-5 w-5" />
            Garagens
          </CardTitle>
          <CardDescription>Selecione garagens específicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Garagens Selecionadas</Label>
            <Combobox
              options={garageOptions}
              selectedValues={garageIds}
              onSelectionChange={onGarageIdsChange}
              placeholder="Selecione garagens..."
              searchPlaceholder="Buscar garagem..."
              multiple
            />
          </div>
          {garageIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {garageIds.map((garageId) => {
                const garage = garages.find((g) => g.id === garageId);
                const label = garage ? garage.name : garageId;
                return (
                  <Badge key={garageId} variant="secondary" className="flex items-center gap-1">
                    {label}
                    <Button variant="ghost" size="sm" className="h-auto p-0 ml-1 hover:bg-transparent" onClick={() => onGarageIdsChange(garageIds.filter((id) => id !== garageId))}>
                      <IconX className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manufacturers Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <IconTruck className="h-5 w-5" />
            Fabricantes
          </CardTitle>
          <CardDescription>Selecione fabricantes específicos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fabricantes Selecionados</Label>
            <Combobox
              options={manufacturerOptions}
              selectedValues={manufacturers}
              onSelectionChange={onManufacturersChange}
              placeholder="Selecione fabricantes..."
              searchPlaceholder="Buscar fabricante..."
              multiple
            />
          </div>
          {manufacturers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {manufacturers.map((manufacturer) => (
                <Badge key={manufacturer} variant="secondary" className="flex items-center gap-1">
                  {TRUCK_MANUFACTURER_LABELS[manufacturer] || manufacturer}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1 hover:bg-transparent"
                    onClick={() => onManufacturersChange(manufacturers.filter((m) => m !== manufacturer))}
                  >
                    <IconX className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plates Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Placas</CardTitle>
          <CardDescription>Adicione placas específicas para filtrar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite uma placa (ex: ABC1234)"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPlate();
                }
              }}
            />
            <Button onClick={handleAddPlate} disabled={!newPlate.trim()}>
              <IconPlus className="h-4 w-4" />
            </Button>
          </div>
          {plates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plates.map((plate) => (
                <Badge key={plate} variant="secondary" className="flex items-center gap-1">
                  {plate}
                  <Button variant="ghost" size="sm" className="h-auto p-0 ml-1 hover:bg-transparent" onClick={() => onPlatesChange(plates.filter((p) => p !== plate))}>
                    <IconX className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Models Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modelos</CardTitle>
          <CardDescription>Adicione modelos específicos para filtrar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite um modelo"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddModel();
                }
              }}
            />
            <Button onClick={handleAddModel} disabled={!newModel.trim()}>
              <IconPlus className="h-4 w-4" />
            </Button>
          </div>
          {models.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <Badge key={model} variant="secondary" className="flex items-center gap-1">
                  {model}
                  <Button variant="ghost" size="sm" className="h-auto p-0 ml-1 hover:bg-transparent" onClick={() => onModelsChange(models.filter((m) => m !== model))}>
                    <IconX className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
