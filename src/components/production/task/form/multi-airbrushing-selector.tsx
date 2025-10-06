import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
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
import { uploadSingleFile } from "../../../../api-client";
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
  nfeIds?: string[];
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
          nfeFiles: convertFilesToFileWithPreview(airbrushing.nfes),
          artworkFiles: convertFilesToFileWithPreview(airbrushing.artworks),
          receiptIds: airbrushing.receiptIds || [],
          nfeIds: airbrushing.nfeIds || [],
          artworkIds: airbrushing.artworkIds || [],
        }));
      }
      return [];
    });

    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    // Sync FROM form field TO local state when form resets (form → local)
    useEffect(() => {
      if (field.value && Array.isArray(field.value) && field.value.length > 0) {
        // Check if field value is different from current local state
        const currentStateIds = airbrushings.map(a => `${a.startDate}-${a.price}-${a.status}`).join(',');
        const fieldValueIds = field.value.map((a: any) => `${a.startDate}-${a.price}-${a.status}`).join(',');

        if (currentStateIds !== fieldValueIds) {
          const newAirbrushings = field.value.map((airbrushing: any, index: number) => ({
            id: `airbrushing-${Date.now()}-${index}`,
            status: airbrushing.status || AIRBRUSHING_STATUS.PENDING,
            price: airbrushing.price || null,
            startDate: airbrushing.startDate || null,
            finishDate: airbrushing.finishDate || null,
            receiptFiles: convertFilesToFileWithPreview(airbrushing.receipts),
            nfeFiles: convertFilesToFileWithPreview(airbrushing.nfes),
            artworkFiles: convertFilesToFileWithPreview(airbrushing.artworks),
            receiptIds: airbrushing.receiptIds || [],
            nfeIds: airbrushing.nfeIds || [],
            artworkIds: airbrushing.artworkIds || [],
          }));
          setAirbrushings(newAirbrushings);
        }
      } else if (!field.value || (Array.isArray(field.value) && field.value.length === 0)) {
        // Clear airbrushings if field value is empty
        if (airbrushings.length > 0) {
          setAirbrushings([]);
        }
      }
    }, [field.value]);

    // Sync FROM local state TO form field when airbrushings change (local → form)
    useEffect(() => {
      const formValue = airbrushings.map((airbrushing) => ({
        status: airbrushing.status,
        price: airbrushing.price,
        startDate: airbrushing.startDate,
        finishDate: airbrushing.finishDate,
        receiptIds: airbrushing.receiptIds || [],
        nfeIds: airbrushing.nfeIds || [],
        artworkIds: airbrushing.artworkIds || [],
      }));
      field.onChange(formValue);

      // Notify parent about count change
      if (onAirbrushingsCountChange) {
        onAirbrushingsCountChange(airbrushings.length);
      }
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
        nfeIds: [],
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
      async (airbrushingId: string, files: FileWithPreview[]) => {
        // Filter for new files that need uploading
        const newFiles = files.filter((f) => !f.uploaded && !f.uploadedFileId);

        if (newFiles.length > 0) {
          updateAirbrushing(airbrushingId, { uploading: true, error: undefined });

          try {
            const fileIds: string[] = [];
            for (const file of newFiles) {
              try {
                const result = await uploadSingleFile(file);
                if (result.success && result.data) {
                  fileIds.push(result.data.id);
                }
              } catch (error) {
                console.error("Failed to upload receipt file:", error);
                toast.error("Erro ao fazer upload do recibo");
              }
            }

            updateAirbrushing(airbrushingId, {
              receiptFiles: files,
              receiptIds: [...files.filter((f) => f.uploadedFileId).map((f) => f.uploadedFileId!), ...fileIds],
              uploading: false,
            });
          } catch (error) {
            updateAirbrushing(airbrushingId, {
              uploading: false,
              error: "Erro ao fazer upload dos recibos",
            });
            toast.error("Erro ao fazer upload dos recibos");
          }
        } else {
          updateAirbrushing(airbrushingId, {
            receiptFiles: files,
            receiptIds: files.map((f) => f.uploadedFileId!).filter(Boolean),
          });
        }
      },
      [updateAirbrushing],
    );

    const handleNfeFilesChange = useCallback(
      async (airbrushingId: string, files: FileWithPreview[]) => {
        const newFiles = files.filter((f) => !f.uploaded && !f.uploadedFileId);

        if (newFiles.length > 0) {
          updateAirbrushing(airbrushingId, { uploading: true, error: undefined });

          try {
            const fileIds: string[] = [];
            for (const file of newFiles) {
              try {
                const result = await uploadSingleFile(file);
                if (result.success && result.data) {
                  fileIds.push(result.data.id);
                }
              } catch (error) {
                console.error("Failed to upload NFE file:", error);
                toast.error("Erro ao fazer upload da NFe");
              }
            }

            updateAirbrushing(airbrushingId, {
              nfeFiles: files,
              nfeIds: [...files.filter((f) => f.uploadedFileId).map((f) => f.uploadedFileId!), ...fileIds],
              uploading: false,
            });
          } catch (error) {
            updateAirbrushing(airbrushingId, {
              uploading: false,
              error: "Erro ao fazer upload das notas fiscais",
            });
            toast.error("Erro ao fazer upload das notas fiscais");
          }
        } else {
          updateAirbrushing(airbrushingId, {
            nfeFiles: files,
            nfeIds: files.map((f) => f.uploadedFileId!).filter(Boolean),
          });
        }
      },
      [updateAirbrushing],
    );

    const handleArtworkFilesChange = useCallback(
      async (airbrushingId: string, files: FileWithPreview[]) => {
        const newFiles = files.filter((f) => !f.uploaded && !f.uploadedFileId);

        if (newFiles.length > 0) {
          updateAirbrushing(airbrushingId, { uploading: true, error: undefined });

          try {
            const fileIds: string[] = [];
            for (const file of newFiles) {
              try {
                const result = await uploadSingleFile(file);
                if (result.success && result.data) {
                  fileIds.push(result.data.id);
                }
              } catch (error) {
                console.error("Failed to upload artwork file:", error);
                toast.error("Erro ao fazer upload da arte");
              }
            }

            updateAirbrushing(airbrushingId, {
              artworkFiles: files,
              artworkIds: [...files.filter((f) => f.uploadedFileId).map((f) => f.uploadedFileId!), ...fileIds],
              uploading: false,
            });
          } catch (error) {
            updateAirbrushing(airbrushingId, {
              uploading: false,
              error: "Erro ao fazer upload das artes",
            });
            toast.error("Erro ao fazer upload das artes");
          }
        } else {
          updateAirbrushing(airbrushingId, {
            artworkFiles: files,
            artworkIds: files.map((f) => f.uploadedFileId!).filter(Boolean),
          });
        }
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
