// apps/web/src/components/inventory/order/form/order-form-utils.ts

import { formatCurrency, formatCurrencyWithoutSymbol, parseCurrency, roundToDecimals, isValidNumber, isPositiveNumber, calculateSum } from "../../../../utils";
import type { OrderCreateFormData, OrderItemCreateFormData } from "../../../../schemas";
import type { Item, Order, OrderItem } from "../../../../types";
import { ORDER_STATUS } from "../../../../constants";

// =====================
// TYPE DEFINITIONS
// =====================

export interface OrderFormItem {
  id: string;
  name: string;
  uniCode?: string | null;
  quantity: number;
  price?: number | null;
  category?: {
    id: string;
    name: string;
    type?: string;
  };
  brand?: {
    id: string;
    name: string;
  };
  supplier?: {
    id: string;
    fantasyName: string;
  };
  prices?: Array<{
    id: string;
    value: number;
    createdAt: Date;
  }>;
  // Available stock for validation
  availableQuantity?: number;
  // Minimum order quantity
  minOrderQuantity?: number;
  // Order multiple (e.g., must order in multiples of 12)
  orderMultiple?: number;
}

export interface OrderFormData {
  description: string;
  forecast?: Date | null;
  supplierId?: string | null;
  notes?: string | null;
  selectedItems: Map<string, OrderFormItem>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  taxes: Record<string, number>;
  criticalItems: Set<string>;
  budgetId?: string | null;
  nfeId?: string | null;
  receiptId?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
  type: "required" | "supplier" | "business" | "data" | "price" | "quantity";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ItemCalculation {
  itemId: string;
  item: OrderFormItem;
  quantity: number;
  price: number;
  tax: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  hasValidPrice: boolean;
  isCritical: boolean;
}

export interface OrderTotals {
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  itemCalculations: ItemCalculation[];
  hasItemsWithoutPrice: boolean;
  averageTaxRate: number;
}

// =====================
// TOTAL CALCULATION FUNCTIONS
// =====================

/**
 * Get the best available price for an item
 * Priority: manual price > latest price > 0
 */
export function getBestItemPrice(item: OrderFormItem, manualPrice?: number | null): number {
  // If manual price is set and valid, use it
  if (manualPrice !== null && manualPrice !== undefined && isValidNumber(manualPrice) && manualPrice >= 0) {
    return manualPrice;
  }

  // Try to get the latest price from item's price history
  if (item.prices && item.prices.length > 0) {
    const sortedPrices = [...item.prices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sortedPrices[0].value;
  }

  // Use item's current price
  if (item.price !== null && item.price !== undefined) {
    return item.price;
  }

  return 0;
}

/**
 * Calculate individual item total with tax
 */
export function calculateItemTotal(item: OrderFormItem, quantity: number, manualPrice?: number | null, taxRate: number = 0, isCritical: boolean = false): ItemCalculation {
  const price = getBestItemPrice(item, manualPrice);
  const subtotal = roundToDecimals(quantity * price, 2);
  const taxAmount = roundToDecimals(subtotal * (taxRate / 100), 2);
  const total = roundToDecimals(subtotal + taxAmount, 2);
  const hasValidPrice = price > 0;

  return {
    itemId: item.id,
    item,
    quantity,
    price,
    tax: taxRate,
    subtotal,
    taxAmount,
    total,
    hasValidPrice,
    isCritical,
  };
}

/**
 * Calculate totals for all selected items
 */
export function calculateOrderTotals(
  selectedItems: Map<string, OrderFormItem>,
  quantities: Record<string, number>,
  prices: Record<string, number>,
  taxes: Record<string, number>,
  criticalItems: Set<string>,
): OrderTotals {
  const itemCalculations: ItemCalculation[] = [];

  // Calculate each item
  selectedItems.forEach((item: OrderFormItem, itemId: string) => {
    const quantity = quantities[itemId] || 1;
    const manualPrice = prices[itemId];
    const taxRate = taxes[itemId] || 0;
    const isCritical = criticalItems.has(itemId);

    const calculation = calculateItemTotal(item, quantity, manualPrice, taxRate, isCritical);
    itemCalculations.push(calculation);
  });

  const totalItems = selectedItems.size;
  const totalQuantity = calculateSum(itemCalculations.map((calc: ItemCalculation) => calc.quantity));
  const subtotal = roundToDecimals(calculateSum(itemCalculations.map((calc: ItemCalculation) => calc.subtotal)), 2);
  const totalTax = roundToDecimals(calculateSum(itemCalculations.map((calc: ItemCalculation) => calc.taxAmount)), 2);
  const grandTotal = roundToDecimals(subtotal + totalTax, 2);
  const hasItemsWithoutPrice = itemCalculations.some((calc: ItemCalculation) => !calc.hasValidPrice);

  // Calculate average tax rate
  const averageTaxRate = subtotal > 0 ? roundToDecimals((totalTax / subtotal) * 100, 2) : 0;

  return {
    totalItems,
    totalQuantity,
    subtotal,
    totalTax,
    grandTotal,
    itemCalculations,
    hasItemsWithoutPrice,
    averageTaxRate,
  };
}

/**
 * Calculate total for a subset of items (used in batch operations)
 */
export function calculatePartialTotal(
  itemIds: string[],
  selectedItems: Map<string, OrderFormItem>,
  quantities: Record<string, number>,
  prices: Record<string, number>,
  taxes: Record<string, number>,
): number {
  return roundToDecimals(
    itemIds.reduce((total: number, itemId: string) => {
      const item = selectedItems.get(itemId);
      if (!item) return total;

      const quantity = quantities[itemId] || 1;
      const price = getBestItemPrice(item, prices[itemId]);
      const taxRate = taxes[itemId] || 0;
      const subtotal = quantity * price;
      const taxAmount = subtotal * (taxRate / 100);

      return total + subtotal + taxAmount;
    }, 0),
    2,
  );
}

// =====================
// CURRENCY FORMATTING HELPERS
// =====================

/**
 * Format currency for display in form inputs
 */
export function formatPriceForInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !isValidNumber(value)) {
    return "";
  }
  return formatCurrencyWithoutSymbol(value);
}

