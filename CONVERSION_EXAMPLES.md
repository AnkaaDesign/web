# Import Replacement Conversion Examples

## Overview
All `@ankaa/*` imports have been converted to local relative imports based on the file's location within the directory structure.

---

## Example Conversions by Directory Depth

### Level 0: Root (src/)
**File:** `/home/kennedy/ankaa/separating/web/src/App.tsx`

```typescript
// BEFORE
import { routes } from "@ankaa/constants";

// AFTER
import { routes } from "./constants";
```

**Explanation:** File is at same level as packages, so uses `./`

---

### Level 1: Direct subdirectories (src/hooks/, src/utils/, etc.)
**File:** `/home/kennedy/ankaa/separating/web/src/hooks/useAuth.ts`

```typescript
// BEFORE
import { authService } from "@ankaa/api-client";
import type { AuthUser } from "@ankaa/types";
import type { SignUpFormData } from "@ankaa/schemas";

// AFTER
import { authService } from "../api-client";
import type { AuthUser } from "../types";
import type { SignUpFormData } from "../schemas";
```

**Explanation:** Files are one level deep, need to go up one level (`../`)

---

### Level 2: Nested subdirectories (src/hooks/task/)
**File:** `/home/kennedy/ankaa/separating/web/src/hooks/task/use-task-form-url-state.ts`

```typescript
// BEFORE
import { TASK_STATUS } from "@ankaa/constants";

// AFTER
import { TASK_STATUS } from "../../constants";
```

**Explanation:** Files are two levels deep, need to go up two levels (`../../`)

---

### Level 3: Page directories (src/pages/inventory/)
**File:** `/home/kennedy/ankaa/separating/web/src/pages/inventory/products/list.tsx`

```typescript
// BEFORE
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "@ankaa/constants";

// AFTER
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
```

**Explanation:** Files are three levels deep, need to go up three levels (`../../../`)

---

### Level 4: Deep component directories (src/components/inventory/item/form/)
**File:** `/home/kennedy/ankaa/separating/web/src/components/inventory/item/form/item-form.tsx`

```typescript
// BEFORE
import { itemCreateSchema, itemUpdateSchema } from "@ankaa/schemas";
import { useItemCategories } from "@ankaa/hooks";
import { ITEM_CATEGORY_TYPE } from "@ankaa/constants";

// AFTER
import { itemCreateSchema, itemUpdateSchema } from "../../../../schemas";
import { useItemCategories } from "../../../../hooks";
import { ITEM_CATEGORY_TYPE } from "../../../../constants";
```

**Explanation:** Files are four levels deep, need to go up four levels (`../../../../`)

---

## Deep/Nested Imports

### API Client Sub-modules
**File:** `/home/kennedy/ankaa/separating/web/src/pages/administration/files/upload.tsx`

```typescript
// BEFORE
import { uploadSingleFile } from "@ankaa/api-client/file";

// AFTER
import { uploadSingleFile } from "../../../api-client/file";
```

**Explanation:** Path adjusted to reach api-client/file from three levels deep

---

### Hook Query Keys
**File:** `/home/kennedy/ankaa/separating/web/src/components/human-resources/performance-levels/performance-level-table.tsx`

```typescript
// BEFORE
import { bonusKeys } from "@ankaa/hooks/queryKeys";

// AFTER
import { bonusKeys } from "../../../hooks/queryKeys";
```

**Explanation:** Path adjusted to reach hooks/queryKeys from three levels deep

---

### Constants Enums
**File:** `/home/kennedy/ankaa/separating/web/src/pages/human-resources/performance-levels/list.tsx`

```typescript
// BEFORE
import { SECTOR_PRIVILEGES } from "@ankaa/constants/enums";

// AFTER
import { SECTOR_PRIVILEGES } from "../../../constants/enums";
```

**Explanation:** Path adjusted to reach constants/enums from three levels deep

---

## Dynamic Imports

**File:** `/home/kennedy/ankaa/separating/web/src/pages/inventory/orders/details/[id].tsx`

```typescript
// BEFORE
const { batchMarkOrderItemsFulfilled } = await import("@ankaa/api-client");

// AFTER
const { batchMarkOrderItemsFulfilled } = await import("../../../../api-client");
```

**Explanation:** Dynamic imports also use relative paths

---

## Multiple Package Imports in Same File

**File:** `/home/kennedy/ankaa/separating/web/src/contexts/auth-context.tsx`

```typescript
// BEFORE
import * as apiClientModule from "@ankaa/api-client";
import type { AuthUser } from "@ankaa/types";
import type { SignUpFormData } from "@ankaa/schemas";
import { detectContactMethod } from "@ankaa/utils";
import { routes } from "@ankaa/constants";

// AFTER
import * as apiClientModule from "../api-client";
import type { AuthUser } from "../types";
import type { SignUpFormData } from "../schemas";
import { detectContactMethod } from "../utils";
import { routes } from "../constants";
```

**Explanation:** All packages use consistent relative paths from same file location

---

## Path Calculation Formula

```
Relative Path = "../" repeated (directory_depth - 1) times + package_name
```

Examples:
- Depth 0 (src/): `./constants`
- Depth 1 (src/hooks/): `../constants`
- Depth 2 (src/hooks/task/): `../../constants`
- Depth 3 (src/pages/inventory/products/): `../../../constants`
- Depth 4 (src/components/inventory/item/form/): `../../../../constants`

---

## Verification Commands

Check for any remaining @ankaa imports (excluding comments):
```bash
cd /home/kennedy/ankaa/separating/web
grep -r "@ankaa/" src --include="*.ts" --include="*.tsx" | grep -v "^[[:space:]]*\/\/" | grep -v "^[[:space:]]*\*"
```

Result: Only comment references remain (intentional documentation)

---

**Status:** ✅ All conversions complete and verified
**Date:** 2025-10-04
**Location:** `/home/kennedy/ankaa/separating/web`
