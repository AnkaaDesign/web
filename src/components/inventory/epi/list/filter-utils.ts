import type { ItemGetManyFormData } from "../../../../schemas";
import { PPE_TYPE_LABELS, PPE_TYPE } from "../../../../constants";
import type { ItemCategory, ItemBrand } from "../../../../types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function extractActiveFilters(
  filters: Partial<ItemGetManyFormData>,
  onRemoveFilter: (key: string, value?: any) => void,
  entities?: {
    categories?: ItemCategory[];
    brands?: ItemBrand[];
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

  // Category filter
  if (filters.categoryIds && filters.categoryIds.length > 0 && entities?.categories) {
    const categoryNames = filters.categoryIds.map((id: string) => entities.categories?.find((category) => category.id === id)?.name).filter(Boolean);
    if (categoryNames.length > 0) {
      activeFilters.push({
        key: "categoryIds",
        label: "Categorias",
        value: categoryNames.join(", "),
        onRemove: () => onRemoveFilter("categoryIds"),
      });
    }
  } else if (filters.where?.categoryId && entities?.categories) {
    const category = entities.categories.find((c) => c.id === filters.where!.categoryId);
    if (category) {
      activeFilters.push({
        key: "categoryId",
        label: "Categoria",
        value: category.name,
        onRemove: () => onRemoveFilter("categoryId"),
      });
    }
  }

  // Brand filter
  if (filters.brandIds && filters.brandIds.length > 0 && entities?.brands) {
    const brandNames = filters.brandIds.map((id: string) => entities.brands?.find((brand) => brand.id === id)?.name).filter(Boolean);
    if (brandNames.length > 0) {
      activeFilters.push({
        key: "brandIds",
        label: "Marcas",
        value: brandNames.join(", "),
        onRemove: () => onRemoveFilter("brandIds"),
      });
    }
  }

  // PPE Type filter
  if (filters.ppeType && filters.ppeType.length > 0) {
    const labels = filters.ppeType.map((type: PPE_TYPE) => PPE_TYPE_LABELS[type] || type);
    activeFilters.push({
      key: "ppeType",
      label: "Tipos de EPI",
      value: labels.join(", "),
      onRemove: () => onRemoveFilter("ppeType"),
    });
  }

  // Stock filters
  if (filters.lowStock) {
    activeFilters.push({
      key: "lowStock",
      label: "Estoque baixo",
      value: "Sim",
      onRemove: () => onRemoveFilter("lowStock"),
    });
  }

  if (filters.outOfStock) {
    activeFilters.push({
      key: "outOfStock",
      label: "Sem estoque",
      value: "Sim",
      onRemove: () => onRemoveFilter("outOfStock"),
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

  return activeFilters;
}

export function createFilterRemover(setFilters: React.Dispatch<React.SetStateAction<Partial<ItemGetManyFormData>>>) {
  return (key: string, value?: any) => {
    setFilters((currentFilters) => {
      const newFilters = { ...currentFilters };

      switch (key) {
        case "searchingFor":
          delete newFilters.searchingFor;
          break;

        case "categoryIds":
          delete newFilters.categoryIds;
          break;

        case "categoryId":
          if (newFilters.where) {
            delete newFilters.where.categoryId;
            if (Object.keys(newFilters.where).length === 0) {
              delete newFilters.where;
            }
          }
          break;

        case "brandIds":
          delete newFilters.brandIds;
          break;

        case "ppeType":
          delete newFilters.ppeType;
          break;

        case "lowStock":
          delete newFilters.lowStock;
          break;

        case "outOfStock":
          delete newFilters.outOfStock;
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

      return newFilters;
    });
  };
}
