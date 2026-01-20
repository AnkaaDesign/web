# Layout Selector Component

A comprehensive React component for selecting truck layouts in the task management interface.

## Location
`/home/kennedy/Documents/repositories/web/src/components/production/task/layout/layout-selector.tsx`

## Features

- **Dropdown/Combobox Interface**: User-friendly selection with search capability
- **Layout Details Display**: Shows height, width, number of sections, and door indicators
- **Usage Count**: Displays how many trucks use each layout
- **Shared Layout Warning**: Badge and alert for layouts shared across multiple trucks
- **Create New Layout**: Integrated button to create new layouts for specific sides
- **Clear Selection**: Easy way to deselect the current layout
- **Loading States**: Proper loading indicators during data fetching
- **Responsive Design**: Uses shadcn/ui components with proper styling

## Usage

```tsx
import { LayoutSelector } from "@/components/production/task/layout";

function TaskForm() {
  const [layoutId, setLayoutId] = useState<string | null>(null);

  return (
    <LayoutSelector
      value={layoutId}
      onChange={setLayoutId}
      side="left"
      truckId="truck-123"
      onCreateClick={() => {
        // Handle creating a new layout
        console.log("Create new layout");
      }}
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string \| null` | Yes | - | Current selected layout ID |
| `onChange` | `(layoutId: string \| null) => void` | Yes | - | Callback when layout selection changes |
| `side` | `"left" \| "right" \| "back"` | Yes | - | Which side of the truck this layout is for |
| `truckId` | `string` | Yes | - | ID of the truck this layout belongs to |
| `disabled` | `boolean` | No | `false` | Whether the selector is disabled |
| `className` | `string` | No | - | Additional CSS classes |
| `allowCreate` | `boolean` | No | `true` | Whether to show the "Create New Layout" option |
| `onCreateClick` | `() => void` | No | - | Callback when "Create New Layout" is clicked |

## Data Fetching

The component uses React Query to fetch layouts with:
- Usage information (how many trucks use each layout)
- Section details (width, height, door indicators)
- 5-minute stale time for optimal caching

## Dependencies

- `@tanstack/react-query` - Data fetching and caching
- `@tabler/icons-react` - Icons
- shadcn/ui components:
  - `Button`
  - `Command` (Combobox)
  - `Popover`
  - `Alert`
  - `Badge`

## API Integration

Uses `layoutService.listLayouts()` from the API client with parameters:
- `includeUsage: true` - Includes usage count for each layout
- `includeSections: true` - Includes section details

## Styling

The component uses Tailwind CSS classes and follows the application's design system. It supports:
- Light/dark mode
- Hover states
- Focus states
- Disabled states
- Responsive design

## Warning System

When a layout is used by multiple trucks, the component displays:
1. A warning badge next to the layout in the dropdown
2. A count of how many trucks use the layout
3. An alert below the selector warning that changes affect all tasks

## Accessibility

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus management
