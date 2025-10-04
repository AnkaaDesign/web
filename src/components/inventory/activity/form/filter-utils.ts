export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  categories?: Array<{ id: string; name: string }>;
  brands?: Array<{ id: string; name: string }>;
  suppliers?: Array<{ id: string; fantasyName: string }>;
}

export function extractActiveFilters(
  filters: {
    searchingFor?: string;
    showInactive?: boolean;
    categoryIds?: string[];
    brandIds?: string[];
    supplierIds?: string[];
  },
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

  // Entity filters - Categories (individual badges for each category)
  if (filters.categoryIds && Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
    const selectedCategories = categories.filter((cat) => filters.categoryIds?.includes(cat.id));

    selectedCategories.forEach((category) => {
      activeFilters.push({
        key: `categoryIds-${category.id}`,
        label: "Categoria",
        value: category.name,
        iconType: "chart-bar",
        itemId: category.id,
        onRemove: () => onRemoveFilter("categoryIds", category.id),
      });
    });
  }

  // Entity filters - Brands (individual badges for each brand)
  if (filters.brandIds && Array.isArray(filters.brandIds) && filters.brandIds.length > 0) {
    const selectedBrands = brands.filter((brand) => filters.brandIds?.includes(brand.id));

    selectedBrands.forEach((brand) => {
      activeFilters.push({
        key: `brandIds-${brand.id}`,
        label: "Marca",
        value: brand.name,
        iconType: "tags",
        itemId: brand.id,
        onRemove: () => onRemoveFilter("brandIds", brand.id),
      });
    });
  }

  // Entity filters - Suppliers (individual badges for each supplier)
  if (filters.supplierIds && Array.isArray(filters.supplierIds) && filters.supplierIds.length > 0) {
    const selectedSuppliers = suppliers.filter((supplier) => filters.supplierIds?.includes(supplier.id));

    selectedSuppliers.forEach((supplier) => {
      activeFilters.push({
        key: `supplierIds-${supplier.id}`,
        label: "Fornecedor",
        value: supplier.fantasyName,
        iconType: "package",
        itemId: supplier.id,
        onRemove: () => onRemoveFilter("supplierIds", supplier.id),
      });
    });
  }

  return activeFilters;
}

export function createFilterRemover(
  currentFilters: {
    searchingFor?: string;
    showInactive?: boolean;
    categoryIds?: string[];
    brandIds?: string[];
    supplierIds?: string[];
  },
  onFilterChange: (filters: { searchingFor?: string; showInactive?: boolean; categoryIds?: string[]; brandIds?: string[]; supplierIds?: string[] }) => void,
) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "showInactive":
        delete newFilters.showInactive;
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
    }

    onFilterChange(newFilters);
  };
}
