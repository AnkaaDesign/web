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
 */
function deepCompare(value1: any, value2: any): boolean {
  // Handle null/undefined/empty string cases
  const normalize = (val: any) => {
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

  // Handle dates
  if (value1 instanceof Date || value2 instanceof Date) {
    const date1 = value1 instanceof Date ? value1 : new Date(value1);
    const date2 = value2 instanceof Date ? value2 : new Date(value2);

    // Check if both dates are valid
    if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
      return date1.getTime() === date2.getTime();
    }
    return false;
  }

  // Handle arrays
  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (value1.length !== value2.length) return false;

    // For arrays of objects (like services)
    if (value1.length > 0 && typeof value1[0] === "object") {
      return _.isEqual(value1, value2);
    }

    // For arrays of primitives (like IDs), compare sorted
    const sorted1 = [...value1].sort();
    const sorted2 = [...value2].sort();
    return _.isEqual(sorted1, sorted2);
  }

  // Handle objects
  if (typeof value1 === "object" && typeof value2 === "object" && value1 !== null && value2 !== null) {
    return _.isEqual(value1, value2);
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

      // Skip if field is in omit list and hasn't changed
      if (fieldsToOmitIfUnchanged.includes(typedKey) && deepCompare(currentValue, originalValue)) {
        return;
      }

      // Check if value has changed
      if (!deepCompare(currentValue, originalValue)) {
        // Special handling for certain fields
        if (key === "services") {
          // Explicitly check if it's an array before using filter
          if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
            const currentServices = currentValue as any[];
            const originalServices = originalValue as any[];

            // Filter out empty services
            const filteredCurrent = currentServices.filter((s: any) => s && s.description && s.description.trim() !== "");
            const filteredOriginal = originalServices.filter((s: any) => s && s.description && s.description.trim() !== "");

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
      }
    });

    return changedFields;
  }, [form, fieldsToOmitIfUnchanged]);

  // Handle form submission
  const handleSubmitChanges = (onValid?: (data: Partial<TFieldValues>) => unknown, onInvalid?: (errors: any) => unknown) => {
    return form.handleSubmit(() => {
      const changedFields = getChangedFields();

      console.log("Changed fields:", changedFields);

      // Call onSubmit with changed fields
      const result = onSubmit(changedFields);
      if (onValid) onValid(changedFields);
      return result;
    }, onInvalid);
  };

  return {
    ...form,
    handleSubmitChanges,
    getChangedFields,
  };
}
