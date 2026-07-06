import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAirbrushing, useAirbrushingMutations, useTaskDetail, useUsers } from "../../../../hooks";
import type { AirbrushingCreateFormData, AirbrushingUpdateFormData } from "../../../../schemas";
import { airbrushingCreateSchema, airbrushingUpdateSchema } from "../../../../schemas";
import {
  routes,
  AIRBRUSHING_STATUS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  FAVORITE_PAGES,
} from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { AirbrushingFormFields } from "./airbrushing-form-fields";
import { TaskSelector } from "./task-selector";
import {
  IconSpray,
  IconBrush,
  IconClipboardList,
  IconPaperclip,
  IconFileInvoice,
  IconPhoto,
  IconUser,
  IconBuildingFactory,
  IconHash,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconCalendar,
  IconCurrencyReal,
  IconCreditCard,
} from "@tabler/icons-react";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { LayoutFileUploadField } from "@/components/production/task/form/layout-file-upload-field";
import { createAirbrushingFormData } from "@/utils/form-data-helper";
import { useAuth } from "@/contexts/auth-context";
import { canViewAirbrushingFinancials } from "@/utils/permissions/entity-permissions";
import { formatCurrency, formatDate } from "../../../../utils";

interface AirbrushingFormProps {
  airbrushingId?: string;
  mode: "create" | "edit";
  initialTaskId?: string;
  onSuccess?: (airbrushing: any) => void;
  onCancel?: () => void;
  className?: string;
}

type LayoutStatus = "DRAFT" | "APPROVED" | "REPROVED";

// Three-step wizard definition (mirrors the Order create/edit wizard).
const STEPS = [
  { id: 1, name: "Detalhes", description: "Dados da aerografia e arquivos" },
  { id: 2, name: "Tarefa", description: "Selecione a tarefa vinculada" },
  { id: 3, name: "Revisão", description: "Confirme os dados da aerografia" },
];

// Simple URL-backed step state (mirrors order-edit-form).
const getStepFromUrl = (searchParams: URLSearchParams): number => {
  const step = parseInt(searchParams.get("step") || "1", 10);
  return Math.max(1, Math.min(STEPS.length, Number.isNaN(step) ? 1 : step));
};

const setStepInUrl = (searchParams: URLSearchParams, step: number): URLSearchParams => {
  const params = new URLSearchParams(searchParams);
  params.set("step", step.toString());
  return params;
};

