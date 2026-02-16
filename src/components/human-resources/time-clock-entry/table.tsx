import React, { forwardRef, useImperativeHandle } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "../../../utils";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { TimeInput } from "@/components/ui/date-time-input";
import { Checkbox } from "@/components/ui/checkbox";
import type { TimeClockEntry, SecullumTimeEntry } from "@/types/time-clock";
import { normalizeSecullumEntry } from "@/types/time-clock";
import type { TimeClockEntryBatchUpdateFormData } from "../../../schemas";
import { timeClockEntryBatchUpdateSchema } from "../../../schemas";

// Props interface for the table component
interface TimeClockTableProps {
  entries: SecullumTimeEntry[];
  isLoading?: boolean;
  className?: string;
  onFieldChange?: (entryId: string, field: string, value: any, originalValue: any) => void;
  onTimeBlur?: (entryId: string, field: string, fieldLabel: string, originalValue: string | null, currentValue: string | null) => void;
  isFieldModified?: (entryId: string, field: string) => boolean;
  isEntryModified?: (entryId: string) => boolean;
  onRowContextMenu?: (e: React.MouseEvent, entry: TimeClockEntry, field?: string) => void;
}

// Ref interface for parent components
export interface TimeClockTableRef {
  getFormData: () => TimeClockEntryBatchUpdateFormData;
  resetForm: (data?: TimeClockEntryBatchUpdateFormData) => void;
  submitForm: () => Promise<void>;
}

