import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAirbrushing, useAirbrushingMutations, useTaskDetail } from "../../../../hooks";
import type { AirbrushingCreateFormData, AirbrushingUpdateFormData } from "../../../../schemas";
import { airbrushingCreateSchema, airbrushingUpdateSchema } from "../../../../schemas";
import { routes, AIRBRUSHING_STATUS, AIRBRUSHING_PAYMENT_STATUS } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading";
import { AirbrushingFormFields } from "./airbrushing-form-fields";
import { TaskSelector } from "./task-selector";
import { IconSpray, IconClipboardList, IconPaperclip, IconFileInvoice, IconPhoto, IconUser, IconBuildingFactory, IconHash } from "@tabler/icons-react";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { ArtworkFileUploadField } from "@/components/production/task/form/artwork-file-upload-field";
import { createAirbrushingFormData } from "@/utils/form-data-helper";

export interface AirbrushingFormHandle {
  handleSubmit: () => Promise<boolean>;
  canSubmit: () => boolean;
}

interface AirbrushingFormProps {
  airbrushingId?: string;
  mode: "create" | "edit";
  initialTaskId?: string;
  onSuccess?: (airbrushing: any) => void;
  onCancel?: () => void;
  className?: string;
  onFormStateChange?: () => void; // Callback to notify parent of form state changes
}

