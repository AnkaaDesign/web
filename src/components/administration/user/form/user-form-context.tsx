import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { type UserCreateFormData, type UserUpdateFormData } from "../../../../schemas";

type FormData = UserCreateFormData | UserUpdateFormData;
type FormErrors = Partial<Record<keyof FormData, string>>;

interface UserFormContextValue {
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

const UserFormContext = createContext<UserFormContextValue | null>(null);

export function useUserForm() {
  const context = useContext(UserFormContext);
  if (!context) {
    throw new Error("useUserForm must be used within UserFormProvider");
  }
  return context;
}

interface UserFormProviderProps {
  children: React.ReactNode;
  initialValues: FormData;
  onSubmit: (values: FormData) => Promise<void>;
  mode: "create" | "update";
  onDirtyChange?: (isDirty: boolean) => void;
}

export function UserFormProvider({ children, initialValues, onSubmit, mode, onDirtyChange }: UserFormProviderProps) {
  const [values, setValuesState] = useState<FormData>(initialValues);
  const [errors, setErrorsState] = useState<FormErrors>({});
  const [touched, setTouchedState] = useState<Set<keyof FormData>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalValues, setOriginalValues] = useState<FormData | null>(mode === "update" ? initialValues : null);

  // Track if form is dirty
  const isDirty = useRef(false);

  // Calculate isDirty whenever values change
  React.useEffect(() => {
    if (mode === "update" && originalValues) {
      const dirty = Object.keys(values).some((key) => {
        const field = key as keyof FormData;
        const currentValue = values[field];
        const originalValue = originalValues[field];

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
      return newValues;
    });
  }, []);

  const setValues = useCallback((newValues: Partial<FormData>) => {
    setValuesState((prev) => {
      return { ...prev, ...newValues };
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

  const contextValue: UserFormContextValue = {
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
    <UserFormContext.Provider value={contextValue}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setIsSubmitting(true);
          clearErrors();

          try {
            // Validate and submit
            await onSubmit(values);
          } catch (error) {
            console.error("Form submission error:", error);
          } finally {
            setIsSubmitting(false);
          }
        }}
        className="h-full"
      >
        {children}
      </form>
    </UserFormContext.Provider>
  );
}
