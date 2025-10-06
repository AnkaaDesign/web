# Backend Changelog Implementation Guide

## Overview

The changelog system is **backend-driven**. The frontend only displays changelogs in Portuguese using pre-built components.

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│   Database   │
│  (Display)  │◀─────│  (Create)   │◀─────│ (ChangeLog)  │
└─────────────┘      └─────────────┘      └──────────────┘
```

**Frontend Responsibility**: Display changelogs in Portuguese
**Backend Responsibility**: Create changelog entries automatically

## Current Frontend Implementation

### Display Component

**File**: `/src/components/ui/changelog-history.tsx`

```tsx
import { ChangelogHistory } from "@/components/ui/changelog-history";

// Usage in task detail page
<ChangelogHistory
  entityType={CHANGE_LOG_ENTITY_TYPE.TASK}
  entityId={taskId}
  entityName={task.name}
  maxHeight="600px"
  limit={50}
/>
```

### How It Works

1. **Fetches changelogs** from backend using `useChangeLogs` hook
2. **Displays in Portuguese** using utility functions:
   - `getFieldLabel()` - Translates field names to Portuguese
   - `formatFieldValue()` - Formats values (dates, currency, status labels)
   - `getActionLabel()` - Translates actions (CREATE, UPDATE, DELETE)

3. **Auto-formatting** from `/src/utils/changelog-fields.ts`:
```typescript
// Task fields are already mapped to Portuguese (lines 165-227)
{
  name: "Nome",
  status: "Status",
  serialNumber: "Número de Série",
  plate: "Placa",
  details: "Detalhes",
  entryDate: "Data de Entrada",
  term: "Prazo",
  price: "Preço",
  budgetId: "Orçamento",
  nfeId: "Nota Fiscal",
  receiptId: "Recibo",
  customerId: "Cliente",
  sectorId: "Setor",
  // ... and many more
}
```

## Backend Implementation Required

### 1. Database Schema

Your backend should have a `ChangeLog` table with:

```sql
CREATE TABLE change_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR NOT NULL,  -- 'Task', 'Order', 'User', etc.
  entity_id UUID NOT NULL,        -- ID of the entity that changed
  action VARCHAR NOT NULL,        -- 'CREATE', 'UPDATE', 'DELETE', etc.
  triggered_by VARCHAR,           -- 'USER', 'SYSTEM', 'BATCH_OPERATION', etc.
  user_id UUID,                   -- User who made the change
  field VARCHAR,                  -- Field name that changed (for UPDATE)
  old_value TEXT,                 -- Previous value (JSON string)
  new_value TEXT,                 -- New value (JSON string)
  description TEXT,               -- Optional description
  metadata JSONB,                 -- Additional context
  created_at TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_changelogs_entity ON change_logs(entity_type, entity_id);
CREATE INDEX idx_changelogs_created_at ON change_logs(created_at DESC);
```

### 2. Automatic Changelog Creation

The backend should automatically create changelog entries when tasks are updated.

#### Option A: ORM/Framework Middleware

**Example with Prisma (Node.js)**:

```typescript
// prisma/middleware.ts
async function createChangeLog(model: string, action: string, data: any, userId?: string) {
  // Detect changed fields
  const changedFields = detectChanges(data);

  for (const [field, { oldValue, newValue }] of Object.entries(changedFields)) {
    await prisma.changeLog.create({
      data: {
        entityType: model,
        entityId: data.id,
        action: 'UPDATE',
        triggeredBy: userId ? 'USER' : 'SYSTEM',
        userId: userId,
        field: field,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        description: `Campo "${field}" alterado`,
        createdAt: new Date(),
      },
    });
  }
}

// Apply middleware
prisma.$use(async (params, next) => {
  if (params.action === 'update' && params.model === 'Task') {
    const before = await prisma.task.findUnique({ where: params.args.where });
    const result = await next(params);
    const after = await prisma.task.findUnique({ where: params.args.where });

    await createChangeLog('Task', 'UPDATE', { before, after }, params.userId);
    return result;
  }
  return next(params);
});
```

#### Option B: Service Layer

**Example with NestJS (Node.js)**:

```typescript
// task.service.ts
@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changelogService: ChangelogService,
  ) {}

  async update(id: string, updateData: Partial<Task>, userId: string) {
    // Get current state
    const before = await this.prisma.task.findUnique({ where: { id } });

    // Update task
    const after = await this.prisma.task.update({
      where: { id },
      data: updateData,
    });

    // Create changelog entries
    await this.changelogService.trackChanges({
      entityType: 'Task',
      entityId: id,
      before,
      after,
      userId,
    });

    return after;
  }
}

// changelog.service.ts
@Injectable()
export class ChangelogService {
  async trackChanges({ entityType, entityId, before, after, userId }) {
    const changes = this.detectChanges(before, after);

    const changelogEntries = changes.map(({ field, oldValue, newValue }) => ({
      entityType,
      entityId,
      action: 'UPDATE',
      triggeredBy: 'USER',
      userId,
      field,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      description: `Campo "${field}" alterado`,
      createdAt: new Date(),
    }));

    await this.prisma.changeLog.createMany({
      data: changelogEntries,
    });
  }

