import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@tabler/icons-react";
import type { Task } from "../../../../types";
import { taskUpdateSchema, type TaskUpdateFormData } from "../../../../schemas";
import { useTaskMutations, useObservationMutations, useCutMutations } from "../../../../hooks";
import { TASK_STATUS, TASK_STATUS_LABELS, CUT_TYPE, CUT_ORIGIN } from "../../../../constants";
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
import { uploadSingleFile } from "../../../../api-client";
import type { ObservationCreateFormData } from "../../../../schemas";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LayoutForm } from "@/components/production/layout/layout-form";
import { useLayoutsByTruck, useLayoutMutations } from "../../../../hooks";

interface TaskEditFormProps {
  task: Task;
}

export const TaskEditForm = ({ task }: TaskEditFormProps) => {
  const { updateAsync } = useTaskMutations();
  const { create: createCut } = useCutMutations();
  const { create: createObservation } = useObservationMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>(task.artworks?.map((f) => f.id) || []);
  const multiCutSelectorRef = useRef<MultiCutSelectorRef>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const multiAirbrushingSelectorRef = useRef<MultiAirbrushingSelectorRef>(null);
  const [airbrushingsCount, setAirbrushingsCount] = useState(0);
  const [selectedLayoutSide, setSelectedLayoutSide] = useState<"left" | "right" | "back">("left");

  // Get truck ID from task - assuming task has truck relation
  const truckId = task.truck?.id || task.truckId;
  const { data: layoutsData } = useLayoutsByTruck(truckId || "", !!truckId);
  const { createOrUpdateTruckLayout } = useLayoutMutations();

  // Observation creation state
  const [isObservationOpen, setIsObservationOpen] = useState(false);
  const [observationDescription, setObservationDescription] = useState("");
  const [observationFiles, setObservationFiles] = useState<FileWithPreview[]>([]);
  const [observationFileIds, setObservationFileIds] = useState<string[]>([]);
  const [isCreatingObservation, setIsCreatingObservation] = useState(false);

  // Group cuts by fileId and type to get proper quantities
  const groupedCuts = (() => {
    if (!task.cuts || task.cuts.length === 0) return [];

    // Create a map to group cuts: key = "fileId|type", value = { fileId, type, quantity, file }
    const cutMap = new Map<string, { fileId: string; type: string; quantity: number; file?: any }>();

    for (const cut of task.cuts) {
      const fileId = cut.file?.id || cut.fileId || "";
      const type = cut.type;
      // Use a unique key that handles empty fileIds (cuts without files)
      const key = `${fileId || 'no-file'}|${type}`;

      if (cutMap.has(key)) {
        // Increment quantity for existing group
        const existing = cutMap.get(key)!;
        existing.quantity += 1;
      } else {
        // Create new group with file metadata for display
        cutMap.set(key, {
          fileId: fileId || "", // Ensure empty string for cuts without files
          type,
          quantity: 1,
          file: cut.file, // Include file object for display in MultiCutSelector
        });
      }
    }

    // Convert map to array
    return Array.from(cutMap.values());
  })();

  // Default values for the form
  const defaultValues: Partial<TaskUpdateFormData> = {
    name: task.name || "",
    status: task.status || TASK_STATUS.PENDING,
    serialNumber: task.serialNumber || null,
    plate: task.plate || null,
    details: task.details || null,
    entryDate: task.entryDate ? new Date(task.entryDate) : null,
    term: task.term ? new Date(task.term) : null,
    startedAt: task.startedAt ? new Date(task.startedAt) : null,
    finishedAt: task.finishedAt ? new Date(task.finishedAt) : null,
    customerId: task.customerId || null,
    sectorId: task.sectorId || null,
    paintId: task.paintId || null,
    // Services MUST be in defaultValues for proper form initialization
    services:
      task.services?.map((so) => ({
        description: so.description || "",
        status: so.status,
        statusOrder: so.statusOrder,
        startedAt: so.startedAt ? new Date(so.startedAt) : null,
        finishedAt: so.finishedAt ? new Date(so.finishedAt) : null,
      })) || [],
    artworkIds: task.artworks?.map((f) => f.id) || [],
    truck: {
      xPosition: task.truck?.xPosition || null,
      yPosition: task.truck?.yPosition || null,
      garageId: task.truck?.garageId || null,
    },
    // Use grouped cuts with proper quantities
    cuts: groupedCuts,
    // Map logo paints to paintIds (array of strings)
    paintIds: task.logoPaints?.map((lp) => lp.id) || [],
    // Initialize airbrushings array for multi-airbrushing selector
    airbrushings:
      task.airbrushings?.map((a) => ({
        startDate: a.startDate ? new Date(a.startDate) : null,
        finishDate: a.finishDate ? new Date(a.finishDate) : null,
        price: a.price,
        status: a.status,
        receiptIds: a.receipts?.map((r) => r.id) || [],
        nfeIds: a.nfes?.map((n) => n.id) || [],
        artworkIds: a.artworks?.map((art) => art.id) || [],
        // Pass full file objects for UI display
        receipts: a.receipts || [],
        nfes: a.nfes || [],
        artworks: a.artworks || [],
      })) || [],
  };

  const form = useForm<TaskUpdateFormData>({
    resolver: zodResolver(taskUpdateSchema),
    mode: "onChange", // Enable real-time validation
    reValidateMode: "onChange", // Re-validate on every change
    criteriaMode: "all", // Show all errors
    defaultValues,
  });

  // Handle file changes and upload
  const handleFilesChange = async (files: FileWithPreview[]) => {
    setUploadedFiles(files);

    // Upload new files that haven't been uploaded yet
    const newFiles = files.filter((file) => !file.uploaded && !file.uploadProgress && !file.error);

    for (const file of newFiles) {
      try {
        // Update file with upload progress
        setUploadedFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: 0, uploaded: false } : f)));

        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            setUploadedFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: progress.percentage } : f)));
          },
        });

        if (result.success && result.data) {
          const uploadedFile = result.data; // Update file with uploaded data
          setUploadedFiles((prev) =>
            prev.map((f) => {
              if (f.id === file.id) {
                const updated = {
                  ...f,
                  uploadedFileId: uploadedFile.id,
                  uploaded: true,
                  uploadProgress: 100,
                  thumbnailUrl: uploadedFile.thumbnailUrl || undefined,
                  error: undefined,
                };
                return updated;
              }
              return f;
            }),
          );

          // Add file ID to the list
          setUploadedFileIds((prev) => [...prev, uploadedFile.id]);
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("File upload error:", error);

        // Update file with error
        setUploadedFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, error: "Erro ao enviar arquivo", uploadProgress: 0, uploaded: false } : f)));
      }
    }
  };

  // Handle observation files
  const handleObservationFilesChange = async (files: FileWithPreview[]) => {
    setObservationFiles(files);

    // Upload new files that haven't been uploaded yet
    const newFiles = files.filter((file) => !file.uploaded && !file.uploadProgress && !file.error);

    for (const file of newFiles) {
      try {
        // Update file with upload progress
        setObservationFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: 0, uploaded: false } : f)));

        const result = await uploadSingleFile(file, {
          onProgress: (progress) => {
            setObservationFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: progress.percentage } : f)));
          },
        });

        if (result.success && result.data) {
          const uploadedFile = result.data;

          // Update file with uploaded data
          setObservationFiles((prev) =>
            prev.map((f) => {
              if (f.id === file.id) {
                return {
                  ...f,
                  uploadedFileId: uploadedFile.id,
                  uploaded: true,
                  uploadProgress: 100,
                  thumbnailUrl: uploadedFile.thumbnailUrl || undefined,
                  error: undefined,
                };
              }
              return f;
            }),
          );

          // Add file ID to the list
          setObservationFileIds((prev) => [...prev, uploadedFile.id]);
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("File upload error:", error);

        // Update file with error
        setObservationFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, error: "Erro ao enviar arquivo", uploadProgress: 0, uploaded: false } : f)));
      }
    }
  };

  // Handle observation creation
  const handleCreateObservation = async () => {
    if (!observationDescription.trim()) {
      toast.error("Descrição da observação é obrigatória");
      return;
    }

    try {
      setIsCreatingObservation(true);

      const observationData: ObservationCreateFormData = {
        description: observationDescription,
        taskId: task.id,
        fileIds: observationFileIds,
      };

      await createObservation(observationData);

      // Success toast is handled automatically by API client
      toast.success("As comissões da tarefa foram suspensas.");

      // Reset observation form
      setObservationDescription("");
      setObservationFiles([]);
      setObservationFileIds([]);
      setIsObservationOpen(false);
    } catch (error) {
      console.error("Error creating observation:", error);
      toast.error("Erro ao criar observação");
    } finally {
      setIsCreatingObservation(false);
    }
  };

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: TaskUpdateFormData) => {
      try {
        setIsSubmitting(true);

        // Additional validation for update (since schema makes fields optional)
        if (!data.name || data.name.trim() === "") {
          form.setError("name", { message: "Nome da tarefa é obrigatório" });
          toast.error("Nome da tarefa é obrigatório");
          setIsSubmitting(false);
          return;
        }

        if (!data.customerId || data.customerId.trim() === "") {
          form.setError("customerId", { message: "Cliente é obrigatório" });
          toast.error("Cliente é obrigatório");
          setIsSubmitting(false);
          return;
        }

        if (!data.services || data.services.length === 0 || data.services.every((s) => !s.description || s.description.trim() === "")) {
          form.setError("services", { message: "Pelo menos um serviço é obrigatório" });
          toast.error("Pelo menos um serviço é obrigatório");
          setIsSubmitting(false);
          return;
        }

        // Use the uploaded file IDs
        const submitData: TaskUpdateFormData = {
          ...data,
          artworkIds: uploadedFileIds,
        };

        const result = await updateAsync({
          id: task.id,
          data: submitData,
        });

        // If there are new cuts, create them for this task
        if (result?.success && data.cuts && data.cuts.length > 0) {
          for (const cutData of data.cuts) {
            if (cutData.fileId && cutData.type) {
              const quantity = cutData.quantity || 1;
              // Create multiple cut records based on quantity
              for (let i = 0; i < quantity; i++) {
                try {
                  await createCut({
                    fileId: cutData.fileId,
                    type: cutData.type as CUT_TYPE,
                    taskId: task.id,
                    origin: CUT_ORIGIN.PLAN, // Cuts created from task form are PLAN
                    status: undefined, // Will use default
                  });
                } catch (error) {
                  console.error(`Error creating cut ${i + 1}:`, error);
                }
              }
            }
          }
        }

        if (result.success) {
          // Navigate to the task detail page
          window.location.href = `/producao/cronograma/detalhes/${task.id}`;
        } else {
          // Log if the result is not successful
          console.error("Task update result:", result);
        }
      } catch (error) {
        console.error("🔴 Error updating task:", error);
        // Error is handled by the mutation hook
      } finally {
        setIsSubmitting(false);
      }
    },
    [updateAsync, task.id, uploadedFileIds],
  );

  const handleCancel = useCallback(() => {
    window.location.href = `/producao/cronograma/detalhes/${task.id}`;
  }, [task.id]);

  // Get form state
  const { formState } = form;

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
      onClick: () => {
        form.handleSubmit(handleSubmit)();
      },
      variant: "default" as const,
      disabled: isSubmitting || !form.formState.isDirty,
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
                            <Textarea {...field} value={field.value || ""} placeholder="Detalhes adicionais sobre a tarefa..." rows={4} disabled={isSubmitting} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Issues & Observations Card */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconAlertCircle className="h-5 w-5" />
                      Problemas e Observações
                      <Badge variant="secondary" className="ml-auto">
                        Opcional
                      </Badge>
                    </CardTitle>
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
                              setObservationFileIds([]);
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
                      <div className="space-y-4">
                        <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                          <div className="space-y-2">
                            <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                              <IconAlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h3 className="text-lg font-semibold">Identificou algum problema?</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                              Crie uma observação para registrar problemas ou questões importantes relacionadas a esta tarefa. Isso irá suspender as comissões automaticamente.
                            </p>
                          </div>
                          <div className="mt-4">
                            <Button type="button" onClick={() => setIsObservationOpen(true)} disabled={isSubmitting} variant="outline">
                              <IconPlus className="h-4 w-4 mr-2" />
                              Criar Observação
                            </Button>
                          </div>
                        </div>

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
                      </div>
                    )}
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

                {/* Layout Section */}
                {truckId ? (
                  <Card className="bg-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconRuler className="h-5 w-5" />
                        Layout do Caminhão
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Layout Side Selector */}
                        <div className="flex gap-2">
                          <Button type="button" variant={selectedLayoutSide === "left" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("left")}>
                            Lateral Esquerda
                            {layoutsData?.leftSideLayout && (
                              <Badge variant="success" className="ml-2">
                                Configurado
                              </Badge>
                            )}
                          </Button>
                          <Button type="button" variant={selectedLayoutSide === "right" ? "default" : "outline"} size="sm" onClick={() => setSelectedLayoutSide("right")}>
                            Lateral Direita
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
                            if (truckId && layoutData) {
                              await createOrUpdateTruckLayout({
                                truckId,
                                side: selectedLayoutSide,
                                data: layoutData,
                              });
                              // Layout dimensions are now managed by the Layout system
                            }
                          }}
                          showPhoto={selectedLayoutSide === "back"}
                          disabled={isSubmitting}
                        />

                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Dica:</strong> As alterações no layout são salvas automaticamente e atualizam as dimensões do caminhão.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconRuler className="h-5 w-5" />
                        Layout do Caminhão
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Alert>
                        <IconAlertCircle className="h-4 w-4" />
                        <AlertTitle>Caminhão não definido</AlertTitle>
                        <AlertDescription>Para configurar o layout, primeiro é necessário associar um caminhão à tarefa.</AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                )}

                {/* Cut Plans Section - Multiple Cuts Support */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconScissors className="h-5 w-5" />
                        Recortes
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

                {/* Paint Selection */}
                <Card className="bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconPalette className="h-5 w-5" />
                      Tintas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* General Painting Selector */}
                    <GeneralPaintingSelector control={form.control} disabled={isSubmitting} />

                    {/* Logo Paints Multi-selector */}
                    <LogoPaintsSelector control={form.control} disabled={isSubmitting} />
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