// Time field labels for display
const TIME_FIELD_LABELS: Record<string, string> = {
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

// Checkbox field labels
const CHECKBOX_FIELD_LABELS: Record<string, string> = {
  compensated: "Compensado",
  neutral: "Neutro",
  dayOff: "Folga",
  freeLunch: "Almoço",
};

// Get day of week abbreviation in Portuguese
const getDayOfWeek = (date: Date): string => {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return days[date.getDay()];
};

// Check if date is weekend
const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

export const TimeClockTable = forwardRef<TimeClockTableRef, TimeClockTableProps>(
  ({ entries, isLoading = false, className, onFieldChange, onTimeBlur, isFieldModified, isEntryModified, onRowContextMenu }, ref) => {
    // Normalize entries for form usage
    const normalizedEntries = React.useMemo(() => {
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return [];
      }
      return entries.map(normalizeSecullumEntry);
    }, [entries]);

    // Default form data
    const defaultFormData = React.useMemo(
      () => ({
        entries: normalizedEntries.map((entry: TimeClockEntry) => ({
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
      [normalizedEntries],
    );

    // Form setup
    const form = useForm<TimeClockEntryBatchUpdateFormData>({
      resolver: zodResolver(timeClockEntryBatchUpdateSchema),
      defaultValues: defaultFormData,
    });

    const { fields } = useFieldArray({
      control: form.control,
      name: "entries",
    });

    // Reset form when data changes
    React.useEffect(() => {
      if (normalizedEntries.length > 0) {
        form.reset(defaultFormData);
      }
    }, [form, defaultFormData, normalizedEntries.length]);

    // Handle field changes
    const handleFieldChange = React.useCallback(
      (entryId: string, field: string, value: any) => {
        // Update form
        const entryIndex = fields.findIndex((f) => f.id === entryId);
        if (entryIndex !== -1) {
          const fieldName = `entries.${entryIndex}.${field}` as any;
          form.setValue(fieldName, value, {
            shouldValidate: false,
            shouldDirty: true,
            shouldTouch: true,
          });
        }

        // Notify parent with original value for comparison
        if (onFieldChange) {
          const originalEntry = normalizedEntries.find((e) => e.id === entryId);
          const originalValue = originalEntry ? originalEntry[field as keyof TimeClockEntry] : undefined;
          onFieldChange(entryId, field, value, originalValue);
        }
      },
      [fields, form, normalizedEntries, onFieldChange],
    );

    // Handle time input blur
    const handleTimeBlur = React.useCallback(
      (entryId: string, field: string, currentValue: string | null) => {
        if (onTimeBlur) {
          const originalEntry = normalizedEntries.find((e) => e.id === entryId);
          const originalValue = originalEntry ? (originalEntry[field as keyof TimeClockEntry] as string | null) : null;
          const fieldLabel = TIME_FIELD_LABELS[field] || field;

          onTimeBlur(entryId, field, fieldLabel, originalValue, currentValue);
        }
      },
      [normalizedEntries, onTimeBlur],
    );

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        getFormData: () => form.getValues(),
        resetForm: (data?: TimeClockEntryBatchUpdateFormData) => {
          form.reset(data || defaultFormData);
        },
        submitForm: async () => {
          return form.handleSubmit(() => {})();
        },
      }),
      [form, defaultFormData],
    );

    // Loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      );
    }

    // Empty state
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

    return (
      <div className={cn("flex flex-col h-full overflow-hidden", className)}>
        <Form {...form}>
          <div className="flex-1 overflow-auto border border-neutral-400 dark:border-border rounded-md">
            <table className="w-full border-collapse">
              {/* Header */}
              <thead className="sticky top-0 z-20 bg-background">
                <tr className="border-b border-neutral-400 dark:border-border">
                  {/* Date column - sticky left */}
                  <th className="text-left p-2 font-medium text-sm sticky left-0 bg-background z-30 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border">
                    Data
                  </th>

                  {/* Time columns */}
                  {Object.entries(TIME_FIELD_LABELS).map(([field, label]) => (
                    <th key={field} className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">
                      {label}
                    </th>
                  ))}

                  {/* Checkbox columns */}
                  {Object.entries(CHECKBOX_FIELD_LABELS).map(([field, label], index, array) => (
                    <th
                      key={field}
                      className={cn(
                        "text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28",
                        index < array.length - 1 ? "border-r border-neutral-400 dark:border-border" : "border-neutral-400 dark:border-border",
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {fields.map((field, index) => {
                  const entry = normalizedEntries[index];
                  if (!entry) return null;

                  const isChanged = isEntryModified ? isEntryModified(field.id) : false;
                  const isWeekendDay = isWeekend(entry.date);

                  return (
                    <tr
                      key={field.id}
                      className={cn(
                        "border-b border-neutral-400 dark:border-border transition-colors",
                        isChanged && "bg-yellow-50 dark:bg-yellow-900/20",
                        isWeekendDay && "bg-red-50 dark:bg-red-900/10",
                        !isChanged && !isWeekendDay && index % 2 === 0 && "bg-muted/50",
                      )}
                      onContextMenu={(e) => {
                        if (onRowContextMenu) {
                          e.preventDefault();
                          onRowContextMenu(e, entry);
                        }
                      }}
                    >
                      {/* Date cell - sticky left */}
                      <td
                        className={cn(
                          "p-2 sticky left-0 bg-inherit z-10 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border",
                          isChanged && "bg-yellow-50 dark:bg-yellow-900/20",
                          isWeekendDay && "bg-red-50 dark:bg-red-900/10",
                          !isChanged && !isWeekendDay && index % 2 === 0 && "bg-muted/50",
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {formatDate(entry.date)} - {getDayOfWeek(entry.date)}
                          </span>
                          {entry.user?.name && <span className="text-xs text-muted-foreground">{entry.user.name}</span>}
                        </div>
                      </td>

                      {/* Time input cells */}
                      {Object.keys(TIME_FIELD_LABELS).map((timeField) => {
                        const isModified = isFieldModified ? isFieldModified(field.id, timeField) : false;

                        return (
                          <td
                            key={timeField}
                            className={cn("p-1 w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border", isModified && "bg-yellow-100 dark:bg-yellow-900/30")}
                            onContextMenu={(e) => {
                              if (onRowContextMenu) {
                                e.preventDefault();
                                e.stopPropagation();
                                onRowContextMenu(e, entry, timeField);
                              }
                            }}
                          >
                            <FormField
                              control={form.control}
                              name={`entries.${index}.${timeField}` as any}
                              render={({ field: formField }) => {
                                const timeValue = typeof formField.value === "string" && formField.value ? (() => {
                                  const [hours, minutes] = formField.value.split(":").map(Number);
                                  if (!isNaN(hours) && !isNaN(minutes)) {
                                    const date = new Date();
                                    date.setHours(hours, minutes, 0, 0);
                                    return date;
                                  }
                                  return null;
                                })() : null;

                                return (
                                  <FormItem>
                                    <FormControl>
                                      <div className="flex justify-center">
                                        <TimeInput
                                          value={timeValue}
                                          onChange={(value) => {
                                            const timeString = value instanceof Date
                                              ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
                                              : null;
                                            formField.onChange(timeString);
                                            handleFieldChange(field.id, timeField, timeString);
                                          }}
                                          onBlur={() => handleTimeBlur(field.id, timeField, formField.value as string | null)}
                                          className="h-8 w-14 text-center px-1"
                                        />
                                      </div>
                                    </FormControl>
                                  </FormItem>
                                );
                              }}
                            />
                          </td>
                        );
                      })}

                      {/* Checkbox cells */}
                      {Object.keys(CHECKBOX_FIELD_LABELS).map((checkboxField, cbIndex, array) => {
                        const isModified = isFieldModified ? isFieldModified(field.id, checkboxField) : false;

                        return (
                          <td
                            key={checkboxField}
                            className={cn(
                              "p-1 text-center w-28 min-w-28 max-w-28",
                              cbIndex < array.length - 1 ? "border-r border-neutral-400 dark:border-border" : "border-neutral-400 dark:border-border",
                              isModified && "bg-yellow-100 dark:bg-yellow-900/30",
                            )}
                          >
                            <FormField
                              control={form.control}
                              name={`entries.${index}.${checkboxField}` as any}
                              render={({ field: formField }) => (
                                <FormItem className="flex justify-center">
                                  <FormControl>
                                    <Checkbox
                                      checked={formField.value === true}
                                      onCheckedChange={(checked) => {
                                        const value = checked === true;
                                        formField.onChange(value);
                                        handleFieldChange(field.id, checkboxField, value);
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Form>
      </div>
    );
  },
);

TimeClockTable.displayName = "TimeClockTable";

export default TimeClockTable;
