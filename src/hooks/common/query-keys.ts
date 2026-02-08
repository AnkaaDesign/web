// packages/hooks/src/queryKeys.ts

import type {
  ActivityGetManyFormData,
  BorrowGetManyFormData,
  ChangeLogGetManyFormData,
  CustomerGetManyFormData,
  PpeSizeGetManyFormData,
  PpeDeliveryGetManyFormData,
  PpeDeliveryScheduleGetManyFormData,
  ExternalWithdrawalGetManyFormData,
  ExternalWithdrawalItemGetManyFormData,
  FileGetManyFormData,
  GarageGetManyFormData,
  ItemGetManyFormData,
  ItemBrandGetManyFormData,
  ItemCategoryGetManyFormData,
  MaintenanceGetManyFormData,
  MaintenanceItemGetManyFormData,
  MaintenanceScheduleGetManyFormData,
  ObservationGetManyFormData,
  OrderGetManyFormData,
  OrderItemGetManyFormData,
  OrderScheduleGetManyFormData,
  PaintGetManyFormData,
  PaintTypeGetManyFormData,
  PaintBrandGetManyFormData,
  PaintGroundGetManyFormData,
  PaintFormulaGetManyFormData,
  PaintFormulaComponentGetManyFormData,
  PaintProductionGetManyFormData,
  PositionGetManyFormData,
  PositionRemunerationGetManyFormData,
  PreferencesGetManyFormData,
  PriceGetManyFormData,
  WarningGetManyFormData,
  ServiceOrderGetManyFormData,
  SupplierGetManyFormData,
  TaskGetManyFormData,
  TruckGetManyFormData,
  UserGetManyFormData,
  VacationGetManyFormData,
  NotificationGetManyFormData,
  SeenNotificationGetManyFormData,
  AirbrushingGetManyFormData,
  CutGetManyFormData,
} from "../../schemas";
import type { SectorGetManyFormData } from "../../types";

// =====================================================
// Query Key Factory Pattern
// =====================================================

// Base query key factory for consistent patterns
export function createQueryKeyStore<T>(entityName: string) {
  return {
    // Root key for invalidating all queries for this entity
    all: [entityName] as const,

    // List queries with filters
    lists: () => [entityName, "list"] as const,
    list: (filters?: Partial<T>) => (filters ? ([entityName, "list", filters] as const) : ([entityName, "list"] as const)),

    // Detail queries
    details: () => [entityName, "detail"] as const,
    detail: (id: string, include?: any) => (include ? ([entityName, "detail", id, include] as const) : ([entityName, "detail", id] as const)),

    // Multiple details by IDs
    byIds: (ids: string[]) => [entityName, "byIds", ids] as const,
  };
}

// Extended query key factory for entities with specialized queries
export function createExtendedQueryKeyStore<T>(entityName: string) {
  const base = createQueryKeyStore<T>(entityName);

  return {
    ...base,

    // Specialized query factories
    byField: (field: string, value: string, filters?: Partial<T>) => (filters ? ([entityName, field, value, filters] as const) : ([entityName, field, value] as const)),

    // Common specialized queries
    statistics: () => [entityName, "statistics"] as const,
    count: (filters?: Partial<T>) => (filters ? ([entityName, "count", filters] as const) : ([entityName, "count"] as const)),
  };
}

// =====================================================
// Activity Query Keys
// =====================================================

export const activityKeys = {
  all: ["activities"] as const,
  lists: () => ["activities", "list"] as const,
  list: (filters?: Partial<ActivityGetManyFormData>) => (filters ? (["activities", "list", filters] as const) : (["activities", "list"] as const)),
  details: () => ["activities", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["activities", "detail", id, include] as const) : (["activities", "detail", id] as const)),
  byIds: (ids: string[]) => ["activities", "byIds", ids] as const,

  // Specialized queries
  byItem: (itemId: string, filters?: Partial<ActivityGetManyFormData>) =>
    filters ? (["activities", "byItem", itemId, filters] as const) : (["activities", "byItem", itemId] as const),
  byUser: (userId: string, filters?: Partial<ActivityGetManyFormData>) =>
    filters ? (["activities", "byUser", userId, filters] as const) : (["activities", "byUser", userId] as const),
  byOrder: (orderId: string, filters?: Partial<ActivityGetManyFormData>) =>
    filters ? (["activities", "byOrder", orderId, filters] as const) : (["activities", "byOrder", orderId] as const),

  // Type-based queries
  inbound: (filters?: Partial<ActivityGetManyFormData>) => (filters ? (["activities", "inbound", filters] as const) : (["activities", "inbound"] as const)),
  outbound: (filters?: Partial<ActivityGetManyFormData>) => (filters ? (["activities", "outbound", filters] as const) : (["activities", "outbound"] as const)),
  discrepancies: (filters?: Partial<ActivityGetManyFormData>) => (filters ? (["activities", "discrepancies", filters] as const) : (["activities", "discrepancies"] as const)),
};

// =====================================================
// Airbrushing Query Keys
// =====================================================

export const airbrushingKeys = {
  all: ["airbrushings"] as const,
  root: ["airbrushings"] as const,
  lists: () => ["airbrushings", "list"] as const,
  list: (filters?: Partial<AirbrushingGetManyFormData>) => (filters ? (["airbrushings", "list", filters] as const) : (["airbrushings", "list"] as const)),
  details: () => ["airbrushings", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["airbrushings", "detail", id, include] as const) : (["airbrushings", "detail", id] as const)),
  byIds: (ids: string[]) => ["airbrushings", "byIds", ids] as const,
  // Specialized queries
  byTask: (taskId: string, filters?: Partial<AirbrushingGetManyFormData>) =>
    filters ? (["airbrushings", "byTask", taskId, filters] as const) : (["airbrushings", "byTask", taskId] as const),
};

// =====================================================
// Bonus Query Keys
// =====================================================

