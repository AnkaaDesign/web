import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useController } from "react-hook-form";
import { IconPlus, IconTrash, IconPhoto } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FileSuggestions } from "@/components/common/file";
import type { FileWithPreview } from "@/components/common/file";
import { LayoutFileUploadField } from "./layout-file-upload-field";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_PAYMENT_STATUS_LABELS } from "../../../../constants";
import { PainterSelector } from "@/components/production/airbrushing/form/painter-selector";

interface MultiAirbrushingSelectorProps {
  control: any;
  disabled?: boolean;
  isEditMode?: boolean;
  onAirbrushingsCountChange?: (count: number) => void;
  // Customer of the task — scopes the airbrushing-layout recommendations to files that
  // were previously used as AIRBRUSHING layouts for this customer (separate from task layouts).
  customerId?: string;
}

interface AirbrushingItem {
  id: string;
  status: string;
  paymentStatus: string;
  price: number | null;
  startDate: Date | null;
  finishDate: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  painterId: string | null;
  painter?: { id: string; name: string; email?: string | null; status?: string | null } | null;
  // receiptFiles / invoiceFiles are NOT rendered here anymore (the airbrushing section is
  // layout-only per product), but they remain in the model so the edit-form reconciliation
  // preserves any existing receipts/invoices instead of dropping them on save.
  receiptFiles: FileWithPreview[];
  invoiceFiles: FileWithPreview[];
  layouts: FileWithPreview[];
  receiptIds?: string[];
  invoiceIds?: string[];
  layoutIds?: string[];
  uploading?: boolean;
  error?: string;
}

export interface MultiAirbrushingSelectorRef {
  addAirbrushing: () => void;
  clearAll: () => void;
}

// Helper to convert File objects (API relation rows) to FileWithPreview.
const convertFilesToFileWithPreview = (files: any[]): FileWithPreview[] => {
  return (files || []).map(file => {
    const mockFile = new File([], file.filename || file.name || '', { type: file.mimetype || file.type || '' });
    return Object.assign(mockFile, {
      id: file.id,
      name: file.filename || file.name,
      size: file.size,
      type: file.mimetype || file.type,
      preview: file.url || '',
      uploaded: true,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl || undefined,
    }) as FileWithPreview;
  });
};

// Rehydrate a layouts array from form state. Already-hydrated FileWithPreview / new File
// instances are kept as-is; raw API rows are converted. Avoids the old double-spread that
// duplicated every existing layout and re-marked new files as uploaded.
const mapLayouts = (arr: any[]): FileWithPreview[] =>
  (arr || []).map((f: any) => {
    if (f instanceof File) return f as FileWithPreview;
    if (f && (f.uploaded || f.uploadedFileId)) return f as FileWithPreview;
    return convertFilesToFileWithPreview([f])[0];
  });

const mapFieldValueToItem = (airbrushing: any, index: number): AirbrushingItem => ({
  id: airbrushing.id || `airbrushing-${Date.now()}-${index}`,
  status: airbrushing.status || AIRBRUSHING_STATUS.PENDING,
  paymentStatus: airbrushing.paymentStatus || AIRBRUSHING_PAYMENT_STATUS.PENDING,
  price: airbrushing.price || null,
  startDate: airbrushing.startDate || null,
  finishDate: airbrushing.finishDate || null,
  startedAt: airbrushing.startedAt || null,
  finishedAt: airbrushing.finishedAt || null,
  painterId: airbrushing.painterId || null,
  painter: airbrushing.painter || null,
  receiptFiles: [
    ...convertFilesToFileWithPreview(airbrushing.receipts || []),
    ...(airbrushing.receiptFiles || []),
  ],
  invoiceFiles: [
    ...convertFilesToFileWithPreview(airbrushing.invoices || []),
    ...(airbrushing.invoiceFiles || []),
  ],
  layouts: mapLayouts(airbrushing.layouts || []),
  receiptIds: airbrushing.receiptIds || [],
  invoiceIds: airbrushing.invoiceIds || [],
  layoutIds: airbrushing.layoutIds || [],
});

