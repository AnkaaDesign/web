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
import { MultiAirbrushingSelector } from "@/components/production/task/form/multi-airbrushing-selector";
import { SelectedTasksSummary, TaskReviewRows } from "@/components/production/task/form/selected-tasks-summary";
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
  IconStack2,
  IconFileTypePdf,
} from "@tabler/icons-react";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { FileUploadField, FileThumbnail, type FileWithPreview } from "@/components/common/file";
import { generatePDFThumbnailFromBlob } from "@/utils/pdf-thumbnail";
import { LayoutFileUploadField } from "@/components/production/task/form/layout-file-upload-field";
import { createAirbrushingFormData } from "@/utils/form-data-helper";
import { createAirbrushingsForTasks, isMeaningfulAirbrushing, type AirbrushingTaskTarget } from "@/utils/airbrushing-submit";
import type { ClusteredTask } from "@/components/production/task/preparation/cluster-tasks";
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

// One empty MultiAirbrushingSelector row to seed create mode (mirrors the cut wizard seeding one
// empty cut). Only meaningful rows are actually created, so a blank seed adds nothing until filled.
const makeEmptyAirbrushing = () => ({
  id: `airbrushing-${Date.now()}`,
  status: AIRBRUSHING_STATUS.PENDING,
  paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
  price: null,
  startDate: null,
  finishDate: null,
  startedAt: null,
  finishedAt: null,
  painterId: null,
  painter: null,
  receiptFiles: [],
  invoiceFiles: [],
  layouts: [],
  receiptIds: [],
  invoiceIds: [],
  layoutIds: [],
});

// Review-step layout preview. Uploaded (server) files reuse FileThumbnail (server thumbnail
// endpoints). A JUST-SELECTED local File has no server id/thumbnail, so we render it client-side:
// images via an object URL, PDFs via pdfjs (generatePDFThumbnailFromBlob) — same as the file picker's
// selected card. EPS/AI and loading states fall back to a typed icon.
const LayoutThumbnail = ({ file }: { file: any }) => {
  const name: string = file?.name || file?.filename || "layout";
  const mimetype: string = file?.type || file?.mimetype || "";
  const isLocal = file instanceof File && !file?.uploaded;
  const isImage = mimetype.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
  const isPdf = mimetype === "application/pdf" || /\.pdf$/i.test(name);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocal) return;
    let cancelled = false;
    let objUrl: string | null = null;
    if (isImage) {
      objUrl = URL.createObjectURL(file);
      setThumb(objUrl);
    } else if (isPdf) {
      generatePDFThumbnailFromBlob(file as Blob).then((url) => {
        if (!cancelled) setThumb(url);
      });
    }
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [file, isLocal, isImage, isPdf]);

  if (isLocal && (isImage || isPdf)) {
    return (
      <div className="w-16">
        <div className="w-16 h-16 rounded-lg border border-border/20 overflow-hidden bg-white flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt={name} className="w-full h-full object-contain" />
          ) : isPdf ? (
            <IconFileTypePdf className="h-6 w-6 text-red-500" />
          ) : (
            <IconPhoto className="h-6 w-6 text-blue-500" />
          )}
        </div>
        <p className="mt-1 text-xs text-foreground leading-tight line-clamp-1" title={name}>
          {name.length > 12 ? `${name.slice(0, 12)}...` : name}
        </p>
      </div>
    );
  }

  // Uploaded (server) file, or local non-previewable (EPS/AI) → FileThumbnail (server thumb or icon).
  return (
    <FileThumbnail
      file={
        {
          id: file?.uploadedFileId || file?.id || name,
          filename: name,
          mimetype,
          size: file?.size || 0,
          thumbnailUrl: file?.thumbnailUrl,
        } as any
      }
      size="md"
      showName
    />
  );
};

