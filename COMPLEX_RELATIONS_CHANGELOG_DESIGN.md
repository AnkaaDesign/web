# Comprehensive Solution for Tracking Complex Relation Changes in Changelogs

## Executive Summary

This document provides a complete design for tracking complex relation changes (cuts, services, airbrushings, etc.) in the changelog system. The frontend is already fully configured to display these changes - **only backend implementation is required**.

---

## 1. Complete List of Complex Relations on Task

Based on analysis of `/src/types/task.ts` and `/src/schemas/task.ts`:

### One-to-Many Relations (Arrays)
| Relation | Type | Field Name | Status |
|----------|------|------------|--------|
| **cuts** | `Cut[]` | `cuts` | ❌ Not tracked |
| **services** | `ServiceOrder[]` | `services` | ❌ Not tracked |
| **airbrushings** | `Airbrushing[]` | `airbrushings` | ❌ Not tracked |
| **artworks** | `File[]` | `artworks` | ❌ Not tracked |
| **logoPaints** | `Paint[]` | `logoPaints` (alias: `paints`) | ❌ Not tracked |
| **relatedTasks** | `Task[]` | `relatedTasks` | ❌ Not tracked |
| **relatedTo** | `Task[]` | `relatedTo` | ❌ Not tracked |

### One-to-One Relations
| Relation | Type | Field Name | Status |
|----------|------|------------|--------|
| **observation** | `Observation` | `observation` | ⚠️ Needs verification |
| **truck** | `Truck` | `truck` | ⚠️ Needs verification |

### Simple Foreign Keys (Already Tracked)
| Relation | Type | Field Name | Status |
|----------|------|------------|--------|
| **sector** | `Sector` | `sectorId` | ✅ Already tracked |
| **customer** | `Customer` | `customerId` | ✅ Already tracked |
| **budget** | `File` | `budgetId` | ✅ Already tracked |
| **nfe** | `File` | `nfeId` | ✅ Already tracked |
| **receipt** | `File` | `receiptId` | ✅ Already tracked |
| **generalPainting** | `Paint` | `paintId` | ✅ Already tracked |
| **createdBy** | `User` | `createdById` | ✅ Already tracked |

---

## 2. Frontend Configuration Status

### ✅ Already Configured in `/src/utils/changelog-fields.ts`

Lines 202-212 show the frontend is **100% ready**:

```typescript
artworks: "Artes",
logoPaints: "Tintas do Logo",
paints: "Tintas do Logo",
commissions: "Comissões",
services: "Serviços",
airbrushings: "Aerografias",
cuts: "Recortes",
cutRequest: "Solicitações de Corte",
cutPlan: "Planos de Corte",
relatedTasks: "Tarefas Relacionadas",
relatedTo: "Relacionado a",
```

### ✅ Display Logic Already Implemented

Lines 822-846 show automatic array formatting:

```typescript
if (field === "artworks") {
  return `${value.length} ${value.length === 1 ? "arte" : "artes"}`;
}
if (field === "logoPaints" || field === "paints") {
  return `${value.length} ${value.length === 1 ? "tinta" : "tintas"}`;
}
if (field === "services") {
  return `${value.length} ${value.length === 1 ? "serviço" : "serviços"}`;
}
if (field === "airbrushings") {
  return `${value.length} ${value.length === 1 ? "aerografia" : "aerografias"}`;
}
if (field === "cuts" || field === "cutRequest" || field === "cutPlan") {
  return `${value.length} ${value.length === 1 ? "recorte" : "recortes"}`;
}
if (field === "relatedTasks" || field === "relatedTo") {
  return `${value.length} ${value.length === 1 ? "tarefa relacionada" : "tarefas relacionadas"}`;
}
```

**Conclusion**: Frontend needs **ZERO changes**. All display logic is ready.

---

## 3. Relation-Specific Tracking Strategies

### 3.1 Cuts (Most Complex)

**Schema** (from `/src/types/cut.ts`):
```typescript
interface Cut {
  id: string;
  fileId: string;        // Which file/artwork
  type: CUT_TYPE;        // VINYL | STENCIL
  status: CUT_STATUS;    // PENDING | CUTTING | COMPLETED
  origin: CUT_ORIGIN;    // PLAN | REQUEST
  reason?: string;       // For recuts: WRONG_APPLY | LOST | WRONG
  taskId?: string;
  parentCutId?: string;  // For recuts
}
```

**Tracking Strategy**:

1. **Fetch Current State**:
```typescript
const currentCuts = await prisma.cut.findMany({
  where: { taskId },
  include: { file: { select: { filename: true } } }
});
```