export const MultiAirbrushingSelector = forwardRef<MultiAirbrushingSelectorRef, MultiAirbrushingSelectorProps>(
  ({ control, disabled, isEditMode = false, onAirbrushingsCountChange, customerId }, ref) => {
    // Use controller to properly manage form field
    const { field } = useController({
      name: "airbrushings" as any,
      control,
    });

    // Initialize airbrushings from form field value
    // Defaults are now set in mapDataToForm, so field.value should always have data
    const [airbrushings, setAirbrushings] = useState<AirbrushingItem[]>(() => {
      const data = field.value && Array.isArray(field.value) ? field.value : [];
      return data.map((a: any, index: number) => mapFieldValueToItem(a, index));
    });

    // Track if initial sync has been done to prevent marking form dirty on mount
    const hasInitialSynced = useRef(false);

    // Track if we're syncing to prevent infinite loops
    const isSyncingToForm = useRef<boolean>(false);
    const lastFieldValueRef = useRef<string>("");

    // Sync FROM form field TO local state when form resets (form → local)
    useEffect(() => {
      // Skip if we're currently syncing to form
      if (isSyncingToForm.current) {
        return;
      }

      const fieldValueStr = JSON.stringify(field.value);

      // Skip if value hasn't changed
      if (fieldValueStr === lastFieldValueRef.current) {
        return;
      }

      lastFieldValueRef.current = fieldValueStr;

      // Always map from field.value - mapDataToForm now provides defaults
      if (field.value && Array.isArray(field.value) && field.value.length > 0) {
        setAirbrushings(field.value.map((a: any, index: number) => mapFieldValueToItem(a, index)));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.value]);

    // Sync FROM local state TO form field when airbrushings change (local → form)
    useEffect(() => {
      // Skip initial sync to avoid marking form dirty on mount
      // The form already has the correct initial value from mapDataToForm
      if (!hasInitialSynced.current) {
        hasInitialSynced.current = true;
        // Still notify parent about count on initial render
        if (onAirbrushingsCountChange) {
          onAirbrushingsCountChange(airbrushings.length);
        }
        return;
      }

      // Mark that we're syncing
      isSyncingToForm.current = true;

      const formValue = airbrushings.map((airbrushing) => {
        return {
          id: airbrushing.id, // Preserve ID for sync back
          status: airbrushing.status,
          paymentStatus: airbrushing.paymentStatus,
          price: airbrushing.price,
          startDate: airbrushing.startDate,
          finishDate: airbrushing.finishDate,
          startedAt: airbrushing.startedAt,
          finishedAt: airbrushing.finishedAt,
          painterId: airbrushing.painterId,
          painter: airbrushing.painter,
          receiptIds: airbrushing.receiptIds || [],
          invoiceIds: airbrushing.invoiceIds || [],
          layoutIds: airbrushing.layoutIds || [],
          // Include the actual files for submission with the form
          receiptFiles: airbrushing.receiptFiles,
          invoiceFiles: airbrushing.invoiceFiles,
          layouts: airbrushing.layouts,
        };
      });
      field.onChange(formValue);

      // Notify parent about count change
      if (onAirbrushingsCountChange) {
        onAirbrushingsCountChange(airbrushings.length);
      }

      // Clear sync flag after next tick
      setTimeout(() => {
        isSyncingToForm.current = false;
      }, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [airbrushings]); // Only depend on airbrushings state

    const addAirbrushing = useCallback(() => {
      const newAirbrushing: AirbrushingItem = {
        id: `airbrushing-${Date.now()}`,
        status: AIRBRUSHING_STATUS.PENDING,
        paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
        price: null,
        startDate: null,
        finishDate: null,
        startedAt: null,
        finishedAt: null,
        painterId: null,
        painter: null,
        receiptFiles: [],
        invoiceFiles: [],
        layouts: [],
        receiptIds: [],
        invoiceIds: [],
        layoutIds: [],
      };
      setAirbrushings((prev) => [...prev, newAirbrushing]);
    }, []);

    const removeAirbrushing = useCallback((id: string) => {
      setAirbrushings((prev) => prev.filter((airbrushing) => airbrushing.id !== id));
    }, []);

    // Clear all airbrushings
    const clearAll = useCallback(() => {
      setAirbrushings([]);
    }, []);

    const updateAirbrushing = useCallback((id: string, updates: Partial<AirbrushingItem>) => {
      setAirbrushings((prev) => {
        const updated = prev.map((airbrushing) => {
          if (airbrushing.id === id) {
            const merged = { ...airbrushing, ...updates };
            return merged;
          }
          return airbrushing;
        });
        return updated;
      });
    }, []);

    const handleLayoutsChange = useCallback(
      (airbrushingId: string, files: FileWithPreview[]) => {
        // Store files without uploading - they ride along as multipart on submit.
        updateAirbrushing(airbrushingId, {
          layouts: files,
          layoutIds: files.filter((f) => f.uploaded).map((f) => (f as any).uploadedFileId!).filter(Boolean),
        });
      },
      [updateAirbrushing],
    );

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        addAirbrushing,
        clearAll,
      }),
      [addAirbrushing, clearAll],
    );

    return (
      <div className="space-y-4">
        {/* Airbrushings List */}
        <div className="space-y-3">
          {airbrushings.map((airbrushing) => (
              <div key={airbrushing.id} className="border border-border rounded-lg p-4 space-y-4">
                {/* Status row (only in edit mode): Status | Payment Status (gated) + Trash */}
                {isEditMode && (
                  <div className="flex gap-4 items-start">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      <div className="space-y-2">
                        <FormLabel>Status</FormLabel>
                        <Combobox
                          value={airbrushing.status}
                          onValueChange={(value) => {
                            const newStatus = (value as string) || '';
                            // Payment status is only meaningful for completed airbrushings:
                            // reset it to PENDING whenever the status leaves COMPLETED
                            updateAirbrushing(airbrushing.id, {
                              status: newStatus,
                              ...(newStatus !== AIRBRUSHING_STATUS.COMPLETED ? { paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING } : {}),
                            });
                          }}
                          disabled={disabled}
                          options={Object.values(AIRBRUSHING_STATUS).map((status) => ({
                            value: status,
                            label: AIRBRUSHING_STATUS_LABELS[status],
                          }))}
                          placeholder="Status"
                          searchable={false}
                        />
                      </div>
                      <div className="space-y-2">
                        <FormLabel>Status do Pagamento</FormLabel>
                        <Combobox
                          value={airbrushing.paymentStatus}
                          onValueChange={(value) => updateAirbrushing(airbrushing.id, { paymentStatus: (value as string) || AIRBRUSHING_PAYMENT_STATUS.PENDING })}
                          disabled={disabled || airbrushing.status !== AIRBRUSHING_STATUS.COMPLETED}
                          options={Object.values(AIRBRUSHING_PAYMENT_STATUS).map((paymentStatus) => ({
                            value: paymentStatus,
                            label: AIRBRUSHING_PAYMENT_STATUS_LABELS[paymentStatus],
                          }))}
                          placeholder="Status do pagamento"
                          searchable={false}
                        />
                        {airbrushing.status !== AIRBRUSHING_STATUS.COMPLETED && (
                          <p className="text-xs text-muted-foreground">Disponível somente após a conclusão da aerografia</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeAirbrushing(airbrushing.id)}
                      disabled={disabled}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 flex-shrink-0 mt-7"
                    >
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}

                {/* Row 1: Painter | Price (+ Trash in create mode) */}
                <div className="flex gap-2 items-end">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                    <div className="space-y-2">
                      <FormLabel>Pintor</FormLabel>
                      <PainterSelector
                        value={airbrushing.painterId ?? undefined}
                        onChange={(userId) => updateAirbrushing(airbrushing.id, { painterId: userId })}
                        initialUser={airbrushing.painter ?? undefined}
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <FormLabel>Preço</FormLabel>
                      <Input
                        type="currency"
                        value={airbrushing.price ?? undefined}
                        onChange={(value) => {
                          updateAirbrushing(airbrushing.id, {
                            price: typeof value === 'number' ? value : null,
                          });
                        }}
                        disabled={disabled}
                        placeholder="R$ 0,00"
                        className="bg-transparent"
                      />
                    </div>
                  </div>
                  {!isEditMode && (
                    <Button
                      type="button"
                      onClick={() => removeAirbrushing(airbrushing.id)}
                      disabled={disabled}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 flex-shrink-0"
                    >
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {/* Row 2: Expected dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Início Previsto</FormLabel>
                    <DateTimeInput
                      field={{
                        value: airbrushing.startDate,
                        onChange: (date) => updateAirbrushing(airbrushing.id, { startDate: date as Date | null }),
                        onBlur: () => {},
                        name: `airbrushings.${airbrushing.id}.startDate`,
                      }}
                      mode="date"
                      context="start"
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Término Previsto</FormLabel>
                    <DateTimeInput
                      field={{
                        value: airbrushing.finishDate,
                        onChange: (date) => updateAirbrushing(airbrushing.id, { finishDate: date as Date | null }),
                        onBlur: () => {},
                        name: `airbrushings.${airbrushing.id}.finishDate`,
                      }}
                      mode="date"
                      context="end"
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Row 3: Actual dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Iniciado em</FormLabel>
                    <DateTimeInput
                      field={{
                        value: airbrushing.startedAt,
                        onChange: (date) => updateAirbrushing(airbrushing.id, { startedAt: date as Date | null }),
                        onBlur: () => {},
                        name: `airbrushings.${airbrushing.id}.startedAt`,
                      }}
                      mode="datetime"
                      context="start"
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Finalizado em</FormLabel>
                    <DateTimeInput
                      field={{
                        value: airbrushing.finishedAt,
                        onChange: (date) => updateAirbrushing(airbrushing.id, { finishedAt: date as Date | null }),
                        onBlur: () => {},
                        name: `airbrushings.${airbrushing.id}.finishedAt`,
                      }}
                      mode="datetime"
                      context="end"
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Layouts — same uploader as the main task layout (card look, PDF/EPS/AI
                    accepted). Airbrushing layouts have NO status, so the picker is hidden.
                    Receipts/NFes are intentionally omitted here. */}
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <FormLabel className="flex items-center gap-2">
                    <IconPhoto className="h-4 w-4" />
                    Layouts
                  </FormLabel>
                  <LayoutFileUploadField
                    onFilesChange={(files) => handleLayoutsChange(airbrushing.id, files)}
                    showStatus={false}
                    existingFiles={airbrushing.layouts}
                    maxFiles={20}
                    showPreview={true}
                    placeholder="Adicione layouts da aerografia"
                    variant="card"
                    disabled={disabled || airbrushing.uploading}
                  >
                    {/* Recommend files previously used as AIRBRUSHING layouts for this customer
                        (separate pool from the task-layout recommendations). */}
                    {customerId && (
                      <FileSuggestions
                        customerId={customerId}
                        fileContext="airbrushingLayouts"
                        excludeFileIds={airbrushing.layouts.map((f) => (f as any).uploadedFileId || f.id).filter(Boolean)}
                        onSelect={(newFile) => {
                          const fileWithPreview = {
                            id: newFile.id,
                            name: newFile.filename || newFile.originalName || "layout",
                            size: newFile.size || 0,
                            type: newFile.mimetype || "application/octet-stream",
                            lastModified: Date.now(),
                            uploaded: true,
                            uploadProgress: 100,
                            uploadedFileId: newFile.id,
                            thumbnailUrl: newFile.thumbnailUrl || undefined,
                          } as FileWithPreview;
                          handleLayoutsChange(airbrushing.id, [...airbrushing.layouts, fileWithPreview]);
                        }}
                        disabled={disabled || airbrushing.uploading}
                      />
                    )}
                  </LayoutFileUploadField>
                </div>

                {/* Error Message */}
                {airbrushing.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{airbrushing.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAirbrushing}
          disabled={disabled || airbrushings.length >= 10}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Aerografia
        </Button>
      </div>
    );
  },
);

MultiAirbrushingSelector.displayName = "MultiAirbrushingSelector";
