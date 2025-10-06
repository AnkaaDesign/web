/**
 * TaskChangelogService - Specialized service for tracking Task changes
 *
 * This service extends the base ChangelogService with Task-specific logic.
 * It handles all Task fields including complex relations:
 * - cuts: Cut plans and requests
 * - services: Service orders
 * - airbrushings: Airbrushing work
 * - logoPaints: Logo paints
 * - artworks: Artwork files
 * - observation: Task observation
 * - truck: Associated truck
 *
 * @module services/TaskChangelogService
 */

import { PrismaClient, ChangeLog, Task } from '@prisma/client';
import { ChangelogService } from './ChangelogService';
import {
  createArrayRelationHandler,
  createObjectRelationHandler,
  createIdRelationHandler,
} from '../utils/changelogHelpers';

/**
 * Complete Task with all relations for changelog tracking
 */
export interface TaskWithRelations extends Task {
  cuts?: any[];
  services?: any[];
  airbrushings?: any[];
  logoPaints?: any[];
  artworks?: any[];
  observation?: any;
  truck?: any;
}

/**
 * Options for task changelog tracking
 */
export interface TrackTaskChangesOptions {
  taskId: string;
  before: TaskWithRelations;
  after: TaskWithRelations;
  userId?: string;
  triggeredBy?: 'USER' | 'SYSTEM' | 'BATCH_OPERATION' | 'AUTOMATION';
}

/**
 * TaskChangelogService - Manages Task-specific changelog tracking
 */
export class TaskChangelogService {
  private changelogService: ChangelogService;

  constructor(private readonly prisma: PrismaClient) {
    this.changelogService = new ChangelogService(prisma);
  }

  /**
   * Track all changes to a Task entity
   *
   * This method handles both simple field changes and complex relation changes.
   * It creates separate changelog entries for each changed field.
   *
   * @param options - Task tracking options
   * @returns Promise<ChangeLog[]> - Array of created changelog entries
   *
   * @example
   * const changelogs = await taskChangelogService.trackTaskChanges({
   *   taskId: task.id,
   *   before: oldTask,
   *   after: updatedTask,
   *   userId: currentUser.id,
   * });
   */
  async trackTaskChanges(options: TrackTaskChangesOptions): Promise<ChangeLog[]> {
    const { taskId, before, after, userId, triggeredBy = 'USER' } = options;

    // Define fields to ignore (these are auto-managed)
    const fieldsToIgnore = [
      'id',
      'createdAt',
      'updatedAt',
      // Relations to handle separately
      'cuts',
      'services',
      'airbrushings',
      'logoPaints',
      'artworks',
      'observation',
      'truck',
      'sector',
      'customer',
      'budget',
      'nfe',
      'receipt',
      'generalPainting',
      'createdBy',
      'relatedTasks',
      'relatedTo',
    ];

    // Define relation handlers for complex fields
    const relationHandlers = {
      // Cuts: Track changes in cut plans
      cuts: createArrayRelationHandler({
        fieldName: 'cuts',
        simplifyFields: ['type', 'quantity', 'fileId', 'origin', 'status'],
        groupBy: 'type',
      }),

      // Services: Track changes in service orders
      services: createArrayRelationHandler({
        fieldName: 'services',
        simplifyFields: ['description', 'status', 'statusOrder'],
      }),

      // Airbrushings: Track changes in airbrushing work
      airbrushings: createArrayRelationHandler({
        fieldName: 'airbrushings',
        simplifyFields: ['description', 'price', 'status'],
      }),

      // LogoPaints: Track changes in logo paints (many-to-many)
      logoPaints: createArrayRelationHandler({
        fieldName: 'logoPaints',
        simplifyFields: ['id', 'name'],
      }),

      // Artworks: Track changes in artwork files (many-to-many)
      artworks: createArrayRelationHandler({
        fieldName: 'artworks',
        simplifyFields: ['id', 'filename', 'mimetype'],
      }),

      // Observation: Track changes in task observation (one-to-one)
      observation: createObjectRelationHandler({
        fieldName: 'observation',
        simplifyFields: ['description'],
      }),

      // Truck: Track changes in associated truck (one-to-one)
      truck: createObjectRelationHandler({
        fieldName: 'truck',
        simplifyFields: ['xPosition', 'yPosition', 'garageId'],
      }),
    };

    // Track all changes using the base service
    const changelogs = await this.changelogService.trackChanges({
      entityType: 'Task',
      entityId: taskId,
      before,
      after,
      userId,
      triggeredBy,
      fieldsToIgnore,
      relationHandlers,
    });

    return changelogs;
  }

