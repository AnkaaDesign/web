import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useController } from "react-hook-form";
import { IconSpray, IconPlus, IconTrash, IconPhoto, IconPaperclip, IconFileInvoice, IconGripVertical } from "@tabler/icons-react";
import { FormLabel } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FileUploadField } from "@/components/file";
import type { FileWithPreview } from "@/components/file";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

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
      return (files || []).map(file => ({
        id: file.id,
        name: file.filename,
        size: file.size,
        type: file.mimetype,
        file: null,
        preview: file.url || '',
        uploaded: true,
        uploadedFileId: file.id,
        thumbnailUrl: file.thumbnailUrl || undefined,
      }));
    };

    // Initialize airbrushings from form field value
    const [airbrushings, setAirbrushings] = useState<AirbrushingItem[]>(() => {
      if (field.value && Array.isArray(field.value) && field.value.length > 0) {
        return field.value.map((airbrushing: any, index: number) => ({
          id: `airbrushing-${Date.now()}-${index}`,
          status: airbrushing.status || AIRBRUSHING_STATUS.PENDING,
          price: airbrushing.price || null,
          startDate: airbrushing.startDate || null,
          finishDate: airbrushing.finishDate || null,
          receiptFiles: convertFilesToFileWithPreview(airbrushing.receipts),
          nfeFiles: convertFilesToFileWithPreview(airbrushing.invoices),
          artworkFiles: convertFilesToFileWithPreview(airbrushing.artworks),
          receiptIds: airbrushing.receiptIds || [],
          invoiceIds: airbrushing.invoiceIds || [],
          artworkIds: airbrushing.artworkIds || [],
        }));
      }
      return [];
    });

    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    // Track if we're syncing to prevent infinite loops
    const isSyncingToForm = useRef<boolean>(false);
    const lastFieldValueRef = useRef<string>("");

    // Sync FROM form field TO local state when form resets (form → local)
    useEffect(() => {
      // Skip if we're currently syncing to form
      if (isSyncingToForm.current) return;

      const fieldValueStr = JSON.stringify(field.value);

      // Skip if value hasn't changed
      if (fieldValueStr === lastFieldValueRef.current) return;

      lastFieldValueRef.current = fieldValueStr;

      if (field.value && Array.isArray(field.value) && field.value.length > 0) {
        const newAirbrushings = field.value.map((airbrushing: any, index: number) => ({
          id: `airbrushing-${Date.now()}-${index}`,
          status: airbrushing.status || AIRBRUSHING_STATUS.PENDING,
          price: airbrushing.price || null,
          startDate: airbrushing.startDate || null,
          finishDate: airbrushing.finishDate || null,
          receiptFiles: convertFilesToFileWithPreview(airbrushing.receipts),
          nfeFiles: convertFilesToFileWithPreview(airbrushing.invoices),
          artworkFiles: convertFilesToFileWithPreview(airbrushing.artworks),
          receiptIds: airbrushing.receiptIds || [],
          invoiceIds: airbrushing.invoiceIds || [],
          artworkIds: airbrushing.artworkIds || [],
        }));
        setAirbrushings(newAirbrushings);
      } else if (!field.value || (Array.isArray(field.value) && field.value.length === 0)) {
        // Clear airbrushings if field value is empty
        setAirbrushings([]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.value]);

    // Sync FROM local state TO form field when airbrushings change (local → form)
    useEffect(() => {
      // Mark that we're syncing
      isSyncingToForm.current = true;

      const formValue = airbrushings.map((airbrushing) => ({
        status: airbrushing.status,
        price: airbrushing.price,
        startDate: airbrushing.startDate,
        finishDate: airbrushing.finishDate,
        receiptIds: airbrushing.receiptIds || [],
        invoiceIds: airbrushing.invoiceIds || [],
        artworkIds: airbrushing.artworkIds || [],
        // Include the actual files for submission with the form
        receiptFiles: airbrushing.receiptFiles.filter(f => !f.uploaded && f instanceof File),
        nfeFiles: airbrushing.nfeFiles.filter(f => !f.uploaded && f instanceof File),
        artworkFiles: airbrushing.artworkFiles.filter(f => !f.uploaded && f instanceof File),
      }));
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
      // Auto-expand the new item
      setExpandedItems((prev) => [...prev, newAirbrushing.id]);
    }, []);

    const removeAirbrushing = useCallback((id: string) => {
      setAirbrushings((prev) => prev.filter((airbrushing) => airbrushing.id !== id));
      setExpandedItems((prev) => prev.filter((itemId) => itemId !== id));
    }, []);

    const updateAirbrushing = useCallback((id: string, updates: Partial<AirbrushingItem>) => {
      setAirbrushings((prev) => prev.map((airbrushing) => (airbrushing.id === id ? { ...airbrushing, ...updates } : airbrushing)));
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
      }),
      [addAirbrushing],
    );

    const getStatusBadgeVariant = (status: string) => {
      switch (status) {
        case AIRBRUSHING_STATUS.PENDING:
          return "secondary";
        case AIRBRUSHING_STATUS.IN_PRODUCTION:
          return "default";
        case AIRBRUSHING_STATUS.COMPLETED:
          return "success";
        case AIRBRUSHING_STATUS.CANCELLED:
          return "destructive";
        default:
          return "secondary";
      }
    };

    return (
      <div className="space-y-4">
        {/* Info Badge */}
        {airbrushings.length > 0 && (
          <div className="flex justify-start">
            <Badge variant="secondary" className="font-medium">
              {airbrushings.length} {airbrushings.length === 1 ? "aerografia" : "aerografias"}
            </Badge>
          </div>
        )}

        {/* Airbrushings List */}
        {airbrushings.length > 0 && (
          <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems} className="space-y-2">
            {airbrushings.map((airbrushing, index) => (
              <AccordionItem key={airbrushing.id} value={airbrushing.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-3">
                      <IconGripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Aerografia {index + 1}</span>
                      <Badge variant={getStatusBadgeVariant(airbrushing.status)}>{AIRBRUSHING_STATUS_LABELS[airbrushing.status]}</Badge>
                      {airbrushing.price && <Badge variant="outline">{formatCurrency(airbrushing.price)}</Badge>}
                      {airbrushing.startDate && <span className="text-sm text-muted-foreground">{formatDate(airbrushing.startDate)}</span>}
                    </div>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAirbrushing(airbrushing.id);
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
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Status, Price and Dates - All in one row */}
                    <div className={`grid grid-cols-1 gap-4 ${isEditMode ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
                      {isEditMode && (
                        <div className="space-y-2">
                          <FormLabel>Status</FormLabel>
                          <Combobox
                            value={airbrushing.status}
                            onValueChange={(value) => updateAirbrushing(airbrushing.id, { status: value })}
                            disabled={disabled}
                            options={Object.values(AIRBRUSHING_STATUS).map((status) => ({
                              value: status,
                              label: AIRBRUSHING_STATUS_LABELS[status],
                            }))}
                            placeholder="Selecione o status"
                            searchable={false}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <FormLabel>Preço</FormLabel>
                        <Input
                          type="currency"
                          value={airbrushing.price || undefined}
                          onChange={(e) =>
                            updateAirbrushing(airbrushing.id, {
                              price: e.target.value ? parseFloat(e.target.value.replace(/[^\d,]/g, "").replace(",", ".")) : null,
                            })
                          }
                          disabled={disabled}
                          placeholder="R$ 0,00"
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Data de Início</FormLabel>
                        <DateTimeInput
                          field={{
                            value: airbrushing.startDate,
                            onChange: (date) => updateAirbrushing(airbrushing.id, { startDate: date }),
                          }}
                          mode="date"
                          context="start"
                          disabled={disabled}
                        />
                      </div>

                      <div className="space-y-2">
                        <FormLabel>Data de Conclusão</FormLabel>
                        <DateTimeInput
                          field={{
                            value: airbrushing.finishDate,
                            onChange: (date) => updateAirbrushing(airbrushing.id, { finishDate: date }),
                          }}
                          mode="date"
                          context="end"
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* File Uploads */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Receipts */}
                      <div className="space-y-2">
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

                      {/* NFEs */}
                      <div className="space-y-2">
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

                      {/* Artworks */}
                      <div className="space-y-2">
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
                          accept="image/*"
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
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    );
  },
);

MultiAirbrushingSelector.displayName = "MultiAirbrushingSelector";
