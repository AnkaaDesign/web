import { SECTOR_PRIVILEGES } from "@/constants";

/**
 * Task column-level visibility.
 *
 * Financial columns (price / quoteTotal / quoteStatus) expose the quote
 * value of a task and are restricted to financial-aware sectors. Mirrors
 * `canViewQuote` in `use-task-permissions.ts` (the rule used on detail/
 * form pages) so list and detail views agree.
 *
 * Bonification is intentionally NOT gated here — production users receive
 * bonification and must be able to see it on tables they have access to.
 */

const FINANCIAL_COLUMN_SECTORS: readonly SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.FINANCIAL,
];

export function canViewTaskFinancialColumns(
  sectorPrivilege: SECTOR_PRIVILEGES | undefined | null,
): boolean {
  if (!sectorPrivilege) return false;
  return FINANCIAL_COLUMN_SECTORS.includes(sectorPrivilege);
}

const FINANCIAL_COLUMN_IDS = new Set([
  "price",
  "quoteTotal",
  "quoteStatus",
]);

export function isTaskFinancialColumn(columnId: string): boolean {
  return FINANCIAL_COLUMN_IDS.has(columnId);
}
