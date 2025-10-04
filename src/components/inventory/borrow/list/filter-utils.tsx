import type { BorrowGetManyFormData } from "../../../../schemas";
import type { Item, User, ItemCategory, ItemBrand, Supplier } from "../../../../types";
import { BORROW_STATUS_LABELS, BORROW_STATUS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { IconSearch, IconPackage, IconUser, IconCategory, IconTag, IconCircleCheck, IconCalendarEvent, IconCalendarCheck, IconTruck, IconEye } from "@tabler/icons-react";
import type { FilterIndicator } from "./filter-indicator";

interface FilterData {
  items?: Item[];
  users?: User[];
  categories?: ItemCategory[];
  brands?: ItemBrand[];
  suppliers?: Supplier[];
}

export function extractActiveFilters(filters: Partial<BorrowGetManyFormData>, onRemoveFilter: (key: string, value?: any) => void, data: FilterData): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const where = filters.where || {};

  // Search filter (searchingFor)
  if (filters.searchingFor) {
    activeFilters.push({
      label: "Buscar",
      value: filters.searchingFor,
      onRemove: () => onRemoveFilter("searchingFor"),
      icon: <IconSearch className="h-3 w-3" />,
    });
  }

  // Multi-select Item filters
  if (filters.itemIds && filters.itemIds.length > 0 && data.items) {
    const itemNames = filters.itemIds.map((id: string) => data.items?.find((i: Item) => i.id === id)?.name || "Item").join(", ");

    activeFilters.push({
      label: "Itens",
      value: itemNames.length > 50 ? `${itemNames.substring(0, 50)}...` : itemNames,
      onRemove: () => onRemoveFilter("itemIds"),
      icon: <IconPackage className="h-3 w-3" />,
    });
  }

  // Legacy single Item filter (for backward compatibility)
  if (where.itemId && data.items) {
    const item = data.items.find((i: Item) => i.id === where.itemId);
    if (item) {
      activeFilters.push({
        label: "Item",
        value: item.name,
        onRemove: () => onRemoveFilter("itemId"),
        icon: <IconPackage className="h-3 w-3" />,
      });
    }
  }

  // Multi-select User filters
  if (filters.userIds && filters.userIds.length > 0 && data.users) {
    const userNames = filters.userIds.map((id: string) => data.users?.find((u: User) => u.id === id)?.name || "Usuário").join(", ");

    activeFilters.push({
      label: "Usuários",
      value: userNames.length > 50 ? `${userNames.substring(0, 50)}...` : userNames,
      onRemove: () => onRemoveFilter("userIds"),
      icon: <IconUser className="h-3 w-3" />,
    });
  }

  // Legacy single User filter (for backward compatibility)
  if (where.userId && data.users) {
    const user = data.users.find((u: User) => u.id === where.userId);
    if (user) {
      activeFilters.push({
        label: "Usuário",
        value: user.name,
        onRemove: () => onRemoveFilter("userId"),
        icon: <IconUser className="h-3 w-3" />,
      });
    }
  }

  // Status filter
  if (where.status) {
    // Handle both string and object types for status
    let statusValue: string;
    if (typeof where.status === "string") {
      statusValue = where.status;
    } else {
      // Handle object case with explicit type checking
      statusValue = (where.status as any).equals || (where.status as any).in?.[0] || "Unknown";
    }

    const displayValue =
      statusValue && Object.values(BORROW_STATUS).includes(statusValue as BORROW_STATUS) ? BORROW_STATUS_LABELS[statusValue as keyof typeof BORROW_STATUS_LABELS] : statusValue;

    activeFilters.push({
      label: "Status",
      value: displayValue,
      onRemove: () => onRemoveFilter("status"),
      icon: <IconCircleCheck className="h-3 w-3" />,
    });
  }

  // Date range filters
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const dateRange = [];
    if (filters.createdAt.gte) dateRange.push(`de ${formatDate(filters.createdAt.gte)}`);
    if (filters.createdAt.lte) dateRange.push(`até ${formatDate(filters.createdAt.lte)}`);
    activeFilters.push({
      label: "Data do Empréstimo",
      value: dateRange.join(" "),
      onRemove: () => onRemoveFilter("createdAt"),
      icon: <IconCalendarEvent className="h-3 w-3" />,
    });
  }

  if (filters.returnedAt?.gte || filters.returnedAt?.lte) {
    const dateRange = [];
    if (filters.returnedAt.gte) dateRange.push(`de ${formatDate(filters.returnedAt.gte)}`);
    if (filters.returnedAt.lte) dateRange.push(`até ${formatDate(filters.returnedAt.lte)}`);
    activeFilters.push({
      label: "Data de Devolução",
      value: dateRange.join(" "),
      onRemove: () => onRemoveFilter("returnedAt"),
      icon: <IconCalendarCheck className="h-3 w-3" />,
    });
  }

  // Category filters
  if (filters.categoryIds && filters.categoryIds.length > 0 && data.categories) {
    const categoryNames = filters.categoryIds.map((id: string) => data.categories?.find((c: ItemCategory) => c.id === id)?.name || "Categoria").join(", ");

    activeFilters.push({
      label: "Categorias",
      value: categoryNames.length > 50 ? `${categoryNames.substring(0, 50)}...` : categoryNames,
      onRemove: () => onRemoveFilter("categoryIds"),
      icon: <IconCategory className="h-3 w-3" />,
    });
  }

  // Brand filters
  if (filters.brandIds && filters.brandIds.length > 0 && data.brands) {
    const brandNames = filters.brandIds.map((id: string) => data.brands?.find((b: ItemBrand) => b.id === id)?.name || "Marca").join(", ");

    activeFilters.push({
      label: "Marcas",
      value: brandNames.length > 50 ? `${brandNames.substring(0, 50)}...` : brandNames,
      onRemove: () => onRemoveFilter("brandIds"),
      icon: <IconTag className="h-3 w-3" />,
    });
  }

  // Supplier filters
  if (filters.supplierIds && filters.supplierIds.length > 0 && data.suppliers) {
    const supplierNames = filters.supplierIds
      .map((id: string) => {
        const supplier = data.suppliers?.find((s: Supplier) => s.id === id);
        return supplier?.fantasyName || supplier?.corporateName || "Fornecedor";
      })
      .join(", ");

    activeFilters.push({
      label: "Fornecedores",
      value: supplierNames.length > 50 ? `${supplierNames.substring(0, 50)}...` : supplierNames,
      onRemove: () => onRemoveFilter("supplierIds"),
      icon: <IconTruck className="h-3 w-3" />,
    });
  }

  // Show returned filter
  if (filters.showReturned) {
    activeFilters.push({
      label: "Mostrar",
      value: "Empréstimos devolvidos",
      onRemove: () => onRemoveFilter("showReturned"),
      icon: <IconEye className="h-3 w-3" />,
    });
  }

  return activeFilters;
}

export function createFilterRemover(filters: Partial<BorrowGetManyFormData>, handleFilterChange: (filters: Partial<BorrowGetManyFormData>) => void) {
  return (key: string) => {
    const newFilters = { ...filters };
    const newWhere = { ...newFilters.where };

    switch (key) {
      // Legacy single-value filters
      case "itemId":
      case "userId":
      case "status":
        delete newWhere[key as keyof typeof newWhere];
        break;
      // Multi-select array filters
      case "itemIds":
      case "userIds":
      case "categoryIds":
      case "brandIds":
      case "supplierIds":
        delete newFilters[key as keyof typeof newFilters];
        break;
      // Date range filters
      case "createdAt":
      case "returnedAt":
        delete newFilters[key as keyof typeof newFilters];
        break;
      // Boolean filters
      case "showReturned":
        delete newFilters.showReturned;
        break;
    }

    newFilters.where = Object.keys(newWhere).length > 0 ? newWhere : undefined;
    handleFilterChange(newFilters);
  };
}
