# a4-reajustes — User detail page: "Histórico de Cargos" card

Agent: a4-reajustes (Salary Adjustments & Promotions)
Target file (apply manually — page agents must not edit it):
`web/src/pages/administration/collaborators/details/[id].tsx`

The component is self-contained (fetches its own data by `userId`):
`web/src/components/personnel-department/user-position-history/detail/user-position-history-card.tsx`

## 1. Add import (next to the other detail-card imports, ~line 11)

```tsx
import { UserPositionHistoryCard } from "@/components/personnel-department/user-position-history/detail/user-position-history-card";
```

## 2. Render the card

Inside the detail layout (`<div className="space-y-4">`), insert a new row
between the "Professional and Login Info Grid" and the "PPE Sizes and
Changelog History" grid (i.e. right after the closing `</div>` of the grid
that contains `<ProfessionalInfoCard user={user} />`, ~line 136):

```tsx
            {/* Histórico de Cargos (Departamento Pessoal) */}
            <UserPositionHistoryCard userId={id} maxHeight="400px" />
```

Notes:
- `id` is the already-validated route param used by the page (same value passed
  to `ChangelogHistory entityId={id}`).
- The card renders its own loading/empty/error states; no extra wiring needed.
- Visible data is gated server-side: `GET /user-position-history` requires
  ACCOUNTING / HUMAN_RESOURCES / ADMIN. If the collaborator detail page is ever
  reachable by other privileges, wrap the card in a privilege check, e.g.:

```tsx
            {hasPrivilege([SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]) && (
              <UserPositionHistoryCard userId={id} maxHeight="400px" />
            )}
```