2. **Group by File + Type** (matches frontend display):
```typescript
function groupCuts(cuts: Cut[]): CutGroup[] {
  const groups = new Map<string, CutGroup>();

  for (const cut of cuts) {
    const key = `${cut.fileId}|${cut.type}`;
    if (groups.has(key)) {
      groups.get(key)!.quantity++;
    } else {
      groups.set(key, {
        fileId: cut.fileId,
        fileName: cut.file?.filename,
        type: cut.type,
        quantity: 1,
        origin: cut.origin,
      });
    }
  }

  return Array.from(groups.values());
}
```

3. **Detect Changes**:
```typescript
function detectCutChanges(oldGroups: CutGroup[], newGroups: CutGroup[]) {
  const changes = {
    added: [],
    removed: [],
    quantityChanged: [],
  };

  // Compare old vs new
  const oldMap = new Map(oldGroups.map(g => [`${g.fileId}|${g.type}`, g]));
  const newMap = new Map(newGroups.map(g => [`${g.fileId}|${g.type}`, g]));

  // Find added
  for (const [key, newGroup] of newMap) {
    const oldGroup = oldMap.get(key);
    if (!oldGroup) {
      changes.added.push(newGroup);
    } else if (oldGroup.quantity !== newGroup.quantity) {
      changes.quantityChanged.push({
        ...newGroup,
        oldQuantity: oldGroup.quantity,
      });
    }
  }

  // Find removed
  for (const [key, oldGroup] of oldMap) {
    if (!newMap.has(key)) {
      changes.removed.push(oldGroup);
    }
  }

  return changes;
}
```

4. **Serialize for Changelog**:
```typescript
const oldValue = JSON.stringify(oldGroups.map(g => ({
  fileId: g.fileId,
  fileName: g.fileName,
  type: g.type,
  quantity: g.quantity,
  origin: g.origin,
})));

const newValue = JSON.stringify(newGroups.map(g => ({
  fileId: g.fileId,
  fileName: g.fileName,
  type: g.type,
  quantity: g.quantity,
  origin: g.origin,
})));
```

5. **Create Changelog Entry**:
```typescript
await prisma.changeLog.create({
  data: {
    entityType: 'Task',
    entityId: taskId,
    action: 'UPDATE',
    triggeredBy: 'USER',
    userId,
    field: 'cuts',
    oldValue,
    newValue,
    description: `${newGroups.length} recortes (${changes.added.length} novos, ${changes.removed.length} removidos)`,
    createdAt: new Date(),
  },
});
```

---

### 3.2 Services (ServiceOrder)

**Schema** (from `/src/types/serviceOrder.ts`):
```typescript
interface ServiceOrder {
  id: string;
  status: SERVICE_ORDER_STATUS;
  description: string;
  taskId: string;
  startedAt: Date | null;
  finishedAt: Date | null;
}
```

**Tracking Strategy**:

1. **Fetch Current State**:
```typescript
const currentServices = await prisma.serviceOrder.findMany({
  where: { taskId },
  orderBy: { createdAt: 'asc' }
});
```

2. **Detect Changes**:
```typescript
function detectServiceChanges(oldServices: ServiceOrder[], newServices: ServiceOrder[]) {
  return {
    added: newServices.filter(ns => !oldServices.find(os => os.id === ns.id)),
    removed: oldServices.filter(os => !newServices.find(ns => ns.id === os.id)),
    modified: newServices.filter(ns => {
      const old = oldServices.find(os => os.id === ns.id);
      return old && (
        old.description !== ns.description ||
        old.status !== ns.status
      );
    }),
  };
}
```

3. **Serialize**:
```typescript
const oldValue = JSON.stringify(oldServices.map(s => ({
  id: s.id,
  description: s.description,
  status: s.status,
})));

const newValue = JSON.stringify(newServices.map(s => ({
  id: s.id,
  description: s.description,
  status: s.status,
})));
```

---

### 3.3 Airbrushings

**Schema** (from `/src/types/airbrushing.ts`):
```typescript
interface Airbrushing {
  id: string;
  startDate: Date | null;
  finishDate: Date | null;
  price: number | null;
  status: AIRBRUSHING_STATUS;
  taskId: string;
}
```

**Tracking Strategy**:

1. **Simple count-based tracking** (since airbrushings are typically added/removed, not modified):
```typescript
const oldCount = currentAirbrushings.length;
const newCount = newAirbrushings.length;

if (oldCount !== newCount) {
  await prisma.changeLog.create({
    data: {
      entityType: 'Task',
      entityId: taskId,
      action: 'UPDATE',
      field: 'airbrushings',
      oldValue: JSON.stringify(oldCount),
      newValue: JSON.stringify(newCount),
      description: `Aerografias alteradas de ${oldCount} para ${newCount}`,
    },
  });
}
```

2. **Detailed tracking** (if needed):
```typescript
const oldValue = JSON.stringify(oldAirbrushings.map(a => ({
  id: a.id,
  status: a.status,
  price: a.price,
})));

const newValue = JSON.stringify(newAirbrushings.map(a => ({
  id: a.id,
  status: a.status,
  price: a.price,
})));
```

