# Web App Hooks Reorganization — Continuation Plan

## Status Summary

| Phase | Status | Commit |
|-------|--------|--------|
| Phase 1: Move Representatives | DONE | `d0a3401` — refactor: move representatives components |
| Phase 2: Rename Hooks to kebab-case | DONE | `905210d` — refactor: rename all hook files to kebab-case |
| Phase 3: Organize Hooks into Domain Folders | **IN PROGRESS** — files moved, imports NOT yet fixed | **uncommitted** |

---

## Phase 3: What's Been Done

All hook files have been `git mv`'d into domain subdirectories. The current structure is:

```
src/hooks/
├── index.ts                          ← NEEDS REWRITE (still points to old flat paths)
├── common/                           (45 files + filters/ + __tests__/)
│   ├── use-auth.ts, use-privileges.ts
│   ├── query-keys.ts, create-entity-hooks.ts
│   ├── use-edit-form.ts, create-form-url-state.ts
│   ├── use-search-input.ts, use-advanced-search.tsx
│   ├── use-table-state.ts, use-table-filters.ts, use-unified-table-state.ts
│   ├── use-column-visibility.ts, use-column-widths.ts
│   ├── use-pagination-state.ts, use-advanced-table-selection.ts
│   ├── use-url-state.ts, use-url-params.ts, use-url-filters.ts, use-url-state-coordinator.ts
│   ├── use-socket.ts, use-notification-socket.ts, use-notification-center.ts
│   ├── use-file.ts, use-media-viewer.ts, use-preferences.ts
│   ├── use-page-tracker.ts, use-dashboard.ts
│   ├── use-toast.ts, use-debounce.ts, use-debounced-value.ts, use-throttler.ts
│   ├── use-cancelable-query.ts, use-stable-query.ts, query-error-monitor.ts
│   ├── use-batch-result-dialog.ts, use-entity-details.ts
│   ├── use-dynamic-grid.ts, use-infinite-scroll.ts, use-scrollbar-width.ts
│   ├── use-section-visibility.ts, use-smart-menu-position.ts
│   ├── use-cep-lookup.ts, use-cnpj-autocomplete.ts, use-cnpj-lookup.ts
│   ├── filters/
│   │   ├── index.ts, use-filter-state.ts, use-filter-presets.ts, use-group-by-state.ts
│   └── __tests__/
│       └── use-socket.test.ts
├── production/                       (9 files + task/)
│   ├── use-task.ts, use-task-pricing.ts
│   ├── use-activity.ts, use-activity-form-url-state.ts
│   ├── use-service-order.ts, use-observation.ts
│   ├── use-cut.ts, use-cut-item-filters.ts, use-airbrushing.ts
│   └── task/
│       └── use-task-form-url-state.ts
├── inventory/                        (20 files)
│   ├── use-item.ts, use-item-brand.ts, use-item-category.ts
│   ├── use-item-filters.ts, use-item-form-url-state.ts
│   ├── use-order.ts, use-order-item.ts, use-order-schedule.ts
│   ├── use-order-form-url-state.ts, use-order-analytics.ts
│   ├── use-supplier.ts, use-supplier-filters.ts
│   ├── use-borrow.ts, use-borrow-form-url-state.ts
│   ├── use-external-withdrawal.ts, use-external-withdrawal-form-url-state.ts
│   ├── use-maintenance.ts
│   ├── use-stock-balance-form-url-state.ts, use-stock-metrics.ts
│   └── use-consumption-analytics.ts
├── painting/                         (7 files)
│   ├── paint-hooks.ts (aggregation barrel — absorb into index.ts)
│   ├── use-paint.ts, use-paint-brand.ts
│   ├── use-paint-formula.ts, use-paint-formula-component.ts
│   ├── use-paint-production.ts, use-paint-type.ts
├── human-resources/                  (11 files)
│   ├── use-user.ts, use-user-filters.ts
│   ├── use-position.ts, use-position-remuneration.ts
│   ├── use-vacation.ts, use-warning.ts, use-holiday.ts
│   ├── use-ppe.ts, use-bonus.ts, use-payroll.ts, use-team-staff.ts
├── administration/                   (12 files)
│   ├── use-customer.ts, use-customer-filters.ts
│   ├── use-sector.ts, use-layout.ts, use-layout-section.ts
│   ├── use-changelog.ts, use-representative.ts
│   ├── use-notification.ts, use-notification-admin.ts
│   ├── use-notification-configuration.ts, use-notification-preferences.ts
│   └── use-message.ts
├── server/                           (4 files)
│   ├── use-server.ts, use-backup.ts, use-backup-progress.ts, use-deployment.ts
└── integrations/                     (2 files)
    ├── use-secullum.ts, use-secullum-integration.ts
```

