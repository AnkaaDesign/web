import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAirbrushing, useAirbrushingMutations, useTaskDetail } from "../../../../hooks";
import type { AirbrushingCreateFormData, AirbrushingUpdateFormData } from "../../../../schemas";
import { airbrushingCreateSchema, airbrushingUpdateSchema } from "../../../../schemas";
import { routes, AIRBRUSHING_STATUS } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { FormSteps, type FormStep } from "@/components/ui/form-steps";
import { AirbrushingFormFields } from "./airbrushing-form-fields";
import { TaskSelector } from "./task-selector";
import { IconSpray, IconCheck, IconFileInvoice, IconClipboardList, IconPhoto } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "../../../../utils";
import type { FileWithPreview } from "@/components/file";

export interface AirbrushingFormHandle {
  handleNext: () => void;
  handlePrev: () => void;
  handleSubmit: () => void;
  getCurrentStep: () => number;
  isLastStep: () => boolean;
  isFirstStep: () => boolean;
  canSubmit: () => boolean;
}

interface AirbrushingFormProps {
  airbrushingId?: string;
  mode: "create" | "edit";
  initialTaskId?: string;
  onSuccess?: (airbrushing: any) => void;
  onCancel?: () => void;
  className?: string;
  onStepChange?: (step: number) => void;
}

// Define steps for the form
const steps: FormStep[] = [
  {
    id: 1,
    name: "Informações Básicas",
    description: "Data, preço e documentos",
  },
  {
    id: 2,
    name: "Seleção de Tarefa",
    description: "Escolha a tarefa relacionada",
  },
  {
    id: 3,
    name: "Revisão",
    description: "Confirme os dados da aerografia",
  },
];

// Helper functions for URL step management
const getStepFromUrl = (searchParams: URLSearchParams): number => {
  const step = parseInt(searchParams.get("step") || "1", 10);
  return Math.max(1, Math.min(3, step));
};

const setStepInUrl = (searchParams: URLSearchParams, step: number): URLSearchParams => {
  const params = new URLSearchParams(searchParams);
  params.set("step", step.toString());
  return params;
};

