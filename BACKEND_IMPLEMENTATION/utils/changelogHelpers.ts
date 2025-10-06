/**
 * Changelog Helper Utilities
 *
 * Provides utility functions for comparing complex data structures
 * and creating changelog entries for relations.
 *
 * @module utils/changelogHelpers
 */

import type { FieldChange, RelationHandler } from '../services/ChangelogService';

/**
 * Compare two arrays of objects and detect changes
 *
 * Useful for tracking changes in arrays like cuts, services, airbrushings, etc.
 *
 * @param oldArray - Previous array state
 * @param newArray - New array state
 * @param idField - Field to use for matching items (default: 'id')
 * @returns boolean - True if arrays are different
 *
 * @example
 * const changed = hasArrayChanged(oldCuts, newCuts, 'id');
 */
export function hasArrayChanged(
  oldArray: any[],
  newArray: any[],
  idField: string = 'id'
): boolean {
  // Handle null/undefined
  if (!oldArray && !newArray) return false;
  if (!oldArray || !newArray) return true;

  // Different lengths = changed
  if (oldArray.length !== newArray.length) return true;

  // Compare serialized versions (simple but effective)
  const oldSorted = JSON.stringify(sortArrayByField(oldArray, idField));
  const newSorted = JSON.stringify(sortArrayByField(newArray, idField));

  return oldSorted !== newSorted;
}

/**
 * Sort array by a specific field for consistent comparison
 *
 * @param array - Array to sort
 * @param field - Field to sort by
 * @returns Sorted array
 */
function sortArrayByField(array: any[], field: string): any[] {
  return [...array].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
}

/**
 * Group array items by a field and count occurrences
 *
 * Useful for grouping cuts by type, services by description, etc.
 *
 * @param array - Array to group
 * @param groupByField - Field to group by
 * @param fields - Fields to include in grouped items
 * @returns Grouped items with counts
 *
 * @example
 * const grouped = groupArrayItems(cuts, 'type', ['type', 'fileId']);
 * // Result: [{ type: 'VINYL', fileId: 'xxx', count: 3 }]
 */
export function groupArrayItems(
  array: any[],
  groupByField: string,
  fields: string[] = []
): any[] {
  if (!array || array.length === 0) return [];

  const grouped = new Map<string, any>();

  for (const item of array) {
    const key = fields.length > 0
      ? fields.map(f => item[f]).join('|')
      : item[groupByField];

    if (grouped.has(key)) {
      const existing = grouped.get(key);
      existing.count = (existing.count || 1) + 1;
    } else {
      const groupedItem: any = { count: 1 };

      // Include specified fields
      if (fields.length > 0) {
        fields.forEach(f => {
          groupedItem[f] = item[f];
        });
      } else {
        groupedItem[groupByField] = item[groupByField];
      }

      grouped.set(key, groupedItem);
    }
  }

  return Array.from(grouped.values());
}

/**
 * Create a simplified representation of an array for changelog
 *
 * Reduces array to essential fields only for cleaner changelog entries
 *
 * @param array - Array to simplify
 * @param fields - Fields to keep
 * @returns Simplified array
 *
 * @example
 * const simplified = simplifyArray(cuts, ['type', 'quantity', 'fileId']);
 */
export function simplifyArray(array: any[], fields: string[]): any[] {
  if (!array || array.length === 0) return [];

  return array.map(item => {
    const simplified: any = {};
    fields.forEach(field => {
      if (item[field] !== undefined) {
        simplified[field] = item[field];
      }
    });
    return simplified;
  });
}

/**
 * Create a relation handler for array-based relations
 *
 * This factory function creates RelationHandler functions for tracking
 * changes in array-based relations like cuts, services, airbrushings.
 *
 * @param config - Configuration for the relation handler
 * @returns RelationHandler function
 *
 * @example
 * const cutsHandler = createArrayRelationHandler({
 *   fieldName: 'cuts',
 *   simplifyFields: ['type', 'quantity', 'fileId', 'origin'],
 *   groupBy: 'type',
 * });
 */
export function createArrayRelationHandler(config: {
  fieldName: string;
  simplifyFields?: string[];
  groupBy?: string;
  compareRaw?: boolean;
}): RelationHandler {
  const { fieldName, simplifyFields, groupBy, compareRaw = false } = config;

  return (oldValue: any, newValue: any): FieldChange | null => {
    // Normalize to arrays
    const oldArray = Array.isArray(oldValue) ? oldValue : [];
    const newArray = Array.isArray(newValue) ? newValue : [];

    // Check if changed
    if (!hasArrayChanged(oldArray, newArray)) {
      return null;
    }

    // Prepare values for changelog
    let oldChangelogValue: any = oldArray;
    let newChangelogValue: any = newArray;

    if (!compareRaw) {
      // Simplify arrays if fields specified
      if (simplifyFields) {
        oldChangelogValue = simplifyArray(oldArray, simplifyFields);
        newChangelogValue = simplifyArray(newArray, simplifyFields);
      }

      // Group arrays if groupBy specified
      if (groupBy && simplifyFields) {
        oldChangelogValue = groupArrayItems(oldChangelogValue, groupBy, simplifyFields);
        newChangelogValue = groupArrayItems(newChangelogValue, groupBy, simplifyFields);
      }
    }

    return {
      field: fieldName,
      oldValue: oldChangelogValue,
      newValue: newChangelogValue,
    };
  };
}

