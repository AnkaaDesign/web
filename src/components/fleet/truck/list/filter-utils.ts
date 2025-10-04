import type { TruckGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";
import { TRUCK_MANUFACTURER_LABELS } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  tasks?: Array<{ id: string; name?: string; plate?: string; serialNumber?: string; customer?: { fantasyName?: string; corporateName?: string } }>;
  garages?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(
  filters: Partial<TruckGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { tasks = [], garages = [] } = options;

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Boolean filters
  if (filters.hasGarage !== undefined) {
    activeFilters.push({
      key: "hasGarage",
      label: "Garagem",
      value: filters.hasGarage ? "Com garagem" : "Sem garagem",
      iconType: "home",
      onRemove: () => onRemoveFilter("hasGarage"),
    });
  }

  if (filters.hasPosition !== undefined) {
    activeFilters.push({
      key: "hasPosition",
      label: "Posição",
      value: filters.hasPosition ? "Com posição" : "Sem posição",
      iconType: "map-pin",
      onRemove: () => onRemoveFilter("hasPosition"),
    });
  }

  if (filters.isParked !== undefined) {
    activeFilters.push({
      key: "isParked",
      label: "Status",
      value: filters.isParked ? "Estacionado" : "Não estacionado",
      iconType: "car",
      onRemove: () => onRemoveFilter("isParked"),
    });
  }

  // Task filters (individual badges for each task)
  if (filters.taskIds && Array.isArray(filters.taskIds) && filters.taskIds.length > 0) {
    const selectedTasks = tasks.filter((task) => filters.taskIds?.includes(task.id));

    selectedTasks.forEach((task) => {
      const displayValue = task.plate || task.name || task.serialNumber || task.customer?.fantasyName || task.customer?.corporateName || `Tarefa ${task.id}`;
      activeFilters.push({
        key: `taskIds-${task.id}`,
        label: "Tarefa",
        value: displayValue,
        iconType: "clipboard-list",
        itemId: task.id,
        onRemove: () => onRemoveFilter("taskIds", task.id),
      });
    });
  }

  // Garage filters (individual badges for each garage)
  if (filters.garageIds && Array.isArray(filters.garageIds) && filters.garageIds.length > 0) {
    const selectedGarages = garages.filter((garage) => filters.garageIds?.includes(garage.id));

    selectedGarages.forEach((garage) => {
      activeFilters.push({
        key: `garageIds-${garage.id}`,
        label: "Garagem",
        value: garage.name,
        iconType: "home",
        itemId: garage.id,
        onRemove: () => onRemoveFilter("garageIds", garage.id),
      });
    });
  }

  // Manufacturer filters (individual badges for each manufacturer)
  if (filters.manufacturers && Array.isArray(filters.manufacturers) && filters.manufacturers.length > 0) {
    filters.manufacturers.forEach((manufacturer) => {
      const displayValue = TRUCK_MANUFACTURER_LABELS[manufacturer] || manufacturer;
      activeFilters.push({
        key: `manufacturers-${manufacturer}`,
        label: "Fabricante",
        value: displayValue,
        iconType: "truck",
        itemId: manufacturer,
        onRemove: () => onRemoveFilter("manufacturers", manufacturer),
      });
    });
  }

  // Plate filters (individual badges for each plate)
  if (filters.plates && Array.isArray(filters.plates) && filters.plates.length > 0) {
    filters.plates.forEach((plate) => {
      activeFilters.push({
        key: `plates-${plate}`,
        label: "Placa",
        value: plate,
        iconType: "id-card",
        itemId: plate,
        onRemove: () => onRemoveFilter("plates", plate),
      });
    });
  }

  // Model filters (individual badges for each model)
  if (filters.models && Array.isArray(filters.models) && filters.models.length > 0) {
    filters.models.forEach((model) => {
      activeFilters.push({
        key: `models-${model}`,
        label: "Modelo",
        value: model,
        iconType: "truck",
        itemId: model,
        onRemove: () => onRemoveFilter("models", model),
      });
    });
  }


  // Position range filters
  if (filters.xPositionRange?.min !== undefined || filters.xPositionRange?.max !== undefined) {
    const min = filters.xPositionRange.min;
    const max = filters.xPositionRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `X: ${min} - ${max}`;
    } else if (min !== undefined) {
      value = `X: ≥ ${min}`;
    } else if (max !== undefined) {
      value = `X: ≤ ${max}`;
    }

    activeFilters.push({
      key: "xPositionRange",
      label: "Posição X",
      value,
      iconType: "map-pin",
      onRemove: () => onRemoveFilter("xPositionRange"),
    });
  }

  if (filters.yPositionRange?.min !== undefined || filters.yPositionRange?.max !== undefined) {
    const min = filters.yPositionRange.min;
    const max = filters.yPositionRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `Y: ${min} - ${max}`;
    } else if (min !== undefined) {
      value = `Y: ≥ ${min}`;
    } else if (max !== undefined) {
      value = `Y: ≤ ${max}`;
    }

    activeFilters.push({
      key: "yPositionRange",
      label: "Posição Y",
      value,
      iconType: "map-pin",
      onRemove: () => onRemoveFilter("yPositionRange"),
    });
  }

  // Date range filters
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const gte = filters.createdAt?.gte;
    const lte = filters.createdAt?.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `A partir de ${formatDate(gte)}`;
    } else if (lte) {
      value = `Até ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "createdAt",
      label: "Data de Criação",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  if (filters.updatedAt?.gte || filters.updatedAt?.lte) {
    const gte = filters.updatedAt?.gte;
    const lte = filters.updatedAt?.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `A partir de ${formatDate(gte)}`;
    } else if (lte) {
      value = `Até ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "updatedAt",
      label: "Data de Atualização",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("updatedAt"),
    });
  }

  return activeFilters;
}