export const AirbrushingForm = forwardRef<AirbrushingFormHandle, AirbrushingFormProps>(({ airbrushingId, mode, initialTaskId, onSuccess, className, onStepChange }, ref) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize step from URL parameters
  const [currentStep, setCurrentStep] = useState(mode === "edit" ? 1 : getStepFromUrl(searchParams));

  // State for task selection
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));

  // State for step errors
  const [stepErrors, setStepErrors] = useState<{ [key: number]: boolean }>({});

  // State for file uploads
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [nfeFiles, setNfeFiles] = useState<FileWithPreview[]>([]);
  const [artworkFiles, setArtworkFiles] = useState<FileWithPreview[]>([]);
  const [_receiptFileIds, setReceiptFileIds] = useState<string[]>([]);
  const [_nfeFileIds, setNfeFileIds] = useState<string[]>([]);
  const [_artworkFileIds, setArtworkFileIds] = useState<string[]>([]);

  // Fetch existing airbrushing if editing
  const { data: airbrushingResponse, isLoading: isLoadingAirbrushing } = useAirbrushing(airbrushingId || "", {
    include: {
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
      receipts: true,
      nfes: true,
      artworks: true,
    },
    enabled: mode === "edit" && !!airbrushingId,
  });

  const airbrushing = airbrushingResponse?.data;

  // Get selected task for display
  const selectedTaskId = Array.from(selectedTasks)[0];

  // Fetch selected task data for display in review
  const { data: selectedTask } = useTaskDetail(selectedTaskId || "", {
    include: {
      customer: true,
      sector: true,
      services: true,
    },
    enabled: !!selectedTaskId,
  });

  // Mutations
  const { createAsync: create, updateAsync: update, isUpdating } = useAirbrushingMutations();

  // Set up form with appropriate schema
  const formSchema = mode === "create" ? airbrushingCreateSchema : airbrushingUpdateSchema;
  const form = useForm<AirbrushingCreateFormData | AirbrushingUpdateFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      startDate: null,
      finishDate: null,
      price: null,
      taskId: initialTaskId || "",
      receiptIds: [],
      nfeIds: [],
      artworkIds: [],
      ...(mode === "edit" ? {} : { status: AIRBRUSHING_STATUS.PENDING }), // Status is set automatically for create mode
    },
  });

  // Initialize form with existing data when editing
  useEffect(() => {
    if (mode === "edit" && airbrushing) {
      form.reset({
        startDate: airbrushing.startDate ?? null,
        finishDate: airbrushing.finishDate ?? null,
        price: airbrushing.price,
        status: airbrushing.status,
        taskId: airbrushing.taskId,
        receiptIds: airbrushing.receipts?.map((f) => f.id) || [],
        nfeIds: airbrushing.nfes?.map((f) => f.id) || [],
        artworkIds: airbrushing.artworks?.map((f) => f.id) || [],
      });

      // Set selected task
      setSelectedTasks(new Set([airbrushing.taskId]));

      // Set uploaded files
      const receipts: FileWithPreview[] =
        airbrushing.receipts?.map((file) => {
          const fileObj = Object.assign(
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
          return fileObj;
        }) || [];

      const nfes: FileWithPreview[] =
        airbrushing.nfes?.map((file) => {
          const fileObj = Object.assign(
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
          return fileObj;
        }) || [];

      const artworks: FileWithPreview[] =
        airbrushing.artworks?.map((file) => {
          const fileObj = Object.assign(
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
          return fileObj;
        }) || [];

      setReceiptFiles(receipts);
      setNfeFiles(nfes);
      setArtworkFiles(artworks);
      setReceiptFileIds(receipts.map((f) => f.id));
      setNfeFileIds(nfes.map((f) => f.id));
      setArtworkFileIds(artworks.map((f) => f.id));
    }
  }, [mode, airbrushing, form]);

  // Keep step in sync with URL (only for create mode)
  useEffect(() => {
    if (mode === "create") {
      const stepFromUrl = getStepFromUrl(searchParams);
      if (stepFromUrl !== currentStep) {
        setCurrentStep(stepFromUrl);
        // Notify parent about step change
        if (onStepChange) {
          onStepChange(stepFromUrl);
        }
      }
    }
  }, [searchParams, mode, currentStep, onStepChange]);

  // Get initial task ID from URL params
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && mode === "create") {
      setSelectedTasks(new Set([taskIdFromUrl]));
      form.setValue("taskId", taskIdFromUrl);
    }
  }, [searchParams, mode, form]);

  // Navigation helpers
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      if (mode === "create") {
        setSearchParams(setStepInUrl(searchParams, newStep), { replace: true });
      }
      // Notify parent about step change
      if (onStepChange) {
        onStepChange(newStep);
      }
    }
  }, [currentStep, searchParams, setSearchParams, mode, onStepChange]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      if (mode === "create") {
        setSearchParams(setStepInUrl(searchParams, newStep), { replace: true });
      }
      // Notify parent about step change
      if (onStepChange) {
        onStepChange(newStep);
      }
    }
  }, [currentStep, searchParams, setSearchParams, mode, onStepChange]);

  // Stage validation
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep) {
      case 1:
        // Basic info validation - dates and price are optional
        // Trigger validation for step 1 fields
        const step1Fields = ["startDate", "finishDate", "price"] as const;
        const step1Valid = await form.trigger(step1Fields);
        return step1Valid;

      case 2:
        // Validate task selection
        if (selectedTasks.size === 0) {
          form.setError("taskId", { message: "Uma tarefa deve ser selecionada" });
          toast.error("Uma tarefa deve ser selecionada");
          setStepErrors((prev) => ({ ...prev, 2: true }));
          return false;
        }
        form.clearErrors("taskId");
        setStepErrors((prev) => ({ ...prev, 2: false }));
        return true;

      case 3:
        // Final validation
        if (selectedTasks.size === 0) {
          form.setError("taskId", { message: "Uma tarefa deve ser selecionada" });
          toast.error("Uma tarefa deve ser selecionada");
          return false;
        }
        // Validate all fields before submission
        const isValid = await form.trigger();
        return isValid;

      default:
        return true;
    }
  }, [currentStep, selectedTasks, form]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  // Handle task selection
  const handleTaskSelection = (taskId: string) => {
    const isSelected = selectedTasks.has(taskId);

    if (isSelected) {
      // Deselect task
      setSelectedTasks(new Set());
      form.setValue("taskId", "");
    } else {
      // Select task (only one can be selected)
      setSelectedTasks(new Set([taskId]));
      form.setValue("taskId", taskId);
      // Clear task error when a task is selected
      form.clearErrors("taskId");
      // Update step errors
      setStepErrors((prev) => ({ ...prev, 2: false }));
    }
  };

  // Handle select all (not really applicable for single selection)
  const handleSelectAll = () => {
    // No-op for airbrushing form since we only allow one task
  };

  // Handle receipt file changes
  const handleReceiptFilesChange = (files: FileWithPreview[]) => {
    setReceiptFiles(files);
    const fileIds = files.map((f) => f.uploadedFileId || f.id).filter(Boolean);
    setReceiptFileIds(fileIds);
    form.setValue("receiptIds", fileIds);
  };

  // Handle NFe file changes
  const handleNfeFilesChange = (files: FileWithPreview[]) => {
    setNfeFiles(files);
    const fileIds = files.map((f) => f.uploadedFileId || f.id).filter(Boolean);
    setNfeFileIds(fileIds);
    form.setValue("nfeIds", fileIds);
  };

  // Handle artwork file changes
  const handleArtworkFilesChange = (files: FileWithPreview[]) => {
    setArtworkFiles(files);
    const fileIds = files.map((f) => f.uploadedFileId || f.id).filter(Boolean);
    setArtworkFileIds(fileIds);
    form.setValue("artworkIds", fileIds);
  };

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      // Validate final form
      const isValid = await validateCurrentStep();
      if (!isValid) {
        return;
      }

      const data = form.getValues();
      let result;

      if (mode === "create") {
        result = await create(data as AirbrushingCreateFormData);
      } else {
        result = await update({
          id: airbrushingId!,
          data: data as AirbrushingUpdateFormData,
        });
      }

      // Success toast is handled automatically by API client

      if (onSuccess && result) {
        onSuccess(result);
      } else if (result) {
        navigate(routes.production.airbrushings.details(result.data?.id || ""));
      }
    } catch (error) {
      toast.error(`Erro ao ${mode === "create" ? "criar" : "atualizar"} aerografia`);
    }
  }, [validateCurrentStep, form, mode, create, update, airbrushingId, onSuccess, navigate]);

  const isLastStep = currentStep === steps.length;
  const isFirstStep = currentStep === 1;

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      handleNext,
      handlePrev: prevStep,
      handleSubmit,
      getCurrentStep: () => currentStep,
      isLastStep: () => isLastStep,
      isFirstStep: () => isFirstStep,
      canSubmit: () => selectedTasks.size > 0 && form.formState.isValid,
    }),
    [handleNext, prevStep, handleSubmit, currentStep, isLastStep, isFirstStep, selectedTasks, form.formState.isValid],
  );

  // Notify parent about step changes
  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStep);
    }
  }, [currentStep, onStepChange]);

  // Loading state
  if (mode === "edit" && isLoadingAirbrushing) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card className={cn("flex flex-col h-full shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-6">
        <Form {...form}>
          <form className="flex flex-col h-full">
            {/* Step Indicator - only show for create mode */}
            {mode === "create" && (
              <div className="flex-shrink-0 mb-6">
                <FormSteps steps={steps} currentStep={currentStep} stepErrors={stepErrors} />
              </div>
            )}

            {/* Step Content */}
            <div className={cn("flex-1 min-h-0", currentStep === 2 && mode === "create" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
              {/* Step 1: Basic Information */}
              {(mode === "edit" || currentStep === 1) && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconSpray className="h-5 w-5" />
                        Informações da Aerografia
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AirbrushingFormFields
                        control={form.control}
                        mode={mode}
                        receiptFiles={receiptFiles}
                        nfeFiles={nfeFiles}
                        artworkFiles={artworkFiles}
                        onReceiptFilesChange={handleReceiptFilesChange}
                        onNfeFilesChange={handleNfeFilesChange}
                        onArtworkFilesChange={handleArtworkFilesChange}
                        errors={form.formState.errors}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 2: Task Selection (only for create mode) */}
              {currentStep === 2 && mode === "create" && (
                <div className="flex flex-col h-full space-y-4">
                  {/* Task selection error message */}
                  {form.formState.errors.taskId && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 flex-shrink-0">
                      <p className="text-sm text-destructive">{form.formState.errors.taskId.message}</p>
                    </div>
                  )}
                  <TaskSelector selectedTasks={selectedTasks} onSelectTask={handleTaskSelection} onSelectAll={handleSelectAll} className="flex-1 min-h-0" />
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && mode === "create" && (
                <div className="space-y-6">
                  {/* Summary Header */}
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Revisão da Aerografia</h2>
                    <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de finalizar</p>
                  </div>

                  {/* Summary Card - Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <IconSpray className="h-5 w-5" />
                        Informações Básicas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Start Date */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">DATA DE INÍCIO</p>
                          <p className="text-sm font-medium text-foreground">{form.watch("startDate") ? formatDate(form.watch("startDate")!) : "Não informado"}</p>
                        </div>

                        {/* Finish Date */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">DATA DE TÉRMINO</p>
                          <p className="text-sm font-medium text-foreground">{form.watch("finishDate") ? formatDate(form.watch("finishDate")!) : "Não informado"}</p>
                        </div>

                        {/* Price */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">PREÇO</p>
                          <p className="text-sm font-medium text-primary">{form.watch("price") ? formatCurrency(form.watch("price")!) : "Não informado"}</p>
                        </div>
                      </div>

                      {/* Divider */}
                      <Separator className="my-6" />

                      {/* File counts */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">COMPROVANTES</p>
                          </div>
                          <p className="text-2xl font-semibold text-foreground">{receiptFiles.length}</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">NOTAS FISCAIS</p>
                          </div>
                          <p className="text-2xl font-semibold text-foreground">{nfeFiles.length}</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <IconPhoto className="h-4 w-4 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">ARTES</p>
                          </div>
                          <p className="text-2xl font-semibold text-foreground">{artworkFiles.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Task Information */}
                  {selectedTask && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <IconClipboardList className="h-5 w-5" />
                          Tarefa Selecionada
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">NOME DA TAREFA</p>
                            <p className="text-sm font-medium text-foreground">{selectedTask?.data?.name}</p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">CLIENTE</p>
                            <p className="text-sm font-medium text-foreground">{selectedTask?.data?.customer?.fantasyName || "Não informado"}</p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">SETOR</p>
                            <p className="text-sm font-medium text-foreground">{selectedTask?.data?.sector?.name || "Não informado"}</p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">STATUS</p>
                            <Badge variant="outline">{selectedTask?.data?.status}</Badge>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">PRAZO</p>
                            <p className="text-sm font-medium text-foreground">{selectedTask?.data?.term ? formatDate(selectedTask.data.term) : "Não informado"}</p>
                          </div>
                        </div>

                        {/* Services */}
                        {selectedTask?.data?.services && selectedTask.data.services.length > 0 && (
                          <>
                            <Separator className="my-4" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">SERVIÇOS</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedTask.data.services.map((service: any) => (
                                  <Badge key={service.id} variant="secondary">
                                    {service.description}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>

            {/* Form Actions - Only show for edit mode (create mode has actions in page header) */}
            {mode === "edit" && (
              <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                <Button type="button" onClick={handleSubmit} disabled={isUpdating || !form.formState.isValid}>
                  {isUpdating ? <LoadingSpinner className="h-4 w-4 mr-2" /> : <IconCheck className="h-4 w-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
});

AirbrushingForm.displayName = "AirbrushingForm";
