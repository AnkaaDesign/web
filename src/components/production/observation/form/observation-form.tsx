import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useObservation, useObservationMutations, useTasks } from "../../../../hooks";
import type { ObservationCreateFormData, ObservationUpdateFormData } from "../../../../schemas";
import { observationCreateSchema, observationUpdateSchema } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { TaskSelector } from "./task-selector";
import { FormSteps } from "@/components/ui/form-steps";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { IconAlertCircle, IconX, IconFile, IconUser, IconBuildingFactory, IconHash, IconCheck } from "@tabler/icons-react";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { cn, backendFileToFileWithPreview } from "@/lib/utils";
import { toast } from "sonner";
import { createObservationFormData } from "@/utils/form-data-helper";

// Helper function for file size formatting
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Define steps for the multi-step form
const steps = [
  {
    id: 1,
    name: "Detalhes da Observação",
    description: "Descrição e arquivos",
  },
  {
    id: 2,
    name: "Seleção de Tarefa",
    description: "Escolha a tarefa relacionada",
  },
  {
    id: 3,
    name: "Revisão",
    description: "Confirme os dados",
  },
];

// Simple URL step management
const getStepFromUrl = (searchParams: URLSearchParams): number => {
  const step = parseInt(searchParams.get("step") || "1", 10);
  return Math.max(1, Math.min(3, step));
};

const setStepInUrl = (searchParams: URLSearchParams, step: number): URLSearchParams => {
  const params = new URLSearchParams(searchParams);
  params.set("step", step.toString());
  return params;
};

interface ObservationFormProps {
  observationId?: string;
  mode: "create" | "edit";
  initialTaskId?: string;
  onSuccess?: (observation: any) => void;
  onCancel?: () => void;
  className?: string;
  onStepChange?: (step: number) => void;
  onNavigationReady?: (handlers: { handleNext: () => void; handlePrev: () => void }) => void;
}

