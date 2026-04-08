import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskDetail, useCurrentUser, taskKeys } from "@/hooks";
import { useInvoicesByTask } from "@/hooks/production/use-invoice";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { taskQuoteService } from "@/api-client/task-quote";
import { customerService } from "@/api-client/customer";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { BillingStepInfo } from "@/components/financial/billing/steps/billing-step-info";
import { BillingStepServices } from "@/components/financial/billing/steps/billing-step-services";
import { BillingStepCustomer } from "@/components/financial/billing/steps/billing-step-customer";
import { BillingStepReview } from "@/components/financial/billing/steps/billing-step-review";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { canUpdateQuoteStatus, canEditQuote } from "@/utils/permissions/quote-permissions";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { toast } from "@/components/ui/sonner";
import { IconArrowLeft, IconArrowRight, IconCheck, IconLoader2, IconFileInvoice, IconAlertCircle, IconExternalLink } from "@tabler/icons-react";
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

export const BillingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const customersCache = useRef<Map<string, any>>(new Map());

  usePageTracker({ title: "Faturamento - Detalhes", icon: "file-invoice" });

  const userPrivilege = currentUser?.sector?.privileges || "";
  const canEdit = canEditQuote(userPrivilege) || canUpdateQuoteStatus(userPrivilege);

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [billingApprovalDialogOpen, setBillingApprovalDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dossieCustomerId, setDossieCustomerId] = useState<string>("all");

  // Fetch task with billing-related includes
  const { data: taskResponse, isLoading: isTaskLoading } = useTaskDetail(id!, {
    enabled: !!id,
    include: {
      customer: { include: { logo: true } },
      truck: true,
      responsibles: true,
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

  // Fetch invoices for installments/bank slips/NFS-e — polls every 3s during generation
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
        return !['CREATING', 'REGISTERING'].includes(inst.bankSlip.status);
      });
      const nfseReady = nfseDocuments.every((doc: any) =>
        !['PENDING', 'PROCESSING'].includes(doc.status)
      );
      return bankSlipsReady && nfseReady;
    });
    if (allReady) {
      setIsGenerating(false);
    }
  }, [isGenerating, invoices]);

  // Form setup
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      status: "" as string,
      expiresAt: null as Date | null,
      subtotal: 0,
      total: 0,
      services: [] as any[],
      customerConfigs: [] as any[],
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
    },
  });

  // Populate form when quote data loads
  useEffect(() => {
    if (!quote) return;

    // Cache customer data
    quote.customerConfigs?.forEach((config: any) => {
      if (config.customer) {
        customersCache.current.set(config.customerId, config.customer);
      }
    });

    form.reset({
      status: quote.status || "PENDING",
      expiresAt: quote.expiresAt ? new Date(quote.expiresAt) : null,
      subtotal: Number(quote.subtotal) || 0,
      total: Number(quote.total) || 0,
      guaranteeYears: quote.guaranteeYears,
      customGuaranteeText: quote.customGuaranteeText,
      services: (quote.services || []).map((s: any) => ({
        id: s.id,
        description: s.description || "",
        observation: s.observation || null,
        amount: Number(s.amount) || 0,
        invoiceToCustomerId: s.invoiceToCustomerId || null,
        discountType: s.discountType || "NONE",
        discountValue: s.discountValue ? Number(s.discountValue) : null,
        discountReference: s.discountReference || null,
      })),
      customerConfigs: (quote.customerConfigs || []).map((config: any) => ({
        id: config.id,
        customerId: config.customerId,
        subtotal: Number(config.subtotal) || 0,
        total: Number(config.total) || 0,
        paymentCondition: config.paymentCondition || null,

        customPaymentText: config.customPaymentText || null,
        generateInvoice: config.generateInvoice !== false,
        orderNumber: config.orderNumber || null,
        responsibleId: config.responsibleId || null,
        // Embedded customer data for NFS-e editing
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
        },
      })),
    });
  }, [quote, form]);

  // Dynamic steps based on customer configs
  const customerConfigs = form.watch("customerConfigs") || [];

  // Skip to summary step when invoices already exist (past internal approach)
  const hasInitializedStep = useRef(false);
  useEffect(() => {
    if (hasInitializedStep.current) return;
    if (invoices.length > 0 && customerConfigs.length > 0) {
      // 2 base steps + N customer steps + 1 summary step
      const summaryStep = 2 + customerConfigs.length + 1;
      setCurrentStep(summaryStep);
      hasInitializedStep.current = true;
    }
  }, [invoices, customerConfigs]);

  const steps = useMemo(() => {
    const base = [
      { id: 1, name: "Informações", description: "Dados da tarefa e clientes" },
      { id: 2, name: "Serviços", description: "Serviços e preços" },
    ];
    customerConfigs.forEach((config: any, i: number) => {
      const cached = customersCache.current.get(config.customerId);
      const name = config.customerData?.fantasyName || config.customerData?.corporateName || cached?.fantasyName || "Cliente";
      base.push({
        id: 3 + i,
        name: `Cliente ${i + 1}`,
        description: name,
      });
    });
    base.push({ id: base.length + 1, name: "Resumo", description: "Revisão final" });
    return base;
  }, [customerConfigs]);

  const totalSteps = steps.length;

  // Statuses that require complete customer data for NFS-e/boleto generation
  const STATUSES_REQUIRING_COMPLETE_DATA = ["VERIFIED_BY_FINANCIAL", "BILLING_APPROVED"];

  // Step validation - only basic checks, no required field validation on step change
  const validateCurrentStep = useCallback(() => {
    if (currentStep === 1) {
      const configs = form.getValues("customerConfigs") || [];
      if (configs.length === 0) {
        toast.error("Selecione pelo menos um cliente para faturamento");
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      const services = form.getValues("services") || [];
      const validServices = services.filter((s: any) => s.description?.trim());
      if (validServices.length === 0) {
        toast.error("Adicione pelo menos um serviço");
        return false;
      }
      return true;
    }
    return true;
  }, [currentStep, form]);

  // Validate customer required fields - only called when status requires it
  const validateCustomerData = useCallback((): boolean => {
    const configs = form.getValues("customerConfigs") || [];
    const services = form.getValues("services") || [];
    const targetStatus = form.getValues("status");
    const validServices = services.filter((s: any) => s.description?.trim());

    // For BILLING_APPROVED: no service may have negative amount (zero is allowed — service performed at no cost)
    if (targetStatus === "BILLING_APPROVED") {
      const negativeAmountServices = validServices.filter((s: any) => Number(s.amount) < 0);
      if (negativeAmountServices.length > 0) {
        setCurrentStep(2);
        toast.error("Serviços com valor negativo", {
          description: `${negativeAmountServices.length} serviço(s) com valor negativo. Os serviços não podem ter valor negativo para faturamento.`,
        });
        return false;
      }
    }

    // Multi-customer: all services must have invoiceToCustomerId
    if (configs.length >= 2) {
      const unassigned = validServices.filter((s: any) => !s.invoiceToCustomerId);
      if (unassigned.length > 0) {
        setCurrentStep(2);
        toast.error("Serviços sem cliente atribuído", {
          description: "Todos os serviços devem ter um cliente selecionado em 'Faturar Para'",
        });
        return false;
      }
    }

    // Validate each customer config
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const data = config.customerData || {};
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
      if (!config.paymentCondition) errors.push("Condição de Pagamento");
      if (errors.length > 0) {
        setCurrentStep(3 + i);
        const name = data.fantasyName || data.corporateName || `Cliente ${i + 1}`;
        toast.error(`${name} - campos obrigatórios`, { description: errors.join(", ") });
        return false;
      }
    }

    return true;
  }, [form]);

  const nextStep = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  }, [validateCurrentStep, totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);




  // Core save logic (called directly or after confirmation dialog)
  const executeSave = useCallback(async () => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    const targetStatus = formData.status;

    setIsSaving(true);

    try {
      // 1. Update customer data (address, CNPJ, etc. for NFS-e)
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
            });
          } catch (err: any) {
            toast.error(`Erro ao atualizar cliente: ${err?.message || "Erro desconhecido"}`);
          }
        }
      }

      // 2. Update quote data
      const quotePayload: any = {
        expiresAt: formData.expiresAt,
        subtotal: formData.subtotal,
        total: formData.total,
        guaranteeYears: formData.guaranteeYears,
        customGuaranteeText: formData.customGuaranteeText,
        services: formData.services
          .filter((s: any) => s.description?.trim())
          .map((s: any) => ({
            ...(s.id && { id: s.id }),
            description: s.description,
            observation: s.observation || null,
            amount: Number(s.amount) || 0,
            invoiceToCustomerId: s.invoiceToCustomerId || null,
            discountType: s.discountType || "NONE",
            discountValue: s.discountValue ? Number(s.discountValue) : null,
            discountReference: s.discountReference || null,
          })),
        customerConfigs: formData.customerConfigs.map((c: any) => ({
          ...(c.id && { id: c.id }),
          customerId: c.customerId,
          subtotal: Number(c.subtotal) || 0,
          total: Number(c.total) || 0,
          paymentCondition: c.paymentCondition || null,

          customPaymentText: c.customPaymentText || null,
          generateInvoice: c.generateInvoice !== false,
          orderNumber: c.orderNumber || null,
          responsibleId: c.responsibleId || null,
        })),
      };

      await taskQuoteService.update(quote.id, quotePayload);

      // 3. Update status if changed
      if (targetStatus && targetStatus !== quote.status) {
        await taskQuoteService.updateStatus(quote.id, targetStatus as TASK_QUOTE_STATUS);
      }

      // Invalidate all billing-related caches
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });

      // If billing was just approved, stay on page and start polling for generation progress
      const isBillingApproval = targetStatus === "BILLING_APPROVED" && targetStatus !== quote.status;
      if (isBillingApproval) {
        setIsGenerating(true);
        toast.success("Faturamento aprovado! Gerando faturas, boletos e NFS-e...", {
          description: "Aguarde a geração ser concluída.",
          duration: 6000,
        });
      } else {
        toast.success("Faturamento atualizado com sucesso");
        navigate(routes.financial.billing.root);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar faturamento");
    } finally {
      setIsSaving(false);
    }
  }, [quote?.id, task?.id, quote?.status, form, queryClient, navigate]);

  // Save handler - validates and shows confirmation for BILLING_APPROVED
  const handleSave = useCallback(async () => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    const targetStatus = formData.status;

    // Basic validation always required
    const configs = formData.customerConfigs || [];
    const services = formData.services || [];
    if (configs.length === 0) {
      setCurrentStep(1);
      toast.error("Selecione pelo menos um cliente para faturamento");
      return;
    }
    const validServices = services.filter((s: any) => s.description?.trim());
    if (validServices.length === 0) {
      setCurrentStep(2);
      toast.error("Adicione pelo menos um serviço");
      return;
    }

    // If status requires complete data, validate all customer fields
    if (STATUSES_REQUIRING_COMPLETE_DATA.includes(targetStatus)) {
      if (!validateCustomerData()) return;
    }

    // Show confirmation dialog for BILLING_APPROVED (triggers invoice/boleto/NFS-e generation)
    if (targetStatus === "BILLING_APPROVED" && targetStatus !== quote.status) {
      setBillingApprovalDialogOpen(true);
      return;
    }

    await executeSave();
  }, [quote?.id, task?.id, quote?.status, form, validateCustomerData, executeSave]);

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

  // Build PageHeader actions
  const actions: any[] = [];

  if (currentStep > 1) {
    actions.push({
      key: "prev",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: prevStep,
      variant: "outline" as const,
      disabled: isSaving,
    });
  }

  if (canEdit) {
    if (currentStep < totalSteps) {
      actions.push({
        key: "next",
        label: "Próximo",
        icon: IconArrowRight,
        onClick: nextStep,
        variant: "default" as const,
        disabled: isSaving,
      });
    } else {
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
  }


  // Resolve current customer config for customer steps (between step 3 and totalSteps - 1)
  const isCustomerStep = currentStep >= 3 && currentStep < totalSteps;
  const isReviewStep = currentStep === totalSteps;
  const customerStepIndex = currentStep - 3; // 0-based index into customerConfigs
  const currentConfig = isCustomerStep ? customerConfigs[customerStepIndex] : null;
  const currentCustomer = currentConfig ? customersCache.current.get(currentConfig.customerId) : null;

  // Dynamic title matching budget form pattern
  const taskDisplayName = [task.name, task.serialNumber || task.truck?.plate].filter(Boolean).join(" - ");
  const sectionLabel = "Faturamento";

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title={`${sectionLabel} - ${taskDisplayName}`}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Faturamento", href: routes.financial.billing.root },
            { label: taskDisplayName },
          ]}
          onBreadcrumbNavigate={(path) => navigate(path)}
          actions={actions}
          className="flex-shrink-0"
          headerExtra={quote?.id && customerConfigs.length > 0 ? (
            <>
              {customerConfigs.length > 1 && (
                <Combobox
                  value={dossieCustomerId}
                  onValueChange={(v) => setDossieCustomerId((v as string) || "all")}
                  options={[
                    { value: "all", label: "Completo" },
                    ...customerConfigs.map((config: any, i: number) => {
                      const cached = customersCache.current.get(config.customerId);
                      const name = cached?.fantasyName || cached?.corporateName || `Cliente ${i + 1}`;
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
                  const custId = dossieCustomerId === "all" ? customerConfigs[0]?.customerId : dossieCustomerId;
                  if (custId && quote?.id) {
                    window.open(routes.customer.serviceReport(custId, quote.id), "_blank");
                  }
                }}
              >
                <IconExternalLink className="h-4 w-4" />
                Ver Dossiê
              </Button>
            </>
          ) : undefined}
        />

        <FormSteps steps={steps} currentStep={currentStep} className="flex-shrink-0" />

        <div className="flex-1 overflow-y-auto pb-6">
          <FormProvider {...form}>
            <div>
              {currentStep === 1 && (
                <BillingStepInfo
                  task={task}
                  disabled={!canEdit}
                  customersCache={customersCache}
                />
              )}
              {currentStep === 2 && (
                <BillingStepServices disabled={!canEdit} />
              )}
              {isCustomerStep && currentConfig && (
                <BillingStepCustomer
                  key={currentConfig.customerId || customerStepIndex}
                  configIndex={customerStepIndex}
                  customer={currentCustomer}
                  disabled={!canEdit}
                />
              )}
              {isReviewStep && (
                <BillingStepReview
                  task={task}
                  customersCache={customersCache}
                  invoices={invoices}
                  userPrivilege={userPrivilege}
                  disabled={!canEdit}
                  isGenerating={isGenerating}
                  filterCustomerId={dossieCustomerId !== "all" ? dossieCustomerId : undefined}
                />
              )}
            </div>
          </FormProvider>
        </div>
      </div>

      {/* Billing Approval Confirmation Dialog */}
      <AlertDialog open={billingApprovalDialogOpen} onOpenChange={setBillingApprovalDialogOpen}>
        <AlertDialogContent className="max-w-lg border-red-500 border-2">
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
            Essa ação não pode ser desfeita facilmente. Boletos e notas fiscais emitidos precisarão ser cancelados manualmente caso haja algum erro.
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
