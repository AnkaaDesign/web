/**
 * ChangelogService - Core service for creating and managing changelog entries
 *
 * This service provides a unified interface for tracking changes across all entities.
 * It handles both simple field changes and complex relation changes.
 *
 * @module services/ChangelogService
 */

import { PrismaClient, ChangeLog, Prisma } from '@prisma/client';

// Type definitions for changelog operations
export interface ChangeLogEntry {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  field?: string | null;
  oldValue?: any;
  newValue?: any;
  description?: string;
  userId?: string | null;
  triggeredBy?: 'USER' | 'SYSTEM' | 'BATCH_OPERATION' | 'AUTOMATION';
  metadata?: Record<string, any>;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface CreateChangelogOptions {
  entityType: string;
  entityId: string;
  before: any;
  after: any;
  userId?: string;
  triggeredBy?: 'USER' | 'SYSTEM' | 'BATCH_OPERATION' | 'AUTOMATION';
  fieldsToIgnore?: string[];
  fieldsToTrack?: string[];
  relationHandlers?: Record<string, RelationHandler>;
}

export type RelationHandler = (oldValue: any, newValue: any) => FieldChange | null;

/**
 * ChangelogService - Main service for changelog operations
 */
export class ChangelogService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a single changelog entry
   *
   * @param entry - The changelog entry data
   * @returns Promise<ChangeLog> - The created changelog entry
   *
   * @example
   * await changelogService.createChangeLog({
   *   entityType: 'Task',
   *   entityId: taskId,
   *   action: 'UPDATE',
   *   field: 'status',
   *   oldValue: 'PENDING',
   *   newValue: 'IN_PRODUCTION',
   *   userId: userId,
   * });
   */
  async createChangeLog(entry: ChangeLogEntry): Promise<ChangeLog> {
    return await this.prisma.changeLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        field: entry.field || null,
        oldValue: entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
        newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
        reason: entry.description || null,
        userId: entry.userId || null,
        triggeredBy: entry.triggeredBy || 'USER',
        metadata: entry.metadata || null,
      },
    });
  }

  /**
   * Create multiple changelog entries in a batch
   *
   * @param entries - Array of changelog entries
   * @returns Promise<number> - Number of entries created
   *
   * @example
   * await changelogService.createManyChangeLogs([
   *   { entityType: 'Task', entityId: id1, action: 'UPDATE', field: 'status', ... },
   *   { entityType: 'Task', entityId: id2, action: 'UPDATE', field: 'price', ... },
   * ]);
   */
  async createManyChangeLogs(entries: ChangeLogEntry[]): Promise<number> {
    const result = await this.prisma.changeLog.createMany({
      data: entries.map(entry => ({
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        field: entry.field || null,
        oldValue: entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
        newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
        reason: entry.description || null,
        userId: entry.userId || null,
        triggeredBy: entry.triggeredBy || 'USER',
        metadata: entry.metadata || null,
      })),
    });
    return result.count;
  }

  /**
   * Track changes between two entity states and create changelog entries
   *
   * This is the main method for automatic changelog tracking.
   * It compares before/after states and creates appropriate changelog entries.
   *
   * @param options - Configuration for change tracking
   * @returns Promise<ChangeLog[]> - Array of created changelog entries
   *
   * @example
   * await changelogService.trackChanges({
   *   entityType: 'Task',
   *   entityId: taskId,
   *   before: oldTask,
   *   after: newTask,
   *   userId: userId,
   *   fieldsToIgnore: ['updatedAt', 'createdAt'],
   * });
   */
  async trackChanges(options: CreateChangelogOptions): Promise<ChangeLog[]> {
    const {
      entityType,
      entityId,
      before,
      after,
      userId,
      triggeredBy = 'USER',
      fieldsToIgnore = ['updatedAt', 'createdAt'],
      fieldsToTrack,
      relationHandlers = {},
    } = options;

    // Detect all changes
    const changes = this.detectChanges(before, after, {
      fieldsToIgnore,
      fieldsToTrack,
      relationHandlers,
    });

    // If no changes detected, return empty array
    if (changes.length === 0) {
      return [];
    }

    // Create changelog entries for each change
    const changelogEntries: ChangeLogEntry[] = changes.map(change => ({
      entityType,
      entityId,
      action: 'UPDATE',
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      userId,
      triggeredBy,
    }));

    // Batch create all changelog entries
    await this.createManyChangeLogs(changelogEntries);

    // Fetch and return created entries for confirmation
    return await this.prisma.changeLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: changes.length,
    });
  }

  /**
   * Detect changes between two objects
   *
   * @param before - Object state before changes
   * @param after - Object state after changes
   * @param options - Detection options
   * @returns FieldChange[] - Array of detected changes
   *
   * @private
   */
  private detectChanges(
    before: any,
    after: any,
    options: {
      fieldsToIgnore?: string[];
      fieldsToTrack?: string[];
      relationHandlers?: Record<string, RelationHandler>;
    } = {}
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const { fieldsToIgnore = [], fieldsToTrack, relationHandlers = {} } = options;

    // If before or after is null/undefined, skip comparison
    if (!before || !after) {
      return changes;
    }

    // Determine which fields to check
    const fieldsToCheck = fieldsToTrack || Object.keys(after);

    for (const field of fieldsToCheck) {
      // Skip ignored fields
      if (fieldsToIgnore.includes(field)) {
        continue;
      }

      const oldValue = before[field];
      const newValue = after[field];

      // Check if there's a custom handler for this field (for relations)
      if (relationHandlers[field]) {
        const relationChange = relationHandlers[field](oldValue, newValue);
        if (relationChange) {
          changes.push(relationChange);
        }
        continue;
      }

      // Compare values
      if (this.hasValueChanged(oldValue, newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
        });
      }
    }

    return changes;
  }

  /**
   * Check if a value has changed between old and new
   *
   * Handles different data types appropriately:
   * - Primitives: Direct comparison
   * - Dates: Compare time values
   * - Arrays: Deep comparison
   * - Objects: Deep comparison
   * - null/undefined: Treats as equal
   *
   * @param oldValue - Previous value
   * @param newValue - New value
   * @returns boolean - True if values are different
   *
   * @private
   */
  private hasValueChanged(oldValue: any, newValue: any): boolean {
    // Handle null/undefined
    if (oldValue === null && newValue === null) return false;
    if (oldValue === undefined && newValue === undefined) return false;
    if (oldValue === null && newValue === undefined) return false;
    if (oldValue === undefined && newValue === null) return false;
    if ((oldValue === null || oldValue === undefined) && newValue !== null && newValue !== undefined) return true;
    if ((newValue === null || newValue === undefined) && oldValue !== null && oldValue !== undefined) return true;

    // Handle primitives
    if (typeof oldValue !== 'object' && typeof newValue !== 'object') {
      return oldValue !== newValue;
    }

    // Handle Dates
    if (oldValue instanceof Date && newValue instanceof Date) {
      return oldValue.getTime() !== newValue.getTime();
    }

    // Handle arrays
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }

    // Handle objects (deep comparison)
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }

    // Default: consider changed
    return true;
  }

  /**
   * Create a changelog entry for entity creation
   *
   * @param entityType - Type of entity created
   * @param entityId - ID of created entity
   * @param data - Created entity data
   * @param userId - User who created the entity
   * @returns Promise<ChangeLog> - Created changelog entry
   */
  async trackCreation(
    entityType: string,
    entityId: string,
    data: any,
    userId?: string
  ): Promise<ChangeLog> {
    return await this.createChangeLog({
      entityType,
      entityId,
      action: 'CREATE',
      newValue: data,
      userId,
      triggeredBy: 'USER',
    });
  }

  /**
   * Create a changelog entry for entity deletion
   *
   * @param entityType - Type of entity deleted
   * @param entityId - ID of deleted entity
   * @param data - Deleted entity data
   * @param userId - User who deleted the entity
   * @returns Promise<ChangeLog> - Created changelog entry
   */
  async trackDeletion(
    entityType: string,
    entityId: string,
    data: any,
    userId?: string
  ): Promise<ChangeLog> {
    return await this.createChangeLog({
      entityType,
      entityId,
      action: 'DELETE',
      oldValue: data,
      userId,
      triggeredBy: 'USER',
    });
  }

  /**
   * Get changelog entries for an entity
   *
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   * @param options - Query options
   * @returns Promise<ChangeLog[]> - Array of changelog entries
   */
  async getChangeLogs(
    entityType: string,
    entityId: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: 'asc' | 'desc';
      includeUser?: boolean;
    } = {}
  ): Promise<ChangeLog[]> {
    const { limit = 50, offset = 0, orderBy = 'desc', includeUser = true } = options;

    return await this.prisma.changeLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: includeUser ? { user: true } : undefined,
      orderBy: { createdAt: orderBy },
      take: limit,
      skip: offset,
    });
  }
}
