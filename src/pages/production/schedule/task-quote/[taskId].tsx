import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import { useTaskDetail } from "../../../../hooks";
import {
  useTaskQuoteByTask,
  useCreateTaskQuote,
  useUpdateTaskQuote,
  taskQuoteKeys,
} from "../../../../hooks/production/use-task-quote";
import { taskQuoteService } from "../../../../api-client/task-quote";
import {
  canViewQuote,
  canEditQuote,
} from "@/utils/permissions/quote-permissions";
import { taskQuoteCreateNestedSchema } from "../../../../schemas/task-quote";
import { useAuth } from "../../../../contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "@/components/ui/sonner";
import { uploadSingleFile } from "../../../../api-client/file";
import { getCustomers } from "../../../../api-client";
import type { FileWithPreview } from "@/components/common/file";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";

// Step components
import { QuoteStepInfo } from "@/components/production/task/quote/steps/quote-step-info";
import { QuoteStepServices } from "@/components/production/task/quote/steps/quote-step-services";
import { QuoteStepCustomerPayment } from "@/components/production/task/quote/steps/quote-step-customer-payment";
import { QuoteStepReview } from "@/components/production/task/quote/steps/quote-step-review";

function getDefaultExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 59, 999);
  return date;
}

export default function TaskQuotePage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch task data
  const { data: taskResponse, isLoading: taskLoading } = useTaskDetail(
    taskId || "",
  );
  const task = taskResponse?.data;

  // Fetch existing quote
  const { data: quoteResponse, isLoading: quoteLoading } =
    useTaskQuoteByTask(taskId || "");
  const existingQuote = quoteResponse?.data?.data || quoteResponse?.data;

  // Mutations
  const createQuoteMutation = useCreateTaskQuote();
  const updateQuoteMutation = useUpdateTaskQuote();

  // Permissions
  const userRole = user?.sector?.privileges || "";
  const canView = canViewQuote(userRole);
  const canEdit = canEditQuote(userRole);

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [layoutFiles, setLayoutFiles] = useState<FileWithPreview[]>([]);
  const customersCache = useRef<Map<string, any>>(new Map());
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, any>>(
    new Map(),
  );

  // Dynamic label based on status
  const quoteStatus = existingQuote?.status as TASK_QUOTE_STATUS | undefined;
  const isDraftOrNone = !quoteStatus || quoteStatus === "PENDING";
  const sectionLabel = isDraftOrNone ? "Orçamento" : "Faturamento";

  // Form - FLAT fields (no `quote.` prefix)
  const form = useForm({
    mode: "onChange",
    defaultValues: {
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
          discountType: "NONE",
          discountValue: null,
          discountReference: null,
        },
      ] as any[],
    },
  });

  // Populate form with existing quote data
  useEffect(() => {
    if (!existingQuote) return;

    form.reset({
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
          paymentCondition: c.paymentCondition || null,
          downPaymentDate: c.downPaymentDate
            ? new Date(c.downPaymentDate)
            : null,
          customPaymentText: c.customPaymentText || null,
          responsibleId: c.responsibleId || null,
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
              discountType: item.discountType || "NONE",
              discountValue: item.discountValue != null ? Number(item.discountValue) : null,
              discountReference: item.discountReference || null,
            }))
          : [
              {
                description: "",
                amount: null,
                observation: null,
                invoiceToCustomerId: null,
                discountType: "NONE",
                discountValue: null,
                discountReference: null,
              },
            ],
    });

    // Set layout files
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
    }

    // Initialize customers cache from existing configs
    if (existingQuote.customerConfigs?.length > 0) {
      const customers = existingQuote.customerConfigs
        .map((c: any) => c.customer)
        .filter(Boolean);
      customers.forEach((c: any) => customersCache.current.set(c.id, c));
      setSelectedCustomers(new Map(customers.map((c: any) => [c.id, c])));
    }
  }, [existingQuote, form]);

  // Dynamic steps based on customer count
  const customerConfigs = form.watch("customerConfigs");
  const steps = useMemo(() => {
    const base = [
      { id: 1, name: "Informações", description: "Dados da tarefa e clientes" },
      { id: 2, name: "Serviços", description: "Serviços e preços" },
    ];
    if (Array.isArray(customerConfigs)) {
      customerConfigs.forEach((config: any, i: number) => {
        const customer = customersCache.current.get(config?.customerId);
        base.push({
          id: 3 + i,
          name: "Pagamento",
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
      case 2: {
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
      // Filter empty services
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

      // Upload new layout files
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

      const quoteData = {
        taskId,
        expiresAt: data.expiresAt,
        status: data.status || "PENDING",
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
        await createQuoteMutation.mutateAsync(quoteData);
      }

      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      toast.success(
        existingQuote
          ? "Orçamento atualizado com sucesso!"
          : "Orçamento criado com sucesso!",
      );
      navigate(-1);
    } catch (error: any) {
      console.error("Error saving quote:", error);
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
    queryClient,
    createQuoteMutation,
    updateQuoteMutation,
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
        <Button
          variant="outline"
          onClick={() => navigate("/producao/agenda")}
        >
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

  const taskIdentifier =
    task.serialNumber || task.truck?.plate || task.name || "Tarefa";
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
        title={`${sectionLabel} - ${taskIdentifier}`}
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
          ...(canEdit
            ? [
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
              ]
            : []),
        ]}
        onNavigateBack={() => navigate(-1)}
      />

      <FormSteps steps={steps} currentStep={currentStep} />

      <div className="flex-1 overflow-y-auto pb-6">
        <FormProvider {...form}>
          {currentStep === 1 && (
            <QuoteStepInfo
              task={task}
              disabled={isSubmitting || !canEdit}
              layoutFiles={layoutFiles}
              onLayoutFilesChange={setLayoutFiles}
              artworks={artworks}
              customersCache={customersCache}
              selectedCustomers={selectedCustomers}
              setSelectedCustomers={setSelectedCustomers}
            />
          )}

          {currentStep === 2 && (
            <QuoteStepServices
              task={task}
              disabled={isSubmitting || !canEdit}
              selectedCustomers={selectedCustomers}
            />
          )}

          {currentStep > 2 && currentStep <= 2 + customerCount && (() => {
            const configIndex = currentStep - 3;
            const config = customerConfigs?.[configIndex];
            const customer = config
              ? customersCache.current.get(config.customerId)
              : null;
            return (
              <QuoteStepCustomerPayment
                configIndex={configIndex}
                customer={customer}
                disabled={isSubmitting || !canEdit}
                taskResponsibles={task?.responsibles}
              />
            );
          })()}

          {currentStep === totalSteps && (
            <QuoteStepReview
              disabled={isSubmitting || !canEdit}
              existingQuote={existingQuote}
              userRole={userRole}
              selectedCustomers={selectedCustomers}
              onStatusChange={handleStatusChange}
            />
          )}
        </FormProvider>
      </div>
    </div>
  );
}
