import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import {
  routes,
  IMPLEMENT_TYPE,
} from "@/constants";
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
} from "@/utils/permissions/quote-permissions";
import { validateResponsibleRows } from "@/components/administration/customer/responsible";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "@/components/ui/sonner";
import { uploadSingleFile, getFileById } from "@/api-client/file";
import { getCustomers } from "@/api-client";
import { customerService } from "@/api-client/customer";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
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

  const handleArtworkFilesChange = useCallback((files: FileWithPreview[]) => {
    setArtworkFiles(files);
  }, []);

  const handleArtworkStatusChange = useCallback((fileId: string, status: string) => {
    setArtworkStatuses((prev) => ({ ...prev, [fileId]: status }));
  }, []);

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
      implementType: IMPLEMENT_TYPE.REFRIGERATED as string,
      forecastDate: null as Date | null,
      term: null as Date | null,
      details: "" as string,
      paintId: null as string | null,
      paintIds: [] as string[],
      serviceOrders: [] as any[],
      // Quote fields
      expiresAt: getDefaultExpiresAt(),
      status: "PENDING" as string,
      subtotal: 0,
      total: 0,
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
      customForecastDays: null as number | null,
      layoutFileId: null as string | null,
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
      implementType: task.truck?.implementType || IMPLEMENT_TYPE.REFRIGERATED,
      forecastDate: task.forecastDate ? new Date(task.forecastDate) : null,
      term: task.term ? new Date(task.term) : null,
      details: task.details || "",
      serviceOrders: task.serviceOrders || [],
      paintId: task.paintId || null,
      paintIds: task.paintIds?.map((p: any) => p.id || p) || [],
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
        layoutFileId: null,
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
      layoutFileId: existingQuote.layoutFileId || null,
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

    // Set layout files from included data, or fetch separately when the API
    // doesn't include the layoutFile relation (e.g. running an older build).
    if (existingQuote.layoutFile) {
      setLayoutFiles([
        {
          id: existingQuote.layoutFile.id,
          name: existingQuote.layoutFile.filename || "layout",
          size: existingQuote.layoutFile.size || 0,
          type:
            existingQuote.layoutFile.mimetype || "application/octet-stream",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: existingQuote.layoutFile.id,
          thumbnailUrl: existingQuote.layoutFile.thumbnailUrl,
        } as FileWithPreview,
      ]);
    } else if (existingQuote.layoutFileId) {
      getFileById(existingQuote.layoutFileId)
        .then((response) => {
          const file = response?.data;
          if (file?.id) {
            setLayoutFiles([
              {
                id: file.id,
                name: file.filename || "layout",
                size: file.size || 0,
                type: file.mimetype || "application/octet-stream",
                lastModified: Date.now(),
                uploaded: true,
                uploadProgress: 100,
                uploadedFileId: file.id,
                thumbnailUrl: file.thumbnailUrl,
              } as FileWithPreview,
            ]);
          }
        })
        .catch(() => { /* layout will still display via artwork selector if applicable */ });
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
    if (task.responsibles?.length > 0) {
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

    // Artworks
    if (task.artworks?.length > 0) {
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
        } as FileWithPreview;
      });
      setArtworkFiles(artworkFilesList);

      const statuses: Record<string, string> = {};
      task.artworks.forEach((artwork: any) => {
        const fileId = (artwork.file || artwork).id;
        if (artwork.status) statuses[fileId] = artwork.status;
      });
      setArtworkStatuses(statuses);
    }
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const uploadedArtworkIds: string[] = [];
      const remappedArtworkStatuses: Record<string, string> = {};
      for (const file of artworkFiles) {
        if (file.uploaded && file.uploadedFileId) {
          uploadedArtworkIds.push(file.uploadedFileId);
          if (artworkStatuses[file.id]) {
            remappedArtworkStatuses[file.uploadedFileId] =
              artworkStatuses[file.id];
          }
        } else if (!file.error) {
          try {
            const response = await uploadSingleFile(file, {
              fileContext: "artwork",
            });
            if (response.success && response.data) {
              uploadedArtworkIds.push(response.data.id);
              if (artworkStatuses[file.id]) {
                remappedArtworkStatuses[response.data.id] =
                  artworkStatuses[file.id];
              }
            }
          } catch (error: any) {
            toast.error(
              `Erro ao enviar artwork ${file.name}: ${error.message}`,
            );
          }
        }
      }

      // 2. Upload new layout files
      let layoutFileId = data.layoutFileId;
      const newLayoutFiles = layoutFiles.filter((f) => !f.uploaded);
      if (newLayoutFiles.length > 0) {
        try {
          const response = await uploadSingleFile(newLayoutFiles[0], {
            fileContext: "quote-layout",
          });
          if (response.success && response.data) {
            layoutFileId = response.data.id;
          }
        } catch (error: any) {
          toast.error(`Erro ao enviar layout: ${error.message}`);
        }
      }

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

      // 4. Update task
      const serviceOrders = (data.serviceOrders || []).filter(
        (so: any) => so?.description?.trim()?.length >= 3,
      );
      const taskUpdateData: any = {
        name: data.name || undefined,
        customerId: data.customerId || undefined,
        details: data.details || undefined,
        forecastDate: data.forecastDate || undefined,
        term: data.term || undefined,
        paintId: data.paintId || null,
        paintIds:
          data.paintIds && data.paintIds.length > 0
            ? data.paintIds
            : undefined,
        serialNumber: data.serialNumber || null,
        serviceOrders: serviceOrders.length > 0 ? serviceOrders : undefined,
        artworkIds:
          uploadedArtworkIds.length > 0 ? uploadedArtworkIds : undefined,
        artworkStatuses:
          Object.keys(remappedArtworkStatuses).length > 0
            ? remappedArtworkStatuses
            : undefined,
        responsibleIds:
          existingRepIds.length > 0 ? existingRepIds : undefined,
        newResponsibles:
          newResponsibles.length > 0 ? newResponsibles : undefined,
        truck: {
          plate: data.plate || undefined,
          chassisNumber: data.chassisNumber || undefined,
          category: data.category || undefined,
          implementType: data.implementType || undefined,
        },
      };

      try {
        await updateTaskAsync({ id: taskId, data: taskUpdateData });
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Erro ao atualizar tarefa.",
        );
        setIsSubmitting(false);
        return;
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
          } catch (err: any) {
            toast.error(
              `Erro ao atualizar cliente: ${err?.message || "Erro desconhecido"}`,
            );
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
        layoutFileId: layoutFileId || null,
        simultaneousTasks: data.simultaneousTasks || null,
        customerConfigs: data.customerConfigs || [],
        services: validServices.map((item: any) => ({
          ...item,
          amount: item.amount ?? 0,
        })),
      };

      if (existingQuote?.id) {
        await updateQuoteMutation.mutateAsync({
          id: existingQuote.id,
          data: quoteData,
        });
      } else {
        quoteData.status = "PENDING";
        await createQuoteMutation.mutateAsync(quoteData);
      }

      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      toast.success(
        existingQuote
          ? "Tarefa e orçamento atualizados com sucesso!"
          : "Tarefa e orçamento criados com sucesso!",
      );
      navigate(-1);
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
  ]);

  // Handle status change
  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (!existingQuote?.id) return;
      try {
        await taskQuoteService.updateStatus(existingQuote.id, newStatus);
        queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
        toast.success("Status atualizado com sucesso!");
      } catch (error: any) {
        console.error("Error updating quote status:", error);
        toast.error(
          error?.response?.data?.message || "Erro ao atualizar status.",
        );
      }
    },
    [existingQuote, queryClient],
  );

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

  const customerCount = Array.isArray(customerConfigs)
    ? customerConfigs.length
    : 0;
  const isLastStep = currentStep === totalSteps;

  const artworks = (task.artworks || []).map((artwork: any) => {
    const file = artwork.file || artwork;
    return {
      id: file.id,
      artworkId: artwork.artworkId || artwork.id,
      filename: file.filename,
      originalName: file.originalName,
      thumbnailUrl: file.thumbnailUrl,
      status: artwork.status,
      mimetype: file.mimetype,
      size: file.size,
    };
  });

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
              baseFiles={[]}
              onBaseFilesChange={() => {}}
              artworkFiles={artworkFiles}
              onArtworkFilesChange={handleArtworkFilesChange}
              onArtworkStatusChange={handleArtworkStatusChange}
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

          {/* Dynamic customer steps */}
          {currentStep > 3 &&
            currentStep <= 3 + customerCount &&
            (() => {
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
                  disabled={isSubmitting || !canEdit}
                  taskResponsibles={task?.responsibles}
                />
              );
            })()}

          {currentStep === totalSteps && (
            <BudgetStepReview
              task={task}
              disabled={isSubmitting || !canEdit}
              existingQuote={existingQuote}
              userRole={userRole}
              selectedCustomers={selectedCustomers}
              onStatusChange={handleStatusChange}
              layoutFiles={layoutFiles}
            />
          )}
        </FormProvider>
      </div>
    </div>
  );
};

export default FinancialBudgetDetailPage;
