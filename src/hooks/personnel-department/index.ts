// Departamento Pessoal hooks
export * from "./use-salary-adjustment";
export * from "./use-user-position-history";
export * from "./use-admissions";
export * from "./use-terminations";
export * from "./use-employment-contracts";
export * from "./use-benefits";
export * from "./use-user-benefits";
export * from "./use-vacations";
export * from "./use-thirteenths";

// User, position, warning, holiday & PPE hooks
export * from "./use-user";
// NOTE: use-user-filters excluded from barrel - import directly to avoid
// convertToApiFilters/convertFromApiFilters name conflicts across domains
export * from "./use-position";
export * from "./use-position-remuneration";
export * from "./use-warning";
export * from "./use-holiday";
export * from "./use-ppe";
export {
  useBonusesInfinite,
  useBonuses,
  useBonus,
  useBonusMutations,
  useBonusBatchMutations,
  useBonusDetail,
  useCalculateBonuses,
  useBonusByUser,
  useBonusByPeriod,
  useBonusList,
  useBonusPayroll,
  useExportPayroll,
  useExportBonuses,
  useBonusDiscountMutations,
  bonusHooks,
} from "./use-bonus";
export type {
  BonusCalculationResult,
} from "./use-bonus";
export type {
  BonusPayrollParams,
  PayrollData,
  BonusDiscountCreateFormData,
} from "../../api-client";
export * from "./use-payroll";
export * from "./use-team-staff";
export * from "./use-dependents";
export * from "./use-agenda-events";
