import type { CustomerGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";
import { BRAZILIAN_STATE_NAMES } from "../../../../constants";
import type { BrazilianState } from "../../../../constants";

function isBrazilianState(value: any): value is BrazilianState {
  return typeof value === "string" && value in BRAZILIAN_STATE_NAMES;
}

export interface FilterIndicator {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  // Additional entity data can be added here as needed
}

export function extractActiveFilters(
  filters: Partial<CustomerGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  _options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      id: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Boolean filters
  if (filters.hasTasks !== undefined) {
    activeFilters.push({
      id: "hasTasks",
      label: "Possui tarefas",
      value: filters.hasTasks ? "Sim" : "Não",
      iconType: "briefcase",
      onRemove: () => onRemoveFilter("hasTasks"),
    });
  }

  if (filters.hasLogo !== undefined) {
    activeFilters.push({
      id: "hasLogo",
      label: "Possui logo",
      value: filters.hasLogo ? "Sim" : "Não",
      iconType: "image",
      onRemove: () => onRemoveFilter("hasLogo"),
    });
  }

  // Array filters - States (individual badges for each state)
  if (filters.states && filters.states.length > 0) {
    filters.states.forEach((state: string) => {
      const displayName = isBrazilianState(state) ? BRAZILIAN_STATE_NAMES[state] : state;
      activeFilters.push({
        id: `states-${state}`,
        label: "Estado",
        value: displayName,
        iconType: "map-pin",
        itemId: state,
        onRemove: () => onRemoveFilter("states", state),
      });
    });
  }

  // Array filters - Cities (individual badges for each city)
  if (filters.cities && filters.cities.length > 0) {
    filters.cities.forEach((city: string) => {
      activeFilters.push({
        id: `cities-${city}`,
        label: "Cidade",
        value: city,
        iconType: "map-pin",
        itemId: city,
        onRemove: () => onRemoveFilter("cities", city),
      });
    });
  }

  // Array filters - Tags (individual badges for each tag)
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tag: string) => {
      activeFilters.push({
        id: `tags-${tag}`,
        label: "Tag",
        value: tag,
        iconType: "tags",
        itemId: tag,
        onRemove: () => onRemoveFilter("tags", tag),
      });
    });
  }

  // Date filters
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const gte = filters.createdAt.gte;
    const lte = filters.createdAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      id: "createdAt",
      label: "Data de cadastro",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  if (filters.updatedAt?.gte || filters.updatedAt?.lte) {
    const gte = filters.updatedAt.gte;
    const lte = filters.updatedAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      id: "updatedAt",
      label: "Data de atualização",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("updatedAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<CustomerGetManyFormData>, onFilterChange: (filters: Partial<CustomerGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "hasTasks":
        delete newFilters.hasTasks;
        break;
      case "hasLogo":
        delete newFilters.hasLogo;
        break;
      case "states":
        if (itemId && Array.isArray(newFilters.states)) {
          // Remove specific state from array
          const filteredStates = newFilters.states.filter((state) => state !== itemId);
          if (filteredStates.length > 0) {
            newFilters.states = filteredStates;
          } else {
            delete newFilters.states;
          }
        } else {
          // Remove all states
          delete newFilters.states;
        }
        break;
      case "cities":
        if (itemId && Array.isArray(newFilters.cities)) {
          // Remove specific city from array
          const filteredCities = newFilters.cities.filter((city) => city !== itemId);
          if (filteredCities.length > 0) {
            newFilters.cities = filteredCities;
          } else {
            delete newFilters.cities;
          }
        } else {
          // Remove all cities
          delete newFilters.cities;
        }
        break;
      case "tags":
        if (itemId && Array.isArray(newFilters.tags)) {
          // Remove specific tag from array
          const filteredTags = newFilters.tags.filter((tag) => tag !== itemId);
          if (filteredTags.length > 0) {
            newFilters.tags = filteredTags;
          } else {
            delete newFilters.tags;
          }
        } else {
          // Remove all tags
          delete newFilters.tags;
        }
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
    }

    onFilterChange(newFilters);
  };
}

// Legacy functions for backward compatibility (can be removed after full migration)
export function getFilterLabel(key: string): string {
  const labels: Record<string, string> = {
    searchingFor: "Busca",
    hasTasks: "Possui tarefas",
    hasLogo: "Possui logo",
    hasServiceOrders: "Possui ordens de serviço",
    hasActiveTasks: "Possui tarefas ativas",
    hasCpf: "Possui CPF",
    hasCnpj: "Possui CNPJ",
    hasEmail: "Possui email",
    cities: "Cidades",
    states: "Estados",
    phoneContains: "Telefone contém",
    tags: "Tags",
    taskCount: "Quantidade de tarefas",
    serviceOrderCount: "Quantidade de ordens de serviço",
    birthDate: "Data de nascimento",
    createdAt: "Data de cadastro",
    updatedAt: "Data de atualização",
    cpf: "CPF",
    cnpj: "CNPJ",
  };
  return labels[key] || key;
}

export function getFilterDisplayValue(key: string, value: any): string {
  if (value === undefined || value === null) return "-";

  switch (key) {
    case "hasTasks":
    case "hasLogo":
    case "hasServiceOrders":
    case "hasActiveTasks":
    case "hasCpf":
    case "hasCnpj":
    case "hasEmail":
      return value ? "Sim" : "Não";

    case "states":
      if (Array.isArray(value)) {
        if (value.length === 0) return "-";
        if (value.length === 1) {
          const stateCode = value[0];
          return isBrazilianState(stateCode) ? BRAZILIAN_STATE_NAMES[stateCode] : stateCode;
        }
        return `${value.length} estados`;
      }
      return isBrazilianState(value) ? BRAZILIAN_STATE_NAMES[value] : value;

    case "cities":
      if (Array.isArray(value)) {
        if (value.length === 0) return "-";
        if (value.length === 1) return value[0];
        return `${value.length} cidades`;
      }
      return value;

    case "tags":
      if (Array.isArray(value)) {
        if (value.length === 0) return "-";
        if (value.length === 1) return value[0];
        return `${value.length} tags`;
      }
      return value;

    case "taskCount":
    case "serviceOrderCount":
      if (typeof value === "object" && value !== null) {
        const { min, max } = value;
        if (min !== undefined && max !== undefined) {
          return `${min} - ${max}`;
        }
        if (min !== undefined) {
          return `≥ ${min}`;
        }
        if (max !== undefined) {
          return `≤ ${max}`;
        }
      }
      return String(value);

    case "birthDate":
    case "createdAt":
    case "updatedAt":
      if (typeof value === "object" && value !== null) {
        const { gte, lte } = value;
        if (gte && lte) {
          const startDate = new Date(gte).toLocaleDateString("pt-BR");
          const endDate = new Date(lte).toLocaleDateString("pt-BR");
          return `${startDate} - ${endDate}`;
        }
        if (gte) {
          return `Após ${new Date(gte).toLocaleDateString("pt-BR")}`;
        }
        if (lte) {
          return `Até ${new Date(lte).toLocaleDateString("pt-BR")}`;
        }
      }
      if (value instanceof Date) {
        return value.toLocaleDateString("pt-BR");
      }
      if (typeof value === "string") {
        return new Date(value).toLocaleDateString("pt-BR");
      }
      return String(value);

    default:
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);
  }
}
