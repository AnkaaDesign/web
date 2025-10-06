# Quick Start Guide - Changelog Implementation

## 5-Minute Setup

### Step 1: Copy Files (30 seconds)

```bash
cd your-backend-project

# Create directories if they don't exist
mkdir -p src/services src/utils src/types

# Copy the implementation files
cp BACKEND_IMPLEMENTATION/services/ChangelogService.ts src/services/
cp BACKEND_IMPLEMENTATION/services/TaskChangelogService.ts src/services/
cp BACKEND_IMPLEMENTATION/utils/changelogHelpers.ts src/utils/
cp BACKEND_IMPLEMENTATION/types/changelog.d.ts src/types/
```

### Step 2: Update Your Task Service (3 minutes)

Open your existing Task update service/controller and replace the update method:

**BEFORE:**
```typescript
async updateTask(taskId: string, updateData: any) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });
  return task;
}
```

**AFTER:**
```typescript
import { TaskChangelogService } from './services/TaskChangelogService';

const taskChangelogService = new TaskChangelogService(prisma);

async updateTask(taskId: string, updateData: any, userId?: string) {
  // 1. Get BEFORE state
  const before = await prisma.task.findUnique({
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

  // 2. Update (your existing logic)
  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  // 3. Get AFTER state
  const after = await prisma.task.findUnique({
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

  // 4. Track changes
  await taskChangelogService.trackTaskChanges({
    taskId,
    before,
    after,
    userId,
  });

  return after;
}
```

### Step 3: Test (1 minute)

Update a task through your API:

```bash
curl -X PUT http://localhost:3030/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PRODUCTION"}'
```

Check changelogs were created:

```bash
curl http://localhost:3030/api/changelogs?entityType=Task&entityId=TASK_ID
```

### Step 4: Verify in Frontend (30 seconds)

1. Open your app
2. Navigate to task detail page
3. Look for "Histórico de Alterações" section
4. Changes should appear in Portuguese!

## That's It!

You now have comprehensive changelog tracking for:
- ✅ All simple fields (status, price, name, etc.)
- ✅ Cuts
- ✅ Services
- ✅ Airbrushings
- ✅ Logo Paints
- ✅ Artworks
- ✅ Observation
- ✅ Truck

## Common Issues

### "No changelogs appearing"

**Solution**: Make sure you're passing `userId` to the update method:

```typescript
// In your controller/route
const userId = req.user?.id; // Get from auth middleware
await taskService.updateTask(taskId, updateData, userId);
```

### "Wrong field names in frontend"

**Solution**: Check you're using correct field names:
- ✅ Use: `cuts`
- ❌ Don't use: `cutRequest`, `cutPlan`, `cut`

### "Missing relations in changelog"

**Solution**: Make sure to include all relations in before/after fetch:

```typescript
include: {
  cuts: true,           // ← Must include
  services: true,       // ← Must include
  airbrushings: true,   // ← Must include
  logoPaints: true,     // ← Must include
  artworks: true,       // ← Must include
  observation: true,    // ← Must include
  truck: true,          // ← Must include
}
```

## Next Steps

- Read [README.md](./README.md) for advanced features
- Check [TaskService.example.ts](./examples/TaskService.example.ts) for production patterns
- Review [changelog.d.ts](./types/changelog.d.ts) for type definitions

## Need Help?

1. Check error logs for "changelog" errors
2. Verify database has ChangeLog table
3. Ensure Prisma schema includes ChangeLog model
4. Check frontend is calling correct API endpoint

---

**Frontend is ready. Backend implementation takes 5 minutes. Start tracking everything now!**