export const bonusKeys = {
  all: ["bonuses"] as const,
  lists: () => ["bonuses", "list"] as const,
  list: (filters?: any) => (filters ? (["bonuses", "list", filters] as const) : (["bonuses", "list"] as const)),
  details: () => ["bonuses", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["bonuses", "detail", id, include] as const) : (["bonuses", "detail", id] as const)),
  byIds: (ids: string[]) => ["bonuses", "byIds", ids] as const,

  // Specialized queries
  payroll: (params?: any) => ["payroll", params] as const,
  byUser: (userId: string, filters?: any) =>
    filters ? (["bonuses", "byUser", userId, filters] as const) : (["bonuses", "byUser", userId] as const),
  byPeriod: (year: number, month?: number[], filters?: any) =>
    filters ? (["bonuses", "byPeriod", year, month, filters] as const) : (["bonuses", "byPeriod", year, month] as const),
  statistics: () => ["bonuses", "statistics"] as const,
};

// =====================================================
// Borrow Query Keys
// =====================================================

export const borrowKeys = {
  all: ["borrows"] as const,
  lists: () => ["borrows", "list"] as const,
  list: (filters?: Partial<BorrowGetManyFormData>) => (filters ? (["borrows", "list", filters] as const) : (["borrows", "list"] as const)),
  details: () => ["borrows", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["borrows", "detail", id, include] as const) : (["borrows", "detail", id] as const)),
  byIds: (ids: string[]) => ["borrows", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string, filters?: Partial<BorrowGetManyFormData>) => (filters ? (["borrows", "byUser", userId, filters] as const) : (["borrows", "byUser", userId] as const)),
  byItem: (itemId: string, filters?: Partial<BorrowGetManyFormData>) => (filters ? (["borrows", "byItem", itemId, filters] as const) : (["borrows", "byItem", itemId] as const)),

  // Status-based queries
  active: (filters?: Partial<BorrowGetManyFormData>) => (filters ? (["borrows", "active", filters] as const) : (["borrows", "active"] as const)),
  late: (filters?: Partial<BorrowGetManyFormData>) => (filters ? (["borrows", "late", filters] as const) : (["borrows", "late"] as const)),
  overdue: (filters?: Partial<BorrowGetManyFormData>) => (filters ? (["borrows", "overdue", filters] as const) : (["borrows", "overdue"] as const)),
};

// =====================================================
// ChangeLog Query Keys
// =====================================================

export const changeLogKeys = createQueryKeyStore<ChangeLogGetManyFormData>("changelogs");


// =====================================================
// Customer Query Keys
// =====================================================

export const customerKeys = {
  all: ["customers"] as const,
  lists: () => ["customers", "list"] as const,
  list: (filters?: Partial<CustomerGetManyFormData>) => (filters ? (["customers", "list", filters] as const) : (["customers", "list"] as const)),
  details: () => ["customers", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["customers", "detail", id, include] as const) : (["customers", "detail", id] as const)),
  byIds: (ids: string[]) => ["customers", "byIds", ids] as const,

  // Specialized queries
  statistics: () => ["customers", "statistics"] as const,
};

// =====================================================
// Representative Query Keys
// =====================================================

export const representativeKeys = {
  all: ["representatives"] as const,
  lists: () => ["representatives", "list"] as const,
  list: (filters?: any) => (filters ? (["representatives", "list", filters] as const) : (["representatives", "list"] as const)),
  details: () => ["representatives", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["representatives", "detail", id, include] as const) : (["representatives", "detail", id] as const)),
  byIds: (ids: string[]) => ["representatives", "byIds", ids] as const,

  // Specialized queries
  byCustomer: (customerId: string, filters?: any) =>
    filters ? (["representatives", "byCustomer", customerId, filters] as const) : (["representatives", "byCustomer", customerId] as const),
  byCustomerAndRole: (customerId: string, role: string) =>
    ["representatives", "byCustomerAndRole", customerId, role] as const,
  statistics: () => ["representatives", "statistics"] as const,
};

// =====================================================
// Cut Query Keys
// =====================================================

export const cutKeys = {
  all: ["cuts"] as const,
  lists: () => ["cuts", "list"] as const,
  list: (filters?: Partial<CutGetManyFormData>) => (filters ? (["cuts", "list", filters] as const) : (["cuts", "list"] as const)),
  infinite: (filters?: Partial<CutGetManyFormData>) => (filters ? (["cuts", "infinite", filters] as const) : (["cuts", "infinite"] as const)),
  details: () => ["cuts", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["cuts", "detail", id, include] as const) : (["cuts", "detail", id] as const)),
  byIds: (ids: string[]) => ["cuts", "byIds", ids] as const,

  // Specialized queries
  byOrigin: (origin: string, filters?: Partial<CutGetManyFormData>) => (filters ? (["cuts", "byOrigin", origin, filters] as const) : (["cuts", "byOrigin", origin] as const)),
  byFile: (fileId: string, filters?: Partial<CutGetManyFormData>) => (filters ? (["cuts", "byFile", fileId, filters] as const) : (["cuts", "byFile", fileId] as const)),
  byTask: (taskId: string, filters?: Partial<CutGetManyFormData>) => (filters ? (["cuts", "byTask", taskId, filters] as const) : (["cuts", "byTask", taskId] as const)),
};

// =====================================================
// PPE Query Keys
// =====================================================

export const ppeSizeKeys = {
  all: ["ppeSizes"] as const,
  lists: () => ["ppeSizes", "list"] as const,
  list: (filters?: Partial<PpeSizeGetManyFormData>) => (filters ? (["ppeSizes", "list", filters] as const) : (["ppeSizes", "list"] as const)),
  details: () => ["ppeSizes", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["ppeSizes", "detail", id, include] as const) : (["ppeSizes", "detail", id] as const)),
  byIds: (ids: string[]) => ["ppeSizes", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string) => ["ppeSizes", "byUser", userId] as const,
  byMask: (maskSize: string) => ["ppeSizes", "byMask", maskSize] as const,
};

