/**
 * Icon mapping utility for item detail fields
 * Maps all item-related data fields to appropriate Tabler icons
 * with consistent sizing and color configurations
 */

// Icon names should match Tabler icons from @tabler/icons-react
export type TablerIconName = string;

// Icon size presets
export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const;

// Icon color presets based on field context
export const ICON_COLORS = {
  // Basic information
  info: "text-gray-600 dark:text-gray-400",
  primary: "text-blue-600 dark:text-blue-400",
  secondary: "text-gray-500 dark:text-gray-500",

  // Status indicators
  active: "text-green-700 dark:text-green-400",
  inactive: "text-gray-400 dark:text-gray-600",
  warning: "text-yellow-600 dark:text-yellow-400",
  danger: "text-red-600 dark:text-red-400",

  // Stock levels
  stockOptimal: "text-green-700 dark:text-green-400",
  stockLow: "text-yellow-400",
  stockCritical: "text-orange-500 dark:text-orange-400",
  stockOut: "text-red-600 dark:text-red-400",

  // Financial
  currency: "text-green-700 dark:text-green-400",
  expense: "text-red-600 dark:text-red-400",

  // Categories
  categoryA: "text-purple-600 dark:text-purple-400",
  categoryB: "text-blue-600 dark:text-blue-400",
  categoryC: "text-gray-600 dark:text-gray-400",

  // Demand patterns
  stable: "text-green-700 dark:text-green-400",
  variable: "text-yellow-600 dark:text-yellow-400",
  irregular: "text-red-600 dark:text-red-400",
} as const;

// Map of item fields to their corresponding Tabler icon names
export const ITEM_FIELD_ICONS: Record<string, string> = {
  // Basic Information
  name: "IconTag",
  uniCode: "IconBarcode",
  CA: "IconShieldCheck", // Certificate of Approval for PPE
  barcodes: "IconBarcode",

  // Category & Brand
  category: "IconFolder",
  categoryId: "IconFolder",
  brand: "IconBrandApple",
  brandId: "IconBrandApple",
  isPpe: "IconHelmet",

  // Stock & Quantity
  quantity: "IconPackages",
  minQuantity: "IconArrowDown",
  maxQuantity: "IconArrowUp",
  reorderPoint: "IconAlertCircle",
  reorderQuantity: "IconRefresh",
  boxQuantity: "IconBox",

  // Financial
  tax: "IconReceipt",
  totalPrice: "IconCurrencyDollar",
  monthlyConsumption: "IconTrendingDown",
  prices: "IconCurrencyDollar",
  price: "IconCurrencyDollar",
  value: "IconCurrencyDollar",

  // Measurements
  measureValue: "IconRuler",
  measureUnit: "IconRuler",

  // Supplier & Orders
  supplier: "IconTruck",
  supplierId: "IconTruck",
  estimatedLeadTime: "IconClock",
  orderItems: "IconClipboardList",

  // Status & Configuration
  isActive: "IconToggleRight",
  shouldAssignToUser: "IconUserCheck",

  // ABC/XYZ Analysis
  abcCategory: "IconChartBar",
  abcCategoryOrder: "IconSortAscending",
  xyzCategory: "IconChartLine",
  xyzCategoryOrder: "IconSortAscending",

  // Relations
  activities: "IconActivity",
  borrows: "IconRepeat",
  ppeConfigs: "IconSettings",
  ppeDeliveries: "IconTruck",
  relatedItems: "IconLink",
  relatedTo: "IconLink",

  // Audit fields
  createdAt: "IconCalendarPlus",
  updatedAt: "IconCalendarCheck",

  // Additional fields from related entities
  // ItemBrand
  brandName: "IconBrandApple",

  // ItemCategory
  categoryName: "IconFolder",

  // Price history
  priceHistory: "IconHistory",
  currentPrice: "IconCurrencyDollar",

  // Activity tracking
  lastActivity: "IconActivity",
  activityCount: "IconChartBar",

  // Borrow status
  borrowStatus: "IconRepeat",
  borrowedCount: "IconUsers",

  // PPE specific
  ppeSize: "IconRuler",
  ppeSchedule: "IconCalendarPlus",
  ppeRequests: "IconClipboard",

  // Stock analysis
  stockLevel: "IconPackages",
  stockStatus: "IconCircleCheck",
  turnoverRate: "IconRefresh",

  // Order tracking
  pendingOrders: "IconClock",
  lastOrderDate: "IconCalendar",
  orderFrequency: "IconChartLine",
} as const;

// Icon groups for different sections of item details
export const ITEM_SECTION_ICONS: Record<string, string> = {
  basicInfo: "IconInfoCircle",
  stockInfo: "IconPackages",
  financialInfo: "IconCurrencyDollar",
  supplierInfo: "IconTruck",
  measurementInfo: "IconRuler",
  categoryInfo: "IconFolder",
  analysisInfo: "IconChartBar",
  activityInfo: "IconActivity",
  ppeInfo: "IconHelmet",
  relatedInfo: "IconLink",
  historyInfo: "IconHistory",
  alertsInfo: "IconBell",
} as const;

