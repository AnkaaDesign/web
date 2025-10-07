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
import { uploadSingleFile } from "../../../../api-client";
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
    } else {
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

  // Handle file upload for a specific cut
  const handleFileUpload = useCallback(
    async (cutId: string, files: FileWithPreview[]) => {
      if (files.length === 0) {
        updateCut(cutId, { file: undefined, fileId: undefined });
        return;
      }

      const file = files[0];
      updateCut(cutId, { file, uploading: true, error: undefined });

      try {
        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            updateCut(cutId, {
              file: {
                ...file,
                uploadProgress: progress.percentage,
                uploaded: false,
              } as FileWithPreview,
            });
          },
        });

        if (!result.success || !result.data) {
          throw new Error(result.message || "Upload failed");
        }

        const uploadedFile = result.data;
        const apiBaseUrl = getApiBaseUrl();
        updateCut(cutId, {
          fileId: uploadedFile.id,
          file: {
            ...file,
            name: file.name,
            size: file.size,
            type: file.type,
            id: uploadedFile.id,
            uploadProgress: 100,
            uploaded: true,
            thumbnailUrl: uploadedFile.thumbnailUrl || `${apiBaseUrl}/files/thumbnail/${uploadedFile.id}`,
            uploadedFileId: uploadedFile.id,
          } as FileWithPreview,
          uploading: false,
        });
      } catch (error) {
        updateCut(cutId, {
          error: "Erro ao enviar arquivo",
          uploading: false,
          file: {
            ...file,
            error: "Upload failed",
            uploadProgress: 0,
            uploaded: false,
          } as FileWithPreview,
        });
      }
    },
    [updateCut],
  );

  // Calculate total cuts
  const totalCuts = cuts.reduce((sum, cut) => sum + cut.quantity, 0);

  // Sync FROM form field TO local state when form resets (form → local)
  useEffect(() => {
    // Skip if we're currently syncing TO the form (prevents race conditions)
    if (isSyncingToForm.current) {
      console.log('[MultiCutSelector] Skipping Form→Local sync (currently syncing to form)');
      return;
    }

    console.log('[MultiCutSelector] Field value changed:', field.value);

    if (field.value && Array.isArray(field.value) && field.value.length > 0) {
      // Compare only essential data (exclude file objects which have different formats)
      const essentialData = field.value.map((cut: any) => ({
        type: cut.type,
        quantity: cut.quantity,
        fileId: cut.fileId,
      }));
      const fieldValueString = JSON.stringify(essentialData);

      console.log('[MultiCutSelector] Checking if should update. Last:', lastFieldValueRef.current, 'New:', fieldValueString);

      // Only update local state if field value is different from what we last sent
      if (fieldValueString !== lastFieldValueRef.current) {
        console.log('[MultiCutSelector] Updating local state with', field.value.length, 'cuts');

        const apiBaseUrl = getApiBaseUrl();
        const newCuts = field.value.map((cut: any, index: number) => {
          // Convert existing file to FileWithPreview format if available
          const existingFile = cut.file ? {
            id: cut.file.id,
            name: cut.file.filename || cut.file.name || 'Arquivo anexado',
            size: cut.file.size || 0,
            type: cut.file.mimetype || cut.file.type || 'application/octet-stream',
            uploaded: true,
            uploadProgress: 100,
            uploadedFileId: cut.file.id,
            thumbnailUrl: cut.file.thumbnailUrl || `${apiBaseUrl}/files/thumbnail/${cut.file.id}`,
          } as FileWithPreview : undefined;

          return {
            id: `cut-${Date.now()}-${index}`,
            type: cut.type || CUT_TYPE.VINYL,
            quantity: cut.quantity || 1,
            fileId: cut.fileId,
            file: existingFile,
          };
        });

        console.log('[MultiCutSelector] New cuts state:', newCuts);
        setCuts(newCuts);
        lastFieldValueRef.current = fieldValueString;
      }
    } else if (!field.value || (Array.isArray(field.value) && field.value.length === 0)) {
      console.log('[MultiCutSelector] Field value is empty, clearing cuts');
      // Clear cuts if field value is empty
      if (cuts.length > 0) {
        setCuts([]);
        lastFieldValueRef.current = "";
      }
    }
  }, [field.value]);

  // Sync FROM local state TO form field when cuts change (local → form)
  useEffect(() => {
    const formCuts = cuts.map((cut) => {
      const formCut: any = {
        type: cut.type,
        quantity: cut.quantity,
        fileId: cut.fileId || "",
        origin: CUT_ORIGIN.PLAN,
      };

      // Preserve file object if it exists to prevent sync loops
      if (cut.file) {
        formCut.file = cut.file;
      }

      return formCut;
    });

    // Compare only essential data (exclude file objects)
    const essentialData = formCuts.map((cut) => ({
      type: cut.type,
      quantity: cut.quantity,
      fileId: cut.fileId,
    }));
    const formCutsString = JSON.stringify(essentialData);

    // Only update field if local cuts changed (user interaction)
    if (formCutsString !== lastFieldValueRef.current) {
      console.log('[MultiCutSelector] Local→Form sync: updating field with', formCuts.length, 'cuts');
      lastFieldValueRef.current = formCutsString;

      // Set flag to prevent Form→Local from reacting to our change
      isSyncingToForm.current = true;
      field.onChange(formCuts);

      // Reset flag after React finishes batching updates
      setTimeout(() => {
        isSyncingToForm.current = false;
        console.log('[MultiCutSelector] Sync lock released');
      }, 0);
    }
  }, [cuts, field]);

  return (
    <div className="space-y-4">
      {/* Info Badge */}
      {cuts.length > 0 && (
        <div className="flex justify-start">
          <Badge variant="secondary" className="font-medium">
            {cuts.length} {cuts.length === 1 ? "arquivo" : "arquivos"} • {totalCuts} {totalCuts === 1 ? "corte" : "cortes"} total
          </Badge>
        </div>
      )}

      {/* Cuts List */}
      {cuts.length > 0 && (
        <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems} className="space-y-3">
          {cuts.map((cut) => (
            <AccordionItem key={cut.id} value={cut.id} className="border rounded-lg overflow-hidden bg-card">
              <div className="flex items-center justify-between w-full px-4 py-3">
                <AccordionTrigger className="flex-1 hover:no-underline hover:bg-muted/50 rounded mr-2">
                  <div className="flex items-center gap-3">
                    <IconGripVertical className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{CUT_TYPE_LABELS[cut.type as CUT_TYPE] || cut.type}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {cut.quantity} {cut.quantity === 1 ? "unidade" : "unidades"}
                      </span>
                      {cut.fileId && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <Badge variant="secondary" className="gap-1">
                            <IconFile className="h-3 w-3" />
                            Arquivo anexado
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <div
                  className="h-8 w-8 text-destructive hover:text-destructive rounded-md flex items-center justify-center hover:bg-destructive/10 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCut(cut.id);
                  }}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !disabled) {
                      e.preventDefault();
                      e.stopPropagation();
                      removeCut(cut.id);
                    }
                  }}
                  style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
                >
                  <IconTrash className="h-4 w-4" />
                </div>
              </div>

              <AccordionContent className="px-4 pb-4 pt-0">
                <Separator className="mb-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - File Upload */}
                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-2">
                      <IconUpload className="h-4 w-4" />
                      Arquivo de Corte
                    </FormLabel>
                    <FileUploadField
                      onFilesChange={(files) => handleFileUpload(cut.id, files)}
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
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => updateCut(cut.id, { quantity: Math.max(1, cut.quantity - 1) })}
                          disabled={disabled || cut.quantity <= 1}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={cut.quantity}
                          onChange={(value) => updateCut(cut.id, { quantity: typeof value === "number" ? value : parseInt(String(value)) || 1 })}
                          disabled={disabled}
                          className="text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => updateCut(cut.id, { quantity: Math.min(100, cut.quantity + 1) })}
                          disabled={disabled || cut.quantity >= 100}
                        >
                          +
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Serão criados {cut.quantity} {cut.quantity === 1 ? "corte" : "cortes"} deste tipo
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
});

MultiCutSelector.displayName = "MultiCutSelector";
