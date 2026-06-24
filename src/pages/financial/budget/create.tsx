import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import {
  routes,
  TASK_STATUS,
  IMPLEMENT_TYPE,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  FAVORITE_PAGES,
} from "@/constants";
import { useTaskMutations } from "@/hooks";
import {
  useCreateTaskQuote,
  taskQuoteKeys,
} from "@/hooks/production/use-task-quote";
import {
  canEditQuote,
} from "@/utils/permissions/quote-permissions";
import { validateResponsibleRows } from "@/components/administration/customer/responsible";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { toast } from "@/components/ui/sonner";
import { uploadSingleFile } from "@/api-client/file";
import { getCustomers } from "@/api-client";
import { customerService } from "@/api-client/customer";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import type { FileWithPreview } from "@/components/common/file";
import type { TaskCreateFormData } from "@/schemas";
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

export const FinancialBudgetCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  usePageTracker({ title: "Orçamento - Cadastrar", icon: "file-invoice" });

  // Mutations
  const { createAsync: createTaskAsync } = useTaskMutations();
  const createQuoteMutation = useCreateTaskQuote();

  // Permissions
  const userRole = user?.sector?.privileges || "";
  const canEdit = canEditQuote(userRole);

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [layoutFiles, setLayoutFiles] = useState<FileWithPreview[]>([]);
  const customersCache = useRef<Map<string, any>>(new Map());
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, any>>(
    new Map(),
  );

  // Task-specific state
  const [showResponsibleErrors, setShowResponsibleErrors] = useState(false);
  const [responsibleRows, setResponsibleRows] = useState<ResponsibleRowData[]>([{
    id: `temp-${Date.now()}-0`,
    name: '',
    phone: '',
    email: '',
    role: 'COMMERCIAL' as ResponsibleRole,
    isActive: true,
    isNew: true,
    isEditing: false,
    isSaving: false,
    error: null,
  }]);
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  const [baseFileIds, setBaseFileIds] = useState<string[]>([]);
  const [artworkFiles, setArtworkFiles] = useState<FileWithPreview[]>([]);
  const [artworkFileIds, setArtworkFileIds] = useState<string[]>([]);
  const [artworkStatuses, setArtworkStatuses] = useState<Record<string, string>>({});

  const handleBaseFilesChange = useCallback((files: FileWithPreview[]) => {
    setBaseFiles(files);
    setBaseFileIds(files.filter(f => f.uploaded && f.uploadedFileId).map(f => f.uploadedFileId!));
  }, []);

  const handleArtworkFilesChange = useCallback((files: FileWithPreview[]) => {
    setArtworkFiles(files);
    setArtworkFileIds(files.filter(f => f.uploaded && f.uploadedFileId).map(f => f.uploadedFileId!));
  }, []);

  const handleArtworkStatusChange = useCallback((fileId: string, status: string) => {
    setArtworkStatuses(prev => ({ ...prev, [fileId]: status }));
  }, []);

  const handleResponsibleRowsChange = useCallback((rows: ResponsibleRowData[]) => {
    setResponsibleRows(rows);
    if (showResponsibleErrors && validateResponsibleRows(rows)) {
      setShowResponsibleErrors(false);
    }
  }, [showResponsibleErrors]);

  // Paints created inline via the quick-create dialog. If one is still selected
  // at submit time, a "Formular Cor" ARTWORK service order is added so the arts
  // team formulates the new color.
  const createdPaintIdsRef = useRef<Set<string>>(new Set());
  const handlePaintCreated = useCallback((paint: { id: string }) => {
    createdPaintIdsRef.current.add(paint.id);
  }, []);

  // Form - Combined task + budget fields
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      // Task fields
      status: TASK_STATUS.PREPARATION,
      name: "",
      customerId: "",
      details: "",
      plates: [] as string[],
      serialNumbers: [] as number[],
      category: "",
      implementType: IMPLEMENT_TYPE.REFRIGERATED,
      forecastDate: null as Date | null,
      term: null as Date | null,
      paintId: null as string | null,
      paintIds: [] as string[],
      serviceOrders: [
        {
          description: "Em Negociação",
          type: SERVICE_ORDER_TYPE.COMMERCIAL,
          status: SERVICE_ORDER_STATUS.IN_PROGRESS,
          statusOrder: 2,
          assignedToId: null,
        },
        {
          description: "Elaborar Layout",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Elaborar Projeto",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Preparar Arquivos para Plotagem",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Checklist Entrada",
          type: SERVICE_ORDER_TYPE.LOGISTIC,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Checklist Saída",
          type: SERVICE_ORDER_TYPE.LOGISTIC,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
      ] as any[],

      // Budget fields
      expiresAt: getDefaultExpiresAt(),
      budgetStatus: "PENDING" as string,
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

  // Auto-populate billing customer from task customer
  const watchedCustomerId = form.watch("customerId");
  const autoSetBillingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!watchedCustomerId) return;
    const currentConfigs = form.getValues("customerConfigs") || [];
    // Only auto-set if no billing customers selected yet, or if we previously auto-set this
    const shouldAutoSet = currentConfigs.length === 0 ||
      (currentConfigs.length === 1 && autoSetBillingRef.current === currentConfigs[0]?.customerId);
    if (!shouldAutoSet) return;

    autoSetBillingRef.current = watchedCustomerId;

    // Fetch customer data if not cached
    const cached = customersCache.current.get(watchedCustomerId);
    const setConfig = (customerData: any) => {
      const config = {
        customerId: watchedCustomerId,
        subtotal: 0,
        total: 0,
        paymentCondition: null,
        customPaymentText: null,
        generateInvoice: true,
        generateBankSlip: true,
        orderNumber: null,
        responsibleId: null,
        customerData: {
          corporateName: customerData?.corporateName || "",
          fantasyName: customerData?.fantasyName || "",
          cnpj: customerData?.cnpj || "",
          cpf: customerData?.cpf || "",
          address: customerData?.address || "",
          addressNumber: customerData?.addressNumber || "",
          addressComplement: customerData?.addressComplement || "",
          neighborhood: customerData?.neighborhood || "",
          city: customerData?.city || "",
          state: customerData?.state || "",
          zipCode: customerData?.zipCode || "",
          stateRegistration: customerData?.stateRegistration || "",
          streetType: customerData?.streetType || null,
        },
      };
      form.setValue("customerConfigs", [config], { shouldDirty: true });
      const newMap = new Map<string, any>();
      if (customerData) newMap.set(watchedCustomerId, customerData);
      setSelectedCustomers(newMap);
    };

    if (cached) {
      setConfig(cached);
    } else {
      getCustomers({ where: { id: watchedCustomerId }, take: 1, include: { logo: true } })
        .then((response) => {
          const customer = response.data?.[0];
          if (customer) {
            customersCache.current.set(customer.id, customer);
            setConfig(customer);
          } else {
            setConfig(null);
          }
        })
        .catch(() => setConfig(null));
    }
  }, [watchedCustomerId, form, setSelectedCustomers]);

  // Build pseudo-task for review step (customer from cache)
  const reviewTaskCustomer = watchedCustomerId
    ? customersCache.current.get(watchedCustomerId)
    : null;
  const pseudoTask = useMemo(() => ({
    customer: reviewTaskCustomer ? {
      corporateName: reviewTaskCustomer.corporateName,
      fantasyName: reviewTaskCustomer.fantasyName,
    } : undefined,
  }), [reviewTaskCustomer]);

  // Step-2 "Layout Aprovado" options come from the LIVE Step-1 layouts (artworkFiles).
  // A new budget has no persisted task.artworks, so without this the selection shows
  // "Nenhum layout na tarefa" even after a layout was added in Step 1 (image files only).
  const artworks = useMemo(
    () =>
      artworkFiles
        .filter((f) => (f.type || "").startsWith("image/"))
        .map((f) => {
          const id = (f as any).uploadedFileId || f.id;
          return {
            id,
            filename: f.name,
            originalName: f.name,
            thumbnailUrl: f.thumbnailUrl || null,
            preview: f.preview || null,
            status: (f as any).status,
            mimetype: f.type,
            size: f.size,
          };
        }),
    [artworkFiles],
  );

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
        // Task step - require at least name, customer, plate, or serial number
        const hasIdentifier = data.name || data.customerId || (data.plates && data.plates.length > 0) || (data.serialNumbers && data.serialNumbers.length > 0);
        if (!hasIdentifier) {
          toast.error("Preencha: Nome, Cliente, Placas ou Nº de série.");
          return false;
        }
        return true;
      }
      case 2: {
        if (!data.customerConfigs || data.customerConfigs.length === 0) {
          toast.error("Selecione pelo menos um cliente para faturamento.");
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

    setIsSubmitting(true);
    try {
      // Validate responsibles
      if (!validateResponsibleRows(responsibleRows)) {
        setShowResponsibleErrors(true);
        toast.error("Preencha o nome e telefone dos responsáveis.");
        setIsSubmitting(false);
        return;
      }

      // Validate services
      const validServices = (data.services || []).filter(
        (item: any) => item.description && item.description.trim().length > 0,
      );
      if (validServices.length === 0) {
        toast.error("Adicione pelo menos um serviço ao orçamento.");
        setIsSubmitting(false);
        return;
      }

      if (!data.expiresAt) {
        toast.error("A data de validade é obrigatória.");
        setIsSubmitting(false);
        return;
      }

      // 1. Upload artwork files. Map each file's LOCAL id -> its real server File id so a
      // layout selected from a Step-1 artwork (a local temp id at selection time) can be
      // remapped to the real File id below — otherwise the temp id reaches the API and is
      // rejected as a non-UUID.
      const uploadedArtworkIds: string[] = [...artworkFileIds];
      const remappedArtworkStatuses: Record<string, string> = {};
      const localIdToRealFileId: Record<string, string> = {};
      for (const file of artworkFiles) {
        if (file.uploaded && file.uploadedFileId) {
          localIdToRealFileId[file.id] = file.uploadedFileId;
          if (artworkStatuses[file.id]) {
            remappedArtworkStatuses[file.uploadedFileId] = artworkStatuses[file.id];
          }
        } else if (!file.error) {
          try {
            const response = await uploadSingleFile(file, { fileContext: 'artwork' });
            if (response.success && response.data) {
              uploadedArtworkIds.push(response.data.id);
              localIdToRealFileId[file.id] = response.data.id;
              if (artworkStatuses[file.id]) {
                remappedArtworkStatuses[response.data.id] = artworkStatuses[file.id];
              }
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar artwork ${file.name}: ${error.message}`);
          }
        }
      }

      // 2. Upload base files
      const uploadedBaseFileIds: string[] = [...baseFileIds];
      for (const file of baseFiles) {
        if (!file.uploaded && !file.error) {
          try {
            const response = await uploadSingleFile(file, { fileContext: 'basefile' });
            if (response.success && response.data) {
              uploadedBaseFileIds.push(response.data.id);
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar arquivo base ${file.name}: ${error.message}`);
          }
        }
      }

      // 3. Resolve layout File ids (up to 2 ordered slots) — ALWAYS real File UUIDs. A
      // layout chosen from a Step-1 artwork carries that artwork's LOCAL id; remap it to
      // the real File id uploaded above. The API only accepts UUIDs.
      const isUuid = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const resolvedLayoutIds: string[] = [];
      let droppedStaleLayout = false;
      for (const lf of layoutFiles) {
        const existingId = (lf as any).uploadedFileId || lf.id || null;
        const remapped = existingId ? localIdToRealFileId[existingId] : null;
        if (remapped) {
          resolvedLayoutIds.push(remapped);
        } else if (!lf.uploaded) {
          try {
            const response = await uploadSingleFile(lf, { fileContext: "quote-layout" });
            if (response.success && response.data) {
              resolvedLayoutIds.push(response.data.id);
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar layout: ${error.message}`);
          }
        } else if (existingId && isUuid(existingId)) {
          resolvedLayoutIds.push(existingId);
        } else if (existingId) {
          // Marked uploaded but still a local temp id with no remap / blob — drop it
          // rather than send a non-UUID the API would reject.
          droppedStaleLayout = true;
        }
      }
      if (droppedStaleLayout) {
        toast.error(
          "Um layout selecionado não pôde ser salvo. Reenvie o arquivo de layout e tente novamente.",
        );
      }
      const seenLayoutIds = new Set<string>();
      const layoutFileIds = resolvedLayoutIds
        .filter((id) => {
          if (seenLayoutIds.has(id)) return false;
          seenLayoutIds.add(id);
          return true;
        })
        .slice(0, 2);

      // 4. Build responsible data
      const existingRepIds = responsibleRows
        .filter(row => !row.isNew && row.id && row.id.trim() !== '')
        .map(row => row.id);
      const newResponsibles = responsibleRows
        .filter(row => row.isNew && row.name?.trim() && row.phone?.trim())
        .map(row => ({
          name: row.name.trim(),
          phone: row.phone.trim(),
          email: row.email?.trim() || undefined,
          role: row.role,
          isActive: row.isActive,
          customerId: data.customerId || undefined,
        }));

      // 5. Build service orders
      const serviceOrdersRaw = data.serviceOrders || [];
      const serviceOrders = serviceOrdersRaw.filter(
        (so: any) => so && so.description && so.description.trim().length >= 3
      );

      if (
        data.paintId &&
        createdPaintIdsRef.current.has(data.paintId) &&
        !serviceOrders.some(
          (so: any) => (so.description || "").trim().toLowerCase() === "formular cor"
        )
      ) {
        serviceOrders.push({
          description: "Formular Cor",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        });
      }

      // 6. Build truck data
      const { plates, category, implementType } = data;
      const hasTruckFields = (plates && plates.length > 0) || category || implementType;
      const buildTruckData = (plate?: string) => {
        if (!hasTruckFields && !plate) return {};
        return {
          truck: {
            ...(plate && { plate }),
            category: category || undefined,
            implementType: implementType || undefined,
          },
        };
      };

      // 7. Build plate/serial number combinations
      const serialNumbers = data.serialNumbers || [];
      const combinations: { plate?: string; serialNumber?: string }[] = [];
      if (plates.length > 0 && serialNumbers.length > 0) {
        for (const plate of plates) {
          for (const sn of serialNumbers) {
            combinations.push({ plate, serialNumber: sn.toString() });
          }
        }
      } else if (plates.length > 0) {
        for (const plate of plates) {
          combinations.push({ plate });
        }
      } else if (serialNumbers.length > 0) {
        for (const sn of serialNumbers) {
          combinations.push({ serialNumber: sn.toString() });
        }
      } else {
        combinations.push({});
      }

      // 8. Create task(s) and quote for each
      let successCount = 0;
      let firstCreatedTaskId: string | undefined;
      let firstCreatedRepIds: string[] | undefined;

      for (let i = 0; i < combinations.length; i++) {
        const { plate, serialNumber } = combinations[i];
        const truckData = buildTruckData(plate);

        const taskData: any = {
          status: data.status,
          name: data.name || undefined,
          customerId: data.customerId || undefined,
          details: data.details || undefined,
          forecastDate: data.forecastDate || undefined,
          term: data.term || undefined,
          paintId: data.paintId || undefined,
          paintIds: data.paintIds && data.paintIds.length > 0 ? data.paintIds : undefined,
          artworkIds: uploadedArtworkIds.length > 0 ? uploadedArtworkIds : undefined,
          artworkStatuses: uploadedArtworkIds.length > 0 && Object.keys(remappedArtworkStatuses).length > 0 ? remappedArtworkStatuses : undefined,
          baseFileIds: uploadedBaseFileIds.length > 0 ? uploadedBaseFileIds : undefined,
          responsibleIds: existingRepIds.length > 0 ? existingRepIds : undefined,
          serviceOrders: serviceOrders.length > 0 ? serviceOrders.map((so: any) => ({
            description: so.description,
            type: so.type,
            status: so.status || SERVICE_ORDER_STATUS.PENDING,
            statusOrder: so.statusOrder || 1,
            assignedToId: so.assignedToId || null,
            startedAt: so.status === SERVICE_ORDER_STATUS.IN_PROGRESS ? new Date() : null,
          })) : undefined,
          ...(serialNumber && { serialNumber }),
          ...truckData,
        };

        // First task gets newResponsibles, subsequent get created IDs
        if (i === 0 && newResponsibles.length > 0) {
          taskData.newResponsibles = newResponsibles;
        } else if (i > 0 && firstCreatedRepIds && firstCreatedRepIds.length > 0) {
          const existing = taskData.responsibleIds || [];
          taskData.responsibleIds = [...existing, ...firstCreatedRepIds];
        }

        try {
          const result = await createTaskAsync(taskData as TaskCreateFormData);
          if (result?.success && result.data) {
            successCount++;
            const createdTaskId = result.data.id;
            if (!firstCreatedTaskId) firstCreatedTaskId = createdTaskId;

            // Extract responsible IDs from first task
            if (i === 0 && newResponsibles.length > 0 && result.data.responsibles) {
              firstCreatedRepIds = result.data.responsibles
                .filter((r: any) => newResponsibles.some(nr => nr.name === r.name && nr.phone === r.phone))
                .map((r: any) => r.id);
            }

            // 9. Update customer data
            for (const config of data.customerConfigs || []) {
              if (config.customerData && config.customerId) {
                try {
                  await customerService.updateCustomer(config.customerId, {
                    corporateName: config.customerData.corporateName || undefined,
                    cnpj: config.customerData.cnpj || undefined,
                    cpf: config.customerData.cpf || undefined,
                    address: config.customerData.address || undefined,
                    addressNumber: config.customerData.addressNumber || undefined,
                    addressComplement: config.customerData.addressComplement || undefined,
                    neighborhood: config.customerData.neighborhood || undefined,
                    city: config.customerData.city || undefined,
                    state: config.customerData.state || undefined,
                    zipCode: config.customerData.zipCode || undefined,
                    stateRegistration: config.customerData.stateRegistration || undefined,
                    streetType: config.customerData.streetType || undefined,
                  });
                } catch {
                  // Error toast is emitted by the axios error interceptor.
                }
              }
            }

            // 10. Create quote for this task
            const quoteData: any = {
              taskId: createdTaskId,
              expiresAt: data.expiresAt,
              status: "PENDING",
              subtotal: data.subtotal || 0,
              total: data.total || 0,
              guaranteeYears: data.guaranteeYears || null,
              customGuaranteeText: data.customGuaranteeText || null,
              customForecastDays: data.customForecastDays || null,
              layoutFileIds,
              simultaneousTasks: data.simultaneousTasks || null,
              customerConfigs: data.customerConfigs || [],
              services: validServices.map((item: any) => ({
                ...item,
                amount: item.amount ?? 0,
              })),
            };

            await createQuoteMutation.mutateAsync(quoteData);
          }
        } catch (error: any) {
          // Error toast is emitted by the axios error interceptor.
          console.error("Error creating task/quote:", error);
        }
      }

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
        navigate(firstCreatedTaskId
          ? routes.production.preparation.details(firstCreatedTaskId)
          : routes.financial.budget.root
        );
      }
    } catch (error: any) {
      // Error toast is emitted by the axios error interceptor.
      console.error("Error in budget creation:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    form,
    responsibleRows,
    artworkFiles,
    artworkFileIds,
    artworkStatuses,
    baseFiles,
    baseFileIds,
    layoutFiles,
    queryClient,
    createTaskAsync,
    createQuoteMutation,
    navigate,
  ]);

  const customerCount = Array.isArray(customerConfigs)
    ? customerConfigs.length
    : 0;
  const isLastStep = currentStep === totalSteps;

  // Permission check
  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">
          Você não tem permissão para criar orçamentos.
        </p>
        <button
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <IconArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title="Cadastrar Orçamento"
        favoritePage={FAVORITE_PAGES.FINANCEIRO_ORCAMENTO_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          { label: "Orçamento", href: routes.financial.budget.root },
          { label: "Cadastrar" },
        ]}
        onBreadcrumbNavigate={(path) => navigate(path)}
        actions={[
          {
            key: "cancel",
            label: "Cancelar",
            onClick: () => navigate(-1),
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
          isLastStep
            ? {
                key: "save",
                label: isSubmitting ? "Salvando..." : "Salvar",
                onClick: handleSubmit,
                variant: "default" as const,
                icon: isSubmitting ? IconLoader2 : IconCheck,
                disabled: isSubmitting,
                loading: isSubmitting,
              }
            : {
                key: "next",
                label: "Próximo",
                onClick: nextStep,
                variant: "default" as const,
                icon: IconArrowRight,
              },
        ]}
      />

      <FormSteps steps={steps} currentStep={currentStep} />

      <div className="flex-1 overflow-y-auto pb-6">
        <FormProvider {...form}>
          {/* Steps 1-3 stay mounted (hidden via CSS) to preserve useFieldArray state */}
          <div style={{ display: currentStep === 1 ? undefined : 'none' }}>
            <BudgetStepTask
              disabled={isSubmitting}
              responsibleRows={responsibleRows}
              onResponsibleRowsChange={handleResponsibleRowsChange}
              showResponsibleErrors={showResponsibleErrors}
              baseFiles={baseFiles}
              onBaseFilesChange={handleBaseFilesChange}
              artworkFiles={artworkFiles}
              onArtworkFilesChange={handleArtworkFilesChange}
              onArtworkStatusChange={handleArtworkStatusChange}
              onPaintCreated={handlePaintCreated}
            />
          </div>

          <div style={{ display: currentStep === 2 ? undefined : 'none' }}>
            <BudgetStepInfo
              disabled={isSubmitting}
              layoutFiles={layoutFiles}
              onLayoutFilesChange={setLayoutFiles}
              artworks={artworks}
              customersCache={customersCache}
              selectedCustomers={selectedCustomers}
              setSelectedCustomers={setSelectedCustomers}
            />
          </div>

          <div style={{ display: currentStep === 3 ? undefined : 'none' }}>
            <BudgetStepServices
              task={null}
              disabled={isSubmitting}
              selectedCustomers={selectedCustomers}
              isCreateMode
            />
          </div>

          {/* Dynamic customer steps — conditional mount is fine (no field arrays) */}
          {currentStep > 3 && currentStep <= 3 + customerCount && (() => {
            const configIndex = currentStep - 4;
            const config = customerConfigs?.[configIndex];
            const customer = config
              ? customersCache.current.get(config.customerId)
              : null;
            return (
              <BudgetStepCustomerPayment
                key={`customer-config-${configIndex}`}
                configIndex={configIndex}
                customer={customer}
                disabled={isSubmitting}
              />
            );
          })()}

          {currentStep === totalSteps && (
            <BudgetStepReview
              task={pseudoTask}
              disabled={isSubmitting}
              userRole={userRole}
              selectedCustomers={selectedCustomers}
              layoutFiles={layoutFiles}
              isCreateMode
            />
          )}
        </FormProvider>
      </div>
    </div>
  );
};

export default FinancialBudgetCreatePage;
