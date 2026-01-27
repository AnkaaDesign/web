import { useMemo, useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TimeClockEntry, SecullumTimeEntry } from "@/types/time-clock";
import { normalizeSecullumEntry } from "@/types/time-clock";
import type { TimeClockEntryBatchUpdateFormData } from "../../../schemas";
import { timeClockEntryBatchUpdateSchema } from "../../../schemas";
import { useTimeClockEntryBatchUpdateWithJustification } from "../../../hooks";
import { formatDate } from "../../../utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { TransparentTimeInput } from "@/components/ui/transparent-time-input";
import { Checkbox } from "@/components/ui/checkbox";
import { TimeClockJustificationDialog } from "./time-clock-justification-dialog";
import { TimeClockEntryDetailModal } from "./time-clock-entry-detail-modal";
import { PhotoViewDialog } from "./photo-view-dialog";
import { LocationMapDialog } from "./location-map-dialog";
import { cn } from "@/lib/utils";
import {
  IconLoader2 as Loader2,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconCamera as Camera,
  IconMapPin as MapPin,
  IconTrash as Trash2,
  IconArrowUp as MoveUp,
  IconArrowDown as MoveDown,
  IconFileText as FileText,
  IconPencil as PencilIcon,
} from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { secullumService } from "../../../api-client";
import { toast } from "sonner";
import { useTimeClockStateManager } from "./state";
import type { LocationData, PendingJustification } from "./types";

interface TimeClockEntryTableProps {
  entries: SecullumTimeEntry[];
  isLoading?: boolean;
  className?: string;
  onChangedRowsChange?: (count: number) => void;
}

export interface TimeClockEntryTableRef {
  handleSubmit: () => void;
  handleRestore: () => void;
  hasChanges: boolean;
  isPending: boolean;
}

// Map normalized field names to Secullum FonteDados field names
// FonteDadosEntradaX is an object: { Tipo: 0 = electronic, 1 = manual, Origem, Motivo, Geolocalizacao }
const FONTE_DADOS_FIELD_MAP: Record<string, string> = {
  entry1: "FonteDadosEntrada1",
  exit1: "FonteDadosSaida1",
  entry2: "FonteDadosEntrada2",
  exit2: "FonteDadosSaida2",
  entry3: "FonteDadosEntrada3",
  exit3: "FonteDadosSaida3",
  entry4: "FonteDadosEntrada4",
  exit4: "FonteDadosSaida4",
  entry5: "FonteDadosEntrada5",
  exit5: "FonteDadosSaida5",
};

/**
 * Check if a time entry field was manually added (not electronic).
 * FonteDadosX.Tipo: 0 = electronic (device/app), 1 = manual (requested adjustment).
 */
function isManualEntry(rawEntry: any, fieldName: string): boolean {
  if (!rawEntry) return false;
  const fdField = FONTE_DADOS_FIELD_MAP[fieldName];
  if (!fdField) return false;
  const fd = rawEntry[fdField];
  if (!fd || typeof fd !== 'object') return false;
  return fd.Tipo === 1;
}