// Dynamic icon selection based on field value
export function getStockLevelIcon(quantity: number, minQuantity?: number | null, maxQuantity?: number | null): string {
  if (quantity === 0) return "IconPackageOff";
  if (minQuantity && quantity <= minQuantity) return "IconAlertTriangle";
  if (maxQuantity && quantity >= maxQuantity) return "IconExclamationCircle";
  return "IconPackages";
}

export function getStockLevelColor(quantity: number, minQuantity?: number | null, maxQuantity?: number | null): string {
  if (quantity === 0) return ICON_COLORS.stockOut;
  if (minQuantity && quantity <= minQuantity) return ICON_COLORS.stockCritical;
  if (minQuantity && quantity <= minQuantity * 1.5) return ICON_COLORS.stockLow;
  if (maxQuantity && quantity >= maxQuantity) return ICON_COLORS.warning;
  return ICON_COLORS.stockOptimal;
}

export function getStatusIcon(isActive: boolean): string {
  return isActive ? "IconCircleCheck" : "IconCircleX";
}

export function getStatusColor(isActive: boolean): string {
  return isActive ? ICON_COLORS.active : ICON_COLORS.inactive;
}

export function getCategoryIcon(isPpe?: boolean): string {
  return isPpe ? "IconHelmet" : "IconFolder";
}

export function getAbcCategoryColor(category?: string | null): string {
  switch (category) {
    case "A":
      return ICON_COLORS.categoryA;
    case "B":
      return ICON_COLORS.categoryB;
    case "C":
      return ICON_COLORS.categoryC;
    default:
      return ICON_COLORS.secondary;
  }
}

export function getXyzCategoryColor(category?: string | null): string {
  switch (category) {
    case "X":
      return ICON_COLORS.stable;
    case "Y":
      return ICON_COLORS.variable;
    case "Z":
      return ICON_COLORS.irregular;
    default:
      return ICON_COLORS.secondary;
  }
}

export function getFinancialIcon(value: number): string {
  if (value < 0) return "IconTrendingDown";
  if (value > 0) return "IconTrendingUp";
  return "IconMinus";
}

export function getFinancialColor(value: number): string {
  if (value < 0) return ICON_COLORS.expense;
  return ICON_COLORS.currency;
}

// Helper to get icon configuration for a specific field
export interface IconConfig {
  name: string;
  size: number;
  color: string;
}

export function getItemFieldIcon(fieldName: string, value?: any, size: keyof typeof ICON_SIZES = "md"): IconConfig {
  let iconName = ITEM_FIELD_ICONS[fieldName] || "IconQuestionMark";
  let color: string = ICON_COLORS.info;

  // Special handling for dynamic icons based on value
  switch (fieldName) {
    case "quantity":
      const item = value as any;
      if (item?.minQuantity !== undefined && item?.maxQuantity !== undefined) {
        iconName = getStockLevelIcon(item.quantity, item.minQuantity, item.maxQuantity);
        color = getStockLevelColor(item.quantity, item.minQuantity, item.maxQuantity);
      }
      break;

    case "isActive":
      iconName = getStatusIcon(value as boolean);
      color = getStatusColor(value as boolean);
      break;

    case "abcCategory":
      color = getAbcCategoryColor(value as string);
      break;

    case "xyzCategory":
      color = getXyzCategoryColor(value as string);
      break;

    case "totalPrice":
    case "monthlyConsumption":
    case "price":
    case "value":
      if (typeof value === "number") {
        iconName = getFinancialIcon(value);
        color = getFinancialColor(value);
      }
      break;

    case "isPpe":
      if (value === true) {
        iconName = "IconHelmet";
        color = ICON_COLORS.warning;
      }
      break;
  }

  return {
    name: iconName,
    size: ICON_SIZES[size],
    color,
  };
}

// Helper to get section icon configuration
export function getSectionIcon(sectionName: string, size: keyof typeof ICON_SIZES = "lg"): IconConfig {
  const iconName = ITEM_SECTION_ICONS[sectionName] || "IconFolder";
  let color: string = ICON_COLORS.primary;

  // Special colors for certain sections
  switch (sectionName) {
    case "stockInfo":
      color = ICON_COLORS.info;
      break;
    case "financialInfo":
      color = ICON_COLORS.currency;
      break;
    case "ppeInfo":
      color = ICON_COLORS.warning;
      break;
    case "alertsInfo":
      color = ICON_COLORS.danger;
      break;
  }

  return {
    name: iconName,
    size: ICON_SIZES[size],
    color,
  };
}

// Batch icon getter for multiple fields
export function getItemFieldIcons(fields: string[], values?: Record<string, any>, size: keyof typeof ICON_SIZES = "md"): Record<string, IconConfig> {
  const icons: Record<string, IconConfig> = {};

  fields.forEach((field) => {
    icons[field] = getItemFieldIcon(field, values?.[field], size);
  });

  return icons;
}

// Export type definitions
export type IconSize = keyof typeof ICON_SIZES;
export type IconColor = keyof typeof ICON_COLORS;
export type ItemFieldName = keyof typeof ITEM_FIELD_ICONS;
export type ItemSectionName = keyof typeof ITEM_SECTION_ICONS;
