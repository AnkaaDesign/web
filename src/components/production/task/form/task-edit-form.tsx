import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEditForm } from "../../../../hooks/useEditForm";
import {
  IconLoader2,
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconCalendar,
  IconPalette,
  IconFile,
  IconRuler,
  IconAlertCircle,
  IconSparkles,
  IconScissors,
  IconPlus,
  IconCurrencyReal,
  IconReceipt,
  IconFileInvoice,
} from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { taskUpdateSchema, type TaskUpdateFormData } from "../../../../schemas";
import { useTaskMutations, useObservationMutations, useCutsByTask } from "../../../../hooks";
import { TASK_STATUS, TASK_STATUS_LABELS, CUT_TYPE } from "../../../../constants";
import { createFormDataWithContext } from "@/utils/form-data-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { SizeInput } from "@/components/ui/size-input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "./customer-selector";
import { SectorSelector } from "./sector-selector";
import { ServiceSelectorFixed } from "./service-selector";
import { MultiCutSelector, type MultiCutSelectorRef } from "./multi-cut-selector";
import { GeneralPaintingSelector } from "./general-painting-selector";
import { LogoPaintsSelector } from "./logo-paints-selector";
import { MultiAirbrushingSelector, type MultiAirbrushingSelectorRef } from "./multi-airbrushing-selector";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { ObservationCreateFormData } from "../../../../schemas";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LayoutForm } from "@/components/production/layout/layout-form";
import { useLayoutsByTruck, useLayoutMutations } from "../../../../hooks";
import { FormMoneyInput } from "@/components/ui/form-money-input";

interface TaskEditFormProps {
  task: Task;
}