---

### 3.4 Logo Paints (Many-to-Many)

**Schema** (from `/src/types/paint.ts`):
```typescript
interface Paint {
  id: string;
  name: string;
  code: string | null;
  hex: string;
  finish: PAINT_FINISH;
}
```

**Tracking Strategy**:

1. **Fetch Current State**:
```typescript
const currentPaints = await prisma.task.findUnique({
  where: { id: taskId },
  select: {
    logoPaints: {
      select: { id: true, name: true, hex: true }
    }
  }
}).then(t => t?.logoPaints || []);
```

2. **Detect Changes**:
```typescript
function detectPaintChanges(oldPaints: Paint[], newPaints: Paint[]) {
  const oldIds = new Set(oldPaints.map(p => p.id));
  const newIds = new Set(newPaints.map(p => p.id));

  return {
    added: newPaints.filter(p => !oldIds.has(p.id)),
    removed: oldPaints.filter(p => !newIds.has(p.id)),
  };
}
```

3. **Serialize**:
```typescript
const oldValue = JSON.stringify(oldPaints.map(p => ({
  id: p.id,
  name: p.name,
  hex: p.hex,
})));

const newValue = JSON.stringify(newPaints.map(p => ({
  id: p.id,
  name: p.name,
  hex: p.hex,
})));
```

---

### 3.5 Artworks (File Array)

**Schema** (from `/src/types/file.ts`):
```typescript
interface File {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
}
```

**Tracking Strategy**:

1. **Fetch Current State**:
```typescript
const currentArtworks = await prisma.task.findUnique({
  where: { id: taskId },
  select: {
    artworks: {
      select: { id: true, filename: true, originalName: true }
    }
  }
}).then(t => t?.artworks || []);
```

2. **Detect Changes**:
```typescript
function detectArtworkChanges(oldArtworks: File[], newArtworks: File[]) {
  const oldIds = new Set(oldArtworks.map(f => f.id));
  const newIds = new Set(newArtworks.map(f => f.id));

  return {
    added: newArtworks.filter(f => !oldIds.has(f.id)),
    removed: oldArtworks.filter(f => !newIds.has(f.id)),
  };
}
```

3. **Serialize**:
```typescript
const oldValue = JSON.stringify(oldArtworks.map(f => ({
  id: f.id,
  filename: f.filename,
  originalName: f.originalName,
})));

const newValue = JSON.stringify(newArtworks.map(f => ({
  id: f.id,
  filename: f.filename,
  originalName: f.originalName,
})));
```

---

### 3.6 Related Tasks (Self-Referencing)

**Tracking Strategy**:

1. **Fetch Current State**:
```typescript
const currentRelated = await prisma.task.findUnique({
  where: { id: taskId },
  select: {
    relatedTasks: {
      select: { id: true, name: true, serialNumber: true }
    }
  }
}).then(t => t?.relatedTasks || []);
```

2. **Simple ID-based comparison**:
```typescript
const oldIds = currentRelated.map(t => t.id).sort();
const newIds = newRelated.map(t => t.id).sort();

if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
  await prisma.changeLog.create({
    data: {
      entityType: 'Task',
      entityId: taskId,
      action: 'UPDATE',
      field: 'relatedTasks',
      oldValue: JSON.stringify(currentRelated.map(t => ({
        id: t.id,
        name: t.name,
        serialNumber: t.serialNumber,
      }))),
      newValue: JSON.stringify(newRelated.map(t => ({
        id: t.id,
        name: t.name,
        serialNumber: t.serialNumber,
      }))),
      description: `Tarefas relacionadas alteradas`,
    },
  });
}
```

---

## 4. Two-Level Tracking Design

### Level 1: Task-Level Summary (Recommended)

**Purpose**: High-level audit trail showing that relations changed

**Implementation**:
```typescript
// Create ONE changelog entry per relation type
await prisma.changeLog.create({
  data: {
    entityType: 'Task',
    entityId: taskId,
    action: 'UPDATE',
    triggeredBy: 'USER',
    userId,
    field: 'cuts',
    oldValue: JSON.stringify(oldCutGroups),
    newValue: JSON.stringify(newCutGroups),
    description: `3 recortes alterados (1 novo, 1 removido, 1 modificado)`,
    createdAt: new Date(),
  },
});
```

**Frontend Display**:
```
┌─────────────────────────────────────┐
│ 📝 Recortes                         │
│ João Silva • há 2 minutos           │
│                                     │
│ De: 2 recortes                      │
│ Para: 3 recortes                    │
└─────────────────────────────────────┘
```

---

### Level 2: Entity-Level Details (Optional)

**Purpose**: Granular tracking of each cut/service/airbrushing individually