export function ObservationForm({ observationId, mode, initialTaskId, onSuccess, onCancel: _onCancel, className, onStepChange, onNavigationReady }: ObservationFormProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters (only for create mode)
  const [currentStep, setCurrentStep] = useState(mode === "create" ? getStepFromUrl(searchParams) : 1);

  // State for task selection
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));

  // State for file uploads
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [_uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  // Fetch existing observation if editing
  const { data: observationResponse, isLoading: isLoadingObservation } = useObservation(observationId || "", {
    enabled: mode === "edit" && !!observationId,
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
      files: true,
    },
  });

  const observation = observationResponse?.data;

  // Fetch selected task details for review step
  const selectedTaskId = Array.from(selectedTasks)[0];
  const { data: selectedTaskResponse } = useTasks({
    where: selectedTaskId ? { id: selectedTaskId } : undefined,
    include: {
      customer: true,
      sector: true,
    },
    enabled: !!selectedTaskId,
  });
  const selectedTask = selectedTaskResponse?.data?.[0];

  // Mutations
  const { createAsync, updateAsync } = useObservationMutations();

  // Create a custom schema for the form (without reason field)
  const formCreateSchema = z.object({
    description: z.string().min(1, "Descrição é obrigatória"),
    taskId: z.string().min(1, "Tarefa é obrigatória"),
    fileIds: z.array(z.string()).optional(),
  });

  const formUpdateSchema = z.object({
    description: z.string().min(1, "Descrição é obrigatória").optional(),
    taskId: z.string().optional(),
    fileIds: z.array(z.string()).optional(),
  });

  // Set up form with appropriate schema
  const formSchema = mode === "create" ? formCreateSchema : formUpdateSchema;
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      description: "",
      taskId: initialTaskId || "",
      fileIds: [],
    },
  });

  // Initialize form with existing data when editing
  useEffect(() => {
    if (mode === "edit" && observation) {
      form.reset({
        description: observation.description,
        taskId: observation.taskId,
        fileIds: observation.files?.map((f) => f.id) || [],
      });

      // Set selected task
      setSelectedTasks(new Set([observation.taskId]));

      // Set uploaded files
      const files: FileWithPreview[] = observation.files?.map(backendFileToFileWithPreview) || [];

      setUploadedFiles(files);
      setUploadedFileIds(files.map((f) => f.id));
    }
  }, [mode, observation, form]);

  // Get initial task ID from URL params
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && mode === "create") {
      setSelectedTasks(new Set([taskIdFromUrl]));
      form.setValue("taskId", taskIdFromUrl);
    }
  }, [searchParams, mode, form]);

  // Keep step in sync with URL (only for create mode)
  useEffect(() => {
    if (mode === "create") {
      const stepFromUrl = getStepFromUrl(searchParams);
      if (stepFromUrl !== currentStep) {
        setCurrentStep(stepFromUrl);
      }
    }
  }, [searchParams, mode]);

  // Navigation helpers (only for create mode)
  const nextStep = useCallback(() => {
    if (mode === "create" && currentStep < steps.length) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setSearchParams(setStepInUrl(searchParams, newStep), { replace: true });
      onStepChange?.(newStep);
    }
  }, [mode, currentStep, searchParams, setSearchParams, onStepChange]);

  const prevStep = useCallback(() => {
    if (mode === "create" && currentStep > 1) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setSearchParams(setStepInUrl(searchParams, newStep), { replace: true });
      onStepChange?.(newStep);
    }
  }, [mode, currentStep, searchParams, setSearchParams, onStepChange]);

  // Step validation
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        // Validate observation description
        const description = form.getValues("description");
        if (!description?.trim()) {
          toast.error("Descrição da observação é obrigatória");
          return false;
        }
        if (description.trim().length < 1) {
          toast.error("Descrição deve ter pelo menos 1 caractere");
          return false;
        }
        if (description.length > 1000) {
          toast.error("Descrição deve ter no máximo 1000 caracteres");
          return false;
        }
        return true;

      case 2:
        // Validate task selection
        if (selectedTasks.size === 0) {
          form.setError("taskId", { message: "Uma tarefa deve ser selecionada" });
          toast.error("Uma tarefa deve ser selecionada");
          return false;
        }
        form.clearErrors("taskId");
        return true;

      case 3:
        // Final validation - validate all data
        const finalDescription = form.getValues("description");
        if (!finalDescription?.trim()) {
          toast.error("Descrição da observação é obrigatória");
          return false;
        }
        if (selectedTasks.size === 0) {
          toast.error("Uma tarefa deve ser selecionada");
          return false;
        }
        return true;

      default:
        return true;
    }
  }, [currentStep, form, selectedTasks]);

  // Handle task selection
  const handleTaskSelection = (taskId: string) => {
    const isSelected = selectedTasks.has(taskId);

    if (isSelected) {
      // Deselect task
      setSelectedTasks(new Set());
      form.setValue("taskId", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    } else {
      // Select task (only one can be selected)
      setSelectedTasks(new Set([taskId]));
      form.setValue("taskId", taskId, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      // Clear task error when a task is selected
      form.clearErrors("taskId");
    }
    // Trigger form revalidation to update button state
    form.trigger();
  };

  // Handle select all (not really applicable for single selection)
  const handleSelectAll = () => {
    // No-op for observation form since we only allow one task
  };

  // Handle file changes
  const handleFilesChange = (files: FileWithPreview[]) => {
    setUploadedFiles(files);

    // Filter out files without IDs (newly uploaded files might not have IDs yet)
    const fileIds = files
      .map((f) => f.uploadedFileId || f.id)
      .filter((id): id is string => Boolean(id));

    setUploadedFileIds(fileIds);

    // Update form with file IDs and trigger validation
    form.setValue("fileIds", fileIds, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    // Manually trigger form revalidation to update button state
    form.trigger();
  };

  // Handle form submission
  const handleSubmit = async (data: any) => {
    try {
      // For create mode, validate final step
      if (mode === "create" && !validateCurrentStep()) {
        return;
      }

      // Separate existing files from new files using the 'uploaded' flag
      // Existing files have uploaded=true, new files have uploaded=false
      const existingFileIds = uploadedFiles
        .filter(f => f.uploaded)
        .map(f => f.uploadedFileId || f.id)
        .filter((id): id is string => Boolean(id));

      const newFiles = uploadedFiles
        .filter(f => !f.uploaded && f instanceof File)
        .filter((f): f is File => f instanceof File);

      // Prepare submission data
      const submitData = {
        description: data.description,
        taskId: data.taskId,
        fileIds: existingFileIds,
      };

      let result;

      // If we have new files to upload, use FormData
      if (newFiles.length > 0) {
        // Get customer info for file organization (if available from selected task or observation.task.customer)
        const customerInfo = selectedTask?.customer || observation?.task?.customer ? {
          id: selectedTask?.customer?.id || observation?.task?.customer?.id,
          name: selectedTask?.customer?.fantasyName || observation?.task?.customer?.fantasyName || "",
        } : undefined;

        const formData = createObservationFormData(
          submitData,
          newFiles,
          customerInfo
        );

        if (mode === "create") {
          result = await createAsync(formData as any);
        } else {
          result = await updateAsync({
            id: observationId!,
            data: formData as any,
          });
        }
      } else {
        // No new files, send as JSON
        if (mode === "create") {
          result = await createAsync(submitData);
        } else {
          result = await updateAsync({
            id: observationId!,
            data: submitData,
          });
        }
      }

      // Success toast is handled automatically by API client
      if (onSuccess && result?.data) {
        onSuccess(result.data);
      } else if (result?.data) {
        navigate(routes.production.observations.details(result.data.id));
      }
    } catch (error) {
      // Error handled by API client
    }
  };

  // Handle next button click
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  // Handle previous button click
  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);

  // Expose navigation functions to parent
  useEffect(() => {
    if (onNavigationReady) {
      onNavigationReady({ handleNext, handlePrev });
    }
    if (onStepChange) {
      onStepChange(currentStep);
    }
  }, [handleNext, handlePrev, currentStep, onNavigationReady, onStepChange]);

  // Loading state
  if (mode === "edit" && isLoadingObservation) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // Render different content based on step (only for create mode)
  const renderStepContent = () => {
    // For edit mode, show all fields on one page (no steps)
    if (mode === "edit") {
      return (
        <div className="space-y-4">
          {/* Task Display for Edit Mode */}
          {observation?.task && (
            <div className="border border-border/40 rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium text-muted-foreground mb-3 block">Tarefa Relacionada</Label>
              <div className="space-y-3">
                {/* Task Name */}
                <div>
                  <div className="font-semibold text-base">{observation.task.name}</div>
                </div>

                {/* Task Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Customer with Logo */}
                  {observation.task.customer && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <IconUser className="h-3.5 w-3.5" />
                        <span>Cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CustomerLogoDisplay
                          logo={observation.task.customer.logo}
                          customerName={observation.task.customer.fantasyName || observation.task.customer.name || "Cliente"}
                          size="sm"
                          shape="rounded"
                        />
                        <span className="font-medium text-sm">{observation.task.customer.fantasyName || observation.task.customer.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Sector */}
                  {observation.task.sector && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <IconBuildingFactory className="h-3.5 w-3.5" />
                        <span>Setor</span>
                      </div>
                      <div className="font-medium text-sm">{observation.task.sector.name}</div>
                    </div>
                  )}

                  {/* Serial Number */}
                  {observation.task.serialNumber && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <IconHash className="h-3.5 w-3.5" />
                        <span>Número de Série</span>
                      </div>
                      <div className="font-medium text-sm">{observation.task.serialNumber}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Descrição da Observação <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    placeholder="Descreva detalhadamente o problema ou observação identificada na tarefa..."
                    className="min-h-32 resize-y"
                    maxLength={1000}
                  />
                </FormControl>
                <div className="flex items-center justify-between">
                  <FormMessage />
                  {field.value && (
                    <p className="text-xs text-muted-foreground">
                      {field.value.length}/1000 caracteres
                    </p>
                  )}
                </div>
              </FormItem>
            )}
          />

          {/* File Uploads Section */}
          <div className="space-y-4">
            <Separator />
            <div>
              <Label className="text-sm font-medium">Arquivos de Evidência (Opcional)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Adicione fotos, documentos ou outros arquivos relacionados à observação
              </p>
            </div>

            <div className="space-y-4">
              {/* File Upload Area */}
              <div className="border-2 border-dashed border-border/40 rounded-lg p-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                <FormItem>
                  <FormControl>
                    <FileUploadField
                      onFilesChange={handleFilesChange}
                      existingFiles={uploadedFiles}
                      maxFiles={10}
                      maxSize={10 * 1024 * 1024}
                      showPreview={false}
                      showFiles={false}
                      variant="compact"
                      placeholder="Arraste arquivos aqui ou clique para selecionar"
                      label=""
                    />
                  </FormControl>
                </FormItem>
              </div>

              {/* File List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Arquivos Selecionados ({uploadedFiles.length})
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={file.id || `file-${index}`}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/40 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center">
                          <IconFile className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            const newFiles = uploadedFiles.filter((_, i) => i !== index);
                            handleFilesChange(newFiles);
                          }}
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // For create mode, show multi-step wizard
    switch (currentStep) {
      case 1:
        // Step 1: Observation Details and Files
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconAlertCircle className="h-5 w-5" />
                  Detalhes da Observação
                </CardTitle>
                <CardDescription>
                  Descreva o problema ou observação identificada e adicione arquivos de evidência
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description Field */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Descrição da Observação <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="Descreva detalhadamente o problema ou observação identificada na tarefa..."
                          className="min-h-32 resize-y"
                          maxLength={1000}
                        />
                      </FormControl>
                      <div className="flex items-center justify-between">
                        <FormMessage />
                        {field.value && (
                          <p className="text-xs text-muted-foreground">
                            {field.value.length}/1000 caracteres
                          </p>
                        )}
                      </div>
                    </FormItem>
                  )}
                />

                {/* File Uploads Section */}
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium">Arquivos de Evidência (Opcional)</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adicione fotos, documentos ou outros arquivos relacionados à observação
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* File Upload Area */}
                    <div className="border-2 border-dashed border-border/40 rounded-lg p-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                      <FormItem>
                        <FormControl>
                          <FileUploadField
                            onFilesChange={handleFilesChange}
                            existingFiles={uploadedFiles}
                            maxFiles={10}
                            maxSize={10 * 1024 * 1024}
                            showPreview={false}
                            showFiles={false}
                            variant="compact"
                            placeholder="Arraste arquivos aqui ou clique para selecionar"
                            label=""
                          />
                        </FormControl>
                      </FormItem>
                    </div>

                    {/* File List */}
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Arquivos Selecionados ({uploadedFiles.length})
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {uploadedFiles.map((file, index) => (
                            <div
                              key={file.id || `file-${index}`}
                              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/40 hover:bg-muted/70 transition-colors"
                            >
                              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center">
                                <IconFile className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  const newFiles = uploadedFiles.filter((_, i) => i !== index);
                                  handleFilesChange(newFiles);
                                }}
                              >
                                <IconX className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        // Step 2: Task Selection
        return (
          <div className="flex flex-col h-full space-y-4">
            {/* Task selection error message */}
            {form.formState.errors.taskId && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 flex-shrink-0">
                <p className="text-sm text-destructive">{form.formState.errors.taskId.message}</p>
              </div>
            )}
            <TaskSelector
              selectedTasks={selectedTasks}
              onSelectTask={handleTaskSelection}
              onSelectAll={handleSelectAll}
              className="flex-1 min-h-0"
            />
          </div>
        );

      case 3:
        // Step 3: Review
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconAlertCircle className="h-5 w-5" />
                  Detalhes da Observação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Descrição</div>
                  <div className="p-3 bg-muted/50 rounded-md">
                    {form.getValues("description") || "Nenhuma descrição fornecida"}
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Arquivos ({uploadedFiles.length})
                    </div>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={file.id || `file-${index}`}
                          className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                        >
                          <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconCheck className="h-5 w-5" />
                  Tarefa Selecionada
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTask ? (
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Nome da Tarefa</div>
                      <div className="text-lg font-semibold">{selectedTask.name}</div>
                    </div>
                    {selectedTask.customer && (
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Cliente</div>
                        <div>{selectedTask.customer.fantasyName || selectedTask.customer.name}</div>
                      </div>
                    )}
                    {selectedTask.sector && (
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Setor</div>
                        <div>{selectedTask.sector.name}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">Nenhuma tarefa selecionada</div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("flex flex-col h-full shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
        <Form {...form}>
          <form id="observation-form" onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
            {/* Hidden submit button */}
            <button id="observation-form-submit" type="submit" className="hidden" disabled={form.formState.isSubmitting}>
              Submit
            </button>

            {/* Form Steps Indicator (only show in create mode) */}
            {mode === "create" && (
              <div className="flex-shrink-0 mb-6">
                <FormSteps steps={steps} currentStep={currentStep} />
              </div>
            )}

            {/* Step Content */}
            <div className={cn("flex-1 min-h-0", currentStep === 2 && mode === "create" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
              {renderStepContent()}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
