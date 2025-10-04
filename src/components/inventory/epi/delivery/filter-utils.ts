import type { PpeDeliveryGetManyFormData } from "../../../../schemas";
import { PPE_DELIVERY_STATUS_LABELS } from "../../../../constants";
import type { Item, User } from "../../../../types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function extractActiveFilters(
  filters: Partial<PpeDeliveryGetManyFormData>,
  onRemoveFilter: (key: string, value?: any) => void,
  entities?: {
    items?: Item[];
    users?: User[];
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

  // Item filter
  if (filters.itemIds && filters.itemIds.length > 0 && entities?.items) {
    const itemNames = filters.itemIds.map((id: any) => entities.items?.find((item) => item.id === id)?.name).filter(Boolean);
    if (itemNames.length > 0) {
      activeFilters.push({
        key: "itemIds",
        label: "Itens",
        value: itemNames.join(", "),
        onRemove: () => onRemoveFilter("itemIds"),
      });
    }
  } else if (filters.where?.itemId && entities?.items) {
    const item = entities.items.find((i) => i.id === filters.where!.itemId);
    if (item) {
      activeFilters.push({
        key: "itemId",
        label: "Item",
        value: item.name,
        onRemove: () => onRemoveFilter("itemId"),
      });
    }
  }

  // User filter
  if (filters.userIds && filters.userIds.length > 0 && entities?.users) {
    const userNames = filters.userIds.map((id: any) => entities.users?.find((user) => user.id === id)?.name).filter(Boolean);
    if (userNames.length > 0) {
      activeFilters.push({
        key: "userIds",
        label: "Usuários",
        value: userNames.join(", "),
        onRemove: () => onRemoveFilter("userIds"),
      });
    }
  } else if (filters.where?.userId && entities?.users) {
    const user = entities.users.find((u) => u.id === filters.where!.userId);
    if (user) {
      activeFilters.push({
        key: "userId",
        label: "Usuário",
        value: user.name,
        onRemove: () => onRemoveFilter("userId"),
      });
    }
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const labels = filters.status.map((status: any) => PPE_DELIVERY_STATUS_LABELS[status as keyof typeof PPE_DELIVERY_STATUS_LABELS] || status);
    activeFilters.push({
      key: "status",
      label: "Status",
      value: labels.join(", "),
      onRemove: () => onRemoveFilter("status"),
    });
  }

  // Date filters
  if (filters.scheduledDateRange?.gte || filters.scheduledDateRange?.lte) {
    const startDate = filters.scheduledDateRange.gte ? new Date(filters.scheduledDateRange.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.scheduledDateRange.lte ? new Date(filters.scheduledDateRange.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "scheduledDateRange",
        label: "Agendamento entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("scheduledDateRange"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "scheduledDateRange-gte",
        label: "Agendamento após",
        value: startDate,
        onRemove: () => onRemoveFilter("scheduledDateRange", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "scheduledDateRange-lte",
        label: "Agendamento até",
        value: endDate,
        onRemove: () => onRemoveFilter("scheduledDateRange", "lte"),
      });
    }
  }

  if (filters.actualDeliveryDateRange?.gte || filters.actualDeliveryDateRange?.lte) {
    const startDate = filters.actualDeliveryDateRange.gte ? new Date(filters.actualDeliveryDateRange.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.actualDeliveryDateRange.lte ? new Date(filters.actualDeliveryDateRange.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "actualDeliveryDateRange",
        label: "Entrega entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("actualDeliveryDateRange"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "actualDeliveryDateRange-gte",
        label: "Entrega após",
        value: startDate,
        onRemove: () => onRemoveFilter("actualDeliveryDateRange", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "actualDeliveryDateRange-lte",
        label: "Entrega até",
        value: endDate,
        onRemove: () => onRemoveFilter("actualDeliveryDateRange", "lte"),
      });
    }
  }

  return activeFilters;
}

export function createFilterRemover(setFilters: React.Dispatch<React.SetStateAction<Partial<PpeDeliveryGetManyFormData>>>) {
  return (key: string, value?: any) => {
    setFilters((currentFilters) => {
      const newFilters = { ...currentFilters };

      switch (key) {
        case "searchingFor":
          delete newFilters.searchingFor;
          // Also clear the search input by setting searchingFor state to empty string
          // This will be handled by the component
          break;

        case "itemIds":
          delete newFilters.itemIds;
          break;

        case "itemId":
          if (newFilters.where) {
            delete newFilters.where.itemId;
            if (Object.keys(newFilters.where).length === 0) {
              delete newFilters.where;
            }
          }
          break;

        case "userIds":
          delete newFilters.userIds;
          break;

        case "userId":
          if (newFilters.where) {
            delete newFilters.where.userId;
            if (Object.keys(newFilters.where).length === 0) {
              delete newFilters.where;
            }
          }
          break;

        case "status":
          delete newFilters.status;
          break;

        case "scheduledDateRange":
          if (value === "gte" && newFilters.scheduledDateRange) {
            delete newFilters.scheduledDateRange.gte;
            if (!newFilters.scheduledDateRange.lte) {
              delete newFilters.scheduledDateRange;
            }
          } else if (value === "lte" && newFilters.scheduledDateRange) {
            delete newFilters.scheduledDateRange.lte;
            if (!newFilters.scheduledDateRange.gte) {
              delete newFilters.scheduledDateRange;
            }
          } else {
            delete newFilters.scheduledDateRange;
          }
          break;

        case "actualDeliveryDateRange":
          if (value === "gte" && newFilters.actualDeliveryDateRange) {
            delete newFilters.actualDeliveryDateRange.gte;
            if (!newFilters.actualDeliveryDateRange.lte) {
              delete newFilters.actualDeliveryDateRange;
            }
          } else if (value === "lte" && newFilters.actualDeliveryDateRange) {
            delete newFilters.actualDeliveryDateRange.lte;
            if (!newFilters.actualDeliveryDateRange.gte) {
              delete newFilters.actualDeliveryDateRange;
            }
          } else {
            delete newFilters.actualDeliveryDateRange;
          }
          break;
      }

      return newFilters;
    });
  };
}
