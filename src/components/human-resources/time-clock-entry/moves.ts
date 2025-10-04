import type { UseFormReturn } from "react-hook-form";
import type { TimeClockEntry } from "@/types/time-clock";
import type { TimeClockEntryBatchUpdateFormData } from "../../../schemas";
import type { TimeClockStateManager } from "./state";
import { toast } from "sonner";

export type TimeField = "entry1" | "exit1" | "entry2" | "exit2" | "entry3" | "exit3" | "entry4" | "exit4" | "entry5" | "exit5";

export interface MovementResult {
  success: boolean;
  message: string;
  targetField?: string;
  targetEntryId?: string;
}

export interface MovementContext {
  form: UseFormReturn<TimeClockEntryBatchUpdateFormData>;
  stateManager: TimeClockStateManager;
  originalEntries: TimeClockEntry[];
  fields: Array<{ id: string }>;
}

/**
 * Time field definitions and utilities
 */
const TIME_FIELDS: TimeField[] = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];

const FIELD_LABELS: Record<TimeField, string> = {
  entry1: "Entrada 1",
  exit1: "Saída 1",
  entry2: "Entrada 2",
  exit2: "Saída 2",
  entry3: "Entrada 3",
  exit3: "Saída 3",
  entry4: "Entrada 4",
  exit4: "Saída 4",
  entry5: "Entrada 5",
  exit5: "Saída 5",
};

/**
 * Core movement functions
 */
export class TimeEntryMovement {
  private context: MovementContext;

  constructor(context: MovementContext) {
    this.context = context;
  }

  /**
   * Move time from one column to another in the same row (left/right arrow movement)
   */
  moveTimeInRow(entryId: string, sourceField: TimeField, direction: "left" | "right"): MovementResult {
    const entryIndex = this.getEntryIndex(entryId);
    if (entryIndex === -1) {
      return { success: false, message: "Entrada não encontrada" };
    }

    const currentValue = this.getFieldValue(entryIndex, sourceField);
    if (!currentValue) {
      return { success: false, message: "Campo vazio, nada para mover" };
    }

    const targetField = this.findAvailableColumn(entryIndex, sourceField, direction);
    if (!targetField) {
      const directionText = direction === "right" ? "direita" : "esquerda";
      return { success: false, message: `Nenhuma coluna disponível à ${directionText}` };
    }

    // Perform the move
    this.executeFieldMove(entryId, entryIndex, sourceField, targetField, currentValue);

    return {
      success: true,
      message: `Movido para ${FIELD_LABELS[targetField]}`,
      targetField,
    };
  }

  /**
   * Move time to previous day (same or different column)
   */
  moveToPreviousDay(entryId: string, sourceField?: TimeField): MovementResult {
    const currentIndex = this.getEntryIndex(entryId);
    if (currentIndex === -1) {
      return { success: false, message: "Entrada não encontrada" };
    }

    if (currentIndex <= 0) {
      return { success: false, message: "Já está no primeiro dia" };
    }

    const previousIndex = currentIndex - 1;
    const previousEntryId = this.context.fields[previousIndex].id;

    if (sourceField) {
      return this.moveSingleFieldToDay(entryId, currentIndex, sourceField, previousEntryId, previousIndex, "anterior");
    } else {
      return this.moveAllFieldsToDay(entryId, currentIndex, previousEntryId, previousIndex, "anterior");
    }
  }

  /**
   * Move time to next day (same or different column)
   */
  moveToNextDay(entryId: string, sourceField?: TimeField): MovementResult {
    const currentIndex = this.getEntryIndex(entryId);
    if (currentIndex === -1) {
      return { success: false, message: "Entrada não encontrada" };
    }

    if (currentIndex >= this.context.fields.length - 1) {
      return { success: false, message: "Já está no último dia" };
    }

    const nextIndex = currentIndex + 1;
    const nextEntryId = this.context.fields[nextIndex].id;

    if (sourceField) {
      return this.moveSingleFieldToDay(entryId, currentIndex, sourceField, nextEntryId, nextIndex, "próximo");
    } else {
      return this.moveAllFieldsToDay(entryId, currentIndex, nextEntryId, nextIndex, "próximo");
    }
  }

  /**
   * Private helper methods
   */
  private getEntryIndex(entryId: string): number {
    return this.context.fields.findIndex((f) => f.id === entryId);
  }