export const ppeDeliveryKeys = {
  all: ["ppeDeliveries"] as const,
  lists: () => ["ppeDeliveries", "list"] as const,
  list: (filters?: Partial<PpeDeliveryGetManyFormData>) => (filters ? (["ppeDeliveries", "list", filters] as const) : (["ppeDeliveries", "list"] as const)),
  details: () => ["ppeDeliveries", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["ppeDeliveries", "detail", id, include] as const) : (["ppeDeliveries", "detail", id] as const)),
  byIds: (ids: string[]) => ["ppeDeliveries", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string, filters?: Partial<PpeDeliveryGetManyFormData>) =>
    filters ? (["ppeDeliveries", "byUser", userId, filters] as const) : (["ppeDeliveries", "byUser", userId] as const),
  byItem: (itemId: string) => ["ppeDeliveries", "byItem", itemId] as const,
  pending: (filters?: Partial<PpeDeliveryGetManyFormData>) => (filters ? (["ppeDeliveries", "pending", filters] as const) : (["ppeDeliveries", "pending"] as const)),
  byUserAndDateRange: (userId: string, startDate?: Date, endDate?: Date) =>
    ["ppeDeliveries", "byUserAndDateRange", userId, startDate?.toISOString(), endDate?.toISOString()] as const,
};

// COMMENTED OUT: PPE config now in Item model
/*
export const ppeConfigKeys = {
  all: ["ppeConfigs"] as const,
  lists: () => ["ppeConfigs", "list"] as const,
  list: (filters?: Partial<PpeConfigGetManyFormData>) => (filters ? (["ppeConfigs", "list", filters] as const) : (["ppeConfigs", "list"] as const)),
  details: () => ["ppeConfigs", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["ppeConfigs", "detail", id, include] as const) : (["ppeConfigs", "detail", id] as const)),
  byIds: (ids: string[]) => ["ppeConfigs", "byIds", ids] as const,

  // Specialized queries
  byItem: (itemId: string) => ["ppeConfigs", "byItem", itemId] as const,
  byType: (ppeType: string) => ["ppeConfigs", "byType", ppeType] as const,
  byTypeAndMode: (ppeType: string, deliveryMode: string) => ["ppeConfigs", "byTypeAndMode", ppeType, deliveryMode] as const,
  bySize: (size: string) => ["ppeConfigs", "bySize", size] as const,
  byTypeAndSize: (ppeType: string, size: string) => ["ppeConfigs", "byTypeAndSize", ppeType, size] as const,
};
*/

export const ppeDeliveryScheduleKeys = {
  all: ["ppeDeliverySchedules"] as const,
  lists: () => ["ppeDeliverySchedules", "list"] as const,
  list: (filters?: Partial<PpeDeliveryScheduleGetManyFormData>) => (filters ? (["ppeDeliverySchedules", "list", filters] as const) : (["ppeDeliverySchedules", "list"] as const)),
  details: () => ["ppeDeliverySchedules", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["ppeDeliverySchedules", "detail", id, include] as const) : (["ppeDeliverySchedules", "detail", id] as const)),
  byIds: (ids: string[]) => ["ppeDeliverySchedules", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string, filters?: Partial<PpeDeliveryScheduleGetManyFormData>) =>
    filters ? (["ppeDeliverySchedules", "byUser", userId, filters] as const) : (["ppeDeliverySchedules", "byUser", userId] as const),
  active: (filters?: Partial<PpeDeliveryScheduleGetManyFormData>) =>
    filters ? (["ppeDeliverySchedules", "active", filters] as const) : (["ppeDeliverySchedules", "active"] as const),
  upcoming: (filters?: Partial<PpeDeliveryScheduleGetManyFormData>) =>
    filters ? (["ppeDeliverySchedules", "upcoming", filters] as const) : (["ppeDeliverySchedules", "upcoming"] as const),
  byPpeType: (ppeType: string) => ["ppeDeliverySchedules", "byPpeType", ppeType] as const,
  byAssignmentType: (assignmentType: string) => ["ppeDeliverySchedules", "byAssignmentType", assignmentType] as const,
};

// =====================================================
// External Withdrawal Query Keys
// =====================================================

export const externalWithdrawalKeys = {
  all: ["externalWithdrawals"] as const,
  lists: () => ["externalWithdrawals", "list"] as const,
  list: (filters?: Partial<ExternalWithdrawalGetManyFormData>) => (filters ? (["externalWithdrawals", "list", filters] as const) : (["externalWithdrawals", "list"] as const)),
  details: () => ["externalWithdrawals", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["externalWithdrawals", "detail", id, include] as const) : (["externalWithdrawals", "detail", id] as const)),
  byIds: (ids: string[]) => ["externalWithdrawals", "byIds", ids] as const,
};

export const externalWithdrawalItemKeys = {
  all: ["externalWithdrawalItems"] as const,
  lists: () => ["externalWithdrawalItems", "list"] as const,
  list: (filters?: Partial<ExternalWithdrawalItemGetManyFormData>) =>
    filters ? (["externalWithdrawalItems", "list", filters] as const) : (["externalWithdrawalItems", "list"] as const),
  details: () => ["externalWithdrawalItems", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["externalWithdrawalItems", "detail", id, include] as const) : (["externalWithdrawalItems", "detail", id] as const)),
  byIds: (ids: string[]) => ["externalWithdrawalItems", "byIds", ids] as const,

  // Specialized queries
  byWithdrawal: (withdrawalId: string, filters?: Partial<ExternalWithdrawalItemGetManyFormData>) =>
    filters ? (["externalWithdrawalItems", "byWithdrawal", withdrawalId, filters] as const) : (["externalWithdrawalItems", "byWithdrawal", withdrawalId] as const),
  byItem: (itemId: string, filters?: Partial<ExternalWithdrawalItemGetManyFormData>) =>
    filters ? (["externalWithdrawalItems", "byItem", itemId, filters] as const) : (["externalWithdrawalItems", "byItem", itemId] as const),
};

