import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { supplierCreateSchema, supplierUpdateSchema, type SupplierCreateFormData, type SupplierUpdateFormData } from "../../../../schemas";

type FormData = SupplierCreateFormData | SupplierUpdateFormData;
type FormErrors = Partial<Record<keyof FormData, string>>;

interface SupplierFormContextValue {
  values: FormData;
  errors: FormErrors;
  touched: Set<keyof FormData>;
  isDirty: boolean;
  isSubmitting: boolean;
  originalValues: FormData | null;

  // Methods
  setValue: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  setValues: (values: Partial<FormData>) => void;
  setError: (field: keyof FormData, error: string | undefined) => void;
  setErrors: (errors: FormErrors) => void;
  clearError: (field: keyof FormData) => void;
  clearErrors: () => void;
  setTouched: (field: keyof FormData) => void;
  reset: (values?: FormData) => void;
  getFieldProps: <K extends keyof FormData>(
    field: K,
  ) => {
    value: FormData[K];
    onChange: (value: FormData[K]) => void;
    onBlur: () => void;
    error?: string;
    name: K;
  };
}

const SupplierFormContext = createContext<SupplierFormContextValue | null>(null);

export function useSupplierForm() {
  const context = useContext(SupplierFormContext);
  if (!context) {
    throw new Error("useSupplierForm must be used within SupplierFormProvider");
  }
  return context;
}

interface SupplierFormProviderProps {
  children: React.ReactNode;
  initialValues: FormData;
  onSubmit: (values: FormData) => Promise<void>;
  mode: "create" | "update";
  onDirtyChange?: (isDirty: boolean) => void;
}

export function SupplierFormProvider({ children, initialValues, onSubmit, mode, onDirtyChange }: SupplierFormProviderProps) {
  const [values, setValuesState] = useState<FormData>(initialValues);
  const [errors, setErrorsState] = useState<FormErrors>({});
  const [touched, setTouchedState] = useState<Set<keyof FormData>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalValues, setOriginalValues] = useState<FormData | null>(mode === "update" ? initialValues : null);

  // Validate on mount and when values change
  useEffect(() => {
    const validateForm = async () => {
      const schema = mode === "create" ? supplierCreateSchema : supplierUpdateSchema;
      const result = schema.safeParse(values);

      if (!result.success) {
        const formErrors: FormErrors = {};
        result.error.errors.forEach((error) => {
          if (error.path[0]) {
            formErrors[error.path[0] as keyof FormData] = error.message;
          }
        });
        setErrorsState(formErrors);
      } else {
        setErrorsState({});
      }
    };

    validateForm();
  }, [values, mode]);

  // Track if form is dirty
  const isDirty = useRef(false);

  // Calculate isDirty whenever values change
  React.useEffect(() => {
    if (mode === "update" && originalValues) {
      const dirty = Object.keys(values).some((key) => {
        const field = key as keyof FormData;
        const currentValue = values[field];
        const originalValue = originalValues[field];

        // Special handling for arrays (phones)
        if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
          return JSON.stringify(currentValue) !== JSON.stringify(originalValue);
        }

        return currentValue !== originalValue;
      });

      if (dirty !== isDirty.current) {
        isDirty.current = dirty;
        onDirtyChange?.(dirty);
      }
    }
  }, [values, originalValues, mode, onDirtyChange]);

  const setValue = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setValuesState((prev) => {
      // Create a new object to ensure React detects the change
      const newValues = { ...prev, [field]: value };

      // Special handling for phones to ensure it's always an array
      if (field === "phones") {
        if (!Array.isArray(value)) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn("🚨 [FORM-CONTEXT] Phones field must be an array, received:", value);
          }
          newValues.phones = [];
        }
      }
      return newValues;
    });
  }, []);

  const setValues = useCallback((newValues: Partial<FormData>) => {
    setValuesState((prev) => {
      const updated = { ...prev, ...newValues };

      // Ensure phones is always an array
      if ("phones" in newValues && !Array.isArray(updated.phones)) {
        updated.phones = [];
      }

      return updated;
    });
  }, []);

  const setError = useCallback((field: keyof FormData, error: string | undefined) => {
    setErrorsState((prev) => {
      if (error === undefined) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: error };
    });
  }, []);

  const setErrors = useCallback((errors: FormErrors) => {
    setErrorsState(errors);
  }, []);

  const clearError = useCallback((field: keyof FormData) => {
    setErrorsState((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  const setTouched = useCallback((field: keyof FormData) => {
    setTouchedState((prev) => new Set(prev).add(field));
  }, []);

  const reset = useCallback(
    (newValues?: FormData) => {
      const resetValues = newValues || initialValues;
      setValuesState(resetValues);
      setErrorsState({});
      setTouchedState(new Set());
      if (mode === "update") {
        setOriginalValues(resetValues);
      }
      isDirty.current = false;
      onDirtyChange?.(false);
    },
    [initialValues, mode, onDirtyChange],
  );

  const getFieldProps = useCallback(
    <K extends keyof FormData>(field: K) => {
      return {
        name: field,
        value: values[field],
        onChange: (value: FormData[K]) => setValue(field, value),
        onBlur: () => setTouched(field),
        error: touched.has(field) ? errors[field] : undefined,
      };
    },
    [values, errors, touched, setValue, setTouched],
  );

  const contextValue: SupplierFormContextValue = {
    values,
    errors,
    touched,
    isDirty: isDirty.current,
    isSubmitting,
    originalValues,
    setValue,
    setValues,
    setError,
    setErrors,
    clearError,
    clearErrors,
    setTouched,
    reset,
    getFieldProps,
  };

  return (
    <SupplierFormContext.Provider value={contextValue}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();

          // Mark all fields as touched to show validation errors
          const allFields = Object.keys(values) as (keyof FormData)[];
          allFields.forEach((field) => setTouched(field));

          // Validate before submission
          const schema = mode === "create" ? supplierCreateSchema : supplierUpdateSchema;
          const result = schema.safeParse(values);

          if (!result.success) {
            const formErrors: FormErrors = {};
            result.error.errors.forEach((error) => {
              if (error.path[0]) {
                formErrors[error.path[0] as keyof FormData] = error.message;
              }
            });
            setErrorsState(formErrors);
            return;
          }

          setIsSubmitting(true);
          clearErrors();

          try {
            // Submit validated data
            await onSubmit(result.data);
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error("Form submission error:", error);
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
        className="h-full"
      >
        {children}
      </form>
    </SupplierFormContext.Provider>
  );
}