**Implementation**:
```typescript
// Create individual changelogs for each cut created/updated/deleted
for (const addedCut of changes.added) {
  await prisma.changeLog.create({
    data: {
      entityType: 'Cut',
      entityId: addedCut.id,
      action: 'CREATE',
      triggeredBy: 'USER',
      userId,
      field: null,
      oldValue: null,
      newValue: JSON.stringify(addedCut),
      description: `Corte criado: ${addedCut.type} - ${addedCut.file.filename}`,
      metadata: {
        taskId,
        taskName: task.name,
      },
    },
  });
}
```

**When to Use**:
- ✅ Use Level 1 for **Task detail page** (cleaner, focuses on task changes)
- ✅ Use Level 2 for **Cut detail page** (shows all cut-specific history)
- ✅ Use Level 2 for **Global changelog page** (admin audit trail)

---

## 5. Handling Cascading Operations

### 5.1 Create Task with Cuts in Same Transaction

**Problem**: Cuts are created AFTER task, so initial state has no cuts

**Solution**: Skip changelog for initial creation
```typescript
async function createTaskWithCuts(data: TaskCreateDto, userId: string) {
  return await prisma.$transaction(async (tx) => {
    // Create task
    const task = await tx.task.create({ data });

    // Create cuts
    const cuts = await tx.cut.createMany({
      data: data.cuts.map(c => ({ ...c, taskId: task.id }))
    });

    // DON'T create changelog for initial cuts
    // Only track changes on UPDATE, not CREATE

    return task;
  });
}
```

---

### 5.2 Delete Task with Cascade

**Problem**: Related entities are deleted automatically

**Solution**: Capture state BEFORE delete
```typescript
async function deleteTask(taskId: string, userId: string) {
  // Fetch full state before deletion
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      cuts: true,
      services: true,
      airbrushings: true,
    },
  });

  // Create deletion changelog
  await prisma.changeLog.create({
    data: {
      entityType: 'Task',
      entityId: taskId,
      action: 'DELETE',
      triggeredBy: 'USER',
      userId,
      field: null,
      oldValue: JSON.stringify({
        task,
        cutsCount: task.cuts.length,
        servicesCount: task.services.length,
        airbrushingsCount: task.airbrushings.length,
      }),
      newValue: null,
      description: `Tarefa deletada com ${task.cuts.length} recortes, ${task.services.length} serviços`,
    },
  });

  // Delete task (cascade will handle relations)
  await prisma.task.delete({ where: { id: taskId } });
}
```

---

### 5.3 Update with deleteMany + create Pattern

**Problem**: Common pattern is to delete all related entities and recreate them

**Current Implementation** (from task schemas):
```typescript
// Common pattern in updates:
data: {
  cuts: {
    deleteMany: {},      // Delete all existing cuts
    create: newCuts,     // Create new cuts
  }
}
```

**Solution**: Track before and after state
```typescript
async function updateTaskCuts(taskId: string, newCuts: CutDto[], userId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch current state
    const currentCuts = await tx.cut.findMany({
      where: { taskId },
      include: { file: true },
    });

    // 2. Group and detect changes
    const oldGroups = groupCuts(currentCuts);
    const newGroups = groupCuts(newCuts.map(c => ({ ...c, taskId })));
    const changes = detectCutChanges(oldGroups, newGroups);

    // 3. Apply changes
    await tx.cut.deleteMany({ where: { taskId } });
    await tx.cut.createMany({
      data: newCuts.map(c => ({ ...c, taskId }))
    });

    // 4. Create changelog (if changed)
    if (changes.added.length > 0 || changes.removed.length > 0 || changes.quantityChanged.length > 0) {
      await tx.changeLog.create({
        data: {
          entityType: 'Task',
          entityId: taskId,
          action: 'UPDATE',
          triggeredBy: 'USER',
          userId,
          field: 'cuts',
          oldValue: JSON.stringify(oldGroups),
          newValue: JSON.stringify(newGroups),
          description: `${newGroups.length} recortes (${changes.added.length} novos, ${changes.removed.length} removidos)`,
        },
      });
    }
  });
}
```

---

## 6. Change Detection Algorithm

### Generic Array Comparison Algorithm