// =====================================================
// File Query Keys
// =====================================================

export const fileKeys = {
  all: ["files"] as const,
  lists: () => ["files", "list"] as const,
  list: (filters?: Partial<FileGetManyFormData>) => (filters ? (["files", "list", filters] as const) : (["files", "list"] as const)),
  details: () => ["files", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["files", "detail", id, include] as const) : (["files", "detail", id] as const)),
  byIds: (ids: string[]) => ["files", "byIds", ids] as const,

  // Specialized queries
  orphaned: (filters?: Partial<FileGetManyFormData>) => (filters ? (["files", "orphaned", filters] as const) : (["files", "orphaned"] as const)),
  byEntity: (entityType: string, entityId: string) => ["files", "byEntity", entityType, entityId] as const,
};

// Alias for artworks (task files are now called artworks)
export const artworkKeys = fileKeys;

// =====================================================
// Garage Query Keys
// =====================================================

export const garageKeys = createQueryKeyStore<GarageGetManyFormData>("garages");

// =====================================================
// Item Query Keys
// =====================================================

export const itemKeys = {
  all: ["items"] as const,
  lists: () => ["items", "list"] as const,
  list: (filters?: Partial<ItemGetManyFormData>) => (filters ? (["items", "list", filters] as const) : (["items", "list"] as const)),
  details: () => ["items", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["items", "detail", id, include] as const) : (["items", "detail", id] as const)),
  byIds: (ids: string[]) => ["items", "byIds", ids] as const,

  // Specialized queries
  bySupplier: (supplierId: string, filters?: Partial<ItemGetManyFormData>) =>
    filters ? (["items", "bySupplier", supplierId, filters] as const) : (["items", "bySupplier", supplierId] as const),
  byCategory: (categoryId: string, filters?: Partial<ItemGetManyFormData>) =>
    filters ? (["items", "byCategory", categoryId, filters] as const) : (["items", "byCategory", categoryId] as const),
  byBrand: (brandId: string, filters?: Partial<ItemGetManyFormData>) => (filters ? (["items", "byBrand", brandId, filters] as const) : (["items", "byBrand", brandId] as const)),

  // Status queries
  lowStock: (filters?: Partial<ItemGetManyFormData>) => (filters ? (["items", "lowStock", filters] as const) : (["items", "lowStock"] as const)),

  // Type queries
  byType: (type: string, filters?: Partial<ItemGetManyFormData>) => (filters ? (["items", "byType", type, filters] as const) : (["items", "byType", type] as const)),

  // PPE queries
  ppe: (filters?: Partial<ItemGetManyFormData>) => (filters ? (["items", "ppe", filters] as const) : (["items", "ppe"] as const)),
  ppeByType: (ppeType: string, filters?: Partial<ItemGetManyFormData>) =>
    filters ? (["items", "ppeByType", ppeType, filters] as const) : (["items", "ppeByType", ppeType] as const),
  ppeByTypeAndSize: (ppeType: string, ppeSize: string, filters?: Partial<ItemGetManyFormData>) =>
    filters ? (["items", "ppeByTypeAndSize", ppeType, ppeSize, filters] as const) : (["items", "ppeByTypeAndSize", ppeType, ppeSize] as const),

  // Analytics
  statistics: () => ["items", "statistics"] as const,
};

export const itemBrandKeys = createQueryKeyStore<ItemBrandGetManyFormData>("itemBrands");
export const itemCategoryKeys = {
  ...createQueryKeyStore<ItemCategoryGetManyFormData>("itemCategories"),
  // Type-specific queries
  byType: (type: string, filters?: Partial<ItemCategoryGetManyFormData>) =>
    filters ? (["itemCategories", "byType", type, filters] as const) : (["itemCategories", "byType", type] as const),
  ppe: (filters?: Partial<ItemCategoryGetManyFormData>) => (filters ? (["itemCategories", "ppe", filters] as const) : (["itemCategories", "ppe"] as const)),
  regular: (filters?: Partial<ItemCategoryGetManyFormData>) => (filters ? (["itemCategories", "regular", filters] as const) : (["itemCategories", "regular"] as const)),
  tool: (filters?: Partial<ItemCategoryGetManyFormData>) => (filters ? (["itemCategories", "tool", filters] as const) : (["itemCategories", "tool"] as const)),
};

// =====================================================
// Maintenance Query Keys
// =====================================================

export const maintenanceKeys = {
  all: ["maintenances"] as const,
  lists: () => ["maintenances", "list"] as const,
  list: (filters?: Partial<MaintenanceGetManyFormData>) => (filters ? (["maintenances", "list", filters] as const) : (["maintenances", "list"] as const)),
  details: () => ["maintenances", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["maintenances", "detail", id, include] as const) : (["maintenances", "detail", id] as const)),
  byIds: (ids: string[]) => ["maintenances", "byIds", ids] as const,

  // Specialized queries
  byItem: (itemId: string, filters?: Partial<MaintenanceGetManyFormData>) =>
    filters ? (["maintenances", "byItem", itemId, filters] as const) : (["maintenances", "byItem", itemId] as const),

  // Status queries
  upcoming: (filters?: Partial<MaintenanceGetManyFormData>) => (filters ? (["maintenances", "upcoming", filters] as const) : (["maintenances", "upcoming"] as const)),
  overdue: (filters?: Partial<MaintenanceGetManyFormData>) => (filters ? (["maintenances", "overdue", filters] as const) : (["maintenances", "overdue"] as const)),
};

export const maintenanceItemKeys = createQueryKeyStore<MaintenanceItemGetManyFormData>("maintenanceItems");