/**
 * Create a relation handler for object-based relations
 *
 * For single relations like observation, truck, etc.
 *
 * @param config - Configuration for the relation handler
 * @returns RelationHandler function
 *
 * @example
 * const observationHandler = createObjectRelationHandler({
 *   fieldName: 'observation',
 *   simplifyFields: ['description'],
 * });
 */
export function createObjectRelationHandler(config: {
  fieldName: string;
  simplifyFields?: string[];
}): RelationHandler {
  const { fieldName, simplifyFields } = config;

  return (oldValue: any, newValue: any): FieldChange | null => {
    // Handle null/undefined
    const oldExists = oldValue !== null && oldValue !== undefined;
    const newExists = newValue !== null && newValue !== undefined;

    // No change if both null/undefined
    if (!oldExists && !newExists) {
      return null;
    }

    // Simplify objects if fields specified
    let oldChangelogValue: any = oldValue;
    let newChangelogValue: any = newValue;

    if (simplifyFields) {
      if (oldExists) {
        oldChangelogValue = {};
        simplifyFields.forEach(field => {
          if (oldValue[field] !== undefined) {
            oldChangelogValue[field] = oldValue[field];
          }
        });
      }

      if (newExists) {
        newChangelogValue = {};
        simplifyFields.forEach(field => {
          if (newValue[field] !== undefined) {
            newChangelogValue[field] = newValue[field];
          }
        });
      }
    }

    // Check if actually changed
    if (JSON.stringify(oldChangelogValue) === JSON.stringify(newChangelogValue)) {
      return null;
    }

    return {
      field: fieldName,
      oldValue: oldChangelogValue,
      newValue: newChangelogValue,
    };
  };
}

/**
 * Create a relation handler for ID-based relations
 *
 * For relations tracked by foreign keys like customerId, sectorId, etc.
 * Optionally fetches and includes the related entity name.
 *
 * @param config - Configuration for the relation handler
 * @returns RelationHandler function
 *
 * @example
 * const customerHandler = createIdRelationHandler({
 *   fieldName: 'customerId',
 *   entityName: 'customer',
 * });
 */
export function createIdRelationHandler(config: {
  fieldName: string;
  entityName?: string;
}): RelationHandler {
  const { fieldName, entityName } = config;

  return (oldValue: any, newValue: any): FieldChange | null => {
    // Check if changed
    if (oldValue === newValue) {
      return null;
    }

    // For ID fields, store the IDs
    // If you want to include entity names, you'd need to fetch them
    return {
      field: fieldName,
      oldValue: oldValue,
      newValue: newValue,
    };
  };
}

/**
 * Diff two arrays and return detailed changes
 *
 * Returns information about added, removed, and modified items
 *
 * @param oldArray - Previous array
 * @param newArray - New array
 * @param idField - Field to use for matching (default: 'id')
 * @returns Object with added, removed, and modified items
 *
 * @example
 * const diff = diffArrays(oldCuts, newCuts, 'id');
 * console.log(`Added: ${diff.added.length}, Removed: ${diff.removed.length}`);
 */
export function diffArrays(
  oldArray: any[],
  newArray: any[],
  idField: string = 'id'
): {
  added: any[];
  removed: any[];
  modified: any[];
  unchanged: any[];
} {
  const oldArr = oldArray || [];
  const newArr = newArray || [];

  const oldMap = new Map(oldArr.map(item => [item[idField], item]));
  const newMap = new Map(newArr.map(item => [item[idField], item]));

  const added: any[] = [];
  const removed: any[] = [];
  const modified: any[] = [];
  const unchanged: any[] = [];

  // Find added and modified
  for (const [id, newItem] of newMap) {
    const oldItem = oldMap.get(id);
    if (!oldItem) {
      added.push(newItem);
    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      modified.push({ old: oldItem, new: newItem });
    } else {
      unchanged.push(newItem);
    }
  }

  // Find removed
  for (const [id, oldItem] of oldMap) {
    if (!newMap.has(id)) {
      removed.push(oldItem);
    }
  }

  return { added, removed, modified, unchanged };
}

/**
 * Format array change description for changelog
 *
 * Creates a human-readable description of array changes
 *
 * @param oldArray - Previous array
 * @param newArray - New array
 * @param itemName - Name of items (singular)
 * @param itemNamePlural - Name of items (plural)
 * @returns Description string
 *
 * @example
 * const desc = formatArrayChangeDescription(oldCuts, newCuts, 'recorte', 'recortes');
 * // Result: "Recortes alterados de 2 para 3"
 */
export function formatArrayChangeDescription(
  oldArray: any[],
  newArray: any[],
  itemName: string,
  itemNamePlural: string
): string {
  const oldCount = oldArray?.length || 0;
  const newCount = newArray?.length || 0;

  if (oldCount === 0 && newCount === 1) {
    return `${itemName} adicionado`;
  }
  if (oldCount === 0 && newCount > 1) {
    return `${newCount} ${itemNamePlural} adicionados`;
  }
  if (oldCount === 1 && newCount === 0) {
    return `${itemName} removido`;
  }
  if (oldCount > 1 && newCount === 0) {
    return `${oldCount} ${itemNamePlural} removidos`;
  }

  return `${itemNamePlural} alterados de ${oldCount} para ${newCount}`;
}
