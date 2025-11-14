import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { IconScissors, IconPlus, IconTrash, IconFile, IconUpload, IconGripVertical } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import { CUT_TYPE, CUT_TYPE_LABELS, CUT_ORIGIN } from "../../../../constants";
import { FileUploadField } from "@/components/common/file";
import type { FileWithPreview } from "@/components/common/file";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const previousFieldsLength = useRef(0);

  // Initialize expanded items when fields are first loaded
  // In edit mode, start with all accordions CLOSED
  useEffect(() => {
    if (!hasInitialized && fields.length > 0) {
      setExpandedItems([]); // Start with all closed in edit mode
      setHasInitialized(true);
      previousFieldsLength.current = fields.length;
    }
  }, [fields, hasInitialized]);

  // When a new field is added (prepended), auto-expand it
  useEffect(() => {
    if (hasInitialized && fields.length > previousFieldsLength.current) {
      // A new field was added (prepended at index 0)
      const newFieldId = fields[0]?.id;
      if (newFieldId) {
        setExpandedItems([newFieldId]); // Open only the new cut
      }
    }
    previousFieldsLength.current = fields.length;
  }, [fields, hasInitialized]);

  // Add new cut at the beginning and close all other accordions
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
    // Expansion is handled by the useEffect above
  }, [prepend]);

  // Expose methods to parent component using imperative handle
  useImperativeHandle(
    ref,
    () => ({
      addCut,
    }),
    [addCut],
  );

  // Pass cuts count to parent
  useEffect(() => {
    if (onCutsCountChange) {
      onCutsCountChange(fields.length);
    }
  }, [fields.length, onCutsCountChange]);

  // Remove cut
  const removeCut = useCallback((index: number) => {
    const cutId = fields[index]?.id;
    remove(index);
    if (cutId) {
      setExpandedItems((prev) => prev.filter((itemId) => itemId !== cutId));
    }
  }, [remove, fields]);

  // Update cut field using setValue to avoid re-mounting components
  const updateCutField = useCallback((index: number, fieldName: string, value: any) => {
    console.log('[MultiCutSelector] updateCutField:', { index, fieldName, value: value?.name || value });
    setValue(`cuts.${index}.${fieldName}`, value, { shouldDirty: true, shouldTouch: true });
  }, [setValue]);

  // Handle file change for a specific cut
  const handleFileChange = useCallback(
    (index: number, files: FileWithPreview[]) => {
      const fieldId = fields[index]?.id;
      console.log('[MultiCutSelector] ========== FILE CHANGE ==========');
      console.log('[MultiCutSelector] Cut index:', index);
      console.log('[MultiCutSelector] Field ID:', fieldId);
      console.log('[MultiCutSelector] Files received:', files.length);
      console.log('[MultiCutSelector] Current expandedItems:', expandedItems);

      if (files.length === 0) {
        console.log('[MultiCutSelector] No files - clearing file from cut');
        updateCutField(index, 'file', undefined);
        updateCutField(index, 'fileId', undefined);
        return;
      }

      const file = files[0];
      console.log('[MultiCutSelector] Updating cut with file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isFileInstance: file instanceof File,
        hasUploadedFileId: !!file.uploadedFileId,
        uploaded: file.uploaded,
      });

      // Store the file in the cut item
      updateCutField(index, 'file', file);
      // Set fileId if file is already uploaded, otherwise clear it
      if (file.uploaded && file.uploadedFileId) {
        updateCutField(index, 'fileId', file.uploadedFileId);
      } else {
        updateCutField(index, 'fileId', undefined);
      }

      console.log('[MultiCutSelector] Cut updated with file');
      console.log('[MultiCutSelector] Form value after update:', getValues(`cuts.${index}`));
      console.log('[MultiCutSelector] expandedItems after update:', expandedItems);
    },
    [updateCutField, fields, expandedItems, getValues],
  );

  // Check if there are cuts without files - use cutsValues for reactive check
  const hasCutsWithoutFiles = cutsValues.length > 0 && cutsValues.some((cut: any) => !cut.file && !cut.fileId);

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <Accordion
          type="multiple"
          value={expandedItems}
          onValueChange={(value) => {
            console.log('[MultiCutSelector] Accordion value changed to:', value);
            setExpandedItems(value);
          }}
          className="w-full space-y-2">
          {fields.map((field: any, index) => {
            // Get current cut values from watched data for reactive updates
            const currentCut = cutsValues[index] || field;

            return (
            <AccordionItem key={field.id} value={field.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-2">
                  <div className="flex items-center gap-2">
                    <IconGripVertical className="h-4 w-4 text-muted-foreground" />
                    <IconScissors className="h-4 w-4" />
                    <span className="font-medium">Corte #{index + 1}</span>
                    <Badge variant="secondary">{CUT_TYPE_LABELS[currentCut.type as keyof typeof CUT_TYPE_LABELS] || currentCut.type}</Badge>
                    <Badge variant="outline">Qtd: {currentCut.quantity}</Badge>
                    {currentCut.file && <Badge variant="success">Arquivo anexado</Badge>}
                  </div>
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCut(index);
                    }}
                    disabled={disabled}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                  >
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column - File Upload */}
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
                  <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
              </AccordionContent>
            </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {hasCutsWithoutFiles && (
        <Alert variant="destructive">
          <AlertDescription>Alguns cortes não possuem arquivos anexados. Adicione os arquivos antes de enviar o formulário.</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

MultiCutSelector.displayName = "MultiCutSelector";
