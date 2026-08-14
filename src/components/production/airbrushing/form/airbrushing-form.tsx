import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  AIRBRUSHING_DUE_DATE_RULE,
  FAVORITE_PAGES,
} from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { AirbrushingFormFields } from "./airbrushing-form-fields";
import type { AirbrushingFieldValues } from "./airbrushing-fields";
import { buildAirbrushingReviewSections, AirbrushingReviewRows, AirbrushingLayoutPreviews } from "./airbrushing-review-rows";
import { TaskSelector } from "./task-selector";
import { MultiAirbrushingSelector } from "@/components/production/task/form/multi-airbrushing-selector";
import { SelectedTasksSummary, TaskReviewRows } from "@/components/production/task/form/selected-tasks-summary";
import {
  IconSpray,
  IconBrush,
  IconClipboardList,
  IconCreditCard,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconStack2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { FileSuggestions, type FileWithPreview } from "@/components/common/file";
// Só LAYOUTS têm seletor de arquivo neste formulário: o recibo é anexado a partir de Contas a
// Pagar e a nota fiscal entra automaticamente na geração da NFS-e. `LayoutFileUploadField` é o
// mesmo uploader do layout de tarefa mais o seletor de status por arquivo.
import { LayoutFileUploadField } from "@/components/production/task/form/layout-file-upload-field";
import { createAirbrushingFormData } from "@/utils/form-data-helper";
import { createAirbrushingsForTasks, isMeaningfulAirbrushing, type AirbrushingTaskTarget } from "@/utils/airbrushing-submit";
import type { ClusteredTask } from "@/components/production/task/preparation/cluster-tasks";
import { useAuth } from "@/contexts/auth-context";
import { canViewAirbrushingFinancials } from "@/utils/permissions/entity-permissions";

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
  // crypto.randomUUID, not Date.now(): two rows added within the same millisecond would share an id,
  // and `updateAirbrushing` matches on id — so editing one row would silently write into both.
  id: `airbrushing-${crypto.randomUUID()}`,
  status: AIRBRUSHING_STATUS.PREPARATION,
  paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
  // Mesmos padrões da linha que o `MultiAirbrushingSelector` cria — assim a linha semeada e
  // a adicionada pelo botão nascem idênticas.
  paymentMethod: null,
  dueDateRule: AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
  paymentTermDays: null,
  dueDayOfMonth: null,
  dueDate: null,
  price: null,
  description: null,
  startDate: null,
  finishDate: null,
  startedAt: null,
  finishedAt: null,
  painterId: null,
  painter: null,
  // O formulário não anexa recibos nem notas fiscais (recibo vem de Contas a Pagar, NF sai da
  // geração da NFS-e). As chaves continuam aqui apenas porque o modelo do
  // `MultiAirbrushingSelector` — compartilhado com tarefa e orçamento — as exige; ficam vazias.
  receiptFiles: [],
  invoiceFiles: [],
  layouts: [],
  receiptIds: [],
  invoiceIds: [],
  layoutIds: [],
  layoutStatuses: {},
});

// Campos escalares que o modo edição valida antes de avançar de passo. É a MESMA lista que
// `AirbrushingFields` desenha — inclusive a configuração de pagamento, que antes nunca era
// validada porque não constava de nenhum `form.trigger`.
const VALIDATED_FIELDS = [
  "painterId",
  "description",
  "status",
  "paymentStatus",
  "startDate",
  "finishDate",
  "startedAt",
  "finishedAt",
  "price",
  "paymentMethod",
  "dueDateRule",
  "paymentTermDays",
  "dueDayOfMonth",
  "dueDate",
] as const;

