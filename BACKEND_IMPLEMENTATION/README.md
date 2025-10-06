# Backend Changelog Implementation - Complete Guide

## Overview

This implementation provides comprehensive changelog tracking for Task entities with support for **ALL** fields including complex relations:

- ✅ Simple fields (status, name, price, dates, etc.)
- ✅ Cuts tracking
- ✅ Services tracking
- ✅ Airbrushings tracking
- ✅ LogoPaints tracking
- ✅ Artworks tracking
- ✅ Observation tracking
- ✅ Truck tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Display)                        │
│  ✅ Already configured and working                          │
│  - Displays changelogs in Portuguese                        │
│  - Formats all field types correctly                        │
│  - Shows timeline with user info                            │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                         API Request
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Backend (This Implementation)               │
│                                                              │
│  ┌────────────────────┐         ┌──────────────────────┐   │
│  │   Task Service     │────────▶│  TaskChangelogService│   │
│  │                    │         │                      │   │
│  │  1. Get BEFORE     │         │  - Detects changes   │   │
│  │  2. Update Task    │         │  - Handles relations │   │
│  │  3. Get AFTER      │         │  - Creates entries   │   │
│  │  4. Track Changes  │         └──────────────────────┘   │
│  └────────────────────┘                    │               │
│                                             │               │
│                          ┌──────────────────▼───────┐       │
│                          │  ChangelogService        │       │
│                          │  - Core change detection │       │
│                          │  - Batch operations      │       │
│                          └──────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        ┌──────────┐
                        │ Database │
                        │ Postgres │
                        └──────────┘