```typescript
interface ChangeDetectionResult<T> {
  added: T[];
  removed: T[];
  modified: Array<{ old: T; new: T }>;
}

function detectArrayChanges<T extends { id: string }>(
  oldArray: T[],
  newArray: T[],
  compareFields?: (keyof T)[]
): ChangeDetectionResult<T> {
  const oldMap = new Map(oldArray.map(item => [item.id, item]));
  const newMap = new Map(newArray.map(item => [item.id, item]));

  const result: ChangeDetectionResult<T> = {
    added: [],
    removed: [],
    modified: [],
  };

  // Find added and modified
  for (const [id, newItem] of newMap) {
    const oldItem = oldMap.get(id);

    if (!oldItem) {
      result.added.push(newItem);
    } else if (compareFields) {
      // Check if specified fields changed
      const hasChanges = compareFields.some(
        field => oldItem[field] !== newItem[field]
      );
      if (hasChanges) {
        result.modified.push({ old: oldItem, new: newItem });
      }
    } else {
      // Deep comparison
      if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        result.modified.push({ old: oldItem, new: newItem });
      }
    }
  }

  // Find removed
  for (const [id, oldItem] of oldMap) {
    if (!newMap.has(id)) {
      result.removed.push(oldItem);
    }
  }

  return result;
}

// Usage:
const changes = detectArrayChanges(
  currentServices,
  newServices,
  ['description', 'status'] // Only track these fields
);
```

---

## 7. Grouping and Serialization Format

### Cuts Grouping (Complex Example)

```typescript
interface CutGroup {
  fileId: string;
  fileName: string;
  type: CUT_TYPE;
  origin: CUT_ORIGIN;
  quantity: number;
}

function groupCuts(cuts: Cut[]): CutGroup[] {
  const groups = new Map<string, CutGroup>();

  for (const cut of cuts) {
    const key = `${cut.fileId}|${cut.type}`;

    if (groups.has(key)) {
      groups.get(key)!.quantity++;
    } else {
      groups.set(key, {
        fileId: cut.fileId,
        fileName: cut.file?.filename || 'Unknown',
        type: cut.type,
        origin: cut.origin,
        quantity: 1,
      });
    }
  }

  return Array.from(groups.values());
}

// Serialization for changelog:
const oldValue = JSON.stringify(oldGroups);
const newValue = JSON.stringify(newGroups);

// Example serialized value:
// [
//   { fileId: "uuid-1", fileName: "logo.svg", type: "VINYL", origin: "PLAN", quantity: 2 },
//   { fileId: "uuid-2", fileName: "text.svg", type: "STENCIL", origin: "REQUEST", quantity: 1 }
// ]
```

### Services Serialization (Simple Example)

```typescript
function serializeServices(services: ServiceOrder[]) {
  return JSON.stringify(services.map(s => ({
    id: s.id,
    description: s.description,
    status: s.status,
    startedAt: s.startedAt?.toISOString(),
    finishedAt: s.finishedAt?.toISOString(),
  })));
}

// Example serialized value:
// [
//   { id: "uuid-1", description: "Pintura", status: "PENDING", startedAt: null, finishedAt: null },
//   { id: "uuid-2", description: "Polimento", status: "COMPLETED", startedAt: "2025-10-05T...", finishedAt: "2025-10-06T..." }
// ]
```

---

## 8. Implementation Pseudocode

### Complete Task Update with Changelog Tracking

