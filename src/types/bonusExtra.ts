// packages/types/src/bonusExtra.ts

import type { BaseEntity, DecimalValue } from "./common";
import type { Bonus, BonusIncludes } from "./bonus";

// =====================
// Main Entity Interface
// =====================

export interface BonusExtra extends BaseEntity {
  bonusId: string;
  percentage: DecimalValue | number | null;
  value: DecimalValue | number | null;
  reference: string;
  calculationOrder: number;

  // Stable rule key for the rule modal (present on live bonuses). Absent on
  // persisted rows, which fall back to `reference`.
  ruleReference?: string;

  // Relations (optional, populated based on query)
  bonus?: Bonus;
}

// =====================
// Include Types
// =====================

export interface BonusExtraIncludes {
  bonus?:
    | boolean
    | {
        include?: BonusIncludes;
      };
}
