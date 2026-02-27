import type { TaskGetManyFormData } from "../../../../schemas";
import type { Sector, Customer, User } from "../../../../types";
import { TASK_STATUS_LABELS, TASK_STATUS } from "../../../../constants";

export interface FilterTag {
  key: string;
  label: string;
  value: any;
  displayValue: string;
  onRemove: () => void;
}

// Helper to create filter remover function
export const createFilterRemover = (filters: Partial<TaskGetManyFormData>, onFilterChange: (filters: Partial<TaskGetManyFormData>) => void) => {
  return (key: string, value?: any) => {
    const newFilters = { ...filters };

    switch (key) {
      // Array filters
      case "status":
        if (newFilters.status && value) {
          newFilters.status = newFilters.status.filter((s: string) => s !== value);
          if (newFilters.status.length === 0) delete newFilters.status;
        }
        break;


      case "sectorIds":
        if (newFilters.sectorIds && value) {
          newFilters.sectorIds = newFilters.sectorIds.filter((id: string) => id !== value);
          if (newFilters.sectorIds.length === 0) delete newFilters.sectorIds;
        }
        break;

      case "customerIds":
        if (newFilters.customerIds && value) {
          newFilters.customerIds = newFilters.customerIds.filter((id: string) => id !== value);
          if (newFilters.customerIds.length === 0) delete newFilters.customerIds;
        }
        break;

      case "assigneeIds":
        if (newFilters.assigneeIds && value) {
          newFilters.assigneeIds = newFilters.assigneeIds.filter((id: string) => id !== value);
          if (newFilters.assigneeIds.length === 0) delete newFilters.assigneeIds;
        }
        break;

      case "createdByIds":
        if (newFilters.createdByIds && value) {
          newFilters.createdByIds = newFilters.createdByIds.filter((id: string) => id !== value);
          if (newFilters.createdByIds.length === 0) delete newFilters.createdByIds;
        }
        break;

      case "truckIds":
        if (newFilters.truckIds && value) {
          newFilters.truckIds = newFilters.truckIds.filter((id: string) => id !== value);
          if (newFilters.truckIds.length === 0) delete newFilters.truckIds;
        }
        break;

      // Boolean filters
      case "isOverdue":
      case "isActive":
      case "isCompleted":
      case "isPending":
      case "isInProgress":
      case "isOnHold":
      case "isCancelled":
      case "hasSector":
      case "hasCustomer":
      case "hasTruck":
      case "hasObservation":
      case "hasArtworks":
      case "hasPaints":
      case "hasCommissions":
      case "hasServices":
      case "hasAirbrushing":
      case "hasBudget":
      case "hasNfe":
      case "hasReceipt":
      case "hasAssignee":
        delete (newFilters as any)[key];
        break;

      // Range filters
      case "priceRange":
      case "entryDateRange":
      case "termRange":
      case "startedDateRange":
      case "finishedDateRange":
      case "createdAtRange":
      case "updatedAtRange":
      case "progressRange":
      case "ageRange":
      case "durationRange":
      case "daysUntilDeadlineRange":
      case "createdAt":
      case "updatedAt":
        delete (newFilters as any)[key];
        break;

      // Search
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      default:
        break;
    }

    onFilterChange(newFilters);
  };
};

