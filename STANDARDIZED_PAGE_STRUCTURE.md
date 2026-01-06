# Standardized Page Structure Documentation

This document outlines the exact structure and patterns to achieve consistent layouts across all pages in the application. The inventory/products pages serve as the reference implementation.

## Table of Contents
1. [Core Principles](#core-principles)
2. [Page Variants](#page-variants)
3. [Common Structure](#common-structure)
4. [Variant-Specific Patterns](#variant-specific-patterns)
5. [Component Standards](#component-standards)
6. [Common Pitfalls](#common-pitfalls)

---

## Core Principles

### 1. Fixed Header with Scrollable Content
- Page header remains fixed at the top
- Only the content area scrolls
- Spacing between header and content MUST NOT scroll away

### 2. Flexbox Gap Pattern
- Use `gap-4` on the parent flex container to create fixed 16px spacing
- **NEVER** use `margin` or `padding-top` on scrollable containers
- **NEVER** use `space-y-4` directly on the form element

### 3. Consistent Spacing
- All pages use the same spacing values:
  - Page padding: `px-4 pt-4`
  - Gap between header and content: `gap-4`
  - Bottom padding in scrollable area: `pb-6`
  - Spacing between cards: `gap-4` or `space-y-4`

---

## Page Variants

### 1. List Page (Table/Grid View)
**Purpose**: Display a list or grid of items with optional search/filters
**Scrolling**: Only the table/grid content scrolls, not the entire card

### 2. Detail Page (Read-Only View)
**Purpose**: Display detailed information about a single entity
**Scrolling**: All content sections scroll together

### 3. Form Page (Create/Edit)
**Purpose**: Create or edit an entity
**Scrolling**: Form content scrolls, maintaining header spacing

### 4. Batch Edit Page
**Purpose**: Edit multiple items simultaneously
**Scrolling**: Table content scrolls

---

## Common Structure

All pages **MUST** follow this exact structure:

```tsx
<div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
  <PageHeader
    variant="list|detail|form|batch"
    // ... props
    className="flex-shrink-0"
  />
  <div className="flex-1 overflow-y-auto pb-6">
    {/* Content goes here */}
  </div>
</div>
```

### Breakdown:

1. **Outer Container**
   - `h-full`: Takes full height of parent
   - `flex flex-col`: Vertical flexbox layout
   - `gap-4`: **CRITICAL** - Creates fixed 16px gap between children
   - `bg-background`: Background color
   - `px-4 pt-4`: Horizontal and top padding

2. **PageHeader**
   - `className="flex-shrink-0"`: Prevents header from shrinking
   - Always include appropriate `variant` prop

3. **Scrollable Content Container**
   - `flex-1`: Takes remaining vertical space
   - `overflow-y-auto`: Enables vertical scrolling
   - `pb-6`: Bottom padding (24px) inside scrollable area

---

## Variant-Specific Patterns

### List Page

**File**: `src/pages/{module}/{entity}/list.tsx`

```tsx
export const EntityListPage = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Entities"
        favoritePage={FAVORITE_PAGES.MODULE_ENTITY_LIST}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Module", href: routes.module.root },
          { label: "Entities" }
        ]}
        actions={[
          {
            key: "create",
            label: "Cadastrar",
            icon: IconPlus,
            onClick: () => navigate(routes.module.entity.create),
            variant: "default",
          },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pt-4 pb-6 flex flex-col">
        <EntityList className="h-full" />
      </div>
    </div>
  );
};
```

**Key Points**:
- Use `min-h-0` to constrain card height
- Pass `className="h-full"` to list component
- Use `pt-4` for top spacing before the card
- List component handles internal scrolling

### Detail Page

**File**: `src/pages/{module}/{entity}/details/[id].tsx`

```tsx
const EntityDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditEntity(user);

  const { data: response, isLoading, error, refetch } = useEntity(id!, {
    include: {
      // ... relations
    },
  });

  const entity = response?.data;

  if (isLoading) {
    return <EntityDetailSkeleton />;
  }

  if (error || !entity) {
    return <EntityNotFoundError />;
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="detail"
        entity={entity}
        title={entity.name}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            icon: IconRefresh,
            onClick: () => refetch(),
          },
          ...(canEdit ? [{
            key: "edit",
            label: "Editar",
            icon: IconEdit,
            onClick: () => navigate(routes.module.entity.edit(entity.id)),
          }] : []),
        ]}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Module", href: routes.module.root },
          { label: "Entities", href: routes.module.entity.list },
          { label: entity.name },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SpecificationsCard entity={entity} />
            <MetricsCard entity={entity} />
            <ActivityHistoryCard entity={entity} />
            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.ENTITY}
              entityId={entity.id}
              entityName={entity.name}
              entityCreatedAt={entity.createdAt}
            />
          </div>
          {/* Additional full-width sections */}
          <RelatedItemsCard entity={entity} />
        </div>
      </div>
    </div>
  );
};
```

**Key Points**:
- Use `space-y-4` wrapper when you have **multiple children** (grid + additional sections)
- Grid uses `gap-4` for consistent spacing
- All sections scroll together

### Form Page (Create)

**File**: `src/pages/{module}/{entity}/create.tsx`

```tsx
export const CreateEntityPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createAsync, createMutation } = useEntityMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const defaultValues = getDefaultEntityFormValues(searchParams);

  const handleSubmit = async (data: EntityCreateFormData) => {
    try {
      const result = await createAsync(data);
      if (result?.success && result?.data) {
        navigate(routes.module.entity.list, { replace: true });
      }
    } catch (error) {
      console.error("Error creating entity:", error);
      throw error;
    }
  };

  const handleCancel = () => {
    navigate(routes.module.entity.list, { replace: true });
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("entity-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending || !formState.isValid,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Cadastrar Entity"
        icon={IconPackage}
        favoritePage={FAVORITE_PAGES.MODULE_ENTITY_CREATE}
        breadcrumbs={[
          { label: "Module", href: routes.module.root },
          { label: "Entities", href: routes.module.entity.list },
          { label: "Cadastrar" }
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <EntityForm
          mode="create"
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending}
          defaultValues={defaultValues}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
};
```

**Key Points**:
- **DO NOT** wrap form in `space-y-4` div
- Form component handles its own internal spacing
- Use `gap-4` pattern at page level only

### Form Page (Edit)

**File**: `src/pages/{module}/{entity}/edit/[id].tsx`

```tsx
export const EditEntityPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateAsync, updateMutation } = useEntityMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const {
    data: response,
    isLoading,
    error,
  } = useEntity(id!, {
    include: {
      // ... relations needed for form
    },
  });

  const entity = response?.data;

  const handleFormSubmit = async (changedData: Partial<EntityUpdateFormData>) => {
    if (!id) return;

    try {
      const result = await updateAsync({
        id,
        data: changedData,
      });

      if (result.success) {
        navigate(routes.module.entity.list);
      }
    } catch (error) {
      console.error("Error updating entity:", error);
    }
  };

  const handleCancel = () => {
    navigate(routes.module.entity.list);
  };

  if (isLoading) {
    return <EntityEditSkeleton />;
  }

  if (error || !entity) {
    return <EntityNotFoundError />;
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("entity-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending || !formState.isValid || !formState.isDirty,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title={`Editar ${entity.name}`}
        icon={IconPackage}
        breadcrumbs={[
          { label: "Module", href: routes.module.root },
          { label: "Entities", href: routes.module.entity.list },
          { label: entity.name, href: routes.module.entity.details(id!) },
          { label: "Editar" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <EntityEditForm
          entity={entity}
          onSubmit={handleFormSubmit}
          isSubmitting={updateMutation.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
};
```

### Batch Edit Page

**File**: `src/pages/{module}/{entity}/batch-edit.tsx`

```tsx
export default function EntityBatchEditPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const entityIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  const {
    data: entitiesResponse,
    isLoading,
    error,
  } = useEntities(
    {
      where: {
        id: { in: entityIds },
      },
      include: {
        // ... relations
      },
    },
    {
      enabled: entityIds.length > 0,
    },
  );

  const entities = entitiesResponse?.data || [];

  const handleCancel = () => {
    navigate(routes.module.entity.list);
  };

  if (entityIds.length === 0) {
    return <NoSelectionError onBack={handleCancel} />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || entities.length === 0) {
    return <ErrorState onBack={handleCancel} />;
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
    },
    {
      key: "save",
      label: "Salvar Alterações",
      icon: IconDeviceFloppy,
      onClick: () => {
        const submitButton = document.getElementById("entity-batch-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background px-4 pt-4">
      <PageHeader
        title="Editar Entities em Lote"
        icon={IconPackage}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Module", href: routes.module.root },
          { label: "Entities", href: routes.module.entity.list },
          { label: "Editar em Lote" },
        ]}
        actions={actions}
      />
      <div className="flex-1 overflow-hidden pt-4 pb-6">
        <EntityBatchEditTable
          entities={entities}
          onCancel={handleCancel}
          onSubmit={() => {
            const submitButton = document.getElementById("entity-batch-form-submit");
            if (submitButton) {
              submitButton.click();
            }
          }}
        />
      </div>
    </div>
  );
}
```

**Key Points**:
- Uses `overflow-hidden` instead of `overflow-y-auto`
- Table component handles scrolling internally
- Uses `pt-4` for spacing before table

---

## Component Standards

### Form Component Structure

**CRITICAL**: Form components must follow this exact pattern:

```tsx
export function EntityForm(props: EntityFormProps) {
  const form = useForm({
    // ... form config
  });

  return (
    <FormProvider {...form}>
      <form id="entity-form" onSubmit={form.handleSubmit(handleSubmit)}>
        {/* Hidden submit button */}
        <button id="entity-form-submit" type="submit" className="hidden">
          Submit
        </button>

        {/* CRITICAL: Wrapper for cards with space-y-4 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Section 1</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Form fields */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section 2</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Form fields */}
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
```

**Why This Pattern?**
1. **Hidden submit button first**: Not affected by `space-y-4`
2. **Wrapper div with `space-y-4`**: Creates spacing between cards only
3. **NO `space-y-4` on form element**: Would create unwanted top spacing

### PageHeader Configuration

```tsx
<PageHeader
  variant="list|detail|form|batch"  // Required for proper styling
  title="Page Title"                 // String or ReactNode
  icon={IconComponent}               // Optional icon (form pages)
  favoritePage={FAVORITE_PAGES.KEY}  // Optional favorite functionality
  breadcrumbs={[                     // Navigation breadcrumbs
    { label: "Home", href: routes.home },
    { label: "Section", href: routes.section.root },
    { label: "Current Page" },       // Last item has no href
  ]}
  actions={[                         // Action buttons
    {
      key: "action-key",             // Unique identifier
      label: "Action Label",
      icon: IconComponent,           // Optional icon
      onClick: handleAction,
      variant: "default|outline|...",
      disabled: false,
      loading: false,
    },
  ]}
  className="flex-shrink-0"          // CRITICAL: Prevents header shrinking
/>
```

### Card Backgrounds

**ALL cards must use default white background**:
```tsx
// ✅ CORRECT
<Card>
  <CardContent>...</CardContent>
</Card>

// ❌ WRONG
<Card className="bg-transparent">
  <CardContent>...</CardContent>
</Card>
```

---

## Common Pitfalls

### ❌ WRONG: Padding on Scrollable Container

```tsx
// This creates scrollable padding that disappears when scrolling
<div className="flex-1 overflow-y-auto pt-4 pb-6">
  <Content />
</div>
```

### ✅ CORRECT: Gap on Flex Container

```tsx
<div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
  <PageHeader className="flex-shrink-0" />
  <div className="flex-1 overflow-y-auto pb-6">
    <Content />
  </div>
</div>
```

---

### ❌ WRONG: space-y-4 Directly on Form

```tsx
// Creates unwanted top spacing
<form className="space-y-4">
  <Card>...</Card>
  <Card>...</Card>
</form>
```

### ✅ CORRECT: Wrapper Div with space-y-4

```tsx
<form id="entity-form">
  <button type="submit" className="hidden">Submit</button>
  <div className="space-y-4">
    <Card>...</Card>
    <Card>...</Card>
  </div>
</form>
```

---

### ❌ WRONG: space-y-4 for Single Child

```tsx
// Unnecessary wrapper for single child
<div className="flex-1 overflow-y-auto pb-6">
  <div className="space-y-4">
    <EntityForm />  {/* Only one child */}
  </div>
</div>
```

### ✅ CORRECT: No Wrapper for Single Child

```tsx
<div className="flex-1 overflow-y-auto pb-6">
  <EntityForm />
</div>
```

---

### ❌ WRONG: Margin on PageHeader

```tsx
<PageHeader className="mb-4" />
```

### ✅ CORRECT: Gap on Parent Container

```tsx
<div className="h-full flex flex-col gap-4">
  <PageHeader className="flex-shrink-0" />
  {/* ... */}
</div>
```

---

### ❌ WRONG: Missing flex-shrink-0 on Header

```tsx
// Header may shrink when content is large
<PageHeader />
```

### ✅ CORRECT: Always Prevent Header Shrinking

```tsx
<PageHeader className="flex-shrink-0" />
```

---

## PageHeader Variants

The PageHeader component conditionally renders content based on variant:

### List Variant
```tsx
<PageHeader
  variant="list"
  search={{                         // Optional
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: "Buscar...",
  }}
  filters={{                        // Optional
    active: activeFilters,
    onClearAll: clearFilters,
    onClearFilter: clearFilter,
    onOpenFilters: openFilterDialog,
  }}
  viewControls={{                   // Optional
    selectedToggle: {
      count: selectedCount,
      active: showSelected,
      onToggle: setShowSelected,
    },
  }}
  export={{                         // Optional
    onExport: handleExport,
    loading: isExporting,
  }}
/>
```

**Note**: If none of these props are provided, the list variant renders with the same height as other variants.

### Detail Variant
```tsx
<PageHeader
  variant="detail"
  entity={entity}                   // Optional: for entity info
  status={{                         // Optional: status badge
    label: "Active",
    variant: "default",
  }}
  metrics={[                        // Optional: key metrics
    {
      label: "Total",
      value: "100",
      icon: IconPackage,
    },
  ]}
/>
```

### Form Variant
```tsx
<PageHeader
  variant="form"
  progress={{                       // Optional: form progress
    current: 2,
    total: 4,
    steps: [
      { label: "Step 1", completed: true },
      { label: "Step 2", completed: true },
      { label: "Step 3", completed: false },
      { label: "Step 4", completed: false },
    ],
  }}
  isDirty={true}                    // Optional: form dirty state
  isSubmitting={false}              // Optional: submission state
  hasErrors={false}                 // Optional: validation state
/>
```

### Batch Variant
```tsx
<PageHeader
  variant="batch"
  selection={{                      // Selection info
    count: 5,
    total: 100,
    entityName: "produtos",
    onClearSelection: clearSelection,
  }}
  progress={{                       // Optional: batch progress
    current: 3,
    total: 5,
    label: "Processando...",
  }}
  isProcessing={false}              // Optional: processing state
/>
```

---

## Summary Checklist

When creating or updating a page, ensure:

- [ ] Page uses `gap-4` pattern for fixed header spacing
- [ ] PageHeader has `className="flex-shrink-0"`
- [ ] Scrollable container has `overflow-y-auto pb-6`
- [ ] No `pt-4`, `mt-4`, or `space-y-4` on scrollable containers
- [ ] Form components use wrapper `<div className="space-y-4">` for cards
- [ ] Form element does NOT have `className="space-y-4"`
- [ ] All cards use default white background (no `bg-transparent`)
- [ ] Breadcrumbs follow proper hierarchy
- [ ] Actions use consistent patterns (refresh, edit, submit, cancel)
- [ ] Loading states use proper skeletons
- [ ] Error states provide navigation options
- [ ] Detail pages use `space-y-4` wrapper only when multiple sections exist
- [ ] List pages use `min-h-0` and pass `className="h-full"` to list component

---

## Implementation Order

When standardizing pages, follow this order:

1. **Update page container structure**
   - Add `gap-4` to flex container
   - Remove any margin/padding from inner elements

2. **Update PageHeader**
   - Add `className="flex-shrink-0"`
   - Set appropriate `variant`
   - Standardize breadcrumbs
   - Standardize actions

3. **Update scrollable container**
   - Ensure `overflow-y-auto pb-6`
   - Remove `pt-4` or `space-y-4` if present

4. **Update form components (if applicable)**
   - Move `space-y-4` to wrapper div
   - Remove from form element
   - Ensure hidden submit button is first

5. **Test scrolling behavior**
   - Verify header stays fixed
   - Verify spacing doesn't disappear
   - Verify smooth scrolling

---

## Reference Implementation

See these files for complete working examples:
- **List**: `src/pages/inventory/products/list.tsx`
- **Detail**: `src/pages/inventory/products/details/[id].tsx`
- **Create**: `src/pages/inventory/products/create.tsx`
- **Edit**: `src/pages/inventory/products/edit/[id].tsx`
- **Batch**: `src/pages/inventory/products/batch-edit.tsx`
- **Form Component**: `src/components/inventory/item/form/item-form.tsx`
- **PageHeader**: `src/components/ui/page-header.tsx`
