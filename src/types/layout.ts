// packages/types/src/layout.ts

import type { BaseEntity } from "./common";
import type { File } from "./file";
import type { Truck } from "./truck";
import type { LayoutSection } from "./layoutSection";

// =====================
// Main Entity Interface
// =====================

export interface Layout extends BaseEntity {
  // Dimensions
  height: number;

  // Relations
  layoutSections?: LayoutSection[];

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

export interface LayoutIncludes {
  photo?: boolean;
  layoutSections?: boolean;
  trucksLeftSide?: boolean;
  trucksRightSide?: boolean;
  trucksBackSide?: boolean;
}
