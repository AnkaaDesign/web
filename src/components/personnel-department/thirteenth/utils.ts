import { THIRTEENTH_STATUS } from "../../../constants";
import type { BadgeProps } from "../../../components/ui/badge";
import type { Thirteenth } from "../../../types/thirteenth";

/**
 * Status flow shown in the progress stepper (cancelled is rendered separately).
 * Ordered earliest → latest so consumers can use `.indexOf(status)`.
 */
export const THIRTEENTH_STEPPER_FLOW: THIRTEENTH_STATUS[] = [
  THIRTEENTH_STATUS.OPEN,
  THIRTEENTH_STATUS.FIRST_PAID,
  THIRTEENTH_STATUS.SECOND_PAID,
  THIRTEENTH_STATUS.PAID,
];

/** Badge variant per status (summary card falls back to "secondary"). */
export const THIRTEENTH_STATUS_BADGE_VARIANTS: Record<THIRTEENTH_STATUS, BadgeProps["variant"]> = {
  [THIRTEENTH_STATUS.OPEN]: "pending",
  [THIRTEENTH_STATUS.FIRST_PAID]: "warning",
  [THIRTEENTH_STATUS.SECOND_PAID]: "warning",
  [THIRTEENTH_STATUS.PAID]: "success",
  [THIRTEENTH_STATUS.CANCELLED]: "destructive",
};

/** Valor cheio devido no ano = baseRemuneration / 12 × avos. */
export function fullEntitlement(thirteenth: Pick<Thirteenth, "baseRemuneration" | "avos">): number | null {
  if (thirteenth.baseRemuneration == null) return null;
  return (thirteenth.baseRemuneration / 12) * thirteenth.avos;
}

/** The 1ª parcela can be paid while the 13º is open and not yet cancelled. */
export function canPayFirst(thirteenth: Pick<Thirteenth, "status" | "firstInstallmentDate">): boolean {
  if (thirteenth.status === THIRTEENTH_STATUS.CANCELLED || thirteenth.status === THIRTEENTH_STATUS.PAID) return false;
  return !thirteenth.firstInstallmentDate;
}

/** The 2ª parcela can only be paid after the 1ª, while not paid/cancelled. */
export function canPaySecond(thirteenth: Pick<Thirteenth, "status" | "firstInstallmentDate" | "secondInstallmentDate">): boolean {
  if (thirteenth.status === THIRTEENTH_STATUS.CANCELLED || thirteenth.status === THIRTEENTH_STATUS.PAID) return false;
  return !!thirteenth.firstInstallmentDate && !thirteenth.secondInstallmentDate;
}
