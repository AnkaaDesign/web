import type { ActivityGetManyFormData } from "../../../../schemas";
import { ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION_LABELS, ACTIVITY_OPERATION } from "../../../../constants";
import type { Item, User } from "../../../../types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  iconType?: "search" | "trending-up" | "trending-down" | "file-text" | "users" | "user" | "package" | "calculator" | "calendar";
}

export function extractActiveFilters(
  filters: Partial<ActivityGetManyFormData>,
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
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Paint production filter
  if (filters.showPaintProduction) {
    activeFilters.push({
      key: "showPaintProduction",
      label: "Produção de tinta",
      value: "Exibindo",
      iconType: "file-text",
      onRemove: () => onRemoveFilter("showPaintProduction"),
    });
  }

  // Operation types filter
  if (filters.operations && filters.operations.length > 0) {
    const labels = filters.operations.map((op: string) => ACTIVITY_OPERATION_LABELS[op as keyof typeof ACTIVITY_OPERATION_LABELS] || op);
    // Use appropriate icon based on operation type
    const hasEntry = filters.operations.includes(ACTIVITY_OPERATION.INBOUND);
    const hasExit = filters.operations.includes(ACTIVITY_OPERATION.OUTBOUND);
    const iconType = hasEntry && !hasExit ? "trending-up" : !hasEntry && hasExit ? "trending-down" : "file-text";
    activeFilters.push({
      key: "operations",
      label: "Operações",
      value: labels.join(", "),
      iconType,
      onRemove: () => onRemoveFilter("operations"),
    });
  }

  // Reasons filter
  if (filters.reasons && filters.reasons.length > 0) {
    const labels = filters.reasons.map((reason: string) => ACTIVITY_REASON_LABELS[reason as keyof typeof ACTIVITY_REASON_LABELS] || reason);
    activeFilters.push({
      key: "reasons",
      label: "Motivos",
      value: labels.join(", "),
      iconType: "file-text",
      onRemove: () => onRemoveFilter("reasons"),
    });
  }

  // Item filter
  if (filters.itemIds && filters.itemIds.length > 0 && entities?.items) {
    const itemNames = filters.itemIds.map((id: string) => entities.items?.find((item: Item) => item.id === id)?.name).filter(Boolean);
    if (itemNames.length > 0) {
      activeFilters.push({
        key: "itemIds",
        label: "Itens",
        value: itemNames.join(", "),
        iconType: "package",
        onRemove: () => onRemoveFilter("itemIds"),
      });
    }
  } else if (filters.where?.itemId && entities?.items) {
    const item = entities.items.find((i: Item) => i.id === filters.where!.itemId);
    if (item) {
      activeFilters.push({
        key: "itemId",
        label: "Item",
        value: item.name,
        iconType: "package",
        onRemove: () => onRemoveFilter("itemId"),
      });
    }
  }

  // User filter
  if (filters.userIds && filters.userIds.length > 0 && entities?.users) {
    const userNames = filters.userIds.map((id: string) => entities.users?.find((user: User) => user.id === id)?.name).filter(Boolean);
    if (userNames.length > 0) {
      activeFilters.push({
        key: "userIds",
        label: "Usuários",
        value: userNames.join(", "),
        iconType: "users",
        onRemove: () => onRemoveFilter("userIds"),
      });
    }
  } else if (filters.where?.userId && entities?.users) {
    const user = entities.users.find((u: User) => u.id === filters.where!.userId);
    if (user) {
      activeFilters.push({
        key: "userId",
        label: "Usuário",
        value: user.name,
        iconType: "user",
        onRemove: () => onRemoveFilter("userId"),
      });
    }
  }

  // Quantity range filter
  if (filters.quantityRange?.min !== undefined || filters.quantityRange?.max !== undefined) {
    const min = filters.quantityRange.min;
    const max = filters.quantityRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min} - ${max}`;
    } else if (min !== undefined) {
      value = `≥ ${min}`;
    } else if (max !== undefined) {
      value = `≤ ${max}`;
    }

    activeFilters.push({
      key: "quantityRange",
      label: "Quantidade",
      value,
      iconType: "calculator",
      onRemove: () => onRemoveFilter("quantityRange"),
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
        iconType: "calendar",
        onRemove: () => onRemoveFilter("createdAt"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "createdAt-gte",
        label: "Criado após",
        value: startDate,
        iconType: "calendar",
        onRemove: () => onRemoveFilter("createdAt", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "createdAt-lte",
        label: "Criado até",
        value: endDate,
        iconType: "calendar",
        onRemove: () => onRemoveFilter("createdAt", "lte"),
      });
    }
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<ActivityGetManyFormData>, onFilterChange: (filters: Partial<ActivityGetManyFormData>) => void) {
  return (key: string, value?: any) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "showPaintProduction":
        delete newFilters.showPaintProduction;
        break;

      case "operations":
        delete newFilters.operations;
        break;

      case "reasons":
        delete newFilters.reasons;
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

      case "quantityRange":
        delete newFilters.quantityRange;
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
    }

    onFilterChange(newFilters);
  };
}