  /**
   * Track Task creation
   *
   * Creates a CREATE changelog entry for a new task
   *
   * @param task - The created task with relations
   * @param userId - User who created the task
   * @returns Promise<ChangeLog> - Created changelog entry
   */
  async trackTaskCreation(task: TaskWithRelations, userId?: string): Promise<ChangeLog> {
    return await this.changelogService.trackCreation(
      'Task',
      task.id,
      {
        name: task.name,
        status: task.status,
        customerId: task.customerId,
        sectorId: task.sectorId,
      },
      userId
    );
  }

  /**
   * Track Task deletion
   *
   * Creates a DELETE changelog entry for a deleted task
   *
   * @param task - The deleted task with relations
   * @param userId - User who deleted the task
   * @returns Promise<ChangeLog> - Created changelog entry
   */
  async trackTaskDeletion(task: TaskWithRelations, userId?: string): Promise<ChangeLog> {
    return await this.changelogService.trackDeletion(
      'Task',
      task.id,
      {
        name: task.name,
        status: task.status,
      },
      userId
    );
  }

  /**
   * Get Task changelogs with pagination
   *
   * @param taskId - ID of the task
   * @param options - Query options
   * @returns Promise<ChangeLog[]> - Array of changelog entries
   */
  async getTaskChangelogs(
    taskId: string,
    options: {
      limit?: number;
      offset?: number;
      includeUser?: boolean;
    } = {}
  ): Promise<ChangeLog[]> {
    return await this.changelogService.getChangeLogs('Task', taskId, options);
  }

  /**
   * Track specific field change
   *
   * Useful when you want to track a specific field change without
   * comparing entire objects
   *
   * @param taskId - ID of the task
   * @param field - Field name that changed
   * @param oldValue - Previous value
   * @param newValue - New value
   * @param userId - User who made the change
   * @returns Promise<ChangeLog> - Created changelog entry
   *
   * @example
   * await taskChangelogService.trackFieldChange(
   *   taskId,
   *   'status',
   *   'PENDING',
   *   'IN_PRODUCTION',
   *   userId
   * );
   */
  async trackFieldChange(
    taskId: string,
    field: string,
    oldValue: any,
    newValue: any,
    userId?: string
  ): Promise<ChangeLog> {
    return await this.changelogService.createChangeLog({
      entityType: 'Task',
      entityId: taskId,
      action: 'UPDATE',
      field,
      oldValue,
      newValue,
      userId,
      triggeredBy: 'USER',
    });
  }

  /**
   * Track batch field changes
   *
   * Creates multiple changelog entries for multiple field changes
   *
   * @param taskId - ID of the task
   * @param changes - Array of field changes
   * @param userId - User who made the changes
   * @returns Promise<number> - Number of changelog entries created
   *
   * @example
   * await taskChangelogService.trackBatchFieldChanges(taskId, [
   *   { field: 'status', oldValue: 'PENDING', newValue: 'IN_PRODUCTION' },
   *   { field: 'startedAt', oldValue: null, newValue: new Date() },
   * ], userId);
   */
  async trackBatchFieldChanges(
    taskId: string,
    changes: Array<{ field: string; oldValue: any; newValue: any }>,
    userId?: string
  ): Promise<number> {
    const entries = changes.map(change => ({
      entityType: 'Task',
      entityId: taskId,
      action: 'UPDATE' as const,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      userId,
      triggeredBy: 'USER' as const,
    }));

    return await this.changelogService.createManyChangeLogs(entries);
  }
}

/**
 * Factory function to create TaskChangelogService instance
 *
 * @param prisma - Prisma client instance
 * @returns TaskChangelogService instance
 *
 * @example
 * const taskChangelogService = createTaskChangelogService(prisma);
 */
export function createTaskChangelogService(prisma: PrismaClient): TaskChangelogService {
  return new TaskChangelogService(prisma);
}