---

## Phase 3: What STILL Needs to Be Done

### Step 1: Fix Internal Cross-References Within Hooks

Files in non-common domains still import `./query-keys` and `./create-entity-hooks` as if they're in the same directory. They need `../common/` prefix.

**Apply sed to ALL .ts/.tsx files in hooks/ subdirectories (EXCLUDING common/):**

```bash
cd /home/kennedy/Documents/repositories/web

# Fix ./query-keys → ../common/query-keys (in non-common dirs)
find src/hooks/production src/hooks/inventory src/hooks/painting src/hooks/human-resources src/hooks/administration src/hooks/server src/hooks/integrations -type f \( -name '*.ts' -o -name '*.tsx' \) \
  -exec sed -i \
    -e 's|from "./query-keys"|from "../common/query-keys"|g' \
    -e "s|from './query-keys'|from '../common/query-keys'|g" \
    -e 's|from "./create-entity-hooks"|from "../common/create-entity-hooks"|g' \
    -e "s|from './create-entity-hooks'|from '../common/create-entity-hooks'|g" \
    -e 's|from "./use-url-filters"|from "../common/use-url-filters"|g' \
    -e "s|from './use-url-filters'|from '../common/use-url-filters'|g" \
    {} +
```

**Affected: ~38 files for query-keys, ~31 files for create-entity-hooks, ~12 files for use-url-filters**

Note: `production/task/use-task-form-url-state.ts` already imports from `"../common/use-url-filters"` — needs to become `"../../common/use-url-filters"` since it's two levels deep.

### Step 2: Fix Relative Imports to External Modules

Files moved one level deeper, so `../api-client` → `../../api-client`, etc.

**Apply sed to ALL .ts/.tsx files in hooks/ subdirectories (EXCLUDING common/ which also needs this):**

Actually **ALL** subdirectories need this fix (including common/), because they ALL moved one level deeper:

```bash
find src/hooks/common src/hooks/production src/hooks/inventory src/hooks/painting src/hooks/human-resources src/hooks/administration src/hooks/server src/hooks/integrations -type f \( -name '*.ts' -o -name '*.tsx' \) \
  -exec sed -i \
    -e 's|from "\.\./api-client"|from "../../api-client"|g' \
    -e "s|from '\.\./api-client'|from '../../api-client'|g" \
    -e 's|from "\.\./types"|from "../../types"|g' \
    -e "s|from '\.\./types'|from '../../types'|g" \
    -e 's|from "\.\./types/|from "../../types/|g' \
    -e "s|from '\.\./types/|from '../../types/|g" \
    -e 's|from "\.\./schemas"|from "../../schemas"|g' \
    -e "s|from '\.\./schemas'|from '../../schemas'|g" \
    -e 's|from "\.\./constants"|from "../../constants"|g' \
    -e "s|from '\.\./constants'|from '../../constants'|g" \
    -e 's|from "\.\./constants/|from "../../constants/|g' \
    -e "s|from '\.\./constants/|from '../../constants/|g" \
    -e 's|from "\.\./utils"|from "../../utils"|g' \
    -e "s|from '\.\./utils'|from '../../utils'|g" \
    -e 's|from "\.\./utils/|from "../../utils/|g' \
    -e "s|from '\.\./utils/|from '../../utils/|g" \
    -e 's|from "\.\./lib/|from "../../lib/|g' \
    -e "s|from '\.\./lib/|from '../../lib/|g" \
    -e 's|from "\.\./contexts/|from "../../contexts/|g' \
    -e "s|from '\.\./contexts/|from '../../contexts/|g" \
    -e 's|from "\.\./services/|from "../../services/|g' \
    -e "s|from '\.\./services/|from '../../services/|g" \
    {} +
```

**Also handle `production/task/` which is TWO levels deep** — its `../common/use-url-filters` needs to become `../../common/use-url-filters`:

```bash
sed -i 's|from "\.\./common/use-url-filters"|from "../../common/use-url-filters"|g' \
  src/hooks/production/task/use-task-form-url-state.ts
```

**Affected: ~80+ files for api-client, ~90+ for types, ~60+ for schemas, ~30+ for constants, etc.**

### Step 3: Fix External `@/hooks/xxx` Imports (Entire Codebase)

~490 import statements across ~324 files reference hooks using the `@/hooks/` alias. Each needs a domain prefix inserted.

**Build a sed script for all hook-to-domain mappings:**