  private getFieldValue(entryIndex: number, field: TimeField): string | null {
    const fieldPath = `entries.${entryIndex}.${field}` as any;
    return this.context.form.getValues(fieldPath);
  }

  private getOriginalEntry(entryId: string): TimeClockEntry | undefined {
    return this.context.originalEntries.find((e) => e.id === entryId);
  }

  private getOriginalFieldValue(entryId: string, field: TimeField): any {
    const originalEntry = this.getOriginalEntry(entryId);
    return originalEntry ? originalEntry[field] : null;
  }

  private setFieldValue(entryIndex: number, field: TimeField, value: string | null): void {
    const fieldPath = `entries.${entryIndex}.${field}` as any;
    this.context.form.setValue(fieldPath, value, {
      shouldValidate: false,
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  private updateStateManager(entryId: string, field: TimeField, newValue: any): void {
    const originalValue = this.getOriginalFieldValue(entryId, field);
    this.context.stateManager.actions.updateField(entryId, field, newValue, originalValue);
  }

  private executeFieldMove(entryId: string, entryIndex: number, sourceField: TimeField, targetField: TimeField, value: string): void {
    // Clear source field
    this.setFieldValue(entryIndex, sourceField, null);
    this.updateStateManager(entryId, sourceField, null);

    // Set target field
    this.setFieldValue(entryIndex, targetField, value);
    this.updateStateManager(entryId, targetField, value);
  }

  private findAvailableColumn(entryIndex: number, currentField: TimeField, direction: "left" | "right"): TimeField | null {
    const currentFieldIndex = TIME_FIELDS.indexOf(currentField);
    if (currentFieldIndex === -1) return null;

    const searchStart = direction === "right" ? currentFieldIndex + 1 : currentFieldIndex - 1;
    const searchEnd = direction === "right" ? TIME_FIELDS.length : -1;
    const step = direction === "right" ? 1 : -1;

    for (let i = searchStart; direction === "right" ? i < searchEnd : i > searchEnd; i += step) {
      const fieldValue = this.getFieldValue(entryIndex, TIME_FIELDS[i]);
      if (!fieldValue) {
        return TIME_FIELDS[i];
      }
    }

    return null;
  }

  private moveSingleFieldToDay(
    sourceEntryId: string,
    sourceIndex: number,
    sourceField: TimeField,
    targetEntryId: string,
    targetIndex: number,
    dayDirection: string,
  ): MovementResult {
    const currentValue = this.getFieldValue(sourceIndex, sourceField);
    if (!currentValue) {
      return { success: false, message: "Campo vazio, nada para mover" };
    }

    // Try same column first
    const targetValue = this.getFieldValue(targetIndex, sourceField);
    if (!targetValue) {
      // Move to same column
      this.executeFieldMove(sourceEntryId, sourceIndex, sourceField, sourceField, null as any);
      this.setFieldValue(targetIndex, sourceField, currentValue);
      this.updateStateManager(targetEntryId, sourceField, currentValue);

      return {
        success: true,
        message: `Movido para o dia ${dayDirection}`,
        targetField: sourceField,
        targetEntryId,
      };
    }

    // Find any available column in target day
    const availableField = this.findAvailableColumnInEntry(targetIndex);
    if (!availableField) {
      return { success: false, message: `Dia ${dayDirection} não tem campos disponíveis` };
    }

    // Move to available column
    this.executeFieldMove(sourceEntryId, sourceIndex, sourceField, sourceField, null as any);
    this.setFieldValue(targetIndex, availableField, currentValue);
    this.updateStateManager(targetEntryId, availableField, currentValue);

    return {
      success: true,
      message: `Movido para ${FIELD_LABELS[availableField]} do dia ${dayDirection}`,
      targetField: availableField,
      targetEntryId,
    };
  }

  private moveAllFieldsToDay(sourceEntryId: string, sourceIndex: number, targetEntryId: string, targetIndex: number, dayDirection: string): MovementResult {
    const fieldsToMove: Array<{ field: TimeField; value: string }> = [];

    // Collect all non-empty fields
    for (const field of TIME_FIELDS) {
      const value = this.getFieldValue(sourceIndex, field);
      if (value) {
        fieldsToMove.push({ field, value });
      }
    }

    if (fieldsToMove.length === 0) {
      return { success: false, message: "Nenhum campo preenchido para mover" };
    }

    // Check if target day has enough space
    const availableFields = this.getAvailableFieldsInEntry(targetIndex);
    if (availableFields.length < fieldsToMove.length) {
      return {
        success: false,
        message: `Dia ${dayDirection} não tem espaço suficiente (${availableFields.length} disponíveis, ${fieldsToMove.length} necessários)`,
      };
    }

    // Perform the moves
    fieldsToMove.forEach(({ field, value }: { field: TimeField; value: string }, index: number) => {
      // Clear source
      this.setFieldValue(sourceIndex, field, null);
      this.updateStateManager(sourceEntryId, field, null);

      // Set target
      const targetField = availableFields[index];
      this.setFieldValue(targetIndex, targetField, value);
      this.updateStateManager(targetEntryId, targetField, value);
    });

    return {
      success: true,
      message: `${fieldsToMove.length} campos movidos para o dia ${dayDirection}`,
      targetEntryId,
    };
  }

  private findAvailableColumnInEntry(entryIndex: number): TimeField | null {
    for (const field of TIME_FIELDS) {
      const value = this.getFieldValue(entryIndex, field);
      if (!value) {
        return field;
      }
    }
    return null;
  }

  private getAvailableFieldsInEntry(entryIndex: number): TimeField[] {
    const available: TimeField[] = [];
    for (const field of TIME_FIELDS) {
      const value = this.getFieldValue(entryIndex, field);
      if (!value) {
        available.push(field);
      }
    }
    return available;
  }
}

/**
 * Convenience functions for use in components
 */
export function createMovementHandler(context: MovementContext) {
  const movement = new TimeEntryMovement(context);

  return {
    /**
     * Handle left/right arrow movement within same row
     */
    handleTimeShift: (entryId: string, field: TimeField, direction: "left" | "right") => {
      const result = movement.moveTimeInRow(entryId, field, direction);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }

      return result;
    },

    /**
     * Handle moving to previous day
     */
    handleMoveToPreviousDay: (entryId: string, field?: TimeField) => {
      const result = movement.moveToPreviousDay(entryId, field);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }

      return result;
    },

    /**
     * Handle moving to next day
     */
    handleMoveToNextDay: (entryId: string, field?: TimeField) => {
      const result = movement.moveToNextDay(entryId, field);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }

      return result;
    },

    /**
     * Get movement instance for advanced operations
     */
    getMovement: () => movement,
  };
}

