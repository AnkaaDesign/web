# Collapse/Expand Functionality Guide

## Visual Flow

### **State 1: Collapsed (Initial State)**

```
┌─────────────────────────────────────────────────────────┐
│ ☐ Tp Transportes (37057)                                │ ← First task (visible, clickable)
├─────────────────────────────────────────────────────────┤
│ ☐ [►] 7 tarefas ocultas  [2 selecionadas]  [Total: 9]  │ ← Collapsed row (click to expand)
│     └─ "Clique para expandir" (on hover)                │
├─────────────────────────────────────────────────────────┤
│ ☐ Tp Transportes (37065)                                │ ← Last task (visible, clickable)
└─────────────────────────────────────────────────────────┘
```

**User Actions:**
- ✅ Click anywhere on collapsed row → Expands group
- ✅ Click checkbox → Selects ALL 7 hidden tasks + first + last (9 total)
- ✅ Right-click → Context menu for all selected tasks

---

### **State 2: Expanded**

```
┌─────────────────────────────────────────────────────────┐
│ ☐ Tp Transportes (37057)                                │ ← First task (still visible)
├─────────────────────────────────────────────────────────┤
│   [▼] 7 tarefas expandidas  [2 selecionadas]  [Total: 9]│ ← Collapse button (NEW!)
│     └─ "Clique para recolher" (on hover)                │
├─────────────────────────────────────────────────────────┤
│ ┃ ☐ Tp Transportes (37058)                              │ ← Expanded task 1
│ ┃ ☐ Tp Transportes (37059)                              │ ← Expanded task 2
│ ┃ ☐ Tp Transportes (37060)                              │ ← Expanded task 3
│ ┃ ☐ Tp Transportes (37061)                              │ ← Expanded task 4
│ ┃ ☐ Tp Transportes (37062)                              │ ← Expanded task 5
│ ┃ ☐ Tp Transportes (37063)                              │ ← Expanded task 6
│ ┃ ☐ Tp Transportes (37064)                              │ ← Expanded task 7
├─┸─────────────────────────────────────────────────────┤
│ ☐ Tp Transportes (37065)                                │ ← Last task (still visible)
└─────────────────────────────────────────────────────────┘
  ┃
  └─ Blue left border indicates group membership
```

**User Actions:**
- ✅ Click collapse button → Returns to collapsed state
- ✅ Click individual task rows → Navigate to task details
- ✅ Click individual checkboxes → Select specific tasks
- ✅ Ctrl+Click → Multi-select individual tasks

---

### **State 3: Collapsing (Transition)**

```
┌─────────────────────────────────────────────────────────┐
│ ☐ Tp Transportes (37057)                                │
├─────────────────────────────────────────────────────────┤
│ ☐ [►] 7 tarefas ocultas  [2 selecionadas]  [Total: 9]  │ ← Fading in (200ms)
├─────────────────────────────────────────────────────────┤
│ ☐ Tp Transportes (37065)                                │
└─────────────────────────────────────────────────────────┘
```

All 7 middle tasks + collapse button fade out smoothly (200ms)
Collapsed row fades in smoothly (200ms)

---

## Key Features

### 🎯 **Expand Functionality**
1. Click collapsed row (entire row is clickable)
2. Smooth fade-out of collapsed row (200ms)
3. Collapse button appears at top
4. Tasks fade in with stagger (30ms delay each)
5. Blue left border shows group membership

### 🎯 **Collapse Functionality** (NEW!)
1. Click collapse button row
2. All expanded tasks fade out
3. Collapsed summary row fades in
4. Selection state preserved
5. Back to original compact view

### 🎯 **Selection Behavior**

**Collapsed State:**
- Checkbox selects/deselects ALL tasks in group
- Badge shows "X selecionadas"
- Indeterminate state when partial selection

**Expanded State:**
- Each task has individual checkbox
- Collapse button shows selection count
- Can multi-select with Ctrl+Click

### 🎯 **Visual Indicators**

| Element | Collapsed | Expanded |
|---------|-----------|----------|
| Chevron Icon | `►` (right) | `▼` (down) |
| Row Background | `bg-muted/30` | `bg-muted/30` (button) |
| Left Border | None | Blue on tasks |
| Hover Text | "Clique para expandir" | "Clique para recolher" |
| Badge Count | Tasks hidden | Tasks expanded |

### 🎯 **Animations**

**Expanding:**
```css
.collapsed-row {
  opacity: 1 → 0;
  transition: 200ms ease-in-out;
}

.expanded-tasks {
  opacity: 0 → 1;
  animation: fade-in slide-in-from-top;
  delay: 0ms, 30ms, 60ms, 90ms... (staggered);
}
```

**Collapsing:**
```css
.expanded-tasks {
  opacity: 1 → 0;
  transition: 200ms ease-in-out;
}

.collapsed-row {
  opacity: 0 → 1;
  transition: 200ms ease-in-out;
}
```

## Code Implementation

### How Collapse Works

```typescript
// State management
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

// Toggle function
const toggleGroup = (groupId: string) => {
  setExpandedGroups(prev => {
    const newSet = new Set(prev);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);  // Collapse
    } else {
      newSet.add(groupId);     // Expand
    }
    return newSet;
  });
};

// Rendering logic
if (isExpanded) {
  // Render collapse button + expanded tasks
} else {
  // Render collapsed summary row
}
```

### Collapse Button Component

```tsx
<TableRow onClick={() => toggleGroup(groupId)}>
  <TableCell colSpan={columns.length}>
    <IconChevronDown />
    <span>7 tarefas expandidas</span>
    <Badge>2 selecionadas</Badge>
    <span className="hover:visible">Clique para recolher</span>
  </TableCell>
</TableRow>
```

## User Experience

### Typical Workflow

1. **View table** → See sequential tasks collapsed
2. **Click collapsed row** → Tasks expand with animation
3. **Review/select tasks** → Individual checkboxes available
4. **Click collapse button** → Return to compact view
5. **Selection preserved** → Selected tasks remain selected

### Edge Cases

- ✅ Expanding while some tasks selected → Selection preserved
- ✅ Selecting all in expanded → Checkbox on collapse button shows checked
- ✅ Filtering while expanded → Groups re-render correctly
- ✅ Pagination while expanded → State preserved per group ID
- ✅ Sorting while expanded → Groups collapse and re-form

## Keyboard Shortcuts

- **Enter/Space** on collapsed row → Expand
- **Enter/Space** on collapse button → Collapse
- **Tab** → Navigate through rows
- **Shift+Click** → Range selection (works across groups)

## Accessibility

- ✅ ARIA label on collapse button: "Collapse group of 7 tasks"
- ✅ Keyboard accessible (all click actions work with Enter/Space)
- ✅ Screen reader announces: "Expanded 7 tasks" / "Collapsed 7 tasks"
- ✅ Focus visible on collapse button
- ✅ Semantic HTML structure maintained

## Performance

- **State updates**: O(1) - Set operations
- **Re-renders**: Only affected group re-renders
- **Animation**: Hardware-accelerated (CSS transforms)
- **Memory**: Minimal overhead (just group IDs in Set)

## Summary

The collapse/expand functionality provides a complete cycle:

```
Collapsed ──click──> Expanded
    ↑                   │
    └─────click─────────┘
         collapse
         button
```

Both states preserve selection, work with all existing features, and provide smooth animations for a polished user experience.
