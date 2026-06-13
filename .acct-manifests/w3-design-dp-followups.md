# w3-design-dp — followups (blocked by API / out of web-only scope)

## 1. FAVORITE_PAGES: missing DP "CADASTRAR" entries (API enum required)

Canonical create pages (e.g. `ESTOQUE_PRODUTOS_CADASTRAR` on inventory products create) carry a
`favoritePage` with their own CADASTRAR enum value. The DP area only has LISTAR entries:

- `DEPARTAMENTO_PESSOAL_RESCISOES_LISTAR`, `..._BENEFICIOS_LISTAR`, `..._BENEFICIOS_ADESOES_LISTAR`, etc.

`FAVORITE_PAGES` is validated server-side (`api/src/schemas/preferences.ts`) and mirrored in
`api/src/constants/enums.ts`, `api/src/constants/enum-labels.ts`, and `api/src/utils/favorite-pages.ts`
(URL→enum map), so a web-only addition would be rejected on toggle.

Done in this pass (web): removed the incorrect `favoritePage={DEPARTAMENTO_PESSOAL_RESCISOES_LISTAR}`
from `src/pages/personnel-department/terminations/create.tsx` (it favorited the LIST page from the
create page). All DP create pages now consistently have no favorite star.

To finish parity with the canon, add to BOTH api and web constants (enums + enum-labels) and to
`api/src/utils/favorite-pages.ts`:

- `DEPARTAMENTO_PESSOAL_RESCISOES_CADASTRAR = '/departamento-pessoal/rescisoes/cadastrar'` — "Nova Rescisão"
- `DEPARTAMENTO_PESSOAL_BENEFICIOS_CADASTRAR = '/departamento-pessoal/beneficios/cadastrar'` — "Novo Benefício"
- `DEPARTAMENTO_PESSOAL_BENEFICIOS_ADESOES_CADASTRAR = '/departamento-pessoal/beneficios/adesoes/cadastrar'` — "Nova Adesão"

then set `favoritePage` on:
- `src/pages/personnel-department/terminations/create.tsx`
- `src/pages/personnel-department/benefits/create.tsx`
- `src/pages/personnel-department/benefits/enrollments/create.tsx`

## 2. PageHeader `entity` prop on DP detail pages (type, not API)

`PageHeader` `variant="detail"` accepts `entity: { id; name }`. Termination, UserBenefit and
SalaryAdjustment have no `name` field, so `entity` cannot be passed without a type error
(`BaseEntity.name` is required). Pages use `variant="detail"` + explicit `title` instead, which
renders identically. If desired later: widen `BaseEntity.name` to optional in
`src/components/ui/page-header.tsx` (shared component — out of this agent's scope).
