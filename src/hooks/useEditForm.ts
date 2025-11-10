// hooks/useEditForm.tsx
import { useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import type { UseFormProps, UseFormReturn, FieldValues, Resolver, DefaultValues } from "react-hook-form";
import _ from "lodash";

interface UseEditFormProps<TFieldValues extends FieldValues = FieldValues, TContext = any, TApiData = any> {
  resolver?: Resolver<TFieldValues, TContext>;
  defaultValues?: DefaultValues<TFieldValues>;
  originalData?: TApiData;
  onSubmit: (data: Partial<TFieldValues>) => Promise<void> | void;
  formOptions?: Omit<UseFormProps<TFieldValues, TContext>, "resolver" | "defaultValues">;
  mapDataToForm?: (apiData: TApiData) => TFieldValues;
  fieldsToOmitIfUnchanged?: (keyof TFieldValues)[];
}

interface UseEditFormReturn<TFieldValues extends FieldValues = FieldValues> extends Omit<UseFormReturn<TFieldValues>, "handleSubmit"> {
  handleSubmitChanges: (onValid?: (data: Partial<TFieldValues>) => unknown, onInvalid?: (errors: any) => unknown) => (e?: React.BaseSyntheticEvent) => Promise<void>;
  reset: UseFormReturn<TFieldValues>["reset"];
  getChangedFields: () => Partial<TFieldValues>;
}

/**
 * Deep comparison of values with special handling for dates, arrays, and null/undefined
 * CRITICAL: This function determines if a field has changed. Any edge case not handled
 * will prevent change detection and disable the submit button.
 */
function deepCompare(value1: any, value2: any): boolean {
  // Handle null/undefined/empty string cases - BUT keep "0" as a valid value
  const normalize = (val: any) => {
    // Explicitly handle falsy number values (0, -0) as valid
    if (typeof val === "number") return val;

    // Treat null, undefined, and empty string as null
    if (val === null || val === undefined || val === "") return null;
    if (val === "null" || val === "undefined") return null;
    return val;
  };

  const normalized1 = normalize(value1);
  const normalized2 = normalize(value2);

  // Both are null after normalization
  if (normalized1 === null && normalized2 === null) return true;

  // One is null and the other isn't
  if ((normalized1 === null) !== (normalized2 === null)) return false;

  // Handle dates - compare timestamps with millisecond precision
  if (value1 instanceof Date || value2 instanceof Date) {
    // If one is a Date and the other is not, they're different
    if ((value1 instanceof Date) !== (value2 instanceof Date)) {
      // Try to convert non-Date value to Date for comparison
      try {
        const date1 = value1 instanceof Date ? value1 : new Date(value1);
        const date2 = value2 instanceof Date ? value2 : new Date(value2);

        // Check if both dates are valid
        if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
          return date1.getTime() === date2.getTime();
        }
      } catch {
        return false;
      }
      return false;
    }

    const date1 = value1 as Date;
    const date2 = value2 as Date;

    // Check if both dates are valid
    if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
      return date1.getTime() === date2.getTime();
    }
    return false;
  }

  // Handle arrays - IMPORTANT: Order matters for arrays like services
  if (Array.isArray(value1) && Array.isArray(value2)) {
    // Debug paintIds array comparison
    if (value1.length > 0 && typeof value1[0] === "string" && value1[0].length > 20) {
      console.log('[deepCompare] 🎨 Comparing arrays (likely paintIds):');
      console.log('  Array1 length:', value1.length, 'items:', value1);
      console.log('  Array2 length:', value2.length, 'items:', value2);
    }

    if (value1.length !== value2.length) {
      if (value1.length > 0 && typeof value1[0] === "string" && value1[0].length > 20) {
        console.log('[deepCompare] 🎨 Arrays have different lengths - returning false');
      }
      return false;
    }

    // For empty arrays, they're equal
    if (value1.length === 0) return true;

    // For arrays of objects (like services), use lodash for deep comparison
    // This preserves order which is critical for service order detection
    if (value1.length > 0 && typeof value1[0] === "object" && value1[0] !== null) {
      return _.isEqual(value1, value2);
    }

    // For arrays of primitives (like IDs), DON'T sort - order might matter
    // Only sort for primitive arrays where we're sure order doesn't matter (like paintIds)
    // For now, compare directly to detect any changes
    const result = _.isEqual(value1, value2);
    if (value1.length > 0 && typeof value1[0] === "string" && value1[0].length > 20) {
      console.log('[deepCompare] 🎨 Lodash comparison result:', result);
    }
    return result;
  }

  // Handle objects (but not arrays or dates)
  if (typeof value1 === "object" && typeof value2 === "object" && value1 !== null && value2 !== null) {
    return _.isEqual(value1, value2);
  }

  // Handle numeric comparisons (0 === "0" should be false)
  if (typeof value1 === "number" || typeof value2 === "number") {
    // Strict type and value comparison for numbers
    if (typeof value1 !== typeof value2) return false;
    return value1 === value2;
  }

  // Primitive comparison
  return normalized1 === normalized2;
}

