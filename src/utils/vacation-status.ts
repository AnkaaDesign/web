// Vacation status helpers.
// "Em gozo" is a COMPUTED display state — never persisted. A vacation is em
// gozo when it is SCHEDULED and today falls within [startDate, startDate +
// days - 1]. Mirrors the shared helper across api/web/mobile.

import { startOfDay, addDays } from "date-fns";
import { VACATION_STATUS } from "../constants";

export interface VacationInProgressInput {
  status: VACATION_STATUS;
  startDate: Date | string | null;
  days: number;
}

/**
 * True when the vacation is currently being enjoyed (em gozo), derived purely
 * from the dates. Only SCHEDULED vacations can be em gozo.
 */
export function isVacationInProgress(v: VacationInProgressInput): boolean {
  if (v.status !== VACATION_STATUS.SCHEDULED) return false;
  if (v.startDate == null) return false;
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(v.startDate));
  const end = startOfDay(addDays(start, Math.max(1, v.days) - 1));
  return today >= start && today <= end;
}
