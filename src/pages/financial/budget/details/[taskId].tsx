import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import { routes } from "@/constants";
import { useTaskDetail, useTaskMutations } from "@/hooks";
import {
  useTaskQuoteByTask,
  useCreateTaskQuote,
  useUpdateTaskQuote,
  taskQuoteKeys,
} from "@/hooks/production/use-task-quote";
import { taskQuoteService } from "@/api-client/task-quote";
import {
  canViewQuote,
  canEditQuote,
  getQuoteStatusPath,
} from "@/utils/permissions/quote-permissions";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { validateResponsibleRows } from "@/components/administration/customer/responsible";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "@/components/ui/sonner";
import { uploadSingleFile } from "@/api-client/file";
import { getCustomers } from "@/api-client";
import { customerService } from "@/api-client/customer";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useUnsavedChangesGuard } from "@/hooks/common/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { readReturnTo } from "@/hooks/common/use-return-to";
import type { FileWithPreview } from "@/components/common/file";
import type { ResponsibleRowData } from "@/types/responsible";
import { ResponsibleRole } from "@/types/responsible";
// Step components
import { BudgetStepTask } from "@/components/financial/budget/steps/budget-step-task";
import { BudgetStepInfo } from "@/components/financial/budget/steps/budget-step-info";
import { BudgetStepServices } from "@/components/financial/budget/steps/budget-step-services";
import { BudgetStepCustomerPayment } from "@/components/financial/budget/steps/budget-step-customer-payment";
import { BudgetStepReview } from "@/components/financial/budget/steps/budget-step-review";

function getDefaultExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 59, 999);
  return date;
}

