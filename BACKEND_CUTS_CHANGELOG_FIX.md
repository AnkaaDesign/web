# Backend: Track Cuts Changes in Changelog

## Problem

When editing a task and changing cuts (adding, removing, modifying), **no changelog entry is created** because the backend only tracks simple field changes, not nested relations.

## Current Behavior

✅ **Works**: Changing `status`, `price`, `name`, `details` → Changelog created
❌ **Doesn't Work**: Adding/removing/modifying cuts → No changelog created

## Why This Happens

Cuts is a **separate entity** with its own table:
```
┌──────────┐         ┌──────────┐
│  Task    │         │   Cut    │
│  id      │◄────────│  id      │
│  name    │         │  taskId  │
│  status  │         │  type    │
└──────────┘         │  fileId  │
                     │  quantity│
                     └──────────┘
```

When updating a task:
1. Task simple fields → Tracked automatically ✅
2. Cut entities created/updated/deleted → **NOT tracked** ❌

## Solution: Track Cuts in Task Changelog

### Frontend Already Configured

The frontend is ready to display cut changes:

**Field Label** (from `/src/utils/changelog-fields.ts` line 208-209):
```typescript
cutRequest: "Solicitações de Corte",
cutPlan: "Planos de Corte",
```

**Display Logic** (lines 837-842):
```typescript
if (field === "cutRequest") {
  return `${value.length} ${value.length === 1 ? "solicitação de corte" : "solicitações de corte"}`;
}
if (field === "cutPlan") {
  return `${value.length} ${value.length === 1 ? "plano de corte" : "planos de corte"}`;
}
```

### Backend Implementation Needed

#### Option 1: Track as Task Field Change (Recommended)

When task is updated with cuts data, create a **single changelog entry** for the entire cuts array:

```typescript
// Example: NestJS/Prisma
async updateTask(id: string, data: TaskUpdateDto, userId: string) {
  // Get current task with cuts
  const before = await this.prisma.task.findUnique({
    where: { id },
    include: { cuts: true },
  });

  // Extract cuts from update data
  const newCuts = data.cuts || [];
  const oldCuts = before.cuts || [];

  // Update task (this will create/update/delete cuts)
  const updated = await this.prisma.task.update({
    where: { id },
    data: {
      ...data,
      cuts: {
        deleteMany: {}, // Delete existing
        create: newCuts.map(cut => ({ // Create new
          type: cut.type,
          quantity: cut.quantity,
          fileId: cut.fileId,
          origin: cut.origin,
        })),
      },
    },
    include: { cuts: true },
  });

  // Check if cuts changed
  const cutsChanged = JSON.stringify(oldCuts) !== JSON.stringify(newCuts);

  if (cutsChanged) {
    // Create changelog for cuts field
    await this.prisma.changeLog.create({
      data: {
        entityType: 'Task',
        entityId: id,
        action: 'UPDATE',
        triggeredBy: 'USER',
        userId: userId,
        field: 'cuts',
        oldValue: JSON.stringify(oldCuts.map(c => ({
          type: c.type,
          quantity: 1, // Or actual quantity if stored
          fileId: c.fileId,
        }))),
        newValue: JSON.stringify(newCuts),
        description: `Recortes alterados de ${oldCuts.length} para ${newCuts.length}`,
        createdAt: new Date(),
      },
    });
  }

  return updated;
}
```

#### Option 2: Create Cut-Specific Changelogs

Create individual changelog entries for **each cut** that's created/updated/deleted:

```typescript
// When creating cuts
for (const cut of cutsToCreate) {
  await this.prisma.changeLog.create({
    data: {
      entityType: 'Cut',
      entityId: cut.id,
      action: 'CREATE',
      triggeredBy: 'USER',
      userId: userId,
      field: null,
      oldValue: null,
      newValue: JSON.stringify(cut),
      description: `Corte criado: ${cut.type}`,
      createdAt: new Date(),
    },
  });
}

// When deleting cuts
for (const cut of cutsToDelete) {
  await this.prisma.changeLog.create({
    data: {
      entityType: 'Cut',
      entityId: cut.id,
      action: 'DELETE',
      triggeredBy: 'USER',
      userId: userId,
      field: null,
      oldValue: JSON.stringify(cut),
      newValue: null,
      description: `Corte removido: ${cut.type}`,
      createdAt: new Date(),
    },
  });
}
```

**Note**: This approach creates many changelog entries. Better for detailed audit trails.

#### Option 3: Hybrid Approach (Best for UX)

