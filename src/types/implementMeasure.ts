// packages/types/src/implementMeasure.ts

import type { BaseEntity } from "./common";
import type { File } from "./file";
import type { Truck } from "./truck";
import type { ImplementMeasureSection } from "./implementMeasureSection";

// =====================
// Main Entity Interface
// =====================

export interface ImplementMeasure extends BaseEntity {
  // Dimensions
  height: number;

  // Relations
  sections?: ImplementMeasureSection[];

  photoId: string | null;
  photo?: File;

  // Inverse relations (one-to-many with specific sides)
  trucksLeftSide?: Truck[];
  trucksRightSide?: Truck[];
  trucksBackSide?: Truck[];

  // UI display fields
  usageCount?: number;
}

// =====================
// Include Types
// =====================

export interface ImplementMeasureIncludes {
  photo?: boolean;
  sections?: boolean;
  trucksLeftSide?: boolean;
  trucksRightSide?: boolean;
  trucksBackSide?: boolean;
}