```typescript
@Injectable()
export class TaskService {
  async update(
    taskId: string,
    updateData: TaskUpdateDto,
    userId: string
  ): Promise<Task> {
    return await this.prisma.$transaction(async (tx) => {
      // === 1. FETCH CURRENT STATE ===
      const currentTask = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          cuts: { include: { file: true } },
          services: true,
          airbrushings: true,
          artworks: true,
          logoPaints: true,
          relatedTasks: true,
        },
      });

      if (!currentTask) throw new NotFoundException('Task not found');

      // === 2. APPLY SIMPLE FIELD UPDATES ===
      const simpleFieldChanges = this.detectSimpleFieldChanges(
        currentTask,
        updateData
      );

      // === 3. UPDATE TASK ===
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          // Simple fields
          ...updateData,

          // Complex relations (if provided)
          ...(updateData.cuts && {
            cuts: {
              deleteMany: {},
              create: updateData.cuts,
            },
          }),
          ...(updateData.services && {
            services: {
              deleteMany: {},
              create: updateData.services,
            },
          }),
          ...(updateData.airbrushings && {
            airbrushings: {
              deleteMany: {},
              create: updateData.airbrushings,
            },
          }),
          ...(updateData.artworkIds && {
            artworks: {
              set: updateData.artworkIds.map(id => ({ id })),
            },
          }),
          ...(updateData.paintIds && {
            logoPaints: {
              set: updateData.paintIds.map(id => ({ id })),
            },
          }),
        },
        include: {
          cuts: { include: { file: true } },
          services: true,
          airbrushings: true,
          artworks: true,
          logoPaints: true,
        },
      });

      // === 4. CREATE CHANGELOGS ===
      const changelogEntries = [];

      // 4a. Simple field changes
      for (const { field, oldValue, newValue } of simpleFieldChanges) {
        changelogEntries.push({
          entityType: 'Task',
          entityId: taskId,
          action: 'UPDATE',
          triggeredBy: 'USER',
          userId,
          field,
          oldValue: JSON.stringify(oldValue),
          newValue: JSON.stringify(newValue),
          description: `Campo "${field}" alterado`,
          createdAt: new Date(),
        });
      }

      // 4b. Cuts changes
      if (updateData.cuts) {
        const oldCutGroups = this.groupCuts(currentTask.cuts);
        const newCutGroups = this.groupCuts(updatedTask.cuts);
        const cutChanges = this.detectCutChanges(oldCutGroups, newCutGroups);

        if (cutChanges.added.length > 0 || cutChanges.removed.length > 0) {
          changelogEntries.push({
            entityType: 'Task',
            entityId: taskId,
            action: 'UPDATE',
            triggeredBy: 'USER',
            userId,
            field: 'cuts',
            oldValue: JSON.stringify(oldCutGroups),
            newValue: JSON.stringify(newCutGroups),
            description: `${newCutGroups.length} recortes (${cutChanges.added.length} novos, ${cutChanges.removed.length} removidos)`,
            createdAt: new Date(),
          });
        }
      }

      // 4c. Services changes
      if (updateData.services) {
        const serviceChanges = this.detectArrayChanges(
          currentTask.services,
          updatedTask.services,
          ['description', 'status']
        );

        if (serviceChanges.added.length > 0 || serviceChanges.removed.length > 0) {
          changelogEntries.push({
            entityType: 'Task',
            entityId: taskId,
            action: 'UPDATE',
            triggeredBy: 'USER',
            userId,
            field: 'services',
            oldValue: JSON.stringify(this.serializeServices(currentTask.services)),
            newValue: JSON.stringify(this.serializeServices(updatedTask.services)),
            description: `${updatedTask.services.length} serviços`,
            createdAt: new Date(),
          });
        }
      }

      // 4d. Airbrushings changes
      if (updateData.airbrushings) {
        if (currentTask.airbrushings.length !== updatedTask.airbrushings.length) {
          changelogEntries.push({
            entityType: 'Task',
            entityId: taskId,
            action: 'UPDATE',
            triggeredBy: 'USER',
            userId,
            field: 'airbrushings',
            oldValue: JSON.stringify(currentTask.airbrushings.length),
            newValue: JSON.stringify(updatedTask.airbrushings.length),
            description: `Aerografias alteradas de ${currentTask.airbrushings.length} para ${updatedTask.airbrushings.length}`,
            createdAt: new Date(),
          });
        }
      }

      // 4e. Artworks changes
      if (updateData.artworkIds) {
        const oldIds = currentTask.artworks.map(a => a.id).sort();
        const newIds = updatedTask.artworks.map(a => a.id).sort();

        if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
          changelogEntries.push({
            entityType: 'Task',
            entityId: taskId,
            action: 'UPDATE',
            triggeredBy: 'USER',
            userId,
            field: 'artworks',
            oldValue: JSON.stringify(oldIds),
            newValue: JSON.stringify(newIds),
            description: `Artes alteradas`,
            createdAt: new Date(),
          });
        }
      }

      // 4f. Logo paints changes
      if (updateData.paintIds) {
        const oldIds = currentTask.logoPaints.map(p => p.id).sort();
        const newIds = updatedTask.logoPaints.map(p => p.id).sort();

        if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
          changelogEntries.push({
            entityType: 'Task',
            entityId: taskId,
            action: 'UPDATE',
            triggeredBy: 'USER',
            userId,
            field: 'logoPaints',
            oldValue: JSON.stringify(oldIds),
            newValue: JSON.stringify(newIds),
            description: `Tintas do logo alteradas`,
            createdAt: new Date(),
          });
        }
      }

      // === 5. BULK INSERT CHANGELOGS ===
      if (changelogEntries.length > 0) {
        await tx.changeLog.createMany({
          data: changelogEntries,
        });
      }

      return updatedTask;
    });
  }

  // Helper methods
  private detectSimpleFieldChanges(current: Task, update: TaskUpdateDto) {
    const changes = [];
    const fieldsToTrack = [
      'name', 'status', 'serialNumber', 'plate', 'details',
      'entryDate', 'term', 'price', 'customerId', 'sectorId',
      'budgetId', 'nfeId', 'receiptId', 'paintId'
    ];

    for (const field of fieldsToTrack) {
      if (update[field] !== undefined && current[field] !== update[field]) {
        changes.push({
          field,
          oldValue: current[field],
          newValue: update[field],
        });
      }
    }

    return changes;
  }

  private groupCuts(cuts: Cut[]): CutGroup[] {
    // Implementation from section 7
  }

  private detectCutChanges(oldGroups: CutGroup[], newGroups: CutGroup[]) {
    // Implementation from section 3.1
  }

  private detectArrayChanges<T>(oldArray: T[], newArray: T[], fields: string[]) {
    // Implementation from section 6
  }

  private serializeServices(services: ServiceOrder[]) {
    // Implementation from section 7
  }
}
```

