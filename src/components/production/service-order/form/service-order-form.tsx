import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServiceOrderDetail, useServiceOrderMutations } from "../../../../hooks";
import type { ServiceOrderCreateFormData, ServiceOrderUpdateFormData } from "../../../../schemas";
import { serviceOrderCreateSchema, serviceOrderUpdateSchema, mapServiceOrderToFormData } from "../../../../schemas";
import { routes, FAVORITE_PAGES, SERVICE_ORDER_STATUS } from "../../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "sonner";
import { TaskSelector } from "./task-selector";
import { CustomerDisplay } from "./customer-display";
import { DescriptionInput } from "./description-input";
import { StatusSelector } from "./status-selector";
import { StartedAtPicker } from "./started-at-picker";
import { FinishedAtPicker } from "./finished-at-picker";
import { IconFileText, IconDeviceFloppy, IconX } from "@tabler/icons-react";

interface ServiceOrderFormProps {
  serviceOrderId?: string;
  mode: "create" | "edit";
  initialTaskId?: string;
  onSuccess?: (serviceOrder: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function ServiceOrderForm({ serviceOrderId, mode, initialTaskId, onSuccess, onCancel, className }: ServiceOrderFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing service order if editing
  const { data: serviceOrderResponse, isLoading: isLoadingServiceOrder } = useServiceOrderDetail(serviceOrderId || "", {
    enabled: mode === "edit" && !!serviceOrderId,
    include: {
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
    },
  });

  const serviceOrder = serviceOrderResponse?.data;

  // Mutations
  const { createAsync, updateAsync } = useServiceOrderMutations();

  // Set up form with appropriate schema
  const formSchema = mode === "create" ? serviceOrderCreateSchema : serviceOrderUpdateSchema;
  const form = useForm<ServiceOrderCreateFormData | ServiceOrderUpdateFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      description: "",
      taskId: initialTaskId || "",
      status: SERVICE_ORDER_STATUS.PENDING,
      startedAt: undefined,
      finishedAt: undefined,
    },
  });

  // Watch form values for validation logic
  const watchedTaskId = form.watch("taskId");
  const watchedStartedAt = form.watch("startedAt");
  const watchedStatus = form.watch("status");

  // Initialize form with existing data when editing
  useEffect(() => {
    if (mode === "edit" && serviceOrder) {
      const formData = mapServiceOrderToFormData(serviceOrder);
      form.reset(formData);
    }
  }, [mode, serviceOrder, form]);

  // Auto-update status based on dates
  useEffect(() => {
    if (mode === "create") {
      const startedAt = form.getValues("startedAt");
      const finishedAt = form.getValues("finishedAt");

      if (finishedAt) {
        form.setValue("status", SERVICE_ORDER_STATUS.COMPLETED);
      } else if (startedAt) {
        form.setValue("status", SERVICE_ORDER_STATUS.IN_PROGRESS);
      } else {
        form.setValue("status", SERVICE_ORDER_STATUS.PENDING);
      }
    }
  }, [watchedStartedAt, form, mode]);

  // Form submission handler
  const onSubmit = async (data: ServiceOrderCreateFormData | ServiceOrderUpdateFormData) => {
    setIsSubmitting(true);

    try {
      let result;

      if (mode === "create") {
        result = await createAsync(data as ServiceOrderCreateFormData);
        // Success toast is handled automatically by API client
      } else {
        result = await updateAsync({
          id: serviceOrderId!,
          data: data as ServiceOrderUpdateFormData,
        });
        // Success toast is handled automatically by API client
      }

      if (onSuccess) {
        onSuccess(result.data);
      } else {
        navigate(routes.production.serviceOrders.details(result.data.id));
      }
    } catch (error) {
      // Error is handled by the global error handler
      console.error("Service order form error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel handler
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(routes.production.serviceOrders.root);
    }
  };

  // Loading state for edit mode
  if (mode === "edit" && isLoadingServiceOrder) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <div className="px-4 pt-4">
            <div className="max-w-3xl mx-auto">
              <PageHeader
                title="Carregando..."
                icon={IconFileText}
                breadcrumbs={[{ label: "Produção", href: routes.production.root }, { label: "Ordens de Serviço", href: routes.production.serviceOrders.root }, { label: "Editar" }]}
              />
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Page actions
  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      icon: IconX,
    },
    {
      key: "submit",
      label: mode === "create" ? "Cadastrar" : "Salvar Alterações",
      onClick: form.handleSubmit(onSubmit),
      variant: "default" as const,
      icon: IconDeviceFloppy,
      disabled: isSubmitting || !form.formState.isValid,
      loading: isSubmitting,
    },
  ];

  return (
    <div className={`h-full flex flex-col ${className || ""}`}>
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
            <PageHeader
              title={mode === "create" ? "Cadastrar Ordem de Serviço" : "Editar Ordem de Serviço"}
              icon={IconFileText}
              favoritePage={mode === "create" ? FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_CADASTRAR : FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_LISTAR}
              breadcrumbs={[
                { label: "Produção", href: routes.production.root },
                { label: "Ordens de Serviço", href: routes.production.serviceOrders.root },
                { label: mode === "create" ? "Cadastrar" : "Editar" },
              ]}
              actions={actions}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Task Selection Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações da Tarefa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TaskSelector control={form.control} disabled={isSubmitting || mode === "edit"} />
                  <CustomerDisplay taskId={watchedTaskId} />
                </CardContent>
              </Card>

              {/* Service Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Serviço</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DescriptionInput control={form.control} disabled={isSubmitting} />
                  <StatusSelector control={form.control} disabled={isSubmitting} />
                </CardContent>
              </Card>

              {/* Scheduling Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Agendamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StartedAtPicker control={form.control} disabled={isSubmitting} />
                  <FinishedAtPicker control={form.control} disabled={isSubmitting} startedAt={watchedStartedAt} />
                </CardContent>
              </Card>

              {/* Hidden submit button for form submission */}
              <button type="submit" className="hidden" />
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
