import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { IconScissors, IconPlus, IconTrash, IconFile, IconUpload, IconGripVertical } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // CRITICAL: Watch the cuts values to get reactive updates when files are added
  // The fields array from useFieldArray is NOT reactive to setValue calls
  const cutsValues = watch("cuts") as any[] || [];

  const [hasInitialized, setHasInitialized] = useState(false);
  const previousFieldsLength = useRef(0);

  // Initialize with one empty cut if none exist (for create mode or when section opens empty)
  useEffect(() => {
    if (!hasInitialized) {
      if (fields.length === 0) {
        // Add one empty cut to show the form immediately
        const initialCut = {
          id: `cut-initial`,
          type: CUT_TYPE.VINYL,
          quantity: 1,
          origin: CUT_ORIGIN.PLAN,
          fileId: undefined,
          file: undefined,
        };
        append(initialCut);
      }
      setHasInitialized(true);
      previousFieldsLength.current = fields.length;
    }
  }, [fields, hasInitialized, append]);

  // Add new cut at the beginning
  const addCut = useCallback(() => {
    const newCut = {
      id: `cut-${Date.now()}`,
      type: CUT_TYPE.VINYL,
      quantity: 1,
      origin: CUT_ORIGIN.PLAN,
      fileId: undefined,
      file: undefined,
    };
    prepend(newCut); // Add at the beginning, not the end
  }, [prepend]);

  // Clear all cuts
  const clearAll = useCallback(() => {
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

  // Remove cut
  const removeCut = useCallback((index: number) => {
    remove(index);
  }, [remove]);

  // Update cut field using setValue to avoid re-mounting components
  const updateCutField = useCallback((index: number, fieldName: string, value: any) => {
    setValue(`cuts.${index}.${fieldName}`, value, { shouldDirty: true, shouldTouch: true });
  }, [setValue]);

  // Handle file change for a specific cut
  const handleFileChange = useCallback(
    (index: number, files: FileWithPreview[]) => {
      if (files.length === 0) {
        updateCutField(index, 'file', undefined);
        updateCutField(index, 'fileId', undefined);
        return;
      }

      const file = files[0];

      // Store the file in the cut item
      updateCutField(index, 'file', file);
      // Set fileId if file is already uploaded, otherwise clear it
      if (file.uploaded && file.uploadedFileId) {
        updateCutField(index, 'fileId', file.uploadedFileId);
      } else {
        updateCutField(index, 'fileId', undefined);
      }
    },
    [updateCutField],
  );

  // Check if there are cuts without files - use cutsValues for reactive check
  // Only show warning if:
  // 1. There are multiple cuts, OR
  // 2. The single cut has been meaningfully modified (different from default values)
  const hasCutsWithoutFiles = useMemo(() => {
    if (cutsValues.length === 0) return false;

    // If there's only one cut, check if it's been modified from defaults
    if (cutsValues.length === 1) {
      const cut = cutsValues[0];
      const isDefaultCut =
        cut.type === CUT_TYPE.VINYL &&
        cut.quantity === 1 &&
        !cut.file &&
        !cut.fileId;

      // Don't show warning for unmodified default cut
      if (isDefaultCut) return false;

      // Show warning if the cut was modified but has no file
      return !cut.file && !cut.fileId;
    }

    // For multiple cuts, check if any are missing files
    return cutsValues.some((cut: any) => !cut.file && !cut.fileId);
  }, [cutsValues]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {fields.map((field: any, index) => {
            // Get current cut values from watched data for reactive updates
            const currentCut = cutsValues[index] || field;

            return (
            <Card key={field.id} className="border rounded-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconGripVertical className="h-4 w-4 text-muted-foreground" />
                    <IconScissors className="h-4 w-4" />
                    <CardTitle className="text-base">Corte #{index + 1}</CardTitle>
                    <Badge variant="secondary">{CUT_TYPE_LABELS[currentCut.type as keyof typeof CUT_TYPE_LABELS] || currentCut.type}</Badge>
                    <Badge variant="outline">Quantidade: {currentCut.quantity}</Badge>
                    {currentCut.file && <Badge variant="success">Arquivo anexado</Badge>}
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeCut(index)}
                    disabled={disabled}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                  >
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column - File Upload */}
                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-2">
                      <IconUpload className="h-4 w-4" />
                      Arquivo de Corte
                    </FormLabel>
                    <FileUploadField
                      onFilesChange={(files) => handleFileChange(index, files)}
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
                      existingFiles={currentCut.file ? [convertToFileWithPreview(currentCut.file)].filter(Boolean) as FileWithPreview[] : []}
                      disabled={disabled}
                      showPreview={true}
                      variant="compact"
                      placeholder="Arquivo EPS, PDF, SVG ou similar"
                      className="w-full"
                    />
                  </div>

                  {/* Right Column - Type and Quantity */}
                  <div className="space-y-4">
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

                    {/* Quantity */}
                    <div className="space-y-2">
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
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCut}
        disabled={disabled || fields.length >= 10}
        className="w-full"
      >
        <IconPlus className="h-4 w-4 mr-2" />
        Adicionar Mais
      </Button>

      {hasCutsWithoutFiles && (
        <Alert variant="destructive">
          <AlertDescription>Alguns cortes não possuem arquivos anexados. Adicione os arquivos antes de enviar o formulário.</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

MultiCutSelector.displayName = "MultiCutSelector";
