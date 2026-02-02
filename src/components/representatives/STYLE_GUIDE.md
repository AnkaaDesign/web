# Representatives Component Style Guide

This document outlines the design patterns, spacing conventions, and UI standards used across the application, specifically for the representatives components. All components should follow these patterns for consistency.

## Table of Contents
1. [Component Structure](#component-structure)
2. [Spacing Conventions](#spacing-conventions)
3. [Form Patterns](#form-patterns)
4. [Button Styles](#button-styles)
5. [Icon Usage](#icon-usage)
6. [Badge Variants](#badge-variants)
7. [Card Layouts](#card-layouts)
8. [Table Patterns](#table-patterns)
9. [Color Schemes](#color-schemes)
10. [Typography](#typography)

---

## Component Structure

### Standard Form Component Structure
```tsx
// 1. Imports (organized by category)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Icon } from "@tabler/icons-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// 2. Type Definitions
interface ComponentProps {
  // Props definition
}

// 3. Component Function
export function Component(props: ComponentProps) {
  // Form setup
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  // Handlers
  const handleSubmit = async (data) => { /* ... */ };

  // Render
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {/* Content */}
      </form>
    </Form>
  );
}
```

### File Organization
- Place form components in dedicated directories (e.g., `form/`, `list/`)
- Use PascalCase for component files
- One component per file
- Keep related components together

---

## Spacing Conventions

### Standard Spacing Classes

#### Vertical Spacing
- **`space-y-4`**: Default spacing between cards/sections
- **`space-y-6`**: Spacing between form field groups within a card
- **`space-y-2`**: Spacing within individual form field groups
- **`gap-2`**: Small gaps (buttons, badges, inline elements)
- **`gap-4`**: Medium gaps (form rows)
- **`gap-6`**: Large gaps (major sections)

#### Horizontal Spacing
- **`gap-2`**: Default for icon + text, button groups
- **`gap-4`**: Space between columns in grids
- **`gap-6`**: Space between major grid sections

#### Padding
- **`p-3`**: Small interactive elements (switch containers)
- **`px-4 py-4`**: Table cell padding, pagination areas
- **`pr-1.5`**: Badge with close button

### Grid Layouts

#### Two-Column Grid (Standard)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Form fields */}
</div>
```

#### Three-Column Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* Form fields */}
</div>
```

#### Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  {/* Items */}
</div>
```

---

## Form Patterns

### FormField Structure
```tsx
<FormField
  control={control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="flex items-center gap-2">
        <IconName className="h-4 w-4" />
        Label Text
        {required && <span className="text-destructive ml-1">*</span>}
      </FormLabel>
      <FormControl>
        <Input {...field} placeholder="Placeholder text" disabled={disabled} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Card-Based Form Layout
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <IconName className="h-5 w-5 text-muted-foreground" />
      Section Title
    </CardTitle>
    <CardDescription>Section description</CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Form fields */}
    </div>
  </CardContent>
</Card>
```

### Form Container
```tsx
<form id="form-id" onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-4xl">
  {/* Hidden submit button for programmatic submission */}
  <button id="form-id-submit" type="submit" className="hidden" disabled={isSubmitting}>
    Submit
  </button>

  <div className="space-y-4">
    {/* Cards with form sections */}
  </div>
</form>
```

### Switch Pattern (Active/Inactive Toggle)
```tsx
<FormField
  control={control}
  name="isActive"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
      <div className="space-y-0.5">
        <FormLabel>Label</FormLabel>
        <FormDescription>Description text</FormDescription>
      </div>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>
```

---

## Button Styles

### Button Variants
- **`variant="default"`**: Primary actions (Save, Create, Submit)
- **`variant="outline"`**: Secondary actions (Cancel, Filter, Add)
- **`variant="ghost"`**: Tertiary actions (Clear filters, icon buttons)
- **`variant="destructive"`**: Delete actions

### Button Sizes
- **`size="default"`**: Standard buttons
- **`size="sm"`**: Small buttons (filters, pagination)
- **`size="icon"`**: Icon-only buttons (actions in tables)

### Button with Icon Pattern
```tsx
<Button type="submit" disabled={loading}>
  <IconSave className="mr-2 h-4 w-4" />
  {loading ? 'Saving...' : 'Save'}
</Button>
```

### Icon-Only Button
```tsx
<Button variant="ghost" size="icon">
  <IconMoreVertical className="h-4 w-4" />
</Button>
```

### Action Button Group
```tsx
<div className="flex justify-end space-x-2">
  <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
    <IconX className="mr-2 h-4 w-4" />
    Cancel
  </Button>
  <Button type="submit" disabled={loading}>
    <IconSave className="mr-2 h-4 w-4" />
    {loading ? 'Saving...' : 'Save'}
  </Button>
</div>
```

---

## Icon Usage

### Icon Sizes
- **`h-3 w-3` / `h-3.5 w-3.5`**: Very small icons (inline with small text)
- **`h-4 w-4`**: Standard icons (form labels, buttons, table cells)
- **`h-5 w-5`**: Card headers, larger UI elements

### Icon Colors
- **`text-muted-foreground`**: Default icon color in labels and headers
- **No color class**: Inherits from parent (in buttons, badges)
- **`text-green-600`**: Success/active states
- **`text-destructive`**: Error/delete states

### Icon Placement
```tsx
// In Labels
<FormLabel className="flex items-center gap-2">
  <IconUser className="h-4 w-4" />
  Label Text
</FormLabel>

// In Card Titles
<CardTitle className="flex items-center gap-2">
  <IconBriefcase className="h-5 w-5 text-muted-foreground" />
  Section Title
</CardTitle>

// In Buttons (left-aligned)
<Button>
  <IconPlus className="mr-2 h-4 w-4" />
  Add Item
</Button>

// Icon-only buttons
<Button variant="ghost" size="icon">
  <IconEdit className="h-4 w-4" />
</Button>
```

### Common Icons (from @tabler/icons-react)
- `IconUser`: User/person fields
- `IconPhone`: Phone numbers
- `IconMail`: Email addresses
- `IconBriefcase`: Professional/work info
- `IconMapPin`: Address/location
- `IconInfoCircle`: General information
- `IconFileText`: Documents
- `IconPlus`: Add actions
- `IconX`: Remove/close actions
- `IconEdit`: Edit actions
- `IconTrash`: Delete actions
- `IconCheck`: Confirm/success
- `IconAlertCircle`: Warnings/alerts

---

## Badge Variants

### Standard Variants
```tsx
// Role/Type Badges
<Badge variant="default">Primary</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outlined</Badge>

// Status Badges
<Badge variant="active">Active</Badge>
<Badge variant="inactive">Inactive</Badge>

// Custom Colors (use sparingly)
<Badge className="bg-green-600">Success</Badge>
<Badge className="text-xs">Small Badge</Badge>
```

### Removable Badge Pattern
```tsx
<Badge
  variant="secondary"
  className="flex items-center gap-1.5 text-sm pr-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
  onClick={() => handleRemove(id)}
>
  <span>{label}</span>
  <IconX className="h-3.5 w-3.5" />
</Badge>
```

### Badge in Tables
```tsx
<Badge variant="secondary" className="text-xs whitespace-nowrap">
  Label
</Badge>
```

---

## Card Layouts

### Standard Card
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <IconName className="h-5 w-5 text-muted-foreground" />
      Title
    </CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Content */}
  </CardContent>
</Card>
```

### Card Spacing
- Multiple cards: Use `<div className="space-y-4">` wrapper
- Content within card: Use `className="space-y-6"` on CardContent
- Field groups: Use `gap-6` in grid layouts

### Form Card Pattern
```tsx
<div className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
        Basic Information
      </CardTitle>
      <CardDescription>Essential details</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fields */}
      </div>
    </CardContent>
  </Card>

  <Card>
    {/* Next section */}
  </Card>
</div>
```

---

## Table Patterns

### Table Structure
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.value}</TableCell>
        <TableCell className="text-right">
          {/* Actions */}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Table Cell Alignment
- **Left-aligned**: Default (names, text)
- **Center-aligned**: `className="text-center"` (status badges, counts)
- **Right-aligned**: `className="text-right"` (actions, numbers)

### Actions Column Pattern
```tsx
<TableCell className="text-right">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <IconMoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleEdit(item)}>
        <IconEdit className="h-4 w-4 mr-2" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => handleDelete(item)}
        className="text-destructive focus:text-destructive"
      >
        <IconTrash className="h-4 w-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</TableCell>
```

### Pagination Pattern
```tsx
<div className="flex items-center justify-between px-4 py-4 border-t">
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">Items per page:</span>
    <Select value={String(rowsPerPage)} onValueChange={handleChangeRowsPerPage}>
      <SelectTrigger className="w-[70px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10</SelectItem>
        <SelectItem value="25">25</SelectItem>
        <SelectItem value="50">50</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">
      {from}-{to} of {total}
    </span>
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={() => handlePrev()} disabled={!hasPrev}>
        Previous
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleNext()} disabled={!hasNext}>
        Next
      </Button>
    </div>
  </div>
</div>
```

---

## Color Schemes

### Semantic Colors
- **`text-destructive`**: Error states, required asterisks, delete actions
- **`text-muted-foreground`**: Secondary text, icons, descriptions
- **`text-green-600`**: Success states, active indicators
- **`border-destructive`**: Error borders on inputs

### Background Colors
- **`bg-accent`**: Hover states, selected items
- **`bg-secondary`**: Secondary badges, disabled states
- **`bg-green-600`**: Success badges

### State Colors
```tsx
// Active/Inactive
<Badge variant={isActive ? 'active' : 'inactive'}>
  {isActive ? 'Active' : 'Inactive'}
</Badge>

// Success/Error
<Badge className="bg-green-600">Success</Badge>
<Badge variant="destructive">Error</Badge>
```

---

## Typography

### Text Sizes
- **`text-xs`**: Small text (badges, helper text, table secondary info)
- **`text-sm`**: Standard body text, form descriptions, table cells
- **Default**: Form labels, card descriptions
- **`text-lg font-semibold`**: Section headings within cards

### Font Weights
- **`font-normal`**: Default text
- **`font-medium`**: Form labels, primary table cell text
- **`font-semibold`**: Section headings, card titles

### Text Colors
- **Default**: Primary text
- **`text-muted-foreground`**: Secondary text, descriptions, placeholders
- **`text-destructive`**: Error messages, required indicators

### Common Text Patterns
```tsx
// Form Label
<FormLabel className="flex items-center gap-2">
  <IconUser className="h-4 w-4" />
  Label Text
  {required && <span className="text-destructive ml-1">*</span>}
</FormLabel>

// Card Description
<CardDescription>Descriptive text about this section</CardDescription>

// Helper Text
<p className="text-sm text-muted-foreground">
  Additional information or instructions
</p>

// Error Text
<FormMessage /> {/* Automatically styled with text-destructive */}

// Table Secondary Info
<div className="text-xs text-muted-foreground">
  Additional details
</div>
```

---

## Best Practices

### DO
- Use consistent spacing (`gap-2`, `gap-4`, `gap-6`, `space-y-4`, `space-y-6`)
- Always include icons in form labels and card titles
- Use semantic color classes (`text-destructive`, `text-muted-foreground`)
- Mark required fields with asterisk in label
- Group related fields in cards with descriptive headers
- Use grid layouts for multi-column forms
- Include loading states for async operations
- Provide clear placeholder text
- Use tooltips for icon-only buttons

### DON'T
- Mix spacing values inconsistently (e.g., `gap-3`, `gap-5`)
- Use arbitrary color values (use theme colors)
- Create cards without headers
- Nest grids unnecessarily
- Forget disabled states for form inputs
- Use inline styles (use Tailwind classes)
- Create custom variants without following pattern

---

## Component-Specific Patterns

### Representatives Components

#### RepresentativeForm
- Use `space-y-6` for form sections
- Use `grid gap-6 md:grid-cols-2` for paired fields
- Required fields: name, phone, role (create mode), customerId (create mode)
- System access fields are conditional (show only when toggle is enabled)
- Card-based sections with icons

#### RepresentativeList
- Table with action dropdown menu
- Filters: search, role filter, active status filter
- Pagination at bottom with items-per-page selector
- Badges for role and status
- Icons for contact info (phone, email)
- Lock icons for system access indicator

#### RepresentativeSelector
- Single or multiple selection mode
- Dialog for creating new representatives
- Badge display for selected items (multiple mode)
- Group by role in dropdown
- Auto-select newly created items

---

## Migration Checklist

When updating existing components to match this style guide:

- [ ] Update spacing to use standard values (`gap-2`, `gap-4`, `gap-6`, `space-y-4`, `space-y-6`)
- [ ] Add icons to all form labels (h-4 w-4)
- [ ] Add icons to all card titles (h-5 w-5 text-muted-foreground)
- [ ] Ensure grid layouts use `gap-6` between columns
- [ ] Update button variants to match patterns
- [ ] Use FormField/FormItem/FormLabel/FormControl/FormMessage structure
- [ ] Add CardDescription to all cards
- [ ] Ensure required fields have asterisk in label
- [ ] Update badge variants and sizes
- [ ] Add proper hover/focus states
- [ ] Include loading/disabled states
- [ ] Use semantic color classes
- [ ] Ensure consistent typography

---

## Version History

- **v1.0** (2026-01-31): Initial style guide based on analysis of production and administration components