  private detectChanges(before: any, after: any) {
    const changes = [];

    for (const key in after) {
      if (before[key] !== after[key]) {
        changes.push({
          field: key,
          oldValue: before[key],
          newValue: after[key],
        });
      }
    }

    return changes;
  }
}
```

#### Option C: Database Triggers (PostgreSQL)

```sql
-- Create audit function
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if values actually changed
  IF OLD IS DISTINCT FROM NEW THEN
    -- Insert changelog entry for each changed field
    -- (This is simplified - in practice you'd iterate through columns)

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO change_logs (
        id, entity_type, entity_id, action, field,
        old_value, new_value, created_at
      ) VALUES (
        gen_random_uuid(),
        'Task',
        NEW.id,
        'UPDATE',
        'status',
        to_jsonb(OLD.status),
        to_jsonb(NEW.status),
        NOW()
      );
    END IF;

    -- Repeat for other important fields...
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tasks table
CREATE TRIGGER task_changelog_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();
```

### 3. API Endpoint

The backend should provide an endpoint to fetch changelogs:

```typescript
// GET /api/changelogs?entityType=Task&entityId=xxx
@Get()
async getChangeLogs(
  @Query('entityType') entityType: string,
  @Query('entityId') entityId: string,
  @Query('page') page = 1,
  @Query('take') take = 20,
) {
  const changelogs = await this.prisma.changeLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: (page - 1) * take,
    take,
  });

  return {
    success: true,
    data: changelogs,
    meta: {
      page,
      take,
      totalRecords: await this.prisma.changeLog.count({ where: { entityType, entityId } }),
    },
  };
}
```

## What Frontend Already Handles

✅ **Fetching changelogs** from backend API
✅ **Displaying in Portuguese** with translated field names
✅ **Formatting values** (dates, currency, status labels, etc.)
✅ **Timeline UI** with icons and colors
✅ **User information** (who made the change)
✅ **Relative time** ("2 hours ago", "yesterday")
✅ **Loading states** and error handling

## What Frontend SHOULD NOT Do

❌ Creating changelog entries
❌ Tracking field changes
❌ Detecting what changed
❌ Storing audit data

## Example Changelog Flow

### When Task Status Changes from "PENDING" to "IN_PRODUCTION":

**Backend Creates**:
```json
{
  "id": "uuid-xxx",
  "entityType": "Task",
  "entityId": "task-uuid",
  "action": "UPDATE",
  "triggeredBy": "USER",
  "userId": "user-uuid",
  "field": "status",
  "oldValue": "\"PENDING\"",
  "newValue": "\"IN_PRODUCTION\"",
  "description": "Campo \"status\" alterado",
  "createdAt": "2025-10-06T15:30:00Z"
}
```

**Frontend Displays**:
```
┌─────────────────────────────────────┐
│ 📝 Status                           │
│ João Silva • há 2 horas             │
│                                     │
│ De: Pendente                        │
│ Para: Em Produção                   │
└─────────────────────────────────────┘
```

## Field Name Translations

The frontend automatically translates field names using `/src/utils/changelog-fields.ts`.

**Already configured for Task** (lines 165-227):
- `name` → "Nome"
- `status` → "Status" (with value translation: PENDING → "Pendente")
- `serialNumber` → "Número de Série"
- `plate` → "Placa"
- `details` → "Detalhes"
- `entryDate` → "Data de Entrada"
- `term` → "Prazo"
- `price` → "Preço" (formatted as currency)
- `budgetId` → "Orçamento"
- `nfeId` → "Nota Fiscal"
- `receiptId` → "Recibo"
- `customerId` → "Cliente"
- `sectorId` → "Setor"
- `services` → "Serviços"
- `cuts` → "Planos de Corte"
- `airbrushings` → "Aerografias"
- And many more...

## Testing Backend Implementation

### 1. Update a Task

```bash
PATCH /api/tasks/:id
{
  "status": "IN_PRODUCTION",
  "details": "Updated details"
}
```

### 2. Verify Changelogs Created

```bash
GET /api/changelogs?entityType=Task&entityId=:id
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
      "field": "status",
      "oldValue": "\"PENDING\"",
      "newValue": "\"IN_PRODUCTION\"",
      "createdAt": "2025-10-06T15:30:00Z",
      "user": {
        "name": "João Silva"
      }
    },
    {
      "id": "uuid-2",
      "entityType": "Task",
      "entityId": "task-uuid",
      "action": "UPDATE",
      "field": "details",
      "oldValue": "null",
      "newValue": "\"Updated details\"",
      "createdAt": "2025-10-06T15:30:00Z",
      "user": {
        "name": "João Silva"
      }
    }
  ],
  "meta": {
    "page": 1,
    "take": 20,
    "totalRecords": 2
  }
}
```

### 3. Check Frontend Display

Navigate to `/producao/cronograma/detalhes/:id` and verify:
- Changelog section displays automatically
- Field names are in Portuguese
- Values are properly formatted
- Timeline shows changes chronologically

## Conclusion

**The frontend is ready.** You only need to:

1. ✅ Implement backend changelog creation on task updates
2. ✅ Ensure API endpoint returns changelogs in the expected format
3. ✅ Test by updating a task and checking the detail page

The frontend will automatically:
- Fetch changelogs from `/api/changelogs`
- Display field names in Portuguese
- Format values appropriately
- Show a beautiful timeline UI

**No frontend changes needed** - the `ChangelogHistory` component already handles everything.