// Extract active filters for display
export const extractActiveFilters = (
  filters: Partial<TaskGetManyFormData>,
  onRemoveFilter: (key: string, value?: any) => void,
  entities: {
    sectors?: Sector[];
    customers?: Customer[];
    users?: User[];
  },
): FilterTag[] => {
  const tags: FilterTag[] = [];

  // Search
  if (filters.searchingFor) {
    tags.push({
      key: "searchingFor",
      label: "Busca",
      value: filters.searchingFor,
      displayValue: filters.searchingFor,
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Status filters
  if (filters.status && filters.status.length > 0) {
    filters.status.forEach((status: TASK_STATUS) => {
      tags.push({
        key: "status",
        label: "Status",
        value: status,
        displayValue: TASK_STATUS_LABELS[status as TASK_STATUS] || status,
        onRemove: () => onRemoveFilter("status", status),
      });
    });
  }


  // Sector filters
  if (filters.sectorIds && filters.sectorIds.length > 0 && entities.sectors) {
    filters.sectorIds.forEach((sectorId: string) => {
      const sector = entities.sectors?.find((s) => s.id === sectorId);
      if (sector) {
        tags.push({
          key: "sectorIds",
          label: "Setor",
          value: sectorId,
          displayValue: sector.name,
          onRemove: () => onRemoveFilter("sectorIds", sectorId),
        });
      }
    });
  }

  // Customer filters
  if (filters.customerIds && filters.customerIds.length > 0 && entities.customers) {
    filters.customerIds.forEach((customerId: string) => {
      const customer = entities.customers?.find((c) => c.id === customerId);
      if (customer) {
        tags.push({
          key: "customerIds",
          label: "Razão Social",
          value: customerId,
          displayValue: customer.corporateName || customer.fantasyName,
          onRemove: () => onRemoveFilter("customerIds", customerId),
        });
      }
    });
  }

  // Assignee filters
  if (filters.assigneeIds && filters.assigneeIds.length > 0 && entities.users) {
    filters.assigneeIds.forEach((userId: string) => {
      const user = entities.users?.find((u) => u.id === userId);
      if (user) {
        tags.push({
          key: "assigneeIds",
          label: "Responsável",
          value: userId,
          displayValue: user.name,
          onRemove: () => onRemoveFilter("assigneeIds", userId),
        });
      }
    });
  }

  // Boolean filters
  const booleanFilters = [
    { key: "isOverdue", label: "Atrasadas" },
    { key: "isActive", label: "Ativas" },
    { key: "isCompleted", label: "Finalizadas" },
    { key: "isPending", label: "Pendentes" },
    { key: "isInProgress", label: "Em produção" },
    { key: "isOnHold", label: "Em espera" },
    { key: "isCancelled", label: "Canceladas" },
    { key: "hasSector", label: "Com setor" },
    { key: "hasCustomer", label: "Com cliente" },
    { key: "hasTruck", label: "Com caminhão" },
    { key: "hasObservation", label: "Com observação" },
    { key: "hasArtworks", label: "Com layouts" },
    { key: "hasPaints", label: "Com tintas" },
    { key: "hasCommissions", label: "Com comissões" },
    { key: "hasServices", label: "Com serviços" },
    { key: "hasAirbrushing", label: "Com aerografia" },
    { key: "hasBudget", label: "Com orçamento" },
    { key: "hasNfe", label: "Com NFe" },
    { key: "hasReceipt", label: "Com recibo" },
    { key: "hasAssignee", label: "Com responsável" },
  ];

  booleanFilters.forEach(({ key, label }) => {
    const value = (filters as any)[key];
    if (value === true) {
      tags.push({
        key,
        label,
        value: true,
        displayValue: "Sim",
        onRemove: () => onRemoveFilter(key),
      });
    } else if (value === false) {
      tags.push({
        key,
        label,
        value: false,
        displayValue: "Não",
        onRemove: () => onRemoveFilter(key),
      });
    }
  });

  // Price range
  if (filters.priceRange) {
    const parts = [];
    if (filters.priceRange.from !== undefined) parts.push(`Min: R$ ${filters.priceRange.from}`);
    if (filters.priceRange.to !== undefined) parts.push(`Max: R$ ${filters.priceRange.to}`);

    if (parts.length > 0) {
      tags.push({
        key: "priceRange",
        label: "Valor",
        value: filters.priceRange,
        displayValue: parts.join(" - "),
        onRemove: () => onRemoveFilter("priceRange"),
      });
    }
  }

  // Date ranges
  const dateRanges = [
    { key: "entryDateRange", label: "Data de entrada" },
    { key: "termRange", label: "Prazo" },
    { key: "startedDateRange", label: "Data de início" },
    { key: "finishedDateRange", label: "Data de conclusão" },
    { key: "createdAtRange", label: "Data de criação" },
    { key: "updatedAtRange", label: "Data de atualização" },
    { key: "createdAt", label: "Criado em" },
    { key: "updatedAt", label: "Atualizado em" },
  ];

  dateRanges.forEach(({ key, label }) => {
    const range = (filters as any)[key];
    if (range) {
      const parts = [];
      if (range.from || range.gte) {
        const date = new Date(range.from || range.gte);
        parts.push(`De: ${date.toLocaleDateString("pt-BR")}`);
      }
      if (range.to || range.lte) {
        const date = new Date(range.to || range.lte);
        parts.push(`Até: ${date.toLocaleDateString("pt-BR")}`);
      }

      if (parts.length > 0) {
        tags.push({
          key,
          label,
          value: range,
          displayValue: parts.join(" "),
          onRemove: () => onRemoveFilter(key),
        });
      }
    }
  });

  return tags;
};
