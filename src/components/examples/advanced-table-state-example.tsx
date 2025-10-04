import React, { useMemo } from "react";
import { z } from "zod";
import { useUnifiedTableState } from "@/hooks/use-unified-table-state";
import { useUrlParams, urlParamConfigs, createUrlParamConfig } from "@/hooks/use-url-params";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ITEM_STATUS, STOCK_LEVEL } from "../../constants";

// Example item data structure
interface ExampleItem {
  id: string;
  name: string;
  status: (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS];
  stockLevel: (typeof STOCK_LEVEL)[keyof typeof STOCK_LEVEL];
  price: number;
  quantity: number;
  categoryId: string;
  brandId: string;
  supplierId: string;
  createdAt: Date;
  isActive: boolean;
}

// Example filter structure
interface ItemFilters {
  isActive: boolean;
  status: (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS] | "";
  stockLevels: (typeof STOCK_LEVEL)[keyof typeof STOCK_LEVEL][];
  categoryIds: string[];
  brandIds: string[];
  supplierIds: string[];
  priceRange: { min?: number; max?: number };
  quantityRange: { min?: number; max?: number };
  createdAt: { gte?: Date; lte?: Date };
  hasSupplier: boolean;
  searchingFor: string;
}

// Type-safe URL parameter configuration
const itemFilterConfigs = createUrlParamConfig<ItemFilters>({
  isActive: urlParamConfigs.boolean(true),
  status: urlParamConfigs.enum([...Object.values(ITEM_STATUS), ""] as const, ""),
  stockLevels: {
    schema: z.array(z.nativeEnum(STOCK_LEVEL)),
    defaultValue: [],
    serialize: (value) => (value.length === 0 ? null : JSON.stringify(value)),
    deserialize: (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((v) => Object.values(STOCK_LEVEL).includes(v)) : [];
      } catch {
        return [];
      }
    },
    excludeDefault: true,
  },
  categoryIds: urlParamConfigs.stringArray(),
  brandIds: urlParamConfigs.stringArray(),
  supplierIds: urlParamConfigs.stringArray(),
  priceRange: urlParamConfigs.numberRange(),
  quantityRange: urlParamConfigs.numberRange(),
  createdAt: urlParamConfigs.dateRange(),
  hasSupplier: urlParamConfigs.boolean(false),
  searchingFor: urlParamConfigs.string(),
});

// Mock data for demonstration
const mockItems: ExampleItem[] = [
  {
    id: "1",
    name: "Sample Item 1",
    status: ITEM_STATUS.ACTIVE,
    stockLevel: STOCK_LEVEL.NORMAL,
    price: 99.99,
    quantity: 50,
    categoryId: "cat1",
    brandId: "brand1",
    supplierId: "sup1",
    createdAt: new Date("2024-01-15"),
    isActive: true,
  },
  {
    id: "2",
    name: "Sample Item 2",
    status: ITEM_STATUS.INACTIVE,
    stockLevel: STOCK_LEVEL.LOW,
    price: 149.99,
    quantity: 5,
    categoryId: "cat2",
    brandId: "brand2",
    supplierId: "sup2",
    createdAt: new Date("2024-02-20"),
    isActive: false,
  },
  // Add more mock items as needed
];

const mockCategories = [
  { id: "cat1", name: "Electronics" },
  { id: "cat2", name: "Clothing" },
  { id: "cat3", name: "Books" },
];

const mockBrands = [
  { id: "brand1", name: "Apple" },
  { id: "brand2", name: "Samsung" },
  { id: "brand3", name: "Nike" },
];

const mockSuppliers = [
  { id: "sup1", name: "Supplier A" },
  { id: "sup2", name: "Supplier B" },
  { id: "sup3", name: "Supplier C" },
];