export const maintenanceScheduleKeys = {
  all: ["maintenanceSchedules"] as const,
  lists: () => ["maintenanceSchedules", "list"] as const,
  list: (filters?: Partial<MaintenanceScheduleGetManyFormData>) => (filters ? (["maintenanceSchedules", "list", filters] as const) : (["maintenanceSchedules", "list"] as const)),
  infinite: (filters?: Partial<MaintenanceScheduleGetManyFormData>) =>
    filters ? (["maintenanceSchedules", "infinite", filters] as const) : (["maintenanceSchedules", "infinite"] as const),
  details: () => ["maintenanceSchedules", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["maintenanceSchedules", "detail", id, include] as const) : (["maintenanceSchedules", "detail", id] as const)),
  byIds: (ids: string[]) => ["maintenanceSchedules", "byIds", ids] as const,

  // Specialized queries
  byItem: (itemId: string, filters?: Partial<MaintenanceScheduleGetManyFormData>) =>
    filters ? (["maintenanceSchedules", "byItem", itemId, filters] as const) : (["maintenanceSchedules", "byItem", itemId] as const),
  active: (filters?: Partial<MaintenanceScheduleGetManyFormData>) =>
    filters ? (["maintenanceSchedules", "active", filters] as const) : (["maintenanceSchedules", "active"] as const),
  inactive: (filters?: Partial<MaintenanceScheduleGetManyFormData>) =>
    filters ? (["maintenanceSchedules", "inactive", filters] as const) : (["maintenanceSchedules", "inactive"] as const),
};

// First measureKeys declaration removed - duplicate

// =====================================================
// Notification Query Keys
// =====================================================

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => ["notifications", "list"] as const,
  list: (filters?: Partial<NotificationGetManyFormData>) => (filters ? (["notifications", "list", filters] as const) : (["notifications", "list"] as const)),
  details: () => ["notifications", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["notifications", "detail", id, include] as const) : (["notifications", "detail", id] as const)),
  byIds: (ids: string[]) => ["notifications", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string, filters?: Partial<NotificationGetManyFormData>) =>
    filters ? (["notifications", "byUser", userId, filters] as const) : (["notifications", "byUser", userId] as const),
  unread: (userId: string) => ["notifications", "unread", userId] as const,
  count: (userId: string) => ["notifications", "count", userId] as const,
  recent: (userId: string) => ["notifications", "recent", userId] as const,
};

export const seenNotificationKeys = {
  all: ["seenNotifications"] as const,
  lists: () => ["seenNotifications", "list"] as const,
  list: (filters?: Partial<SeenNotificationGetManyFormData>) => (filters ? (["seenNotifications", "list", filters] as const) : (["seenNotifications", "list"] as const)),
  details: () => ["seenNotifications", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["seenNotifications", "detail", id, include] as const) : (["seenNotifications", "detail", id] as const)),
  byIds: (ids: string[]) => ["seenNotifications", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string) => ["seenNotifications", "byUser", userId] as const,
  byNotification: (notificationId: string) => ["seenNotifications", "byNotification", notificationId] as const,
};

// =====================================================
// Observation Query Keys
// =====================================================

export const observationKeys = {
  all: ["observations"] as const,
  root: ["observations"] as const,
  lists: () => ["observations", "list"] as const,
  list: (filters?: Partial<ObservationGetManyFormData>) => (filters ? (["observations", "list", filters] as const) : (["observations", "list"] as const)),
  details: () => ["observations", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["observations", "detail", id, include] as const) : (["observations", "detail", id] as const)),
  byIds: (ids: string[]) => ["observations", "byIds", ids] as const,

  // Specialized queries
  byTask: (taskId: string, filters?: Partial<ObservationGetManyFormData>) =>
    filters ? (["observations", "byTask", taskId, filters] as const) : (["observations", "byTask", taskId] as const),
};

// =====================================================
// Order Query Keys
// =====================================================

export const orderKeys = {
  all: ["orders"] as const,
  lists: () => ["orders", "list"] as const,
  list: (filters?: Partial<OrderGetManyFormData>) => (filters ? (["orders", "list", filters] as const) : (["orders", "list"] as const)),
  details: () => ["orders", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["orders", "detail", id, include] as const) : (["orders", "detail", id] as const)),
  byIds: (ids: string[]) => ["orders", "byIds", ids] as const,

  // Specialized queries
  bySupplier: (supplierId: string, filters?: Partial<OrderGetManyFormData>) =>
    filters ? (["orders", "bySupplier", supplierId, filters] as const) : (["orders", "bySupplier", supplierId] as const),

  // Status queries
  pending: (filters?: Partial<OrderGetManyFormData>) => (filters ? (["orders", "pending", filters] as const) : (["orders", "pending"] as const)),

  // Analytics
  statistics: () => ["orders", "statistics"] as const,
};

export const orderItemKeys = {
  all: ["orderItems"] as const,
  lists: () => ["orderItems", "list"] as const,
  list: (filters?: Partial<OrderItemGetManyFormData>) => (filters ? (["orderItems", "list", filters] as const) : (["orderItems", "list"] as const)),
  details: () => ["orderItems", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["orderItems", "detail", id, include] as const) : (["orderItems", "detail", id] as const)),
  byIds: (ids: string[]) => ["orderItems", "byIds", ids] as const,

  // Specialized queries
  byOrder: (orderId: string, filters?: Partial<OrderItemGetManyFormData>) =>
    filters ? (["orderItems", "byOrder", orderId, filters] as const) : (["orderItems", "byOrder", orderId] as const),
  byItem: (itemId: string, filters?: Partial<OrderItemGetManyFormData>) =>
    filters ? (["orderItems", "byItem", itemId, filters] as const) : (["orderItems", "byItem", itemId] as const),
};

export const orderScheduleKeys = {
  all: ["orderSchedules"] as const,
  lists: () => ["orderSchedules", "list"] as const,
  list: (filters?: Partial<OrderScheduleGetManyFormData>) => (filters ? (["orderSchedules", "list", filters] as const) : (["orderSchedules", "list"] as const)),
  details: () => ["orderSchedules", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["orderSchedules", "detail", id, include] as const) : (["orderSchedules", "detail", id] as const)),
  byIds: (ids: string[]) => ["orderSchedules", "byIds", ids] as const,

  // Specialized queries
  active: (filters?: Partial<OrderScheduleGetManyFormData>) => (filters ? (["orderSchedules", "active", filters] as const) : (["orderSchedules", "active"] as const)),
};