const TimeClockEntryTableComponent = (props: TimeClockEntryTableProps, ref: React.Ref<TimeClockEntryTableRef>) => {
  const { entries, isLoading, className, onChangedRowsChange } = props;
  const [pendingJustification, setPendingJustification] = useState<PendingJustification | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimeClockEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: TimeClockEntry; field?: string } | null>(null);
  const [photoDialog, setPhotoDialog] = useState<{ userId: number; fonteDadosId: number } | null>(null);
  const [locationDialog, setLocationDialog] = useState<LocationData | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { isPending } = useTimeClockEntryBatchUpdateWithJustification();

  // Keep original entries for comparison
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

  // Use original entries for display and form
  const normalizedEntries = originalNormalizedEntries;

  // Initialize state manager
  const stateManager = useTimeClockStateManager(onChangedRowsChange);

  const defaultFormData = useMemo(() => {
    const formData = {
      entries: normalizedEntries.map((entry) => ({
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
    };

    // Debug log to see data format
    if (formData.entries.length > 0) {
      console.log("Sample entry data:", formData.entries[0]);
    }

    return formData;
  }, [normalizedEntries]);

  const form = useForm<TimeClockEntryBatchUpdateFormData>({
    resolver: zodResolver(timeClockEntryBatchUpdateSchema),
    defaultValues: defaultFormData,
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "entries",
  });

  // Only reset form initially when data first arrives, not on every change
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
  }, [defaultFormData, form]); // Depend on form and defaultFormData

  // Handle field change
  const handleFieldChange = useCallback(
    (formFieldId: string, field: string, value: any) => {
      // Update form
      const entryIndex = fields.findIndex((f) => f.id === formFieldId);

      if (entryIndex === -1) {
        console.error("Entry not found in fields array");
        return;
      }

      // Get the actual entry ID
      const actualEntry = normalizedEntries[entryIndex];
      if (!actualEntry) {
        console.error("Actual entry not found at index:", entryIndex);
        return;
      }

      const actualEntryId = actualEntry.id;

      // Update form value
      const fieldName = `entries.${entryIndex}.${field}` as any;
      form.setValue(fieldName, value, {
        shouldValidate: false,
        shouldDirty: true,
        shouldTouch: true,
      });

      // Track the change using state manager - use original entries for comparison
      const originalEntry = originalNormalizedEntries.find((e) => e.id === actualEntryId);
      if (originalEntry) {
        const originalValue = originalEntry[field as keyof typeof originalEntry];
        stateManager.actions.updateField(actualEntryId, field, value, originalValue);
      }
    },
    [fields, form, normalizedEntries, originalNormalizedEntries, stateManager.actions],
  );

  // Handle time shift with arrows - move to next/previous available column
  const handleTimeShift = useCallback(
    (formFieldId: string, field: string, direction: "left" | "right") => {
      // Use FIELDS array for correct indexing
      const currentEntryIndex = fields.findIndex((f) => f.id === formFieldId);
      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
      const currentFieldIndex = timeFields.indexOf(field);

      if (currentFieldIndex === -1 || currentEntryIndex === -1) {
        return;
      }

      // Get the actual entry from the normalized entries using the index
      const actualEntry = normalizedEntries[currentEntryIndex];
      if (!actualEntry) {
        return;
      }

      const actualEntryId = actualEntry.id;
      const currentValue = form.getValues(`entries.${currentEntryIndex}.${field}` as any);

      if (!currentValue) {
        return;
      }

      // Find the next field to move to (empty or filled)
      let targetFieldIndex = currentFieldIndex;

      if (direction === "right") {
        // Move to next field (skip if it's the same field)
        if (currentFieldIndex + 1 < timeFields.length) {
          targetFieldIndex = currentFieldIndex + 1;
        }
      } else {
        // Move to previous field (skip if it's the same field)
        if (currentFieldIndex - 1 >= 0) {
          targetFieldIndex = currentFieldIndex - 1;
        }
      }

      // If found a different field, move or swap the time
      if (targetFieldIndex !== currentFieldIndex) {
        const targetField = timeFields[targetFieldIndex];
        const originalEntry = originalNormalizedEntries.find((e) => e.id === actualEntryId);
        const targetValue = form.getValues(`entries.${currentEntryIndex}.${targetField}` as any);

        if (!originalEntry) {
          console.error("Original entry not found for ID:", actualEntryId);
          return;
        }

        // Get the original values for both fields
        const originalFieldValue = originalEntry[field as keyof typeof originalEntry];
        const originalTargetValue = originalEntry[targetField as keyof typeof originalEntry];

        if (targetValue) {
          // SWAP: Target field has value, so swap them
          // Update form values first
          form.setValue(`entries.${currentEntryIndex}.${field}` as any, targetValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex}.${targetField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager with actual entry ID and original values
          stateManager.actions.updateField(actualEntryId, field, targetValue, originalFieldValue);
          stateManager.actions.updateField(actualEntryId, targetField, currentValue, originalTargetValue);

          toast.success(`Trocado com ${targetField.replace("entry", "Entrada ").replace("exit", "Saída ")}`);
        } else {
          // MOVE: Target field is empty, so move there
          // Update form values first
          form.setValue(`entries.${currentEntryIndex}.${field}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex}.${targetField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager with actual entry ID and original values
          stateManager.actions.updateField(actualEntryId, field, null, originalFieldValue);
          stateManager.actions.updateField(actualEntryId, targetField, currentValue, originalTargetValue);

          toast.success(`Movido para ${targetField.replace("entry", "Entrada ").replace("exit", "Saída ")}`);
        }
      } else {
        toast.warning("Nenhuma coluna disponível");
      }
    },
    [fields, form, normalizedEntries, originalNormalizedEntries, stateManager.actions],
  );

  // Handle time change - just update value, justification will be on blur
  const handleTimeChange = useCallback(
    (formFieldId: string, field: string, value: string | null) => {
      handleFieldChange(formFieldId, field, value);
    },
    [handleFieldChange],
  );

  // Handle time blur - show justification if value changed
  const handleTimeBlur = useCallback(
    (formFieldId: string, field: string, fieldLabel: string, originalValue: string | null, currentValue: string | null) => {
      // Get the actual entry ID for the justification dialog
      const entryIndex = fields.findIndex((f) => f.id === formFieldId);
      if (entryIndex === -1) return;

      const actualEntry = normalizedEntries[entryIndex];
      if (!actualEntry) return;

      const actualEntryId = actualEntry.id;

      // If changing from a value to another value (not clearing), request justification
      if (originalValue && currentValue && originalValue !== currentValue) {
        setPendingJustification({
          entryId: actualEntryId, // Store the actual entry ID
          field,
          originalTime: originalValue,
          newTime: currentValue,
          fieldLabel,
        });
      }
    },
    [fields, normalizedEntries],
  );

  const handleJustificationConfirm = useCallback(() => {
    if (pendingJustification) {
      // pendingJustification.entryId is the actual entry ID, need to find the form field ID
      const entryIndex = normalizedEntries.findIndex((e) => e.id === pendingJustification.entryId);
      if (entryIndex !== -1) {
        const formFieldId = fields[entryIndex]?.id;
        if (formFieldId) {
          handleFieldChange(formFieldId, pendingJustification.field, pendingJustification.newTime);
        }
      }
    }
    setPendingJustification(null);
  }, [handleFieldChange, pendingJustification, normalizedEntries, fields]);

  const handleSubmit = useCallback(
    async (data: TimeClockEntryBatchUpdateFormData) => {
      // Filter only changed entries
      const changedCount = stateManager.actions.getChangedEntryCount();
      const modifications = stateManager.actions.getAllModifications();

      if (changedCount > 0) {
        try {
          // Build changed entries from modifications
          const changedEntriesMap = new Map<string, any>();

          modifications.forEach((mod) => {
            if (!changedEntriesMap.has(mod.entryId)) {
              // Get the original entry data from the raw entries
              const originalEntry = entries.find((e: any) => e.Id === parseInt(mod.entryId));
              const formEntry = data.entries.find((e) => e.id === mod.entryId);

              if (originalEntry && formEntry) {
                // Merge the original Secullum data with the changed form fields
                const mergedEntry = {
                  // Preserve all original Secullum fields
                  ...originalEntry,
                  // Override with form data
                  Id: parseInt(formEntry.id),
                  Entrada1: formEntry.entry1,
                  Saida1: formEntry.exit1,
                  Entrada2: formEntry.entry2,
                  Saida2: formEntry.exit2,
                  Entrada3: formEntry.entry3,
                  Saida3: formEntry.exit3,
                  Entrada4: formEntry.entry4,
                  Saida4: formEntry.exit4,
                  Entrada5: formEntry.entry5,
                  Saida5: formEntry.exit5,
                  Compensado: formEntry.compensated,
                  Neutro: formEntry.neutral,
                  Folga: formEntry.dayOff,
                  AlmocoLivre: formEntry.freeLunch,
                  // Also update backup fields
                  BackupEntrada1: formEntry.entry1,
                  BackupSaida1: formEntry.exit1,
                  BackupEntrada2: formEntry.entry2,
                  BackupSaida2: formEntry.exit2,
                  BackupEntrada3: formEntry.entry3,
                  BackupSaida3: formEntry.exit3,
                  BackupEntrada4: formEntry.entry4,
                  BackupSaida4: formEntry.exit4,
                  BackupEntrada5: formEntry.entry5,
                  BackupSaida5: formEntry.exit5,
                };

                changedEntriesMap.set(mod.entryId, mergedEntry);
              }
            }
          });

          const changedEntries = Array.from(changedEntriesMap.values());

          // Call Secullum API batch update endpoint
          const response = await secullumService.batchUpdateTimeEntries(changedEntries);

          if (response.data?.success) {
            toast.success(response.data.message || `${changedEntries.length} registros salvos com sucesso`);

            // Clear all state after successful save
            stateManager.actions.restoreAll();
            form.reset(defaultFormData);
          } else {
            toast.error(response.data?.message || "Erro ao salvar alterações");
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || "Erro ao salvar alterações";
          toast.error(errorMessage);
          console.error("Save error:", error);
        }
      }
    },
    [stateManager.actions, form, defaultFormData, entries],
  );

  const handleRestore = useCallback(() => {
    stateManager.actions.restoreAll();
    form.reset(defaultFormData);
    toast.info("Alterações restauradas");
  }, [stateManager.actions, form, defaultFormData]);

  // Context menu actions
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: TimeClockEntry, field?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry, field });
  }, []);

  const handleMoveToPreviousDay = useCallback(
    (entry: TimeClockEntry, specificField?: string) => {
      const currentEntryIndex = originalNormalizedEntries.findIndex((e) => e.id === entry.id);

      if (currentEntryIndex <= 0) {
        toast.warning("Já está no primeiro dia");
        setContextMenu(null);
        return;
      }

      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
      const previousEntryId = originalNormalizedEntries[currentEntryIndex - 1].id;

      if (specificField) {
        const currentValue = form.getValues(`entries.${currentEntryIndex}.${specificField}` as any);

        if (!currentValue) {
          toast.warning("Campo vazio, nada para mover");
          setContextMenu(null);
          return;
        }

        // Find first available slot in previous day
        let moved = false;

        // Try same column first
        const previousValue = form.getValues(`entries.${currentEntryIndex - 1}.${specificField}` as any);
        const originalCurrentEntry = originalNormalizedEntries[currentEntryIndex];
        const originalPreviousEntry = originalNormalizedEntries[currentEntryIndex - 1];

        if (!previousValue) {
          // Update form
          form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex - 1}.${specificField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager
          stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
          stateManager.actions.updateField(previousEntryId, specificField, currentValue, originalPreviousEntry[specificField as keyof typeof originalPreviousEntry]);

          moved = true;
          toast.success("Movido para o dia anterior");
        } else {
          // Find any available slot
          for (const field of timeFields) {
            const value = form.getValues(`entries.${currentEntryIndex - 1}.${field}` as any);
            if (!value) {
              // Update form
              form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
              form.setValue(`entries.${currentEntryIndex - 1}.${field}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

              // Update state manager
              stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
              stateManager.actions.updateField(previousEntryId, field, currentValue, originalPreviousEntry[field as keyof typeof originalPreviousEntry]);

              moved = true;
              toast.success(`Movido para ${field.replace("entry", "Entrada ").replace("exit", "Saída ")} do dia anterior`);
              break;
            }
          }
        }

        if (!moved) {
          toast.warning("Dia anterior não tem campos disponíveis");
        }
      }

      setContextMenu(null);
    },
    [originalNormalizedEntries, form, stateManager.actions],
  );

  const handleMoveToNextDay = useCallback(
    (entry: TimeClockEntry, specificField?: string) => {
      const currentEntryIndex = originalNormalizedEntries.findIndex((e) => e.id === entry.id);

      if (currentEntryIndex >= originalNormalizedEntries.length - 1) {
        toast.warning("Já está no último dia");
        setContextMenu(null);
        return;
      }

      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
      const nextEntryId = originalNormalizedEntries[currentEntryIndex + 1].id;

      if (specificField) {
        const currentValue = form.getValues(`entries.${currentEntryIndex}.${specificField}` as any);

        if (!currentValue) {
          toast.warning("Campo vazio, nada para mover");
          setContextMenu(null);
          return;
        }

        // Find first available slot in next day
        let moved = false;

        // Try same column first
        const nextValue = form.getValues(`entries.${currentEntryIndex + 1}.${specificField}` as any);
        const originalCurrentEntry = originalNormalizedEntries[currentEntryIndex];
        const originalNextEntry = originalNormalizedEntries[currentEntryIndex + 1];

        if (!nextValue) {
          // Update form
          form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex + 1}.${specificField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager
          stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
          stateManager.actions.updateField(nextEntryId, specificField, currentValue, originalNextEntry[specificField as keyof typeof originalNextEntry]);

          moved = true;
          toast.success("Movido para o próximo dia");
        } else {
          // Find any available slot
          for (const field of timeFields) {
            const value = form.getValues(`entries.${currentEntryIndex + 1}.${field}` as any);
            if (!value) {
              // Update form
              form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
              form.setValue(`entries.${currentEntryIndex + 1}.${field}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

              // Update state manager
              stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
              stateManager.actions.updateField(nextEntryId, field, currentValue, originalNextEntry[field as keyof typeof originalNextEntry]);

              moved = true;
              toast.success(`Movido para ${field.replace("entry", "Entrada ").replace("exit", "Saída ")} do próximo dia`);
              break;
            }
          }
        }

        if (!moved) {
          toast.warning("Próximo dia não tem campos disponíveis");
        }
      }

      setContextMenu(null);
    },
    [originalNormalizedEntries, form, stateManager.actions],
  );

  const handleReleaseJustification = useCallback(() => {
    toast.info("Liberar justificativa");
    setContextMenu(null);
  }, []);

  const handleDeleteEntry = useCallback(() => {
    toast.info("Excluir registro");
    setContextMenu(null);
  }, []);

  const handleViewLocation = useCallback((entry: TimeClockEntry) => {
    const locationData: LocationData = {
      FonteDadosId: parseInt(entry.id),
      DataHora: entry.date.toISOString(),
      Latitude: entry.latitude || -23.5505,
      Longitude: entry.longitude || -46.6333,
      Precisao: entry.accuracy || 10,
      Endereco: entry.address || "São Paulo, Brasil",
      PossuiFoto: entry.hasPhoto,
    };
    setLocationDialog(locationData);
    setContextMenu(null);
  }, []);

  const handleViewPhoto = useCallback((entry: TimeClockEntry) => {
    if (entry.hasPhoto) {
      setPhotoDialog({
        userId: parseInt(entry.userId || "0"),
        fonteDadosId: parseInt(entry.secullumRecordId || entry.id),
      });
    }
    setContextMenu(null);
  }, []);

  const getDayOfWeek = (date: Date): string => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return days[new Date(date).getDay()];
  };

  // Check if a field is modified
  const isFieldModified = useCallback(
    (formFieldId: string, field: string): boolean => {
      // Convert form field ID to actual entry ID
      const entryIndex = fields.findIndex((f) => f.id === formFieldId);
      if (entryIndex === -1) return false;

      const actualEntry = normalizedEntries[entryIndex];
      if (!actualEntry) return false;

      const actualEntryId = actualEntry.id;
      const result = stateManager.actions.isFieldModified(actualEntryId, field);
      return result;
    },
    [fields, normalizedEntries, stateManager.actions],
  );

  // Expose methods to parent component
  useImperativeHandle(
    ref,
    () => ({
      handleSubmit: () => form.handleSubmit(handleSubmit)(),
      handleRestore: () => handleRestore(),
      hasChanges: stateManager.actions.getChangedEntryCount() > 0,
      isPending,
    }),
    [form, handleSubmit, handleRestore, stateManager.actions, isPending],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (normalizedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <div className="text-center">
          <div className="text-lg font-medium">Nenhum registro encontrado</div>
          <div className="text-sm">Tente ajustar os filtros ou selecionar um período diferente</div>
        </div>
      </div>
    );
  }

  // Debug overall state at render
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)} ref={tableRef}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto border border-neutral-400 dark:border-border/40 rounded-md">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-background">
                <tr className="border-b border-neutral-400 dark:border-border/40">
                  <th className="text-left p-2 font-medium text-sm sticky left-0 bg-background z-30 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border/40">
                    Data
                  </th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Entrada 1</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Saída 1</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Entrada 2</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Saída 2</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Entrada 3</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Saída 3</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Entrada 4</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Saída 4</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Entrada 5</th>
                  <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40">Saída 5</th>
                  <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40">Compensado</th>
                  <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40">Neutro</th>
                  <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40">Folga</th>
                  <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-neutral-400 dark:border-border/40">Almoço</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const entry = normalizedEntries[index];
                  if (!entry) {
                    return null;
                  }
                  const isWeekend = new Date(entry.date).getDay() === 0 || new Date(entry.date).getDay() === 6;

                  return (
                    <tr
                      key={field.id}
                      className={cn(
                        "border-b border-neutral-400 dark:border-border/40 transition-colors",
                        isWeekend && "bg-red-50 dark:bg-red-900/10",
                        !isWeekend && index % 2 === 0 && "bg-muted/50",
                      )}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // Don't open context menu on the whole row
                      }}
                    >
                      <td
                        className="p-2 sticky left-0 bg-background z-10 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border/40"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleContextMenu(e, entry); // No specific field - moves all
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {formatDate(entry.date)} - {getDayOfWeek(entry.date)}
                          </span>
                          <span className="text-xs text-muted-foreground">{entry.user?.name}</span>
                        </div>
                      </td>

                      {/* Time inputs */}
                      {["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"].map((timeField) => {
                        const isModified = isFieldModified(field.id, timeField);
                        const currentValue = form.getValues(`entries.${index}.${timeField}` as any);
                        const originalEntry = originalNormalizedEntries.find((e) => e.id === field.id);
                        const originalValue = originalEntry?.[timeField as keyof typeof originalEntry];
                        const rawEntry = entries.find((e: any) => String(e.Id) === field.id || String(e.id) === field.id);
                        const isManual = isManualEntry(rawEntry, timeField);
                        return (
                          <td
                            key={timeField}
                            className={cn("p-1 w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border/40", isModified && "bg-yellow-100 dark:bg-yellow-900/30")}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Only show context menu if cell has a value
                              const cellValue = form.getValues(`entries.${index}.${timeField}` as any);
                              if (cellValue) {
                                handleContextMenu(e, entry, timeField);
                              }
                            }}
                          >
                            <FormField
                              control={form.control}
                              name={`entries.${index}.${timeField}` as any}
                              render={({ field: formField }) => (
                                <FormItem>
                                  <FormControl>
                                    <div className="flex items-center gap-0.5 justify-center min-w-[100px]">
                                      <div className="w-6 flex justify-center">
                                        {formField.value && (
                                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => handleTimeShift(field.id, timeField, "left")}>
                                            <ChevronLeft className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <TransparentTimeInput
                                        value={formField.value as string | null}
                                        onChange={(value) => {
                                          formField.onChange(value);
                                          handleTimeChange(field.id, timeField, value);
                                        }}
                                        onBlur={() =>
                                          handleTimeBlur(
                                            field.id,
                                            timeField,
                                            timeField.replace("entry", "Entrada ").replace("exit", "Saída "),
                                            entry[timeField as keyof TimeClockEntry] as string | null,
                                            formField.value as string | null,
                                          )
                                        }
                                        className="h-8 w-14 text-center px-1 flex-shrink-0"
                                      />
                                      <div className="w-6 flex justify-center">
                                        {formField.value && (
                                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => handleTimeShift(field.id, timeField, "right")}>
                                            <ChevronRight className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      {isManual && formField.value && (
                                        <PencilIcon className="h-3 w-3 text-amber-500 flex-shrink-0" title="Entrada manual" />
                                      )}
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </td>
                        );
                      })}

                      {/* Checkboxes */}
                      <td
                        className={cn(
                          "p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40",
                          isFieldModified(field.id, "compensated") && "bg-yellow-100 dark:bg-yellow-900/30",
                        )}
                      >
                        <FormField
                          control={form.control}
                          name={`entries.${index}.compensated`}
                          render={({ field: formField }) => (
                            <FormItem className="flex justify-center">
                              <FormControl>
                                <Checkbox
                                  checked={formField.value}
                                  onCheckedChange={(checked) => {
                                    formField.onChange(checked);
                                    handleFieldChange(field.id, "compensated", checked);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </td>

                      <td
                        className={cn(
                          "p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40",
                          isFieldModified(field.id, "neutral") && "bg-yellow-100 dark:bg-yellow-900/30",
                        )}
                      >
                        <FormField
                          control={form.control}
                          name={`entries.${index}.neutral`}
                          render={({ field: formField }) => (
                            <FormItem className="flex justify-center">
                              <FormControl>
                                <Checkbox
                                  checked={formField.value}
                                  onCheckedChange={(checked) => {
                                    formField.onChange(checked);
                                    handleFieldChange(field.id, "neutral", checked);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </td>

                      <td
                        className={cn(
                          "p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border/40",
                          isFieldModified(field.id, "dayOff") && "bg-yellow-100 dark:bg-yellow-900/30",
                        )}
                      >
                        <FormField
                          control={form.control}
                          name={`entries.${index}.dayOff`}
                          render={({ field: formField }) => (
                            <FormItem className="flex justify-center">
                              <FormControl>
                                <Checkbox
                                  checked={formField.value}
                                  onCheckedChange={(checked) => {
                                    formField.onChange(checked);
                                    handleFieldChange(field.id, "dayOff", checked);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </td>

                      <td
                        className={cn(
                          "p-1 text-center w-28 min-w-28 max-w-28 border-neutral-400 dark:border-border/40",
                          isFieldModified(field.id, "freeLunch") && "bg-yellow-100 dark:bg-yellow-900/30",
                        )}
                      >
                        <FormField
                          control={form.control}
                          name={`entries.${index}.freeLunch`}
                          render={({ field: formField }) => (
                            <FormItem className="flex justify-center">
                              <FormControl>
                                <Checkbox
                                  checked={formField.value}
                                  onCheckedChange={(checked) => {
                                    formField.onChange(checked);
                                    handleFieldChange(field.id, "freeLunch", checked);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      </Form>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <DropdownMenu open={!!contextMenu} onOpenChange={() => setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <div className="opacity-0 pointer-events-none w-1 h-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="min-w-56">
              <DropdownMenuItem onClick={handleReleaseJustification}>
                <FileText className="h-4 w-4 mr-2" />
                Liberar justificativa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteEntry}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMoveToPreviousDay(contextMenu.entry, contextMenu.field)}>
                <MoveUp className="h-4 w-4 mr-2" />
                Mover para dia anterior
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMoveToNextDay(contextMenu.entry, contextMenu.field)}>
                <MoveDown className="h-4 w-4 mr-2" />
                Mover para próximo dia
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewLocation(contextMenu.entry)}>
                <MapPin className="h-4 w-4 mr-2" />
                Ver localização no mapa
              </DropdownMenuItem>
              {contextMenu.entry.hasPhoto && (
                <DropdownMenuItem onClick={() => handleViewPhoto(contextMenu.entry)}>
                  <Camera className="h-4 w-4 mr-2" />
                  Ver foto
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <TimeClockJustificationDialog
        open={!!pendingJustification}
        onOpenChange={(open) => !open && setPendingJustification(null)}
        onConfirm={handleJustificationConfirm}
        originalTime={pendingJustification?.originalTime || ""}
        newTime={pendingJustification?.newTime || null}
        field={pendingJustification?.field || ""}
        fieldLabel={pendingJustification?.fieldLabel || ""}
        isLoading={isPending}
      />

      <TimeClockEntryDetailModal open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)} entry={selectedEntry} />

      {photoDialog && <PhotoViewDialog isOpen={!!photoDialog} onClose={() => setPhotoDialog(null)} userId={photoDialog.userId} fonteDadosId={photoDialog.fonteDadosId} />}

      {locationDialog && <LocationMapDialog isOpen={!!locationDialog} onClose={() => setLocationDialog(null)} location={locationDialog} />}
    </div>
  );
};

export const TimeClockEntryTable = forwardRef(TimeClockEntryTableComponent);

TimeClockEntryTable.displayName = "TimeClockEntryTable";
