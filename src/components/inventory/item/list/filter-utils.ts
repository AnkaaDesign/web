import type { ItemGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS, ITEM_CATEGORY_TYPE, ITEM_CATEGORY_TYPE_LABELS } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  categories?: Array<{ id: string; name: string; isPpe?: boolean }>;
  brands?: Array<{ id: string; name: string }>;
  suppliers?: Array<{ id: string; fantasyName: string }>;
}

export function extractActiveFilters(
  filters: Partial<ItemGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { categories = [], brands = [], suppliers = [] } = options;

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Boolean filters
  if (filters.showInactive) {
    activeFilters.push({
      key: "showInactive",
      label: "Status",
      value: "Incluindo desativados",
      iconType: "eye",
      onRemove: () => onRemoveFilter("showInactive"),
    });
  }

  if (filters.where?.shouldAssignToUser !== undefined) {
    activeFilters.push({
      key: "shouldAssignToUser",
      label: "Atribuir a usuário",
      value: filters.where.shouldAssignToUser ? "Sim" : "Não",
      iconType: "user",
      onRemove: () => onRemoveFilter("shouldAssignToUser"),
    });
  }

  // Stock filters
  if (filters.lowStock) {
    activeFilters.push({
      key: "lowStock",
      label: "Estoque",
      value: "Baixo",
      iconType: "trending-down",
      onRemove: () => onRemoveFilter("lowStock"),
    });
  }

  if (filters.outOfStock) {
    activeFilters.push({
      key: "outOfStock",
      label: "Estoque",
      value: "Esgotado",
      iconType: "box",
      onRemove: () => onRemoveFilter("outOfStock"),
    });
  }

  if (filters.overStock) {
    activeFilters.push({
      key: "overStock",
      label: "Estoque",
      value: "Excesso",
      iconType: "box",
      onRemove: () => onRemoveFilter("overStock"),
    });
  }

  if (filters.criticalStock) {
    activeFilters.push({
      key: "criticalStock",
      label: "Estoque",
      value: "Crítico",
      iconType: "alert-triangle",
      onRemove: () => onRemoveFilter("criticalStock"),
    });
  }

  if (filters.nearReorderPoint) {
    activeFilters.push({
      key: "nearReorderPoint",
      label: "Estoque",
      value: "Próximo ao ponto de reposição",
      iconType: "target",
      onRemove: () => onRemoveFilter("nearReorderPoint"),
    });
  }

  if (filters.noReorderPoint) {
    activeFilters.push({
      key: "noReorderPoint",
      label: "Estoque",
      value: "Sem ponto de reposição",
      iconType: "question-mark",
      onRemove: () => onRemoveFilter("noReorderPoint"),
    });
  }

  if (filters.negativeStock) {
    activeFilters.push({
      key: "negativeStock",
      label: "Estoque",
      value: "Negativo",
      iconType: "minus",
      onRemove: () => onRemoveFilter("negativeStock"),
    });
  }

  // Stock levels array filter - display individual badges for each level
  if (filters.stockLevels && filters.stockLevels.length > 0) {
    filters.stockLevels.forEach((level: STOCK_LEVEL) => {
      const label = STOCK_LEVEL_LABELS[level] || level;
      activeFilters.push({
        key: `stockLevels-${level}`,
        label: "Nível de Estoque",
        value: label,
        iconType: "box",
        itemId: level,
        onRemove: () => onRemoveFilter("stockLevels", level),
      });
    });
  }

  // Entity filters - Categories (individual badges for each category)
  if (filters.categoryIds && Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
    const selectedCategories = categories.filter((cat) => filters.categoryIds?.includes(cat.id));

    selectedCategories.forEach((category) => {
      const categoryType = (category as any).type || ITEM_CATEGORY_TYPE.REGULAR;
      const typeLabel = ITEM_CATEGORY_TYPE_LABELS[categoryType as ITEM_CATEGORY_TYPE];
      const displayValue = categoryType !== ITEM_CATEGORY_TYPE.REGULAR ? `${category.name} (${typeLabel})` : category.name;
      activeFilters.push({
        key: `categoryIds-${category.id}`, // Unique key for each category
        label: "Categoria",
        value: displayValue,
        iconType: "chart-bar",
        itemId: category.id,
        onRemove: () => onRemoveFilter("categoryIds", category.id),
      });
    });
  } else if (filters.where?.categoryId) {
    const category = categories.find((cat) => cat.id === filters.where?.categoryId);
    if (category) {
      activeFilters.push({
        key: "categoryId",
        label: "Categoria",
        value: category.name,
        iconType: "chart-bar",
        onRemove: () => onRemoveFilter("categoryId"),
      });
    }
  }

  // Entity filters - Brands (individual badges for each brand)
  if (filters.brandIds && Array.isArray(filters.brandIds) && filters.brandIds.length > 0) {
    const selectedBrands = brands.filter((brand) => filters.brandIds?.includes(brand.id));

    selectedBrands.forEach((brand) => {
      activeFilters.push({
        key: `brandIds-${brand.id}`, // Unique key for each brand
        label: "Marca",
        value: brand.name,
        iconType: "tags",
        itemId: brand.id,
        onRemove: () => onRemoveFilter("brandIds", brand.id),
      });
    });
  } else if (filters.where?.brandId) {
    const brand = brands.find((b) => b.id === filters.where?.brandId);
    if (brand) {
      activeFilters.push({
        key: "brandId",
        label: "Marca",
        value: brand.name,
        iconType: "tags",
        onRemove: () => onRemoveFilter("brandId"),
      });
    }
  }

  // Entity filters - Suppliers (individual badges for each supplier)
  if (filters.supplierIds && Array.isArray(filters.supplierIds) && filters.supplierIds.length > 0) {
    const selectedSuppliers = suppliers.filter((supplier) => filters.supplierIds?.includes(supplier.id));

    selectedSuppliers.forEach((supplier) => {
      activeFilters.push({
        key: `supplierIds-${supplier.id}`, // Unique key for each supplier
        label: "Fornecedor",
        value: supplier.fantasyName,
        iconType: "package",
        itemId: supplier.id,
        onRemove: () => onRemoveFilter("supplierIds", supplier.id),
      });
    });
  } else if (filters.where?.supplierId) {
    const supplier = suppliers.find((s) => s.id === filters.where?.supplierId);
    if (supplier) {
      activeFilters.push({
        key: "supplierId",
        label: "Fornecedor",
        value: supplier.fantasyName,
        iconType: "package",
        onRemove: () => onRemoveFilter("supplierId"),
      });
    }
  }

  // Measure units
  if (filters.measureUnits && filters.measureUnits.length > 0) {
    const displayValue = filters.measureUnits.length <= 2 ? filters.measureUnits.join(", ") : `${filters.measureUnits.length} selecionadas`;

    activeFilters.push({
      key: "measureUnits",
      label: "Unidade de Medida",
      value: displayValue,
      iconType: "calculator",
      onRemove: () => onRemoveFilter("measureUnits"),
    });
  }

  // Range filters
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
      iconType: "box",
      onRemove: () => onRemoveFilter("quantityRange"),
    });
  }

  if (filters.icmsRange?.min !== undefined || filters.icmsRange?.max !== undefined) {
    const min = filters.icmsRange.min;
    const max = filters.icmsRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min}% - ${max}%`;
    } else if (min !== undefined) {
      value = `≥ ${min}%`;
    } else if (max !== undefined) {
      value = `≤ ${max}%`;
    }

    activeFilters.push({
      key: "icmsRange",
      label: "ICMS",
      value,
      iconType: "calculator",
      onRemove: () => onRemoveFilter("icmsRange"),
    });
  }

  if (filters.ipiRange?.min !== undefined || filters.ipiRange?.max !== undefined) {
    const min = filters.ipiRange.min;
    const max = filters.ipiRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min}% - ${max}%`;
    } else if (min !== undefined) {
      value = `≥ ${min}%`;
    } else if (max !== undefined) {
      value = `≤ ${max}%`;
    }

    activeFilters.push({
      key: "ipiRange",
      label: "IPI",
      value,
      iconType: "calculator",
      onRemove: () => onRemoveFilter("ipiRange"),
    });
  }

  if (filters.monthlyConsumptionRange?.min !== undefined || filters.monthlyConsumptionRange?.max !== undefined) {
    const min = filters.monthlyConsumptionRange.min;
    const max = filters.monthlyConsumptionRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min.toFixed(0)} - ${max.toFixed(0)}`;
    } else if (min !== undefined) {
      value = `≥ ${min.toFixed(0)}`;
    } else if (max !== undefined) {
      value = `≤ ${max.toFixed(0)}`;
    }

    activeFilters.push({
      key: "monthlyConsumptionRange",
      label: "Consumo Mensal",
      value,
      iconType: "trending-down",
      onRemove: () => onRemoveFilter("monthlyConsumptionRange"),
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
      key: "createdAt",
      label: "Data criação",
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
      key: "updatedAt",
      label: "Data atualização",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("updatedAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<ItemGetManyFormData>, onFilterChange: (filters: Partial<ItemGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };
    const newWhere = { ...newFilters.where };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "showInactive":
        delete newFilters.showInactive;
        break;
      case "shouldAssignToUser":
        delete newWhere.shouldAssignToUser;
        break;
      case "lowStock":
        delete newFilters.lowStock;
        // Also remove the associated where clause
        if (newWhere.OR) {
          delete newWhere.OR;
        }
        break;
      case "outOfStock":
        delete newFilters.outOfStock;
        break;
      case "overStock":
        delete newFilters.overStock;
        break;
      case "criticalStock":
        delete newFilters.criticalStock;
        break;
      case "nearReorderPoint":
        delete newFilters.nearReorderPoint;
        break;
      case "noReorderPoint":
        delete newFilters.noReorderPoint;
        break;
      case "negativeStock":
        delete newFilters.negativeStock;
        break;
      case "stockLevels":
        if (itemId && Array.isArray(newFilters.stockLevels)) {
          // Remove specific stock level from array
          const filteredLevels = newFilters.stockLevels.filter((level) => level !== itemId);
          if (filteredLevels.length > 0) {
            newFilters.stockLevels = filteredLevels;
          } else {
            delete newFilters.stockLevels;
          }
        } else {
          // Remove all stock levels
          delete newFilters.stockLevels;
        }
        break;
      case "categoryIds":
        if (itemId && Array.isArray(newFilters.categoryIds)) {
          // Remove specific category from array
          const filteredCategories = newFilters.categoryIds.filter((id) => id !== itemId);
          if (filteredCategories.length > 0) {
            newFilters.categoryIds = filteredCategories;
          } else {
            delete newFilters.categoryIds;
          }
        } else {
          // Remove all categories
          delete newFilters.categoryIds;
        }
        break;
      case "categoryId":
        delete newWhere.categoryId;
        break;
      case "brandIds":
        if (itemId && Array.isArray(newFilters.brandIds)) {
          // Remove specific brand from array
          const filteredBrands = newFilters.brandIds.filter((id) => id !== itemId);
          if (filteredBrands.length > 0) {
            newFilters.brandIds = filteredBrands;
          } else {
            delete newFilters.brandIds;
          }
        } else {
          // Remove all brands
          delete newFilters.brandIds;
        }
        break;
      case "brandId":
        delete newWhere.brandId;
        break;
      case "supplierIds":
        if (itemId && Array.isArray(newFilters.supplierIds)) {
          // Remove specific supplier from array
          const filteredSuppliers = newFilters.supplierIds.filter((id) => id !== itemId);
          if (filteredSuppliers.length > 0) {
            newFilters.supplierIds = filteredSuppliers;
          } else {
            delete newFilters.supplierIds;
          }
        } else {
          // Remove all suppliers
          delete newFilters.supplierIds;
        }
        break;
      case "supplierId":
        delete newWhere.supplierId;
        break;
      case "measureUnits":
        delete newFilters.measureUnits;
        break;
      case "quantityRange":
        delete newFilters.quantityRange;
        break;
      case "icmsRange":
        delete newFilters.icmsRange;
        break;
      case "ipiRange":
        delete newFilters.ipiRange;
        break;
      case "monthlyConsumptionRange":
        delete newFilters.monthlyConsumptionRange;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
    }

    // Update where clause
    if (Object.keys(newWhere).length === 0) {
      delete newFilters.where;
    } else {
      newFilters.where = newWhere;
    }

    onFilterChange(newFilters);
  };
}
