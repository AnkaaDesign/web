import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconX, IconSearch, IconPackage, IconUser, IconCheck, IconCalculator, IconCalendar, IconCalendarCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { BorrowGetManyFormData } from "../../../../schemas";
import { useUsers, useItems } from "../../../../hooks";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "package":
      return <IconPackage {...iconProps} />;
    case "user":
      return <IconUser {...iconProps} />;
    case "active":
      return <IconCheck {...iconProps} />;
    case "returned":
      return <IconCalendarCheck {...iconProps} />;
    case "calculator":
      return <IconCalculator {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
    case "calendar-check":
      return <IconCalendarCheck {...iconProps} />;
    default:
      return null;
  }
}

export interface FilterIndicator {
  label: string;
  value: string;
  onRemove: () => void;
  iconType?: string;
}

interface FilterIndicatorsProps {
  filters: Partial<BorrowGetManyFormData>;
  onFilterChange: (filters: Partial<BorrowGetManyFormData>) => void;
  className?: string;
}

export function FilterIndicators({ filters, onFilterChange, className }: FilterIndicatorsProps) {
  // Fetch users and items to get names for display
  const { data: users } = useUsers({
    limit: 100,
    orderBy: { name: "asc" },
    where: { status: "ACTIVE" },
  });

  const { data: items } = useItems({
    limit: 100,
    orderBy: { name: "asc" },
    where: { status: "ACTIVE" },
  });

  const filterIndicators: FilterIndicator[] = [];

  // Search filter
  if (filters.searchingFor) {
    filterIndicators.push({
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.searchingFor;
        onFilterChange(newFilters);
      },
    });
  }

  // Status filters
  if (filters.isActive !== undefined) {
    filterIndicators.push({
      label: "Status",
      value: filters.isActive ? "Ativo" : "Devolvido",
      iconType: filters.isActive ? "active" : "returned",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.isActive;
        onFilterChange(newFilters);
      },
    });
  }

  if (filters.isReturned !== undefined) {
    filterIndicators.push({
      label: "Devolução",
      value: filters.isReturned ? "Devolvidos" : "Não devolvidos",
      iconType: "returned",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.isReturned;
        onFilterChange(newFilters);
      },
    });
  }

  // User filters
  if (filters.userIds && filters.userIds.length > 0) {
    const userNames = filters.userIds.map((id: string) => users?.data?.find((u: any) => u.id === id)?.name || "Usuário").join(", ");

    filterIndicators.push({
      label: "Usuários",
      value: userNames.length > 50 ? `${userNames.substring(0, 50)}...` : userNames,
      iconType: "user",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.userIds;
        onFilterChange(newFilters);
      },
    });
  }

  // Item filters
  if (filters.itemIds && filters.itemIds.length > 0) {
    const itemNames = filters.itemIds.map((id: string) => items?.data?.find((i: any) => i.id === id)?.name || "Item").join(", ");

    filterIndicators.push({
      label: "Itens",
      value: itemNames.length > 50 ? `${itemNames.substring(0, 50)}...` : itemNames,
      iconType: "package",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.itemIds;
        onFilterChange(newFilters);
      },
    });
  }

  // Quantity range filter
  if (filters.quantityRange && (filters.quantityRange.min !== undefined || filters.quantityRange.max !== undefined)) {
    let value = "";
    if (filters.quantityRange.min !== undefined && filters.quantityRange.max !== undefined) {
      value = `${filters.quantityRange.min} - ${filters.quantityRange.max}`;
    } else if (filters.quantityRange.min !== undefined) {
      value = `≥ ${filters.quantityRange.min}`;
    } else if (filters.quantityRange.max !== undefined) {
      value = `≤ ${filters.quantityRange.max}`;
    }

    filterIndicators.push({
      label: "Quantidade",
      value,
      iconType: "calculator",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.quantityRange;
        onFilterChange(newFilters);
      },
    });
  }

  // Created date filter
  if (filters.createdAt && (filters.createdAt.gte || filters.createdAt.lte)) {
    let value = "";
    if (filters.createdAt.gte && filters.createdAt.lte) {
      value = `${format(filters.createdAt.gte, "dd/MM/yyyy", { locale: ptBR })} - ${format(filters.createdAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
    } else if (filters.createdAt.gte) {
      value = `Após ${format(filters.createdAt.gte, "dd/MM/yyyy", { locale: ptBR })}`;
    } else if (filters.createdAt.lte) {
      value = `Até ${format(filters.createdAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
    }

    filterIndicators.push({
      label: "Criado em",
      value,
      iconType: "calendar",
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.createdAt;
        onFilterChange(newFilters);
      },
    });
  }

  // Returned date filter
  if (filters.where?.returnedAt && typeof filters.where.returnedAt === "object" && "gte" in filters.where.returnedAt) {
    const returnedAtRange = filters.where.returnedAt as { gte?: Date; lte?: Date };
    let value = "";
    if (returnedAtRange.gte && returnedAtRange.lte) {
      value = `${format(returnedAtRange.gte, "dd/MM/yyyy", { locale: ptBR })} - ${format(returnedAtRange.lte, "dd/MM/yyyy", { locale: ptBR })}`;
    } else if (returnedAtRange.gte) {
      value = `Após ${format(returnedAtRange.gte, "dd/MM/yyyy", { locale: ptBR })}`;
    } else if (returnedAtRange.lte) {
      value = `Até ${format(returnedAtRange.lte, "dd/MM/yyyy", { locale: ptBR })}`;
    }

    filterIndicators.push({
      label: "Devolvido em",
      value,
      iconType: "calendar-check",
      onRemove: () => {
        const newFilters = { ...filters };
        if (newFilters.where?.returnedAt) {
          delete newFilters.where.returnedAt;
          // Clean up where object if empty
          if (Object.keys(newFilters.where || {}).length === 0) {
            delete newFilters.where;
          }
        }
        onFilterChange(newFilters);
      },
    });
  }

  if (!filterIndicators.length) {
    return null;
  }

  const handleClearAll = () => {
    onFilterChange({
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { createdAt: "desc" },
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>

      {filterIndicators.map((filter, index) => (
        <Badge
          key={`${filter.label}-${filter.value}-${index}`}
          variant="secondary"
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md cursor-pointer",
            "bg-gray-100 text-gray-700 border border-gray-200",
            "hover:bg-red-100 hover:text-red-700 hover:border-red-200 transition-colors",
          )}
          onClick={filter.onRemove}
        >
          {filter.iconType && <span className="flex items-center">{renderFilterIcon(filter.iconType)}</span>}
          <span className="font-medium">{filter.label}:</span>
          <span>{filter.value}</span>
          <IconX className="h-3 w-3 ml-1" />
        </Badge>
      ))}

      <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs">
        Limpar todos
      </Button>
    </div>
  );
}
