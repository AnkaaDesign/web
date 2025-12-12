import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { TimeClockEntryBatchUpdateFormData, TimeClockJustificationFormData } from "../../../schemas";
import { timeClockEntryBatchUpdateSchema, timeClockJustificationSchema } from "../../../schemas";
import type { SecullumTimeEntry } from "@/types/time-clock";
import { normalizeSecullumEntry } from "@/types/time-clock";
import { secullumService } from "../../../api-client";
import { useTimeClockStateManager } from "./state";

// Inline PendingJustification type
interface PendingJustification {
  entryId: string;
  field: string;
  originalTime: string;
  newTime: string;
  fieldLabel: string;
}

// Time field validation rules
const TIME_PATTERN = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Validation schema for individual time fields
const validateTimeField = (value: string | null): boolean => {
  if (!value) return true; // Null/empty is valid
  return TIME_PATTERN.test(value);
};

// Custom validation for time sequence (entry should be before exit)
const validateTimeSequence = (entry: string | null, exit: string | null): boolean => {
  if (!entry || !exit) return true; // Can't validate incomplete pairs

  const [entryHours, entryMinutes] = entry.split(":").map(Number);
  const [exitHours, exitMinutes] = exit.split(":").map(Number);

  const entryTime = entryHours * 60 + entryMinutes;
  const exitTime = exitHours * 60 + exitMinutes;

  return entryTime < exitTime;
};

// Form configuration interface
export interface TimeClockFormConfig {
  entries: SecullumTimeEntry[];
  isLoading?: boolean;
  onChangedRowsChange?: (count: number) => void;
  onSubmitSuccess?: (data: TimeClockEntryBatchUpdateFormData) => void;
  onSubmitError?: (error: any) => void;
}

// Form state interface
export interface TimeClockFormState {
  isPending: boolean;
  hasChanges: boolean;
  changedRowCount: number;
  pendingJustification: PendingJustification | null;
}

// Form actions interface
export interface TimeClockFormActions {
  handleSubmit: () => void;
  handleRestore: () => void;
  handleTimeChange: (entryId: string, field: string, value: string | null) => void;
  handleTimeBlur: (entryId: string, field: string, fieldLabel: string, originalValue: string | null, currentValue: string | null) => void;
  handleCheckboxChange: (entryId: string, field: string, value: boolean) => void;
  handleJustificationConfirm: () => void;
  handleJustificationCancel: () => void;
  isFieldModified: (entryId: string, field: string) => boolean;
  isEntryModified: (entryId: string) => boolean;
  getFieldError: (entryId: string, field: string) => string | null;
  validateEntry: (entryId: string) => boolean;
}

