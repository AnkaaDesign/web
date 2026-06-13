# w3-design-mt — follow-ups (Medicina do Trabalho + Contas a Pagar + Ferramentas)

Design-consistency pass of 2026-06-11. Canon derived from administration/collaborators
list + administration/sectors form/detail, cross-checked against inventory items/orders
and paints.

## API follow-ups (web cannot fix)
- (none) — all changes were web-only; no API blockers found.

## Out-of-scope observations (other agents / future passes)
- Typecheck: the shared baseline was 21 errors; the run after this pass shows 23.
  The 2 extras are in files owned by other concurrent agents, NOT in this scope:
  - `src/components/human-resources/absence/calendar/absences-calendar.tsx` (TS6133 unused `IconStar`) — calendar agent's file.
  - `src/components/production/task/schedule/set-quote-layout-modal.tsx` (TS6133 unused `React`) — pre-existing/quote-layout work.
  No errors exist in any file under this agent's scope.
- `FAVORITE_PAGES` only has LISTAR entries for the MT pages (`MEDICINA_DO_TRABALHO_*_LISTAR`)
  — create/edit pages intentionally have no favorite star (same as several other modules).
  If CADASTRAR favorites are wanted, the enum entries must be added first (constants/enums.ts).
- Periodic-exams summary cards use colored stat numbers (`text-destructive`, amber) —
  this matches existing precedent (payroll/bonus/activity summary cards) and was kept.
- Accounts-payable bulk selection acts on the current page (like every canonical table);
  cross-page bulk would need a "select all matching filter" server feature (not canon anywhere).
- Medical-exam/leave detail pages use the centered spinner while loading (same as sector
  edit page); a dedicated detail skeleton (like SectorDetailSkeleton) could be added later
  for full parity with the sector DETAIL page, but the spinner pattern also exists in canon.
