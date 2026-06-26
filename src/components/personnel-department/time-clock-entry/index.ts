// Main table components
export { TimeClockEntryTable, type TimeClockEntryTableRef } from "./time-clock-entry-table";

// Dialog components
export { TimeClockJustificationDialog } from "./time-clock-justification-dialog";
export { TimeClockEntryDetailModal } from "./time-clock-entry-detail-modal";
export { LocationMapDialog } from "./location-map-dialog";
export { PhotoViewDialog } from "./photo-view-dialog";
export { JustificationDialog } from "./justification-dialog";

// Context menus
export { ContextMenu } from "./context-menu";

// Form utilities
export { useTimeClockForm, useJustificationForm, type TimeClockFormConfig, type TimeClockFormState, type TimeClockFormActions } from "./form";

// State management
export { useTimeClockState, useTimeClockStateManager, type TimeClockStateManager, type ModificationState, type StateActions, type FieldModification } from "./state";

// Cell components
export * from "./cells";

// UI components
export * from "./ui";

// Movement utilities
export { createMovementHandler, type TimeField } from "./moves";

// Data utilities
export {
  secullumTimeEntrySchema,
  locationDataSchema,
  timeEntryUpdateSchema,
  validateSecullumEntry,
  validateLocationData,
  normalizeSecullumEntry,
  denormalizeToSecullum,
  prepareBatchUpdate,
  compareTimeEntries,
  isEntryModified,
  getModifications,
  extractPhotoMetadata,
  formatLocationData,
  isLocationDataValid,
  validateTimeSequence,
  calculateWorkedHours,
  getFieldLabel,
  DataTransformationError,
  safeTransform,
  type ValidatedSecullumEntry,
  type ValidatedLocationData,
  type ValidatedTimeEntryUpdate,
  type NormalizedTimeEntry,
  type TimeEntryBatchUpdate,
  type PhotoMetadata,
} from "./data";

// Tracking utilities
export {
  TRACKING_CLASSES,
  normalizeValue,
  isValueModified,
  getRowClasses,
  getCellClasses,
  getTimeFieldCellClasses,
  getCheckboxCellClasses,
  getDateCellClasses,
  VisualTracker,
  generateRowKey,
  generateCellKey,
  getBatchModificationStatus,
  MODIFICATION_COLORS,
  getAdvancedCellStyling,
  createVisualTracker,
  debugUtils,
} from "./tracking";
