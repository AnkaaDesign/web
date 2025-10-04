import { useCallback, useRef } from "react";

// Types
export interface FieldModification {
  entryId: string;
  field: string;
  originalValue: any;
  currentValue: any;
  isModified: boolean;
}

export interface ModificationState {
  modifications: Map<string, FieldModification>;
  changedEntries: Set<string>;
}

export interface StateActions {
  updateField: (entryId: string, field: string, value: any, originalValue: any) => void;
  restoreAll: () => void;
  restoreEntry: (entryId: string) => void;
  restoreField: (entryId: string, field: string) => void;
  getModification: (entryId: string, field: string) => FieldModification | undefined;
  isFieldModified: (entryId: string, field: string) => boolean;
  isEntryModified: (entryId: string) => boolean;
  getAllModifications: () => FieldModification[];
  getChangedEntryCount: () => number;
}

export interface TimeClockStateManager {
  state: ModificationState;
  actions: StateActions;
}

/**
 * Simple, reliable state manager for tracking time clock entry modifications
 *
 * Features:
 * - Map-based storage for O(1) lookups
 * - Proper null/empty string normalization
 * - Entry-level and field-level tracking
 * - Clean restoration methods
 * - Change count notifications
 */
export function useTimeClockState(onChangedEntriesChange?: (count: number) => void): TimeClockStateManager {
  const stateRef = useRef<ModificationState>({
    modifications: new Map(),
    changedEntries: new Set(),
  });

  /**
   * Normalize values for comparison
   * Treats null, undefined, and empty string as equivalent
   */
  const normalizeValue = useCallback((value: any): string => {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    return String(value);
  }, []);

  /**
   * Check if a field value is actually different from original
   */
  const isValueModified = useCallback(
    (originalValue: any, currentValue: any): boolean => {
      return normalizeValue(originalValue) !== normalizeValue(currentValue);
    },
    [normalizeValue],
  );

  /**
   * Create unique key for field identification
   */
  const createFieldKey = useCallback((entryId: string, field: string): string => {
    return `${entryId}.${field}`;
  }, []);

  /**
   * Update entry's changed status and notify parent
   */
  const updateEntryStatus = useCallback(
    (entryId: string) => {
      // Check if entry has any modifications
      const hasModifications = Array.from(stateRef.current.modifications.values()).some((mod: FieldModification) => mod.entryId === entryId && mod.isModified);

      if (hasModifications) {
        stateRef.current.changedEntries.add(entryId);
      } else {
        stateRef.current.changedEntries.delete(entryId);
      }

      // Notify parent of count change
      onChangedEntriesChange?.(stateRef.current.changedEntries.size);
    },
    [onChangedEntriesChange],
  );

  /**
   * Update a single field value and track modification
   */
  const updateField = useCallback(
    (entryId: string, field: string, value: any, originalValue: any) => {
      const key = createFieldKey(entryId, field);
      const isModified = isValueModified(originalValue, value);

      const modification: FieldModification = {
        entryId,
        field,
        originalValue,
        currentValue: value,
        isModified,
      };

      if (isModified) {
        // Track the modification
        stateRef.current.modifications.set(key, modification);
      } else {
        // Remove if no longer modified
        stateRef.current.modifications.delete(key);
      }

      // Update entry's changed status
      updateEntryStatus(entryId);
    },
    [createFieldKey, isValueModified, updateEntryStatus],
  );

  /**
   * Restore all modifications
   */
  const restoreAll = useCallback(() => {
    stateRef.current.modifications.clear();
    stateRef.current.changedEntries.clear();
    onChangedEntriesChange?.(0);
  }, [onChangedEntriesChange]);

  /**
   * Restore all modifications for a single entry
   */
  const restoreEntry = useCallback(
    (entryId: string) => {
      // Remove all modifications for this entry
      for (const [key, modification] of stateRef.current.modifications) {
        if (modification.entryId === entryId) {
          stateRef.current.modifications.delete(key);
        }
      }

      // Update entry status
      stateRef.current.changedEntries.delete(entryId);
      onChangedEntriesChange?.(stateRef.current.changedEntries.size);
    },
    [onChangedEntriesChange],
  );

  /**
   * Restore modification for a single field
   */
  const restoreField = useCallback(
    (entryId: string, field: string) => {
      const key = createFieldKey(entryId, field);
      stateRef.current.modifications.delete(key);

      // Update entry status
      updateEntryStatus(entryId);
    },
    [createFieldKey, updateEntryStatus],
  );

  /**
   * Get modification data for a specific field
   */
  const getModification = useCallback(
    (entryId: string, field: string) => {
      const key = createFieldKey(entryId, field);
      return stateRef.current.modifications.get(key);
    },
    [createFieldKey],
  );

  /**
   * Check if a specific field is modified
   */
  const isFieldModified = useCallback(
    (entryId: string, field: string): boolean => {
      const modification = getModification(entryId, field);
      return modification?.isModified ?? false;
    },
    [getModification],
  );

  /**
   * Check if an entry has any modifications
   */
  const isEntryModified = useCallback((entryId: string): boolean => {
    return stateRef.current.changedEntries.has(entryId);
  }, []);

  /**
   * Get all modifications that are actually different from original
   */
  const getAllModifications = useCallback((): FieldModification[] => {
    return Array.from(stateRef.current.modifications.values()).filter((mod: FieldModification) => mod.isModified);
  }, []);

  /**
   * Get count of entries that have changes
   */
  const getChangedEntryCount = useCallback((): number => {
    return stateRef.current.changedEntries.size;
  }, []);

  return {
    state: stateRef.current,
    actions: {
      updateField,
      restoreAll,
      restoreEntry,
      restoreField,
      getModification,
      isFieldModified,
      isEntryModified,
      getAllModifications,
      getChangedEntryCount,
    },
  };
}

// Export the hook with the same name for backward compatibility
export const useTimeClockStateManager = useTimeClockState;
