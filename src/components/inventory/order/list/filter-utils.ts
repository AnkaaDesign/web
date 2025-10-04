import type { OrderGetManyFormData } from "../../../../schemas";
import { ORDER_STATUS_LABELS, ORDER_STATUS } from "../../../../constants";
import type { Supplier } from "../../../../types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function extractActiveFilters(
  filters: Partial<OrderGetManyFormData>,
  onRemoveFilter: (key: string, value?: any) => void,
  entities?: {
    suppliers?: Supplier[];
  },
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Busca",
      value: filters.searchingFor,
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Supplier filter
  if (filters.supplierIds && filters.supplierIds.length > 0 && entities?.suppliers) {
    const supplierNames = filters.supplierIds.map((id: string) => entities.suppliers?.find((supplier: Supplier) => supplier.id === id)?.fantasyName).filter(Boolean);
    if (supplierNames.length > 0) {
      activeFilters.push({
        key: "supplierIds",
        label: "Fornecedores",
        value: supplierNames.join(", "),
        onRemove: () => onRemoveFilter("supplierIds"),
      });
    }
  } else if (filters.where?.supplierId && entities?.suppliers) {
    const supplier = entities.suppliers.find((s) => s.id === filters.where!.supplierId);
    if (supplier) {
      activeFilters.push({
        key: "supplierId",
        label: "Fornecedor",
        value: supplier.fantasyName,
        onRemove: () => onRemoveFilter("supplierId"),
      });
    }
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const labels = filters.status.map((status: ORDER_STATUS) => ORDER_STATUS_LABELS[status] || status);
    activeFilters.push({
      key: "status",
      label: "Status",
      value: labels.join(", "),
      onRemove: () => onRemoveFilter("status"),
    });
  }

  // Priority filter
  if (filters.where?.isPriority) {
    activeFilters.push({
      key: "isPriority",
      label: "Prioridade",
      value: "Sim",
      onRemove: () => onRemoveFilter("isPriority"),
    });
  }

  // Date filters
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const startDate = filters.createdAt.gte ? new Date(filters.createdAt.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.createdAt.lte ? new Date(filters.createdAt.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "createdAt",
        label: "Criado entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("createdAt"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "createdAt-gte",
        label: "Criado após",
        value: startDate,
        onRemove: () => onRemoveFilter("createdAt", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "createdAt-lte",
        label: "Criado até",
        value: endDate,
        onRemove: () => onRemoveFilter("createdAt", "lte"),
      });
    }
  }

  if (filters.receivedAt?.gte || filters.receivedAt?.lte) {
    const startDate = filters.receivedAt.gte ? new Date(filters.receivedAt.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.receivedAt.lte ? new Date(filters.receivedAt.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "receivedAt",
        label: "Recebido entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("receivedAt"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "receivedAt-gte",
        label: "Recebido após",
        value: startDate,
        onRemove: () => onRemoveFilter("receivedAt", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "receivedAt-lte",
        label: "Recebido até",
        value: endDate,
        onRemove: () => onRemoveFilter("receivedAt", "lte"),
      });
    }
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<OrderGetManyFormData>, onFilterChange: (filters: Partial<OrderGetManyFormData>) => void) {
  return (key: string, value?: any) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "supplierIds":
        delete newFilters.supplierIds;
        break;

      case "supplierId":
        if (newFilters.where) {
          delete newFilters.where.supplierId;
          if (Object.keys(newFilters.where).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      case "status":
        delete newFilters.status;
        break;

      case "isPriority":
        if (newFilters.where) {
          delete newFilters.where.isPriority;
          if (Object.keys(newFilters.where).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      case "createdAt":
        if (value === "gte" && newFilters.createdAt) {
          delete newFilters.createdAt.gte;
          if (!newFilters.createdAt.lte) {
            delete newFilters.createdAt;
          }
        } else if (value === "lte" && newFilters.createdAt) {
          delete newFilters.createdAt.lte;
          if (!newFilters.createdAt.gte) {
            delete newFilters.createdAt;
          }
        } else {
          delete newFilters.createdAt;
        }
        break;

      case "receivedAt":
        if (value === "gte" && newFilters.receivedAt) {
          delete newFilters.receivedAt.gte;
          if (!newFilters.receivedAt.lte) {
            delete newFilters.receivedAt;
          }
        } else if (value === "lte" && newFilters.receivedAt) {
          delete newFilters.receivedAt.lte;
          if (!newFilters.receivedAt.gte) {
            delete newFilters.receivedAt;
          }
        } else {
          delete newFilters.receivedAt;
        }
        break;
    }

    onFilterChange(newFilters);
  };
}
