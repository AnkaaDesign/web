import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskDetail, useCurrentUser, useTaskMutations, taskKeys } from "@/hooks";
import { useInvoicesByTask } from "@/hooks/production/use-invoice";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { taskQuoteService } from "@/api-client/task-quote";
import { customerService } from "@/api-client/customer";
import { uploadSingleFile } from "@/api-client/file";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { BillingStepTask } from "@/components/financial/billing/steps/billing-step-task";
import { BillingStepServices } from "@/components/financial/billing/steps/billing-step-services";
import { BillingStepCustomer } from "@/components/financial/billing/steps/billing-step-customer";
import { BillingStepReview } from "@/components/financial/billing/steps/billing-step-review";
import { BillingStepBudgetInfo } from "@/components/financial/billing/steps/billing-step-budget-info";
import { SECTOR_PRIVILEGES, IMPLEMENT_TYPE, routes } from "@/constants";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { canUpdateQuoteStatus, canEditQuote, getQuoteStatusPath } from "@/utils/permissions/quote-permissions";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { readReturnTo } from "@/hooks/common/use-return-to";
import { toast } from "@/components/ui/sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconFileInvoice,
  IconAlertCircle,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { BillingDocumentPreviews } from "@/components/financial/billing/preview/billing-document-previews";
import { useNextNfseNumber } from "@/hooks/financial/use-nfse";

