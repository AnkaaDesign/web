/**
 * Type definitions for Changelog system
 *
 * These types extend the Prisma-generated types with additional
 * utility types for changelog operations.
 *
 * @module types/changelog
 */

import { ChangeLog, Task, Prisma } from '@prisma/client';

/**
 * Changelog action types
 */
export type ChangeLogAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Who triggered the change
 */
export type ChangeTriggeredBy = 'USER' | 'SYSTEM' | 'BATCH_OPERATION' | 'AUTOMATION';

/**
 * Entity types that support changelog tracking
 */
export type ChangeLogEntityType =
  | 'Task'
  | 'Order'
  | 'OrderItem'
  | 'Item'
  | 'User'
  | 'Customer'
  | 'Supplier'
  | 'ServiceOrder'
  | 'Airbrushing'
  | 'Cut'
  | 'Paint'
  | 'File'
  | 'Sector'
  | 'Position';

/**
 * Base changelog entry structure
 */
export interface BaseChangeLogEntry {
  entityType: ChangeLogEntityType;
  entityId: string;
  action: ChangeLogAction;
  field?: string | null;
  oldValue?: any;
  newValue?: any;
  description?: string;
  userId?: string | null;
  triggeredBy?: ChangeTriggeredBy;
  metadata?: Record<string, any>;
}

/**
 * Changelog entry with required user
 */
export interface UserChangeLogEntry extends BaseChangeLogEntry {
  userId: string;
  triggeredBy: 'USER';
}

/**
 * Changelog entry for system actions
 */
export interface SystemChangeLogEntry extends BaseChangeLogEntry {
  triggeredBy: 'SYSTEM' | 'BATCH_OPERATION' | 'AUTOMATION';
  metadata: Record<string, any>;
}

/**
 * Changelog entry with populated user relation
 */
export interface ChangeLogWithUser extends ChangeLog {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Field change detection result
 */
export interface FieldChangeResult {
  field: string;
  oldValue: any;
  newValue: any;
  hasChanged: boolean;
}

/**
 * Array relation change details
 */
export interface ArrayRelationChange {
  field: string;
  added: any[];
  removed: any[];
  modified: any[];
  oldCount: number;
  newCount: number;
}

/**
 * Object relation change details
 */
export interface ObjectRelationChange {
  field: string;
  wasNull: boolean;
  isNull: boolean;
  oldValue: any;
  newValue: any;
}

/**
 * Changelog query filters
 */
export interface ChangeLogFilters {
  entityType?: ChangeLogEntityType | ChangeLogEntityType[];
  entityId?: string | string[];
  action?: ChangeLogAction | ChangeLogAction[];
  field?: string;
  userId?: string | string[];
  triggeredBy?: ChangeTriggeredBy | ChangeTriggeredBy[];
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Changelog query options
 */
export interface ChangeLogQueryOptions {
  filters?: ChangeLogFilters;
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
  includeUser?: boolean;
}

/**
 * Pagination result for changelogs
 */
export interface ChangeLogPaginatedResult {
  data: ChangeLogWithUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Task with all relations for changelog tracking
 */
export type TaskWithAllRelations = Prisma.TaskGetPayload<{
  include: {
    cuts: true;
    services: true;
    airbrushings: true;
    logoPaints: true;
    artworks: true;
    observation: true;
    truck: true;
    sector: true;
    customer: true;
    budget: true;
    nfe: true;
    receipt: true;
    generalPainting: true;
    createdBy: true;
  };
}>;

/**
 * Minimal Task for changelog operations
 */
export type MinimalTask = Pick<
  Task,
  'id' | 'name' | 'status' | 'customerId' | 'sectorId' | 'createdAt' | 'updatedAt'
>;

/**
 * Task update data structure
 */
export interface TaskUpdateData {
  // Simple fields
  name?: string;
  status?: string;
  serialNumber?: string | null;
  plate?: string | null;
  details?: string | null;
  entryDate?: Date | null;
  term?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  price?: number | null;
  customerId?: string | null;
  sectorId?: string | null;
  budgetId?: string | null;
  nfeId?: string | null;
  receiptId?: string | null;
  paintId?: string | null;

  // Relations (as nested data)
  cuts?: any[];
  services?: any[];
  airbrushings?: any[];
  logoPaints?: any[];
  artworks?: any[];
  observation?: any;
  truck?: any;
}

/**
 * Changelog service configuration
 */
export interface ChangelogServiceConfig {
  enableAutomaticTracking?: boolean;
  defaultTriggeredBy?: ChangeTriggeredBy;
  fieldsToIgnore?: string[];
  maxChangelogRetention?: number; // days
}

/**
 * Relation handler function type
 */
export type RelationHandler = (
  oldValue: any,
  newValue: any
) => {
  field: string;
  oldValue: any;
  newValue: any;
} | null;

/**
 * Relation handlers map
 */
export type RelationHandlersMap = Record<string, RelationHandler>;

/**
 * Change detection options
 */
export interface ChangeDetectionOptions {
  fieldsToIgnore?: string[];
  fieldsToTrack?: string[];
  relationHandlers?: RelationHandlersMap;
  compareDeep?: boolean;
}

/**
 * Changelog batch creation result
 */
export interface ChangeLogBatchResult {
  created: number;
  failed: number;
  errors?: Array<{
    entry: BaseChangeLogEntry;
    error: Error;
  }>;
}

/**
 * Webhook payload for changelog events
 */
export interface ChangeLogWebhookPayload {
  event: 'changelog.created';
  timestamp: Date;
  changelog: ChangeLogWithUser;
  entity: {
    type: ChangeLogEntityType;
    id: string;
  };
}

/**
 * Audit log summary
 */
export interface AuditLogSummary {
  entityType: ChangeLogEntityType;
  entityId: string;
  totalChanges: number;
  lastChange: Date;
  changesByAction: Record<ChangeLogAction, number>;
  changesByUser: Array<{
    userId: string;
    userName: string;
    changeCount: number;
  }>;
  mostChangedFields: Array<{
    field: string;
    changeCount: number;
  }>;
}

/**
 * Rollback operation data
 */
export interface RollbackOperation {
  changelogId: string;
  entityType: ChangeLogEntityType;
  entityId: string;
  field: string;
  rollbackValue: any;
  reason?: string;
  performedBy: string;
}

/**
 * Changelog statistics
 */
export interface ChangeLogStatistics {
  totalChanges: number;
  changesByEntityType: Record<ChangeLogEntityType, number>;
  changesByAction: Record<ChangeLogAction, number>;
  changesByTrigger: Record<ChangeTriggeredBy, number>;
  topUsers: Array<{
    userId: string;
    userName: string;
    changeCount: number;
  }>;
  period: {
    from: Date;
    to: Date;
  };
}

/**
 * Export all types
 */
export type {
  ChangeLog,
  ChangeLogAction,
  ChangeTriggeredBy,
  ChangeLogEntityType,
  BaseChangeLogEntry,
  UserChangeLogEntry,
  SystemChangeLogEntry,
  ChangeLogWithUser,
  FieldChangeResult,
  ArrayRelationChange,
  ObjectRelationChange,
  ChangeLogFilters,
  ChangeLogQueryOptions,
  ChangeLogPaginatedResult,
  TaskWithAllRelations,
  MinimalTask,
  TaskUpdateData,
  ChangelogServiceConfig,
  RelationHandler,
  RelationHandlersMap,
  ChangeDetectionOptions,
  ChangeLogBatchResult,
  ChangeLogWebhookPayload,
  AuditLogSummary,
  RollbackOperation,
  ChangeLogStatistics,
};