// Helper function to convert File entity or array of File entities to FileWithPreview
const convertToFileWithPreview = (file: any | any[] | undefined | null): FileWithPreview[] => {
  if (!file) return [];

  // Handle array of files
  if (Array.isArray(file)) {
    return file.map(f => ({
      id: f.id,
      name: f.filename || f.name || 'file',
      size: f.size || 0,
      type: f.mimetype || f.type || 'application/octet-stream',
      lastModified: f.createdAt ? new Date(f.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: f.id,
      thumbnailUrl: f.thumbnailUrl,
    } as FileWithPreview));
  }

  // Handle single file
  return [{
    id: file.id,
    name: file.filename || file.name || 'file',
    size: file.size || 0,
    type: file.mimetype || file.type || 'application/octet-stream',
    lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
    uploaded: true,
    uploadProgress: 100,
    uploadedFileId: file.id,
    thumbnailUrl: file.thumbnailUrl,
  } as FileWithPreview];
};

export const TaskEditForm = ({ task }: TaskEditFormProps) => {
  const { updateAsync } = useTaskMutations();
  const { create: createObservation } = useObservationMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch cuts separately using useCutsByTask hook (same approach as detail page)
  const { data: cutsData } = useCutsByTask({
    taskId: task.id,
    filters: {
      include: {
        file: true,
      },
    },
  });

  // Initialize artwork files from existing task data
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>(
    (task.artworks || []).map(file => ({
      id: file.id,
      name: file.filename || file.name || 'artwork',
      size: file.size || 0,
      type: file.mimetype || file.type || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview))
  );
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>(task.artworks?.map((f) => f.id) || []);

  // Initialize document files from existing task data
  // Handle both singular and plural field names for backward compatibility
  const [budgetFile, setBudgetFile] = useState<FileWithPreview[]>(
    convertToFileWithPreview((task as any).budgets || task.budget)
  );
  const [nfeFile, setNfeFile] = useState<FileWithPreview[]>(
    convertToFileWithPreview((task as any).invoices || task.nfe)
  );
  const [receiptFile, setReceiptFile] = useState<FileWithPreview[]>(
    convertToFileWithPreview((task as any).receipts || task.receipt)
  );

  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const multiAirbrushingSelectorRef = useRef<MultiAirbrushingSelectorRef>(null);
  const [airbrushingsCount, setAirbrushingsCount] = useState(0);
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false);
  const [hasFileChanges, setHasFileChanges] = useState(false);

  // Get truck ID from task - assuming task has truck relation
  const truckId = task.truck?.id || task.truckId;
  const { data: layoutsData } = useLayoutsByTruck(truckId || "", !!truckId);
  const { createOrUpdateTruckLayout } = useLayoutMutations();

  // Check if any layout exists and open the section automatically
  useEffect(() => {
    if (layoutsData && (layoutsData.leftSideLayout || layoutsData.rightSideLayout || layoutsData.backSideLayout)) {
      setIsLayoutOpen(true);
    }
  }, [layoutsData]);

  // Observation creation state
  const [isObservationOpen, setIsObservationOpen] = useState(false);
  const [observationDescription, setObservationDescription] = useState("");
  const [observationFiles, setObservationFiles] = useState<FileWithPreview[]>([]);
  const [isCreatingObservation, setIsCreatingObservation] = useState(false);

  // Map task data to form values
  const mapDataToForm = useCallback((taskData: Task): TaskUpdateFormData => {
    console.log('[TaskEditForm] mapDataToForm called with task:', taskData);
    console.log('[TaskEditForm] Fetched cuts data:', cutsData);

    // Group cuts by fileId and type to get proper quantities
    // Use cutsData from separate query instead of taskData.cuts
    const cuts = cutsData?.data || [];
    const groupedCuts = (() => {
      if (cuts.length === 0) {
        console.log('[TaskEditForm] No cuts found in fetched data');
        return [];
      }

      console.log('[TaskEditForm] Processing', cuts.length, 'cuts from separate query');
      const cutMap = new Map<string, { fileId: string; type: string; quantity: number; file?: any }>();

      for (const cut of cuts) {
        const fileId = cut.file?.id || cut.fileId || "";
        const type = cut.type;
        const key = `${fileId || 'no-file'}|${type}`;

        if (cutMap.has(key)) {
          const existing = cutMap.get(key)!;
          existing.quantity += 1;
        } else {
          cutMap.set(key, {
            fileId: fileId || "",
            type,
            quantity: 1,
            file: cut.file,
          });
        }
      }

      const grouped = Array.from(cutMap.values());
      console.log('[TaskEditForm] Grouped cuts:', grouped);
      return grouped;
    })();

    console.log('[TaskEditForm] Returning form data with cuts:', groupedCuts);

    return {
      name: taskData.name || "",
      status: taskData.status || TASK_STATUS.PENDING,
      serialNumber: taskData.serialNumber || null,
      plate: taskData.plate || null,
      details: taskData.details || null,
      entryDate: taskData.entryDate ? new Date(taskData.entryDate) : null,
      term: taskData.term ? new Date(taskData.term) : null,
      startedAt: taskData.startedAt ? new Date(taskData.startedAt) : null,
      finishedAt: taskData.finishedAt ? new Date(taskData.finishedAt) : null,
      customerId: taskData.customerId || null,
      sectorId: taskData.sectorId || null,
      generalPaintingId: taskData.paintId || null,
      price: taskData.price || null,
      budgetId: taskData.budgetId || null,
      nfeId: taskData.nfeId || null,
      receiptId: taskData.receiptId || null,
      services:
        taskData.services?.map((so) => ({
          description: so.description || "",
          status: so.status,
          statusOrder: so.statusOrder,
          startedAt: so.startedAt ? new Date(so.startedAt) : null,
          finishedAt: so.finishedAt ? new Date(so.finishedAt) : null,
        })) || [],
      artworkIds: taskData.artworks?.map((f) => f.id) || [],
      truck: {
        xPosition: taskData.truck?.xPosition || null,
        yPosition: taskData.truck?.yPosition || null,
        garageId: taskData.truck?.garageId || null,
      },
      cuts: groupedCuts,
      paintIds: taskData.logoPaints?.map((lp) => lp.id) || [],
      airbrushings:
        taskData.airbrushings?.map((a) => ({
          startDate: a.startDate ? new Date(a.startDate) : null,
          finishDate: a.finishDate ? new Date(a.finishDate) : null,
          price: a.price,
          status: a.status,
          receiptIds: a.receipts?.map((r) => r.id) || [],
          invoiceIds: a.invoices?.map((n) => n.id) || [],
          artworkIds: a.artworks?.map((art) => art.id) || [],
          receipts: a.receipts || [],
          invoices: a.invoices || [],
          artworks: a.artworks || [],
        })) || [],
    } as TaskUpdateFormData;
  }, [cutsData]); // Depend on cutsData to re-run when cuts are fetched

  // Handle form submission with only changed fields
  const handleFormSubmit = useCallback(
    async (changedData: Partial<TaskUpdateFormData>) => {
      try {
        setIsSubmitting(true);

        // DEBUG: Log what fields are in changedData
        console.log('[TaskEditForm] changedData keys:', Object.keys(changedData));
        console.log('[TaskEditForm] changedData:', changedData);

        // Validate that we have changes (form, layout, or file changes)
        if (Object.keys(changedData).length === 0 && !hasLayoutChanges && !hasFileChanges) {
          toast.info("Nenhuma alteração detectada");
          return;
        }

        // If only layout changes exist (no form or file changes), just reload the page
        if (Object.keys(changedData).length === 0 && hasLayoutChanges && !hasFileChanges) {
          setHasLayoutChanges(false);
          window.location.href = `/producao/cronograma/detalhes/${task.id}`;
          return;
        }

        // Check if we have new files that need to be uploaded
        const newBudgetFiles = budgetFile.filter(f => !f.uploaded);
        const newNnvoiceFiles = nfeFile.filter(f => !f.uploaded);
        const newReceiptFiles = receiptFile.filter(f => !f.uploaded);
        const newArtworkFiles = uploadedFiles.filter(f => !f.uploaded);

        // Check for cut files
        const cuts = changedData.cuts as any[] || [];
        const hasCutFiles = cuts.some(cut => cut.file && cut.file instanceof File);

        // Check for airbrushing files
        const airbrushings = changedData.airbrushings as any[] || [];
        const hasAirbrushingFiles = airbrushings.some(a =>
          (a.receiptFiles && a.receiptFiles.some((f: any) => f instanceof File)) ||
          (a.nfeFiles && a.nfeFiles.some((f: any) => f instanceof File)) ||
          (a.artworkFiles && a.artworkFiles.some((f: any) => f instanceof File))
        );

        const hasNewFiles = newBudgetFiles.length > 0 || newNnvoiceFiles.length > 0 ||
                           newReceiptFiles.length > 0 || newArtworkFiles.length > 0 ||
                           hasCutFiles || hasAirbrushingFiles;

        let result;

        if (hasNewFiles) {
          // Get customer data for file organization context
          const customer = task.customer;

          // Prepare files object for the helper
          const files: Record<string, File[]> = {};

          if (newBudgetFiles.length > 0) {
            files.budgets = newBudgetFiles.filter(f => f instanceof File) as File[];
          }
          if (newNnvoiceFiles.length > 0) {
            files.invoices = newNnvoiceFiles.filter(f => f instanceof File) as File[];
          }
          if (newReceiptFiles.length > 0) {
            files.receipts = newReceiptFiles.filter(f => f instanceof File) as File[];
          }
          if (newArtworkFiles.length > 0) {
            files.artworks = newArtworkFiles.filter(f => f instanceof File) as File[];
          }

          // Handle cut files if cuts were changed
          const cuts = changedData.cuts as any[] || [];
          const cutFiles: File[] = [];
          if (cuts.length > 0) {
            const cutsWithContext = cuts.map(cut => {
              if (cut.file && cut.file instanceof File) {
                cutFiles.push(cut.file);
                // Add metadata for file organization
                return {
                  ...cut,
                  _fileContext: {
                    cutType: cut.type === CUT_TYPE.VINYL ? 'vinyl' : 'stencil',
                    customerName: customer?.fantasyName || customer?.corporateName || '',
                  }
                };
              }
              return cut;
            });
            // Update cuts in changedData with context
            changedData.cuts = cutsWithContext;
            if (cutFiles.length > 0) {
              files.cuts = cutFiles;
            }
          }

          // Handle airbrushing files if airbrushings were changed
          const airbrushings = changedData.airbrushings as any[] || [];
          if (airbrushings.length > 0) {
            airbrushings.forEach((airbrushing, index) => {
              // Extract files from airbrushing objects
              if (airbrushing.receiptFiles && Array.isArray(airbrushing.receiptFiles)) {
                const airbrushingReceipts = airbrushing.receiptFiles.filter((f: any) => f instanceof File);
                if (airbrushingReceipts.length > 0) {
                  files[`airbrushings[${index}].receipts`] = airbrushingReceipts;
                }
              }
              if (airbrushing.nfeFiles && Array.isArray(airbrushing.nfeFiles)) {
                const airbrushingNfes = airbrushing.nfeFiles.filter((f: any) => f instanceof File);
                if (airbrushingNfes.length > 0) {
                  files[`airbrushings[${index}].invoices`] = airbrushingNfes;
                }
              }
              if (airbrushing.artworkFiles && Array.isArray(airbrushing.artworkFiles)) {
                const airbrushingArtworks = airbrushing.artworkFiles.filter((f: any) => f instanceof File);
                if (airbrushingArtworks.length > 0) {
                  files[`airbrushings[${index}].artworks`] = airbrushingArtworks;
                }
              }
            });
          }

          // Fields that should NEVER be sent via FormData to avoid huge payloads
          // These are large arrays that bloat the payload size
          const excludedFields = new Set(['cuts', 'airbrushings', 'services', 'paintIds', 'artworkIds', 'budgetIds', 'invoiceIds', 'receiptIds']);

          // Prepare data object with only changed fields (excluding large arrays unless they changed)
          const dataForFormData: Record<string, any> = {};
          let fieldCount = 0;
          Object.entries(changedData).forEach(([key, value]) => {
            // Skip excluded fields (large arrays) - they should only be sent if explicitly updated
            if (excludedFields.has(key)) {
              console.log(`[TaskEditForm] Skipping large field: ${key}`);
              return;
            }

            if (value !== null && value !== undefined) {
              dataForFormData[key] = value;
              fieldCount++;
            }
          });

          // CRITICAL: If no form fields were added but we have files, add a marker field
          // This prevents the body from being undefined, which causes multer to hang
          if (fieldCount === 0) {
            dataForFormData._hasFiles = true;
            console.log('[TaskEditForm] No changed fields - added marker field to prevent empty body');
          }

          console.log('[TaskEditForm] FormData prepared with', fieldCount, 'changed fields and', Object.keys(files).length, 'file types');

          // Use the helper to create FormData with proper context
          const formData = createFormDataWithContext(
            dataForFormData,
            files,
            {
              entityType: 'task',
              entityId: task.id,
              customer: customer ? {
                id: customer.id,
                name: customer.corporateName || customer.fantasyName,
                fantasyName: customer.fantasyName,
              } : undefined,
            }
          );

          result = await updateAsync({
            id: task.id,
            data: formData as any,
            query: {
              include: {
                budgets: true,
                invoices: true,
                receipts: true,
                artworks: true,
              },
            },
          });
        } else {
          // Use regular JSON when no files are present
          const submitData = { ...changedData };

          result = await updateAsync({
            id: task.id,
            data: submitData,
            query: {
              include: {
                budgets: true,
                invoices: true,
                receipts: true,
                artworks: true,
              },
            },
          });
        }

        if (result.success) {
          setHasLayoutChanges(false);
          setHasFileChanges(false);
          // Backend automatically creates changelog entries for changed fields
          // Navigate to the task detail page
          window.location.href = `/producao/cronograma/detalhes/${task.id}`;
        }
      } catch (error) {
        console.error("🔴 Error updating task:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [updateAsync, task.id, hasLayoutChanges, budgetFile, nfeFile, receiptFile, uploadedFiles]
  );

  // Use the edit form hook with change detection
  const { handleSubmitChanges, getChangedFields, ...form } = useEditForm<TaskUpdateFormData, any, Task>({
    resolver: zodResolver(taskUpdateSchema),
    originalData: task,
    onSubmit: handleFormSubmit,
    mapDataToForm,
    formOptions: {
      mode: "onChange",
      reValidateMode: "onChange",
      criteriaMode: "all",
    },
    // Don't send these large arrays if they haven't changed (reduces payload size)
    fieldsToOmitIfUnchanged: ["cuts", "airbrushings", "services", "paintIds"],
  });

  // Debug: Log form values after initialization
  useEffect(() => {
    console.log('[TaskEditForm] Form initialized. Cuts value:', form.getValues('cuts'));
  }, []);

  // Debug: Watch cuts field
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'cuts') {
        console.log('[TaskEditForm] Cuts field changed to:', value.cuts);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Helper to update file in list
  const updateFileInList = (files: FileWithPreview[], fileId: string, updates: Partial<FileWithPreview>) => {
    return files.map((f) => {
      if (f.id === fileId) {
        // Use Object.assign to preserve the File object prototype and properties
        // This keeps all native File properties (size, name, type, lastModified, etc.)
        return Object.assign(f, updates);
      }
      return f;
    });
  };

  // Handle budget file change (no longer uploads immediately)
  const handleBudgetFileChange = (files: FileWithPreview[]) => {
    setBudgetFile(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle NFe file change (no longer uploads immediately)
  const handleNfeFileChange = (files: FileWithPreview[]) => {
    setNfeFile(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle receipt file change (no longer uploads immediately)
  const handleReceiptFileChange = (files: FileWithPreview[]) => {
    setReceiptFile(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle artwork files change (no longer uploads immediately)
  const handleFilesChange = (files: FileWithPreview[]) => {
    setUploadedFiles(files);
    setHasFileChanges(true);
    // Files will be submitted with the form, not uploaded separately
  };

  // Handle observation files (no longer uploads immediately)
  const handleObservationFilesChange = (files: FileWithPreview[]) => {
    setObservationFiles(files);
    // Files will be submitted with the observation creation, not uploaded separately
  };

  // Handle observation creation
  const handleCreateObservation = async () => {
    if (!observationDescription.trim()) {
      toast.error("Descrição da observação é obrigatória");
      return;
    }

    try {
      setIsCreatingObservation(true);

      // Check if we have files to upload
      const newFiles = observationFiles.filter(f => !f.uploaded && f instanceof File);

      if (newFiles.length > 0) {
        // Create FormData when files are present
        const formData = new FormData();
        formData.append('description', observationDescription);
        formData.append('taskId', task.id);

        // Add files
        newFiles.forEach((file) => {
          formData.append('files', file as unknown as Blob);
        });

        // Add existing file IDs if any
        const existingFileIds = observationFiles
          .filter(f => f.uploaded)
          .map(f => (f as any).uploadedFileId || f.id)
          .filter(Boolean);

        if (existingFileIds.length > 0) {
          formData.append('fileIds', JSON.stringify(existingFileIds));
        }

        await createObservation(formData as any);
      } else {
        // No new files, send as regular JSON
        const observationData: ObservationCreateFormData = {
          description: observationDescription,
          taskId: task.id,
          fileIds: observationFiles
            .filter(f => f.uploaded)
            .map(f => (f as any).uploadedFileId || f.id)
            .filter(Boolean),
        };

        await createObservation(observationData);
      }

      // Success toast is handled automatically by API client

      // Reset observation form
      setObservationDescription("");
      setObservationFiles([]);
      setIsObservationOpen(false);
    } catch (error) {
      console.error("Error creating observation:", error);
      // Error handled by API client
    } finally {
      setIsCreatingObservation(false);
    }
  };

  const handleCancel = useCallback(() => {
    window.location.href = `/producao/cronograma/detalhes/${task.id}`;
  }, [task.id]);

  // Watch all form values to trigger re-renders on any change
  // This is CRITICAL - without this, getChangedFields() won't be recalculated
  const formValues = form.watch();

  // Get form state
  const { formState } = form;

  // Check if there are changes (form fields, layout, or files)
  // This will be recalculated on every form value change thanks to form.watch() above
  const hasChanges = Object.keys(getChangedFields()).length > 0 || hasLayoutChanges || hasFileChanges;

  // Navigation actions
  const navigationActions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      icon: IconArrowLeft,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmitChanges(),
      variant: "default" as const,
      disabled: isSubmitting || !hasChanges,
      loading: isSubmitting,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4">
          <PageHeader
            title="Editar Tarefa"
            icon={IconClipboardList}
            variant="form"
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Produção", href: "/producao" },
              { label: "Cronograma", href: "/producao/cronograma" },
              { label: task.name, href: `/producao/cronograma/detalhes/${task.id}` },
              { label: "Editar" },
            ]}
            actions={navigationActions}
          />
        </div>
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-5xl mx-auto px-4 w-full">
        <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            <Form {...form}>
              <form className="space-y-6">
                {/* Basic Information Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5" />
                      Informações Básicas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Name and Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Task Name */}
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Nome da Tarefa <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={(value) => {
                                  field.onChange(value);
                                }}
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Ex: Pintura completa do caminhão"
                                disabled={isSubmitting}
                                className="bg-transparent"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Customer */}
                      <CustomerSelector control={form.control} disabled={isSubmitting} required initialCustomer={task.customer} />
                    </div>

                    {/* Serial Number and Plate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Serial Number */}
                      <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número de Série</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Ex: ABC-123456"
                                className="uppercase bg-transparent"
                                onChange={(value) => field.onChange(typeof value === "string" ? value.toUpperCase() : "")}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Plate (optional) */}
                      <FormField
                        control={form.control}
                        name="plate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Placa</FormLabel>
                            <FormControl>
                              <Input type="plate" {...field} value={field.value || ""} disabled={isSubmitting} className="bg-transparent" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Sector */}
                    <SectorSelector control={form.control} disabled={isSubmitting} productionOnly />

                  {/* Status Field (edit-specific) */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting}
                            options={Object.values(TASK_STATUS).map((status) => ({
                              value: status,
                              label: TASK_STATUS_LABELS[status],
                            }))}
                            placeholder="Selecione o status"
                            searchable={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Details */}
                    <FormField
                      control={form.control}
                      name="details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalhes</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Detalhes adicionais sobre a tarefa..." rows={4} disabled={isSubmitting} className="bg-transparent" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Dates Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCalendar className="h-5 w-5" />
                      Datas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* First Row: Entry Date and Deadline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Entry Date - Date only */}
                      <FormField
                        control={form.control}
                        name="entryDate"
                        render={({ field }) => <DateTimeInput field={field} mode="date" context="start" label="Data de Entrada" disabled={isSubmitting} allowManualInput={true} />}
                      />

                      {/* Deadline - DateTime */}
                      <FormField
                        control={form.control}
                        name="term"
                        render={({ field }) => (
                          <DateTimeInput field={field} mode="datetime" context="due" label="Prazo de Entrega" disabled={isSubmitting} allowManualInput={true} />
                        )}
                      />
                    </div>

                    {/* Second Row: Started At and Finished At */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Started At - DateTime */}
                      <FormField
                        control={form.control}
                        name="startedAt"
                        render={({ field }) => (
                          <DateTimeInput
                            field={field}
                            mode="datetime"
                            context="start"
                            label="Data de Início"
                            disabled={isSubmitting}
                            constraints={{
                              maxDate: new Date(), // Cannot start in the future
                            }}
                            allowManualInput={true}
                          />
                        )}
                      />

                      {/* Finished At - DateTime */}
                      <FormField
                        control={form.control}
                        name="finishedAt"
                        render={({ field }) => (
                          <DateTimeInput
                            field={field}
                            mode="datetime"
                            context="end"
                            label="Data de Conclusão"
                            disabled={isSubmitting}
                            constraints={{
                              maxDate: new Date(), // Cannot finish in the future
                              minDate: form.watch("startedAt") || new Date("1900-01-01"), // Cannot finish before started
                            }}
                            allowManualInput={true}
                          />
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Information Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCurrencyReal className="h-5 w-5" />
                      Informações Financeiras
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Price */}
                    <FormMoneyInput
                      name="price"
                      label="Valor Total"
                      placeholder="R$ 0,00"
                      disabled={isSubmitting}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Budget File */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                          Orçamento
                        </label>
                        <FileUploadField
                          onFilesChange={handleBudgetFileChange}
                          maxFiles={5}
                          disabled={isSubmitting}
                          showPreview={false}
                          existingFiles={budgetFile}
                          variant="compact"
                          placeholder="Adicionar orçamentos"
                          label=""
                        />
                      </div>

                      {/* NFe File */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <IconFile className="h-4 w-4 text-muted-foreground" />
                          Nota Fiscal
                        </label>
                        <FileUploadField
                          onFilesChange={handleNfeFileChange}
                          maxFiles={5}
                          disabled={isSubmitting}
                          showPreview={false}
                          existingFiles={nfeFile}
                          variant="compact"
                          placeholder="Adicionar NFes"
                          label=""
                        />
                      </div>

                      {/* Receipt File */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <IconReceipt className="h-4 w-4 text-muted-foreground" />
                          Recibo
                        </label>
                        <FileUploadField
                          onFilesChange={handleReceiptFileChange}
                          maxFiles={5}
                          disabled={isSubmitting}
                          showPreview={false}
                          existingFiles={receiptFile}
                          variant="compact"
                          placeholder="Adicionar recibos"
                          label=""
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Services Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5" />
                      Serviços <span className="text-destructive">*</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="services"
                      render={() => (
                        <FormItem>
                          <ServiceSelectorFixed control={form.control} disabled={isSubmitting} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Paint Selection (Tintas) */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconPalette className="h-5 w-5" />
                      Tintas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* General Painting Selector */}
                    <GeneralPaintingSelector
                      control={form.control}
                      disabled={isSubmitting}
                      initialPaint={task.generalPainting}
                    />

                    {/* Logo Paints Multi-selector */}
                    <LogoPaintsSelector
                      control={form.control}
                      disabled={isSubmitting}
                      initialPaints={task.logoPaints}
                    />
                  </CardContent>
                </Card>

                {/* Layout Section */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconRuler className="h-5 w-5" />
                        Layout do Caminhão
                      </CardTitle>
                      {!isLayoutOpen && (
                        <Button
                          type="button"
                          onClick={() => setIsLayoutOpen(true)}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Adicionar Layout
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLayoutOpen ? (
                      <div className="space-y-4">
                        {/* Layout Side Selector */}
                        <div className="flex gap-2">
                          <Button type="button" variant={selectedLayoutSide === "left" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("left")}>
                            Motorista
                            {layoutsData?.leftSideLayout && (
                              <Badge variant="success" className="ml-2">
                                Configurado
                              </Badge>
                            )}
                          </Button>
                          <Button type="button" variant={selectedLayoutSide === "right" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("right")}>
                            Sapo
                            {layoutsData?.rightSideLayout && (
                              <Badge variant="success" className="ml-2">
                                Configurado
                              </Badge>
                            )}
                          </Button>
                          <Button type="button" variant={selectedLayoutSide === "back" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("back")}>
                            Traseira
                            {layoutsData?.backSideLayout && (
                              <Badge variant="success" className="ml-2">
                                Configurado
                              </Badge>
                            )}
                          </Button>
                        </div>

                        {/* Layout Form */}
                        <LayoutForm
                          layout={
                            selectedLayoutSide === "left"
                              ? layoutsData?.leftSideLayout
                              : selectedLayoutSide === "right"
                                ? layoutsData?.rightSideLayout
                                : layoutsData?.backSideLayout
                          }
                          onSave={async (layoutData) => {
                            if (layoutData) {
                              // If no truckId exists, the backend will create one
                              const effectiveTruckId = truckId || task.id; // Use task ID as fallback
                              await createOrUpdateTruckLayout({
                                truckId: effectiveTruckId,
                                side: selectedLayoutSide,
                                data: layoutData,
                              });
                              setHasLayoutChanges(true);
                              // Layout dimensions are now managed by the Layout system
                            }
                          }}
                          showPhoto={selectedLayoutSide === "back"}
                          disabled={isSubmitting}
                        />

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsLayoutOpen(false)}
                            disabled={isSubmitting}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Issues & Observations Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconAlertCircle className="h-5 w-5" />
                        Problemas e Observações
                      </CardTitle>
                      {!isObservationOpen && (
                        <Button
                          type="button"
                          onClick={() => setIsObservationOpen(true)}
                          disabled={isSubmitting}
                          size="sm"
                          className="gap-2"
                        >
                          <IconPlus className="h-4 w-4" />
                          Criar Observação
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isObservationOpen ? (
                      <div className="space-y-4">
                        <Alert>
                          <IconAlertCircle className="h-4 w-4" />
                          <AlertTitle>Criar Observação</AlertTitle>
                          <AlertDescription>
                            As observações são registradas quando há problemas ou questões importantes identificadas na tarefa. Criar uma observação irá suspender automaticamente
                            as comissões relacionadas a esta tarefa.
                          </AlertDescription>
                        </Alert>

                        {/* Description Field */}
                        <div className="space-y-2">
                          <Label htmlFor="observation-description">
                            Descrição da Observação <span className="text-destructive">*</span>
                          </Label>
                          <Textarea
                            id="observation-description"
                            value={observationDescription}
                            onChange={(value) => setObservationDescription(typeof value === "string" ? value : "")}
                            placeholder="Descreva detalhadamente o problema ou observação identificada..."
                            className="min-h-32 resize-y"
                            disabled={isCreatingObservation}
                          />
                          <div className="text-xs text-muted-foreground text-right">{observationDescription.length}/1000 caracteres</div>
                        </div>

                        {/* File Upload for Observation */}
                        <div className="space-y-2">
                          <Label>Arquivos da Observação (Opcional)</Label>
                          <FileUploadField
                            onFilesChange={handleObservationFilesChange}
                            existingFiles={observationFiles}
                            maxFiles={5}
                            disabled={isCreatingObservation}
                            showPreview={true}
                            variant="compact"
                            placeholder="Adicione arquivos de evidência"
                            label="Arquivos da observação"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsObservationOpen(false);
                              setObservationDescription("");
                              setObservationFiles([]);
                            }}
                            disabled={isCreatingObservation}
                          >
                            Cancelar
                          </Button>
                          <Button type="button" onClick={handleCreateObservation} disabled={isCreatingObservation || !observationDescription.trim()}>
                            {isCreatingObservation ? (
                              <>
                                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              <>
                                <IconCheck className="h-4 w-4 mr-2" />
                                Criar Observação
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Show existing observations for this task */}
                        {task.observation && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Observações Existentes</Label>
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                                <IconAlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-foreground">{task.observation.description}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Criada em {new Date(task.observation.createdAt).toLocaleDateString("pt-BR")}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Cut Plans Section - Multiple Cuts Support */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconScissors className="h-5 w-5" />
                        Plano de Corte
                      </CardTitle>
                      <Button
                        type="button"
                        onClick={() => {
                          if (multiCutSelectorRef.current) {
                            multiCutSelectorRef.current.addCut();
                          }
                        }}
                        disabled={isSubmitting || cutsCount >= 10}
                        size="sm"
                        className="gap-2"
                      >
                        <IconPlus className="h-4 w-4" />
                        Adicionar Recorte ({cutsCount}/10)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MultiCutSelector ref={multiCutSelectorRef} control={form.control} disabled={isSubmitting} onCutsCountChange={setCutsCount} />
                  </CardContent>
                </Card>

                {/* Airbrushing Section - Multiple Airbrushings Support */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconSparkles className="h-5 w-5" />
                        Aerografias
                      </CardTitle>
                      <Button
                        type="button"
                        onClick={() => {
                          if (multiAirbrushingSelectorRef.current) {
                            multiAirbrushingSelectorRef.current.addAirbrushing();
                          }
                        }}
                        disabled={isSubmitting || airbrushingsCount >= 10}
                        size="sm"
                        className="gap-2"
                      >
                        <IconPlus className="h-4 w-4" />
                        Adicionar Aerografia ({airbrushingsCount}/10)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <MultiAirbrushingSelector ref={multiAirbrushingSelectorRef} control={form.control} disabled={isSubmitting} onAirbrushingsCountChange={setAirbrushingsCount} />
                  </CardContent>
                </Card>

                {/* Artworks Card (optional) */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconFile className="h-5 w-5" />
                      Artes (Opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Edit-specific: Show existing artworks */}
                    {task.artworks && task.artworks.length > 0 && (
                      <div className="mb-4">
                        <Label className="text-sm text-muted-foreground mb-2">Artes Existentes</Label>
                        <div className="space-y-2">
                          {task.artworks.map((file) => (
                            <div key={file.id} className="flex items-center gap-2 text-sm">
                              <IconFile className="h-4 w-4" />
                              <span>{file.filename}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <FileUploadField
                      onFilesChange={handleFilesChange}
                      maxFiles={5}
                      disabled={isSubmitting}
                      showPreview={true}
                      existingFiles={uploadedFiles}
                      variant="compact"
                      placeholder="Adicione artes relacionadas à tarefa"
                      label="Artes anexadas"
                    />
                  </CardContent>
                </Card>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};
