// Overtime multipliers for Brazilian metallurgical syndicate (CCT metalúrgicos).
//
// Reference: CLT Art. 64 (monthly divisor = workday × 30 days, includes paid rest)
// CCT Sindicato dos Metalúrgicos (ABC / SP):
//   - Weekday extra hours:    +60% (multiplier 1.60)
//   - Saturday work:          +100% (multiplier 2.00)
//   - Sunday / Holiday work:  +100% (multiplier 2.00, CLT minimum)

export const OVERTIME_DAY_TYPE = {
  WEEKDAY: "WEEKDAY",
  SATURDAY: "SATURDAY",
  SUNDAY_HOLIDAY: "SUNDAY_HOLIDAY",
} as const;

export type OvertimeDayType = (typeof OVERTIME_DAY_TYPE)[keyof typeof OVERTIME_DAY_TYPE];

export const OVERTIME_MULTIPLIERS: Record<OvertimeDayType, number> = {
  [OVERTIME_DAY_TYPE.WEEKDAY]: 1.6, // +60% — metalúrgicos CCT
  [OVERTIME_DAY_TYPE.SATURDAY]: 2.0, // +100%
  [OVERTIME_DAY_TYPE.SUNDAY_HOLIDAY]: 2.0, // +100% (CLT minimum)
};

export const OVERTIME_DAY_TYPE_LABELS: Record<OvertimeDayType, string> = {
  [OVERTIME_DAY_TYPE.WEEKDAY]: "Semana",
  [OVERTIME_DAY_TYPE.SATURDAY]: "Sábado",
  [OVERTIME_DAY_TYPE.SUNDAY_HOLIDAY]: "Domingo / Feriado",
};

/** Default daily workday in HH:MM. 8h45 is the typical metallurgical sector pattern. */
export const STANDARD_WORKDAY = "08:45";

/** CLT Art. 64 — monthly divisor uses 30 days (including paid weekly rest). */
export const STANDARD_DIVISOR_DAYS = 30;