export const AirbrushingForm = ({ airbrushingId, mode, initialTaskId, onSuccess, onCancel, className }: AirbrushingFormProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Money-visibility gate — canonical airbrushing financial permission.
  const { user } = useAuth();
  const canViewFinancials = canViewAirbrushingFinancials(user);

  const isEdit = mode === "edit";

  // Wizard step state (URL-backed).
  const [currentStep, setCurrentStep] = useState<number>(() => getStepFromUrl(searchParams));

  // Task selection (single task).
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));

  // File-upload state (kept outside RHF; uploaded IDs are mirrored into RHF fields).
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<FileWithPreview[]>([]);
  const [layouts, setLayouts] = useState<FileWithPreview[]>([]);
  const [layoutStatuses, setLayoutStatuses] = useState<Record<string, LayoutStatus>>({});

  // Existing airbrushing (edit only).
  const {
    data: airbrushingResponse,
    isLoading: isLoadingAirbrushing,
    isError: isAirbrushingError,
  } = useAirbrushing(airbrushingId || "", {
    include: {
      task: {
        include: {
          customer: { include: { logo: true } },
          sector: true,
        },
      },
      receipts: true,
      invoices: true,
      layouts: true,
      painter: true,
    },
    enabled: isEdit && !!airbrushingId,
  });

  const airbrushing = airbrushingResponse?.data;

  const selectedTaskId = Array.from(selectedTasks)[0];

  // Selected task (create) — used for customer context on uploads + the review summary.
  const { data: selectedTaskResponse } = useTaskDetail(selectedTaskId || "", {
    include: {
      customer: { include: { logo: true } },
      sector: true,
    },
    enabled: !!selectedTaskId,
  });

  // Mutations
  const { createAsync: create, updateAsync: update, isCreating, isUpdating } = useAirbrushingMutations();
  const isSubmitting = isCreating || isUpdating;

  // Single RHF instance shared across every step.
  const formSchema = mode === "create" ? airbrushingCreateSchema : airbrushingUpdateSchema;
  const form = useForm<AirbrushingCreateFormData | AirbrushingUpdateFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
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
      layoutIds: [],
      status: AIRBRUSHING_STATUS.PENDING,
      paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
    },
  });

  // Hydrate the form + local state when editing.
  useEffect(() => {
    if (!isEdit || !airbrushing) return;

    form.reset({
      startDate: airbrushing.startDate ?? null,
      finishDate: airbrushing.finishDate ?? null,
      // startedAt/finishedAt are server-managed timestamps — keep them in state so
      // an update does not wipe them, but they have no form UI.
      startedAt: airbrushing.startedAt ?? null,
      finishedAt: airbrushing.finishedAt ?? null,
      price: airbrushing.price,
      status: airbrushing.status,
      paymentStatus: airbrushing.paymentStatus ?? AIRBRUSHING_PAYMENT_STATUS.PENDING,
      taskId: airbrushing.taskId,
      painterId: airbrushing.painterId ?? null,
      receiptIds: airbrushing.receipts?.map((f) => f.id) || [],
      invoiceIds: airbrushing.invoices?.map((f) => f.id) || [],
      // layoutIds must be File IDs (artwork.fileId or artwork.file.id), not Layout entity IDs
      layoutIds: airbrushing.layouts?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],
    });

    setSelectedTasks(new Set([airbrushing.taskId]));

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

    // layouts are Layout entities with fileId, status, and nested file data
    const layouts: FileWithPreview[] =
      airbrushing.layouts?.map((artwork: any) => {
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
            status: artwork.status || "DRAFT",
          },
        ) as FileWithPreview;
      }) || [];

    const initialStatuses: Record<string, LayoutStatus> = {};
    airbrushing.layouts?.forEach((artwork: any) => {
      const fileId = artwork.fileId || artwork.file?.id || artwork.id;
      if (fileId && artwork.status) {
        initialStatuses[fileId] = artwork.status;
      }
    });
    setLayoutStatuses(initialStatuses);

    setReceiptFiles(receipts);
    setInvoiceFiles(invoices);
    setLayouts(layouts);
  }, [isEdit, airbrushing, form]);

  // On create, seed the task from a ?taskId= deep-link.
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && mode === "create") {
      setSelectedTasks(new Set([taskIdFromUrl]));
      form.setValue("taskId", taskIdFromUrl, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
  }, [searchParams, mode, form]);

  // Keep the local step in sync if the URL changes (back/forward).
  useEffect(() => {
    const stepFromUrl = getStepFromUrl(searchParams);
    if (stepFromUrl !== currentStep) {
      setCurrentStep(stepFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setSearchParams((prev) => setStepInUrl(prev, newStep), { replace: true });
    }
  }, [currentStep, setSearchParams]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setSearchParams((prev) => setStepInUrl(prev, newStep), { replace: true });
    }
  }, [currentStep, setSearchParams]);

  // Task selection (single-select enforced here).
  const handleTaskSelection = useCallback(
    (taskId: string) => {
      const isSelected = selectedTasks.has(taskId);
      if (isSelected) {
        setSelectedTasks(new Set());
        form.setValue("taskId", "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      } else {
        setSelectedTasks(new Set([taskId]));
        form.setValue("taskId", taskId, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
        form.clearErrors("taskId");
      }
    },
    [selectedTasks, form],
  );

  const handleSelectAll = useCallback(() => {
    // No-op: airbrushing links a single task.
  }, []);

  // File change handlers — mirror uploaded (existing) IDs into RHF; new files ride along as FormData.
  const extractUploadedIds = (files: FileWithPreview[]) => files.filter((f) => f.uploaded && f.uploadedFileId).map((f) => f.uploadedFileId!).filter(Boolean);

  const handleReceiptFilesChange = useCallback(
    (files: FileWithPreview[]) => {
      setReceiptFiles(files);
      form.setValue("receiptIds", extractUploadedIds(files));
    },
    [form],
  );

  const handleInvoiceFilesChange = useCallback(
    (files: FileWithPreview[]) => {
      setInvoiceFiles(files);
      form.setValue("invoiceIds", extractUploadedIds(files));
    },
    [form],
  );

  const handleLayoutsChange = useCallback(
    (files: FileWithPreview[]) => {
      setLayouts(files);
      form.setValue("layoutIds", extractUploadedIds(files));

      // Prune statuses for removed files.
      setLayoutStatuses((prev) => {
        const currentFileIds = new Set(files.map((f) => f.uploadedFileId || f.id));
        const next: Record<string, LayoutStatus> = {};
        for (const [fileId, status] of Object.entries(prev)) {
          if (currentFileIds.has(fileId)) next[fileId] = status;
        }
        return next;
      });
    },
    [form],
  );

  const handleLayoutStatusChange = useCallback((fileId: string, status: LayoutStatus) => {
    setLayoutStatuses((prev) => ({ ...prev, [fileId]: status }));
  }, []);

  // Per-step validation gate (mirrors the order wizard's validateCurrentStep switch).
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep) {
      case 1: {
        // Detalhes — all fields optional; only fail on malformed values.
        const ok = await form.trigger(["price", "startDate", "finishDate", "status", "paymentStatus", "painterId"] as any);
        if (!ok) {
          const errors = form.formState.errors as any;
          const firstMsg = errors.price?.message || errors.painterId?.message || errors.startDate?.message || errors.finishDate?.message || "Verifique os dados da aerografia";
          toast.error(firstMsg);
          return false;
        }
        return true;
      }
      case 2: {
        // Tarefa — required. On edit the task is fixed, so this always passes.
        if (selectedTasks.size === 0) {
          form.setError("taskId", { message: "Uma tarefa deve ser selecionada" });
          toast.error("Uma tarefa deve ser selecionada");
          return false;
        }
        form.clearErrors("taskId");
        return true;
      }
      case 3: {
        // Revisão — re-check the task guard then run full validation.
        if (selectedTasks.size === 0) {
          form.setError("taskId", { message: "Uma tarefa deve ser selecionada" });
          toast.error("Uma tarefa deve ser selecionada");
          return false;
        }
        const ok = await form.trigger(["startDate", "finishDate", "price", "taskId", "status", "paymentStatus", "painterId"] as any);
        if (!ok) {
          toast.error("Por favor, corrija os erros no formulário");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }, [currentStep, form, selectedTasks]);

  const handleNext = useCallback(async () => {
    if (await validateCurrentStep()) nextStep();
  }, [validateCurrentStep, nextStep]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (isEdit && airbrushingId) {
      navigate(routes.production.airbrushings.details(airbrushingId));
    } else {
      navigate(routes.production.airbrushings.root);
    }
  }, [onCancel, isEdit, airbrushingId, navigate]);

  // Final submission — preserves the new-vs-existing file split + layoutStatuses payload shape.
  const handleSubmit = useCallback(async () => {
    if (!(await validateCurrentStep())) return;

    try {
      const data = form.getValues();

      const newReceiptFiles = receiptFiles.filter((f) => !f.uploaded);
      const newInvoiceFiles = invoiceFiles.filter((f) => !f.uploaded);
      const newLayouts = layouts.filter((f) => !f.uploaded);

      const existingReceiptIds = receiptFiles.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];
      const existingInvoiceIds = invoiceFiles.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];
      const existingLayoutIds = layouts.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];

      const hasNewFiles = newReceiptFiles.length > 0 || newInvoiceFiles.length > 0 || newLayouts.length > 0;

      // Build layoutStatuses map for existing files.
      const existingLayoutStatusesMap: Record<string, LayoutStatus> = {};
      existingLayoutIds.forEach((fileId) => {
        const statusFromState = layoutStatuses[fileId];
        if (statusFromState) {
          existingLayoutStatusesMap[fileId] = statusFromState;
        } else {
          const file = layouts.find((f) => (f.uploadedFileId || f.id) === fileId);
          existingLayoutStatusesMap[fileId] = (file?.status as LayoutStatus) || "DRAFT";
        }
      });

      let result;

      if (hasNewFiles) {
        const customer = airbrushing?.task?.customer ?? selectedTaskResponse?.data?.customer;
        const customerInfo = customer ? { id: customer.id, name: customer.fantasyName || "" } : undefined;

        const submitData = {
          ...data,
          receiptIds: existingReceiptIds,
          invoiceIds: existingInvoiceIds,
          layoutIds: existingLayoutIds,
          // Wrap in array for FormData serialization (backend preprocess unwraps).
          layoutStatuses: Object.keys(existingLayoutStatusesMap).length > 0 ? [existingLayoutStatusesMap] : undefined,
        };

        const formData = createAirbrushingFormData(
          submitData,
          {
            receipts: newReceiptFiles.length > 0 ? (newReceiptFiles as File[]) : undefined,
            invoices: newInvoiceFiles.length > 0 ? (newInvoiceFiles as File[]) : undefined,
            layouts: newLayouts.length > 0 ? (newLayouts as File[]) : undefined,
          },
          customerInfo,
        );

        result = mode === "create" ? await create(formData as any) : await update({ id: airbrushingId!, data: formData as any });
      } else {
        const submitData = {
          ...data,
          receiptIds: existingReceiptIds,
          invoiceIds: existingInvoiceIds,
          layoutIds: existingLayoutIds,
          layoutStatuses: Object.keys(existingLayoutStatusesMap).length > 0 ? existingLayoutStatusesMap : undefined,
        };

        result = mode === "create" ? await create(submitData as AirbrushingCreateFormData) : await update({ id: airbrushingId!, data: submitData as AirbrushingUpdateFormData });
      }

      // Success toast handled by the API client.
      if (mode === "create") {
        form.reset();
        setReceiptFiles([]);
        setInvoiceFiles([]);
        setLayouts([]);
        setLayoutStatuses({});
        setSelectedTasks(new Set());
      }

      if (onSuccess && result?.data) {
        onSuccess(result.data);
      } else if (result?.data?.id) {
        navigate(routes.production.airbrushings.details(result.data.id));
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting airbrushing form:", error);
      }
      // Error toast handled by the mutation hook.
    }
  }, [validateCurrentStep, form, mode, create, update, airbrushingId, onSuccess, navigate, receiptFiles, invoiceFiles, layouts, layoutStatuses, airbrushing, selectedTaskResponse]);

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;
  const isFormReady = selectedTasks.size === 1;

  // ------- Review-step derived data -------
  const reviewPainterId = form.watch("painterId");
  const { data: painterResponse } = useUsers(
    { where: { id: reviewPainterId || "" }, take: 1, select: { id: true, name: true } },
    { enabled: currentStep === 3 && !!reviewPainterId },
  );
  const reviewPainterName = airbrushing?.painter?.id === reviewPainterId ? airbrushing?.painter?.name : painterResponse?.data?.[0]?.name;

  // Unified task summary source (edit → loaded airbrushing.task; create → selected task).
  const reviewTask = useMemo(() => airbrushing?.task ?? selectedTaskResponse?.data, [airbrushing, selectedTaskResponse]);

  // ------- Header chrome -------
  const title = isEdit
    ? airbrushing
      ? "Editar Aerografia"
      : isLoadingAirbrushing
        ? "Carregando..."
        : "Aerografia não encontrada"
    : "Nova Aerografia";

  const breadcrumbs = [
    { label: "Início", href: routes.home },
    { label: "Produção", href: routes.production.root },
    { label: "Aerografia", href: routes.production.airbrushings.root },
    ...(isEdit && airbrushing
      ? [{ label: `Aerografia #${airbrushing.id.slice(-8)}`, href: routes.production.airbrushings.details(airbrushing.id) }]
      : []),
    { label: isEdit ? "Editar" : "Criar" },
  ];

  const showWizard = !isEdit || (!!airbrushing && !isLoadingAirbrushing && !isAirbrushingError);

  // Navigation actions (owned by the form; matches the order wizard).
  const navigationActions = [];
  navigationActions.push({ key: "cancel", label: "Cancelar", onClick: handleCancel, variant: "outline" as const, disabled: isSubmitting });
  if (showWizard) {
    if (!isFirstStep) {
      navigationActions.push({ key: "previous", label: "Anterior", icon: IconArrowLeft, onClick: prevStep, variant: "outline" as const, disabled: isSubmitting });
    }
    if (!isLastStep) {
      navigationActions.push({ key: "next", label: "Próximo", icon: IconArrowRight, onClick: handleNext, variant: "default" as const, disabled: isSubmitting });
    } else {
      navigationActions.push({
        key: "submit",
        label: isEdit ? "Salvar" : "Cadastrar",
        icon: isSubmitting ? IconLoader2 : IconCheck,
        onClick: handleSubmit,
        variant: "default" as const,
        disabled: isSubmitting || !isFormReady,
        loading: isSubmitting,
      });
    }
  }

  return (
    <div className={cn("h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4", className)}>
      <PageHeader
        className="flex-shrink-0"
        variant="form"
        title={title}
        icon={isEdit ? IconBrush : IconSpray}
        favoritePage={isEdit ? undefined : FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_CADASTRAR}
        breadcrumbs={breadcrumbs}
        actions={navigationActions}
      />

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
          {isEdit && isLoadingAirbrushing ? (
            <div className="flex items-center justify-center flex-1">
              <LoadingSpinner />
            </div>
          ) : isEdit && (isAirbrushingError || !airbrushing) ? (
            <div className="flex items-center justify-center flex-1">
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <p className="text-destructive font-medium">Aerografia não encontrada</p>
                <p className="text-destructive/80 text-sm mt-1">A aerografia solicitada não existe ou você não tem permissão para acessá-la.</p>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form className="flex flex-col h-full" onSubmit={(e) => e.preventDefault()}>
                {/* Stepper */}
                <div className="flex-shrink-0 mb-6">
                  <FormSteps steps={STEPS} currentStep={currentStep} />
                </div>

                {/* Step content — step 2 (task table) takes full height. */}
                <div className={cn("flex-1 min-h-0", currentStep === 2 ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
                  {/* ---------- Step 1: Detalhes ---------- */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <Card className="w-full">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <IconSpray className="h-5 w-5" />
                            Informações da Aerografia
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <AirbrushingFormFields
                            control={form.control}
                            disabled={isSubmitting}
                            initialPainter={airbrushing?.painter ?? undefined}
                            canViewFinancials={canViewFinancials}
                          />
                        </CardContent>
                      </Card>

                      <Card className="w-full">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <IconPaperclip className="h-5 w-5" />
                            Arquivos
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Recibos */}
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

                            {/* Notas Fiscais */}
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

                            {/* Layouts (layouts) with per-file status */}
                            <FormItem className="flex flex-col">
                              <FormLabel className="flex items-center gap-2">
                                <IconPhoto className="h-4 w-4" />
                                Layouts da Aerografia
                              </FormLabel>
                              <FormControl>
                                <LayoutFileUploadField
                                  onFilesChange={handleLayoutsChange}
                                  onStatusChange={handleLayoutStatusChange}
                                  existingFiles={layouts}
                                  maxFiles={20}
                                  showPreview={true}
                                  placeholder="Adicione os layouts da aerografia"
                                  label="Layouts anexados"
                                  variant="list"
                                />
                              </FormControl>
                            </FormItem>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* ---------- Step 2: Tarefa ---------- */}
                  {currentStep === 2 && (
                    <>
                      {isEdit ? (
                        <Card className="w-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconClipboardList className="h-5 w-5" />
                              Tarefa vinculada
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            {reviewTask ? (
                              <>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <IconClipboardList className="h-4 w-4" />
                                    Tarefa
                                  </span>
                                  <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewTask.name || "-"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <IconUser className="h-4 w-4" />
                                    Cliente
                                  </span>
                                  {reviewTask.customer ? (
                                    <div className="flex items-center gap-2 ml-4 min-w-0">
                                      <CustomerLogoDisplay
                                        logo={reviewTask.customer.logo}
                                        customerName={reviewTask.customer.fantasyName || "Cliente"}
                                        size="sm"
                                        shape="rounded"
                                        className="flex-shrink-0"
                                      />
                                      <span className="text-sm font-semibold text-foreground truncate text-right">{reviewTask.customer.fantasyName}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-semibold text-foreground ml-4 text-right">-</span>
                                  )}
                                </div>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <IconBuildingFactory className="h-4 w-4" />
                                    Setor
                                  </span>
                                  <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewTask.sector?.name || "-"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <IconHash className="h-4 w-4" />
                                    Número de Série
                                  </span>
                                  <span className="text-sm font-semibold text-foreground truncate ml-4 text-right font-mono">{reviewTask.serialNumber || "-"}</span>
                                </div>
                                <p className="text-xs text-muted-foreground pt-1">A tarefa vinculada não pode ser alterada após a criação.</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Tarefa não encontrada.</p>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="flex flex-col h-full min-h-0 space-y-4">
                          {form.formState.errors.taskId && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3 flex-shrink-0">
                              <p className="text-sm text-destructive">{form.formState.errors.taskId.message as string}</p>
                            </div>
                          )}
                          <TaskSelector
                            selectedTasks={selectedTasks}
                            onSelectTask={handleTaskSelection}
                            onSelectAll={handleSelectAll}
                            className="flex-1 min-h-0"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* ---------- Step 3: Revisão ---------- */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Revisão da Aerografia</h2>
                        <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de {isEdit ? "salvar" : "cadastrar"}</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Task card */}
                        <Card className="h-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconClipboardList className="h-5 w-5" />
                              Tarefa
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Tarefa</span>
                              <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewTask?.name || "-"}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Cliente</span>
                              <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewTask?.customer?.fantasyName || "-"}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Setor</span>
                              <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewTask?.sector?.name || "-"}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Número de Série</span>
                              <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewTask?.serialNumber || "-"}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Airbrushing card */}
                        <Card className="h-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconSpray className="h-5 w-5" />
                              Aerografia
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Pintor</span>
                              <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{reviewPainterName || "-"}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Status</span>
                              <span className="text-sm font-semibold text-foreground">
                                {AIRBRUSHING_STATUS_LABELS[(form.watch("status") as AIRBRUSHING_STATUS) ?? AIRBRUSHING_STATUS.PENDING] || "-"}
                              </span>
                            </div>

                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <IconCalendar className="h-4 w-4" />
                                Início Previsto
                              </span>
                              <span className="text-sm font-semibold text-foreground">{form.watch("startDate") ? formatDate(form.watch("startDate") as Date) : "-"}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <IconCalendar className="h-4 w-4" />
                                Término Previsto
                              </span>
                              <span className="text-sm font-semibold text-foreground">{form.watch("finishDate") ? formatDate(form.watch("finishDate") as Date) : "-"}</span>
                            </div>

                            {/* Money rows — gated behind canViewAirbrushingFinancials */}
                            {canViewFinancials && (
                              <>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <IconCurrencyReal className="h-4 w-4" />
                                    Preço do Serviço
                                  </span>
                                  <span className="text-sm font-semibold text-primary">{form.watch("price") != null ? formatCurrency(Number(form.watch("price"))) : "-"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <IconCreditCard className="h-4 w-4" />
                                    Status do Pagamento
                                  </span>
                                  <span className="text-sm font-semibold text-foreground">
                                    {AIRBRUSHING_PAYMENT_STATUS_LABELS[(form.watch("paymentStatus") as AIRBRUSHING_PAYMENT_STATUS) ?? AIRBRUSHING_PAYMENT_STATUS.PENDING] || "-"}
                                  </span>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {/* File summary */}
                      <Card className="w-full">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconPaperclip className="h-5 w-5" />
                            Arquivos
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <IconPaperclip className="h-4 w-4" />
                                Recibos
                              </span>
                              <span className="text-sm font-semibold text-foreground">{receiptFiles.length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <IconFileInvoice className="h-4 w-4" />
                                Notas Fiscais
                              </span>
                              <span className="text-sm font-semibold text-foreground">{invoiceFiles.length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <IconPhoto className="h-4 w-4" />
                                Layouts
                              </span>
                              <span className="text-sm font-semibold text-foreground">{layouts.length}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

AirbrushingForm.displayName = "AirbrushingForm";
