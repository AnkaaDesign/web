import type { SupplierGetManyFormData } from "../../../../schemas";
import type { ReactNode } from "react";

export interface FilterIndicator {
  id: string;
  label: string;
  value: string | string[] | boolean | number;
  onRemove: () => void;
  icon?: ReactNode;
}

interface EntityOptions {
  cities: Array<{ id: string; name: string }>;
  states: Array<{ id: string; name: string }>;
}

export const extractActiveFilters = (
  filters: Partial<SupplierGetManyFormData>,
  onRemoveFilter: (filterKey: string, value?: any) => void,
  entityOptions: Partial<EntityOptions> = {},
): FilterIndicator[] => {
  const activeFilters: FilterIndicator[] = [];

  // Boolean filters
  if (typeof filters.hasLogo === "boolean") {
    activeFilters.push({
      id: "hasLogo",
      label: "Tem logo",
      value: filters.hasLogo ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasLogo"),
    });
  }

  if (typeof filters.hasItems === "boolean") {
    activeFilters.push({
      id: "hasItems",
      label: "Tem produtos",
      value: filters.hasItems ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasItems"),
    });
  }

  if (typeof filters.hasOrders === "boolean") {
    activeFilters.push({
      id: "hasOrders",
      label: "Tem pedidos",
      value: filters.hasOrders ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasOrders"),
    });
  }

  if (typeof filters.hasActiveOrders === "boolean") {
    activeFilters.push({
      id: "hasActiveOrders",
      label: "Pedidos ativos",
      value: filters.hasActiveOrders ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasActiveOrders"),
    });
  }

  if (typeof filters.hasCnpj === "boolean") {
    activeFilters.push({
      id: "hasCnpj",
      label: "Tem CNPJ",
      value: filters.hasCnpj ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasCnpj"),
    });
  }

  if (typeof filters.hasEmail === "boolean") {
    activeFilters.push({
      id: "hasEmail",
      label: "Tem email",
      value: filters.hasEmail ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasEmail"),
    });
  }

  if (typeof filters.hasSite === "boolean") {
    activeFilters.push({
      id: "hasSite",
      label: "Tem site",
      value: filters.hasSite ? "Sim" : "Não",
      onRemove: () => onRemoveFilter("hasSite"),
    });
  }

  // Array filters
  if (filters.cities && filters.cities.length > 0) {
    const cityNames = filters.cities.map((cityId: string) => {
      const city = entityOptions.cities?.find((c) => c.id === cityId);
      return city?.name || cityId;
    });

    activeFilters.push({
      id: "cities",
      label: "Cidades",
      value: cityNames.join(", "),
      onRemove: () => onRemoveFilter("cities"),
    });
  }

  if (filters.states && filters.states.length > 0) {
    const stateNames = filters.states.map((stateCode: string) => {
      const state = entityOptions.states?.find((s) => s.id === stateCode);
      return state?.name || stateCode;
    });

    activeFilters.push({
      id: "states",
      label: "Estados",
      value: stateNames.join(", "),
      onRemove: () => onRemoveFilter("states"),
    });
  }

  // Text filters
  if (filters.phoneContains) {
    activeFilters.push({
      id: "phoneContains",
      label: "Telefone contém",
      value: filters.phoneContains,
      onRemove: () => onRemoveFilter("phoneContains"),
    });
  }

  // Range filters
  if (filters.itemCount) {
    const { min, max } = filters.itemCount;
    let rangeText = "";

    if (min !== undefined && max !== undefined) {
      rangeText = `${min} - ${max}`;
    } else if (min !== undefined) {
      rangeText = `≥ ${min}`;
    } else if (max !== undefined) {
      rangeText = `≤ ${max}`;
    }

    if (rangeText) {
      activeFilters.push({
        id: "itemCount",
        label: "Qtd. produtos",
        value: rangeText,
        onRemove: () => onRemoveFilter("itemCount"),
      });
    }
  }

  if (filters.orderCount) {
    const { min, max } = filters.orderCount;
    let rangeText = "";

    if (min !== undefined && max !== undefined) {
      rangeText = `${min} - ${max}`;
    } else if (min !== undefined) {
      rangeText = `≥ ${min}`;
    } else if (max !== undefined) {
      rangeText = `≤ ${max}`;
    }

    if (rangeText) {
      activeFilters.push({
        id: "orderCount",
        label: "Qtd. pedidos",
        value: rangeText,
        onRemove: () => onRemoveFilter("orderCount"),
      });
    }
  }

  // Date filters
  if (filters.createdAt) {
    const { gte, lte } = filters.createdAt;
    let dateText = "";

    if (gte && lte) {
      dateText = `${gte.toLocaleDateString("pt-BR")} - ${lte.toLocaleDateString("pt-BR")}`;
    } else if (gte) {
      dateText = `A partir de ${gte.toLocaleDateString("pt-BR")}`;
    } else if (lte) {
      dateText = `Até ${lte.toLocaleDateString("pt-BR")}`;
    }

    if (dateText) {
      activeFilters.push({
        id: "createdAt",
        label: "Criado em",
        value: dateText,
        onRemove: () => onRemoveFilter("createdAt"),
      });
    }
  }

  if (filters.updatedAt) {
    const { gte, lte } = filters.updatedAt;
    let dateText = "";

    if (gte && lte) {
      dateText = `${gte.toLocaleDateString("pt-BR")} - ${lte.toLocaleDateString("pt-BR")}`;
    } else if (gte) {
      dateText = `A partir de ${gte.toLocaleDateString("pt-BR")}`;
    } else if (lte) {
      dateText = `Até ${lte.toLocaleDateString("pt-BR")}`;
    }

    if (dateText) {
      activeFilters.push({
        id: "updatedAt",
        label: "Atualizado em",
        value: dateText,
        onRemove: () => onRemoveFilter("updatedAt"),
      });
    }
  }

  return activeFilters;
};

export const createFilterRemover = (filters: Partial<SupplierGetManyFormData>, onFilterChange: (filters: Partial<SupplierGetManyFormData>) => void) => {
  return (filterKey: string) => {
    const newFilters = { ...filters };

    switch (filterKey) {
      case "hasLogo":
        delete newFilters.hasLogo;
        break;
      case "hasItems":
        delete newFilters.hasItems;
        break;
      case "hasOrders":
        delete newFilters.hasOrders;
        break;
      case "hasActiveOrders":
        delete newFilters.hasActiveOrders;
        break;
      case "hasCnpj":
        delete newFilters.hasCnpj;
        break;
      case "hasEmail":
        delete newFilters.hasEmail;
        break;
      case "hasSite":
        delete newFilters.hasSite;
        break;
      case "cities":
        delete newFilters.cities;
        break;
      case "states":
        delete newFilters.states;
        break;
      case "phoneContains":
        delete newFilters.phoneContains;
        break;
      case "itemCount":
        delete newFilters.itemCount;
        break;
      case "orderCount":
        delete newFilters.orderCount;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Unknown filter key: ${filterKey}`);
        }
    }

    onFilterChange(newFilters);
  };
};
