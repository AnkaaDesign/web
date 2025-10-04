import type { TimeClockEntry } from "../../../../types";
import type { TimeClockEntryBatchUpdateFormData } from "../../../../schemas";
import type { StateManager } from "../types";

// Base props shared by all cell components
export interface BaseCellProps {
  entryId: string;
  entryIndex: number;
  stateManager: StateManager;
  disabled?: boolean;
  className?: string;
}

// Props for form-controlled cells
export interface FormCellProps extends BaseCellProps {
  control: any;
  fieldName: keyof TimeClockEntryBatchUpdateFormData["entries"][0];
  label: string;
}

// Time cell specific props
export interface TimeCellProps extends FormCellProps {
  onTimeChange: (entryId: string, field: string, value: string | null, originalValue: string | null) => void;
  onNavigate?: (direction: "left" | "right", entryId: string, fieldName: string) => void;
  originalValue: string | null;
}

// Checkbox cell specific props
export interface CheckboxCellProps extends FormCellProps {
  onValueChange: (entryId: string, field: string, value: boolean, originalValue: boolean) => void;
  originalValue: boolean;
}

// Date cell specific props
export interface DateCellProps {
  entry: TimeClockEntry;
  stateManager: StateManager;
  onContextMenu?: (event: React.MouseEvent, entry: TimeClockEntry) => void;
  onEntryClick?: (entry: TimeClockEntry) => void;
  className?: string;
}

// Navigation direction for time cells
export type NavigationDirection = "left" | "right";

// Cell modification state
export interface CellModificationState {
  isModified: boolean;
  originalValue: any;
  currentValue: any;
}