```bash
# Create sed file for @/hooks/ path updates
cat > /tmp/phase3-external-sed.txt << 'SED'
# Production hooks
s|@/hooks/use-task"|@/hooks/production/use-task"|g
s|@/hooks/use-task'|@/hooks/production/use-task'|g
s|@/hooks/use-task-pricing"|@/hooks/production/use-task-pricing"|g
s|@/hooks/use-task-pricing'|@/hooks/production/use-task-pricing'|g
s|@/hooks/use-activity-form-url-state"|@/hooks/production/use-activity-form-url-state"|g
s|@/hooks/use-activity-form-url-state'|@/hooks/production/use-activity-form-url-state'|g
s|@/hooks/use-activity"|@/hooks/production/use-activity"|g
s|@/hooks/use-activity'|@/hooks/production/use-activity'|g
s|@/hooks/use-service-order"|@/hooks/production/use-service-order"|g
s|@/hooks/use-service-order'|@/hooks/production/use-service-order'|g
s|@/hooks/use-observation"|@/hooks/production/use-observation"|g
s|@/hooks/use-observation'|@/hooks/production/use-observation'|g
s|@/hooks/use-cut-item-filters"|@/hooks/production/use-cut-item-filters"|g
s|@/hooks/use-cut-item-filters'|@/hooks/production/use-cut-item-filters'|g
s|@/hooks/use-cut"|@/hooks/production/use-cut"|g
s|@/hooks/use-cut'|@/hooks/production/use-cut'|g
s|@/hooks/use-airbrushing"|@/hooks/production/use-airbrushing"|g
s|@/hooks/use-airbrushing'|@/hooks/production/use-airbrushing'|g
s|@/hooks/task/use-task-form-url-state"|@/hooks/production/task/use-task-form-url-state"|g
s|@/hooks/task/use-task-form-url-state'|@/hooks/production/task/use-task-form-url-state'|g

# Inventory hooks
s|@/hooks/use-item-form-url-state"|@/hooks/inventory/use-item-form-url-state"|g
s|@/hooks/use-item-form-url-state'|@/hooks/inventory/use-item-form-url-state'|g
s|@/hooks/use-item-filters"|@/hooks/inventory/use-item-filters"|g
s|@/hooks/use-item-filters'|@/hooks/inventory/use-item-filters'|g
s|@/hooks/use-item-brand"|@/hooks/inventory/use-item-brand"|g
s|@/hooks/use-item-brand'|@/hooks/inventory/use-item-brand'|g
s|@/hooks/use-item-category"|@/hooks/inventory/use-item-category"|g
s|@/hooks/use-item-category'|@/hooks/inventory/use-item-category'|g
s|@/hooks/use-item"|@/hooks/inventory/use-item"|g
s|@/hooks/use-item'|@/hooks/inventory/use-item'|g
s|@/hooks/use-order-form-url-state"|@/hooks/inventory/use-order-form-url-state"|g
s|@/hooks/use-order-form-url-state'|@/hooks/inventory/use-order-form-url-state'|g
s|@/hooks/use-order-analytics"|@/hooks/inventory/use-order-analytics"|g
s|@/hooks/use-order-analytics'|@/hooks/inventory/use-order-analytics'|g
s|@/hooks/use-order-item"|@/hooks/inventory/use-order-item"|g
s|@/hooks/use-order-item'|@/hooks/inventory/use-order-item'|g
s|@/hooks/use-order-schedule"|@/hooks/inventory/use-order-schedule"|g
s|@/hooks/use-order-schedule'|@/hooks/inventory/use-order-schedule'|g
s|@/hooks/use-order"|@/hooks/inventory/use-order"|g
s|@/hooks/use-order'|@/hooks/inventory/use-order'|g
s|@/hooks/use-supplier-filters"|@/hooks/inventory/use-supplier-filters"|g
s|@/hooks/use-supplier-filters'|@/hooks/inventory/use-supplier-filters'|g
s|@/hooks/use-supplier"|@/hooks/inventory/use-supplier"|g
s|@/hooks/use-supplier'|@/hooks/inventory/use-supplier'|g
s|@/hooks/use-borrow-form-url-state"|@/hooks/inventory/use-borrow-form-url-state"|g
s|@/hooks/use-borrow-form-url-state'|@/hooks/inventory/use-borrow-form-url-state'|g
s|@/hooks/use-borrow"|@/hooks/inventory/use-borrow"|g
s|@/hooks/use-borrow'|@/hooks/inventory/use-borrow'|g
s|@/hooks/use-external-withdrawal-form-url-state"|@/hooks/inventory/use-external-withdrawal-form-url-state"|g
s|@/hooks/use-external-withdrawal-form-url-state'|@/hooks/inventory/use-external-withdrawal-form-url-state'|g
s|@/hooks/use-external-withdrawal"|@/hooks/inventory/use-external-withdrawal"|g
s|@/hooks/use-external-withdrawal'|@/hooks/inventory/use-external-withdrawal'|g
s|@/hooks/use-maintenance"|@/hooks/inventory/use-maintenance"|g
s|@/hooks/use-maintenance'|@/hooks/inventory/use-maintenance'|g
s|@/hooks/use-stock-balance-form-url-state"|@/hooks/inventory/use-stock-balance-form-url-state"|g
s|@/hooks/use-stock-balance-form-url-state'|@/hooks/inventory/use-stock-balance-form-url-state'|g
s|@/hooks/use-stock-metrics"|@/hooks/inventory/use-stock-metrics"|g
s|@/hooks/use-stock-metrics'|@/hooks/inventory/use-stock-metrics'|g
s|@/hooks/use-consumption-analytics"|@/hooks/inventory/use-consumption-analytics"|g
s|@/hooks/use-consumption-analytics'|@/hooks/inventory/use-consumption-analytics'|g

# Painting hooks
s|@/hooks/paint-hooks"|@/hooks/painting/paint-hooks"|g
s|@/hooks/paint-hooks'|@/hooks/painting/paint-hooks'|g
s|@/hooks/use-paint-formula-component"|@/hooks/painting/use-paint-formula-component"|g
s|@/hooks/use-paint-formula-component'|@/hooks/painting/use-paint-formula-component'|g
s|@/hooks/use-paint-production"|@/hooks/painting/use-paint-production"|g
s|@/hooks/use-paint-production'|@/hooks/painting/use-paint-production'|g
s|@/hooks/use-paint-formula"|@/hooks/painting/use-paint-formula"|g
s|@/hooks/use-paint-formula'|@/hooks/painting/use-paint-formula'|g
s|@/hooks/use-paint-brand"|@/hooks/painting/use-paint-brand"|g
s|@/hooks/use-paint-brand'|@/hooks/painting/use-paint-brand'|g
s|@/hooks/use-paint-type"|@/hooks/painting/use-paint-type"|g
s|@/hooks/use-paint-type'|@/hooks/painting/use-paint-type'|g
s|@/hooks/use-paint"|@/hooks/painting/use-paint"|g
s|@/hooks/use-paint'|@/hooks/painting/use-paint'|g

# Human Resources hooks
s|@/hooks/use-user-filters"|@/hooks/human-resources/use-user-filters"|g
s|@/hooks/use-user-filters'|@/hooks/human-resources/use-user-filters'|g
s|@/hooks/use-user"|@/hooks/human-resources/use-user"|g
s|@/hooks/use-user'|@/hooks/human-resources/use-user'|g
s|@/hooks/use-position-remuneration"|@/hooks/human-resources/use-position-remuneration"|g
s|@/hooks/use-position-remuneration'|@/hooks/human-resources/use-position-remuneration'|g
s|@/hooks/use-position"|@/hooks/human-resources/use-position"|g
s|@/hooks/use-position'|@/hooks/human-resources/use-position'|g
s|@/hooks/use-vacation"|@/hooks/human-resources/use-vacation"|g
s|@/hooks/use-vacation'|@/hooks/human-resources/use-vacation'|g
s|@/hooks/use-warning"|@/hooks/human-resources/use-warning"|g
s|@/hooks/use-warning'|@/hooks/human-resources/use-warning'|g
s|@/hooks/use-holiday"|@/hooks/human-resources/use-holiday"|g
s|@/hooks/use-holiday'|@/hooks/human-resources/use-holiday'|g
s|@/hooks/use-ppe"|@/hooks/human-resources/use-ppe"|g
s|@/hooks/use-ppe'|@/hooks/human-resources/use-ppe'|g
s|@/hooks/use-bonus"|@/hooks/human-resources/use-bonus"|g
s|@/hooks/use-bonus'|@/hooks/human-resources/use-bonus'|g
s|@/hooks/use-payroll"|@/hooks/human-resources/use-payroll"|g
s|@/hooks/use-payroll'|@/hooks/human-resources/use-payroll'|g
s|@/hooks/use-team-staff"|@/hooks/human-resources/use-team-staff"|g
s|@/hooks/use-team-staff'|@/hooks/human-resources/use-team-staff'|g

# Administration hooks
s|@/hooks/use-customer-filters"|@/hooks/administration/use-customer-filters"|g
s|@/hooks/use-customer-filters'|@/hooks/administration/use-customer-filters'|g
s|@/hooks/use-customer"|@/hooks/administration/use-customer"|g
s|@/hooks/use-customer'|@/hooks/administration/use-customer'|g
s|@/hooks/use-sector"|@/hooks/administration/use-sector"|g
s|@/hooks/use-sector'|@/hooks/administration/use-sector'|g
s|@/hooks/use-layout-section"|@/hooks/administration/use-layout-section"|g
s|@/hooks/use-layout-section'|@/hooks/administration/use-layout-section'|g
s|@/hooks/use-layout"|@/hooks/administration/use-layout"|g
s|@/hooks/use-layout'|@/hooks/administration/use-layout'|g
s|@/hooks/use-changelog"|@/hooks/administration/use-changelog"|g
s|@/hooks/use-changelog'|@/hooks/administration/use-changelog'|g
s|@/hooks/use-representative"|@/hooks/administration/use-representative"|g
s|@/hooks/use-representative'|@/hooks/administration/use-representative'|g
s|@/hooks/use-notification-admin"|@/hooks/administration/use-notification-admin"|g
s|@/hooks/use-notification-admin'|@/hooks/administration/use-notification-admin'|g
s|@/hooks/use-notification-configuration"|@/hooks/administration/use-notification-configuration"|g
s|@/hooks/use-notification-configuration'|@/hooks/administration/use-notification-configuration'|g
s|@/hooks/use-notification-preferences"|@/hooks/administration/use-notification-preferences"|g
s|@/hooks/use-notification-preferences'|@/hooks/administration/use-notification-preferences'|g
s|@/hooks/use-notification"|@/hooks/administration/use-notification"|g
s|@/hooks/use-notification'|@/hooks/administration/use-notification'|g
s|@/hooks/use-message"|@/hooks/administration/use-message"|g
s|@/hooks/use-message'|@/hooks/administration/use-message'|g

# Server hooks
s|@/hooks/use-server"|@/hooks/server/use-server"|g
s|@/hooks/use-server'|@/hooks/server/use-server'|g
s|@/hooks/use-backup-progress"|@/hooks/server/use-backup-progress"|g
s|@/hooks/use-backup-progress'|@/hooks/server/use-backup-progress'|g
s|@/hooks/use-backup"|@/hooks/server/use-backup"|g
s|@/hooks/use-backup'|@/hooks/server/use-backup'|g
s|@/hooks/use-deployment"|@/hooks/server/use-deployment"|g
s|@/hooks/use-deployment'|@/hooks/server/use-deployment'|g

# Integration hooks
s|@/hooks/use-secullum-integration"|@/hooks/integrations/use-secullum-integration"|g
s|@/hooks/use-secullum-integration'|@/hooks/integrations/use-secullum-integration'|g
s|@/hooks/use-secullum"|@/hooks/integrations/use-secullum"|g
s|@/hooks/use-secullum'|@/hooks/integrations/use-secullum'|g

# Common hooks (longest first to avoid partial matches)
s|@/hooks/use-notification-center"|@/hooks/common/use-notification-center"|g
s|@/hooks/use-notification-center'|@/hooks/common/use-notification-center'|g
s|@/hooks/use-notification-socket"|@/hooks/common/use-notification-socket"|g
s|@/hooks/use-notification-socket'|@/hooks/common/use-notification-socket'|g
s|@/hooks/use-advanced-table-selection"|@/hooks/common/use-advanced-table-selection"|g
s|@/hooks/use-advanced-table-selection'|@/hooks/common/use-advanced-table-selection'|g
s|@/hooks/use-url-state-coordinator"|@/hooks/common/use-url-state-coordinator"|g
s|@/hooks/use-url-state-coordinator'|@/hooks/common/use-url-state-coordinator'|g
s|@/hooks/use-unified-table-state"|@/hooks/common/use-unified-table-state"|g
s|@/hooks/use-unified-table-state'|@/hooks/common/use-unified-table-state'|g
s|@/hooks/use-cnpj-autocomplete"|@/hooks/common/use-cnpj-autocomplete"|g
s|@/hooks/use-cnpj-autocomplete'|@/hooks/common/use-cnpj-autocomplete'|g
s|@/hooks/use-column-visibility"|@/hooks/common/use-column-visibility"|g
s|@/hooks/use-column-visibility'|@/hooks/common/use-column-visibility'|g
s|@/hooks/use-smart-menu-position"|@/hooks/common/use-smart-menu-position"|g
s|@/hooks/use-smart-menu-position'|@/hooks/common/use-smart-menu-position'|g
s|@/hooks/use-section-visibility"|@/hooks/common/use-section-visibility"|g
s|@/hooks/use-section-visibility'|@/hooks/common/use-section-visibility'|g
s|@/hooks/use-batch-result-dialog"|@/hooks/common/use-batch-result-dialog"|g
s|@/hooks/use-batch-result-dialog'|@/hooks/common/use-batch-result-dialog'|g
s|@/hooks/create-form-url-state"|@/hooks/common/create-form-url-state"|g
s|@/hooks/create-form-url-state'|@/hooks/common/create-form-url-state'|g
s|@/hooks/create-entity-hooks"|@/hooks/common/create-entity-hooks"|g
s|@/hooks/create-entity-hooks'|@/hooks/common/create-entity-hooks'|g
s|@/hooks/use-cancelable-query"|@/hooks/common/use-cancelable-query"|g
s|@/hooks/use-cancelable-query'|@/hooks/common/use-cancelable-query'|g
s|@/hooks/use-advanced-search"|@/hooks/common/use-advanced-search"|g
s|@/hooks/use-advanced-search'|@/hooks/common/use-advanced-search'|g
s|@/hooks/use-debounced-value"|@/hooks/common/use-debounced-value"|g
s|@/hooks/use-debounced-value'|@/hooks/common/use-debounced-value'|g
s|@/hooks/use-pagination-state"|@/hooks/common/use-pagination-state"|g
s|@/hooks/use-pagination-state'|@/hooks/common/use-pagination-state'|g
s|@/hooks/use-scrollbar-width"|@/hooks/common/use-scrollbar-width"|g
s|@/hooks/use-scrollbar-width'|@/hooks/common/use-scrollbar-width'|g
s|@/hooks/use-entity-details"|@/hooks/common/use-entity-details"|g
s|@/hooks/use-entity-details'|@/hooks/common/use-entity-details'|g
s|@/hooks/use-infinite-scroll"|@/hooks/common/use-infinite-scroll"|g
s|@/hooks/use-infinite-scroll'|@/hooks/common/use-infinite-scroll'|g
s|@/hooks/use-table-filters"|@/hooks/common/use-table-filters"|g
s|@/hooks/use-table-filters'|@/hooks/common/use-table-filters'|g
s|@/hooks/use-column-widths"|@/hooks/common/use-column-widths"|g
s|@/hooks/use-column-widths'|@/hooks/common/use-column-widths'|g
s|@/hooks/use-search-input"|@/hooks/common/use-search-input"|g
s|@/hooks/use-search-input'|@/hooks/common/use-search-input'|g
s|@/hooks/use-page-tracker"|@/hooks/common/use-page-tracker"|g
s|@/hooks/use-page-tracker'|@/hooks/common/use-page-tracker'|g
s|@/hooks/use-table-state"|@/hooks/common/use-table-state"|g
s|@/hooks/use-table-state'|@/hooks/common/use-table-state'|g
s|@/hooks/use-media-viewer"|@/hooks/common/use-media-viewer"|g
s|@/hooks/use-media-viewer'|@/hooks/common/use-media-viewer'|g
s|@/hooks/use-dynamic-grid"|@/hooks/common/use-dynamic-grid"|g
s|@/hooks/use-dynamic-grid'|@/hooks/common/use-dynamic-grid'|g
s|@/hooks/query-error-monitor"|@/hooks/common/query-error-monitor"|g
s|@/hooks/query-error-monitor'|@/hooks/common/query-error-monitor'|g
s|@/hooks/use-url-filters"|@/hooks/common/use-url-filters"|g
s|@/hooks/use-url-filters'|@/hooks/common/use-url-filters'|g
s|@/hooks/use-url-params"|@/hooks/common/use-url-params"|g
s|@/hooks/use-url-params'|@/hooks/common/use-url-params'|g
s|@/hooks/use-url-state"|@/hooks/common/use-url-state"|g
s|@/hooks/use-url-state'|@/hooks/common/use-url-state'|g
s|@/hooks/use-preferences"|@/hooks/common/use-preferences"|g
s|@/hooks/use-preferences'|@/hooks/common/use-preferences'|g
s|@/hooks/use-privileges"|@/hooks/common/use-privileges"|g
s|@/hooks/use-privileges'|@/hooks/common/use-privileges'|g
s|@/hooks/use-cnpj-lookup"|@/hooks/common/use-cnpj-lookup"|g
s|@/hooks/use-cnpj-lookup'|@/hooks/common/use-cnpj-lookup'|g
s|@/hooks/use-edit-form"|@/hooks/common/use-edit-form"|g
s|@/hooks/use-edit-form'|@/hooks/common/use-edit-form'|g
s|@/hooks/use-cep-lookup"|@/hooks/common/use-cep-lookup"|g
s|@/hooks/use-cep-lookup'|@/hooks/common/use-cep-lookup'|g
s|@/hooks/use-dashboard"|@/hooks/common/use-dashboard"|g
s|@/hooks/use-dashboard'|@/hooks/common/use-dashboard'|g
s|@/hooks/use-stable-query"|@/hooks/common/use-stable-query"|g
s|@/hooks/use-stable-query'|@/hooks/common/use-stable-query'|g
s|@/hooks/use-debounce"|@/hooks/common/use-debounce"|g
s|@/hooks/use-debounce'|@/hooks/common/use-debounce'|g
s|@/hooks/use-throttler"|@/hooks/common/use-throttler"|g
s|@/hooks/use-throttler'|@/hooks/common/use-throttler'|g
s|@/hooks/use-socket"|@/hooks/common/use-socket"|g
s|@/hooks/use-socket'|@/hooks/common/use-socket'|g
s|@/hooks/query-keys"|@/hooks/common/query-keys"|g
s|@/hooks/query-keys'|@/hooks/common/query-keys'|g
s|@/hooks/use-toast"|@/hooks/common/use-toast"|g
s|@/hooks/use-toast'|@/hooks/common/use-toast'|g
s|@/hooks/use-auth"|@/hooks/common/use-auth"|g
s|@/hooks/use-auth'|@/hooks/common/use-auth'|g
s|@/hooks/use-file"|@/hooks/common/use-file"|g
s|@/hooks/use-file'|@/hooks/common/use-file'|g

# Filters barrel
s|@/hooks/filters"|@/hooks/common/filters"|g
s|@/hooks/filters'|@/hooks/common/filters'|g
s|@/hooks/filters/|@/hooks/common/filters/|g
SED

# Apply to ALL TypeScript files in src/ (outside hooks too)
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i -f /tmp/phase3-external-sed.txt {} +
```