// Main form hook
export function useTimeClockForm(config: TimeClockFormConfig) {
  const { entries, isLoading, onChangedRowsChange, onSubmitSuccess, onSubmitError } = config;

  // Internal state
  const [isPending, setIsPending] = useState(false);
  const [pendingJustification, setPendingJustification] = useState<PendingJustification | null>(null);

  // State manager for tracking changes
  const stateManager = useTimeClockStateManager(onChangedRowsChange);

  // Normalize entries for form usage
  const originalNormalizedEntries = useMemo(() => {
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    return entries.map((entry) => {
      const normalized = normalizeSecullumEntry(entry);

      // Check if entry has electronic source (FonteDados)
      if ((entry as any).FonteDados) {
        normalized.source = (entry as any).FonteDados.Origem === 1 ? "ELECTRONIC" : "MANUAL";
        normalized.hasPhoto = (entry as any).FonteDados.PossuiFoto || false;
      }
      return normalized;
    });
  }, [entries]);

  // Form default data
  const defaultFormData = useMemo(
    () => ({
      entries: originalNormalizedEntries.map((entry) => ({
        id: entry.id,
        entry1: entry.entry1 ?? null,
        exit1: entry.exit1 ?? null,
        entry2: entry.entry2 ?? null,
        exit2: entry.exit2 ?? null,
        entry3: entry.entry3 ?? null,
        exit3: entry.exit3 ?? null,
        entry4: entry.entry4 ?? null,
        exit4: entry.exit4 ?? null,
        entry5: entry.entry5 ?? null,
        exit5: entry.exit5 ?? null,
        compensated: entry.compensated,
        neutral: entry.neutral,
        dayOff: entry.dayOff,
        freeLunch: entry.freeLunch,
      })),
    }),
    [originalNormalizedEntries],
  );

  // React Hook Form setup with custom validation
  const form = useForm<TimeClockEntryBatchUpdateFormData>({
    resolver: zodResolver(timeClockEntryBatchUpdateSchema),
    defaultValues: defaultFormData,
    mode: "onChange",
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "entries",
  });

  // Form initialization logic
  const hasInitializedForm = useRef(false);
  const previousEntriesLength = useRef(0);

  useEffect(() => {
    const currentLength = defaultFormData.entries.length;

    // Only reset if we actually have new data and haven't initialized yet
    if (currentLength > 0 && currentLength !== previousEntriesLength.current && !hasInitializedForm.current) {
      form.reset(defaultFormData);
      hasInitializedForm.current = true;
      previousEntriesLength.current = currentLength;
    }
  }, [defaultFormData, form]);

  // Field validation
  const getFieldError = useCallback(
    (entryId: string, field: string): string | null => {
      const entryIndex = fields.findIndex((f) => f.id === entryId);
      if (entryIndex === -1) return null;

      const formErrors = form.formState.errors;
      const error = formErrors.entries?.[entryIndex]?.[field as keyof (typeof formErrors.entries)[0]];

      if (error && typeof error === "object" && "message" in error) {
        return (error as any).message || "Campo inválido";
      }

      // Custom validation for time fields
      if (field.includes("entry") || field.includes("exit")) {
        const value = form.getValues(`entries.${entryIndex}.${field}` as any) as string | null;

        if (value && !validateTimeField(value)) {
          return "Formato de hora inválido (HH:MM)";
        }

        // Validate time sequence
        if (field.includes("entry")) {
          const exitField = field.replace("entry", "exit");
          const exitValue = form.getValues(`entries.${entryIndex}.${exitField}` as any) as string | null;

          if (value && exitValue && !validateTimeSequence(value, exitValue)) {
            return "Hora de entrada deve ser anterior à saída";
          }
        }

        if (field.includes("exit")) {
          const entryField = field.replace("exit", "entry");
          const entryValue = form.getValues(`entries.${entryIndex}.${entryField}` as any) as string | null;

          if (value && entryValue && !validateTimeSequence(entryValue, value)) {
            return "Hora de saída deve ser posterior à entrada";
          }
        }
      }

      return null;
    },
    [fields, form],
  );

  // Entry validation
  const validateEntry = useCallback(
    (entryId: string): boolean => {
      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];

      for (const field of timeFields) {
        const error = getFieldError(entryId, field);
        if (error) {
          return false;
        }
      }

      return true;
    },
    [getFieldError],
  );

  // Handle field changes
  const handleFieldChange = useCallback(
    (entryId: string, field: string, value: any) => {
      const entryIndex = fields.findIndex((f) => f.id === entryId);

      if (entryIndex !== -1) {
        const fieldName = `entries.${entryIndex}.${field}` as any;

        form.setValue(fieldName, value, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      // Track the change using state manager
      const originalEntry = originalNormalizedEntries.find((e: any) => e.id === entryId);
      if (originalEntry) {
        const originalValue = originalEntry[field as keyof typeof originalEntry];
        stateManager.actions.updateField(entryId, field, value, originalValue);
      }
    },
    [fields, form, originalNormalizedEntries, stateManager.actions],
  );

  // Handle time changes
  const handleTimeChange = useCallback(
    (entryId: string, field: string, value: string | null) => {
      // Basic format validation
      if (value && !validateTimeField(value)) {
        toast.error("Formato de hora inválido. Use HH:MM");
        return;
      }

      handleFieldChange(entryId, field, value);
    },
    [handleFieldChange],
  );

  // Handle time blur with justification logic
  const handleTimeBlur = useCallback(
    (entryId: string, field: string, fieldLabel: string, originalValue: string | null, currentValue: string | null) => {
      // Validate the current value
      if (currentValue && !validateTimeField(currentValue)) {
        // Reset to original value if invalid
        handleFieldChange(entryId, field, originalValue);
        toast.error("Formato de hora inválido. Valor restaurado.");
        return;
      }

      // Validate time sequence
      const entryIndex = fields.findIndex((f) => f.id === entryId);
      if (entryIndex !== -1) {
        let isSequenceValid = true;

        if (field.includes("entry")) {
          const exitField = field.replace("entry", "exit");
          const exitValue = form.getValues(`entries.${entryIndex}.${exitField}` as any) as string | null;

          if (currentValue && exitValue && !validateTimeSequence(currentValue, exitValue)) {
            isSequenceValid = false;
          }
        }

        if (field.includes("exit")) {
          const entryField = field.replace("exit", "entry");
          const entryValue = form.getValues(`entries.${entryIndex}.${entryField}` as any) as string | null;

          if (currentValue && entryValue && !validateTimeSequence(entryValue, currentValue)) {
            isSequenceValid = false;
          }
        }

        if (!isSequenceValid) {
          handleFieldChange(entryId, field, originalValue);
          toast.error("Horários devem estar em sequência. Valor restaurado.");
          return;
        }
      }

      // If changing from a value to another value (not clearing), request justification
      if (originalValue && currentValue && originalValue !== currentValue) {
        setPendingJustification({
          entryId,
          field,
          originalTime: originalValue,
          newTime: currentValue,
          fieldLabel,
        });
      }
    },
    [fields, form, handleFieldChange],
  );

  // Handle checkbox changes
  const handleCheckboxChange = useCallback(
    (entryId: string, field: string, value: boolean) => {
      handleFieldChange(entryId, field, value);
    },
    [handleFieldChange],
  );

  // Handle justification confirmation
  const handleJustificationConfirm = useCallback(() => {
    if (pendingJustification) {
      handleFieldChange(pendingJustification.entryId, pendingJustification.field, pendingJustification.newTime);
    }
    setPendingJustification(null);
  }, [handleFieldChange, pendingJustification]);

  // Handle justification cancellation
  const handleJustificationCancel = useCallback(() => {
    if (pendingJustification) {
      // Restore original value
      handleFieldChange(pendingJustification.entryId, pendingJustification.field, pendingJustification.originalTime);
    }
    setPendingJustification(null);
  }, [handleFieldChange, pendingJustification]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: TimeClockEntryBatchUpdateFormData) => {
      setIsPending(true);

      try {
        // Filter only changed entries
        const changedCount = stateManager.actions.getChangedEntryCount();
        const modifications = stateManager.actions.getAllModifications();

        if (changedCount === 0) {
          toast.info("Nenhuma alteração para salvar");
          return;
        }

        // Validate all changed entries
        const invalidEntries = modifications
          .map((mod) => mod.entryId)
          .filter((entryId: string, index: number, array: string[]) => array.indexOf(entryId) === index) // Remove duplicates
          .filter((entryId: string) => !validateEntry(entryId));

        if (invalidEntries.length > 0) {
          toast.error("Existem campos com erros de validação. Corrija antes de salvar.");
          return;
        }

        // Build changed entries from modifications
        const changedEntriesMap = new Map<string, any>();

        modifications.forEach((mod) => {
          if (!changedEntriesMap.has(mod.entryId)) {
            const entry = data.entries.find((e: any) => e.id === mod.entryId);
            if (entry) {
              changedEntriesMap.set(mod.entryId, { ...entry });
            }
          }
        });

        const changedEntries = Array.from(changedEntriesMap.values());

        // Submit to Secullum API
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const entry of changedEntries) {
          try {
            await secullumService.updateTimeEntry(parseInt(entry.id), entry);
            successCount++;
          } catch (error: any) {
            errorCount++;
            const errorMessage = error.response?.data?.message || error.message || "Erro desconhecido";
            errors.push(`Entrada ${entry.id}: ${errorMessage}`);
          }
        }

        // Show results
        if (successCount > 0) {
          toast.success(`${successCount} registros salvos com sucesso`);
        }

        if (errorCount > 0) {
          toast.error(`${errorCount} registros falharam`);
          if (errors.length <= 3) {
            errors.forEach((error) => toast.error(error));
          } else {
            toast.error("Múltiplos erros ocorreram. Verifique os dados e tente novamente.");
          }
        }

        // If all succeeded, clear state
        if (errorCount === 0) {
          stateManager.actions.restoreAll();
          form.reset(defaultFormData);
          onSubmitSuccess?.(data);
        }
      } catch (error) {
        console.error("Form submission error:", error);
        toast.error("Erro ao salvar alterações");
        onSubmitError?.(error);
      } finally {
        setIsPending(false);
      }
    },
    [stateManager.actions, form, defaultFormData, validateEntry, onSubmitSuccess, onSubmitError],
  );

  // Handle form restore
  const handleRestore = useCallback(() => {
    stateManager.actions.restoreAll();
    form.reset(defaultFormData);
    setPendingJustification(null);
    toast.info("Alterações restauradas");
  }, [stateManager.actions, form, defaultFormData]);

  // Form state
  const formState: TimeClockFormState = useMemo(
    () => ({
      isPending,
      hasChanges: stateManager.actions.getChangedEntryCount() > 0,
      changedRowCount: stateManager.actions.getChangedEntryCount(),
      pendingJustification,
    }),
    [isPending, stateManager.actions, pendingJustification],
  );

  // Form actions
  const formActions: TimeClockFormActions = useMemo(
    () => ({
      handleSubmit: () => form.handleSubmit(handleSubmit)(),
      handleRestore,
      handleTimeChange,
      handleTimeBlur,
      handleCheckboxChange,
      handleJustificationConfirm,
      handleJustificationCancel,
      isFieldModified: stateManager.actions.isFieldModified,
      isEntryModified: stateManager.actions.isEntryModified,
      getFieldError,
      validateEntry,
    }),
    [
      form,
      handleSubmit,
      handleRestore,
      handleTimeChange,
      handleTimeBlur,
      handleCheckboxChange,
      handleJustificationConfirm,
      handleJustificationCancel,
      stateManager.actions,
      getFieldError,
      validateEntry,
    ],
  );

  return {
    form,
    fields,
    originalNormalizedEntries,
    formState,
    formActions,
    isLoading: isLoading ?? false,
  };
}

// Justification form hook
export function useJustificationForm() {
  const form = useForm<TimeClockJustificationFormData>({
    resolver: zodResolver(timeClockJustificationSchema),
    defaultValues: {
      originalTime: "",
      newTime: "",
      field: "",
      reason: "",
    },
  });

  const handleJustificationSubmit = useCallback(
    async (data: TimeClockJustificationFormData, onSuccess?: () => void) => {
      try {
        // For now, we just confirm the justification
        // In the future, this could save to a justifications APItoast.success('Justificativa registrada com sucesso');
        form.reset();
        onSuccess?.();
      } catch (error) {
        console.error("Justification submission error:", error);
        toast.error("Erro ao registrar justificativa");
      }
    },
    [form],
  );

  return {
    form,
    handleJustificationSubmit,
  };
}