export default function AdvancedTableStateExample() {
  // Custom serialization for complex item filters
  const serializeItemFilters = (filters: Partial<ItemFilters>): Record<string, string> => {
    const { values, serialize } = useUrlParams(itemFilterConfigs, new URLSearchParams(), "items");
    return serialize(filters);
  };

  const deserializeItemFilters = (params: URLSearchParams): Partial<ItemFilters> => {
    const { values } = useUrlParams(itemFilterConfigs, params, "items");
    return values;
  };

  // Use the unified table state with comprehensive configuration
  const {
    // Pagination
    page,
    pageSize,
    setPage,
    setPageSize,

    // Sorting
    sortConfigs,
    toggleSort,
    getSortDirection,
    getSortOrder,

    // Search & Filters
    searchingFor,
    displaySearchText,
    setSearch,
    filters,
    setFilters,
    clearAllFilters,
    hasActiveFilters,

    // Selection with URL persistence
    selectedIds,
    showSelectedOnly,
    selectionMode,
    selectionCount,
    hasSelection,
    toggleSelection,
    setSelectedIds,
    setSelectionMode,
    handleKeyboardSelection,
    resetSelection,
    selectAll,
    deselectAll,
    toggleSelectAll,
    selectAllFiltered,
    selectAllAcrossPages,
    setShowSelectedOnly,
    toggleShowSelectedOnly,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    getSelectedCount,

    // Utilities
    processQueue,
  } = useUnifiedTableState<ItemFilters>({
    namespace: "items",
    defaultPageSize: 20,
    defaultSort: [{ column: "name", direction: "asc" }],
    defaultFilters: {
      isActive: true,
      status: "",
      stockLevels: [],
      categoryIds: [],
      brandIds: [],
      supplierIds: [],
      priceRange: {},
      quantityRange: {},
      createdAt: {},
      hasSupplier: false,
      searchingFor: "",
    },
    serializeToUrl: serializeItemFilters,
    deserializeFromUrl: deserializeItemFilters,
    excludeFromUrl: ["limit", "orderBy", "include"],
    searchDebounceMs: 300,
    filterDebounceMs: 100,
    automaticPageReset: true,
    resetSelectionOnPageChange: false,
  });

  // Apply filters to mock data
  const filteredItems = useMemo(() => {
    let result = [...mockItems];

    // Apply search filter
    if (searchingFor) {
      const searchLower = searchingFor.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(searchLower) || item.id.toLowerCase().includes(searchLower));
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter((item) => item.status === filters.status);
    }

    // Apply stock level filter
    if (filters.stockLevels && filters.stockLevels.length > 0) {
      result = result.filter((item) => filters.stockLevels.includes(item.stockLevel));
    }

    // Apply category filter
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      result = result.filter((item) => filters.categoryIds.includes(item.categoryId));
    }

    // Apply brand filter
    if (filters.brandIds && filters.brandIds.length > 0) {
      result = result.filter((item) => filters.brandIds.includes(item.brandId));
    }

    // Apply supplier filter
    if (filters.supplierIds && filters.supplierIds.length > 0) {
      result = result.filter((item) => filters.supplierIds.includes(item.supplierId));
    }

    // Apply active filter
    if (typeof filters.isActive === "boolean") {
      result = result.filter((item) => item.isActive === filters.isActive);
    }

    // Apply price range filter
    if (filters.priceRange) {
      if (filters.priceRange.min !== undefined) {
        result = result.filter((item) => item.price >= filters.priceRange.min!);
      }
      if (filters.priceRange.max !== undefined) {
        result = result.filter((item) => item.price <= filters.priceRange.max!);
      }
    }

    // Apply quantity range filter
    if (filters.quantityRange) {
      if (filters.quantityRange.min !== undefined) {
        result = result.filter((item) => item.quantity >= filters.quantityRange.min!);
      }
      if (filters.quantityRange.max !== undefined) {
        result = result.filter((item) => item.quantity <= filters.quantityRange.max!);
      }
    }

    // Apply date range filter
    if (filters.createdAt) {
      if (filters.createdAt.gte) {
        result = result.filter((item) => item.createdAt >= filters.createdAt.gte!);
      }
      if (filters.createdAt.lte) {
        result = result.filter((item) => item.createdAt <= filters.createdAt.lte!);
      }
    }

    // Apply sorting
    if (sortConfigs.length > 0) {
      result.sort((a, b) => {
        for (const sortConfig of sortConfigs) {
          const { column, direction } = sortConfig;
          let aValue: any, bValue: any;

          // Handle nested properties
          if (column.includes(".")) {
            const keys = column.split(".");
            aValue = keys.reduce((obj, key) => obj?.[key], a);
            bValue = keys.reduce((obj, key) => obj?.[key], b);
          } else {
            aValue = a[column as keyof ExampleItem];
            bValue = b[column as keyof ExampleItem];
          }

          // Handle different data types
          if (typeof aValue === "string" && typeof bValue === "string") {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
          }

          let comparison = 0;
          if (aValue < bValue) comparison = -1;
          else if (aValue > bValue) comparison = 1;

          if (comparison !== 0) {
            return direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    // Apply show selected only filter
    if (showSelectedOnly) {
      result = result.filter((item) => isSelected(item.id));
    }

    return result;
  }, [searchingFor, filters, sortConfigs, showSelectedOnly, isSelected]);

  // Paginate filtered results
  const paginatedItems = useMemo(() => {
    const startIndex = page * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, page, pageSize]);

  // Get all IDs for selection operations
  const allPageIds = paginatedItems.map((item) => item.id);
  const allFilteredIds = filteredItems.map((item) => item.id);

  // Current URL for debugging
  const currentUrl = window.location.search;

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Advanced Table State Management</h1>
        <p className="text-muted-foreground">Comprehensive URL state management with type safety, immediate UI updates, and race condition prevention</p>
      </div>

      {/* Current URL State */}
      <Card>
        <CardHeader>
          <CardTitle>Current URL State</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">{currentUrl || "No parameters"}</pre>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div>
              <Input type="text" placeholder="Search items..." value={displaySearchText} onChange={(e) => setSearch(e.target.value)} className="w-full" />
              <p className="text-xs text-muted-foreground mt-1">
                Display: "{displaySearchText}" | Debounced: "{searchingFor}"
              </p>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium">Status:</label>
              <select className="w-full mt-1 p-2 border rounded" value={filters.status || ""} onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}>
                <option value="">All Statuses</option>
                {Object.values(ITEM_STATUS).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-sm font-medium">Categories:</label>
              <div className="mt-1 space-y-1">
                {mockCategories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={filters.categoryIds?.includes(category.id) || false}
                      onCheckedChange={(checked) => {
                        const currentIds = filters.categoryIds || [];
                        const newIds = checked ? [...currentIds, category.id] : currentIds.filter((id) => id !== category.id);
                        setFilters({ ...filters, categoryIds: newIds });
                      }}
                    />
                    <label htmlFor={`cat-${category.id}`} className="text-sm">
                      {category.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-sm font-medium">Price Range:</label>
              <div className="flex space-x-2 mt-1">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange?.min || ""}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      priceRange: {
                        ...filters.priceRange,
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange?.max || ""}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      priceRange: {
                        ...filters.priceRange,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* Active Filter */}
            <div className="flex items-center space-x-2">
              <Checkbox id="isActive" checked={filters.isActive} onCheckedChange={(checked) => setFilters({ ...filters, isActive: checked === true })} />
              <label htmlFor="isActive" className="text-sm">
                Show only active items
              </label>
            </div>

            <Button onClick={clearAllFilters} variant="outline" className="w-full">
              Clear All Filters
            </Button>
          </CardContent>
        </Card>

        {/* Pagination & Sorting */}
        <Card>
          <CardHeader>
            <CardTitle>Pagination & Sorting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pagination */}
            <div>
              <p className="text-sm font-medium mb-2">
                Page {page + 1} of {Math.ceil(filteredItems.length / pageSize)}({filteredItems.length} total items)
              </p>
              <div className="flex space-x-2">
                <Button size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
                  Previous
                </Button>
                <Button size="sm" onClick={() => setPage(page + 1)} disabled={(page + 1) * pageSize >= filteredItems.length}>
                  Next
                </Button>
              </div>

              <div className="mt-2">
                <label className="text-xs">Items per page:</label>
                <select className="ml-2 p-1 border rounded text-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Sorting */}
            <div>
              <p className="text-sm font-medium mb-2">Sorting:</p>
              <div className="space-y-1">
                {["name", "price", "quantity", "createdAt"].map((column) => (
                  <Button key={column} size="sm" variant="outline" onClick={() => toggleSort(column)} className="mr-2">
                    {column}{" "}
                    {getSortDirection(column) && (
                      <span className="ml-1">
                        {getSortDirection(column) === "asc" ? "↑" : "↓"}
                        {getSortOrder(column) !== null && <span className="text-xs">({getSortOrder(column)! + 1})</span>}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {sortConfigs.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Active sorts:</p>
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-1">{JSON.stringify(sortConfigs, null, 2)}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Controls */}
      <Card>
        <CardHeader>
          <CardTitle>
            Selection Management
            {hasSelection && <Badge className="ml-2">{selectionCount} selected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => toggleSelectAll(allPageIds)} variant={isAllSelected(allPageIds) ? "default" : "outline"}>
              {isAllSelected(allPageIds) ? "Deselect Page" : "Select Page"}
              {isPartiallySelected(allPageIds) && " (Partial)"}
            </Button>

            <Button size="sm" onClick={() => selectAllFiltered(allFilteredIds)} variant="outline">
              Select All Filtered ({allFilteredIds.length})
            </Button>

            <Button size="sm" onClick={() => selectAllAcrossPages(mockItems.length, async () => mockItems.map((i) => i.id))} variant="outline">
              Select All ({mockItems.length})
            </Button>

            <Button size="sm" onClick={resetSelection} variant="outline">
              Clear Selection
            </Button>

            <Button size="sm" onClick={toggleShowSelectedOnly} variant={showSelectedOnly ? "default" : "outline"}>
              Show Selected Only
            </Button>
          </div>

          <div className="text-sm space-y-1">
            <p>
              Selection Mode: <Badge variant="secondary">{selectionMode}</Badge>
            </p>
            <p>Selected IDs: {selectedIds.length > 0 ? selectedIds.join(", ") : "None"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-2">
                    <Checkbox checked={isAllSelected(allPageIds)} indeterminate={isPartiallySelected(allPageIds)} onCheckedChange={() => toggleSelectAll(allPageIds)} />
                  </th>
                  <th className="border border-gray-300 p-2 text-left">Name</th>
                  <th className="border border-gray-300 p-2 text-left">Status</th>
                  <th className="border border-gray-300 p-2 text-left">Stock</th>
                  <th className="border border-gray-300 p-2 text-left">Price</th>
                  <th className="border border-gray-300 p-2 text-left">Quantity</th>
                  <th className="border border-gray-300 p-2 text-left">Active</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isSelected(item.id) ? "bg-blue-50" : ""}`}>
                    <td className="border border-gray-300 p-2">
                      <Checkbox checked={isSelected(item.id)} onCheckedChange={() => toggleSelection(item.id)} />
                    </td>
                    <td className="border border-gray-300 p-2">{item.name}</td>
                    <td className="border border-gray-300 p-2">
                      <Badge variant={item.status === ITEM_STATUS.ACTIVE ? "default" : "secondary"}>{item.status}</Badge>
                    </td>
                    <td className="border border-gray-300 p-2">
                      <Badge variant={item.stockLevel === STOCK_LEVEL.LOW ? "destructive" : "default"}>{item.stockLevel}</Badge>
                    </td>
                    <td className="border border-gray-300 p-2">${item.price}</td>
                    <td className="border border-gray-300 p-2">{item.quantity}</td>
                    <td className="border border-gray-300 p-2">{item.isActive ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginatedItems.length === 0 && <div className="text-center py-8 text-muted-foreground">No items found with current filters</div>}
        </CardContent>
      </Card>

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Current State:</h4>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                {JSON.stringify(
                  {
                    page,
                    pageSize,
                    searchingFor,
                    displaySearchText,
                    sortConfigs,
                    selectedIds,
                    showSelectedOnly,
                    selectionMode,
                    hasActiveFilters,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">Applied Filters:</h4>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">{JSON.stringify(filters, null, 2)}</pre>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Available Actions:</h4>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={processQueue}>
                Process Queue
              </Button>
              <Button size="sm" onClick={() => setPage(0)}>
                Go to First Page
              </Button>
              <Button size="sm" onClick={() => setSearch("Sample")}>
                Search "Sample"
              </Button>
              <Button size="sm" onClick={() => setFilters({ ...filters, isActive: !filters.isActive })}>
                Toggle Active Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