**IMPORTANT ordering note:** Longer patterns must come before shorter ones to avoid partial matches. For example, `use-order-form-url-state` before `use-order`, `use-item-brand` before `use-item`, `use-notification-center` before `use-notification`, etc. The sed file above is already ordered correctly.

### Step 4: Fix Relative Imports from Outside hooks/ (../hooks/xxx → ../hooks/domain/xxx)

A few files use relative paths instead of `@/hooks/`:

```
src/pages/painting/formulas/list.tsx      — from "../../../hooks/use-auth"
src/pages/home.tsx                        — from "../hooks/use-page-tracker"
src/components/*/list/*-table.tsx          — from "../../../../hooks/use-auth"
src/components/human-resources/performance-levels/performance-level-table.tsx — from "../../../hooks/use-user"
```

These need manual attention — add the domain prefix in the path, e.g.:
- `../../../hooks/use-auth` → `../../../hooks/common/use-auth`
- `"../../../../hooks/use-auth"` → `"../../../../hooks/common/use-auth"`
- `"../../../hooks/use-user"` → `"../../../hooks/human-resources/use-user"`

**Quick fix with sed:**
```bash
# Fix relative ../hooks/ imports too
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path 'src/hooks/*' \
  -exec sed -i \
    -e 's|hooks/use-auth"|hooks/common/use-auth"|g' \
    -e "s|hooks/use-auth'|hooks/common/use-auth'|g" \
    -e 's|hooks/use-user"|hooks/human-resources/use-user"|g' \
    -e "s|hooks/use-user'|hooks/human-resources/use-user'|g" \
    -e 's|hooks/use-page-tracker"|hooks/common/use-page-tracker"|g' \
    -e "s|hooks/use-page-tracker'|hooks/common/use-page-tracker'|g" \
    {} +
```

