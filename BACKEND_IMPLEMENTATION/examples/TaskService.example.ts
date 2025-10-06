/**
 * Example Task Service with Changelog Integration
 *
 * This file demonstrates how to integrate changelog tracking
 * into your Task update service/controller.
 *
 * @module examples/TaskService
 */

import { PrismaClient, Task } from '@prisma/client';
import { TaskChangelogService, TaskWithRelations } from '../services/TaskChangelogService';

/**
 * Task Service - Example implementation with changelog tracking
 *
 * This shows how to properly track Task changes including all relations
 */
export class TaskService {
  private prisma: PrismaClient;
  private taskChangelogService: TaskChangelogService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.taskChangelogService = new TaskChangelogService(prisma);
  }

  /**
   * Update a Task with full changelog tracking
   *
   * This is the main method that demonstrates proper changelog integration.
   * It follows the pattern:
   * 1. Fetch current state with all relations
   * 2. Perform the update
   * 3. Fetch new state with all relations
   * 4. Track all changes
   *
   * @param taskId - ID of the task to update
   * @param updateData - Data to update
   * @param userId - ID of user making the update
   * @returns Updated task with relations
   */
  async updateTask(
    taskId: string,
    updateData: any,
    userId?: string
  ): Promise<TaskWithRelations> {
    // STEP 1: Fetch BEFORE state with ALL relations
    // This is crucial - we need the complete state before changes
    const beforeTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        cuts: true,
        services: true,
        airbrushings: true,
        logoPaints: true,
        artworks: true,
        observation: true,
        truck: true,
      },
    });

    if (!beforeTask) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    // STEP 2: Perform the update with transaction
    // Handle complex relations (cuts, services, etc.)
    const afterTask = await this.prisma.$transaction(async (tx) => {
      // Extract relation data
      const { cuts, services, airbrushings, logoPaints, artworks, observation, truck, ...simpleFields } =
        updateData;

      // Update simple fields first
      const updated = await tx.task.update({
        where: { id: taskId },
        data: simpleFields,
      });

      // Handle CUTS relation
      if (cuts !== undefined) {
        // Delete existing cuts
        await tx.cut.deleteMany({
          where: { taskId },
        });

        // Create new cuts
        if (cuts.length > 0) {
          await tx.cut.createMany({
            data: cuts.map((cut: any) => ({
              ...cut,
              taskId,
            })),
          });
        }
      }

      // Handle SERVICES relation
      if (services !== undefined) {
        // Delete existing services
        await tx.serviceOrder.deleteMany({
          where: { taskId },
        });

        // Create new services
        if (services.length > 0) {
          await tx.serviceOrder.createMany({
            data: services.map((service: any) => ({
              ...service,
              taskId,
            })),
          });
        }
      }

      // Handle AIRBRUSHINGS relation
      if (airbrushings !== undefined) {
        // Delete existing airbrushings
        await tx.airbrushing.deleteMany({
          where: { taskId },
        });

        // Create new airbrushings
        if (airbrushings.length > 0) {
          await tx.airbrushing.createMany({
            data: airbrushings.map((airbrushing: any) => ({
              ...airbrushing,
              taskId,
            })),
          });
        }
      }

      // Handle LOGOPAINTS relation (many-to-many)
      if (logoPaints !== undefined) {
        // Disconnect all existing
        await tx.task.update({
          where: { id: taskId },
          data: {
            logoPaints: {
              set: [],
            },
          },
        });

        // Connect new ones
        if (logoPaints.length > 0) {
          await tx.task.update({
            where: { id: taskId },
            data: {
              logoPaints: {
                connect: logoPaints.map((id: string) => ({ id })),
              },
            },
          });
        }
      }

      // Handle ARTWORKS relation (many-to-many)
      if (artworks !== undefined) {
        // Disconnect all existing
        await tx.task.update({
          where: { id: taskId },
          data: {
            artworks: {
              set: [],
            },
          },
        });

        // Connect new ones
        if (artworks.length > 0) {
          await tx.task.update({
            where: { id: taskId },
            data: {
              artworks: {
                connect: artworks.map((id: string) => ({ id })),
              },
            },
          });
        }
      }

      // Handle OBSERVATION relation (one-to-one)
      if (observation !== undefined) {
        if (observation === null) {
          // Delete observation if exists
          if (beforeTask.observation) {
            await tx.observation.delete({
              where: { id: beforeTask.observation.id },
            });
          }
        } else {
          // Update or create observation
          await tx.task.update({
            where: { id: taskId },
            data: {
              observation: {
                upsert: {
                  create: observation,
                  update: observation,
                },
              },
            },
          });
        }
      }

      // Handle TRUCK relation (one-to-one)
      if (truck !== undefined) {
        if (truck === null) {
          // Disconnect truck if exists
          if (beforeTask.truck) {
            await tx.truck.update({
              where: { id: beforeTask.truck.id },
              data: { taskId: null },
            });
          }
        } else {
          // Update or connect truck
          await tx.task.update({
            where: { id: taskId },
            data: {
              truck: {
                upsert: {
                  create: truck,
                  update: truck,
                },
              },
            },
          });
        }
      }

      // Return updated task (simple fields only)
      return updated;
    });

    // STEP 3: Fetch AFTER state with ALL relations
    // This gives us the complete state after all changes
    const afterTaskWithRelations = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        cuts: true,
        services: true,
        airbrushings: true,
        logoPaints: true,
        artworks: true,
        observation: true,
        truck: true,
      },
    });

    if (!afterTaskWithRelations) {
      throw new Error(`Task ${taskId} not found after update`);
    }

    // STEP 4: Track all changes
    // The TaskChangelogService will automatically detect and log all changes
    try {
      await this.taskChangelogService.trackTaskChanges({
        taskId,
        before: beforeTask as TaskWithRelations,
        after: afterTaskWithRelations as TaskWithRelations,
        userId,
        triggeredBy: 'USER',
      });
    } catch (error) {
      // Log error but don't fail the update
      console.error('Failed to create changelog entries:', error);
    }

    return afterTaskWithRelations as TaskWithRelations;
  }

  /**
   * Create a Task with changelog tracking
   */
  async createTask(data: any, userId?: string): Promise<Task> {
    const task = await this.prisma.task.create({
      data,
    });

    try {
      await this.taskChangelogService.trackTaskCreation(task, userId);
    } catch (error) {
      console.error('Failed to create changelog entry for task creation:', error);
    }

    return task;
  }

  /**
   * Delete a Task with changelog tracking
   */
  async deleteTask(taskId: string, userId?: string): Promise<void> {
    // Fetch task before deletion
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    // Delete task
    await this.prisma.task.delete({
      where: { id: taskId },
    });

    // Track deletion
    try {
      await this.taskChangelogService.trackTaskDeletion(task, userId);
    } catch (error) {
      console.error('Failed to create changelog entry for task deletion:', error);
    }
  }

  /**
   * Update task status with specific changelog
   *
   * Example of tracking a specific field change without full comparison
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: string,
    userId?: string
  ): Promise<Task> {
    // Fetch current status
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });

    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const oldStatus = task.status;

    // Update status
    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
    });

    // Track specific field change
    if (oldStatus !== newStatus) {
      try {
        await this.taskChangelogService.trackFieldChange(
          taskId,
          'status',
          oldStatus,
          newStatus,
          userId
        );
      } catch (error) {
        console.error('Failed to create changelog entry:', error);
      }
    }

    return updated;
  }

  /**
   * Batch update tasks with changelog tracking
   */
  async batchUpdateTasks(
    updates: Array<{ id: string; data: any }>,
    userId?: string
  ): Promise<Task[]> {
    const results: Task[] = [];

    for (const update of updates) {
      const result = await this.updateTask(update.id, update.data, userId);
      results.push(result);
    }

    return results;
  }

  /**
   * Get task with changelogs
   */
  async getTaskWithChangelogs(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        cuts: true,
        services: true,
        airbrushings: true,
        logoPaints: true,
        artworks: true,
        observation: true,
        truck: true,
        sector: true,
        customer: true,
      },
    });

    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const changelogs = await this.taskChangelogService.getTaskChangelogs(taskId, {
      limit: 100,
      includeUser: true,
    });

    return {
      task,
      changelogs,
    };
  }
}

/**
 * Example usage in a NestJS controller
 */
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  async updateTask(req: any, res: any) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.id; // From auth middleware

      const updatedTask = await this.taskService.updateTask(id, updateData, userId);

      return res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

/**
 * Example usage in an Express route
 */
export function setupTaskRoutes(app: any, prisma: PrismaClient) {
  const taskService = new TaskService(prisma);

  // Update task endpoint
  app.put('/api/tasks/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.id; // From auth middleware

      const updatedTask = await taskService.updateTask(id, updateData, userId);

      return res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Get task with changelogs endpoint
  app.get('/api/tasks/:id/with-changelogs', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const result = await taskService.getTaskWithChangelogs(id);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching task:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
}