export const AirbrushingForm = forwardRef<AirbrushingFormHandle, AirbrushingFormProps>(({ airbrushingId, mode, initialTaskId, onSuccess, className, onFormStateChange }, ref) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State for task selection
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));

  // State for file uploads
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<FileWithPreview[]>([]);
  const [artworkFiles, setArtworkFiles] = useState<FileWithPreview[]>([]);

  // State for artwork statuses (keyed by file ID)
  const [artworkStatuses, setArtworkStatuses] = useState<Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'>>({});

  // Fetch existing airbrushing if editing
  const { data: airbrushingResponse, isLoading: isLoadingAirbrushing } = useAirbrushing(airbrushingId || "", {
    include: {
      task: {
        include: {
          customer: {
            include: {
              logo: true,
            },
          },
          sector: true,
        },
      },
      receipts: true,
      invoices: true,
      artworks: true,
      painter: true,
    },
    enabled: mode === "edit" && !!airbrushingId,
  });

  const airbrushing = airbrushingResponse?.data;

  // Get selected task for display
  const selectedTaskId = Array.from(selectedTasks)[0];

  // Fetch selected task data (used for customer context on file uploads)
  const { data: selectedTask } = useTaskDetail(selectedTaskId || "", {
    include: {
      customer: true,
      sector: true,
    },
    enabled: !!selectedTaskId,
  });

  // Mutations
  const { createAsync: create, updateAsync: update, isCreating, isUpdating } = useAirbrushingMutations();
  const isSubmitting = isCreating || isUpdating;

  // Set up form with appropriate schema
  const formSchema = mode === "create" ? airbrushingCreateSchema : airbrushingUpdateSchema;
  const form = useForm<AirbrushingCreateFormData | AirbrushingUpdateFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      startDate: null,
      finishDate: null,
      startedAt: null,
      finishedAt: null,
      price: null,
      taskId: initialTaskId || "",
      painterId: null,
      receiptIds: [],
      invoiceIds: [],
      artworkIds: [],
      status: AIRBRUSHING_STATUS.PENDING,
      paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
    },
  });

  // Initialize form with existing data when editing
  useEffect(() => {
    if (mode === "edit" && airbrushing) {
      form.reset({
        startDate: airbrushing.startDate ?? null,
        finishDate: airbrushing.finishDate ?? null,
        startedAt: airbrushing.startedAt ?? null,
        finishedAt: airbrushing.finishedAt ?? null,
        price: airbrushing.price,
        status: airbrushing.status,
        paymentStatus: airbrushing.paymentStatus ?? AIRBRUSHING_PAYMENT_STATUS.PENDING,
        taskId: airbrushing.taskId,
        painterId: airbrushing.painterId ?? null,
        receiptIds: airbrushing.receipts?.map((f) => f.id) || [],
        invoiceIds: airbrushing.invoices?.map((f) => f.id) || [],
        // artworkIds must be File IDs (artwork.fileId or artwork.file.id), not Artwork entity IDs
        artworkIds: airbrushing.artworks?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],
      });

      // Set selected task
      setSelectedTasks(new Set([airbrushing.taskId]));

      // Set uploaded files
      const mapFile = (file: any): FileWithPreview =>
        Object.assign(
          new File([new ArrayBuffer(0)], file.filename || file.originalName || "file", {
            type: file.mimetype || "application/octet-stream",
            lastModified: new Date(file.createdAt || Date.now()).getTime(),
          }),
          {
            id: file.id,
            uploaded: true,
            uploadedFileId: file.id,
            thumbnailUrl: file.thumbnailUrl,
          },
        ) as FileWithPreview;

      const receipts: FileWithPreview[] = airbrushing.receipts?.map(mapFile) || [];
      const invoices: FileWithPreview[] = airbrushing.invoices?.map(mapFile) || [];

      // artworks are Artwork entities with fileId, status, and nested file data
      const artworks: FileWithPreview[] =
        airbrushing.artworks?.map((artwork: any) => {
          const file = artwork.file || artwork;
          const fileId = artwork.fileId || file.id;
          return Object.assign(
            new File([new ArrayBuffer(0)], file.filename || file.originalName || "file", {
              type: file.mimetype || "application/octet-stream",
              lastModified: new Date(file.createdAt || Date.now()).getTime(),
            }),
            {
              id: fileId,
              uploaded: true,
              uploadedFileId: fileId,
              thumbnailUrl: file.thumbnailUrl,
              status: artwork.status || 'DRAFT', // Include artwork status
            },
          ) as FileWithPreview;
        }) || [];

      // Initialize artwork statuses from existing artworks
      const initialStatuses: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
      airbrushing.artworks?.forEach((artwork: any) => {
        const fileId = artwork.fileId || artwork.file?.id || artwork.id;
        if (fileId && artwork.status) {
          initialStatuses[fileId] = artwork.status;
        }
      });
      setArtworkStatuses(initialStatuses);

      setReceiptFiles(receipts);
      setInvoiceFiles(invoices);
      setArtworkFiles(artworks);
    }
  }, [mode, airbrushing, form]);

  // Get initial task ID from URL params
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && mode === "create") {
      setSelectedTasks(new Set([taskIdFromUrl]));
      form.setValue("taskId", taskIdFromUrl, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
  }, [searchParams, mode, form]);

  // Handle task selection
  const handleTaskSelection = (taskId: string) => {
    const isSelected = selectedTasks.has(taskId);

    if (isSelected) {
      // Deselect task
      setSelectedTasks(new Set());
      form.setValue("taskId", "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } else {
      // Select task (only one can be selected)
      setSelectedTasks(new Set([taskId]));
      form.setValue("taskId", taskId, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      form.clearErrors("taskId");
    }
  };

  // Handle select all (not really applicable for single selection)
  const handleSelectAll = () => {
    // No-op for airbrushing form since we only allow one task
  };

  // File change handlers - only include IDs of already uploaded files (valid UUIDs);
  // new files are sent as FormData during submission
  const extractUploadedIds = (files: FileWithPreview[]) =>
    files.filter((f) => f.uploaded && f.uploadedFileId).map((f) => f.uploadedFileId!).filter(Boolean);

  const handleReceiptFilesChange = (files: FileWithPreview[]) => {
    setReceiptFiles(files);
    form.setValue("receiptIds", extractUploadedIds(files));
  };

  const handleInvoiceFilesChange = (files: FileWithPreview[]) => {
    setInvoiceFiles(files);
    form.setValue("invoiceIds", extractUploadedIds(files));
  };

  const handleArtworkFilesChange = (files: FileWithPreview[]) => {
    setArtworkFiles(files);
    form.setValue("artworkIds", extractUploadedIds(files));

    // Clean up artworkStatuses: remove statuses for files that have been removed
    setArtworkStatuses((prev) => {
      const currentFileIds = new Set(files.map((f) => f.uploadedFileId || f.id));
      const newStatuses: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
      for (const [fileId, status] of Object.entries(prev)) {
        if (currentFileIds.has(fileId)) {
          newStatuses[fileId] = status;
        }
      }
      return newStatuses;
    });
  };

  // Handle artwork status change
  const handleArtworkStatusChange = (fileId: string, status: 'DRAFT' | 'APPROVED' | 'REPROVED') => {
    setArtworkStatuses((prev) => ({
      ...prev,
      [fileId]: status,
    }));
  };

  // Validate the form (skips file ID fields - new files don't have valid UUIDs yet)
  const validateForm = useCallback(async (): Promise<boolean> => {
    if (selectedTasks.size === 0) {
      form.setError("taskId", { message: "Uma tarefa deve ser selecionada" });
      toast.error("Uma tarefa deve ser selecionada");
      return false;
    }
    form.clearErrors("taskId");

    const fieldsToValidate = ["startDate", "finishDate", "startedAt", "finishedAt", "price", "taskId", "status", "paymentStatus"] as const;
    return form.trigger(fieldsToValidate as any);
  }, [selectedTasks, form]);

  // Handle form submission
  // Returns true on success, false on validation failure, throws on error
  const handleSubmit = useCallback(async (): Promise<boolean> => {
    const isValid = await validateForm();

    if (!isValid) {
      return false;
    }

    try {
      const data = form.getValues();

      // Separate existing files from new files using the 'uploaded' flag
      const newReceiptFiles = receiptFiles.filter((f) => !f.uploaded);
      const newInvoiceFiles = invoiceFiles.filter((f) => !f.uploaded);
      const newArtworkFiles = artworkFiles.filter((f) => !f.uploaded);

      // Get IDs of existing files to keep
      const existingReceiptIds = receiptFiles.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];
      const existingInvoiceIds = invoiceFiles.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];
      const existingArtworkIds = artworkFiles.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];

      const hasNewFiles = newReceiptFiles.length > 0 || newInvoiceFiles.length > 0 || newArtworkFiles.length > 0;

      let result;

      // Build artworkStatuses map for existing files
      const existingArtworkStatusesMap: Record<string, 'DRAFT' | 'APPROVED' | 'REPROVED'> = {};
      existingArtworkIds.forEach((fileId) => {
        const statusFromState = artworkStatuses[fileId];
        if (statusFromState) {
          existingArtworkStatusesMap[fileId] = statusFromState;
        } else {
          const file = artworkFiles.find((f) => (f.uploadedFileId || f.id) === fileId);
          const statusFromFile = file?.status;
          existingArtworkStatusesMap[fileId] = (statusFromFile as 'DRAFT' | 'APPROVED' | 'REPROVED') || 'DRAFT';
        }
      });

      if (hasNewFiles) {
        const customerInfo = selectedTask?.data?.customer
          ? {
              id: selectedTask.data.customer.id,
              name: selectedTask.data.customer.fantasyName || "",
            }
          : undefined;

        // Prepare data with existing file IDs and artwork statuses
        const submitData = {
          ...data,
          receiptIds: existingReceiptIds,
          invoiceIds: existingInvoiceIds,
          artworkIds: existingArtworkIds,
          // Wrap artworkStatuses in array for FormData serialization (backend preprocess handles it)
          artworkStatuses: Object.keys(existingArtworkStatusesMap).length > 0 ? [existingArtworkStatusesMap] : undefined,
        };

        const formData = createAirbrushingFormData(
          submitData,
          {
            receipts: newReceiptFiles.length > 0 ? (newReceiptFiles as File[]) : undefined,
            invoices: newInvoiceFiles.length > 0 ? (newInvoiceFiles as File[]) : undefined,
            artworks: newArtworkFiles.length > 0 ? (newArtworkFiles as File[]) : undefined,
          },
          customerInfo,
        );

        if (mode === "create") {
          result = await create(formData as any);
        } else {
          result = await update({
            id: airbrushingId!,
            data: formData as any,
          });
        }
      } else {
        // Even without new files, we need to send the IDs of existing files to keep
        const submitData = {
          ...data,
          receiptIds: existingReceiptIds,
          invoiceIds: existingInvoiceIds,
          artworkIds: existingArtworkIds,
          // Include artworkStatuses as a plain object for JSON submission
          artworkStatuses: Object.keys(existingArtworkStatusesMap).length > 0 ? existingArtworkStatusesMap : undefined,
        };

        if (mode === "create") {
          result = await create(submitData as AirbrushingCreateFormData);
        } else {
          result = await update({
            id: airbrushingId!,
            data: submitData as AirbrushingUpdateFormData,
          });
        }
      }

      // Success toast is handled automatically by API client

      // Reset form state after successful creation
      if (mode === "create") {
        form.reset();
        setReceiptFiles([]);
        setInvoiceFiles([]);
        setArtworkFiles([]);
        setArtworkStatuses({});
        setSelectedTasks(new Set());
      }

      if (onSuccess && result?.data) {
        onSuccess(result.data);
      } else if (result?.data?.id) {
        navigate(routes.production.airbrushings.details(result.data.id));
      }

      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting airbrushing form:", error);
      }
      throw error; // Rethrow so parent can handle
    }
  }, [validateForm, form, mode, create, update, airbrushingId, onSuccess, navigate, receiptFiles, invoiceFiles, artworkFiles, artworkStatuses, selectedTask]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      handleSubmit,
      canSubmit: () => selectedTasks.size > 0,
    }),
    [handleSubmit, selectedTasks],
  );

  // Notify parent about form state changes (file changes, task selection changes)
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange();
    }
  }, [receiptFiles, invoiceFiles, artworkFiles, selectedTasks, onFormStateChange]);

  // Loading state
  if (mode === "edit" && isLoadingAirbrushing) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form className={cn("space-y-4", className)} onSubmit={(e) => e.preventDefault()}>
        {/* Task Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconClipboardList className="h-5 w-5" />
              Tarefa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "edit" && airbrushing?.task ? (
              <div className="space-y-3">
                {/* Task Name */}
                <div className="font-semibold text-base">{airbrushing.task.name}</div>

                {/* Task Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Customer with Logo */}
                  {airbrushing.task.customer && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <IconUser className="h-3.5 w-3.5" />
                        <span>Cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CustomerLogoDisplay
                          logo={airbrushing.task.customer.logo}
                          customerName={airbrushing.task.customer.fantasyName || "Cliente"}
                          size="sm"
                          shape="rounded"
                        />
                        <span className="font-medium text-sm">{airbrushing.task.customer.fantasyName}</span>
                      </div>
                    </div>
                  )}

                  {/* Sector */}
                  {airbrushing.task.sector && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <IconBuildingFactory className="h-3.5 w-3.5" />
                        <span>Setor</span>
                      </div>
                      <div className="font-medium text-sm">{airbrushing.task.sector.name}</div>
                    </div>
                  )}

                  {/* Serial Number */}
                  {airbrushing.task.serialNumber && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <IconHash className="h-3.5 w-3.5" />
                        <span>Número de Série</span>
                      </div>
                      <div className="font-medium text-sm">{airbrushing.task.serialNumber}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Task selection error message */}
                {form.formState.errors.taskId && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
                    <p className="text-sm text-destructive">{form.formState.errors.taskId.message as string}</p>
                  </div>
                )}
                <div className="h-[480px] flex flex-col">
                  <TaskSelector selectedTasks={selectedTasks} onSelectTask={handleTaskSelection} onSelectAll={handleSelectAll} className="flex-1 min-h-0" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basic Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSpray className="h-5 w-5" />
              Informações da Aerografia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AirbrushingFormFields control={form.control} disabled={isSubmitting} initialPainter={airbrushing?.painter ?? undefined} />
          </CardContent>
        </Card>

        {/* Files Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconPaperclip className="h-5 w-5" />
              Arquivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Receipt Files */}
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-2">
                  <IconPaperclip className="h-4 w-4" />
                  Recibos
                </FormLabel>
                <FormControl>
                  <FileUploadField
                    onFilesChange={handleReceiptFilesChange}
                    existingFiles={receiptFiles}
                    maxFiles={10}
                    showPreview={true}
                    variant="compact"
                    placeholder="Adicione recibos do serviço"
                    label="Recibos anexados"
                    disabled={isSubmitting}
                  />
                </FormControl>
              </FormItem>

              {/* NFe Files */}
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-2">
                  <IconFileInvoice className="h-4 w-4" />
                  Notas Fiscais
                </FormLabel>
                <FormControl>
                  <FileUploadField
                    onFilesChange={handleInvoiceFilesChange}
                    existingFiles={invoiceFiles}
                    maxFiles={10}
                    showPreview={true}
                    variant="compact"
                    placeholder="Adicione notas fiscais"
                    label="NFes anexadas"
                    disabled={isSubmitting}
                  />
                </FormControl>
              </FormItem>

              {/* Artwork Files with Status Selector */}
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-2">
                  <IconPhoto className="h-4 w-4" />
                  Layouts da Aerografia
                </FormLabel>
                <FormControl>
                  <ArtworkFileUploadField
                    onFilesChange={handleArtworkFilesChange}
                    onStatusChange={handleArtworkStatusChange}
                    existingFiles={artworkFiles}
                    maxFiles={20}
                    showPreview={true}
                    placeholder="Adicione os layouts da aerografia"
                    label="Layouts anexados"
                  />
                </FormControl>
              </FormItem>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
});

AirbrushingForm.displayName = "AirbrushingForm";