Combine both:
1. Create **Task-level** changelog: "Recortes alterados"
2. Create **Cut-level** changelogs for each individual change

```typescript
async updateTaskCuts(taskId: string, newCuts: CutDto[], userId: string) {
  const before = await this.prisma.cut.findMany({ where: { taskId } });

  // Group current cuts by file and type
  const oldCutsGrouped = this.groupCuts(before);
  const newCutsGrouped = this.groupCuts(newCuts);

  // Compare and find differences
  const changes = this.detectCutChanges(oldCutsGrouped, newCutsGrouped);

  // Create Task-level summary changelog
  if (changes.length > 0) {
    await this.prisma.changeLog.create({
      data: {
        entityType: 'Task',
        entityId: taskId,
        action: 'UPDATE',
        field: 'cuts',
        oldValue: JSON.stringify(oldCutsGrouped),
        newValue: JSON.stringify(newCutsGrouped),
        description: `${changes.length} alterações nos recortes`,
        userId,
        triggeredBy: 'USER',
        createdAt: new Date(),
      },
    });
  }

  // Optionally: Create individual Cut changelogs
  for (const change of changes) {
    await this.createCutChangeLog(change, userId);
  }

  // Actually update the cuts
  await this.applyCutChanges(taskId, newCuts);
}

private groupCuts(cuts: Cut[]) {
  // Group cuts by fileId and type to match frontend display
  const grouped = new Map();

  for (const cut of cuts) {
    const key = `${cut.fileId || 'no-file'}|${cut.type}`;
    if (grouped.has(key)) {
      grouped.get(key).quantity += 1;
    } else {
      grouped.set(key, {
        fileId: cut.fileId,
        type: cut.type,
        quantity: 1,
      });
    }
  }

  return Array.from(grouped.values());
}
```

## Recommended Implementation

**Use Option 1** (Task-level changelog) because:
✅ Simple to implement
✅ Matches how frontend sends data
✅ Provides clear audit trail
✅ Frontend already configured to display it

**Implementation Steps**:

1. **In your Task update service/controller**:
   - Before updating: Get current cuts
   - After updating: Get new cuts
   - Compare: Detect if cuts changed
   - If changed: Create changelog entry with field="cuts"

2. **Store both old and new values as JSON**:
   ```json
   {
     "oldValue": "[{\"type\":\"VINYL\",\"quantity\":2,\"fileId\":\"xxx\"}]",
     "newValue": "[{\"type\":\"VINYL\",\"quantity\":3,\"fileId\":\"yyy\"}]"
   }
   ```

3. **Frontend will automatically**:
   - Fetch the changelog
   - Display "Recortes alterados"
   - Show old vs new values formatted

## Testing

### 1. Update Task with Cut Changes

```bash
PATCH /api/tasks/:id
{
  "cuts": [
    {
      "type": "VINYL",
      "quantity": 3,
      "fileId": "file-uuid",
      "origin": "PLAN"
    }
  ]
}
```

### 2. Verify Changelog Created

```bash
GET /api/changelogs?entityType=Task&entityId=:id
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "entityType": "Task",
      "entityId": "task-uuid",
      "action": "UPDATE",
      "field": "cuts",
      "oldValue": "[{\"type\":\"VINYL\",\"quantity\":2,...}]",
      "newValue": "[{\"type\":\"VINYL\",\"quantity\":3,...}]",
      "description": "Recortes alterados de 2 para 3",
      "createdAt": "2025-10-06T...",
      "user": {
        "name": "João Silva"
      }
    }
  ]
}
```

### 3. Check Frontend Display

Navigate to task detail page → Scroll to "Histórico de Alterações"

**Expected Display**:
```
┌─────────────────────────────────────┐
│ 📝 Recortes alterados               │
│ João Silva • há 2 minutos           │
│                                     │
│ De: 2 planos de corte               │
│ Para: 3 planos de corte             │
└─────────────────────────────────────┘
```

## Same Issue Likely Affects

This same problem probably affects:
- ❌ `services` (Service orders)
- ❌ `airbrushings` (Airbrushing work)
- ❌ `logoPaints` (Logo paints)
- ❌ `artworks` (Artwork files)

**All nested relations need similar fixes** if you want them tracked in changelog.

## Summary

**Current State**:
- ✅ Frontend ready to display cuts changes
- ❌ Backend not creating cuts changelogs

**Fix Required**:
- Backend must create changelog entry when cuts array changes
- Field name: `"cuts"`
- Store old/new values as JSON
- Frontend will handle the rest automatically

**Priority**: Medium-High (affects audit trail completeness)