---

## 9. Performance Considerations

### 9.1 Avoid N+1 Queries

**Problem**: Loading related entities one by one

**Solution**: Use `include` in initial query
```typescript
// ❌ BAD - N+1 queries
const task = await prisma.task.findUnique({ where: { id } });
const cuts = await prisma.cut.findMany({ where: { taskId: id } });
const services = await prisma.serviceOrder.findMany({ where: { taskId: id } });

// ✅ GOOD - Single query with includes
const task = await prisma.task.findUnique({
  where: { id },
  include: {
    cuts: { include: { file: true } },
    services: true,
    airbrushings: true,
  },
});
```

---

### 9.2 Batch Changelog Creation

**Problem**: Creating changelogs one by one

**Solution**: Use `createMany`
```typescript
// ❌ BAD - Multiple queries
for (const change of changes) {
  await prisma.changeLog.create({ data: change });
}

// ✅ GOOD - Single batch insert
await prisma.changeLog.createMany({
  data: changes,
});
```

---

### 9.3 Transaction Handling

**Problem**: Partial updates if changelog creation fails

**Solution**: Use transactions
```typescript
// ✅ All-or-nothing transaction
await prisma.$transaction(async (tx) => {
  // 1. Update task
  const updatedTask = await tx.task.update({ ... });

  // 2. Create changelogs
  await tx.changeLog.createMany({ ... });

  // If any step fails, entire transaction rolls back
});
```

---

### 9.4 Index Optimization

**Ensure these indexes exist**:
```sql
-- Fast changelog lookups by entity
CREATE INDEX idx_changelogs_entity
ON change_logs(entity_type, entity_id, created_at DESC);

-- Fast user activity lookups
CREATE INDEX idx_changelogs_user
ON change_logs(user_id, created_at DESC);

-- Fast action filtering
CREATE INDEX idx_changelogs_action
ON change_logs(action, created_at DESC);
```

---

### 9.5 Selective Tracking

**Not every field needs tracking**

```typescript
// Define trackable fields
const TRACKABLE_SIMPLE_FIELDS = [
  'name', 'status', 'serialNumber', 'plate', 'details',
  'entryDate', 'term', 'price', 'customerId', 'sectorId'
];

const TRACKABLE_RELATIONS = [
  'cuts', 'services', 'airbrushings', 'artworks', 'logoPaints'
];

// Skip internal/metadata fields
const SKIP_FIELDS = [
  'updatedAt', 'statusOrder', 'createdAt', 'id'
];
```

---

## 10. Summary and Recommendations

### ✅ What's Already Done

1. **Frontend is 100% ready** - No changes needed
2. **Field labels** are configured in `/src/utils/changelog-fields.ts`
3. **Display logic** is implemented in `formatFieldValue()`
4. **UI component** exists: `<ChangelogHistory />`

### 🔨 What Needs to Be Implemented (Backend)

1. **Update Task Service** to track relation changes
2. **Implement change detection** for each relation type
3. **Batch create changelogs** in transactions
4. **Add database indexes** for performance

### 📋 Implementation Priority

**High Priority** (Essential for audit trail):
1. ✅ Cuts tracking (most complex, most important)
2. ✅ Services tracking
3. ✅ Airbrushings tracking

**Medium Priority** (Nice to have):
4. ⚠️ Logo paints tracking
5. ⚠️ Artworks tracking

**Low Priority** (Rarely changed):
6. ⏸️ Related tasks tracking

### 🎯 Recommended Approach

**Use Option 1 from BACKEND_CUTS_CHANGELOG_FIX.md**:
- Track at **Task level** (not individual Cut level)
- Create **ONE changelog entry per relation type**
- Store **grouped/summarized data** (e.g., cuts grouped by file+type)
- Keep it **simple and performant**

### 📝 Testing Checklist

After implementation, verify:

1. **Update task with cuts**
   - Add new cuts → Changelog created
   - Remove cuts → Changelog created
   - Modify cut quantity → Changelog created

2. **Update task with services**
   - Add service → Changelog created
   - Remove service → Changelog created
   - Modify service → Changelog created

3. **Frontend display**
   - Navigate to task detail page
   - Check "Histórico de Alterações" section
   - Verify Portuguese labels
   - Verify correct formatting

4. **Performance**
   - Update task with 10+ cuts → Should be fast (<500ms)
   - Check database query count (should be minimal)

### 🚀 Next Steps

1. Choose one relation to implement first (recommend: **cuts**)
2. Implement change detection logic
3. Test thoroughly with frontend
4. Roll out to other relations using same pattern
5. Monitor performance in production

---

## Appendix A: Complete Entity Schemas