/**
 * Validation helpers
 */
export function validateMovement(context: MovementContext, entryId: string, field?: TimeField): string | null {
  const entryIndex = context.fields.findIndex((f) => f.id === entryId);
  if (entryIndex === -1) {
    return "Entrada não encontrada";
  }

  if (field) {
    const fieldPath = `entries.${entryIndex}.${field}` as any;
    const value = context.form.getValues(fieldPath);
    if (!value) {
      return "Campo vazio, nada para mover";
    }
  }

  return null;
}

/**
 * Movement analytics for debugging
 */
export function getMovementAnalytics(context: MovementContext, entryId: string) {
  const entryIndex = context.fields.findIndex((f) => f.id === entryId);
  if (entryIndex === -1) return null;

  const filledFields: TimeField[] = [];
  const emptyFields: TimeField[] = [];

  TIME_FIELDS.forEach((field: TimeField) => {
    const value = context.form.getValues(`entries.${entryIndex}.${field}` as any);
    if (value) {
      filledFields.push(field);
    } else {
      emptyFields.push(field);
    }
  });

  return {
    entryId,
    entryIndex,
    filledFields,
    emptyFields,
    canMoveLeft: emptyFields.some((f: TimeField) => TIME_FIELDS.indexOf(f) < Math.min(...filledFields.map((f: TimeField) => TIME_FIELDS.indexOf(f)))),
    canMoveRight: emptyFields.some((f: TimeField) => TIME_FIELDS.indexOf(f) > Math.max(...filledFields.map((f: TimeField) => TIME_FIELDS.indexOf(f)))),
    canMoveToPreviousDay: entryIndex > 0,
    canMoveToNextDay: entryIndex < context.fields.length - 1,
  };
}