// =====================================================
// Price Query Keys
// =====================================================

export const priceQueryKeys = {
  all: ["prices"] as const,
  lists: () => ["prices", "list"] as const,
  list: (filters?: Partial<PriceGetManyFormData>) => (filters ? (["prices", "list", filters] as const) : (["prices", "list"] as const)),
  details: () => ["prices", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["prices", "detail", id, include] as const) : (["prices", "detail", id] as const)),
  byIds: (ids: string[]) => ["prices", "byIds", ids] as const,

  // Specialized queries
  byItem: (itemId: string, filters?: Partial<PriceGetManyFormData>) => (filters ? (["prices", "byItem", itemId, filters] as const) : (["prices", "byItem", itemId] as const)),
  latestByItem: (itemId: string) => ["prices", "latestByItem", itemId] as const,
  historyByItem: (itemId: string, limit?: number) => (limit ? (["prices", "historyByItem", itemId, limit] as const) : (["prices", "historyByItem", itemId] as const)),

  // Analytics
  statistics: () => ["prices", "statistics"] as const,
};

// =====================================================
// Paint Query Keys
// =====================================================

export const paintKeys = createQueryKeyStore<PaintGetManyFormData>("paints");
export const paintTypeKeys = createQueryKeyStore<PaintTypeGetManyFormData>("paintTypes");
export const paintBrandKeys = {
  ...createQueryKeyStore<PaintBrandGetManyFormData>("paintBrands"),

  // Specialized queries for dual filtering system
  forComponents: (paintTypeId?: string, paintBrand?: string, includeInactive?: boolean) => ["paintBrands", "forComponents", paintTypeId, paintBrand, includeInactive] as const,

  forSelection: (searchTerm?: string) => (searchTerm ? (["paintBrands", "forSelection", searchTerm] as const) : (["paintBrands", "forSelection"] as const)),

  withCounts: () => ["paintBrands", "withCounts"] as const,

  dualFiltered: (paintTypeId?: string, paintBrand?: string) => ["paintBrands", "dualFiltered", paintTypeId, paintBrand] as const,

  // Status-based queries
  active: (filters?: Partial<PaintBrandGetManyFormData>) => (filters ? (["paintBrands", "active", filters] as const) : (["paintBrands", "active"] as const)),

  inactive: (filters?: Partial<PaintBrandGetManyFormData>) => (filters ? (["paintBrands", "inactive", filters] as const) : (["paintBrands", "inactive"] as const)),
};
export const paintGroundKeys = createQueryKeyStore<PaintGroundGetManyFormData>("paintGrounds");
export const paintFormulaKeys = createQueryKeyStore<PaintFormulaGetManyFormData>("paintFormulas");
export const paintFormulaComponentKeys = createQueryKeyStore<PaintFormulaComponentGetManyFormData>("paintFormulaComponents");
export const paintProductionKeys = createQueryKeyStore<PaintProductionGetManyFormData>("paintProductions");

// =====================================================
// Position Query Keys
// =====================================================

export const positionKeys = createQueryKeyStore<PositionGetManyFormData>("positions");
export const positionRemunerationKeys = {
  ...createQueryKeyStore<PositionRemunerationGetManyFormData>("positionRemunerations"),

  // Specialized queries
  byPosition: (positionId: string, include?: any) =>
    include ? (["positionRemunerations", "byPosition", positionId, include] as const) : (["positionRemunerations", "byPosition", positionId] as const),
  currentByPosition: (positionId: string, include?: any) =>
    include ? (["positionRemunerations", "currentByPosition", positionId, include] as const) : (["positionRemunerations", "currentByPosition", positionId] as const),
  byValueRange: (min: number, max: number, include?: any) =>
    include ? (["positionRemunerations", "byValueRange", min, max, include] as const) : (["positionRemunerations", "byValueRange", min, max] as const),
};

// =====================================================
// Preferences Query Keys
// =====================================================

export const preferencesKeys = {
  all: ["preferences"] as const,
  lists: () => ["preferences", "list"] as const,
  list: (filters?: Partial<PreferencesGetManyFormData>) => (filters ? (["preferences", "list", filters] as const) : (["preferences", "list"] as const)),
  details: () => ["preferences", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["preferences", "detail", id, include] as const) : (["preferences", "detail", id] as const)),
  byIds: (ids: string[]) => ["preferences", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string) => ["preferences", "byUser", userId] as const,
};

// export const notificationPreferenceKeys = createQueryKeyStore<NotificationPreferenceGetManyFormData>("notificationPreferences"); // TODO: Add when NotificationPreference is implemented

// =====================================================
// Warning Query Keys
// =====================================================

export const warningKeys = {
  ...createQueryKeyStore<WarningGetManyFormData>("warnings"),

  // Specialized queries
  byCollaborator: (collaboratorId: string, filters?: Partial<WarningGetManyFormData>) =>
    filters ? (["warnings", "byCollaborator", collaboratorId, filters] as const) : (["warnings", "byCollaborator", collaboratorId] as const),
  bySupervisor: (supervisorId: string, filters?: Partial<WarningGetManyFormData>) =>
    filters ? (["warnings", "bySupervisor", supervisorId, filters] as const) : (["warnings", "bySupervisor", supervisorId] as const),
  active: (filters?: Partial<WarningGetManyFormData>) => (filters ? (["warnings", "active", filters] as const) : (["warnings", "active"] as const)),
  pendingFollowUp: (filters?: Partial<WarningGetManyFormData>) => (filters ? (["warnings", "pendingFollowUp", filters] as const) : (["warnings", "pendingFollowUp"] as const)),
};

