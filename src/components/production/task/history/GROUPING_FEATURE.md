# Sequential Task Grouping Feature

## Overview

This feature automatically groups sequential tasks with similar names in the task history/agenda table, making it easier to view and manage large batches of related tasks.

## How It Works

### Grouping Algorithm

The system automatically detects and groups tasks based on:

1. **Name Similarity** (Fuzzy matching using Levenshtein distance)
   - Tasks with similar names are considered for grouping
   - Similarity threshold: 80% (configurable)
   - Example: "Tp Transportes", "Tp Transportes 1", "Tp Transportes A" are all similar

2. **Sequential IDENTIFICADOR** (Serial Numbers)
   - Tasks must have consecutive serial numbers
   - Example: 37057, 37058, 37059, 37060
   - Works with both `serialNumber` and `truck.plate` fields

3. **Minimum Group Size**
   - Only groups with 3 or more tasks are collapsed
   - Smaller sequences remain as individual rows

### Visual Representation

When tasks are grouped, they appear as:

```
┌─ Tp Transportes (37057)        ← First task (visible)
│  [+] 7 tarefas ocultas          ← Collapsed row (clickable)
└─ Tp Transportes (37065)         ← Last task (visible)
```

When expanded:

```
┌─ Tp Transportes (37057)        ← First task
├─ Tp Transportes (37058)        ← Expanded tasks
├─ Tp Transportes (37059)        │
├─ Tp Transportes (37060)        │
├─ Tp Transportes (37061)        │
├─ Tp Transportes (37062)        │
├─ Tp Transportes (37063)        │
├─ Tp Transportes (37064)        │
└─ Tp Transportes (37065)        ← Last task
```

## User Interactions

### Expanding Groups

- **Click collapsed row**: Expands to show all hidden tasks
- **Smooth animation**: Tasks fade in with staggered timing (30ms delay each)
- **Visual indicators**: Subtle left border on first/last rows shows group membership

### Checkbox Selection

- **Collapsed state**: Checkbox selects/deselects ALL tasks in the group
- **Indeterminate state**: Shows when some (but not all) tasks are selected
- **Badge indicator**: Shows count of selected tasks in collapsed state
- **Individual selection**: Expand group to select specific tasks

### Context Menu

- Works on both collapsed and expanded rows
- Right-click collapsed row: Actions apply to all tasks in group
- Bulk operations respect selection state

## Features Preserved

### ✅ All Existing Functionality Works

1. **Filtering**: Filters apply before grouping - collapsed rows are real tasks
2. **Sorting**: Tasks are grouped based on current sort order
3. **Export**: All tasks exported regardless of collapse state
4. **Search**: Grouped tasks appear in search results
5. **Pagination**: Groups respect page boundaries
6. **Cross-table selection**: Shift+click selection works across groups
7. **URL state**: Page state is preserved in URL

## Implementation Details

### Files Created

1. **`task-grouping-utils.ts`**
   - `groupSequentialTasks()`: Main grouping algorithm
   - `stringSimilarity()`: Fuzzy name matching using Levenshtein distance
   - `parseSerialNumber()`: Extract numeric part from serial numbers
   - `shouldGroupTasks()`: Determine if two tasks should be grouped

2. **`collapsed-group-row.tsx`**
   - `CollapsedGroupRow`: React component for collapsed row UI
   - Handles checkbox selection for entire group
   - Shows selection count and total count badges
   - Smooth fade-out animation when expanding

### Files Modified

1. **`task-history-table.tsx`**
   - Added `expandedGroups` state (Set<string>)
   - Integrated `groupSequentialTasks()` into rendering pipeline
   - Added `handleTaskRowClick()` and `renderTaskCells()` helpers
   - Modified table body rendering to handle `TaskGroup` objects
   - Added staggered fade-in animations for expanded rows

## Configuration

### Adjustable Parameters

In `task-grouping-utils.ts`:

```typescript
groupSequentialTasks(
  tasks: Task[],
  minGroupSize: number = 3,          // Minimum tasks to form a group
  similarityThreshold: number = 0.8   // Name similarity (0-1, higher = stricter)
)
```

### Animation Timings

In `collapsed-group-row.tsx`:
- Fade out duration: 200ms
- Transition timing: ease-in-out

In `task-history-table.tsx`:
- Stagger delay: 30ms per row
- Fade in duration: 200ms

## Performance Considerations

- **Grouping complexity**: O(n) where n = number of tasks
- **Levenshtein distance**: Optimized for short strings (task names)
- **Memoization**: `groupedTasks` recalculated only when `tasks` array changes
- **No API changes**: All grouping happens client-side

## Accessibility

- **ARIA labels**: Checkbox has descriptive label for screen readers
- **Keyboard navigation**: All interactions work with keyboard
- **Focus management**: Tab order preserved in expanded state
- **Visual indicators**: Color contrast meets WCAG AA standards

## Edge Cases Handled

1. **No sequential tasks**: Falls back to individual rows
2. **Groups < 3 tasks**: Rendered as individual rows
3. **Mixed serial number formats**: Handles both numeric and alphanumeric
4. **Null serial numbers**: Uses truck.plate as fallback
5. **Empty task list**: Gracefully handles empty arrays
6. **Single task**: Never creates a group for single task

## Future Enhancements

Potential improvements for future iterations:

1. **Configurable grouping**: Allow users to toggle grouping on/off
2. **Custom similarity threshold**: User-adjustable in settings
3. **Group by other fields**: Extend to group by customer, sector, etc.
4. **Expand all/collapse all**: Bulk group management
5. **Persistent state**: Remember expanded groups in localStorage
6. **Visual customization**: Theme-based group indicators

## Testing Checklist

- [x] Grouping algorithm detects sequential tasks
- [x] Fuzzy name matching works correctly
- [x] Checkbox selects all tasks in collapsed group
- [x] Indeterminate state shows for partial selection
- [x] Expand/collapse animations are smooth
- [x] Export includes all tasks (collapsed and expanded)
- [x] Filters work correctly with grouped tasks
- [x] Context menu works on collapsed rows
- [x] Cross-table selection (Shift+click) works
- [x] Visual indicators show group membership
- [x] Dev server compiles without errors

## Troubleshooting

### Groups not appearing
- Verify tasks have similar names (80% similarity)
- Check serial numbers are sequential
- Ensure at least 3 tasks in sequence

### Animations not smooth
- Check browser supports CSS transitions
- Verify Tailwind animation classes are loaded
- Clear browser cache and reload

### Selection not working
- Verify `canEdit` permission is true
- Check `selectedIds` state is updating
- Ensure event handlers are not blocked

## Support

For issues or questions:
- File: `task-history-table.tsx:1`
- Grouping logic: `task-grouping-utils.ts:1`
- Component: `collapsed-group-row.tsx:1`
