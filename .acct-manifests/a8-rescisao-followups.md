# a8-admission-termination — Follow-ups manifest (navigation.ts / route-privileges)

Agent: a8-admission-termination (Admissões & Rescisões). Audit date: 2026-06-11.

## Status: NOTHING PENDING in shared registration files

All registrations for this agent's pages were already applied (verified, NOT edited by this agent):

- `web/src/constants/navigation.ts` (~lines 1996–2016) — "Departamento Pessoal" group has
  Admissões (`dp-admissoes` + cadastrar/detalhes/editar children) and Rescisões
  (`dp-rescisoes` + cadastrar/detalhes/editar children).
- `web/src/App.tsx` (~lines 2838–2890) — all 8 routes registered (admissions + terminations
  list/create/details/edit), lazy imports at ~113–120.
- `web/src/constants/routes.ts` (~580–591) — `personnelDepartment.admissions` / `.terminations`.
- `web/src/constants/enums.ts` — ADMISSION_*/TERMINATION_*/NOTICE_* enums + CHANGE_LOG_ENTITY_TYPE
  ADMISSION/TERMINATION (1232–1233) + FAVORITE_PAGES members; labels in enum-labels.ts.
- `web/src/hooks/common/query-keys.ts` (1101–1103) — `admissionKeys`, `terminationKeys`.
- `web/src/api-client/index.ts` — exports `./admission` and `./termination`.
- API: both controllers `@Roles(ACCOUNTING, HUMAN_RESOURCES, ADMIN)`, registered in
  `human-resources.module.ts`; static routes before `:id`.

## Behavior contracts added in this pass (server + web mirror — keep in sync)

1. **Dynamic termination status chain** — NOTICE_PERIOD step only exists when
   `noticeType === WORKED`; MEDICAL_EXAM step never exists for type DEATH.
   Server: `terminationStatusChainFor()` in `api/.../termination/termination.service.ts`.
   Web mirror: `getTerminationStatusChain()` / `getNextTerminationStatus(termination)` in
   `web/src/components/personnel-department/termination/detail/status-stepper-card.tsx`.
2. **Notice projection (CLT 487 §1º)** applies only to employer-paid indemnified notice
   (WITHOUT_CAUSE / INDIRECT / MUTUAL_AGREEMENT — `EMPLOYER_NOTICE_TYPES` exported from
   `termination-calculation.service.ts`). Resignation with unworked notice generates
   NOTICE_DISCOUNT (CLT 487 §2º) instead.
3. **DEATH** terminations get no DISMISSAL_EXAM checklist row and no exam guard.
4. **Admission COMPLETED** writes `User.exp1StartAt = hireDate` when the user had none.

## Deferred / open items (user decision or out of scope)

1. **TRCT PDF + eSocial events (S-2299/S-2200) + FGTS Digital guides** — deferred by user
   decision; documents are tracked as uploads only.
2. **Seguro-desemprego form generation** — checklist row only (UNEMPLOYMENT_INSURANCE_FORM
   for WITHOUT_CAUSE/INDIRECT); no requerimento generation.
3. **INSS/IRRF on termination items** — intentionally manual (custom discount items);
   no automatic progressive-table calculation.
4. **Homologação step** (spec mentions "Homologação") — post-reforma (Lei 13.467/2017) union
   homologation is no longer mandatory; not modeled. Revisit only if CCT requires it.
5. **Art. 480 (EXPERIENCE_EARLY_EMPLOYEE)** — the employee-owed indemnity is not
   auto-calculated (cap = half of the remaining-period remuneration); add as custom
   OTHER_DISCOUNT when applicable.
6. **13º already-paid advances** — when the projection crosses the year, the engine emits
   the full closing-year avos; any 13º already paid in November/December must be entered
   as a custom ADVANCE_DISCOUNT.
7. **Mobile parity** — no mobile screens for admissões/rescisões in this pass.
8. **Unit tests** — `termination-calculation.service.spec.ts` follows the repo's jest-style
   spec convention, but NO test runner is installed in api/package.json (pre-existing:
   all *.spec.ts files only type-check). Math verified via a tsx harness during this pass
   (38/38 checks). Install jest/vitest to run them for real.
