# a6-docs-medicina — Documentação card on the collaborator detail page

Target file (NOT edited by this agent): `web/src/pages/administration/collaborators/details/[id].tsx`

The card is fully self-contained (`UserDocumentationCard`): it self-gates to
ACCOUNTING / HUMAN_RESOURCES / ADMIN (returns `null` for everyone else, so it is
safe on a page visible to broader privileges), fetches the user's Admission +
document checklist via `GET /admissions/by-user/:userId`, supports multipart
upload per document type (lazily creating the Admission on first upload via
`POST /admissions/by-user/:userId/documents`), per-document status badge +
status combobox (PENDING/RECEIVED/SIGNED/WAIVED), and click-to-open file viewing
through the global `FileViewerProvider`.

## 1. Import (add next to the other detail-card imports, ~line 11)

```tsx
import { UserDocumentationCard } from "@/components/personnel-department/admission/user-documentation-card";
```

## 2. JSX (insert AFTER the "Professional and Login Info Grid" div, ~line 136,
BEFORE the PPE Sizes / Changelog grid)

```tsx
            {/* Documentação (Admissão — DP/Contabilidade) */}
            <UserDocumentationCard userId={user.id} />
```

Resulting layout:

```tsx
            {/* Professional and Login Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ProfessionalInfoCard user={user} />
              <LoginInfoCard user={user} />
            </div>

            {/* Documentação (Admissão — DP/Contabilidade) */}
            <UserDocumentationCard userId={user.id} />

            {/* PPE Sizes and Changelog History - Side by Side */}
```

No other changes are required on the page (no extra hooks, no providers — the
`FileViewerProvider` already wraps the app in `App.tsx`).
