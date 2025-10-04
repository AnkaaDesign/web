import { trackEvent } from "./analytics";

// Item List View Events
export const trackItemSearch = (query: string, resultCount: number) => {
  trackEvent("item_search", {
    category: "item_list",
    action: "search",
    label: query,
    value: resultCount,
    search_query: query,
    result_count: resultCount,
  });
};

export const trackItemFilterApplied = (filterType: string, filterValue: string | number | boolean, resultCount: number) => {
  trackEvent("item_filter_applied", {
    category: "item_list",
    action: "filter",
    label: `${filterType}: ${filterValue}`,
    value: resultCount,
    filter_type: filterType,
    filter_value: filterValue,
    result_count: resultCount,
  });
};

export const trackItemFilterCleared = (filterType?: string) => {
  trackEvent("item_filter_cleared", {
    category: "item_list",
    action: "clear_filter",
    label: filterType || "all",
    filter_type: filterType || "all",
  });
};

export const trackItemExport = (format: string, itemCount: number, filters?: Record<string, any>) => {
  trackEvent("item_export", {
    category: "item_list",
    action: "export",
    label: format,
    value: itemCount,
    export_format: format,
    item_count: itemCount,
    has_filters: !!filters && Object.keys(filters).length > 0,
    filter_count: filters ? Object.keys(filters).length : 0,
  });
};

export const trackItemViewModeChange = (viewMode: "grid" | "list" | "table") => {
  trackEvent("item_view_mode_changed", {
    category: "item_list",
    action: "change_view",
    label: viewMode,
    view_mode: viewMode,
  });
};

export const trackItemSortChange = (sortField: string, sortDirection: "asc" | "desc") => {
  trackEvent("item_sort_changed", {
    category: "item_list",
    action: "sort",
    label: `${sortField}_${sortDirection}`,
    sort_field: sortField,
    sort_direction: sortDirection,
  });
};

// Item Detail View Events
export const trackItemView = (itemId: string, itemName: string, source: string) => {
  trackEvent("item_viewed", {
    category: "item_detail",
    action: "view",
    label: itemName,
    item_id: itemId,
    item_name: itemName,
    source: source,
  });
};

export const trackItemEdit = (itemId: string, itemName: string, changedFields: string[]) => {
  trackEvent("item_edited", {
    category: "item_detail",
    action: "edit",
    label: itemName,
    item_id: itemId,
    item_name: itemName,
    changed_field_count: changedFields.length,
    changed_fields: changedFields,
  });
};

export const trackItemCreate = (itemName: string, category: string, brand?: string) => {
  trackEvent("item_created", {
    category: "item_detail",
    action: "create",
    label: itemName,
    item_name: itemName,
    item_category: category,
    item_brand: brand,
  });
};

export const trackItemDelete = (itemId: string, itemName: string) => {
  trackEvent("item_deleted", {
    category: "item_detail",
    action: "delete",
    label: itemName,
    item_id: itemId,
    item_name: itemName,
  });
};

// Item Interaction Events
export const trackItemImageView = (itemId: string, itemName: string, imageIndex: number) => {
  trackEvent("item_image_viewed", {
    category: "item_interaction",
    action: "view_image",
    label: itemName,
    value: imageIndex,
    item_id: itemId,
    item_name: itemName,
    image_index: imageIndex,
  });
};

export const trackItemPriceHistoryView = (itemId: string, itemName: string, priceCount: number) => {
  trackEvent("item_price_history_viewed", {
    category: "item_interaction",
    action: "view_price_history",
    label: itemName,
    value: priceCount,
    item_id: itemId,
    item_name: itemName,
    price_count: priceCount,
  });
};

export const trackItemStockAdjustment = (itemId: string, itemName: string, adjustmentType: "increase" | "decrease", quantity: number) => {
  trackEvent("item_stock_adjusted", {
    category: "item_interaction",
    action: "adjust_stock",
    label: `${itemName} - ${adjustmentType}`,
    value: quantity,
    item_id: itemId,
    item_name: itemName,
    adjustment_type: adjustmentType,
    quantity: quantity,
  });
};