export const BillingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to return after save — set by whoever sent the user here.
  const returnTo = readReturnTo(location.state);
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const customersCache = useRef<Map<string, any>>(new Map());

  usePageTracker({ title: "Faturamento - Detalhes", icon: "file-invoice" });

  const userPrivilege = currentUser?.sector?.privileges || "";
  const canEdit = canEditQuote(userPrivilege) || canUpdateQuoteStatus(userPrivilege);
  // ACCOUNTING is a pure read-only viewer — collapse the multi-step wizard down to
  // just the final review screen (no step indicator, no Anterior/Próximo nav).
  const reviewOnly = userPrivilege === SECTOR_PRIVILEGES.ACCOUNTING;
  const canSeeBudgetInfoStep = [
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.ADMIN,
  ].includes(userPrivilege as SECTOR_PRIVILEGES);

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [layoutFiles, setLayoutFiles] = useState<FileWithPreview[]>([]);
  const [billingApprovalDialogOpen, setBillingApprovalDialogOpen] = useState(false);
  // Predicted NFS-e número (last emitted + 1) — fetched only while the approval modal is open.
  const { data: nextNfse } = useNextNfseNumber(billingApprovalDialogOpen);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dossieCustomerId, setDossieCustomerId] = useState<string>("all");

  // Mutations
  const { updateAsync: updateTaskAsync } = useTaskMutations();

  // Fetch task with billing-related includes
  const { data: taskResponse, isLoading: isTaskLoading } = useTaskDetail(id!, {
    enabled: !!id,
    include: {
      customer: { include: { logo: true } },
      truck: true,
      serviceOrders: {
        include: {
          checkinFiles: true,
          checkoutFiles: true,
        },
        orderBy: { position: "asc" },
      },
      quote: {
        include: {
          services: true,
          layoutFiles: true,
          customerConfigs: {
            include: {
              customer: { include: { logo: true } },
              installments: { orderBy: { number: "asc" } },
              responsible: true,
            },
          },
        },
      },
    },
  });

  const task = taskResponse?.data;
  const quote = task?.quote;

  // Fetch invoices — polls every 3s during generation
  const { data: invoicesData } = useInvoicesByTask(id!, {
    refetchInterval: isGenerating ? 3000 : false,
  });
  const invoices = invoicesData?.data || [];

  // Stop polling when all bank slips/NFSe are in terminal states
  useEffect(() => {
    if (!isGenerating || invoices.length === 0) return;
    const allReady = invoices.every((inv: any) => {
      const installments = inv.installments || [];
      const nfseDocuments = inv.nfseDocuments || [];
      const bankSlipsReady = installments.every((inst: any) => {
        if (!inst.bankSlip) return true;
        return !["CREATING", "REGISTERING"].includes(inst.bankSlip.status);
      });
      const nfseReady = nfseDocuments.every(
        (doc: any) => !["PENDING", "PROCESSING"].includes(doc.status),
      );
      return bankSlipsReady && nfseReady;
    });
    if (allReady) setIsGenerating(false);
  }, [isGenerating, invoices]);

  // Form — billing-relevant task fields + quote fields
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      // Task fields (billing-relevant subset)
      name: "" as string,
      customerId: "" as string,
      plate: "" as string,
      serialNumber: "" as string,
      chassisNumber: "" as string,
      category: "" as string,
      implementType: IMPLEMENT_TYPE.REFRIGERATED as string,
      details: "" as string,
      finishedAt: null as Date | null,
      // Quote fields
      status: "" as string,
      // Optional reason captured by the BillingStepReview reject/cancel dialog.
      // Forwarded to taskQuoteService.updateStatus when transitioning to PENDING.
      statusReason: "" as string,
      expiresAt: null as Date | null,
      subtotal: 0,
      total: 0,
      services: [] as any[],
      customerConfigs: [] as any[],
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
      customForecastDays: null as number | null,
      simultaneousTasks: null as number | null,
      layoutFileIds: [] as string[],
    },
  });

  // Populate form when task/quote data loads
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
      details: task.details || "",
      finishedAt: task.finishedAt ? new Date(task.finishedAt) : null,
    };

    if (!quote) {
      form.reset({
        ...taskFields,
        status: "",
        expiresAt: null,
        subtotal: 0,
        total: 0,
        services: [],
        customerConfigs: [],
        guaranteeYears: null,
        customGuaranteeText: null,
        customForecastDays: null,
        simultaneousTasks: null,
      });
      return;
    }

    // Cache customer data
    quote.customerConfigs?.forEach((config: any) => {
      if (config.customer) {
        customersCache.current.set(config.customerId, config.customer);
      }
    });

    form.reset({
      ...taskFields,
      status: quote.status || "PENDING",
      expiresAt: quote.expiresAt ? new Date(quote.expiresAt) : null,
      subtotal: Number(quote.subtotal) || 0,
      total: Number(quote.total) || 0,
      guaranteeYears: quote.guaranteeYears,
      customGuaranteeText: quote.customGuaranteeText,
      customForecastDays: quote.customForecastDays ?? null,
      simultaneousTasks: quote.simultaneousTasks ?? null,
      layoutFileIds: (quote.layoutFiles || []).map((f: any) => f.id),
      services: (quote.services || []).map((s: any) => ({
        id: s.id,
        description: s.description || "",
        observation: s.observation || null,
        amount: Number(s.amount) || 0,
        invoiceToCustomerId: s.invoiceToCustomerId || null,
      })),
      customerConfigs: (quote.customerConfigs || []).map((config: any) => ({
        id: config.id,
        customerId: config.customerId,
        subtotal: Number(config.subtotal) || 0,
        total: Number(config.total) || 0,
        discountType: config.discountType || "NONE",
        discountValue:
          config.discountValue != null ? Number(config.discountValue) : null,
        discountReference: config.discountReference || null,
        paymentCondition: config.paymentCondition || null,
        paymentConfig: (config.paymentConfig as any) || null,
        customPaymentText: config.customPaymentText || null,
        generateInvoice: config.generateInvoice !== false,
        generateBankSlip: config.generateBankSlip !== false,
        orderNumber: config.orderNumber || null,
        responsibleId: config.responsibleId || null,
        customerData: {
          corporateName: config.customer?.corporateName || "",
          fantasyName: config.customer?.fantasyName || "",
          cnpj: config.customer?.cnpj || "",
          cpf: config.customer?.cpf || "",
          address: config.customer?.address || "",
          addressNumber: config.customer?.addressNumber || "",
          addressComplement: config.customer?.addressComplement || "",
          neighborhood: config.customer?.neighborhood || "",
          city: config.customer?.city || "",
          state: config.customer?.state || "",
          zipCode: config.customer?.zipCode || "",
          stateRegistration: config.customer?.stateRegistration || "",
          streetType: config.customer?.streetType || null,
          registrationStatus: config.customer?.registrationStatus || null,
        },
      })),
    }, { keepDirtyValues: true }); // preserve user edits on background refetch

    // Load layout files from the included layoutFiles relation (array, up to 2)
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

    setLayoutFiles((quote.layoutFiles || []).map(toLayoutFile));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, quote?.id]); // use IDs — object refs change on every refetch and would wipe unsaved edits

  // Dynamic steps: Tarefa → Serviços → Cliente(s) → [Proposta] → Resumo
  const customerConfigs = form.watch("customerConfigs") || [];

  // Skip to summary step when invoices already exist
  const hasInitializedStep = useRef(false);
  useEffect(() => {
    if (hasInitializedStep.current) return;
    if (invoices.length > 0 && customerConfigs.length > 0) {
      // 2 base steps + N customer steps + optional proposta step + 1 summary step
      const summaryStep = 2 + customerConfigs.length + (canSeeBudgetInfoStep ? 1 : 0) + 1;
      setCurrentStep(summaryStep);
      hasInitializedStep.current = true;
    }
  }, [invoices, customerConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => {
    const base: Array<{ id: number; name: string; description: string }> = [
      { id: 1, name: "Tarefa", description: "Dados da tarefa e faturamento" },
    ];
    if (canSeeBudgetInfoStep) {
      base.push({ id: base.length + 1, name: "Proposta", description: "Layout e garantia" });
    }
    base.push({ id: base.length + 1, name: "Serviços", description: "Serviços e preços" });
    customerConfigs.forEach((config: any, i: number) => {
      const cached = customersCache.current.get(config.customerId);
      const name =
        config.customerData?.fantasyName ||
        config.customerData?.corporateName ||
        cached?.fantasyName ||
        "Cliente";
      base.push({ id: base.length + 1, name: `Cliente ${i + 1}`, description: name });
    });
    base.push({ id: base.length + 1, name: "Resumo", description: "Revisão final" });
    return base;
  }, [customerConfigs, canSeeBudgetInfoStep]);

  const totalSteps = steps.length;
  // Step layout: 1=Tarefa, 2=Proposta (if visible), then Serviços, customers, Resumo
  const proposalStepIdx = canSeeBudgetInfoStep ? 2 : null;
  const servicesStepIdx = canSeeBudgetInfoStep ? 3 : 2;
  const firstCustomerStepIdx = servicesStepIdx + 1;

  const STATUSES_REQUIRING_COMPLETE_DATA = [
    "BUDGET_APPROVED",
    "BILLING_APPROVED",
  ];

  // Step validation
  const validateCurrentStep = useCallback(() => {
    if (currentStep === 1) {
      const configs = form.getValues("customerConfigs") || [];
      if (configs.length === 0) {
        toast.error("Selecione pelo menos um cliente para faturamento");
        return false;
      }
      return true;
    }
    if (currentStep === servicesStepIdx) {
      const services = form.getValues("services") || [];
      const validServices = services.filter((s: any) => s.description?.trim());
      if (validServices.length === 0) {
        toast.error("Adicione pelo menos um serviço");
        return false;
      }
      return true;
    }
    return true;
  }, [currentStep, form, servicesStepIdx]);

  // Validate customer required fields — only called when status requires it
  const validateCustomerData = useCallback((): boolean => {
    const configs = form.getValues("customerConfigs") || [];
    const services = form.getValues("services") || [];
    const targetStatus = form.getValues("status");
    const validServices = services.filter((s: any) => s.description?.trim());

    if (targetStatus === "BILLING_APPROVED") {
      const negativeAmountServices = validServices.filter(
        (s: any) => Number(s.amount) < 0,
      );
      if (negativeAmountServices.length > 0) {
        setCurrentStep(servicesStepIdx);
        toast.error("Serviços com valor negativo", {
          description: `${negativeAmountServices.length} serviço(s) com valor negativo. Serviços não podem ter valor negativo para faturamento.`,
        });
        return false;
      }
    }

    if (configs.length >= 2) {
      const unassigned = validServices.filter((s: any) => !s.invoiceToCustomerId);
      if (unassigned.length > 0) {
        setCurrentStep(servicesStepIdx);
        toast.error("Serviços sem cliente atribuído", {
          description: "Todos os serviços devem ter um cliente selecionado em 'Faturar Para'",
        });
        return false;
      }
    }

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const data = config.customerData || {};
      const paymentConfig = form.getValues(`customerConfigs.${i}.paymentConfig` as any);
      const paymentCondition = form.getValues(`customerConfigs.${i}.paymentCondition` as any);
      const errors: string[] = [];
      if (!data.cnpj && !data.cpf) errors.push("CNPJ ou CPF");
      if (!data.fantasyName?.trim()) errors.push("Nome Fantasia");
      if (!data.corporateName?.trim()) errors.push("Razão Social");
      if (!data.zipCode?.trim()) errors.push("CEP");
      if (!data.city?.trim()) errors.push("Cidade");
      if (!data.state?.trim()) errors.push("Estado");
      if (!data.address?.trim()) errors.push("Logradouro");
      if (!data.addressNumber?.trim()) errors.push("Número");
      if (!data.neighborhood?.trim()) errors.push("Bairro");
      if (!paymentCondition && !(paymentConfig as any)?.type) errors.push("Condição de Pagamento");
      if (errors.length > 0) {
        setCurrentStep(firstCustomerStepIdx + i);
        const name = data.fantasyName || data.corporateName || `Cliente ${i + 1}`;
        toast.error(`${name} - campos obrigatórios`, { description: errors.join(", ") });
        return false;
      }
    }

    return true;
  }, [form, servicesStepIdx, firstCustomerStepIdx]);

  const nextStep = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  }, [validateCurrentStep, totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  // Core save logic
  const executeSave = useCallback(async () => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    const targetStatus = formData.status;

    setIsSaving(true);
    try {
      // 1. Update billing-relevant task fields
      const taskUpdateData: any = {
        name: formData.name || undefined,
        customerId: formData.customerId || undefined,
        details: formData.details || undefined,
        serialNumber: formData.serialNumber || null,
        truck: {
          plate: formData.plate || undefined,
          chassisNumber: formData.chassisNumber || undefined,
          category: formData.category || undefined,
          implementType: formData.implementType || undefined,
        },
      };

      await updateTaskAsync({ id: task.id, data: taskUpdateData });

      // 2. Update customer data for NFS-e
      for (const config of formData.customerConfigs) {
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
              registrationStatus: config.customerData.registrationStatus ?? undefined,
            });
          } catch {
            // Error toast is emitted by the axios error interceptor.
          }
        }
      }

      // 3. Upload new layout files if any (COMMERCIAL/ADMIN step). Up to 2 ordered
      // File ids.
      let layoutFileIds: string[] = (formData.layoutFileIds as string[]) || [];
      if (canSeeBudgetInfoStep) {
        const resolvedLayoutIds: string[] = [];
        for (const lf of layoutFiles) {
          if (!lf.uploaded) {
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
          } else {
            const existingId = (lf as any).uploadedFileId || lf.id || null;
            if (existingId) resolvedLayoutIds.push(existingId);
          }
        }
        layoutFileIds = resolvedLayoutIds;
      }

      // 4. Update quote data
      // When the quote is post-billing-approval (locked), only send fields the backend allows
      // editing on a locked quote. Sending billing-structural fields (subtotal, services,
      // customerConfigs) would throw a 400 and prevent the status update from executing.
      const BILLING_LOCKED_STATUSES = ["BILLING_APPROVED", "UPCOMING", "DUE", "PARTIAL", "SETTLED"];
      const isQuoteLocked = quote.status && BILLING_LOCKED_STATUSES.includes(quote.status);

      const quotePayload: any = isQuoteLocked
        ? {
            expiresAt: formData.expiresAt,
            guaranteeYears: formData.guaranteeYears,
            customGuaranteeText: formData.customGuaranteeText,
            customForecastDays: canSeeBudgetInfoStep ? formData.customForecastDays : undefined,
            simultaneousTasks: canSeeBudgetInfoStep ? formData.simultaneousTasks : undefined,
            layoutFileIds: canSeeBudgetInfoStep ? layoutFileIds : undefined,
          }
        : {
            expiresAt: formData.expiresAt,
            subtotal: formData.subtotal,
            total: formData.total,
            guaranteeYears: formData.guaranteeYears,
            customGuaranteeText: formData.customGuaranteeText,
            customForecastDays: canSeeBudgetInfoStep ? formData.customForecastDays : undefined,
            simultaneousTasks: canSeeBudgetInfoStep ? formData.simultaneousTasks : undefined,
            layoutFileIds: canSeeBudgetInfoStep ? layoutFileIds : undefined,
            services: formData.services
              .filter((s: any) => s.description?.trim())
              .map((s: any) => ({
                ...(s.id && { id: s.id }),
                description: s.description,
                observation: s.observation || null,
                amount: Number(s.amount) || 0,
                invoiceToCustomerId: s.invoiceToCustomerId || null,
              })),
            customerConfigs: formData.customerConfigs.map((c: any) => ({
              ...(c.id && { id: c.id }),
              customerId: c.customerId,
              subtotal: Number(c.subtotal) || 0,
              total: Number(c.total) || 0,
              discountType: c.discountType || "NONE",
              discountValue: c.discountValue != null ? Number(c.discountValue) : null,
              discountReference: c.discountReference || null,
              paymentCondition: c.paymentCondition || null,
              paymentConfig: c.paymentConfig ?? null,
              customPaymentText: c.customPaymentText || null,
              generateInvoice: c.generateInvoice !== false,
              generateBankSlip: c.generateBankSlip !== false,
              orderNumber: c.orderNumber || null,
              responsibleId: c.responsibleId || null,
            })),
          };

      // Status handling — two phases, deterministic:
      //  (1) The VALUE update pins the CURRENT status so the backend's
      //      auto-revert-to-PENDING (which fires only when no status is sent) is
      //      suppressed — editing values keeps the existing approval.
      //  (2) The status TRANSITION runs through the dedicated /status endpoint
      //      AFTER the values are saved, so it validates the transition graph AND
      //      its prerequisites (e.g. "total > 0") against the freshly-persisted
      //      values — this is why an immediate/pre-save status change could fail
      //      and leave the quote PENDING. It also handles BILLING_APPROVED's
      //      invoice/boleto/NFS-e generation. Forwards the optional reject reason.
      // Locked quotes (BILLING_APPROVED+) send a reduced payload with no status
      // (those statuses don't auto-revert and the generic path can't change them).
      const statusChanged = targetStatus && targetStatus !== quote.status;

      if (!isQuoteLocked) {
        quotePayload.status = quote.status;
      }

      await taskQuoteService.update(quote.id, quotePayload);

      // For locked quotes, orderNumber is stripped from the main payload to avoid the
      // financial obligation guard. Update it separately via the dedicated endpoint.
      if (isQuoteLocked) {
        const originalConfigs: any[] = (quote as any).customerConfigs || [];
        for (const config of formData.customerConfigs as any[]) {
          const original = originalConfigs.find((c: any) => c.customerId === config.customerId);
          const originalOrderNumber = original?.orderNumber ?? null;
          const newOrderNumber = config.orderNumber || null;
          if (originalOrderNumber !== newOrderNumber) {
            await taskQuoteService.updateCustomerConfigOrderNumber(
              quote.id,
              config.customerId,
              newOrderNumber,
            );
          }
        }
      }

      if (statusChanged) {
        // The dropdown gates options by the FORM status, so the user can advance
        // several steps in one session. The server only accepts single legal
        // hops, so replay the whole path hop-by-hop. Guard: never auto-pass
        // THROUGH BILLING_APPROVED as an intermediate (it triggers invoice/boleto
        // generation) — it may only be the final target.
        const path = getQuoteStatusPath(
          quote.status as TASK_QUOTE_STATUS,
          targetStatus as TASK_QUOTE_STATUS,
        );
        if (path.length === 0) {
          throw new Error(
            `Não há um caminho de status válido de "${quote.status}" até "${targetStatus}".`,
          );
        }
        if (path.slice(0, -1).includes("BILLING_APPROVED" as TASK_QUOTE_STATUS)) {
          throw new Error(
            'Aprove o faturamento como uma etapa separada antes de avançar para o próximo status.',
          );
        }
        const reason = (formData as any).statusReason?.trim() || undefined;
        for (const step of path) {
          await taskQuoteService.updateStatus(
            quote.id,
            step as TASK_QUOTE_STATUS,
            step === "PENDING" ? reason : undefined,
          );
        }
        // Clear once consumed so a later edit doesn't accidentally re-send the same reason.
        form.setValue("statusReason" as any, "");
      }

      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });

      const isBillingApproval =
        targetStatus === "BILLING_APPROVED" && targetStatus !== quote.status;
      if (isBillingApproval) {
        setIsGenerating(true);
        toast.success("Faturamento aprovado! Gerando faturas, boletos e NFS-e...", {
          description: "Aguarde a geração ser concluída.",
          duration: 6000,
        });
      } else {
        navigate(returnTo ?? routes.financial.billing.root);
      }
    } catch {
      // Error toast is emitted by the axios error interceptor.
    } finally {
      setIsSaving(false);
    }
  }, [
    quote?.id,
    quote?.status,
    task?.id,
    form,
    queryClient,
    updateTaskAsync,
    navigate,
    layoutFiles,
    canSeeBudgetInfoStep,
    returnTo,
  ]);

  // Save handler — validates and shows confirmation for BILLING_APPROVED
  const handleSave = useCallback(async () => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    const targetStatus = formData.status;

    const configs = formData.customerConfigs || [];
    const services = formData.services || [];
    if (configs.length === 0) {
      setCurrentStep(1);
      toast.error("Selecione pelo menos um cliente para faturamento");
      return;
    }
    const validServices = services.filter((s: any) => s.description?.trim());
    if (validServices.length === 0) {
      setCurrentStep(servicesStepIdx);
      toast.error("Adicione pelo menos um serviço");
      return;
    }

    if (STATUSES_REQUIRING_COMPLETE_DATA.includes(targetStatus)) {
      if (!validateCustomerData()) return;
    }

    if (targetStatus === "BILLING_APPROVED" && targetStatus !== quote.status) {
      setBillingApprovalDialogOpen(true);
      return;
    }

    await executeSave();
  }, [quote?.id, task?.id, quote?.status, form, validateCustomerData, executeSave, servicesStepIdx]);

  // Loading state
  if (isTaskLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <IconFileInvoice className="h-12 w-12" />
        <p>Tarefa não encontrada</p>
      </div>
    );
  }

  // Build PageHeader actions. Read-only review mode has no step navigation.
  const actions: any[] = [];
  if (!reviewOnly && currentStep > 1) {
    actions.push({
      key: "prev",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: prevStep,
      variant: "outline" as const,
      disabled: isSaving,
    });
  }
  // Step navigation is available to everyone (read-only viewers included) — only
  // "Salvar" is gated by canEdit. Read-only users skip the edit validation so
  // they can page through freely.
  if (!reviewOnly && currentStep < totalSteps) {
    actions.push({
      key: "next",
      label: "Próximo",
      icon: IconArrowRight,
      onClick: canEdit ? nextStep : () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps)),
      variant: "default" as const,
      disabled: isSaving,
    });
  } else if (canEdit) {
    actions.push({
      key: "save",
      label: "Salvar",
      icon: isSaving ? IconLoader2 : IconCheck,
      onClick: handleSave,
      variant: "default" as const,
      disabled: isSaving,
      loading: isSaving,
    });
  }

  // Step detection: 1=Tarefa, 2=Proposta (COMMERCIAL/ADMIN only), then Serviços, Cliente(s), Resumo
  const isProposalStep = proposalStepIdx !== null && currentStep === proposalStepIdx;
  const isServicesStep = currentStep === servicesStepIdx;
  const isReviewStep = currentStep === totalSteps;

  const taskDisplayName = [task.name, task.serialNumber || task.truck?.plate]
    .filter(Boolean)
    .join(" - ");

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.COMMERCIAL,
        // ACCOUNTING gets read-only access: canEditQuote/canUpdateQuoteStatus
        // both exclude it, so every step input is disabled and the Save action
        // is hidden (canEdit === false).
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title={`Faturamento - ${taskDisplayName}`}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Faturamento", href: routes.financial.billing.root },
            { label: taskDisplayName },
          ]}
          onBreadcrumbNavigate={(path) => navigate(path)}
          actions={actions}
          className="flex-shrink-0"
          headerExtra={
            quote?.id && customerConfigs.length > 0 ? (
              <>
                {customerConfigs.length > 1 && (
                  <Combobox
                    value={dossieCustomerId}
                    onValueChange={(v) => setDossieCustomerId((v as string) || "all")}
                    options={[
                      { value: "all", label: "Completo" },
                      ...customerConfigs.map((config: any, i: number) => {
                        const cached = customersCache.current.get(config.customerId);
                        const name =
                          cached?.fantasyName ||
                          cached?.corporateName ||
                          `Cliente ${i + 1}`;
                        return { value: config.customerId, label: name };
                      }),
                    ]}
                    searchable={false}
                    clearable={false}
                    className="w-[260px]"
                    triggerClassName="h-8 text-sm"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 whitespace-nowrap"
                  onClick={() => {
                    const custId =
                      dossieCustomerId === "all"
                        ? customerConfigs[0]?.customerId
                        : dossieCustomerId;
                    if (custId && quote?.id) {
                      window.open(
                        routes.customer.serviceReport(custId, quote.id),
                        "_blank",
                      );
                    }
                  }}
                >
                  <IconExternalLink className="h-4 w-4" />
                  Ver Dossiê
                </Button>
              </>
            ) : undefined
          }
        />

        {!reviewOnly && <FormSteps steps={steps} currentStep={currentStep} className="flex-shrink-0" />}

        <div className="flex-1 overflow-y-auto pb-6">
          <FormProvider {...form}>
            {/* Tarefa, Serviços, and customer steps stay mounted (hidden via CSS) to preserve useFieldArray state */}
            {!reviewOnly && (
              <>
                <div style={{ display: currentStep === 1 ? undefined : "none" }}>
                  <BillingStepTask
                    disabled={!canEdit}
                    customersCache={customersCache}
                    initialCustomer={task?.customer}
                  />
                </div>

                {isProposalStep && (
                  <BillingStepBudgetInfo
                    disabled={!canEdit}
                    layoutFiles={layoutFiles}
                    onLayoutFilesChange={setLayoutFiles}
                  />
                )}

                <div style={{ display: isServicesStep ? undefined : "none" }}>
                  <BillingStepServices disabled={!canEdit} />
                </div>

                {/* Customer steps — always mounted (hidden via CSS) so form values survive navigation */}
                {customerConfigs.map((config: any, i: number) => {
                  const cachedCustomer = customersCache.current.get(config.customerId);
                  return (
                    <div key={config.customerId || i} style={{ display: currentStep === firstCustomerStepIdx + i ? undefined : "none" }}>
                      <BillingStepCustomer
                        configIndex={i}
                        customer={cachedCustomer}
                        disabled={!canEdit}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {(isReviewStep || reviewOnly) && (
              <BillingStepReview
                task={task}
                customersCache={customersCache}
                invoices={invoices}
                userPrivilege={userPrivilege}
                disabled={!canEdit}
                isGenerating={isGenerating}
                filterCustomerId={
                  dossieCustomerId !== "all" ? dossieCustomerId : undefined
                }
              />
            )}
          </FormProvider>
        </div>
      </div>

      {/* Billing Approval Confirmation Dialog */}
      <AlertDialog open={billingApprovalDialogOpen} onOpenChange={setBillingApprovalDialogOpen}>
        <AlertDialogContent className="max-w-3xl w-[95vw] border-red-500 border-2 max-h-[92vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <IconAlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <AlertDialogTitle className="text-xl text-red-700 dark:text-red-400">
                Faturamento Aprovado - Ação Irreversível
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          {/* Faithful previews of the NFS-e + boletos that will be generated */}
          <div className="my-2">
            <p className="mb-2 text-sm font-medium text-foreground">
              Confira os documentos que serão gerados automaticamente:
            </p>
            <BillingDocumentPreviews
              customerConfigs={form.watch("customerConfigs")}
              services={form.watch("services")}
              nextNfseNumber={nextNfse?.nextNumber ?? null}
              task={{
                plate: form.watch("plate"),
                serialNumber: form.watch("serialNumber"),
                chassisNumber: form.watch("chassisNumber"),
                category: form.watch("category"),
                implementType: form.watch("implementType"),
              }}
            />
          </div>

          <div className="rounded-lg border-2 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 my-2 space-y-3">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Ao confirmar, as seguintes ações serão executadas automaticamente:
            </p>
            <ul className="text-sm text-red-700 dark:text-red-400 space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">1.</span>
                <span><strong>Faturas</strong> serão geradas para cada cliente vinculado ao orçamento</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">2.</span>
                <span><strong>Boletos bancários</strong> serão emitidos automaticamente no Sicredi para cada parcela</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">3.</span>
                <span><strong>Notas Fiscais (NFS-e)</strong> serão emitidas automaticamente para cada fatura</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 my-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Verifique antes de confirmar:
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-400 mt-1 space-y-1 list-disc list-inside">
              <li>Valores, descontos e condições de pagamento estão corretos?</li>
              <li>Os dados do(s) cliente(s) estão atualizados (CNPJ/CPF, endereço)?</li>
              <li>As parcelas e datas de vencimento estão configuradas?</li>
            </ul>
          </div>

          <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
            Essa ação não pode ser desfeita facilmente. Boletos e notas fiscais emitidos precisarão
            ser cancelados manualmente caso haja algum erro.
          </AlertDialogDescription>

          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                setBillingApprovalDialogOpen(false);
                await executeSave();
              }}
            >
              {isSaving ? "Processando..." : "Confirmar Faturamento Aprovado"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
};

export default BillingDetailPage;
