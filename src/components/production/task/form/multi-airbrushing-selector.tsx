import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useController } from "react-hook-form";
import { IconPlus, IconTrash, IconPhoto, IconPaperclip, IconFileInvoice } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FileUploadField } from "@/components/common/file";
import type { FileWithPreview } from "@/components/common/file";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";

interface MultiAirbrushingSelectorProps {
  control: any;
  disabled?: boolean;
  isEditMode?: boolean;
  onAirbrushingsCountChange?: (count: number) => void;
}

interface AirbrushingItem {
  id: string;
  status: string;
  price: number | null;
  startDate: Date | null;
  finishDate: Date | null;
  receiptFiles: FileWithPreview[];
  nfeFiles: FileWithPreview[];
  artworkFiles: FileWithPreview[];
  receiptIds?: string[];
  invoiceIds?: string[];
  artworkIds?: string[];
  uploading?: boolean;
  error?: string;
}

export interface MultiAirbrushingSelectorRef {
  addAirbrushing: () => void;
  clearAll: () => void;
}

export const MultiAirbrushingSelector = forwardRef<MultiAirbrushingSelectorRef, MultiAirbrushingSelectorProps>(
  ({ control, disabled, isEditMode = false, onAirbrushingsCountChange }, ref) => {
    // Use controller to properly manage form field
    const { field } = useController({
      name: "airbrushings" as any,
      control,
    });

    // Helper to convert File objects to FileWithPreview
    const convertFilesToFileWithPreview = (files: any[]): FileWithPreview[] => {
      return (files || []).map(file => {
        // Create a minimal File-like object that satisfies the FileWithPreview interface
        const mockFile = new File([], file.filename || '', { type: file.mimetype || '' });

        return Object.assign(mockFile, {
          id: file.id,
          name: file.filename,
          size: file.size,
          type: file.mimetype,
          preview: file.url || '',
          uploaded: true,
          uploadedFileId: file.id,
          thumbnailUrl: file.thumbnailUrl || undefined,
        }) as FileWithPreview;
      });
    };

    // Initialize airbrushings from form field value
    // Defaults are now set in mapDataToForm, so field.value should always have data
    const [airbrushings, setAirbrushings] = useState<AirbrushingItem[]>(() => {
      // Always map from field.value - defaults are now provided by mapDataToForm
      const data = field.value && Array.isArray(field.value) ? field.value : [];
      return data.map((airbrushing: any, index: number) => ({
        id: airbrushing.id || `airbrushing-${Date.now()}-${index}`,
        status: airbrushing.status || AIRBRUSHING_STATUS.PENDING,
        price: airbrushing.price || null,
        startDate: airbrushing.startDate || null,
        finishDate: airbrushing.finishDate || null,
        // Merge existing uploaded files (from API as 'receipts') and newly selected files (as 'receiptFiles')
        receiptFiles: [
          ...convertFilesToFileWithPreview(airbrushing.receipts || []),
          ...(airbrushing.receiptFiles || [])
        ],
        nfeFiles: [
          ...convertFilesToFileWithPreview(airbrushing.invoices || []),
          ...(airbrushing.nfeFiles || [])
        ],
        artworkFiles: [
          ...convertFilesToFileWithPreview(airbrushing.artworks || []),
          ...(airbrushing.artworkFiles || [])
        ],
        receiptIds: airbrushing.receiptIds || [],
        invoiceIds: airbrushing.invoiceIds || [],
        artworkIds: airbrushing.artworkIds || [],
      }));
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
        const newAirbrushings = field.value.map((airbrushing: any, index: number) => {
          return {
            id: airbrushing.id || `airbrushing-${Date.now()}-${index}`, // Preserve ID from form data
            status: airbrushing.status || AIRBRUSHING_STATUS.PENDING,
            price: airbrushing.price || null,
            startDate: airbrushing.startDate || null,
            finishDate: airbrushing.finishDate || null,
            // Merge existing uploaded files (from API as 'receipts') and newly selected files (as 'receiptFiles')
            receiptFiles: [
              ...convertFilesToFileWithPreview(airbrushing.receipts || []),
              ...(airbrushing.receiptFiles || [])
            ],
            nfeFiles: [
              ...convertFilesToFileWithPreview(airbrushing.invoices || []),
              ...(airbrushing.nfeFiles || [])
            ],
            artworkFiles: [
              ...convertFilesToFileWithPreview(airbrushing.artworks || []),
              ...(airbrushing.artworkFiles || [])
            ],
            receiptIds: airbrushing.receiptIds || [],
            invoiceIds: airbrushing.invoiceIds || [],
            artworkIds: airbrushing.artworkIds || [],
          };
        });
        setAirbrushings(newAirbrushings);
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
          price: airbrushing.price,
          startDate: airbrushing.startDate,
          finishDate: airbrushing.finishDate,
          receiptIds: airbrushing.receiptIds || [],
          invoiceIds: airbrushing.invoiceIds || [],
          artworkIds: airbrushing.artworkIds || [],
          // Include the actual files for submission with the form
          receiptFiles: airbrushing.receiptFiles,
          nfeFiles: airbrushing.nfeFiles,
          artworkFiles: airbrushing.artworkFiles,
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
        price: null,
        startDate: null,
        finishDate: null,
        receiptFiles: [],
        nfeFiles: [],
        artworkFiles: [],
        receiptIds: [],
        invoiceIds: [],
        artworkIds: [],
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

    const handleReceiptFilesChange = useCallback(
      (airbrushingId: string, files: FileWithPreview[]) => {
        // Store files without uploading - they'll be submitted with the form
        updateAirbrushing(airbrushingId, {
          receiptFiles: files,
          receiptIds: files.filter(f => f.uploaded).map(f => f.uploadedFileId!).filter(Boolean),
        });
      },
      [updateAirbrushing],
    );

    const handleNfeFilesChange = useCallback(
      (airbrushingId: string, files: FileWithPreview[]) => {
        // Store files without uploading - they'll be submitted with the form
        updateAirbrushing(airbrushingId, {
          nfeFiles: files,
          invoiceIds: files.filter(f => f.uploaded).map(f => f.uploadedFileId!).filter(Boolean),
        });
      },
      [updateAirbrushing],
    );

    const handleArtworkFilesChange = useCallback(
      (airbrushingId: string, files: FileWithPreview[]) => {
        // Store files without uploading - they'll be submitted with the form
        updateAirbrushing(airbrushingId, {
          artworkFiles: files,
          artworkIds: files.filter(f => f.uploaded).map(f => f.uploadedFileId!).filter(Boolean),
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
                {/* Status row (only in edit mode) */}
                {isEditMode && (
                  <div className="flex gap-4 items-end">
                    <div className="space-y-2 flex-1">
                      <FormLabel>Status</FormLabel>
                      <Combobox
                        value={airbrushing.status}
                        onValueChange={(value) => updateAirbrushing(airbrushing.id, { status: (value as string) || '' })}
                        disabled={disabled}
                        options={Object.values(AIRBRUSHING_STATUS).map((status) => ({
                          value: status,
                          label: AIRBRUSHING_STATUS_LABELS[status],
                        }))}
                        placeholder="Status"
                        searchable={false}
                      />
                    </div>
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
                  </div>
                )}

                {/* Price, Dates aligned with File Uploads below */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Preço - aligns with Recibos */}
                  <div className="space-y-2">
                    <FormLabel>Preço</FormLabel>
                    <Input
                      type="currency"
                      value={airbrushing.price || undefined}
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

                  {/* Início - aligns with Notas Fiscais */}
                  <div className="space-y-2">
                    <FormLabel>Início</FormLabel>
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

                  {/* Conclusão + Trash - aligns with Artes */}
                  <div className="flex gap-2 items-end">
                    <div className="space-y-2 flex-1">
                      <FormLabel>Conclusão</FormLabel>
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
                </div>

                {/* File Uploads - 3 equal columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Receipts - aligns with Preço */}
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <FormLabel className="flex items-center gap-2">
                      <IconPaperclip className="h-4 w-4" />
                      Recibos
                    </FormLabel>
                    <FileUploadField
                      onFilesChange={(files) => handleReceiptFilesChange(airbrushing.id, files)}
                      existingFiles={airbrushing.receiptFiles}
                      maxFiles={10}
                      showPreview={true}
                      variant="compact"
                      placeholder="Adicione recibos"
                      disabled={disabled || airbrushing.uploading}
                    />
                  </div>

                  {/* NFEs - aligns with Início */}
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <FormLabel className="flex items-center gap-2">
                      <IconFileInvoice className="h-4 w-4" />
                      Notas Fiscais
                    </FormLabel>
                    <FileUploadField
                      onFilesChange={(files) => handleNfeFilesChange(airbrushing.id, files)}
                      existingFiles={airbrushing.nfeFiles}
                      maxFiles={10}
                      showPreview={true}
                      variant="compact"
                      placeholder="Adicione NFes"
                      disabled={disabled || airbrushing.uploading}
                    />
                  </div>

                  {/* Artworks - aligns with Conclusão */}
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <FormLabel className="flex items-center gap-2">
                      <IconPhoto className="h-4 w-4" />
                      Artes
                    </FormLabel>
                    <FileUploadField
                      onFilesChange={(files) => handleArtworkFilesChange(airbrushing.id, files)}
                      existingFiles={airbrushing.artworkFiles}
                      maxFiles={20}
                      showPreview={true}
                      variant="compact"
                      placeholder="Adicione artes"
                      acceptedFileTypes={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'] }}
                      disabled={disabled || airbrushing.uploading}
                    />
                  </div>
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