// =====================================================
// Sector Query Keys
// =====================================================

export const sectorKeys = createQueryKeyStore<SectorGetManyFormData>("sectors");

// =====================================================
// ServiceOrder Query Keys
// =====================================================

export const serviceOrderKeys = {
  ...createQueryKeyStore<ServiceOrderGetManyFormData>("serviceOrders"),
  root: ["serviceOrders"] as const,
};

// =====================================================
// Supplier Query Keys
// =====================================================

export const supplierKeys = {
  all: ["suppliers"] as const,
  lists: () => ["suppliers", "list"] as const,
  list: (filters?: Partial<SupplierGetManyFormData>) => (filters ? (["suppliers", "list", filters] as const) : (["suppliers", "list"] as const)),
  details: () => ["suppliers", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["suppliers", "detail", id, include] as const) : (["suppliers", "detail", id] as const)),
  byIds: (ids: string[]) => ["suppliers", "byIds", ids] as const,

  // Analytics
  statistics: () => ["suppliers", "statistics"] as const,
};

// =====================================================
// Task Query Keys
// =====================================================

export const taskKeys = {
  all: ["tasks"] as const,
  root: ["tasks"] as const,
  lists: () => ["tasks", "list"] as const,
  list: (filters?: Partial<TaskGetManyFormData>) => (filters ? (["tasks", "list", filters] as const) : (["tasks", "list"] as const)),
  details: () => ["tasks", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["tasks", "detail", id, include] as const) : (["tasks", "detail", id] as const)),
  byIds: (ids: string[]) => ["tasks", "byIds", ids] as const,

  // Specialized queries
  byCustomer: (customerId: string, filters?: Partial<TaskGetManyFormData>) =>
    filters ? (["tasks", "byCustomer", customerId, filters] as const) : (["tasks", "byCustomer", customerId] as const),
  bySector: (sectorId: string, filters?: Partial<TaskGetManyFormData>) =>
    filters ? (["tasks", "bySector", sectorId, filters] as const) : (["tasks", "bySector", sectorId] as const),
  byUser: (userId: string, filters?: Partial<TaskGetManyFormData>) => (filters ? (["tasks", "byUser", userId, filters] as const) : (["tasks", "byUser", userId] as const)),

  // Status queries
  active: (filters?: Partial<TaskGetManyFormData>) => (filters ? (["tasks", "active", filters] as const) : (["tasks", "active"] as const)),

  // Analytics
  statistics: () => ["tasks", "statistics"] as const,
};

// =====================================================
// Truck Query Keys
// =====================================================

export const truckKeys = createQueryKeyStore<TruckGetManyFormData>("trucks");

// =====================================================
// User Query Keys
// =====================================================

export const userKeys = {
  all: ["users"] as const,
  lists: () => ["users", "list"] as const,
  list: (filters?: Partial<UserGetManyFormData>) => (filters ? (["users", "list", filters] as const) : (["users", "list"] as const)),
  details: () => ["users", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["users", "detail", id, include] as const) : (["users", "detail", id] as const)),
  byIds: (ids: string[]) => ["users", "byIds", ids] as const,

  // Specialized queries
  byPosition: (positionId: string, filters?: Partial<UserGetManyFormData>) =>
    filters ? (["users", "byPosition", positionId, filters] as const) : (["users", "byPosition", positionId] as const),
  bySector: (sectorId: string, filters?: Partial<UserGetManyFormData>) =>
    filters ? (["users", "bySector", sectorId, filters] as const) : (["users", "bySector", sectorId] as const),

  // Analytics
  statistics: () => ["users", "statistics"] as const,
};

// =====================================================
// Holiday Query Keys
// =====================================================

export const holidayKeys = {
  all: ["holidays"] as const,
  lists: () => ["holidays", "list"] as const,
  list: (filters?: any) => (filters ? (["holidays", "list", filters] as const) : (["holidays", "list"] as const)),
  details: () => ["holidays", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["holidays", "detail", id, include] as const) : (["holidays", "detail", id] as const)),
  byIds: (ids: string[]) => ["holidays", "byIds", ids] as const,

  // Specialized queries
  byYear: (year: number, filters?: any) => (filters ? (["holidays", "byYear", year, filters] as const) : (["holidays", "byYear", year] as const)),
  byType: (type: string, filters?: any) => (filters ? (["holidays", "byType", type, filters] as const) : (["holidays", "byType", type] as const)),
  upcoming: (filters?: any) => (filters ? (["holidays", "upcoming", filters] as const) : (["holidays", "upcoming"] as const)),
};

// =====================================================
// Vacation Query Keys
// =====================================================

export const vacationKeys = {
  all: ["vacations"] as const,
  lists: () => ["vacations", "list"] as const,
  list: (filters?: Partial<VacationGetManyFormData>) => (filters ? (["vacations", "list", filters] as const) : (["vacations", "list"] as const)),
  details: () => ["vacations", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["vacations", "detail", id, include] as const) : (["vacations", "detail", id] as const)),
  byIds: (ids: string[]) => ["vacations", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string, filters?: Partial<VacationGetManyFormData>) =>
    filters ? (["vacations", "byUser", userId, filters] as const) : (["vacations", "byUser", userId] as const),

  // Status queries
  active: (filters?: Partial<VacationGetManyFormData>) => (filters ? (["vacations", "active", filters] as const) : (["vacations", "active"] as const)),
  upcoming: (filters?: Partial<VacationGetManyFormData>) => (filters ? (["vacations", "upcoming", filters] as const) : (["vacations", "upcoming"] as const)),
};

// =====================================================
// Payroll Query Keys
// =====================================================