```

## File Structure

```
BACKEND_IMPLEMENTATION/
├── services/
│   ├── ChangelogService.ts          # Core changelog service
│   └── TaskChangelogService.ts      # Task-specific changelog tracking
├── utils/
│   └── changelogHelpers.ts          # Helper utilities for comparisons
├── types/
│   └── changelog.d.ts               # TypeScript type definitions
├── examples/
│   └── TaskService.example.ts       # Complete integration example
└── README.md                        # This file
```

## Installation

### 1. Copy files to your backend project

```bash
# Copy services
cp BACKEND_IMPLEMENTATION/services/* your-backend/src/services/

# Copy utils
cp BACKEND_IMPLEMENTATION/utils/* your-backend/src/utils/

# Copy types (if using TypeScript)
cp BACKEND_IMPLEMENTATION/types/* your-backend/src/types/
```

### 2. Install dependencies

```bash
npm install @prisma/client
# or
yarn add @prisma/client
```

### 3. Update your Prisma schema

Ensure your `schema.prisma` has the ChangeLog model:

```prisma
model ChangeLog {
  id            String    @id @default(uuid())
  entityType    String    // 'Task', 'Order', etc.
  entityId      String    // UUID of the entity
  action        String    // 'CREATE', 'UPDATE', 'DELETE'
  field         String?   // Field that changed (for UPDATE)
  oldValue      String?   // Previous value (JSON)
  newValue      String?   // New value (JSON)
  reason        String?   // Description/reason
  metadata      Json?     // Additional context
  userId        String?   // User who made the change
  triggeredBy   String?   // 'USER', 'SYSTEM', 'BATCH_OPERATION'
  createdAt     DateTime  @default(now())

  user          User?     @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([userId])
}
```

## Usage

### Basic Integration (Quick Start)

Replace your existing Task update logic with this pattern:

```typescript
import { PrismaClient } from '@prisma/client';
import { TaskChangelogService } from './services/TaskChangelogService';

const prisma = new PrismaClient();
const taskChangelogService = new TaskChangelogService(prisma);

async function updateTask(taskId: string, updateData: any, userId?: string) {
  // 1. Get BEFORE state with all relations
  const beforeTask = await prisma.task.findUnique({
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

  // 2. Perform the update (your existing logic)
  await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  // 3. Get AFTER state with all relations
  const afterTask = await prisma.task.findUnique({
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

  // 4. Track all changes automatically
  await taskChangelogService.trackTaskChanges({
    taskId,
    before: beforeTask,
    after: afterTask,
    userId,
  });

  return afterTask;
}
```

### Advanced Integration

See `/examples/TaskService.example.ts` for a complete, production-ready implementation that handles:

- Transaction management
- Complex relation updates (cuts, services, airbrushings)
- Many-to-many relations (logoPaints, artworks)
- One-to-one relations (observation, truck)
- Error handling
- Batch operations

## Field Name Mapping

**IMPORTANT**: Use these exact field names for changelog entries to match frontend expectations:

| Field Type | Backend Field Name | Frontend Label |
|------------|-------------------|----------------|
| Cuts | `cuts` | "Recortes" |
| Services | `services` | "Serviços" |
| Airbrushings | `airbrushings` | "Aerografias" |
| Logo Paints | `logoPaints` | "Tintas do Logo" |
| Artworks | `artworks` | "Artes" |
| Observation | `observation` | "Observação" |
| Truck | `truck` | "Caminhão" |

❌ **DON'T USE**: `cutRequest`, `cutPlan`, `cut` - These won't display correctly
✅ **USE**: `cuts` - This matches frontend configuration

## API Integration

### Option 1: NestJS

```typescript
import { Controller, Put, Param, Body, Req } from '@nestjs/common';
import { TaskService } from './task.service';

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Put(':id')
  async updateTask(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: any
  ) {
    const userId = req.user?.id; // From auth guard
    const task = await this.taskService.updateTask(id, updateData, userId);
    return { success: true, data: task };
  }
}
```

### Option 2: Express

```typescript
import express from 'express';
import { TaskService } from './services/TaskService';

const app = express();
const taskService = new TaskService(prisma);

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware

    const task = await taskService.updateTask(id, updateData, userId);

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Option 3: Fastify

```typescript
import Fastify from 'fastify';
import { TaskService } from './services/TaskService';

const fastify = Fastify();
const taskService = new TaskService(prisma);

fastify.put('/api/tasks/:id', async (request, reply) => {
  const { id } = request.params;
  const updateData = request.body;
  const userId = request.user?.id; // From auth plugin

  const task = await taskService.updateTask(id, updateData, userId);

  return { success: true, data: task };
});
```

## Testing

### 1. Test Simple Field Changes

```bash
curl -X PUT http://localhost:3030/api/tasks/YOUR_TASK_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "IN_PRODUCTION",
    "price": 1500
  }'
```

**Expected**: 2 changelog entries created (status + price)

### 2. Test Cuts Changes

```bash
curl -X PUT http://localhost:3030/api/tasks/YOUR_TASK_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "cuts": [
      {
        "type": "VINYL",
        "quantity": 3,
        "fileId": "some-file-id",
        "origin": "PLAN"
      }
    ]
  }'
```

**Expected**: 1 changelog entry created for cuts

### 3. Verify Changelogs Created

```bash
curl http://localhost:3030/api/changelogs?entityType=Task&entityId=YOUR_TASK_ID
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "entityType": "Task",
      "entityId": "task-uuid",
      "action": "UPDATE",
      "field": "cuts",
      "oldValue": "[...]",
      "newValue": "[...]",
      "createdAt": "2025-10-06T...",
      "user": { "name": "User Name" }
    }
  ]
}
```

### 4. Check Frontend Display

1. Navigate to task detail page: `/producao/cronograma/detalhes/YOUR_TASK_ID`
2. Scroll to "Histórico de Alterações" section
3. Verify changes appear with correct labels in Portuguese

## Troubleshooting

### Changelogs not appearing?

1. **Check database**: Verify entries are being created
   ```sql
   SELECT * FROM "ChangeLog"
   WHERE "entityType" = 'Task'
   AND "entityId" = 'your-task-id'
   ORDER BY "createdAt" DESC;
   ```

2. **Check field names**: Ensure you're using correct field names (`cuts` not `cutRequest`)

3. **Check relations**: Verify you're including relations in before/after fetch:
   ```typescript
   include: {
     cuts: true,
     services: true,
     // ... all other relations
   }
   ```

4. **Check errors**: Look for error logs during changelog creation

### Performance concerns?

1. **Batch operations**: Use `createManyChangeLogs()` for multiple changes
2. **Async creation**: Don't await changelog creation if it's not critical:
   ```typescript
   // Fire and forget (non-blocking)
   taskChangelogService.trackTaskChanges({ ... }).catch(console.error);
   ```

3. **Selective tracking**: Only track important relations:
   ```typescript
   include: {
     cuts: shouldTrackCuts,
     services: shouldTrackServices,
     // conditional inclusion
   }
   ```

## Migration from Existing System

If you already have a changelog system:

### 1. Keep both systems temporarily

```typescript
// Track with both old and new systems
await oldChangelogService.track(changes);
await taskChangelogService.trackTaskChanges(options);
```

### 2. Migrate data

```typescript
// Script to migrate old changelogs to new format
async function migrateChangelogs() {
  const oldChangelogs = await fetchOldChangelogs();

  for (const old of oldChangelogs) {
    await changelogService.createChangeLog({
      entityType: old.entityType,
      entityId: old.entityId,
      action: old.action,
      field: mapOldFieldName(old.field), // Map old names to new
      oldValue: old.before,
      newValue: old.after,
      userId: old.userId,
    });
  }
}
```

### 3. Switch over

After testing, remove old changelog code and use new system exclusively.

## Advanced Features

### Custom Relation Handlers

Create custom handlers for specific relations:

```typescript
import { createArrayRelationHandler } from './utils/changelogHelpers';

const customCutsHandler = createArrayRelationHandler({
  fieldName: 'cuts',
  simplifyFields: ['type', 'quantity', 'fileId'],
  groupBy: 'type', // Groups cuts by type
});

const relationHandlers = {
  cuts: customCutsHandler,
  // Add more custom handlers
};

await changelogService.trackChanges({
  // ...
  relationHandlers,
});
```

### Metadata and Context

Add extra context to changelog entries:

```typescript
await changelogService.createChangeLog({
  entityType: 'Task',
  entityId: taskId,
  action: 'UPDATE',
  field: 'status',
  oldValue: 'PENDING',
  newValue: 'IN_PRODUCTION',
  userId,
  metadata: {
    source: 'mobile_app',
    previousAssignee: 'user-id',
    reason: 'Client requested urgent production',
    ipAddress: req.ip,
  },
});
```

### Rollback Support

Implement rollback functionality:

```typescript
async function rollbackChange(changelogId: string) {
  const changelog = await prisma.changeLog.findUnique({
    where: { id: changelogId },
  });

  if (!changelog) throw new Error('Changelog not found');

  // Parse old value
  const oldValue = JSON.parse(changelog.oldValue);

  // Apply rollback
  await prisma.task.update({
    where: { id: changelog.entityId },
    data: {
      [changelog.field]: oldValue,
    },
  });

  // Create rollback changelog entry
  await changelogService.createChangeLog({
    entityType: changelog.entityType,
    entityId: changelog.entityId,
    action: 'UPDATE',
    field: changelog.field,
    oldValue: changelog.newValue,
    newValue: changelog.oldValue,
    userId,
    metadata: {
      rollbackFrom: changelogId,
      reason: 'Rollback to previous value',
    },
  });
}
```

## Performance Optimization

### 1. Selective Tracking

Only track changes for important relations:

```typescript
const includeRelations = {
  cuts: updateData.cuts !== undefined,
  services: updateData.services !== undefined,
  // Only include what's being updated
};

const beforeTask = await prisma.task.findUnique({
  where: { id: taskId },
  include: includeRelations,
});
```

### 2. Background Processing

For high-volume applications, process changelogs in background:

```typescript
import { Queue } from 'bull'; // or any job queue

const changelogQueue = new Queue('changelog');

// Add to queue instead of processing immediately
changelogQueue.add({
  taskId,
  before: beforeTask,
  after: afterTask,
  userId,
});

// Process in worker
changelogQueue.process(async (job) => {
  await taskChangelogService.trackTaskChanges(job.data);
});
```

### 3. Batch Operations

Process multiple changes together:

```typescript
const entries = [];

for (const task of tasks) {
  // Collect all changes
  const changes = detectChanges(task.before, task.after);
  entries.push(...changes);
}

// Create all at once
await changelogService.createManyChangeLogs(entries);
```

## Support

For issues or questions:

1. Check this README
2. Review example implementation in `/examples/TaskService.example.ts`
3. Check frontend configuration in `/src/utils/changelog-fields.ts`
4. Review documentation files: `BACKEND_CHANGELOG_IMPLEMENTATION.md`, `BACKEND_CUTS_CHANGELOG_FIX.md`

## Summary

✅ **Complete changelog tracking** for ALL Task fields
✅ **Automatic change detection** - no manual field comparison needed
✅ **Complex relation support** - cuts, services, airbrushings, etc.
✅ **Frontend compatible** - field names match display expectations
✅ **Production ready** - error handling, transactions, batch operations
✅ **Type safe** - Full TypeScript support
✅ **Flexible** - Easy to customize and extend

The frontend is already configured and waiting for backend changelog entries. Simply integrate this implementation into your Task update service and changelogs will start appearing automatically in the task detail page!