export const FinancialBudgetDetailPage = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to return after save/cancel — set by whoever sent the user here.
  const returnTo = readReturnTo(location.state);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  usePageTracker({ title: "Orçamento - Detalhes", icon: "file-invoice" });

  // Fetch task data
  const { data: taskResponse, isLoading: taskLoading } = useTaskDetail(
    taskId || "",
    {
      include: {
        customer: true,
        truck: true,
        artworks: { include: { file: true } },
        baseFiles: true,
        responsibles: true,
      },
    },
  );
  const task = taskResponse?.data;

  // Fetch existing quote
  const { data: quoteResponse, isLoading: quoteLoading } =
    useTaskQuoteByTask(taskId || "");
  // Unwrap the API response: backend may wrap as { data: quote } or return the quote directly.
  // Guard with .id to prevent treating an empty wrapper object ({ data: null }) as a valid quote.
  const rawQuote = quoteResponse?.data?.data || quoteResponse?.data;
  const existingQuote = rawQuote?.id ? rawQuote : null;

  // Mutations
  const createQuoteMutation = useCreateTaskQuote();
  const updateQuoteMutation = useUpdateTaskQuote();
  const { updateAsync: updateTaskAsync } = useTaskMutations();

  // Permissions
  const userRole = user?.sector?.privileges || "";
  const canView = canViewQuote(userRole);
  const canEdit = canEditQuote(userRole);

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Tracks whether the form has received its first server-data reset.
  // Ref: used inside the effect (always current, no stale closure).
  // State: signals child components that need to wait before running side-effects.
  const formInitializedRef = useRef(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const [layoutFiles, setLayoutFiles] = useState<FileWithPreview[]>([]);
  const customersCache = useRef<Map<string, any>>(new Map());
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, any>>(
    new Map(),
  );

  // Task-specific state
  const [showResponsibleErrors, setShowResponsibleErrors] = useState(false);
  const [responsibleRows, setResponsibleRows] = useState<ResponsibleRowData[]>([]);
  const [artworkFiles, setArtworkFiles] = useState<FileWithPreview[]>([]);
  const [artworkStatuses, setArtworkStatuses] = useState<Record<string, string>>({});
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  // Snapshots of the relation sets as loaded from the task. Used at submit time to
  // tell whether the user actually changed each set; if not, we OMIT the key so
  // the API preserves it (absence = preserve). Sending an empty array would WIPE
  // the relation (finding I40).
  const loadedBaseFileIdsRef = useRef<string[]>([]);
  const loadedArtworkFileIdsRef = useRef<string[]>([]);
  const loadedArtworkStatusesRef = useRef<Record<string, string>>({});
  const loadedResponsibleIdsRef = useRef<string[]>([]);

  const handleArtworkFilesChange = useCallback((files: FileWithPreview[]) => {
    setArtworkFiles(files);
  }, []);

  const handleBaseFilesChange = useCallback((files: FileWithPreview[]) => {
    setBaseFiles(files);
  }, []);

  // Set a task-artwork's status (DRAFT/APPROVED/REPROVED) from the layout card's
  // colored selector. Keyed by File id — same map the submit remap reads, so the change
  // persists and shows in Step 1 on reload. Also mirror onto artworkFiles so the Step-1
  // dropdown reflects it immediately. Last action wins.
  const handleArtworkLayoutStatusChange = useCallback(
    (fileId: string, status: string) => {
      setArtworkStatuses((prev) => ({ ...prev, [fileId]: status }));
      setArtworkFiles((prev) =>
        prev.map((f) => {
          const fId = (f as any).uploadedFileId || f.id;
          if (fId !== fileId) return f;
          // Mutate status IN PLACE — a spread ({ ...f }) downgrades a freshly-dropped
          // File instance to a plain object and DROPS the underlying blob, so the
          // submit upload sends an empty body and the API rejects it ("Nenhum arquivo
          // enviado."). Object.assign keeps the File instance (and its bytes) intact.
          // `prev.map` still returns a new array, so React re-renders. Mirrors
          // ArtworkFileUploadField's own status-change pattern.
          return Object.assign(f, { status }) as FileWithPreview;
        }),
      );
    },
    [],
  );

  const handleResponsibleRowsChange = useCallback(
    (rows: ResponsibleRowData[]) => {
      setResponsibleRows(rows);
      if (showResponsibleErrors && validateResponsibleRows(rows)) {
        setShowResponsibleErrors(false);
      }
    },
    [showResponsibleErrors],
  );

  // Form - task fields + quote fields (flat, no prefix)
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      // Task fields
      name: "" as string,
      customerId: "" as string,
      plate: "" as string,
      serialNumber: "" as string,
      chassisNumber: "" as string,
      category: "" as string,
      // Do NOT default to a concrete enum — an unset implementType must stay
      // empty so an untouched budget save never clobbers the truck's real value
      // (the load effect below seeds it from the task; submit only sends it when
      // the user actually changed it). See findings I39/I40.
      implementType: "" as string,
      forecastDate: null as Date | null,
      term: null as Date | null,
      details: "" as string,
      paintId: null as string | null,
      paintIds: [] as string[],
      serviceOrders: [] as any[],
      // Quote fields
      expiresAt: getDefaultExpiresAt(),
      status: "PENDING" as string,
      // Captured by BudgetStepReview when rejecting a quote (status -> PENDING).
      // Forwarded to taskQuoteService.updateStatus on Save (see handleSubmit).
      statusReason: "" as string,
      subtotal: 0,
      total: 0,
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
      customForecastDays: null as number | null,
      layoutFileIds: [] as string[],
      simultaneousTasks: null as number | null,
      customerConfigs: [] as any[],
      services: [
        {
          description: "",
          amount: null,
          observation: null,
          invoiceToCustomerId: null,
        },
      ] as any[],
    },
  });

  // Unsaved changes guard — prevents losing edits on back/cancel/breadcrumb/refresh
  const { showDialog, confirmNavigation, cancelNavigation, guardedNavigate, allowNavigation } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    isSubmitting,
  });

  // Populate form when task or quote data loads
  useEffect(() => {
    if (!task) return;

    const taskFields = {
      name: task.name || "",
      customerId: task.customerId || "",
      plate: task.truck?.plate || "",
      serialNumber: task.serialNumber || "",
      chassisNumber: task.truck?.chassisNumber || "",
      category: task.truck?.category || "",
      // Seed from the loaded truck; leave empty when absent. NEVER default to a
      // concrete enum here — that silently rewrites the truck's implementType to
      // REFRIGERATED on every save (finding I39).
      implementType: task.truck?.implementType || "",
      forecastDate: task.forecastDate ? new Date(task.forecastDate) : null,
      term: task.term ? new Date(task.term) : null,
      details: task.details || "",
      serviceOrders: task.serviceOrders || [],
      paintId: task.paintId || null,
      paintIds: (task as any).paintIds?.map((p: any) => p.id || p) || task.logoPaints?.map((p) => p.id) || [],
    };

    if (!existingQuote) {
      form.reset({
        ...taskFields,
        expiresAt: getDefaultExpiresAt(),
        status: "PENDING",
        subtotal: 0,
        total: 0,
        guaranteeYears: null,
        customGuaranteeText: null,
        customForecastDays: null,
        layoutFileIds: [],
        simultaneousTasks: null,
        customerConfigs: [],
        services: [
          {
            description: "",
            amount: null,
            observation: null,
            invoiceToCustomerId: null,
          },
        ],
      });
      formInitializedRef.current = true;
      setFormInitialized(true);
      return;
    }

    form.reset({
      ...taskFields,
      expiresAt: existingQuote.expiresAt
        ? new Date(existingQuote.expiresAt)
        : getDefaultExpiresAt(),
      status: existingQuote.status || "PENDING",
      subtotal: existingQuote.subtotal || 0,
      total: existingQuote.total || 0,
      guaranteeYears: existingQuote.guaranteeYears || null,
      customGuaranteeText: existingQuote.customGuaranteeText || null,
      customForecastDays: existingQuote.customForecastDays || null,
      layoutFileIds: (existingQuote.layoutFiles || []).map((f: any) => f.id),
      simultaneousTasks: existingQuote.simultaneousTasks || null,
      customerConfigs:
        existingQuote.customerConfigs?.map((c: any) => ({
          customerId: c.customerId || c.id,
          subtotal: c.subtotal ?? 0,
          total: c.total ?? 0,
          discountType: c.discountType || "NONE",
          discountValue: c.discountValue != null ? Number(c.discountValue) : null,
          discountReference: c.discountReference || null,
          paymentCondition: c.paymentCondition || null,
          paymentConfig: c.paymentConfig ?? null,
          customPaymentText: c.customPaymentText || null,
          generateInvoice:
            c.generateInvoice !== undefined ? c.generateInvoice : true,
          generateBankSlip:
            c.generateBankSlip !== undefined ? c.generateBankSlip : true,
          orderNumber: c.orderNumber || null,
          responsibleId: c.responsibleId || null,
          customerData: {
            corporateName: c.customer?.corporateName || "",
            fantasyName: c.customer?.fantasyName || "",
            cnpj: c.customer?.cnpj || "",
            cpf: c.customer?.cpf || "",
            address: c.customer?.address || "",
            addressNumber: c.customer?.addressNumber || "",
            addressComplement: c.customer?.addressComplement || "",
            neighborhood: c.customer?.neighborhood || "",
            city: c.customer?.city || "",
            state: c.customer?.state || "",
            zipCode: c.customer?.zipCode || "",
            stateRegistration: c.customer?.stateRegistration || "",
            streetType: c.customer?.streetType || null,
          },
          installments:
            c.installments?.map((inst: any) => ({
              number: inst.number,
              dueDate: inst.dueDate ? new Date(inst.dueDate) : new Date(),
              amount:
                typeof inst.amount === "number"
                  ? inst.amount
                  : Number(inst.amount) || 0,
            })) || [],
        })) || [],
      services:
        existingQuote.services && existingQuote.services.length > 0
          ? existingQuote.services.map((item: any) => ({
              id: item.id,
              description: item.description || "",
              observation: item.observation || null,
              amount:
                typeof item.amount === "number"
                  ? item.amount
                  : item.amount
                    ? Number(item.amount)
                    : 0,
              invoiceToCustomerId: item.invoiceToCustomerId || null,
            }))
          : [
              {
                description: "",
                amount: null,
                observation: null,
                invoiceToCustomerId: null,
              },
            ],
    // On first load keepDirtyValues is false so server data always wins.
    // On subsequent resets (e.g. background refetch) it's true to preserve unsaved edits.
    }, { keepDirtyValues: formInitializedRef.current });
    formInitializedRef.current = true;
    setFormInitialized(true);

    // Set layout files from the included layoutFiles relation (array, up to 2).
    const toLayoutFile = (file: any): FileWithPreview => ({
      id: file.id,
      name: file.filename || "layout",
      size: file.size || 0,
      type: file.mimetype || "application/octet-stream",
      lastModified: Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview);

    if (existingQuote.layoutFiles && existingQuote.layoutFiles.length > 0) {
      setLayoutFiles(existingQuote.layoutFiles.map(toLayoutFile));
    }

    // Initialize customers cache from existing configs, then fetch full data
    if (existingQuote.customerConfigs?.length > 0) {
      const partialCustomers = existingQuote.customerConfigs
        .map((c: any) => c.customer)
        .filter(Boolean);
      partialCustomers.forEach((c: any) =>
        customersCache.current.set(c.id, c),
      );
      setSelectedCustomers(
        new Map(partialCustomers.map((c: any) => [c.id, c])),
      );

      const customerIds = partialCustomers.map((c: any) => c.id);
      getCustomers({
        where: { id: { in: customerIds } },
        take: customerIds.length,
      })
        .then((response) => {
          const fullCustomers = response.data || [];
          if (fullCustomers.length > 0) {
            fullCustomers.forEach((c: any) =>
              customersCache.current.set(c.id, c),
            );
            setSelectedCustomers(
              new Map(fullCustomers.map((c: any) => [c.id, c])),
            );

            // Update form customerData with full customer info
            const currentConfigs = form.getValues("customerConfigs");
            currentConfigs.forEach((config: any, idx: number) => {
              const full = fullCustomers.find(
                (c: any) => c.id === config.customerId,
              );
              if (full) {
                const d = config.customerData || {};
                form.setValue(
                  `customerConfigs.${idx}.customerData`,
                  {
                    corporateName: d.corporateName || full.corporateName || "",
                    fantasyName: d.fantasyName || full.fantasyName || "",
                    cnpj: d.cnpj || full.cnpj || "",
                    cpf: d.cpf || full.cpf || "",
                    address: d.address || full.address || "",
                    addressNumber:
                      d.addressNumber || full.addressNumber || "",
                    addressComplement:
                      d.addressComplement || full.addressComplement || "",
                    neighborhood: d.neighborhood || full.neighborhood || "",
                    city: d.city || full.city || "",
                    state: d.state || full.state || "",
                    zipCode: d.zipCode || full.zipCode || "",
                    stateRegistration:
                      d.stateRegistration || full.stateRegistration || "",
                    streetType: d.streetType || full.streetType || null,
                  },
                );
              }
            });
          }
        })
        .catch(() => {
          /* keep partial data */
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, existingQuote?.id]); // use IDs — object refs change on every refetch and would wipe unsaved edits

  // Initialize task-specific state (responsibles, artworks) when task loads
  useEffect(() => {
    if (!task) return;

    // Responsibles
    if (task.responsibles && task.responsibles.length > 0) {
      setResponsibleRows(
        task.responsibles.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          phone: r.phone || "",
          email: r.email || "",
          role: (r.role || "COMMERCIAL") as ResponsibleRole,
          isActive: r.isActive ?? true,
          isNew: false,
          isEditing: false,
          isSaving: false,
          error: null,
        })),
      );
    }
    loadedResponsibleIdsRef.current = (task.responsibles || []).map(
      (r: any) => r.id,
    );

    // Artworks
    loadedArtworkFileIdsRef.current = (task.artworks || []).map(
      (artwork: any) => (artwork.file || artwork).id,
    );
    loadedArtworkStatusesRef.current = (task.artworks || []).reduce(
      (acc: Record<string, string>, artwork: any) => {
        const fileId = (artwork.file || artwork).id;
        if (artwork.status) acc[fileId] = artwork.status;
        return acc;
      },
      {},
    );
    if (task.artworks && task.artworks.length > 0) {
      const artworkFilesList = task.artworks.map((artwork: any) => {
        const file = artwork.file || artwork;
        return {
          id: file.id,
          name: file.filename || file.originalName || "arquivo",
          size: file.size || 0,
          type: file.mimetype || "image/jpeg",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: file.id,
          thumbnailUrl: file.thumbnailUrl,
          // Carry the persisted status so the per-file dropdown shows the real
          // value (APPROVED/REPROVED) instead of always defaulting to DRAFT.
          status: artwork.status || "DRAFT",
        } as FileWithPreview;
      });
      setArtworkFiles(artworkFilesList);

      const statuses: Record<string, string> = {};
      task.artworks!.forEach((artwork: any) => {
        const fileId = (artwork.file || artwork).id;
        if (artwork.status) statuses[fileId] = artwork.status;
      });
      setArtworkStatuses(statuses);
    }

    // Base files
    if ((task as any).baseFiles && (task as any).baseFiles.length > 0) {
      setBaseFiles(
        (task as any).baseFiles.map((file: any) => ({
          id: file.id,
          name: file.filename || file.originalName || "arquivo",
          size: file.size || 0,
          type: file.mimetype || "application/octet-stream",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: file.id,
          thumbnailUrl: file.thumbnailUrl,
        }) as FileWithPreview),
      );
    }
    // Snapshot the loaded base-file ids (empty when the task has none) so submit
    // can detect a real user change and avoid sending an empty wipe array.
    loadedBaseFileIdsRef.current = ((task as any).baseFiles || []).map(
      (file: any) => file.id,
    );
    // Seed editable state by task IDENTITY only — NOT the full `task` object ref,
    // which changes on every react-query background refetch. Re-running on a refetch
    // called setArtworkFiles/setBaseFiles and WIPED unsaved uploads the user had just
    // added (and selected as a quote layout). That left the layout pointing at a local
    // temp id with no file left to upload, so submit sent the temp id and the API
    // rejected it ("Invalid uuid"). Mirrors the sibling effect's `[task?.id]` guard.
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic steps based on customer count
  const customerConfigs = form.watch("customerConfigs");
  const steps = useMemo(() => {
    const base = [
      { id: 1, name: "Tarefa", description: "Dados da tarefa" },
      { id: 2, name: "Informações", description: "Prazos e clientes" },
      { id: 3, name: "Serviços", description: "Serviços e preços" },
    ];
    if (Array.isArray(customerConfigs)) {
      customerConfigs.forEach((config: any, i: number) => {
        const customer = customersCache.current.get(config?.customerId);
        base.push({
          id: 4 + i,
          name: `Cliente ${i + 1}`,
          description: customer?.fantasyName || "Cliente",
        });
      });
    }
    base.push({
      id: base.length + 1,
      name: "Resumo",
      description: "Revisão final",
    });
    return base;
  }, [customerConfigs]);

  const totalSteps = steps.length;

  // Clamp current step when customer count changes
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps, currentStep]);

  // Step validation
  const validateCurrentStep = useCallback((): boolean => {
    const data = form.getValues();
    switch (currentStep) {
      case 1: {
        const hasIdentifier =
          data.name ||
          data.customerId ||
          data.plate ||
          data.serialNumber;
        if (!hasIdentifier) {
          toast.error("Preencha: Nome, Cliente, Placa ou Nº de série.");
          return false;
        }
        return true;
      }
      case 2: {
        if (!data.customerConfigs || data.customerConfigs.length === 0) {
          toast.error("Selecione pelo menos um cliente.");
          return false;
        }
        if (!data.expiresAt) {
          toast.error("A data de validade é obrigatória.");
          return false;
        }
        return true;
      }
      case 3: {
        const validServices = (data.services || []).filter(
          (s: any) => s.description?.trim(),
        );
        if (validServices.length === 0) {
          toast.error("Adicione pelo menos um serviço.");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  }, [currentStep, form]);

  const nextStep = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  }, [validateCurrentStep, totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const data = form.getValues();
    if (!taskId) return;

    setIsSubmitting(true);
    try {
      // 1. Upload new artwork files
      // Maps a freshly-uploaded file's LOCAL id -> its real server File id, so a
      // layout the user selected from a brand-new Step-1 artwork (still a local id
      // at selection time) can be remapped to the real File id below (see Bug 1).
      const localIdToRealFileId: Record<string, string> = {};
      const uploadedArtworkIds: string[] = [];
      const remappedArtworkStatuses: Record<string, string> = {};
      // The status dropdown keys onStatusChange by `uploadedFileId || id`, so a
      // persisted artwork's status lands under its File id while a brand-new file's
      // lands under its local id. Read BOTH so neither case is missed.
      const statusForFile = (file: FileWithPreview): string | undefined =>
        artworkStatuses[(file as any).uploadedFileId] ?? artworkStatuses[file.id];
      for (const file of artworkFiles) {
        if (file.uploaded && file.uploadedFileId) {
          uploadedArtworkIds.push(file.uploadedFileId);
          localIdToRealFileId[file.id] = file.uploadedFileId;
          const status = statusForFile(file);
          if (status) {
            remappedArtworkStatuses[file.uploadedFileId] = status;
          }
        } else if (!file.error) {
          try {
            const response = await uploadSingleFile(file, {
              fileContext: "artwork",
            });
            if (response.success && response.data) {
              uploadedArtworkIds.push(response.data.id);
              localIdToRealFileId[file.id] = response.data.id;
              const status = statusForFile(file);
              if (status) {
                remappedArtworkStatuses[response.data.id] = status;
              }
            }
          } catch (error: any) {
            toast.error(
              `Erro ao enviar artwork ${file.name}: ${error.message}`,
            );
          }
        }
      }

      // 1b. Upload new base files (already-uploaded ones keep their id)
      const uploadedBaseFileIds: string[] = [];
      const baseLocalIdToRealFileId: Record<string, string> = {};
      for (const file of baseFiles) {
        if (file.uploaded && file.uploadedFileId) {
          uploadedBaseFileIds.push(file.uploadedFileId);
          baseLocalIdToRealFileId[file.id] = file.uploadedFileId;
        } else if (!file.error) {
          try {
            const response = await uploadSingleFile(file, {
              fileContext: "task-base",
            });
            if (response.success && response.data) {
              uploadedBaseFileIds.push(response.data.id);
              baseLocalIdToRealFileId[file.id] = response.data.id;
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar arquivo ${file.name}: ${error.message}`);
          }
        }
      }

      // Persist the just-uploaded state back onto the file lists so a retry (after a
      // later step fails) does NOT re-upload the same bytes and create duplicate File
      // records. Mutate IN PLACE (Object.assign) to keep each File instance — a spread
      // would drop the blob. `localIdToRealFileId` is keyed by each file's local id.
      const markUploaded = (
        list: FileWithPreview[],
        idMap: Record<string, string>,
      ): FileWithPreview[] =>
        list.map((f) => {
          const realId = idMap[f.id];
          if (realId && !f.uploaded) {
            return Object.assign(f, {
              uploaded: true,
              uploadedFileId: realId,
              uploadProgress: 100,
            }) as FileWithPreview;
          }
          return f;
        });
      setArtworkFiles((prev) => markUploaded(prev, localIdToRealFileId));
      setBaseFiles((prev) => markUploaded(prev, baseLocalIdToRealFileId));

      // 2. Resolve the ordered layout File ids (up to 2 slots) from the current
      // layoutFiles state — NOT from form.data, which isn't updated when the user
      // removes a file via the upload widget. Upload any new files, preserve the
      // connection for pre-existing ones. Always use FILE ids, never Artwork ids.
      //
      // A layout may have been selected from a brand-new Step-1 artwork file that
      // had no server File id yet at selection time (only a local id). Those Step-1
      // files are uploaded in section 1 above, so remap any local id here to the
      // real File id via localIdToRealFileId before sending it (Bug 1).
      // A persisted File id is always a UUID; a not-yet-uploaded file carries a local
      // temp id (`<timestamp>-<random>`). The API only accepts UUIDs, so a temp id must
      // never be sent — guard the raw push below so a stale synthetic layout (e.g. a
      // selection whose source file was dropped from state) fails loudly here instead
      // of as a cryptic 400 that loses the whole save.
      const isUuid = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const resolvedLayoutIds: string[] = [];
      let droppedStaleLayout = false;
      for (const lf of layoutFiles) {
        const existingId = (lf as any).uploadedFileId || lf.id || null;
        // Already uploaded by the Step-1 artwork pass? Use the real File id.
        const remapped = existingId ? localIdToRealFileId[existingId] : null;
        if (remapped) {
          resolvedLayoutIds.push(remapped);
        } else if (!lf.uploaded) {
          try {
            const response = await uploadSingleFile(lf, {
              fileContext: "quote-layout",
            });
            if (response.success && response.data) {
              resolvedLayoutIds.push(response.data.id);
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar layout: ${error.message}`);
          }
        } else if (existingId && isUuid(existingId)) {
          resolvedLayoutIds.push(existingId);
        } else if (existingId) {
          // Marked uploaded but still a local temp id with no remap and no blob to
          // re-upload — the source file was lost (e.g. wiped by a background refetch).
          // Drop it rather than poison the request with a non-UUID.
          droppedStaleLayout = true;
        }
      }
      if (droppedStaleLayout) {
        toast.error(
          "Um layout selecionado não pôde ser salvo. Reenvie o arquivo de layout e tente novamente.",
        );
      }
      // Dedupe (a layout could resolve to the same File id as another slot) and
      // clamp to the 2-slot maximum.
      const seenLayoutIds = new Set<string>();
      const dedupedLayoutIds = resolvedLayoutIds
        .filter((id) => {
          if (seenLayoutIds.has(id)) return false;
          seenLayoutIds.add(id);
          return true;
        })
        .slice(0, 2);
      resolvedLayoutIds.length = 0;
      resolvedLayoutIds.push(...dedupedLayoutIds);

      // 3. Build responsible data
      const existingRepIds = responsibleRows
        .filter((row) => !row.isNew && row.id && !row.id.startsWith("temp-"))
        .map((row) => row.id);
      const newResponsibles = responsibleRows
        .filter(
          (row) => row.isNew && row.name?.trim() && row.phone?.trim(),
        )
        .map((row) => ({
          name: row.name.trim(),
          phone: row.phone.trim(),
          email: row.email?.trim() || undefined,
          role: row.role,
          isActive: row.isActive,
          customerId: data.customerId || undefined,
        }));

      // 4. Update task — but ONLY for fields the user actually changed.
      //
      // This page is otherwise a full-replace form that always called updateTask
      // with every field, so correctness hinged entirely on the query `include`
      // being complete and on relation state being loaded. A missing include or
      // empty array silently WIPED data (findings I39/I40). Instead, build the
      // payload from the dirty fields only and OMIT anything unchanged so the
      // API's "absence = preserve" semantics protect untouched data. Only an
      // explicit user action ever clears or replaces a field.
      const dirtyFields = form.formState.dirtyFields as Record<string, unknown>;
      const taskUpdateData: any = {};

      // Scalar task fields — include only when dirty.
      if (dirtyFields.name) taskUpdateData.name = data.name || undefined;
      if (dirtyFields.customerId)
        taskUpdateData.customerId = data.customerId || undefined;
      if (dirtyFields.details)
        taskUpdateData.details = data.details || undefined;
      if (dirtyFields.forecastDate)
        taskUpdateData.forecastDate = data.forecastDate || undefined;
      if (dirtyFields.term) taskUpdateData.term = data.term || undefined;
      if (dirtyFields.paintId) taskUpdateData.paintId = data.paintId || null;
      if (dirtyFields.serialNumber)
        taskUpdateData.serialNumber = data.serialNumber || null;

      // paintIds (logo paints) — include only when changed.
      if (dirtyFields.paintIds) {
        taskUpdateData.paintIds =
          data.paintIds && data.paintIds.length > 0
            ? data.paintIds
            : [];
      }

      // serviceOrders — include only when changed.
      if (dirtyFields.serviceOrders) {
        const serviceOrders = (data.serviceOrders || []).filter(
          (so: any) => so?.description?.trim()?.length >= 3,
        );
        taskUpdateData.serviceOrders = serviceOrders;
      }

      // Truck fields live under data.* (plate/chassisNumber/category/
      // implementType). Add each ONLY when its own field is dirty, and only
      // build the truck object when at least one of them changed — so an
      // untouched save never re-writes (and never clobbers) the truck's
      // implementType. This is the core of finding I39.
      const truckPayload: Record<string, unknown> = {};
      if (dirtyFields.plate) truckPayload.plate = data.plate || undefined;
      if (dirtyFields.chassisNumber)
        truckPayload.chassisNumber = data.chassisNumber || undefined;
      if (dirtyFields.category)
        truckPayload.category = data.category || undefined;
      if (dirtyFields.implementType)
        truckPayload.implementType = data.implementType || undefined;
      if (Object.keys(truckPayload).length > 0) {
        taskUpdateData.truck = truckPayload;
      }

      // Artworks live in separate state (not RHF). Detect a real change by
      // comparing the resolved File-id set and per-file statuses against the
      // loaded snapshot. Only then send artworkIds/artworkStatuses; otherwise
      // omit so existing artworks are preserved (not wiped).
      const loadedArtworkIds = loadedArtworkFileIdsRef.current;
      const artworkIdsChanged =
        uploadedArtworkIds.length !== loadedArtworkIds.length ||
        uploadedArtworkIds.some((id, i) => id !== loadedArtworkIds[i]);
      const loadedStatuses = loadedArtworkStatusesRef.current;
      const statusKeys = new Set([
        ...Object.keys(remappedArtworkStatuses),
        ...Object.keys(loadedStatuses),
      ]);
      const artworkStatusesChanged = Array.from(statusKeys).some(
        (k) => remappedArtworkStatuses[k] !== loadedStatuses[k],
      );
      if (artworkIdsChanged || artworkStatusesChanged) {
        // Send the full resolved set so adds AND removals persist.
        taskUpdateData.artworkIds = uploadedArtworkIds;
        if (Object.keys(remappedArtworkStatuses).length > 0) {
          taskUpdateData.artworkStatuses = remappedArtworkStatuses;
        }
      }

      // Base files live in separate state. Send baseFileIds ONLY when the set
      // differs from the loaded snapshot — never an empty wipe array on an
      // untouched save (finding I40).
      const loadedBaseFileIds = loadedBaseFileIdsRef.current;
      const baseFilesChanged =
        uploadedBaseFileIds.length !== loadedBaseFileIds.length ||
        uploadedBaseFileIds.some((id, i) => id !== loadedBaseFileIds[i]);
      if (baseFilesChanged) {
        taskUpdateData.baseFileIds = uploadedBaseFileIds;
      }

      // Responsibles — newly added ones are always sent. The existing-id set is
      // sent only when it differs from what was loaded (an add/removal), so an
      // untouched save never re-writes the responsible list.
      if (newResponsibles.length > 0) {
        taskUpdateData.newResponsibles = newResponsibles;
      }
      const loadedResponsibleIds = loadedResponsibleIdsRef.current;
      const responsibleIdsChanged =
        existingRepIds.length !== loadedResponsibleIds.length ||
        existingRepIds.some((id) => !loadedResponsibleIds.includes(id)) ||
        loadedResponsibleIds.some((id) => !existingRepIds.includes(id));
      if (responsibleIdsChanged && existingRepIds.length > 0) {
        taskUpdateData.responsibleIds = existingRepIds;
      }

      // Only hit the task endpoint when something task-owned actually changed.
      // Skips a no-op write when the user only edited the quote half.
      if (Object.keys(taskUpdateData).length > 0) {
        try {
          await updateTaskAsync({ id: taskId, data: taskUpdateData });
        } catch {
          // Error toast is emitted by the axios error interceptor.
          setIsSubmitting(false);
          return;
        }
      }

      // 5. Update customer data (address, CNPJ, etc.)
      for (const config of data.customerConfigs || []) {
        if (config.customerData && config.customerId) {
          try {
            await customerService.updateCustomer(config.customerId, {
              corporateName: config.customerData.corporateName || undefined,
              cnpj: config.customerData.cnpj || undefined,
              cpf: config.customerData.cpf || undefined,
              address: config.customerData.address || undefined,
              addressNumber:
                config.customerData.addressNumber || undefined,
              addressComplement:
                config.customerData.addressComplement || undefined,
              neighborhood: config.customerData.neighborhood || undefined,
              city: config.customerData.city || undefined,
              state: config.customerData.state || undefined,
              zipCode: config.customerData.zipCode || undefined,
              stateRegistration:
                config.customerData.stateRegistration || undefined,
              streetType: config.customerData.streetType || undefined,
            });
          } catch {
            // Error toast is emitted by the axios error interceptor.
          }
        }
      }

      // 6. Validate and save quote
      const validServices = (data.services || []).filter(
        (item: any) => item.description && item.description.trim().length > 0,
      );

      if (validServices.length === 0) {
        toast.error("Adicione pelo menos um serviço ao orçamento.");
        setIsSubmitting(false);
        return;
      }

      // With 2+ billing customers every service MUST be assigned to one — an
      // unassigned service is excluded from every per-customer total, so its
      // amount would silently vanish from the budget (and the API's billing-
      // approval guard blocks approval anyway). Block the save here.
      if (
        (data.customerConfigs || []).length >= 2 &&
        validServices.some((item: any) => !item.invoiceToCustomerId)
      ) {
        toast.error(
          "Atribua um cliente a todos os serviços antes de salvar (orçamento com múltiplos clientes).",
        );
        setIsSubmitting(false);
        return;
      }

      if (!data.expiresAt) {
        toast.error("A data de validade é obrigatória.");
        setIsSubmitting(false);
        return;
      }

      const quoteData: any = {
        taskId,
        expiresAt: data.expiresAt,
        subtotal: data.subtotal || 0,
        total: data.total || 0,
        guaranteeYears: data.guaranteeYears || null,
        customGuaranteeText: data.customGuaranteeText || null,
        customForecastDays: data.customForecastDays || null,
        layoutFileIds: resolvedLayoutIds,
        simultaneousTasks: data.simultaneousTasks || null,
        customerConfigs: data.customerConfigs || [],
        services: validServices.map((item: any) => ({
          ...item,
          amount: item.amount ?? 0,
        })),
      };

      if (existingQuote?.id) {
        // Short-circuit: skip the quote update entirely when no quote-form
        // field is dirty. Prevents Task-only edits (e.g. truck plate) from
        // round-tripping through the quote endpoint. The API also filters
        // no-ops defensively, but skipping the call is cheaper.
        const dirty = form.formState.dirtyFields as Record<string, unknown>;
        // Detect layout change via ordered comparison of resolved File ids vs the
        // persisted ones. Covers new uploads, removals, reordering AND selecting
        // an EXISTING file (which a dirty-flag check alone would miss).
        const persistedLayoutIds = (existingQuote.layoutFiles || []).map(
          (f: any) => f.id,
        ) as string[];
        const layoutChanged =
          resolvedLayoutIds.length !== persistedLayoutIds.length ||
          resolvedLayoutIds.some((id, i) => id !== persistedLayoutIds[i]);
        const quoteFieldDirty =
          layoutChanged ||
          Boolean(
            dirty.expiresAt ||
              dirty.subtotal ||
              dirty.total ||
              dirty.guaranteeYears ||
              dirty.customGuaranteeText ||
              dirty.customForecastDays ||
              dirty.layoutFileIds ||
              dirty.simultaneousTasks ||
              dirty.customerConfigs ||
              dirty.services,
          );
        if (quoteFieldDirty) {
          // Pin the CURRENT server status on the value update so the backend's
          // auto-revert-to-PENDING (which fires only when no status is sent) is
          // suppressed — editing values keeps the existing approval. The status
          // TRANSITION itself is applied separately below, AFTER the values are
          // saved, so it validates against the fresh values.
          quoteData.status = existingQuote.status;
          await updateQuoteMutation.mutateAsync({
            id: existingQuote.id,
            data: quoteData,
          });
        }

        // Apply the chosen status transition AFTER the value save, through the
        // dedicated /status endpoint. This is the single, deterministic place
        // status is committed (the dropdown no longer fires an immediate call
        // that races unsaved edits). Running it post-save means the backend
        // validates prerequisites (e.g. "total > 0") against the values we just
        // persisted.
        //
        // The dropdown gates options by the FORM status, so the user can advance
        // several steps in one session (PENDING → BUDGET_APPROVED →
        // BILLING_APPROVED). The server only accepts single legal hops, so we
        // replay the whole path hop-by-hop — each validated by the backend.
        const targetStatus = data.status as TASK_QUOTE_STATUS | undefined;
        if (targetStatus && targetStatus !== existingQuote.status) {
          const path = getQuoteStatusPath(
            existingQuote.status as TASK_QUOTE_STATUS,
            targetStatus,
          );
          if (path.length === 0) {
            throw new Error(
              `Não há um caminho de status válido de "${existingQuote.status}" até "${targetStatus}".`,
            );
          }
          const reason =
            (form.getValues("statusReason" as any) as string | undefined)?.trim() ||
            undefined;
          for (const step of path) {
            await taskQuoteService.updateStatus(
              existingQuote.id,
              step as any,
              // Reason only applies to a downgrade-to-PENDING step.
              step === "PENDING" ? reason : undefined,
            );
          }
          if (reason) form.setValue("statusReason" as any, "");
        }
      } else {
        quoteData.status = "PENDING";
        await createQuoteMutation.mutateAsync(quoteData);
      }

      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      allowNavigation();
      if (returnTo) navigate(returnTo);
      else navigate(-1);
    } catch (error: any) {
      console.error("Error saving budget:", error);
      toast.error(
        error?.response?.data?.message || "Erro ao salvar orçamento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    form,
    taskId,
    existingQuote,
    layoutFiles,
    artworkFiles,
    artworkStatuses,
    responsibleRows,
    queryClient,
    createQuoteMutation,
    updateQuoteMutation,
    updateTaskAsync,
    navigate,
    returnTo,
    allowNavigation,
  ]);

  // Status changes are NOT persisted immediately from the dropdown anymore — that
  // raced unsaved value edits (the backend validates prerequisites like "total > 0"
  // against the persisted quote, so an immediate call before saving could fail and
  // leave the quote PENDING). The dropdown only updates the form; the transition is
  // committed on Save, after the values are persisted (see handleSubmit).

  // Build header info
  const taskName = task?.name || task?.truck?.plate || "Tarefa";
  const taskDisplayName = [taskName, task?.serialNumber || task?.truck?.plate]
    .filter(Boolean)
    .join(" - ");

  // Loading state
  if (taskLoading || quoteLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  // Task not found
  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Tarefa não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  // Permission check
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">
          Você não tem permissão para visualizar orçamentos.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const isLastStep = currentStep === totalSteps;

  // Step-2's "Layout Aprovado" picker is sourced from these options. Build them
  // from the LIVE artworkFiles state (what the user is editing in Step 1) merged
  // with the persisted task.artworks, deduped by File id, images only. This makes
  // a layout just added in Step 1 immediately selectable in Step 2 (Bug 1).
  // For a not-yet-uploaded file the option `id` is the file's stable LOCAL id; at
  // submit it is remapped to the real File id (see localIdToRealFileId).
  // Persisted-artwork METADATA keyed by File id — used only to enrich the live entries
  // below (path/originalName/thumbnail). NOT a source of options on its own.
  const persistedArtworkByFileId = new Map<string, any>();
  (task.artworks || []).forEach((artwork: any) => {
    const file = artwork.file || artwork;
    if (!(file.mimetype || "").startsWith("image/")) return;
    persistedArtworkByFileId.set(file.id, { file, artwork });
  });
  // Options come from the LIVE Step-1 files (artworkFiles) — the single source of truth
  // for which layouts the task currently has. artworkFiles is seeded from task.artworks
  // on load and reflects every add/remove, so a layout REMOVED in Step 1 no longer shows
  // here (the old code merged task.artworks first, so removed arts lingered — the bug),
  // and a layout just ADDED is immediately selectable.
  const artworksById = new Map<string, any>();
  artworkFiles.forEach((file: any) => {
    if (!(file.type || "").startsWith("image/")) return;
    const key = file.uploadedFileId || file.id;
    const persisted = persistedArtworkByFileId.get(key);
    const pf = persisted?.file;
    artworksById.set(key, {
      id: key,
      artworkId: persisted?.artwork?.artworkId || persisted?.artwork?.id,
      filename: file.name || pf?.filename,
      originalName: file.name || pf?.originalName,
      thumbnailUrl: file.thumbnailUrl || pf?.thumbnailUrl || null,
      // Object-URL preview for not-yet-uploaded local files (no server thumbnail).
      preview: file.preview || null,
      status: file.status || persisted?.artwork?.status,
      mimetype: file.type || pf?.mimetype,
      // Remote storage path (http) when present — lets the viewer serve the file.
      path: pf?.path || null,
      size: file.size ?? pf?.size,
    });
  });
  const artworks = Array.from(artworksById.values());

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title={`Orçamento - ${taskDisplayName}`}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          { label: "Orçamento", href: routes.financial.budget.root },
          { label: taskName },
        ]}
        onBreadcrumbNavigate={(path) => guardedNavigate(path)}
        actions={[
          {
            key: "cancel",
            label: "Cancelar",
            onClick: () => guardedNavigate(returnTo || routes.financial.budget.root),
            variant: "outline" as const,
          },
          ...(currentStep > 1
            ? [
                {
                  key: "prev",
                  label: "Anterior",
                  onClick: prevStep,
                  variant: "outline" as const,
                  icon: IconArrowLeft,
                },
              ]
            : []),
          ...(!isLastStep && canView
            ? [
                {
                  key: "next",
                  label: "Próximo",
                  onClick: nextStep,
                  variant: "default" as const,
                  icon: IconArrowRight,
                },
              ]
            : []),
          ...(isLastStep && canEdit
            ? [
                {
                  key: "save",
                  label: isSubmitting ? "Salvando..." : "Salvar",
                  onClick: handleSubmit,
                  variant: "default" as const,
                  icon: isSubmitting ? IconLoader2 : IconCheck,
                  disabled: isSubmitting,
                  loading: isSubmitting,
                },
              ]
            : []),
        ]}
      />

      <FormSteps steps={steps} currentStep={currentStep} />

      <div className="flex-1 overflow-y-auto pb-6">
        <FormProvider {...form}>
          {/* Steps 1–3 stay mounted (hidden via CSS) to preserve useFieldArray state */}
          <div style={{ display: currentStep === 1 ? undefined : "none" }}>
            <BudgetStepTask
              isEditMode
              disabled={isSubmitting || !canEdit}
              responsibleRows={responsibleRows}
              onResponsibleRowsChange={handleResponsibleRowsChange}
              showResponsibleErrors={showResponsibleErrors}
              baseFiles={baseFiles}
              onBaseFilesChange={handleBaseFilesChange}
              artworkFiles={artworkFiles}
              onArtworkFilesChange={handleArtworkFilesChange}
              onArtworkStatusChange={handleArtworkLayoutStatusChange}
            />
          </div>

          <div style={{ display: currentStep === 2 ? undefined : "none" }}>
            <BudgetStepInfo
              disabled={isSubmitting || !canEdit}
              layoutFiles={layoutFiles}
              onLayoutFilesChange={setLayoutFiles}
              artworks={artworks}
              customersCache={customersCache}
              selectedCustomers={selectedCustomers}
              setSelectedCustomers={setSelectedCustomers}
            />
          </div>

          <div style={{ display: currentStep === 3 ? undefined : "none" }}>
            <BudgetStepServices
              task={task}
              disabled={isSubmitting || !canEdit}
              selectedCustomers={selectedCustomers}
              formInitialized={formInitialized}
            />
          </div>

          {/* Dynamic customer steps — kept MOUNTED (hidden via CSS), like steps 1-3,
              so each step's local UI state (CPF/CNPJ toggle, "Data específica"
              visibility) survives Next/Back navigation. A conditional mount dropped
              that state on every step change because it isn't lifted into the form. */}
          {(customerConfigs || []).map((config: any, configIndex: number) => {
            const stepNumber = 4 + configIndex;
            const customer = config
              ? customersCache.current.get(config.customerId)
              : null;
            return (
              <div
                key={`customer-config-${config?.customerId ?? configIndex}`}
                style={{ display: currentStep === stepNumber ? undefined : "none" }}
              >
                <BudgetStepCustomerPayment
                  configIndex={configIndex}
                  customer={customer}
                  disabled={isSubmitting || !canEdit}
                />
              </div>
            );
          })}

          {currentStep === totalSteps && (
            <BudgetStepReview
              task={task}
              disabled={isSubmitting || !canEdit}
              existingQuote={existingQuote}
              userRole={userRole}
              selectedCustomers={selectedCustomers}
              layoutFiles={layoutFiles}
            />
          )}
        </FormProvider>
      </div>

      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
};

export default FinancialBudgetDetailPage;
