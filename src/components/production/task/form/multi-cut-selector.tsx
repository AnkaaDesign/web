import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useController } from "react-hook-form";
import { IconScissors, IconPlus, IconTrash, IconFile, IconUpload, IconAlertCircle, IconGripVertical } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import { CUT_TYPE, CUT_TYPE_LABELS, CUT_ORIGIN } from "../../../../constants";
import { FileUploadField } from "@/components/file";
import type { FileWithPreview } from "@/components/file";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getApiBaseUrl } from "@/utils/file";

interface MultiCutSelectorProps {
  control: any;
  disabled?: boolean;
  onCutsCountChange?: (count: number) => void;
}

interface CutItem {
  id: string;
  type: string;
  quantity: number;
  fileId?: string;
  file?: FileWithPreview;
  uploading?: boolean;
  error?: string;
}

export interface MultiCutSelectorRef {
  addCut: () => void;
}

export const MultiCutSelector = forwardRef<MultiCutSelectorRef, MultiCutSelectorProps>(({ control, disabled, onCutsCountChange }, ref) => {
  // Use controller to properly manage form field
  const { field } = useController({
    name: "cuts" as any,
    control,
  });

  // Start with empty state - let sync effect handle initialization
  const [cuts, setCuts] = useState<CutItem[]>([]);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Track last synced value to prevent infinite loops
  const lastFieldValueRef = useRef<string>("");

  // Flag to prevent Form→Local sync while Local→Form is syncing
  const isSyncingToForm = useRef<boolean>(false);

  // Add new cut
  const addCut = useCallback(() => {
    const newCut: CutItem = {
      id: `cut-${Date.now()}`,
      type: CUT_TYPE.VINYL,
      quantity: 1,
    };
    setCuts((prev) => {
      const newCuts = [...prev, newCut];
      return newCuts;
    });
    setExpandedItems((prev) => [...prev, newCut.id]);
  }, []);

  // Expose methods to parent component using imperative handle
  useImperativeHandle(
    ref,
    () => ({
      addCut,
    }),
    [addCut],
  );

  // Pass cuts count to parent (separate effect)
  useEffect(() => {
    if (onCutsCountChange) {
      onCutsCountChange(cuts.length);
    }
  }, [cuts.length, onCutsCountChange]);

  // Remove cut
  const removeCut = useCallback((id: string) => {
    setCuts((prev) => prev.filter((cut) => cut.id !== id));
    setExpandedItems((prev) => prev.filter((itemId) => itemId !== id));
  }, []);

  // Update cut
  const updateCut = useCallback((id: string, updates: Partial<CutItem>) => {
    setCuts((prev) => prev.map((cut) => (cut.id === id ? { ...cut, ...updates } : cut)));
  }, []);

  // Handle file change for a specific cut - no longer uploads immediately
  const handleFileChange = useCallback(
    (cutId: string, files: FileWithPreview[]) => {
      if (files.length === 0) {
        updateCut(cutId, { file: undefined, fileId: undefined });
        return;
      }

      const file = files[0];
      // Store the file in the cut item - it will be uploaded when the form is submitted
      updateCut(cutId, {
        file: file,
        fileId: undefined, // Clear fileId since we're using a new file
        uploading: false,
        error: undefined,
      });
    },
    [updateCut],
  );

  // Sync Local→Form (SINGLE SOURCE OF TRUTH)
  useEffect(() => {
    // Skip if no cuts
    if (cuts.length === 0) {
      field.onChange([]);
      return;
    }

    // Mark that we're syncing to prevent reverse sync
    isSyncingToForm.current = true;

    // Transform cuts to the format expected by the form
    const formData = cuts.map((cut) => ({
      type: cut.type,
      quantity: cut.quantity,
      fileId: cut.fileId,
      file: cut.file, // Include the file object for submission
      origin: CUT_ORIGIN.PLAN, // Always PLAN for task-created cuts
    }));

    // Update form field
    field.onChange(formData);

    // Clear sync flag after next tick
    setTimeout(() => {
      isSyncingToForm.current = false;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuts]); // Only depend on cuts, not field (field.onChange is stable)

  // Sync Form→Local (only on initial load or external changes)
  useEffect(() => {
    // Skip if we're currently syncing to form
    if (isSyncingToForm.current) return;

    const fieldValue = field.value;
    const fieldValueStr = JSON.stringify(fieldValue);

    // Skip if value hasn't changed
    if (fieldValueStr === lastFieldValueRef.current) return;

    lastFieldValueRef.current = fieldValueStr;

    // Initialize from form value if exists
    if (fieldValue && Array.isArray(fieldValue) && fieldValue.length > 0) {
      const newCuts: CutItem[] = fieldValue.map((item: any, index: number) => ({
        id: item.id || `cut-${Date.now()}-${index}`,
        type: item.type || CUT_TYPE.VINYL,
        quantity: item.quantity || 1,
        fileId: item.fileId,
        file: item.file,
      }));
      setCuts(newCuts);
      setExpandedItems(newCuts.map((c) => c.id));
    } else if (fieldValue === null || (Array.isArray(fieldValue) && fieldValue.length === 0)) {
      // Clear cuts if form field is empty/null
      setCuts([]);
      setExpandedItems([]);
    }
  }, [field.value]);

  return (
    <div className="space-y-4">
      {cuts.length > 0 && (
        <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems} className="w-full space-y-2">
          {cuts.map((cut, index) => (
            <AccordionItem key={cut.id} value={cut.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-2">
                  <div className="flex items-center gap-2">
                    <IconGripVertical className="h-4 w-4 text-muted-foreground" />
                    <IconScissors className="h-4 w-4" />
                    <span className="font-medium">Corte #{index + 1}</span>
                    <Badge variant="secondary">{CUT_TYPE_LABELS[cut.type as keyof typeof CUT_TYPE_LABELS] || cut.type}</Badge>
                    <Badge variant="outline">Qtd: {cut.quantity}</Badge>
                  </div>
                  {cut.file && <Badge variant="success">Arquivo anexado</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column - File Upload */}
                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-2">
                      <IconUpload className="h-4 w-4" />
                      Arquivo de Corte
                    </FormLabel>
                    <FileUploadField
                      onFilesChange={(files) => handleFileChange(cut.id, files)}
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
                      existingFiles={cut.file ? [cut.file] : []}
                      disabled={disabled || cut.uploading}
                      showPreview={true}
                      variant="compact"
                      placeholder="Arquivo EPS, PDF, SVG ou similar"
                      className="w-full"
                    />
                    {cut.error && <p className="text-sm text-destructive mt-1">{cut.error}</p>}
                  </div>

                  {/* Right Column - Type and Quantity */}
                  <div className="space-y-4">
                    {/* Cut Type */}
                    <div className="space-y-2">
                      <FormLabel>Tipo de Corte</FormLabel>
                      <Combobox
                        value={cut.type}
                        onValueChange={(value) => updateCut(cut.id, { type: value as string })}
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
                        value={cut.quantity}
                        onChange={(value) => {
                          const num = typeof value === 'string' ? parseInt(value, 10) : value as number;
                          updateCut(cut.id, { quantity: isNaN(num) || num < 1 ? 1 : num });
                        }}
                        disabled={disabled}
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCut(cut.id)} disabled={disabled}>
                    <IconTrash className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {cuts.length > 0 && cuts.some((c) => !c.file) && (
        <Alert>
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Alguns cortes não possuem arquivos anexados. Adicione os arquivos antes de enviar o formulário.</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

MultiCutSelector.displayName = "MultiCutSelector";