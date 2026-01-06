# Standardization Prompt Template

Use this prompt to standardize any module's pages to match the exact structure documented in `STANDARDIZED_PAGE_STRUCTURE.md`.

---

## Prompt for Claude

```
I need you to standardize ALL pages in the {MODULE_NAME} module to match the EXACT structure documented in STANDARDIZED_PAGE_STRUCTURE.md.

**Module**: {MODULE_NAME} (e.g., "administration/customers", "human-resources/positions", "production/tasks")

**Pages to standardize**:
- List page: src/pages/{MODULE_PATH}/list.tsx
- Detail page: src/pages/{MODULE_PATH}/details/[id].tsx
- Create page: src/pages/{MODULE_PATH}/create.tsx
- Edit page: src/pages/{MODULE_PATH}/edit/[id].tsx
- Batch edit page: src/pages/{MODULE_PATH}/batch-edit.tsx (if exists)

**CRITICAL Requirements**:

1. Read STANDARDIZED_PAGE_STRUCTURE.md FIRST to understand the exact patterns
2. Use inventory/products pages as reference implementation
3. Apply the EXACT same structure:
   - `gap-4` pattern for fixed header spacing
   - `flex-shrink-0` on PageHeader
   - NO margin/padding on scrollable containers
   - Proper form wrapper structure with space-y-4
4. Maintain all existing functionality
5. Keep all existing props, handlers, and business logic
6. Only update the structure, spacing, and layout patterns

**Do NOT**:
- Change any business logic
- Remove any features or functionality
- Modify data fetching or mutations
- Change form validation
- Alter permission checks

**Process**:
1. Read STANDARDIZED_PAGE_STRUCTURE.md
2. Analyze each page file
3. Update structure to match documentation exactly
4. Verify build succeeds with `npm run build`
5. Confirm all pages follow the checklist in the documentation

**Form components** (if applicable):
Also update the form component at: src/components/{MODULE_PATH}/form/{entity}-form.tsx
- Move `space-y-4` to wrapper div
- Remove from form element
- Ensure hidden submit button is first

Start with the list page, then detail, then create, then edit, then batch-edit (if exists).
```

---

## Quick Reference for Common Modules

### Administration
```
Module: administration/customers
Pages: list, details, create, edit, batch-edit
Form: src/components/administration/customer/form/customer-form.tsx
```

```
Module: administration/users
Pages: list, details, edit, batch-edit
Form: src/components/administration/user/form/user-form.tsx
```

```
Module: administration/sectors
Pages: list, details, create, edit
Form: src/components/administration/sector/form/sector-form.tsx
```

### Human Resources
```
Module: human-resources/positions
Pages: list, details, create, edit, batch-edit
Form: src/components/human-resources/position/form/position-form.tsx
```

```
Module: human-resources/vacations
Pages: list, details, create, edit, batch-edit
Form: src/components/human-resources/vacation/form/vacation-form.tsx
```

```
Module: human-resources/warnings
Pages: list, details, create, edit, batch-edit
Form: src/components/human-resources/warning/form/warning-form.tsx
```

### Production
```
Module: production/tasks
Pages: list, details, create, edit, batch-edit
Form: src/components/production/task/form/task-form.tsx
```

```
Module: production/observations
Pages: list, details, create, edit
Form: src/components/production/observation/form/observation-form.tsx
```

```
Module: production/cutting
Pages: list, details, create, edit
Form: src/components/production/cut/form/cut-form.tsx
```

### Painting
```
Module: painting/catalog
Pages: list, details, create, edit
Form: src/components/painting/catalogue/form/paint-form.tsx
```

```
Module: painting/productions
Pages: list, details
No form (read-only)
```

---

## Example Usage

### Standardizing Administration Customers Module

```
I need you to standardize ALL pages in the administration/customers module to match the EXACT structure documented in STANDARDIZED_PAGE_STRUCTURE.md.

**Module**: administration/customers

**Pages to standardize**:
- List page: src/pages/administration/customers/list.tsx
- Detail page: src/pages/administration/customers/details/[id].tsx
- Create page: src/pages/administration/customers/create.tsx
- Edit page: src/pages/administration/customers/edit/[id].tsx
- Batch edit page: src/pages/administration/customers/batch-edit.tsx

**CRITICAL Requirements**:

1. Read STANDARDIZED_PAGE_STRUCTURE.md FIRST to understand the exact patterns
2. Use inventory/products pages as reference implementation
3. Apply the EXACT same structure:
   - `gap-4` pattern for fixed header spacing
   - `flex-shrink-0` on PageHeader
   - NO margin/padding on scrollable containers
   - Proper form wrapper structure with space-y-4
4. Maintain all existing functionality
5. Keep all existing props, handlers, and business logic
6. Only update the structure, spacing, and layout patterns

**Do NOT**:
- Change any business logic
- Remove any features or functionality
- Modify data fetching or mutations
- Change form validation
- Alter permission checks

**Process**:
1. Read STANDARDIZED_PAGE_STRUCTURE.md
2. Analyze each page file
3. Update structure to match documentation exactly
4. Verify build succeeds with `npm run build`
5. Confirm all pages follow the checklist in the documentation

**Form components**:
Also update the form component at: src/components/administration/customer/form/customer-form.tsx
- Move `space-y-4` to wrapper div
- Remove from form element
- Ensure hidden submit button is first

Start with the list page, then detail, then create, then edit, then batch-edit.
```

---

## Batch Standardization

If you want to standardize multiple modules at once:

```
I need you to standardize ALL pages in the following modules to match the EXACT structure documented in STANDARDIZED_PAGE_STRUCTURE.md:

1. administration/customers
2. administration/users
3. administration/sectors

For EACH module, standardize:
- List page
- Detail page
- Create page (if exists)
- Edit page (if exists)
- Batch edit page (if exists)
- Form component (if exists)

Follow the requirements and process outlined in STANDARDIZATION_PROMPT.md.

Work on one module at a time, completing all pages in a module before moving to the next.
After each module, verify the build succeeds.

Start with administration/customers.
```

---

## Verification After Standardization

After Claude completes the standardization, verify:

1. **Build succeeds**: `npm run build`
2. **Visual check**: Open each page and verify:
   - Header stays fixed when scrolling
   - Spacing between header and content doesn't disappear
   - All cards have white backgrounds
   - Form sections have consistent spacing
3. **Functionality check**:
   - Forms still submit correctly
   - Navigation works
   - Actions (edit, delete, etc.) work
   - Filters and search work (if applicable)

---

## Notes

- Always reference `STANDARDIZED_PAGE_STRUCTURE.md` for the complete documentation
- Use `inventory/products` pages as working examples
- The standardization should be purely structural - no business logic changes
- If Claude encounters pages with unusual patterns, ask for clarification before proceeding
