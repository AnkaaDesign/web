// apps/web/src/components/inventory/external-withdrawal/form/external-withdrawal-form-utils.ts

import { formatCurrency, formatCurrencyWithoutSymbol, parseCurrency, roundToDecimals, isValidNumber, isPositiveNumber, calculateSum } from "../../../../utils";
import type { ExternalWithdrawalCreateFormData } from "../../../../schemas";
import type { Item, ExternalWithdrawal } from "../../../../types";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_TYPE } from "../../../../constants";

// =====================
// TYPE DEFINITIONS
// =====================

export interface ExternalWithdrawalFormItem {
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
}

export interface ExternalWithdrawalFormData {
  withdrawerName: string;
  type: EXTERNAL_WITHDRAWAL_TYPE;
  notes?: string | null;
  selectedItems: Map<string, ExternalWithdrawalFormItem>;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  nfeId?: string | null;
  receiptId?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
  type: "stock" | "permission" | "business" | "data" | "price";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface TotalCalculation {
  itemId: string;
  item: ExternalWithdrawalFormItem;
  quantity: number;
  price: number;
  subtotal: number;
  hasValidPrice: boolean;
}

export interface ExternalWithdrawalTotals {
  totalItems: number;
  totalQuantity: number;
  grandTotal: number;
  itemCalculations: TotalCalculation[];
  hasItemsWithoutPrice: boolean;
  hasPriceCalculation: boolean;
}

// =====================
// TOTAL CALCULATION FUNCTIONS
// =====================

/**
 * Get the best available price for an item
 * Priority: manual price > latest price > 0
 */
export function getBestItemPrice(item: ExternalWithdrawalFormItem, manualPrice?: number | null): number {
  // If manual price is set and valid, use it
  if (manualPrice !== null && manualPrice !== undefined && isValidNumber(manualPrice) && manualPrice >= 0) {
    return manualPrice;
  }

  // Try to get the latest price from item's price history
  if (item.prices && item.prices.length > 0) {
    const sortedPrices = [...item.prices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sortedPrices[0].value;
  }

  return 0;
}

/**
 * Calculate individual item total
 */
export function calculateItemTotal(item: ExternalWithdrawalFormItem, quantity: number, manualPrice?: number | null): TotalCalculation {
  const price = getBestItemPrice(item, manualPrice);
  const subtotal = roundToDecimals(quantity * price, 2);
  const hasValidPrice = price > 0;

  return {
    itemId: item.id,
    item,
    quantity,
    price,
    subtotal,
    hasValidPrice,
  };
}

/**
 * Calculate totals for all selected items
 */
export function calculateExternalWithdrawalTotals(
  selectedItems: Map<string, ExternalWithdrawalFormItem>,
  quantities: Record<string, number>,
  prices: Record<string, number>,
  type: EXTERNAL_WITHDRAWAL_TYPE,
): ExternalWithdrawalTotals {
  const itemCalculations: TotalCalculation[] = [];

  // If not chargeable, no price calculation needed
  if (type !== EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE) {
    const totalItems = selectedItems.size;
    const totalQuantity = Array.from(selectedItems.keys()).reduce((total, itemId) => {
      return total + (quantities[itemId] || 1);
    }, 0);

    return {
      totalItems,
      totalQuantity,
      grandTotal: 0,
      itemCalculations: [],
      hasItemsWithoutPrice: false,
      hasPriceCalculation: false,
    };
  }

  // Calculate each item
  selectedItems.forEach((item, itemId) => {
    const quantity = quantities[itemId] || 1;
    const manualPrice = prices[itemId];
    const calculation = calculateItemTotal(item, quantity, manualPrice);
    itemCalculations.push(calculation);
  });

  const totalItems = selectedItems.size;
  const totalQuantity = calculateSum(itemCalculations.map((calc) => calc.quantity));
  const grandTotal = roundToDecimals(calculateSum(itemCalculations.map((calc) => calc.subtotal)), 2);
  const hasItemsWithoutPrice = itemCalculations.some((calc) => !calc.hasValidPrice);

  return {
    totalItems,
    totalQuantity,
    grandTotal,
    itemCalculations,
    hasItemsWithoutPrice,
    hasPriceCalculation: true,
  };
}

/**
 * Calculate total for a subset of items (used in batch operations)
 */
export function calculatePartialTotal(
  itemIds: string[],
  selectedItems: Map<string, ExternalWithdrawalFormItem>,
  quantities: Record<string, number>,
  prices: Record<string, number>,
): number {
  return roundToDecimals(
    itemIds.reduce((total, itemId) => {
      const item = selectedItems.get(itemId);
      if (!item) return total;

      const quantity = quantities[itemId] || 1;
      const price = getBestItemPrice(item, prices[itemId]);
      return total + quantity * price;
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

// =====================
// FORM DATA TRANSFORMATION
// =====================

/**
 * Transform form data to API payload for creation
 */
export function transformFormDataForAPI(formData: ExternalWithdrawalFormData): ExternalWithdrawalCreateFormData {
  const items: Array<{
    itemId: string;
    withdrawedQuantity: number;
    price: number | null;
  }> = [];

  // Transform selected items
  formData.selectedItems.forEach((item, itemId) => {
    const quantity = formData.quantities[itemId] || 1;
    const price = formData.type !== EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? null : formData.prices[itemId] || getBestItemPrice(item);

    items.push({
      itemId,
      withdrawedQuantity: quantity,
      price,
    });
  });

  return {
    withdrawerName: formData.withdrawerName.trim(),
    type: formData.type,
    status: EXTERNAL_WITHDRAWAL_STATUS.PENDING,
    notes: formData.notes?.trim() || null,
    nfeId: formData.nfeId || null,
    receiptId: formData.receiptId || null,
    items,
  };
}

/**
 * Transform API response to form data for editing
 */
export function transformAPIDataToFormData(externalWithdrawal: ExternalWithdrawal, items: Item[]): Partial<ExternalWithdrawalFormData> {
  const selectedItems = new Map<string, ExternalWithdrawalFormItem>();
  const quantities: Record<string, number> = {};
  const prices: Record<string, number> = {};

  // Transform items if they exist
  if (externalWithdrawal.items) {
    externalWithdrawal.items.forEach((withdrawalItem) => {
      const item = items.find((i) => i.id === withdrawalItem.itemId);
      if (item) {
        selectedItems.set(item.id, {
          id: item.id,
          name: item.name,
          uniCode: item.uniCode,
          quantity: withdrawalItem.withdrawedQuantity,
          price: withdrawalItem.price,
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
        });

        quantities[item.id] = withdrawalItem.withdrawedQuantity;
        if (withdrawalItem.price !== null) {
          prices[item.id] = withdrawalItem.price;
        }
      }
    });
  }

  return {
    withdrawerName: externalWithdrawal.withdrawerName,
    type: externalWithdrawal.type,
    notes: externalWithdrawal.notes,
    nfeId: externalWithdrawal.nfeId,
    receiptId: externalWithdrawal.receiptId,
    selectedItems,
    quantities,
    prices,
  };
}

/**
 * Create a deep copy of form data
 */
export function cloneFormData(formData: ExternalWithdrawalFormData): ExternalWithdrawalFormData {
  return {
    withdrawerName: formData.withdrawerName,
    type: formData.type,
    notes: formData.notes,
    nfeId: formData.nfeId,
    receiptId: formData.receiptId,
    selectedItems: new Map(formData.selectedItems),
    quantities: { ...formData.quantities },
    prices: { ...formData.prices },
  };
}

// =====================
// VALIDATION FUNCTIONS
// =====================

/**
 * Validate withdrawer name
 */
export function validateWithdrawerName(name: string): ValidationError | null {
  if (!name || name.trim().length < 2) {
    return {
      field: "withdrawerName",
      message: "Nome do retirador deve ter pelo menos 2 caracteres",
      type: "data",
    };
  }

  if (name.trim().length > 200) {
    return {
      field: "withdrawerName",
      message: "Nome do retirador deve ter no máximo 200 caracteres",
      type: "data",
    };
  }

  return null;
}

/**
 * Validate item selection and quantities
 */
export function validateItemSelection(selectedItems: Map<string, ExternalWithdrawalFormItem>, quantities: Record<string, number>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (selectedItems.size === 0) {
    errors.push({
      field: "items",
      message: "Pelo menos um item deve ser selecionado",
      type: "data",
    });
    return errors;
  }

  // Validate each selected item
  selectedItems.forEach((item, itemId) => {
    const quantity = quantities[itemId] || 1;

    // Validate quantity
    if (!isPositiveNumber(quantity)) {
      errors.push({
        field: `quantity-${itemId}`,
        message: `Quantidade do item "${item.name}" deve ser maior que zero`,
        type: "data",
      });
    }

    if (quantity > 10000) {
      errors.push({
        field: `quantity-${itemId}`,
        message: `Quantidade do item "${item.name}" não pode exceder 10.000`,
        type: "business",
      });
    }

    // Validate stock availability
    if (item.availableQuantity !== undefined && quantity > item.availableQuantity) {
      errors.push({
        field: `quantity-${itemId}`,
        message: `Quantidade solicitada (${quantity}) excede o estoque disponível (${item.availableQuantity}) para "${item.name}"`,
        type: "stock",
      });
    }
  });

  return errors;
}

/**
 * Validate prices for chargeable items
 */
export function validateItemPrices(selectedItems: Map<string, ExternalWithdrawalFormItem>, prices: Record<string, number>, type: EXTERNAL_WITHDRAWAL_TYPE): ValidationError[] {
  const errors: ValidationError[] = [];

  // No price validation needed for non-chargeable items
  if (type !== EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE) {
    return errors;
  }

  selectedItems.forEach((item, itemId) => {
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
 * Validate notes field
 */
export function validateNotes(notes: string | null | undefined): ValidationError | null {
  if (!notes) {
    return null; // Notes are optional
  }

  if (notes.length > 500) {
    return {
      field: "notes",
      message: "Observações devem ter no máximo 500 caracteres",
      type: "data",
    };
  }

  return null;
}

/**
 * Main validation function for the entire form
 */
export function validateExternalWithdrawalForm(
  formData: ExternalWithdrawalFormData,
  options: {
    validateStock?: boolean;
    maxTotal?: number;
  } = {},
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate withdrawer name
  const nameError = validateWithdrawerName(formData.withdrawerName);
  if (nameError) {
    errors.push(nameError);
  }

  // Validate notes
  const notesError = validateNotes(formData.notes);
  if (notesError) {
    errors.push(notesError);
  }

  // Validate item selection and quantities
  const itemErrors = validateItemSelection(formData.selectedItems, formData.quantities);
  errors.push(...itemErrors);

  // Validate prices for non-returnable items
  const priceErrors = validateItemPrices(formData.selectedItems, formData.prices, formData.type);
  errors.push(...priceErrors);

  // Calculate totals for additional validations
  const totals = calculateExternalWithdrawalTotals(formData.selectedItems, formData.quantities, formData.prices, formData.type);

  // Validate total value if needed
  if (formData.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && options.maxTotal && totals.grandTotal > options.maxTotal) {
    errors.push({
      field: "total",
      message: `Valor total (${formatCurrency(totals.grandTotal)}) excede o limite permitido (${formatCurrency(options.maxTotal)})`,
      type: "business",
    });
  }

  // Add warnings
  if (formData.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && totals.hasItemsWithoutPrice) {
    warnings.push({
      field: "prices",
      message: "Alguns itens não possuem preço definido",
      type: "price",
    });
  }

  if (formData.selectedItems.size > 50) {
    warnings.push({
      field: "items",
      message: "Muitos itens selecionados podem afetar o desempenho",
      type: "business",
    });
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
 * Convert Item to ExternalWithdrawalFormItem
 */
export function convertItemToFormItem(item: Item, quantity: number = 1, price?: number | null): ExternalWithdrawalFormItem {
  return {
    id: item.id,
    name: item.name,
    uniCode: item.uniCode,
    quantity,
    price,
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
    filtered = filtered.filter((item) => item.category && filters.categoryIds!.includes(item.category.id));
  }

  // Filter by brands
  if (filters.brandIds && filters.brandIds.length > 0) {
    filtered = filtered.filter((item) => item.brand && filters.brandIds!.includes(item.brand.id));
  }

  // Filter by suppliers
  if (filters.supplierIds && filters.supplierIds.length > 0) {
    filtered = filtered.filter((item) => item.supplier && filters.supplierIds!.includes(item.supplier.id));
  }

  // Filter by availability
  if (filters.onlyAvailable) {
    filtered = filtered.filter((item) => item.quantity > 0);
  }

  return filtered;
}

/**
 * Group items by category
 */
export function groupItemsByCategory(items: Item[]): Record<string, Item[]> {
  const groups: Record<string, Item[]> = {};

  items.forEach((item) => {
    const categoryName = item.category?.name || "Sem Categoria";
    if (!groups[categoryName]) {
      groups[categoryName] = [];
    }
    groups[categoryName].push(item);
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
export function generateSelectionSummary(selectedItems: Map<string, ExternalWithdrawalFormItem>, quantities: Record<string, number>, type: EXTERNAL_WITHDRAWAL_TYPE): string {
  const totalItems = selectedItems.size;
  const totalQuantity = Array.from(selectedItems.keys()).reduce((sum, itemId) => sum + (quantities[itemId] || 1), 0);

  if (totalItems === 0) {
    return "Nenhum item selecionado";
  }

  const itemText = formatItemsCount(totalItems);
  const quantityText = `${totalQuantity.toLocaleString("pt-BR")} unidades`;
  const returnText = type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE ? " (para devolução)" : type === EXTERNAL_WITHDRAWAL_TYPE.COMPLIMENTARY ? " (cortesia)" : "";

  return `${itemText} - ${quantityText}${returnText}`;
}

// =====================
// DEBUGGING HELPERS
// =====================

/**
 * Log form data for debugging (only in development)
 */
export function debugFormData(formData: ExternalWithdrawalFormData, label?: string): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.group(`🔍 External Withdrawal Form Data${label ? ` - ${label}` : ""}`);
  const totals = calculateExternalWithdrawalTotals(formData.selectedItems, formData.quantities, formData.prices, formData.type);
  console.log("Form data:", formData);
  console.log("Calculated totals:", totals);
  console.groupEnd();
}

/**
 * Validate form data and log results (development only)
 */
export function debugValidation(formData: ExternalWithdrawalFormData): ValidationResult {
  const result = validateExternalWithdrawalForm(formData);

  if (process.env.NODE_ENV === "development") {
    console.group("🔍 Form Validation Results");
    if (result.errors.length > 0) {
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

export const externalWithdrawalFormUtils = {
  // Calculation functions
  calculateExternalWithdrawalTotals,
  calculateItemTotal,
  calculatePartialTotal,
  getBestItemPrice,

  // Currency helpers
  formatPriceForInput,
  formatPriceForDisplay,
  parsePriceInput,
  validatePriceInput,

  // Data transformation
  transformFormDataForAPI,
  transformAPIDataToFormData,
  cloneFormData,
  convertItemToFormItem,

  // Validation
  validateExternalWithdrawalForm,
  validateWithdrawerName,
  validateItemSelection,
  validateItemPrices,
  validateNotes,

  // Item processing
  filterItems,
  groupItemsByCategory,

  // Utilities
  safeGet,
  safeParseNumber,
  formatItemsCount,
  generateSelectionSummary,

  // Debug helpers
  debugFormData,
  debugValidation,
};