// Item Performance Metrics
export const trackItemListLoadTime = (loadTime: number, itemCount: number, hasFilters: boolean) => {
  trackEvent("item_list_load_time", {
    category: "item_performance",
    action: "load",
    label: hasFilters ? "with_filters" : "no_filters",
    value: loadTime,
    load_time_ms: loadTime,
    item_count: itemCount,
    has_filters: hasFilters,
  });
};

export const trackItemSearchPerformance = (searchTime: number, query: string, resultCount: number) => {
  trackEvent("item_search_performance", {
    category: "item_performance",
    action: "search",
    label: query,
    value: searchTime,
    search_time_ms: searchTime,
    search_query: query,
    result_count: resultCount,
  });
};

export const trackItemPaginationPerformance = (loadTime: number, page: number, pageSize: number) => {
  trackEvent("item_pagination_performance", {
    category: "item_performance",
    action: "paginate",
    label: `page_${page}`,
    value: loadTime,
    load_time_ms: loadTime,
    page_number: page,
    page_size: pageSize,
  });
};

// Item Error Tracking
export const trackItemError = (action: string, error: string, itemId?: string) => {
  trackEvent("item_error", {
    category: "item_error",
    action: action,
    label: error,
    item_id: itemId,
    error_message: error,
  });
};

// Batch Operations
export const trackItemBatchOperation = (operation: "update" | "delete" | "export", itemCount: number, success: boolean) => {
  trackEvent("item_batch_operation", {
    category: "item_batch",
    action: operation,
    label: success ? "success" : "failure",
    value: itemCount,
    operation_type: operation,
    item_count: itemCount,
    success: success,
  });
};

// Item Category and Brand Analytics
export const trackItemCategoryFilter = (category: string, resultCount: number) => {
  trackEvent("item_category_filtered", {
    category: "item_filter",
    action: "filter_category",
    label: category,
    value: resultCount,
    category_name: category,
    result_count: resultCount,
  });
};

export const trackItemBrandFilter = (brand: string, resultCount: number) => {
  trackEvent("item_brand_filtered", {
    category: "item_filter",
    action: "filter_brand",
    label: brand,
    value: resultCount,
    brand_name: brand,
    result_count: resultCount,
  });
};

// Low Stock Analytics
export const trackLowStockView = (itemCount: number) => {
  trackEvent("low_stock_viewed", {
    category: "item_inventory",
    action: "view_low_stock",
    label: "low_stock_items",
    value: itemCount,
    low_stock_count: itemCount,
  });
};

export const trackOutOfStockView = (itemCount: number) => {
  trackEvent("out_of_stock_viewed", {
    category: "item_inventory",
    action: "view_out_of_stock",
    label: "out_of_stock_items",
    value: itemCount,
    out_of_stock_count: itemCount,
  });
};

// Item Import/Export Analytics
export const trackItemImportStart = (fileType: string, fileSize: number) => {
  trackEvent("item_import_started", {
    category: "item_import_export",
    action: "import_start",
    label: fileType,
    value: fileSize,
    file_type: fileType,
    file_size_bytes: fileSize,
  });
};

export const trackItemImportComplete = (successCount: number, errorCount: number, duration: number) => {
  trackEvent("item_import_completed", {
    category: "item_import_export",
    action: "import_complete",
    label: errorCount > 0 ? "with_errors" : "success",
    value: successCount,
    success_count: successCount,
    error_count: errorCount,
    duration_ms: duration,
  });
};

// Advanced Search Analytics
export const trackItemAdvancedSearch = (filters: Record<string, any>, resultCount: number) => {
  trackEvent("item_advanced_search", {
    category: "item_search",
    action: "advanced_search",
    label: `${Object.keys(filters).length} filters`,
    value: resultCount,
    filter_count: Object.keys(filters).length,
    filter_types: Object.keys(filters),
    result_count: resultCount,
  });
};

// Item Barcode Analytics
export const trackItemBarcodeScanned = (barcode: string, itemFound: boolean) => {
  trackEvent("item_barcode_scanned", {
    category: "item_barcode",
    action: "scan",
    label: itemFound ? "found" : "not_found",
    barcode: barcode,
    item_found: itemFound,
  });
};

export const trackItemBarcodeAdded = (itemId: string, itemName: string, barcode: string) => {
  trackEvent("item_barcode_added", {
    category: "item_barcode",
    action: "add",
    label: itemName,
    item_id: itemId,
    item_name: itemName,
    barcode: barcode,
  });
};