Note: The `@/hooks/` sed in Step 3 should catch most of these since the pattern `hooks/use-auth"` is a substring. But verify with grep after.

### Step 5: Create Domain Barrel Files

Create an `index.ts` in each domain directory that re-exports all hooks.

**`src/hooks/common/index.ts`:**
```typescript
// Core Utilities & Factories
export * from "./query-keys";
export { createEntityHooks, createSpecializedQueryHook } from "./create-entity-hooks";
export type { EntityService, QueryKeys, EntityHooksConfig, SpecializedQueryConfig } from "./create-entity-hooks";
export * from "./use-edit-form";

// Authentication
export * from "./use-auth";
export * from "./use-privileges";

// UI & Form Hooks
export * from "./use-search-input";
export { useAdvancedSearch } from "./use-advanced-search";
export type { SearchField, SearchSuggestion, SearchEmptyState, UseAdvancedSearchOptions, UseAdvancedSearchReturn } from "./use-advanced-search";
export * from "./use-column-widths";

// Table & Data
export * from "./use-table-state";
export * from "./use-table-filters";
export * from "./use-unified-table-state";

// Socket & Real-time
export * from "./use-socket";
export * from "./use-notification-socket";
export * from "./use-notification-center";

// Files & Media
export * from "./use-file";
export * from "./use-media-viewer";

// Preferences & Dashboard
export * from "./use-preferences";
export * from "./use-dashboard";

// Filters
export * from "./filters";

// NOTE: query-error-monitor is NOT exported here to prevent module initialization issues
```