// Helper function to create a filter remover
export function createFilterRemover(filters: Partial<TruckGetManyFormData>, onFilterChange: (newFilters: Partial<TruckGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...filters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "hasGarage":
        delete newFilters.hasGarage;
        break;

      case "hasPosition":
        delete newFilters.hasPosition;
        break;

      case "isParked":
        delete newFilters.isParked;
        break;

      case "taskIds":
        if (itemId && newFilters.taskIds) {
          newFilters.taskIds = newFilters.taskIds.filter((id) => id !== itemId);
          if (newFilters.taskIds.length === 0) {
            delete newFilters.taskIds;
          }
        } else {
          delete newFilters.taskIds;
        }
        break;

      case "garageIds":
        if (itemId && newFilters.garageIds) {
          newFilters.garageIds = newFilters.garageIds.filter((id) => id !== itemId);
          if (newFilters.garageIds.length === 0) {
            delete newFilters.garageIds;
          }
        } else {
          delete newFilters.garageIds;
        }
        break;

      case "manufacturers":
        if (itemId && newFilters.manufacturers) {
          newFilters.manufacturers = newFilters.manufacturers.filter((manufacturer) => manufacturer !== itemId);
          if (newFilters.manufacturers.length === 0) {
            delete newFilters.manufacturers;
          }
        } else {
          delete newFilters.manufacturers;
        }
        break;

      case "plates":
        if (itemId && newFilters.plates) {
          newFilters.plates = newFilters.plates.filter((plate) => plate !== itemId);
          if (newFilters.plates.length === 0) {
            delete newFilters.plates;
          }
        } else {
          delete newFilters.plates;
        }
        break;

      case "models":
        if (itemId && newFilters.models) {
          newFilters.models = newFilters.models.filter((model) => model !== itemId);
          if (newFilters.models.length === 0) {
            delete newFilters.models;
          }
        } else {
          delete newFilters.models;
        }
        break;


      case "xPositionRange":
        delete newFilters.xPositionRange;
        break;

      case "yPositionRange":
        delete newFilters.yPositionRange;
        break;

      case "createdAt":
        delete newFilters.createdAt;
        break;

      case "updatedAt":
        delete newFilters.updatedAt;
        break;

      default:
        console.warn(`Unknown filter key: ${key}`);
        break;
    }

    onFilterChange(newFilters);
  };
}