// Three-step wizard definition (mirrors the Order create/edit wizard).
const STEPS = [
  { id: 1, name: "Detalhes", description: "Dados da aerografia e arquivos" },
  { id: 2, name: "Tarefas", description: "Selecione uma ou mais tarefas" },
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

  // Task selection. Create → any number of tasks (the config is copied onto each). Edit → the single
  // task the airbrushing already belongs to (locked). `selectedTaskRows` carries the picked rows so
  // submission has each task's customer (file-organization context) without a second fetch.
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));
  const [selectedTaskRows, setSelectedTaskRows] = useState<ClusteredTask[]>([]);

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
  // Stable identity for the one-shot DataTable seed (hygiene/parity with the cut wizard).
  const selectedTaskIdList = useMemo(() => Array.from(selectedTasks), [selectedTasks]);

  // Selected task (create) — used for customer context on uploads + the review summary.
  const { data: selectedTaskResponse } = useTaskDetail(selectedTaskId || "", {
    include: {
      customer: { include: { logo: true } },
      sector: true,
    },
    enabled: !!selectedTaskId,
  });

  // Mutations
  const { updateAsync: update, isCreating, isUpdating, refresh } = useAirbrushingMutations();
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
      // Create-mode multi-config (MultiAirbrushingSelector). Seeded with one empty row.
      airbrushings: mode === "create" ? [makeEmptyAirbrushing()] : [],
    } as any,
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

  // On create, seed the task from a ?taskId= deep-link. MOUNT-ONLY + idempotent: this previously ran on
  // every [searchParams, mode, form] change and unconditionally allocated `new Set(...)` + called
  // form.setValue with shouldDirty/shouldTouch, so it emitted brand-new state on each pass — with the
  // usual entry URL (…/cadastrar?taskId=X) the guard never short-circuited, feeding the render loop.
  // Matches the working cut wizard's mount-only + prev-returning seed.
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && mode === "create") {
      setSelectedTasks((prev) => (prev.has(taskIdFromUrl) && prev.size === 1 ? prev : new Set([taskIdFromUrl])));
      form.setValue("taskId", taskIdFromUrl, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Mirror the DataTable's native (multi-)selection into form state. `taskId` tracks the FIRST
  // selected task purely to satisfy the schema; the actual create fans the config out over every id.
  const handleTaskSelectionChange = useCallback(
    (taskIds: string[], rows: ClusteredTask[]) => {
      // Bail out (return the SAME Set) when the selection content is unchanged so an identical notify
      // can never emit fresh state and re-drive a render. Order-independent to match DataTable's key.
      setSelectedTasks((prev) => {
        const next = new Set(taskIds);
        if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev;
        return next;
      });
      setSelectedTaskRows(rows);
      form.setValue("taskId", taskIds[0] ?? "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      if (taskIds.length > 0) form.clearErrors("taskId");
    },
    [form],
  );

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
        // Create — at least one airbrushing config must carry real data (mirrors the cut wizard's
        // "add at least one cut with a file" gate).
        if (mode === "create") {
          const configs = (form.getValues("airbrushings" as any) ?? []) as any[];
          if (!configs.some(isMeaningfulAirbrushing)) {
            toast.error("Preencha ao menos uma aerografia (pintor, preço, datas ou layouts).");
            return false;
          }
          return true;
        }
        // Edit — all fields optional; only fail on malformed values.
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

      const layoutStatusesMap = Object.keys(existingLayoutStatusesMap).length > 0 ? existingLayoutStatusesMap : undefined;

      // ---------- CREATE: fan the airbrushing config(s) out over every selected task ----------
      // Each MEANINGFUL config × each task = one airbrushing (mirrors the cut wizard's
      // task × plan × quantity fan-out). Config data comes from MultiAirbrushingSelector.
      if (mode === "create") {
        // Resolve each task's customer (file-organization context) from the picked rows, falling back
        // to the single loaded task detail for the first id.
        const targets: AirbrushingTaskTarget[] = Array.from(selectedTasks).map((id) => {
          const row = selectedTaskRows.find((t) => t.id === id);
          const customer = row?.customer ?? (id === selectedTaskId ? selectedTaskResponse?.data?.customer : undefined);
          return { id, customer: customer ? { id: customer.id, name: customer.fantasyName || "" } : undefined };
        });

        const configs = ((data as any).airbrushings ?? []) as any[];
        if (!configs.some(isMeaningfulAirbrushing)) {
          toast.error("Preencha ao menos uma aerografia.");
          setCurrentStep(1);
          setSearchParams((prev) => setStepInUrl(prev, 1), { replace: true });
          return;
        }

        const results = await createAirbrushingsForTasks(targets, configs);
        const created = results.map((r) => r?.data).filter(Boolean);

        refresh(); // one aggregate invalidation (per-item toasts were suppressed)
        toast.success(`${created.length} ${created.length === 1 ? "aerografia criada" : "aerografias criadas"} com sucesso`);

        // Reset the wizard.
        form.reset();
        setReceiptFiles([]);
        setInvoiceFiles([]);
        setLayouts([]);
        setLayoutStatuses({});
        setSelectedTasks(new Set());
        setSelectedTaskRows([]);

        const first = created[0];
        if (onSuccess && first) {
          onSuccess(first);
        } else if (created.length === 1 && first?.id) {
          navigate(routes.production.airbrushings.details(first.id));
        } else {
          navigate(routes.production.airbrushings.root);
        }
        return;
      }

      // ---------- EDIT: single task, single update ----------
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
          layoutStatuses: layoutStatusesMap ? [layoutStatusesMap] : undefined,
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

        result = await update({ id: airbrushingId!, data: formData as any });
      } else {
        const submitData = {
          ...data,
          receiptIds: existingReceiptIds,
          invoiceIds: existingInvoiceIds,
          layoutIds: existingLayoutIds,
          layoutStatuses: layoutStatusesMap,
        };

        result = await update({ id: airbrushingId!, data: submitData as AirbrushingUpdateFormData });
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
  }, [validateCurrentStep, form, mode, update, refresh, airbrushingId, onSuccess, navigate, setSearchParams, receiptFiles, invoiceFiles, layouts, layoutStatuses, airbrushing, selectedTaskResponse, selectedTasks, selectedTaskRows, selectedTaskId]);

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  // ------- Create-mode multi-config review data (mirrors the cut wizard) -------
  const watchedAirbrushings = (form.watch("airbrushings" as any) ?? []) as any[];
  const reviewConfigs = useMemo(() => watchedAirbrushings.filter(isMeaningfulAirbrushing), [watchedAirbrushings]);
  const perTaskAirbrushings = reviewConfigs.length; // meaningful configs per task
  const totalAirbrushings = perTaskAirbrushings * selectedTasks.size;

  // Ready to submit: at least one task, and (create) at least one filled airbrushing config.
  const isFormReady = isEdit ? selectedTasks.size >= 1 : selectedTasks.size >= 1 && reviewConfigs.length >= 1;

  // ------- Review-step derived data -------
  const reviewPainterId = form.watch("painterId");
  const { data: painterResponse } = useUsers(
    { where: { id: reviewPainterId || "" }, take: 1, select: { id: true, name: true } },
    { enabled: currentStep === 3 && !!reviewPainterId },
  );
  const reviewPainterName = airbrushing?.painter?.id === reviewPainterId ? airbrushing?.painter?.name : painterResponse?.data?.[0]?.name;

  // Create-mode: resolve every config's painterId → name for the review (the selector stores only ids).
  const reviewPainterIds = useMemo(
    () => Array.from(new Set(reviewConfigs.map((c) => c.painterId).filter(Boolean))) as string[],
    [reviewConfigs],
  );
  const { data: reviewPaintersResponse } = useUsers(
    { where: { id: { in: reviewPainterIds } }, take: reviewPainterIds.length || 1, select: { id: true, name: true } },
    { enabled: !isEdit && currentStep === 3 && reviewPainterIds.length > 0 },
  );
  const painterNameById = useMemo(() => {
    const map = new Map<string, string>();
    (reviewPaintersResponse?.data ?? []).forEach((u: any) => map.set(u.id, u.name));
    return map;
  }, [reviewPaintersResponse]);

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
                  {/* ---------- Step 1 (create): multi-config aerografias ---------- */}
                  {currentStep === 1 && !isEdit && (
                    <div className="space-y-4">
                      <Card className="w-full">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <IconSpray className="h-5 w-5" />
                            Aerografias
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <MultiAirbrushingSelector
                            control={form.control}
                            disabled={isSubmitting}
                            customerId={selectedTaskResponse?.data?.customer?.id || undefined}
                          />
                        </CardContent>
                      </Card>
                      <p className="text-xs text-muted-foreground px-1">Cada aerografia será criada para cada tarefa selecionada.</p>
                    </div>
                  )}

                  {/* ---------- Step 1 (edit): single airbrushing details + files ---------- */}
                  {currentStep === 1 && isEdit && (
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
                          {/* No pre-emptive "task required" banner — selecting nothing yet is not an
                              error state; the toast on "Próximo" (validateCurrentStep) is the feedback. */}
                          <TaskSelector
                            selectedTaskIds={selectedTaskIdList}
                            onSelectionChange={handleTaskSelectionChange}
                            selectionMode="multiple"
                            className="flex-1 min-h-0"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* ---------- Step 3 (create): multi-config review (mirrors the cut wizard) ---------- */}
                  {currentStep === 3 && !isEdit && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Revisão das Aerografias</h2>
                        <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de cadastrar.</p>
                      </div>

                      {/* Total callout */}
                      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                        <IconStack2 className="h-6 w-6 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {totalAirbrushings} {totalAirbrushings === 1 ? "aerografia será criada" : "aerografias serão criadas"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {perTaskAirbrushings} {perTaskAirbrushings === 1 ? "aerografia" : "aerografias"} por tarefa × {selectedTasks.size}{" "}
                            {selectedTasks.size === 1 ? "tarefa" : "tarefas"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Airbrushing configs card */}
                        <Card className="h-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconSpray className="h-5 w-5" />
                              Aerografias ({perTaskAirbrushings})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {reviewConfigs.length > 0 ? (
                              <div className="space-y-3">
                                {reviewConfigs.map((c, i) => {
                                  const layouts = (c.layouts ?? []) as any[];
                                  const rows: Array<{ icon: JSX.Element; label: string; value: string }> = [
                                    { icon: <IconBrush className="h-4 w-4" />, label: "Pintor", value: (c.painterId && painterNameById.get(c.painterId)) || "-" },
                                    ...(canViewFinancials
                                      ? [{ icon: <IconCurrencyReal className="h-4 w-4" />, label: "Preço", value: c.price != null ? formatCurrency(Number(c.price)) : "-" }]
                                      : []),
                                    { icon: <IconCalendar className="h-4 w-4" />, label: "Início Previsto", value: c.startDate ? formatDate(c.startDate as Date) : "-" },
                                    { icon: <IconCalendar className="h-4 w-4" />, label: "Término Previsto", value: c.finishDate ? formatDate(c.finishDate as Date) : "-" },
                                  ];
                                  return (
                                    <div key={c.id ?? i} className={reviewConfigs.length > 1 ? "rounded-lg border border-border p-3 space-y-2" : "space-y-2"}>
                                      {reviewConfigs.length > 1 && <p className="text-xs font-semibold text-muted-foreground px-1">Aerografia {i + 1}</p>}
                                      {rows.map((r) => (
                                        <div key={r.label} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 h-11 gap-3">
                                          <span className="text-sm text-muted-foreground flex items-center gap-2 flex-shrink-0">
                                            {r.icon}
                                            {r.label}
                                          </span>
                                          <span className="text-sm font-semibold text-foreground truncate text-right min-w-0">{r.value}</span>
                                        </div>
                                      ))}

                                      {/* Layouts — actual previews, not just a count */}
                                      <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
                                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                                          <IconPhoto className="h-4 w-4" />
                                          Layouts ({layouts.length})
                                        </span>
                                        {layouts.length > 0 ? (
                                          <div className="flex flex-wrap gap-2">
                                            {layouts.map((f, li) => (
                                              <LayoutThumbnail key={(f.uploadedFileId || f.id || f.name || li) as string} file={f} />
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">Nenhum layout</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Nenhuma aerografia preenchida.</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Tasks card — shared summary component */}
                        <Card className="h-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconClipboardList className="h-5 w-5" />
                              Tarefas ({selectedTasks.size})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <SelectedTasksSummary tasks={selectedTaskRows} />
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* ---------- Step 3 (edit): single airbrushing review ---------- */}
                  {currentStep === 3 && isEdit && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Revisão da Aerografia</h2>
                        <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de salvar</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Task card — the single linked task (shared review rows). */}
                        <Card className="h-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconClipboardList className="h-5 w-5" />
                              Tarefa
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <TaskReviewRows task={reviewTask as any} />
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
