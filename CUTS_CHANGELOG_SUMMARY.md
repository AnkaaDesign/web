# Cuts Changelog - Complete Solution

## Problem

When editing a task and changing cuts (adding, removing, or modifying), **no changelog entry appears** in the task history.

## Root Cause

✅ **Backend creates changelogs** for simple fields (status, price, name)
❌ **Backend does NOT create changelogs** for complex nested relations (cuts, services, airbrushings)

## Solution

### ✅ Frontend (Just Fixed)

Added support for `cuts` field in changelog display:

**File**: `/src/utils/changelog-fields.ts`

**Changes**:
1. **Line 208**: Added `cuts: "Recortes"` field label
2. **Line 837**: Added cuts formatting logic - displays as "X recorte(s)"

**Result**: Frontend will now properly display cuts changelogs in Portuguese when backend creates them.

### ❌ Backend (Needs Implementation)

**See `BACKEND_CUTS_CHANGELOG_FIX.md` for complete implementation guide.**

**Quick Summary**:

When updating a task with new cuts data, backend must:

```typescript
// 1. Get current cuts before update
const oldCuts = await getCuts(taskId);

// 2. Update task (including cuts creation/deletion)
await updateTask(taskId, newData);

// 3. Get new cuts after update
const newCuts = await getCuts(taskId);

// 4. If cuts changed, create changelog entry
if (cutsChanged(oldCuts, newCuts)) {
  await createChangeLog({
    entityType: 'Task',
    entityId: taskId,
    action: 'UPDATE',
    field: 'cuts',  // ← Important: use "cuts" as field name
    oldValue: JSON.stringify(groupCuts(oldCuts)),
    newValue: JSON.stringify(groupCuts(newCuts)),
    description: `Recortes alterados de ${oldCuts.length} para ${newCuts.length}`,
    userId: currentUserId,
  });
}
```

## How It Will Look

Once backend creates changelogs, the task detail page will show:

```
┌────────────────────────────────────────────┐
│ 📝 Recortes                                │
│ João Silva • há 5 minutos                  │
│                                            │
│ De: 2 recortes                             │
│ Para: 3 recortes                           │
└────────────────────────────────────────────┘
```

With expandable details showing:
```json
Old Value:
[
  { "type": "VINYL", "quantity": 2, "fileId": "xxx" }
]

New Value:
[
  { "type": "VINYL", "quantity": 3, "fileId": "yyy" }
]
```

## Testing

### 1. Edit Task with Cut Changes

Go to task edit form → Change cuts (add/remove/modify) → Save

### 2. Check Task Detail Page

Navigate to task detail → Scroll to "Histórico de Alterações"

**Expected**: See "Recortes" entry showing the change

**If NOT showing**: Backend hasn't created the changelog entry yet

## Same Issue Affects

These fields also need backend changelog tracking:
- ❌ `services` - Service orders
- ❌ `airbrushings` - Airbrushing work
- ❌ `logoPaints` - Logo paints
- ❌ `artworks` - Artwork files

All are configured in frontend, just need backend implementation.

## Files Modified

1. `/src/utils/changelog-fields.ts`
   - Line 208: Added `cuts: "Recortes"`
   - Line 837: Unified cuts formatting logic

## Next Steps

**Backend Team**:
1. Read `BACKEND_CUTS_CHANGELOG_FIX.md`
2. Implement cuts changelog tracking in task update service
3. Test by editing a task
4. Verify changelog appears on detail page

**Frontend**: ✅ Ready - no more changes needed!
