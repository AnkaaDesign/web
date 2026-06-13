# a4-reajustes — Follow-ups manifest (navigation.ts / route-privileges)

Agent: a4-reajustes (Salary Adjustments & Promotions). Audit date: 2026-06-11.

## Status: NOTHING PENDING in shared registration files

All registrations for this agent's pages were already applied (verified, not edited by this agent):

- `web/src/constants/navigation.ts` — "Salários e Cargos" sub-group exists with
  Faixas Salariais (`/departamento-pessoal/faixas-salariais`, id `dp-faixas-salariais`),
  Reajustes (`/departamento-pessoal/reajustes` + dynamic detalhes child, id `dp-reajustes`),
  Promoções (`/departamento-pessoal/promocoes`, id `dp-promocoes`); all arrays include
  ACCOUNTING + HUMAN_RESOURCES + ADMIN explicitly (~lines 1999–2028).
- `web/src/utils/route-privileges.ts:238` — `"/departamento-pessoal/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN"]`.
- `web/src/App.tsx` (~lines 2902–2934) — routes for reajustes list/detalhes, promocoes, faixas-salariais.
- `web/src/constants/enums.ts` — FAVORITE_PAGES members (2406–2408) + CHANGE_LOG_ENTITY_TYPE
  SALARY_ADJUSTMENT / USER_POSITION_HISTORY; labels in enum-labels.ts (2144–2146).
- `web/src/hooks/common/query-keys.ts` — `salaryAdjustmentKeys`, `userPositionHistoryKeys` (1083–1090).
- `web/src/api-client/index.ts` — exports for `./salary-adjustment` and `./user-position-history` (138–139).

## Deferred / open items for W4 or later passes

1. **User detail card** — apply `a4-reajustes-user-detail.md` (Histórico de Cargos card on
   `/administracao/colaboradores/detalhes/:id`).
2. **Seed** — run `api/scripts/seed-position-history.ts` after DB restore + migrations
   (`npx ts-node -r tsconfig-paths/register scripts/seed-position-history.ts` from `api/`).
   Idempotent; safe to re-run.
3. **Mobile parity** — no mobile screens for reajustes/promoções in this pass (per contract §0
   DEFERRED list); mobile only needs the CHANGE_LOG_ENTITY_TYPE enum members (W4 6-file set).
4. **Legacy positions list modal** (`web/src/components/human-resources/position/modals/salary-adjustment-modal.tsx`)
   still issues manual `toast.success/error` around `POST /positions/batch-adjust-salaries`.
   If that endpoint is NOT in the api-client interceptor skip-list this double-toasts
   (pre-existing behavior, kept as-is to avoid touching the legacy flow in this pass).
