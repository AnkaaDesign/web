import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from "@/constants";
import { formatDate } from "@/utils/date";

export interface NotificationFilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  icon?: React.ReactNode;
}

interface FilterUtilsOptions {
  users?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(
  filters: Record<string, any>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): NotificationFilterIndicator[] {
  const activeFilters: NotificationFilterIndicator[] = [];
  const { users = [] } = options;

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Busca",
      value: filters.searchingFor,
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Types filter - individual badges per type
  if (filters.types?.length) {
    filters.types.forEach((type: string) => {
      activeFilters.push({
        key: `types-${type}`,
        label: "Tipo",
        value: NOTIFICATION_TYPE_LABELS[type as keyof typeof NOTIFICATION_TYPE_LABELS] || type,
        onRemove: () => onRemoveFilter("types", type),
      });
    });
  }

  // Importance filter - individual badges
  if (filters.importance?.length) {
    filters.importance.forEach((imp: string) => {
      activeFilters.push({
        key: `importance-${imp}`,
        label: "Importância",
        value: NOTIFICATION_IMPORTANCE_LABELS[imp as keyof typeof NOTIFICATION_IMPORTANCE_LABELS] || imp,
        onRemove: () => onRemoveFilter("importance", imp),
      });
    });
  }

  // Channels filter - individual badges
  if (filters.channels?.length) {
    filters.channels.forEach((ch: string) => {
      activeFilters.push({
        key: `channels-${ch}`,
        label: "Canal",
        value: NOTIFICATION_CHANNEL_LABELS[ch as keyof typeof NOTIFICATION_CHANNEL_LABELS] || ch,
        onRemove: () => onRemoveFilter("channels", ch),
      });
    });
  }

  // Status filter
  if (filters.status) {
    activeFilters.push({
      key: "status",
      label: "Status",
      value: filters.status === "sent" ? "Enviadas" : "Pendentes",
      onRemove: () => onRemoveFilter("status"),
    });
  }

  // Unread filter
  if (filters.unread) {
    activeFilters.push({
      key: "unread",
      label: "Leitura",
      value: "Não lidas",
      onRemove: () => onRemoveFilter("unread"),
    });
  }

  // User (target) filter
  if (filters.userId) {
    const user = users.find((u) => u.id === filters.userId);
    activeFilters.push({
      key: "userId",
      label: "Destinatário",
      value: user?.name || "Usuário selecionado",
      onRemove: () => onRemoveFilter("userId"),
    });
  }

  // Date range filter
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const gte = filters.createdAt.gte;
    const lte = filters.createdAt.lte;
    let value = "Filtrado";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "createdAt",
      label: "Período",
      value,
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(
  currentFilters: Record<string, any>,
  onFilterChange: (filters: Record<string, any>) => void,
) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "types":
        if (itemId && Array.isArray(newFilters.types)) {
          const filtered = newFilters.types.filter((t: string) => t !== itemId);
          if (filtered.length > 0) {
            newFilters.types = filtered;
          } else {
            delete newFilters.types;
          }
        } else {
          delete newFilters.types;
        }
        break;
      case "importance":
        if (itemId && Array.isArray(newFilters.importance)) {
          const filtered = newFilters.importance.filter((i: string) => i !== itemId);
          if (filtered.length > 0) {
            newFilters.importance = filtered;
          } else {
            delete newFilters.importance;
          }
        } else {
          delete newFilters.importance;
        }
        break;
      case "channels":
        if (itemId && Array.isArray(newFilters.channels)) {
          const filtered = newFilters.channels.filter((c: string) => c !== itemId);
          if (filtered.length > 0) {
            newFilters.channels = filtered;
          } else {
            delete newFilters.channels;
          }
        } else {
          delete newFilters.channels;
        }
        break;
      case "status":
        delete newFilters.status;
        break;
      case "unread":
        delete newFilters.unread;
        break;
      case "userId":
        delete newFilters.userId;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
    }

    onFilterChange(newFilters);
  };
}
