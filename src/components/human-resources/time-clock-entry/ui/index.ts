// Export all UI components
export { LoadingState } from "./loading-state";
export { EmptyState } from "./empty-state";
export { ErrorState } from "./error-state";
export { ActionButtons } from "./action-buttons";
export { StatusBadge, ModificationBadge, DataSourceBadge, WeekendBadge, ChangesCountBadge } from "./status-badges";
export { tableStyles, highlightingClasses, responsiveClasses, animationClasses, TableCell, TableRow } from "./table-utils";

// Export utilities
export {
  triggerFlashAnimation,
  triggerCellFlash,
  triggerRowFlash,
  buildTableRowClasses,
  buildTableCellClasses,
  getStatusVariant,
  getSourceDisplayText,
  formatTimeForDisplay,
  isValidTime,
  compareTimeStrings,
  formatDateForTable,
  getDayOfWeek,
  isWeekend,
  getFieldDisplayName,
  isTimeField,
  isBooleanField,
  validateFieldValue,
  scrollToElement,
  scrollToRow,
  scrollToCell,
  getChangeMessage,
  getMoveMessage,
  announceChange,
  timeClockUIUtils,
} from "./utils";


// Re-export common types
export interface UIComponentProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export interface StateComponentProps extends UIComponentProps {
  title?: string;
  description?: string;
}

export interface ActionComponentProps extends UIComponentProps {
  onAction?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface TableComponentProps extends UIComponentProps {
  entries: any[];
  isLoading?: boolean;
  error?: string | null;
  hasChanges?: boolean;
  changedCount?: number;
  isSaving?: boolean;
  onSave?: () => void;
  onRestore?: () => void;
  onRetry?: () => void;
  isFieldModified?: (entryId: string, field: string) => boolean;
  isEntryModified?: (entryId: string) => boolean;
}