export const payrollKeys = {
  all: ["payrolls"] as const,
  lists: () => ["payrolls", "list"] as const,
  list: (filters?: any) => (filters ? (["payrolls", "list", filters] as const) : (["payrolls", "list"] as const)),
  details: () => ["payrolls", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["payrolls", "detail", id, include] as const) : (["payrolls", "detail", id] as const)),
  byIds: (ids: string[]) => ["payrolls", "byIds", ids] as const,

  // Specialized queries
  byUser: (userId: string, filters?: any) =>
    filters ? (["payrolls", "byUser", userId, filters] as const) : (["payrolls", "byUser", userId] as const),
  byPeriod: (year: number, month: number, filters?: any) =>
    filters ? (["payrolls", "byPeriod", year, month, filters] as const) : (["payrolls", "byPeriod", year, month] as const),
  byUserAndPeriod: (userId: string, year: number, month: number, include?: any) =>
    include ? (["payrolls", "byUserAndPeriod", userId, year, month, include] as const) : (["payrolls", "byUserAndPeriod", userId, year, month] as const),

  // Live calculation queries
  live: (year: number, month: number) => ["payrolls", "live", year, month] as const,
  liveByUser: (userId: string, year: number, month: number) => ["payrolls", "live", userId, year, month] as const,

  // Simulation queries
  simulation: (params: any) => ["payrolls", "simulation", params] as const,

  // Statistics
  statistics: (year?: number, month?: number) =>
    year && month ? (["payrolls", "statistics", year, month] as const) : (["payrolls", "statistics"] as const),
  comparison: (year: number, month: number) => ["payrolls", "comparison", year, month] as const,
};

// =====================================================
// Deployment Query Keys
// =====================================================

export const deploymentKeys = {
  all: ["deployments"] as const,
  lists: () => ["deployments", "list"] as const,
  list: (filters?: any) => (filters ? (["deployments", "list", filters] as const) : (["deployments", "list"] as const)),
  details: () => ["deployments", "detail"] as const,
  detail: (id: string, include?: any) => (include ? (["deployments", "detail", id, include] as const) : (["deployments", "detail", id] as const)),
  byIds: (ids: string[]) => ["deployments", "byIds", ids] as const,

  // Specialized queries
  byEnvironment: (environment: string, filters?: any) =>
    filters ? (["deployments", "byEnvironment", environment, filters] as const) : (["deployments", "byEnvironment", environment] as const),
  latest: (environment?: string) =>
    environment ? (["deployments", "latest", environment] as const) : (["deployments", "latest"] as const),

  // New deployment workflow queries
  commits: (limit?: number) => (limit ? (["deployments", "commits", limit] as const) : (["deployments", "commits"] as const)),
  current: (application: string, environment: string) => ["deployments", "current", application, environment] as const,
  logs: (deploymentId: string) => ["deployments", "logs", deploymentId] as const,
};

// =====================================================
// Server Query Keys
// =====================================================

export const serverKeys = {
  all: ["server"] as const,

  // Service management
  services: () => ["server", "services"] as const,
  serviceAction: (action: string, serviceName: string) => ["server", "services", action, serviceName] as const,
  serviceLogs: (serviceName: string, params?: any) =>
    params ? (["server", "services", serviceName, "logs", params] as const) : (["server", "services", serviceName, "logs"] as const),

  // System metrics
  metrics: () => ["server", "metrics"] as const,
  status: () => ["server", "status"] as const,
  temperature: () => ["server", "temperature"] as const,
  ssdHealth: () => ["server", "ssd-health"] as const,
  raidStatus: () => ["server", "raid-status"] as const,

  // System users
  users: () => ["server", "users"] as const,
  userAction: (action: string, username: string) => ["server", "users", action, username] as const,

  // Shared folders
  sharedFolders: () => ["server", "shared-folders"] as const,
  sharedFolderContents: (folderName?: string, subPath?: string) =>
    subPath ? (["server", "shared-folders", folderName, "contents", subPath] as const) : (["server", "shared-folders", folderName, "contents"] as const),
};

// =====================================================
// Team Staff Query Keys
// =====================================================

/**
 * Query keys for team staff endpoints.
 * These endpoints are secure and automatically filter data based on the authenticated user's managed sector.
 */
export const teamStaffKeys = {
  all: ["teamStaff"] as const,

  // Users in team leader's sector
  users: () => ["teamStaff", "users"] as const,
  usersList: (filters?: Partial<UserGetManyFormData>) => (filters ? (["teamStaff", "users", "list", filters] as const) : (["teamStaff", "users", "list"] as const)),

  // Borrows for team members
  borrows: () => ["teamStaff", "borrows"] as const,
  borrowsList: (filters?: Partial<BorrowGetManyFormData>) => (filters ? (["teamStaff", "borrows", "list", filters] as const) : (["teamStaff", "borrows", "list"] as const)),

  // Vacations for team members
  vacations: () => ["teamStaff", "vacations"] as const,
  vacationsList: (filters?: Partial<VacationGetManyFormData>) => (filters ? (["teamStaff", "vacations", "list", filters] as const) : (["teamStaff", "vacations", "list"] as const)),

  // Warnings for team members
  warnings: () => ["teamStaff", "warnings"] as const,
  warningsList: (filters?: Partial<WarningGetManyFormData>) => (filters ? (["teamStaff", "warnings", "list", filters] as const) : (["teamStaff", "warnings", "list"] as const)),

  // Activities for team members
  activities: () => ["teamStaff", "activities"] as const,
  activitiesList: (filters?: Partial<ActivityGetManyFormData>) =>
    filters ? (["teamStaff", "activities", "list", filters] as const) : (["teamStaff", "activities", "list"] as const),

  // EPIs (PPE Deliveries) for team members
  epis: () => ["teamStaff", "epis"] as const,
  episList: (filters?: Partial<PpeDeliveryGetManyFormData>) => (filters ? (["teamStaff", "epis", "list", filters] as const) : (["teamStaff", "epis", "list"] as const)),

  // Payroll calculations for team members
  calculations: () => ["teamStaff", "calculations"] as const,
  calculationsByPeriod: (year: number, month: number) => ["teamStaff", "calculations", year, month] as const,
};

// =====================================================