/**
 * Format currency for display with symbol
 */
export function formatPriceForDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || !isValidNumber(value)) {
    return formatCurrency(0);
  }
  return formatCurrency(value);
}

/**
 * Parse currency input from user
 */
export function parsePriceInput(value: string): number {
  if (!value || value.trim() === "") {
    return 0;
  }

  const parsed = parseCurrency(value);
  return isValidNumber(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Validate price input
 */
export function validatePriceInput(value: string, fieldName: string = "Preço", maxValue?: number): string | null {
  if (!value || value.trim() === "") {
    return null; // Optional field
  }

  const parsed = parsePriceInput(value);

  if (!isValidNumber(parsed)) {
    return `${fieldName} deve ser um número válido`;
  }

  if (parsed < 0) {
    return `${fieldName} não pode ser negativo`;
  }

  if (maxValue !== undefined && parsed > maxValue) {
    return `${fieldName} não pode exceder ${formatCurrency(maxValue)}`;
  }

  return null;
}

/**
 * Validate tax input
 */
export function validateTaxInput(value: string): string | null {
  if (!value || value.trim() === "") {
    return null; // Optional field, defaults to 0
  }

  const parsed = parseFloat(value);

  if (!isValidNumber(parsed)) {
    return "Taxa deve ser um número válido";
  }

  if (parsed < 0) {
    return "Taxa não pode ser negativa";
  }

  if (parsed > 100) {
    return "Taxa não pode exceder 100%";
  }

  return null;
}

// =====================
// FORM DATA TRANSFORMATION
// =====================

/**
 * Transform form data to API payload for creation
 */
export function transformFormDataForAPI(formData: OrderFormData): OrderCreateFormData {
  const items: OrderItemCreateFormData[] = [];

  // Transform selected items
  formData.selectedItems.forEach((item: OrderFormItem, itemId: string) => {
    const quantity = formData.quantities[itemId] || 1;
    const price = formData.prices[itemId] || getBestItemPrice(item);
    const tax = formData.taxes[itemId] || 0;
    const isCritical = formData.criticalItems.has(itemId);

    items.push({
      itemId,
      orderedQuantity: quantity,
      price,
      tax,
      isCritical,
    } as OrderItemCreateFormData);
  });

  return {
    description: formData.description.trim(),
    forecast: formData.forecast,
    status: ORDER_STATUS.CREATED,
    supplierId: formData.supplierId || undefined,
    notes: formData.notes?.trim() || undefined,
    budgetId: formData.budgetId || undefined,
    nfeId: formData.nfeId || undefined,
    receiptId: formData.receiptId || undefined,
    items,
  };
}

/**
 * Transform API response to form data for editing
 */
export function transformAPIDataToFormData(order: Order, items: Item[]): Partial<OrderFormData> {
  const selectedItems = new Map<string, OrderFormItem>();
  const quantities: Record<string, number> = {};
  const prices: Record<string, number> = {};
  const taxes: Record<string, number> = {};
  const criticalItems = new Set<string>();

  // Transform items if they exist
  if (order.items) {
    order.items.forEach((orderItem) => {
      const item = items.find((i) => i.id === orderItem.itemId);
      if (item) {
        selectedItems.set(item.id, {
          id: item.id,
          name: item.name,
          uniCode: item.uniCode,
          quantity: item.quantity,
          price: (item.prices && item.prices.length > 0 ? item.prices[0].value : 0),
          category: item.category
            ? {
                id: item.category.id,
                name: item.category.name,
                type: item.category.type,
              }
            : undefined,
          brand: item.brand,
          supplier: item.supplier,
          prices: item.prices,
          availableQuantity: item.quantity,
          minOrderQuantity: item.reorderQuantity ?? undefined,
          // orderMultiple: undefined, // Property does not exist on Item type
        });

        quantities[item.id] = orderItem.orderedQuantity;
        prices[item.id] = orderItem.price;
        taxes[item.id] = orderItem.tax;

        if (orderItem.isCritical) {
          criticalItems.add(item.id);
        }
      }
    });
  }

  return {
    description: order.description,
    forecast: order.forecast,
    supplierId: order.supplierId,
    notes: order.notes,
    budgetId: order.budgetId,
    nfeId: order.nfeId,
    receiptId: order.receiptId,
    selectedItems,
    quantities,
    prices,
    taxes,
    criticalItems,
  };
}

/**
 * Create a deep copy of form data
 */
export function cloneFormData(formData: OrderFormData): OrderFormData {
  return {
    description: formData.description,
    forecast: formData.forecast,
    supplierId: formData.supplierId,
    notes: formData.notes,
    budgetId: formData.budgetId,
    nfeId: formData.nfeId,
    receiptId: formData.receiptId,
    selectedItems: new Map(formData.selectedItems),
    quantities: { ...formData.quantities },
    prices: { ...formData.prices },
    taxes: { ...formData.taxes },
    criticalItems: new Set(formData.criticalItems),
  };
}

// =====================
// VALIDATION FUNCTIONS
// =====================

/**
 * Validate order description
 */
export function validateDescription(description: string): ValidationError | null {
  if (!description || description.trim().length === 0) {
    return {
      field: "description",
      message: "Descrição é obrigatória",
      type: "required",
    };
  }

  if (description.trim().length < 3) {
    return {
      field: "description",
      message: "Descrição deve ter pelo menos 3 caracteres",
      type: "data",
    };
  }

  if (description.trim().length > 500) {
    return {
      field: "description",
      message: "Descrição deve ter no máximo 500 caracteres",
      type: "data",
    };
  }

  return null;
}

/**
 * Validate forecast date
 */
export function validateForecast(forecast: Date | null | undefined): ValidationError | null {
  if (!forecast) {
    return null; // Optional field
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (forecast < today) {
    return {
      field: "forecast",
      message: "Data de previsão não pode ser no passado",
      type: "business",
    };
  }

  // Warn if forecast is too far in the future (e.g., more than 1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (forecast > oneYearFromNow) {
    return {
      field: "forecast",
      message: "Data de previsão muito distante (mais de 1 ano)",
      type: "business",
    };
  }

  return null;
}

/**
 * Validate item selection and quantities
 */
export function validateItemSelection(selectedItems: Map<string, OrderFormItem>, quantities: Record<string, number>, supplierId?: string | null): ValidationError[] {
  const errors: ValidationError[] = [];

  if (selectedItems.size === 0) {
    errors.push({
      field: "items",
      message: "Pelo menos um item deve ser selecionado",
      type: "required",
    });
    return errors;
  }

  // Validate each selected item
  selectedItems.forEach((item: OrderFormItem, itemId: string) => {
    const quantity = quantities[itemId] || 1;

    // Validate quantity
    if (!isPositiveNumber(quantity)) {
      errors.push({
        field: `quantity-${itemId}`,
        message: `Quantidade do item "${item.name}" deve ser maior que zero`,
        type: "data",
      });
    }

    if (quantity > 999999) {
      errors.push({
        field: `quantity-${itemId}`,
        message: `Quantidade do item "${item.name}" não pode exceder 999.999`,
        type: "business",
      });
    }

    // Validate minimum order quantity
    if (item.minOrderQuantity && quantity < item.minOrderQuantity) {
      errors.push({
        field: `quantity-${itemId}`,
        message: `Quantidade mínima para "${item.name}" é ${item.minOrderQuantity}`,
        type: "quantity",
      });
    }

    // Validate order multiple (property does not exist on Item type)
    // if (item.orderMultiple && quantity % item.orderMultiple !== 0) {
    //   errors.push({
    //     field: `quantity-${itemId}`,
    //     message: `"${item.name}" deve ser pedido em múltiplos de ${item.orderMultiple}`,
    //     type: "quantity",
    //   });
    // }

    // Validate supplier consistency if supplier is specified
    if (supplierId && item.supplier && item.supplier.id !== supplierId) {
      errors.push({
        field: `item-${itemId}`,
        message: `Item "${item.name}" não pertence ao fornecedor selecionado`,
        type: "supplier",
      });
    }
  });

  return errors;
}

/**
 * Validate item prices
 */
export function validateItemPrices(selectedItems: Map<string, OrderFormItem>, prices: Record<string, number>): ValidationError[] {
  const errors: ValidationError[] = [];

  selectedItems.forEach((item: OrderFormItem, itemId: string) => {
    const manualPrice = prices[itemId];
    const bestPrice = getBestItemPrice(item, manualPrice);

    // Check if item has any price
    if (bestPrice <= 0) {
      errors.push({
        field: `price-${itemId}`,
        message: `Item "${item.name}" não possui preço definido`,
        type: "price",
      });
    }

    // Validate manual price if provided
    if (manualPrice !== undefined && manualPrice !== null) {
      if (!isValidNumber(manualPrice)) {
        errors.push({
          field: `price-${itemId}`,
          message: `Preço do item "${item.name}" deve ser um número válido`,
          type: "data",
        });
      } else if (manualPrice < 0) {
        errors.push({
          field: `price-${itemId}`,
          message: `Preço do item "${item.name}" não pode ser negativo`,
          type: "data",
        });
      } else if (manualPrice > 1000000) {
        errors.push({
          field: `price-${itemId}`,
          message: `Preço do item "${item.name}" não pode exceder R$ 1.000.000,00`,
          type: "business",
        });
      }
    }
  });

  return errors;
}

/**
 * Validate item taxes
 */
export function validateItemTaxes(selectedItems: Map<string, OrderFormItem>, taxes: Record<string, number>): ValidationError[] {
  const errors: ValidationError[] = [];

  selectedItems.forEach((item: OrderFormItem, itemId: string) => {
    const tax = taxes[itemId];

    if (tax !== undefined && tax !== null) {
      if (!isValidNumber(tax)) {
        errors.push({
          field: `tax-${itemId}`,
          message: `Taxa do item "${item.name}" deve ser um número válido`,
          type: "data",
        });
      } else if (tax < 0) {
        errors.push({
          field: `tax-${itemId}`,
          message: `Taxa do item "${item.name}" não pode ser negativa`,
          type: "data",
        });
      } else if (tax > 100) {
        errors.push({
          field: `tax-${itemId}`,
          message: `Taxa do item "${item.name}" não pode exceder 100%`,
          type: "business",
        });
      }
    }
  });

  return errors;
}

/**
 * Validate notes field
 */
export function validateNotes(notes: string | null | undefined): ValidationError | null {
  if (!notes) {
    return null; // Notes are optional
  }

  if (notes.length > 1000) {
    return {
      field: "notes",
      message: "Observações devem ter no máximo 1000 caracteres",
      type: "data",
    };
  }

  return null;
}

/**
 * Main validation function for the entire form
 */
export function validateOrderForm(
  formData: OrderFormData,
  options: {
    validateSupplier?: boolean;
    maxTotal?: number;
    requireForecast?: boolean;
  } = {},
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate description
  const descriptionError = validateDescription(formData.description);
  if (descriptionError) {
    errors.push(descriptionError);
  }

  // Validate forecast
  const forecastError = validateForecast(formData.forecast);
  if (forecastError) {
    if (options.requireForecast) {
      errors.push(forecastError);
    } else {
      warnings.push(forecastError);
    }
  } else if (options.requireForecast && !formData.forecast) {
    errors.push({
      field: "forecast",
      message: "Data de previsão é obrigatória",
      type: "required",
    });
  }

  // Validate notes
  const notesError = validateNotes(formData.notes);
  if (notesError) {
    errors.push(notesError);
  }

  // Validate item selection and quantities
  const itemErrors = validateItemSelection(formData.selectedItems, formData.quantities, options.validateSupplier ? formData.supplierId : undefined);
  errors.push(...itemErrors);

  // Validate prices
  const priceErrors = validateItemPrices(formData.selectedItems, formData.prices);
  errors.push(...priceErrors);

  // Validate taxes
  const taxErrors = validateItemTaxes(formData.selectedItems, formData.taxes);
  errors.push(...taxErrors);

  // Calculate totals for additional validations
  const totals = calculateOrderTotals(formData.selectedItems, formData.quantities, formData.prices, formData.taxes, formData.criticalItems);

  // Validate total value if needed
  if (options.maxTotal && totals.grandTotal > options.maxTotal) {
    errors.push({
      field: "total",
      message: `Valor total (${formatCurrency(totals.grandTotal)}) excede o limite permitido (${formatCurrency(options.maxTotal)})`,
      type: "business",
    });
  }

  // Add warnings
  if (totals.hasItemsWithoutPrice) {
    warnings.push({
      field: "prices",
      message: "Alguns itens não possuem preço definido",
      type: "price",
    });
  }

  if (formData.selectedItems.size > 100) {
    warnings.push({
      field: "items",
      message: "Muitos itens selecionados podem afetar o desempenho",
      type: "business",
    });
  }

  if (!formData.supplierId && formData.selectedItems.size > 0) {
    // Check if all items have the same supplier
    const suppliers = new Set<string>();
    formData.selectedItems.forEach((item) => {
      if (item.supplier) {
        suppliers.add(item.supplier.id);
      }
    });

    if (suppliers.size > 1) {
      warnings.push({
        field: "supplier",
        message: "Itens de diferentes fornecedores selecionados",
        type: "supplier",
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =====================
// ITEM DATA PROCESSING
// =====================

/**
 * Convert Item to OrderFormItem
 */
export function convertItemToFormItem(item: Item, quantity: number = 1, price?: number | null): OrderFormItem {
  return {
    id: item.id,
    name: item.name,
    uniCode: item.uniCode,
    quantity,
    price: price ?? (item.prices && item.prices.length > 0 ? item.prices[0].value : 0),
    category: item.category
      ? {
          id: item.category.id,
          name: item.category.name,
          type: item.category.type,
        }
      : undefined,
    brand: item.brand,
    supplier: item.supplier,
    prices: item.prices,
    availableQuantity: item.quantity,
    minOrderQuantity: item.reorderQuantity ?? undefined,
    // orderMultiple: undefined, // Property does not exist on Item type
  };
}

/**
 * Filter items based on search criteria
 */
export function filterItems(
  items: Item[],
  searchTerm: string,
  filters: {
    categoryIds?: string[];
    brandIds?: string[];
    supplierIds?: string[];
    onlyAvailable?: boolean;
    onlyCritical?: boolean;
  } = {},
): Item[] {
  let filtered = items;

  // Filter by search term
  if (searchTerm.trim()) {
    const search = searchTerm.toLowerCase().trim();
    filtered = filtered.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.uniCode?.toLowerCase().includes(search) ||
        item.category?.name.toLowerCase().includes(search) ||
        item.brand?.name.toLowerCase().includes(search),
    );
  }

  // Filter by categories
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    filtered = filtered.filter((item: Item) => item.category && filters.categoryIds!.includes(item.category.id));
  }

  // Filter by brands
  if (filters.brandIds && filters.brandIds.length > 0) {
    filtered = filtered.filter((item: Item) => item.brand && filters.brandIds!.includes(item.brand.id));
  }

  // Filter by suppliers
  if (filters.supplierIds && filters.supplierIds.length > 0) {
    filtered = filtered.filter((item: Item) => item.supplier && filters.supplierIds!.includes(item.supplier.id));
  }

  // Filter by availability
  if (filters.onlyAvailable) {
    filtered = filtered.filter((item: Item) => item.quantity > 0);
  }

  // Filter by critical status (if item has isCritical flag)
  if (filters.onlyCritical) {
    filtered = filtered.filter((item: Item) => (item as any).isCritical === true);
  }

  return filtered;
}

/**
 * Group items by category
 */
export function groupItemsByCategory(items: Item[]): Record<string, Item[]> {
  const groups: Record<string, Item[]> = {};

  items.forEach((item: Item) => {
    const categoryName = item.category?.name || "Sem Categoria";
    if (!groups[categoryName]) {
      groups[categoryName] = [];
    }
    groups[categoryName].push(item);
  });

  return groups;
}

/**
 * Group items by supplier
 */
export function groupItemsBySupplier(items: Item[]): Record<string, Item[]> {
  const groups: Record<string, Item[]> = {};

  items.forEach((item: Item) => {
    const supplierName = item.supplier?.fantasyName || "Sem Fornecedor";
    if (!groups[supplierName]) {
      groups[supplierName] = [];
    }
    groups[supplierName].push(item);
  });

  return groups;
}

// =====================
// EDGE CASE HANDLERS
// =====================

/**
 * Handle null/undefined values safely
 */
export function safeGet<T>(value: T | null | undefined, defaultValue: T): T {
  return value !== null && value !== undefined ? value : defaultValue;
}

/**
 * Safely parse numeric input
 */
export function safeParseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === "number" && isValidNumber(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isValidNumber(parsed) ? parsed : defaultValue;
  }

  return defaultValue;
}

/**
 * Safely format items count for display
 */
export function formatItemsCount(count: number): string {
  if (count === 0) return "Nenhum item";
  if (count === 1) return "1 item";
  return `${count.toLocaleString("pt-BR")} itens`;
}

/**
 * Generate summary text for selected items
 */
export function generateSelectionSummary(selectedItems: Map<string, OrderFormItem>, quantities: Record<string, number>, criticalItems: Set<string>): string {
  const totalItems = selectedItems.size;
  const totalQuantity = Array.from(selectedItems.keys()).reduce((sum: number, itemId: string) => sum + (quantities[itemId] || 1), 0);
  const criticalCount = criticalItems.size;

  if (totalItems === 0) {
    return "Nenhum item selecionado";
  }

  const itemText = formatItemsCount(totalItems);
  const quantityText = `${totalQuantity.toLocaleString("pt-BR")} unidades`;
  const criticalText = criticalCount > 0 ? ` (${criticalCount} críticos)` : "";

  return `${itemText} - ${quantityText}${criticalText}`;
}

/**
 * Check if order can be received
 */
export function canReceiveOrder(status: ORDER_STATUS): boolean {
  return [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.OVERDUE, ORDER_STATUS.PARTIALLY_RECEIVED].includes(status);
}

/**
 * Check if order can be cancelled
 */
export function canCancelOrder(status: ORDER_STATUS): boolean {
  return status !== ORDER_STATUS.RECEIVED && status !== ORDER_STATUS.CANCELLED;
}

/**
 * Calculate fulfillment percentage
 */
export function calculateFulfillmentPercentage(items: OrderItem[]): number {
  if (!items || items.length === 0) return 0;

  const totalOrdered = items.reduce((sum: number, item: OrderItem) => sum + item.orderedQuantity, 0);
  const totalReceived = items.reduce((sum: number, item: OrderItem) => sum + item.receivedQuantity, 0);

  if (totalOrdered === 0) return 0;
  return Math.round((totalReceived / totalOrdered) * 100);
}

// =====================
// DEBUGGING HELPERS
// =====================

/**
 * Log form data for debugging (only in development)
 */
export function debugFormData(formData: OrderFormData, label?: string): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.group(`🔍 Order Form Data${label ? ` - ${label}` : ""}`););const totals = calculateOrderTotals(formData.selectedItems, formData.quantities, formData.prices, formData.taxes, formData.criticalItems);console.groupEnd();
}

/**
 * Validate form data and log results (development only)
 */
export function debugValidation(formData: OrderFormData): ValidationResult {
  const result = validateOrderForm(formData);

  if (process.env.NODE_ENV === "development") {
    console.group("🔍 Form Validation Results");if (result.errors.length > 0) {
      console.error("Errors:", result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn("Warnings:", result.warnings);
    }
    console.groupEnd();
  }

  return result;
}

// =====================
// EXPORT UTILITY OBJECT
// =====================

export const orderFormUtils = {
  // Calculation functions
  calculateOrderTotals,
  calculateItemTotal,
  calculatePartialTotal,
  getBestItemPrice,
  calculateFulfillmentPercentage,

  // Currency helpers
  formatPriceForInput,
  formatPriceForDisplay,
  parsePriceInput,
  validatePriceInput,
  validateTaxInput,

  // Data transformation
  transformFormDataForAPI,
  transformAPIDataToFormData,
  cloneFormData,
  convertItemToFormItem,

  // Validation
  validateOrderForm,
  validateDescription,
  validateForecast,
  validateItemSelection,
  validateItemPrices,
  validateItemTaxes,
  validateNotes,

  // Item processing
  filterItems,
  groupItemsByCategory,
  groupItemsBySupplier,

  // Business rules
  canReceiveOrder,
  canCancelOrder,

  // Utilities
  safeGet,
  safeParseNumber,
  formatItemsCount,
  generateSelectionSummary,

  // Debug helpers
  debugFormData,
  debugValidation,
};
