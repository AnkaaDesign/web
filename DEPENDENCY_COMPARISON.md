# Dependency Comparison: Before vs After

## Package Name
- **Before**: `ankaa_web`
- **After**: `ankaa-web` ✅

## Workspace Dependencies Removed (6 total)
| Package | Status |
|---------|--------|
| `@ankaa/api-client` | ❌ Removed |
| `@ankaa/constants` | ❌ Removed |
| `@ankaa/hooks` | ❌ Removed |
| `@ankaa/schemas` | ❌ Removed |
| `@ankaa/types` | ❌ Removed |
| `@ankaa/utils` | ❌ Removed |

## External Dependencies Added (6 total)
| Package | Version | Source Package |
|---------|---------|----------------|
| `axios` | ^1.9.0 | @ankaa/api-client |
| `jwt-decode` | ^4.0.0 | @ankaa/api-client |
| `qs` | ^6.13.0 | @ankaa/api-client |
| `lodash` | ^4.17.21 | @ankaa/hooks |
| `colorjs.io` | ^0.5.2 | @ankaa/utils |
| `@types/qs` | ^6.14.0 | @ankaa/api-client (devDep) |

## Already Present (kept unchanged)
These dependencies were already in the web app and are also used by shared packages:
- `@tanstack/react-query: ^5.83.0` ✅ (Required by @ankaa/hooks)
- `zod: ^3.25.67` ✅ (Required by @ankaa/schemas, @ankaa/hooks)
- `date-fns: ^4.1.0` ✅ (Required by @ankaa/utils)
- `react-hook-form: ^7.58.1` ✅ (Required by @ankaa/hooks)
- `@hookform/resolvers: ^3.10.0` ✅ (Required by @ankaa/hooks)
- `@types/lodash: ^4.17.13` ✅ (Already in devDependencies)

## Dependency Tree Flattened
```
Before (Monorepo):
ankaa-web
├── @ankaa/api-client
│   ├── axios
│   ├── qs
│   └── jwt-decode
├── @ankaa/hooks
│   ├── lodash
│   ├── react-hook-form
│   ├── @hookform/resolvers
│   └── zod
├── @ankaa/utils
│   ├── colorjs.io
│   └── date-fns
├── @ankaa/schemas
│   └── zod
├── @ankaa/types
└── @ankaa/constants

After (Standalone):
ankaa-web
├── axios
├── qs
├── jwt-decode
├── lodash
├── react-hook-form
├── @hookform/resolvers
├── zod
├── colorjs.io
├── date-fns
└── [all other direct dependencies]
```

## Stats
- **Total dependencies**: 64
- **Total devDependencies**: 10
- **Workspace dependencies removed**: 6
- **External dependencies added**: 6
- **Net change**: 0 (swapped workspace for external)

## Verification Checklist
- ✅ Package name changed to `ankaa-web`
- ✅ All `@ankaa/*` dependencies removed
- ✅ All external dependencies from shared packages added
- ✅ `@tanstack/react-query` is present
- ✅ All required types packages included
- ✅ Scripts remain functional
- ✅ No breaking changes to package structure
