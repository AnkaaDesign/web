import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import { CUT_TYPE, CUT_TYPE_LABELS, CUT_ORIGIN } from "../../../../constants";
import { FileUploadField } from "@/components/common/file";
import type { FileWithPreview } from "@/components/common/file";
import { getApiBaseUrl } from "@/utils/file";

// Helper function to convert database File entity to FileWithPreview
const convertToFileWithPreview = (file: any | undefined | null): FileWithPreview | undefined => {
  if (!file) return undefined;

  // If it's already a File with uploaded metadata, return as-is
  if (file instanceof File) {
    return file as FileWithPreview;
  }

  // Convert database file entity to FileWithPreview format
  return {
    id: file.id,
    name: file.filename || file.name || 'file',
    size: file.size || 0,
    type: file.mimetype || file.type || 'application/octet-stream',
    lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
    uploaded: true,
    uploadProgress: 100,
    uploadedFileId: file.id,
    thumbnailUrl: file.thumbnailUrl,
  } as FileWithPreview;
};

interface MultiCutSelectorProps {
  control: any;
  disabled?: boolean;
  onCutsCountChange?: (count: number) => void;
}

export interface MultiCutSelectorRef {
  addCut: () => void;
  clearAll: () => void;
}

export const MultiCutSelector = forwardRef<MultiCutSelectorRef, MultiCutSelectorProps>(({ control, disabled, onCutsCountChange }, ref) => {
  const { setValue, getValues, watch } = useFormContext();

  // Use React Hook Form's useFieldArray - the proper way to manage array fields
  const { fields, append, prepend, remove } = useFieldArray({
    control,
    name: "cuts",
  });

  // CRITICAL FIX: Track files in local state to prevent clearing on re-render
  // React Hook Form's setValue triggers re-renders before state updates,
  // which causes FileUploadField to receive value={[]} and clear the selection.
  // This local state ensures files are displayed immediately after selection.
  const [localFilesMap, setLocalFilesMap] = useState<Record<string, FileWithPreview | undefined>>({});

  // CRITICAL: Watch the cuts values to get reactive updates when files are added
  // The fields array from useFieldArray is NOT reactive to setValue calls
  const rawCutsValues = watch("cuts");

  // CRITICAL FIX: Ensure cutsValues is always an array
  // React Hook Form might sometimes return objects with numeric keys instead of arrays
  const normalizedCutsValues = useMemo(() => {
    if (Array.isArray(rawCutsValues)) return rawCutsValues;
    if (rawCutsValues && typeof rawCutsValues === 'object') {
      // Convert object with numeric keys to array
      const keys = Object.keys(rawCutsValues);
      if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
        return keys.sort((a, b) => Number(a) - Number(b)).map(k => (rawCutsValues as any)[k]);
      }
    }
    return [];
  }, [rawCutsValues]);

  // CRITICAL FIX: Merge data from both watch() and useFieldArray fields
  // Sometimes watch() lags behind useFieldArray, especially after prepend/append operations
  // This ensures we have the most up-to-date file information from either source
  const cutsValues = useMemo(() => {
    const maxLength = Math.max(normalizedCutsValues.length, fields.length);
    const merged: any[] = [];

    for (let i = 0; i < maxLength; i++) {
      const watchedCut = normalizedCutsValues[i];
      const fieldCut = fields[i] as any;

      // Determine the best file value - check both sources explicitly
      const watchedFile = watchedCut?.file;
      const fieldFile = fieldCut?.file;
      let mergedFile = undefined;
      if (watchedFile && (watchedFile.name || watchedFile.id)) {
        mergedFile = watchedFile;
      } else if (fieldFile && (fieldFile.name || fieldFile.id)) {
        mergedFile = fieldFile;
      }

      // Merge both sources, with explicit file handling
      merged.push({
        // Start with field data (has stable IDs from useFieldArray)
        ...fieldCut,
        // Override with watched data (has latest values)
        ...watchedCut,
        // Explicitly set file and fileId with our merged values
        file: mergedFile,
        fileId: watchedCut?.fileId || fieldCut?.fileId,
      });
    }

    return merged;
  }, [normalizedCutsValues, fields]);

  const [hasInitialized, setHasInitialized] = useState(false);
  const previousFieldsLength = useRef(0);

  // Initialize localFilesMap from existing cuts when component mounts or data changes
  // This ensures files from backend are displayed correctly
  useEffect(() => {
    if (!hasInitialized && fields.length > 0) {
      const initialFilesMap: Record<string, FileWithPreview | undefined> = {};
      fields.forEach((field: any, idx: number) => {
        const cut = normalizedCutsValues[idx];
        if (cut?.file) {
          initialFilesMap[field.id] = cut.file;
          // Also ensure fileName is set for change detection (if not already set)
          if (!cut.fileName && cut.file.name) {
            setValue(`cuts.${idx}.fileName`, cut.file.name);
          }
        }
      });
      if (Object.keys(initialFilesMap).length > 0) {
        setLocalFilesMap(prev => ({ ...prev, ...initialFilesMap }));
      }
      setHasInitialized(true);
      previousFieldsLength.current = fields.length;
    }
  }, [fields, normalizedCutsValues, hasInitialized, setValue]);

  // Add new cut at the beginning
  const addCut = useCallback(() => {
    const newCut = {
      id: `cut-${Date.now()}`,
      type: CUT_TYPE.VINYL,
      quantity: 1,
      origin: CUT_ORIGIN.PLAN,
      fileId: undefined,
      file: undefined,
      fileName: undefined,
    };
    prepend(newCut); // Add at the beginning, not the end
  }, [prepend]);

  // Clear all cuts
  const clearAll = useCallback(() => {
    // Clear local file state
    setLocalFilesMap({});
    // Remove all items from the end to the beginning
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
  }, [fields.length, remove]);

  // Expose methods to parent component using imperative handle
  useImperativeHandle(
    ref,
    () => ({
      addCut,
      clearAll,
    }),
    [addCut, clearAll],
  );

  // Pass cuts count to parent
  useEffect(() => {
    if (onCutsCountChange) {
      onCutsCountChange(fields.length);
    }
  }, [fields.length, onCutsCountChange]);

  // Remove cut - also clear the local file state
  const removeCut = useCallback((index: number, cutId: string) => {
    // Clear local file state for this cut
    setLocalFilesMap(prev => {
      const updated = { ...prev };
      delete updated[cutId];
      return updated;
    });
    // Remove from form
    remove(index);
  }, [remove]);

  // Update cut field using setValue to avoid re-mounting components
  const updateCutField = useCallback((index: number, fieldName: string, value: any) => {
    setValue(`cuts.${index}.${fieldName}`, value, { shouldDirty: true, shouldTouch: true });
  }, [setValue]);

  // Handle file change for a specific cut
  const handleFileChange = useCallback(
    (index: number, files: FileWithPreview[], cutId: string) => {
      if (files.length === 0) {
        // CRITICAL: Update local state FIRST (immediate UI update)
        setLocalFilesMap(prev => {
          const updated = { ...prev };
          delete updated[cutId];
          return updated;
        });
        // Then update form state
        updateCutField(index, 'file', undefined);
        updateCutField(index, 'fileId', undefined);
        updateCutField(index, 'fileName', undefined);
        return;
      }

      const file = files[0];

      // CRITICAL: Update local state FIRST (immediate UI update)
      // This prevents the file from being cleared on re-render
      setLocalFilesMap(prev => ({
        ...prev,
        [cutId]: file,
      }));

      // Then update form state (may trigger re-render before state updates)
      updateCutField(index, 'file', file);
      // CRITICAL: Set fileName for change detection - file objects get stripped during
      // comparison, but fileName (a string) won't be stripped and will trigger change detection
      updateCutField(index, 'fileName', file.name);
      // Set fileId if file is already uploaded, otherwise clear it
      if (file.uploaded && file.uploadedFileId) {
        updateCutField(index, 'fileId', file.uploadedFileId);
      } else {
        updateCutField(index, 'fileId', undefined);
      }
    },
    [updateCutField],
  );

  // Helper: Get the file for a cut, checking local state first, then form state
  const getFileForCut = useCallback((cut: any, cutId: string): FileWithPreview | undefined => {
    // Check local state first (most up-to-date)
    if (localFilesMap[cutId]) {
      return localFilesMap[cutId];
    }
    // Fall back to form state
    return cut?.file;
  }, [localFilesMap]);

  // Helper: Check if a cut has a file attached (checking multiple possible properties)
  const cutHasFile = useCallback((cut: any, index?: number, cutId?: string): boolean => {
    if (!cut) return false;

    // CRITICAL: Check localFilesMap first (most up-to-date source)
    const localFile = cutId ? localFilesMap[cutId] : undefined;
    if (localFile) {
      return true;
    }

    // Check fileId (might be string or empty string - only truthy values count)
    if (cut.fileId && typeof cut.fileId === 'string' && cut.fileId.length > 0) {
      return true;
    }

    // Check file object
    if (cut.file) {
      if (typeof cut.file === 'object') {
        if (cut.file.id || cut.file.uploadedFileId || cut.file.uploaded || cut.file.name) {
          return true;
        }
      }
      return true;
    }

    return false;
  }, [localFilesMap]);

  // Check if there are cuts without files - use cutsValues for reactive check
  // Only show warning if:
  // 1. There are multiple cuts, OR
  // 2. The single cut has been meaningfully modified (different from default values)
  const hasCutsWithoutFiles = useMemo(() => {
    if (cutsValues.length === 0) {
      return false;
    }

    // If there's only one cut, check if it's been modified from defaults
    if (cutsValues.length === 1) {
      const cut = cutsValues[0];
      // CRITICAL: Use fields[0]?.id (useFieldArray ID) consistently - this is what localFilesMap uses
      const cutId = fields[0]?.id;
      const hasFile = cutHasFile(cut, 0, cutId);
      const isDefaultCut =
        cut.type === CUT_TYPE.VINYL &&
        cut.quantity === 1 &&
        !hasFile;

      // Don't show warning for unmodified default cut
      if (isDefaultCut) {
        return false;
      }

      // Show warning if the cut was modified but has no file
      return !hasFile;
    }

    // For multiple cuts, check if any are missing files
    const cutsWithoutFiles = cutsValues.map((cut: any, idx: number) => {
      // CRITICAL: Use fields[idx]?.id (useFieldArray ID) consistently - this is what localFilesMap uses
      const cutId = fields[idx]?.id;
      return {
        index: idx,
        hasFile: cutHasFile(cut, idx, cutId),
      };
    });

    return cutsWithoutFiles.some((c: any) => !c.hasFile);
  }, [cutsValues, cutHasFile, fields, localFilesMap]);

  return (
    <div className="space-y-4">
      {/* Header with label and add button - like service selector */}
      <div className="flex items-center justify-between">
        <FormLabel>Planos de Corte</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCut}
          disabled={disabled || fields.length >= 10}
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Corte
        </Button>
      </div>

      {/* Cuts list */}
      <div className="space-y-3">
        {fields.map((field: any, index) => {
            // Get current cut values from watched data for reactive updates
            const currentCut = cutsValues[index] || field;
            // Use field.id as the stable cut identifier (from useFieldArray)
            const cutId = field.id;
            // Get file from local state first, then fall back to form state
            const fileForDisplay = getFileForCut(currentCut, cutId);

            return (
            <div key={cutId} className="border rounded-lg p-4">
              {/* Two column layout: File on left, Type+Quantity on right */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column - File Upload (takes full height) */}
                <div className="space-y-2 flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <IconUpload className="h-4 w-4" />
                    Arquivo de Corte
                  </FormLabel>
                  <FileUploadField
                    onFilesChange={(files) => handleFileChange(index, files, cutId)}
                    maxFiles={1}
                    acceptedFileTypes={{
                      "application/postscript": [".eps", ".ai"],
                      "application/x-eps": [".eps"],
                      "application/eps": [".eps"],
                      "image/eps": [".eps"],
                      "image/x-eps": [".eps"],
                      "application/pdf": [".pdf"],
                      "image/svg+xml": [".svg"],
                      "application/dxf": [".dxf"],
                      "application/x-coreldraw": [".cdr"],
                    }}
                    existingFiles={fileForDisplay ? [convertToFileWithPreview(fileForDisplay)].filter(Boolean) as FileWithPreview[] : []}
                    disabled={disabled}
                    showPreview={true}
                    variant="compact"
                    placeholder="Arquivo EPS, PDF, SVG ou similar"
                    className="w-full flex-1"
                  />
                </div>

                {/* Right Column - Type, Quantity stacked + Remove button */}
                <div className="flex flex-col gap-3">
                  {/* Cut Type */}
                  <div className="space-y-2">
                    <FormLabel>Tipo de Corte</FormLabel>
                    <Combobox
                      value={currentCut.type}
                      onValueChange={(value) => updateCutField(index, 'type', value)}
                      options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      placeholder="Selecione o tipo"
                      disabled={disabled}
                      searchable={false}
                      clearable={false}
                    />
                  </div>

                  {/* Quantity with Remove button */}
                  <div className="flex gap-3 items-end">
                    <div className="space-y-2 flex-1">
                      <FormLabel>Quantidade</FormLabel>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={currentCut.quantity}
                        onChange={(value) => {
                          const num = typeof value === 'string' ? parseInt(value, 10) : value as number;
                          updateCutField(index, 'quantity', isNaN(num) || num < 1 ? 1 : num);
                        }}
                        disabled={disabled}
                        placeholder="1"
                        className="bg-transparent"
                      />
                    </div>

                    {/* Remove Button */}
                    <Button
                      type="button"
                      onClick={() => removeCut(index, cutId)}
                      disabled={disabled}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 flex-shrink-0"
                    >
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
      </div>

      {hasCutsWithoutFiles && (
        <Alert variant="destructive">
          <AlertDescription>Alguns cortes não possuem arquivos anexados. Adicione os arquivos antes de enviar o formulário.</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

MultiCutSelector.displayName = "MultiCutSelector";
