# Manifest: DependentsCard integration into collaborator detail page

Agent A2 built the self-contained dependents management card. This manifest describes the exact
(NOT yet applied) integration into the collaborator detail page.

## Target page

`/home/kennedy/Documents/repositories/web/src/pages/administration/collaborators/details/[id].tsx`
(route: `/administracao/colaboradores/detalhes/:id`, default export `CollaboratorDetailsPage`)

## Import line to add

Add after the existing detail-card imports (line 11, the
`import { BasicInfoCard, AddressCard, ... } from "@/components/administration/user/detail";` line):

```tsx
import { DependentsCard } from "@/components/human-resources/dependent/dependents-card";
```

## JSX to insert

Inside `<div className="space-y-4">` (the scrollable card stack), insert a new grid row between the
"PPE Sizes and Changelog History" grid and the `<RelatedActivitiesCard user={user} />` line.

Anchor (existing code, currently lines ~138-145):

```tsx
            {/* PPE Sizes and Changelog History - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PpeSizesCard user={user} className="h-[700px]" />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.USER} entityId={id} maxHeight="700px" className="h-[700px]" />
            </div>

            {/* Related Activities */}
            <RelatedActivitiesCard user={user} />
```

Insert between the closing `</div>` of that grid and the `{/* Related Activities */}` comment:

```tsx
            {/* Dependents (IRRF / Salário-Família) */}
            <DependentsCard userId={id} />
```

Result:

```tsx
            {/* PPE Sizes and Changelog History - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PpeSizesCard user={user} className="h-[700px]" />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.USER} entityId={id} maxHeight="700px" className="h-[700px]" />
            </div>

            {/* Dependents (IRRF / Salário-Família) */}
            <DependentsCard userId={id} />

            {/* Related Activities */}
            <RelatedActivitiesCard user={user} />
```

## Notes

- `id` is the `useParams` route param, already narrowed (`if (!id) return <Navigate .../>` above), so
  `userId={id}` is a plain `string` at that point.
- The card is fully self-contained: it fetches via `useDependents({ userIds: [id], ... })` and handles
  add/edit/remove with its own dialogs; no extra props, handlers, or query invalidation needed on the page.
- No toast calls are needed (axios interceptor auto-toasts mutations).
- Component source: `/home/kennedy/Documents/repositories/web/src/components/human-resources/dependent/dependents-card.tsx`
  (props: `{ userId: string; className?: string }`).