### Cut Entity
```typescript
interface Cut {
  id: string;
  fileId: string;
  type: CUT_TYPE;          // VINYL | STENCIL
  status: CUT_STATUS;      // PENDING | CUTTING | COMPLETED
  statusOrder: number;
  startedAt: Date | null;
  completedAt: Date | null;
  taskId?: string | null;
  origin: CUT_ORIGIN;      // PLAN | REQUEST
  reason?: CUT_REQUEST_REASON | null;  // WRONG_APPLY | LOST | WRONG
  parentCutId?: string | null;

  // Relations
  file?: File;
  task?: Task;
  parentCut?: Cut;
  childCuts?: Cut[];
}
```

### ServiceOrder Entity
```typescript
interface ServiceOrder {
  id: string;
  status: SERVICE_ORDER_STATUS | null;  // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  statusOrder: number;
  description: string;
  taskId: string;
  startedAt: Date | null;
  finishedAt: Date | null;

  // Relations
  task?: Task;
}
```

### Airbrushing Entity
```typescript
interface Airbrushing {
  id: string;
  startDate: Date | null;
  finishDate: Date | null;
  price: number | null;
  status: AIRBRUSHING_STATUS;  // PENDING | IN_PROGRESS | COMPLETED
  statusOrder: number;
  taskId: string;

  // Relations
  task?: Task;
  receipts?: File[];
  nfes?: File[];
  artworks?: File[];
}
```

### Paint Entity (for logoPaints)
```typescript
interface Paint {
  id: string;
  name: string;
  code: string | null;
  hex: string;
  finish: PAINT_FINISH;  // SOLID | METALLIC | PEARL | MATTE | SATIN
  manufacturer: TRUCK_MANUFACTURER | null;
  tags: string[];
  palette: COLOR_PALETTE;
  paletteOrder: number;
  paintTypeId: string;
  paintBrandId: string | null;

  // Relations
  paintType?: PaintType;
  paintBrand?: PaintBrand;
  formulas?: PaintFormula[];
  generalPaintings?: Task[];
  logoTasks?: Task[];
}
```

### File Entity (for artworks)
```typescript
interface File {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  path: string;
  size: number;
  thumbnailUrl: string | null;

  // Relations
  tasksArtworks?: Task[];
  customerLogo?: Customer;
  supplierLogo?: Supplier;
  taskBudget?: Task;
  taskNfe?: Task;
  taskReceipt?: Task;
}
```

---

## Appendix B: Sample Changelog Entries

### Example 1: Cuts Changed
```json
{
  "id": "uuid-xxx",
  "entityType": "Task",
  "entityId": "task-uuid",
  "action": "UPDATE",
  "triggeredBy": "USER",
  "userId": "user-uuid",
  "field": "cuts",
  "oldValue": "[{\"fileId\":\"file-1\",\"fileName\":\"logo.svg\",\"type\":\"VINYL\",\"origin\":\"PLAN\",\"quantity\":2}]",
  "newValue": "[{\"fileId\":\"file-1\",\"fileName\":\"logo.svg\",\"type\":\"VINYL\",\"origin\":\"PLAN\",\"quantity\":3},{\"fileId\":\"file-2\",\"fileName\":\"text.svg\",\"type\":\"STENCIL\",\"origin\":\"REQUEST\",\"quantity\":1}]",
  "description": "3 recortes (1 novo, 0 removidos, 1 modificado)",
  "metadata": null,
  "createdAt": "2025-10-06T15:30:00Z"
}
```

### Example 2: Services Changed
```json
{
  "id": "uuid-yyy",
  "entityType": "Task",
  "entityId": "task-uuid",
  "action": "UPDATE",
  "triggeredBy": "USER",
  "userId": "user-uuid",
  "field": "services",
  "oldValue": "[{\"id\":\"svc-1\",\"description\":\"Pintura\",\"status\":\"PENDING\"}]",
  "newValue": "[{\"id\":\"svc-1\",\"description\":\"Pintura\",\"status\":\"COMPLETED\"},{\"id\":\"svc-2\",\"description\":\"Polimento\",\"status\":\"PENDING\"}]",
  "description": "2 serviços",
  "metadata": null,
  "createdAt": "2025-10-06T15:35:00Z"
}
```

### Example 3: Artworks Changed
```json
{
  "id": "uuid-zzz",
  "entityType": "Task",
  "entityId": "task-uuid",
  "action": "UPDATE",
  "triggeredBy": "USER",
  "userId": "user-uuid",
  "field": "artworks",
  "oldValue": "[\"file-uuid-1\",\"file-uuid-2\"]",
  "newValue": "[\"file-uuid-2\",\"file-uuid-3\"]",
  "description": "Artes alteradas",
  "metadata": null,
  "createdAt": "2025-10-06T15:40:00Z"
}
```

---

**End of Document**