**`src/hooks/production/index.ts`:**
```typescript
export * from "./use-task";
export * from "./use-task-pricing";
export * from "./use-activity";
export * from "./use-service-order";
export * from "./use-observation";
export * from "./use-cut";
export * from "./use-airbrushing";
```

**`src/hooks/inventory/index.ts`:**
```typescript
export * from "./use-item";
export * from "./use-item-brand";
export * from "./use-item-category";
export * from "./use-order";
export * from "./use-order-item";
export * from "./use-order-schedule";
export * from "./use-supplier";
export * from "./use-borrow";
export * from "./use-external-withdrawal";
export * from "./use-maintenance";
```

**`src/hooks/painting/index.ts`:**
```typescript
// Absorb paint-hooks.ts barrel content here
export * from "./use-paint";
export * from "./use-paint-brand";
export * from "./use-paint-formula";
export * from "./use-paint-formula-component";
export * from "./use-paint-production";
export * from "./use-paint-type";
export * from "./paint-hooks";
```

**`src/hooks/human-resources/index.ts`:**
```typescript
export * from "./use-user";
export * from "./use-position";
export * from "./use-position-remuneration";
export * from "./use-holiday";
export * from "./use-vacation";
export * from "./use-warning";
export * from "./use-ppe";
export * from "./use-bonus";
export * from "./use-payroll";
export * from "./use-team-staff";
```