/**
 * Custom hook to track and submit only fields that have changed in a form
 */
export function useEditForm<TFieldValues extends FieldValues = FieldValues, TContext = any, TApiData = any>({
  resolver,
  defaultValues,
  originalData,
  onSubmit,
  formOptions = {},
  mapDataToForm,
  fieldsToOmitIfUnchanged = [],
}: UseEditFormProps<TFieldValues, TContext, TApiData>): UseEditFormReturn<TFieldValues> {
  const originalRef = useRef<TFieldValues | undefined>(undefined);
  const lastResetData = useRef<TFieldValues | undefined>(undefined);

  const form = useForm<TFieldValues>({
    resolver,
    defaultValues,
    ...formOptions,
  });

  // Update original values when data changes - only on initial mount or when data actually changes
  useEffect(() => {
    if (originalData) {
      const formData = mapDataToForm ? mapDataToForm(originalData) : (originalData as unknown as TFieldValues);

      // Only reset if the data has actually changed (deep comparison)
      if (!_.isEqual(originalRef.current, formData)) {
        // Reset form with new data
        originalRef.current = formData;
        lastResetData.current = formData;
        form.reset(formData as DefaultValues<TFieldValues>);
      }
    }
  }, [originalData, mapDataToForm]); // Removed 'form' from dependencies to avoid circular updates

  // Get changed fields
  const getChangedFields = useCallback(() => {
    const formData = form.getValues();
    const original = originalRef.current;


    if (!original) return {} as Partial<TFieldValues>;

    const changedFields: Partial<TFieldValues> = {} as Partial<TFieldValues>;
    const allKeys = new Set([...Object.keys(formData), ...Object.keys(original)]);

    allKeys.forEach((key) => {
      const typedKey = key as keyof TFieldValues;
      const currentValue = formData[typedKey];
      const originalValue = original[typedKey];

      // Special debugging for paintIds
      if (key === "paintIds") {
        console.log('[useEditForm] 🎨 Checking paintIds:');
        console.log('  Current:', currentValue);
        console.log('  Original:', originalValue);
        console.log('  deepCompare result:', deepCompare(currentValue, originalValue));
        console.log('  In omit list?', fieldsToOmitIfUnchanged.includes(typedKey));
      }

      // Skip if field is in omit list and hasn't changed
      if (fieldsToOmitIfUnchanged.includes(typedKey) && deepCompare(currentValue, originalValue)) {
        if (key === "paintIds") {
          console.log('[useEditForm] 🎨 Skipping paintIds - no change detected');
        }
        return;
      }

      // Check if value has changed
      if (!deepCompare(currentValue, originalValue)) {
        if (key === "paintIds") {
          console.log('[useEditForm] 🎨 paintIds CHANGED - including in changedFields');
        }
        // Special handling for certain fields
        if (key === "services") {
          // Explicitly check if it's an array before using filter
          if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
            const currentServices = currentValue as any[];
            const originalServices = originalValue as any[];

            // Filter out empty services
            const filteredCurrent = currentServices.filter((s: any) => s && s.description && s.description.trim() !== "");
            const filteredOriginal = originalServices.filter((s: any) => s && s.description && s.description.trim() !== "");

            // _.isEqual checks both content AND order, so this will detect order changes
            if (!_.isEqual(filteredCurrent, filteredOriginal)) {
              changedFields[typedKey] = filteredCurrent as any;
            }
          } else if (currentValue !== originalValue) {
            changedFields[typedKey] = currentValue;
          }
        } else {
          // For other fields, include the new value
          changedFields[typedKey] = currentValue;
        }
      } else if (key === "services" && Array.isArray(currentValue) && Array.isArray(originalValue)) {
        // Even if deepCompare returns true, explicitly check services order
        // This handles edge cases where dates might be compared as equal but are different objects
        const currentServices = currentValue as any[];
        const originalServices = originalValue as any[];

        const filteredCurrent = currentServices.filter((s: any) => s && s.description && s.description.trim() !== "");
        const filteredOriginal = originalServices.filter((s: any) => s && s.description && s.description.trim() !== "");

        // Check if order changed by comparing descriptions in order
        if (filteredCurrent.length === filteredOriginal.length) {
          const orderChanged = filteredCurrent.some((curr, idx) => {
            const orig = filteredOriginal[idx];
            return curr.description !== orig.description;
          });

          if (orderChanged) {
            changedFields[typedKey] = filteredCurrent as any;
          }
        }
      }
    });

    return changedFields;
  }, [form, fieldsToOmitIfUnchanged]);

  // Handle form submission
  const handleSubmitChanges = (onValid?: (data: Partial<TFieldValues>) => unknown, onInvalid?: (errors: any) => unknown) => {
    return form.handleSubmit(() => {
      const changedFields = getChangedFields();

      // Call onSubmit with changed fields
      const result = onSubmit(changedFields);
      if (onValid) onValid(changedFields);
      return result;
    }, (errors) => {
      if (onInvalid) onInvalid(errors);
    });
  };

  return {
    ...form,
    handleSubmitChanges,
    getChangedFields,
  };
}