// Three-step wizard definition (mirrors the Order create/edit wizard).
const STEPS = [
  { id: 1, name: "Detalhes", description: "Dados da aerografia e layouts" },
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
  // Só LAYOUTS: recibos e notas fiscais não são anexados por aqui.
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
  // CREATE bypasses the react-query mutation entirely (createAirbrushingsForTasks calls
  // airbrushingService.createAirbrushing directly), so `isCreating` NEVER flips on that path and
  // cannot gate the submit button — which is how a second click used to re-run the whole
  // configs × tasks fan-out (3 configs × 1 task produced 6 airbrushings). Track it locally.
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const submitInFlight = useRef(false);
  const isSubmitting = isCreating || isUpdating || isSubmittingLocal;

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
      description: null,
      taskId: initialTaskId || "",
      painterId: null,
      // Sem receiptIds/invoiceIds: o formulário não gerencia recibos nem notas fiscais, e mandar
      // um array vazio faria o backend DESANEXAR os que já existem.
      layoutIds: [],
      status: AIRBRUSHING_STATUS.PREPARATION,
      paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
      paymentMethod: null,
      dueDateRule: AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
      paymentTermDays: null,
      dueDayOfMonth: null,
      dueDate: null,
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
      description: airbrushing.description ?? null,
      status: airbrushing.status,
      paymentStatus: airbrushing.paymentStatus ?? AIRBRUSHING_PAYMENT_STATUS.PENDING,
      paymentMethod: airbrushing.paymentMethod ?? null,
      dueDateRule: airbrushing.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
      paymentTermDays: airbrushing.paymentTermDays ?? null,
      dueDayOfMonth: airbrushing.dueDayOfMonth ?? null,
      dueDate: airbrushing.dueDate ?? null,
      taskId: airbrushing.taskId,
      painterId: airbrushing.painterId ?? null,
      // receiptIds/invoiceIds NÃO são hidratados nem enviados — ver defaultValues.
      // layoutIds must be File IDs (artwork.fileId or artwork.file.id), not Layout entity IDs
      layoutIds: airbrushing.layouts?.map((artwork: any) => artwork.fileId || artwork.file?.id || artwork.id) || [],
    });

    setSelectedTasks(new Set([airbrushing.taskId]));

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

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(1, Math.min(STEPS.length, step));
      setCurrentStep(clamped);
      setSearchParams((prev) => setStepInUrl(prev, clamped), { replace: true });
    },
    [setSearchParams],
  );

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

  // Per-step validation gate (mirrors the order wizard's validateStep switch).
  // Parameterized by step (not read off `currentStep`) so a jump can run every
  // gate between here and the target — see handleStepClick.
  const validateStep = useCallback(async (step: number): Promise<boolean> => {
    switch (step) {
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
        const ok = await form.trigger(VALIDATED_FIELDS as any);
        if (!ok) {
          const errors = form.formState.errors as any;
          // Primeira mensagem na ORDEM DOS CAMPOS — nada de uma lista à parte que esquece
          // justamente o campo que falhou.
          const firstMsg = VALIDATED_FIELDS.map((name) => errors[name]?.message).find((msg) => typeof msg === "string") || "Verifique os dados da aerografia";
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
        const ok = await form.trigger([...VALIDATED_FIELDS, "taskId"] as any);
        if (!ok) {
          toast.error("Por favor, corrija os erros no formulário");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }, [mode, form, selectedTasks]);

  const validateCurrentStep = useCallback(() => validateStep(currentStep), [validateStep, currentStep]);

  const handleNext = useCallback(async () => {
    if (await validateCurrentStep()) nextStep();
  }, [validateCurrentStep, nextStep]);

  // Step marker click. Back is free (nothing is lost by revisiting); forward runs
  // EVERY gate between here and the target, exactly as pressing "Próximo" that
  // many times would — the first refusal parks the user on the offending step,
  // which already surfaced its own reason. That is what lets any marker be
  // clickable: no jump can skip a validation the button enforces.
  const handleStepClick = useCallback(
    async (step: number) => {
      if (step === currentStep) return;
      if (step < currentStep) {
        goToStep(step);
        return;
      }
      for (let s = currentStep; s < step; s++) {
        if (!(await validateStep(s))) {
          goToStep(s);
          return;
        }
      }
      goToStep(step);
    },
    [currentStep, goToStep, validateStep],
  );

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
    // In-flight guard. The REF (not the state) is what actually blocks a second click: the click can
    // land before React re-renders with the disabled button, and `validateCurrentStep` below awaits,
    // opening a window in which a second run would fan the same configs out over the same tasks again.
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setIsSubmittingLocal(true);

    try {
      if (!(await validateCurrentStep())) return;

      // `receiptIds`/`invoiceIds` NUNCA saem daqui: o backend traduz um array vazio em
      // `receipts: { set: [] }`, ou seja, desanexa tudo. Como este formulário não gerencia
      // recibos nem notas fiscais, omitir os campos é o que preserva os anexos existentes.
      const { receiptIds: _receiptIds, invoiceIds: _invoiceIds, ...data } = form.getValues() as Record<string, any>;

      const newLayouts = layouts.filter((f) => !f.uploaded);
      const existingLayoutIds = layouts.filter((f) => f.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[];

      const hasNewFiles = newLayouts.length > 0;

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
          layoutIds: existingLayoutIds,
          // Wrap in array for FormData serialization (backend preprocess unwraps).
          layoutStatuses: layoutStatusesMap ? [layoutStatusesMap] : undefined,
        };

        const formData = createAirbrushingFormData(
          submitData,
          { layouts: newLayouts.length > 0 ? (newLayouts as File[]) : undefined },
          customerInfo,
        );

        result = await update({ id: airbrushingId!, data: formData as any });
      } else {
        const submitData = {
          ...data,
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
    } finally {
      // Every early `return` inside the try (failed validation, the empty-config bail, the create
      // branch's own return) still runs this, so the lock can never be left stuck on.
      submitInFlight.current = false;
      setIsSubmittingLocal(false);
    }
  }, [validateCurrentStep, form, mode, update, refresh, airbrushingId, onSuccess, navigate, setSearchParams, layouts, layoutStatuses, airbrushing, selectedTaskResponse, selectedTasks, selectedTaskRows, selectedTaskId]);

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

  // Revisão do modo edição: os valores atuais do formulário passados pela MESMA definição de
  // seções que o cadastro usa — nenhuma das duas telas tem lista literal de campos.
  const editReviewValues = form.watch() as AirbrushingFieldValues;

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

  // Cliente da tarefa — contexto de organização dos arquivos e escopo das sugestões de layout.
  const layoutCustomerId = (isEdit ? airbrushing?.task?.customer?.id : selectedTaskResponse?.data?.customer?.id) || undefined;

  // ------- Revisão: UMA lista de itens, e o MESMO JSX nos dois modos -------
  // Edição = um item (a aerografia carregada); cadastro = um item por configuração preenchida.
  // É o que garante que a revisão seja idêntica: só o tamanho da lista muda.
  const reviewItems = (
    isEdit
      ? [
          {
            key: airbrushingId || "airbrushing",
            label: "Aerografia",
            values: editReviewValues,
            layouts: layouts as any[],
            painterName: reviewPainterName ?? null,
            receiptCount: airbrushing?.receipts?.length ?? 0,
            invoiceCount: airbrushing?.invoices?.length ?? 0,
          },
        ]
      : reviewConfigs.map((c, index) => ({
          key: (c.id ?? index) as string,
          label: `Aerografia ${index + 1}`,
          values: c as AirbrushingFieldValues,
          layouts: (c.layouts ?? []) as any[],
          painterName: (c.painterId && painterNameById.get(c.painterId)) || null,
          receiptCount: 0,
          invoiceCount: 0,
        }))
  ).map((item) => ({
    ...item,
    sections: buildAirbrushingReviewSections(item.values, {
      canViewFinancials,
      painterName: item.painterName,
      receiptCount: item.receiptCount,
      invoiceCount: item.invoiceCount,
    }),
  }));

  // Só o cadastro pode ter mais de uma configuração — com N itens cada bloco ganha um rótulo.
  const hasMultipleReviewItems = reviewItems.length > 1;
  const showPaymentSection = canViewFinancials && reviewItems.some((item) => item.sections.pagamento.length > 0);

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
                  <FormSteps steps={STEPS} currentStep={currentStep} onStepClick={handleStepClick} disabled={isSubmitting} />
                </div>

                {/* Step content — step 2 (task table) takes full height. */}
                <div className={cn("flex-1 min-h-0", currentStep === 2 ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
                  {/* ---------- Passo 1: dados da aerografia + layouts ----------
                      MESMO contorno nos dois modos (card, título, espaçamento). A única
                      diferença é o miolo: o cadastro repete o bloco N vezes (uma configuração
                      por linha), a edição tem uma só, ligada ao react-hook-form. Os CAMPOS, a
                      ordem e o seletor de layouts vêm de `AirbrushingFields` nos dois casos. */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <Card className="w-full">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <IconSpray className="h-5 w-5" />
                            {isEdit ? "Aerografia" : "Aerografias"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {isEdit ? (
                            <AirbrushingFormFields
                              control={form.control}
                              disabled={isSubmitting}
                              initialPainter={airbrushing?.painter ?? undefined}
                              canViewFinancials={canViewFinancials}
                              layoutsSlot={
                                <LayoutFileUploadField
                                  onFilesChange={handleLayoutsChange}
                                  onStatusChange={handleLayoutStatusChange}
                                  showStatus
                                  existingFiles={layouts}
                                  maxFiles={20}
                                  showPreview={true}
                                  placeholder="Adicione layouts da aerografia"
                                  variant="card"
                                  disabled={isSubmitting}
                                >
                                  {layoutCustomerId && (
                                    <FileSuggestions
                                      customerId={layoutCustomerId}
                                      fileContext="airbrushingLayouts"
                                      excludeFileIds={layouts.map((f) => f.uploadedFileId || f.id).filter(Boolean) as string[]}
                                      onSelect={(newFile) => {
                                        const fileWithPreview = {
                                          id: newFile.id,
                                          name: newFile.filename || newFile.originalName || "layout",
                                          size: newFile.size || 0,
                                          type: newFile.mimetype || "application/octet-stream",
                                          lastModified: Date.now(),
                                          uploaded: true,
                                          uploadProgress: 100,
                                          uploadedFileId: newFile.id,
                                          thumbnailUrl: newFile.thumbnailUrl || undefined,
                                        } as unknown as FileWithPreview;
                                        handleLayoutsChange([...layouts, fileWithPreview]);
                                      }}
                                      disabled={isSubmitting}
                                    />
                                  )}
                                </LayoutFileUploadField>
                              }
                            />
                          ) : (
                            /* `showStatus` liga Status/Status do Pagamento para que cadastrar e
                               editar ofereçam exatamente os mesmos campos. */
                            <MultiAirbrushingSelector
                              control={form.control}
                              disabled={isSubmitting}
                              customerId={layoutCustomerId}
                              canViewFinancials={canViewFinancials}
                              showStatus
                            />
                          )}
                        </CardContent>
                      </Card>
                      {!isEdit && <p className="text-xs text-muted-foreground px-1">Cada aerografia será criada para cada tarefa selecionada.</p>}
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
                            {/* MESMAS linhas que a revisão usa — a tarefa vinculada tem a mesma
                                aparência aqui e no passo 3. */}
                            <TaskReviewRows task={reviewTask as any} />
                            {reviewTask && <p className="text-xs text-muted-foreground pt-1">A tarefa vinculada não pode ser alterada após a criação.</p>}
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

                  {/* ---------- Passo 3: revisão em TRÊS seções ----------
                      1. Tarefa · 2. Aerografia (com os layouts em si) · 3. Pagamento.
                      MESMO JSX nos dois modos: só a lista `reviewItems` muda de tamanho
                      (edição = 1 aerografia; cadastro = 1 por configuração preenchida). */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{isEdit ? "Revisão da Aerografia" : "Revisão das Aerografias"}</h2>
                        <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de {isEdit ? "salvar" : "cadastrar"}.</p>
                      </div>

                      {/* Quantas serão criadas — só faz sentido no cadastro (N configurações × N tarefas). */}
                      {!isEdit && (
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
                      )}

                      {/* Aerografia à ESQUERDA (é a coluna mais alta, por causa dos previews de
                          layout); Tarefa e Pagamento empilhados à DIREITA. Em telas estreitas o
                          grid vira uma coluna e a ordem do DOM manda: Aerografia → Tarefa → Pagamento. */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        {/* ----- Aerografia: pintor, descrição, status, datas previstas E reais + LAYOUTS ----- */}
                        <Card className="w-full">
                          <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                              <IconSpray className="h-5 w-5" />
                              {isEdit ? "Aerografia" : `Aerografias (${perTaskAirbrushings})`}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {reviewItems.length > 0 ? (
                              <div className="space-y-4">
                                {reviewItems.map((item) => (
                                  <div key={item.key} className={hasMultipleReviewItems ? "rounded-lg border border-border p-3 space-y-2" : "space-y-2"}>
                                    {hasMultipleReviewItems && <p className="text-xs font-semibold text-muted-foreground px-1">{item.label}</p>}
                                    <AirbrushingReviewRows rows={item.sections.aerografia} />
                                    {/* Os layouts em si (imagem/PDF), não a contagem nem o nome. */}
                                    <AirbrushingLayoutPreviews files={item.layouts} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Nenhuma aerografia preenchida.</p>
                            )}
                          </CardContent>
                        </Card>

                        <div className="space-y-4">
                          {/* ----- Tarefa ----- */}
                          <Card className="w-full">
                            <CardHeader className="pb-4">
                              <CardTitle className="flex items-center gap-2">
                                <IconClipboardList className="h-5 w-5" />
                                {isEdit ? "Tarefa" : `Tarefas (${selectedTasks.size})`}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {isEdit ? <TaskReviewRows task={reviewTask as any} /> : <SelectedTasksSummary tasks={selectedTaskRows} />}
                            </CardContent>
                          </Card>

                          {/* ----- Pagamento: valor, status, forma, regra e vencimento ----- */}
                          {showPaymentSection && (
                            <Card className="w-full">
                              <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2">
                                  <IconCreditCard className="h-5 w-5" />
                                  Pagamento
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="space-y-4">
                                  {reviewItems.map((item) => (
                                    <div key={item.key} className={hasMultipleReviewItems ? "rounded-lg border border-border p-3 space-y-2" : "space-y-2"}>
                                      {hasMultipleReviewItems && <p className="text-xs font-semibold text-muted-foreground px-1">{item.label}</p>}
                                      <AirbrushingReviewRows rows={item.sections.pagamento} />
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
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