**`src/hooks/administration/index.ts`:**
```typescript
export * from "./use-customer";
export * from "./use-sector";
export * from "./use-layout";
export * from "./use-layout-section";
export * from "./use-changelog";
export * from "./use-representative";
export * from "./use-notification";
export * from "./use-message";
```

**`src/hooks/server/index.ts`:**
```typescript
export * from "./use-server";
export * from "./use-backup";
export * from "./use-deployment";
```

**`src/hooks/integrations/index.ts`:**
```typescript
export * from "./use-secullum";
```

### Step 6: Rewrite Main Barrel `src/hooks/index.ts`

Replace the entire file with:

```typescript
// Main hooks barrel — re-exports from domain barrels
export * from "./common";
export * from "./production";
export * from "./inventory";
export * from "./painting";
export * from "./human-resources";
export * from "./administration";
export * from "./server";
export * from "./integrations";
```

This keeps backward compatibility for any file importing from `@/hooks` (the barrel).

### Step 7: Validate

```bash
npx tsc --noEmit        # Catch all broken imports
pnpm build              # Full production build
```

If there are errors, they'll all be import path issues — fix them one by one using the TypeScript error output as a guide.

### Step 8: Commit

```bash
git add src/hooks/ src/  # Stage everything
git commit -m "refactor: organize hooks into domain subdirectories

Move all hooks into domain folders (common/, production/, inventory/,
painting/, human-resources/, administration/, server/, integrations/)
matching the component structure. Create domain barrel files and
update all import paths across the codebase.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Important Edge Cases to Watch

1. **`production/task/use-task-form-url-state.ts`** is TWO levels deep — its relative imports need `../../` not `../`
2. **`common/filters/`** is also nested — verify its internal imports still work
3. **`paint-hooks.ts`** is an aggregation barrel in `painting/` — consider absorbing its contents into `painting/index.ts` and deleting it
4. **Barrel imports `from "@/hooks"`** (no specific file) — these ~11 files should NOT need changes since the main barrel re-exports everything
5. **`common/use-url-filters.ts`** — the root-level copy was already deleted; the common copy is the one being kept
6. **`query-error-monitor.ts`** — intentionally NOT exported from barrel (import directly when needed)
7. **Some files use `@hooks/` alias** (with tsconfig path `@hooks/* → ./src/hooks/*`) — verify the sed catches those too

## How to Resume

Just tell Claude: "Continue the hooks reorganization from the plan in `REORGANIZATION_PLAN.md` — Phase 3 files are moved but imports aren't fixed yet. Start from Step 1."
