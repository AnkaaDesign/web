# A2 — Payroll pages: notes (2026-06-11)

No nav/route-privilege changes needed. Routes, App.tsx and privilege gates were already correct
(HUMAN_RESOURCES + ADMIN + ACCOUNTING everywhere, matching the API discount/payroll controllers).

## API-side gaps found (outside this agent's scope — owner action needed)

1. `api/src/schemas/payroll.ts` — `payrollIncludeSchema.bonus.include` does NOT allow
   `bonusExtras` (only tasks/users/user/discounts/bonusDiscounts). The web detail page requests
   `bonus.include.bonusExtras`; zod strip-mode silently drops it, so bonus extras rows only render
   when the controller's defaultInclude is used (GET /payroll/:id does include bonusExtras by
   default, so the page works — but explicit includes can't request it). Suggested fix: add
   `bonusExtras: z.union([z.boolean(), z.object({})]).optional()` next to `bonusDiscounts`.

2. `api/src/modules/human-resources/payroll/payroll.service.ts` (`calculateLivePayrollData`,
   discounts mapping ~line 957): the live discount rows omit `totalInstallments` /
   `currentInstallment` when copying persistent discounts. Result: "Parcela X/Y" badges only show
   on SAVED payrolls; live payrolls show the loan row without installment info. Suggested fix: add
   `totalInstallments: 'totalInstallments' in d ? d.totalInstallments ?? null : null` (same for
   `currentInstallment`) to that mapping.

3. `api/src/schemas/payroll.ts` — payroll `user` include only allows `position`/`sector`, so the
   web cannot fetch `user.dependents` to display the IRRF dependents count
   ("Dependentes (IRRF): N × R$ 189,59"). The eligible count is computed server-side
   (`getIrrfDependentsCount`: Dependent rows with irrfDeduction=true, falling back to
   `user.dependentsCount`), and `user.dependentsCount` alone can diverge from it, so the web shows
   the IRRF base (which already embeds the deduction) and skips the count. If the count should be
   surfaced, either allow `dependents` in the payroll user include or return the computed
   `irrfDependentsCount` on the payroll payload.
