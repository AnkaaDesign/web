import { cn } from "@/lib/utils";
import type { StateManager, FieldModification } from "./types";

/**
 * Visual feedback tracking utilities for time clock entry modifications
 * Handles yellow background highlighting for modified cells and rows
 */

// CSS class constants for modification tracking
export const TRACKING_CLASSES = {
  // Row-level classes (applied to <tr>)
  ROW_MODIFIED: "bg-yellow-50 dark:bg-yellow-900/20",
  ROW_WEEKEND: "bg-red-50 dark:bg-red-900/10", // Higher priority than modified
  ROW_ALTERNATE: "bg-muted/50", // Default alternating row background

  // Cell-level classes (applied to <td>)
  CELL_MODIFIED: "bg-yellow-100 dark:bg-yellow-900/30",
  CELL_WEEKEND: "bg-red-100 dark:bg-red-900/20", // For weekend cells

  // Transition classes
  TRANSITION: "transition-colors duration-200",
} as const;

/**
 * Value normalization for proper comparison
 * Treats null, undefined, and empty string as equivalent
 */
export function normalizeValue(value: any): string {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

/**
 * Check if two values are actually different after normalization
 */
export function isValueModified(originalValue: any, currentValue: any): boolean {
  return normalizeValue(originalValue) !== normalizeValue(currentValue);
}

/**
 * Generate CSS classes for a table row based on modification state
 */
export function getRowClasses(entryId: string, stateManager: StateManager, isWeekend: boolean, isAlternate: boolean): string {
  const isModified = stateManager.actions.isEntryModified(entryId);

  return cn(
    "border-b border-neutral-400 dark:border-border/40",
    TRACKING_CLASSES.TRANSITION,
    // Priority order: weekend > modified > alternate
    isWeekend && TRACKING_CLASSES.ROW_WEEKEND,
    !isWeekend && isModified && TRACKING_CLASSES.ROW_MODIFIED,
    !isWeekend && !isModified && isAlternate && TRACKING_CLASSES.ROW_ALTERNATE,
  );
}

/**
 * Generate CSS classes for a table cell based on modification state
 */
export function getCellClasses(entryId: string, fieldName: string, stateManager: StateManager, isWeekend: boolean, baseClasses?: string): string {
  const isModified = stateManager.actions.isFieldModified(entryId, fieldName);

  return cn(
    baseClasses,
    TRACKING_CLASSES.TRANSITION,
    // Apply cell-level highlighting if the specific field is modified
    // Weekend cells get different styling
    isWeekend && TRACKING_CLASSES.CELL_WEEKEND,
    !isWeekend && isModified && TRACKING_CLASSES.CELL_MODIFIED,
  );
}

/**
 * Time field specific cell classes for time input cells
 */
export function getTimeFieldCellClasses(entryId: string, fieldName: string, stateManager: StateManager, isWeekend: boolean): string {
  const baseClasses = "p-1 w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40";
  return getCellClasses(entryId, fieldName, stateManager, isWeekend, baseClasses);
}

/**
 * Checkbox field specific cell classes
 */
export function getCheckboxCellClasses(entryId: string, fieldName: string, stateManager: StateManager, isWeekend: boolean): string {
  const baseClasses = "p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40";
  return getCellClasses(entryId, fieldName, stateManager, isWeekend, baseClasses);
}

/**
 * Date column cell classes (sticky column)
 */
export function getDateCellClasses(entryId: string, stateManager: StateManager, isWeekend: boolean): string {
  const isModified = stateManager.actions.isEntryModified(entryId);

  return cn(
    "p-2 sticky left-0 z-10 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border/40",
    TRACKING_CLASSES.TRANSITION,
    // Background handling for sticky date column
    isWeekend ? "bg-red-50 dark:bg-red-900/10" : "bg-background",
    !isWeekend && isModified && "bg-yellow-50 dark:bg-yellow-900/20",
  );
}

/**
 * Visual feedback utilities for tracking changes
 */
export class VisualTracker {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Get modification status for debugging
   */
  getModificationStatus(entryId: string): {
    isModified: boolean;
    modifiedFields: string[];
    modifications: any[];
  } {
    const isModified = this.stateManager.actions.isEntryModified(entryId);
    const allModifications = this.stateManager.actions.getAllModifications();
    const entryModifications = allModifications.filter((mod: FieldModification) => mod.entryId === entryId);

    return {
      isModified,
      modifiedFields: entryModifications.map((mod: FieldModification) => mod.field),
      modifications: entryModifications,
    };
  }

  /**
   * Check if a specific field is modified
   */
  isFieldModified(entryId: string, fieldName: string): boolean {
    return this.stateManager.actions.isFieldModified(entryId, fieldName);
  }

  /**
   * Check if an entire entry is modified
   */
  isEntryModified(entryId: string): boolean {
    return this.stateManager.actions.isEntryModified(entryId);
  }

  /**
   * Get the original value of a field
   */
  getOriginalValue(entryId: string, fieldName: string): any {
    const modification = this.stateManager.actions.getModification(entryId, fieldName);
    return modification?.originalValue;
  }

  /**
   * Get the current value of a field
   */
  getCurrentValue(entryId: string, fieldName: string): any {
    const modification = this.stateManager.actions.getModification(entryId, fieldName);
    return modification?.currentValue;
  }

  /**
   * Get modification details for a specific field
   */
  getFieldModification(entryId: string, fieldName: string) {
    return this.stateManager.actions.getModification(entryId, fieldName);
  }
}

/**
 * Utility function to determine if a date is a weekend
 */
export function isWeekend(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const day = dateObj.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Utility to generate row key for React rendering
 */
export function generateRowKey(entryId: string): string {
  return `time-entry-row-${entryId}`;
}

/**
 * Utility to generate cell key for React rendering
 */
export function generateCellKey(entryId: string, fieldName: string): string {
  return `time-entry-cell-${entryId}-${fieldName}`;
}

/**
 * Performance optimization: batch check for multiple fields
 */
export function getBatchModificationStatus(entryId: string, fieldNames: string[], stateManager: StateManager): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  fieldNames.forEach((fieldName: string) => {
    result[fieldName] = stateManager.actions.isFieldModified(entryId, fieldName);
  });
  return result;
}

/**
 * Color intensity helpers for different modification states
 */
export const MODIFICATION_COLORS = {
  // Light mode colors
  light: {
    row: {
      modified: "bg-yellow-50",
      weekend: "bg-red-50",
      alternate: "bg-slate-50",
    },
    cell: {
      modified: "bg-yellow-100",
      weekend: "bg-red-100",
      normal: "bg-white",
    },
  },
  // Dark mode colors
  dark: {
    row: {
      modified: "dark:bg-yellow-900/20",
      weekend: "dark:bg-red-900/10",
      alternate: "dark:bg-slate-900/50",
    },
    cell: {
      modified: "dark:bg-yellow-900/30",
      weekend: "dark:bg-red-900/20",
      normal: "dark:bg-background",
    },
  },
} as const;

/**
 * Advanced styling function with multiple states
 */
export function getAdvancedCellStyling(
  entryId: string,
  fieldName: string,
  stateManager: StateManager,
  options: {
    isWeekend?: boolean;
    isRequired?: boolean;
    hasError?: boolean;
    isDisabled?: boolean;
    baseClasses?: string;
  } = {},
): string {
  const { isWeekend = false, isRequired = false, hasError = false, isDisabled = false, baseClasses = "" } = options;

  const isModified = stateManager.actions.isFieldModified(entryId, fieldName);

  return cn(
    baseClasses,
    TRACKING_CLASSES.TRANSITION,
    // Base state
    !isModified && !isWeekend && "bg-white dark:bg-background",
    // Modified state (yellow background)
    isModified && !isWeekend && TRACKING_CLASSES.CELL_MODIFIED,
    // Weekend state (red background - higher priority)
    isWeekend && TRACKING_CLASSES.CELL_WEEKEND,
    // Error state (highest priority)
    hasError && "bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-400",
    // Required field highlighting
    isRequired && !isModified && !hasError && "ring-1 ring-blue-200 dark:ring-blue-800",
    // Disabled state
    isDisabled && "opacity-50 cursor-not-allowed",
  );
}

/**
 * Export default tracker factory
 */
export function createVisualTracker(stateManager: StateManager): VisualTracker {
  return new VisualTracker(stateManager);
}

/**
 * Debug utilities for development
 */
export const debugUtils = {
  /**
   * Log modification state for debugging
   */
  logModificationState(_entryId: string, _stateManager: StateManager): void {
    if (process.env.NODE_ENV === "development") {
      // Debug logging disabled
    }
  },

  /**
   * Log all modifications
   */
  logAllModifications(_stateManager: StateManager): void {
    if (process.env.NODE_ENV === "development") {
      // Debug logging disabled
    }
  },

  /**
   * Validate CSS class consistency
   */
  validateClasses(entryId: string, fieldName: string, stateManager: StateManager): void {
    if (process.env.NODE_ENV === "development") {
      const isModified = stateManager.actions.isFieldModified(entryId, fieldName);
      const classes = getCellClasses(entryId, fieldName, stateManager, false);

      const hasModifiedClass = classes.includes("bg-yellow");
      if (isModified !== hasModifiedClass) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[Tracking Warning] Class mismatch for ${entryId}.${fieldName}: isModified=${isModified}, hasModifiedClass=${hasModifiedClass}`);
        }
      }
    }
  },
};
