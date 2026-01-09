import { useState, useCallback, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconLoader2,
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { TaskCreateFormData } from "../../../../schemas";
import { taskCreateSchema } from "../../../../schemas";
import { useTaskMutations } from "../../../../hooks";
import { TASK_STATUS, TRUCK_CATEGORY, IMPLEMENT_TYPE, TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Combobox } from "@/components/ui/combobox";
import { CustomerSelector } from "./customer-selector";
import { PlateTagsInput } from "./plate-tags-input";
import { SerialNumberRangeInput } from "./serial-number-range-input";
import { TaskNameAutocomplete } from "./task-name-autocomplete";
import { toast } from "sonner";

// Extended form schema for the UI
const taskCreateFormSchema = z.object({
  status: z.string(),
  name: z.string(),
  customerId: z.string(),
  plates: z.array(z.string()).default([]),
  serialNumbers: z.array(z.number()).default([]),
  category: z.string().optional(),
  implementType: z.string().optional(),
}).refine((data) => {
  // At least one of: plates, serialNumbers, name, or customerId must be provided
  return data.plates.length > 0 || data.serialNumbers.length > 0 || data.name || data.customerId;
}, {
  message: "Pelo menos um dos seguintes campos deve ser preenchido: Placas, Números de série, Nome ou Cliente",
  path: ["name"],
});

type TaskCreateFormSchemaType = z.infer<typeof taskCreateFormSchema>;

export const TaskCreateForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with simple default values
  const form = useForm<TaskCreateFormSchemaType>({
    resolver: zodResolver(taskCreateFormSchema),
    mode: "onChange",
    defaultValues: {
      status: TASK_STATUS.PREPARATION,
      name: "",
      customerId: "",
      plates: [],
      serialNumbers: [],
      category: "",
      implementType: "",
    },
  });

  // Mutations
  const { createAsync } = useTaskMutations();

  // Watch form values for task count calculation
  const plates = useWatch({ control: form.control, name: "plates" }) || [];
  const serialNumbers = useWatch({ control: form.control, name: "serialNumbers" }) || [];

  // Calculate how many tasks will be created
  const taskCount = useMemo(() => {
    const platesCount = plates.length;
    const serialNumbersCount = serialNumbers.length;

    if (platesCount > 0 && serialNumbersCount > 0) {
      return platesCount * serialNumbersCount;
    } else if (platesCount > 0) {
      return platesCount;
    } else if (serialNumbersCount > 0) {
      return serialNumbersCount;
    } else {
      return 1;
    }
  }, [plates, serialNumbers]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: TaskCreateFormSchemaType) => {
      try {
        setIsSubmitting(true);

        const { plates, serialNumbers, name, customerId, status, category, implementType } = data;

        // Determine combinations
        let tasksToCreate: TaskCreateFormData[] = [];

        if (plates.length > 0 && serialNumbers.length > 0) {
          // Create a task for each combination of plate and serial number
          for (const plate of plates) {
            for (const serialNumber of serialNumbers) {
              tasksToCreate.push({
                status,
                name: name || undefined,
                customerId: customerId || undefined,
                serialNumber: serialNumber.toString(),
                truck: {
                  plate,
                  category: category || undefined,
                  implementType: implementType || undefined,
                },
              } as TaskCreateFormData);
            }
          }
        } else if (plates.length > 0) {
          // Create a task for each plate
          for (const plate of plates) {
            tasksToCreate.push({
              status,
              name: name || undefined,
              customerId: customerId || undefined,
              truck: {
                plate,
                category: category || undefined,
                implementType: implementType || undefined,
              },
            } as TaskCreateFormData);
          }
        } else if (serialNumbers.length > 0) {
          // Create a task for each serial number
          for (const serialNumber of serialNumbers) {
            tasksToCreate.push({
              status,
              name: name || undefined,
              customerId: customerId || undefined,
              serialNumber: serialNumber.toString(),
            } as TaskCreateFormData);
          }
        } else {
          // Create a single task with just name and/or customer
          tasksToCreate.push({
            status,
            name: name || undefined,
            customerId: customerId || undefined,
          } as TaskCreateFormData);
        }

        // Create all tasks
        let successCount = 0;
        let errorCount = 0;

        for (const task of tasksToCreate) {
          try {
            const result = await createAsync(task as any);
            if (result?.success) {
              successCount++;
            } else {
              errorCount++;
              console.error("Failed to create task:", result?.message);
            }
          } catch (error) {
            errorCount++;
            console.error("Error creating task:", error);
          }
        }

        // Show summary message
        if (successCount > 0 && errorCount === 0) {
          toast.success(
            tasksToCreate.length === 1
              ? "Tarefa criada com sucesso!"
              : `${successCount} tarefas criadas com sucesso!`
          );
          // Navigate after success
          window.location.href = "/producao/agenda";
        } else if (successCount > 0 && errorCount > 0) {
          toast.warning(
            `${successCount} tarefas criadas, mas ${errorCount} falharam. Verifique os detalhes.`
          );
          // Still navigate after partial success
          window.location.href = "/producao/agenda";
        } else {
          toast.error("Erro ao criar tarefas");
        }
      } catch (error) {
        console.error("Error creating tasks:", error);
        toast.error("Erro ao criar tarefas");
      } finally {
        setIsSubmitting(false);
      }
    },
    [createAsync],
  );

  const handleCancel = useCallback(() => {
    window.location.href = "/producao/agenda";
  }, []);

  // Get form state
  const { formState } = form;
  const hasErrors = Object.keys(formState.errors).length > 0;

  // Navigation actions
  const navigationActions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      icon: IconArrowLeft,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: form.handleSubmit(handleSubmit),
      variant: "default" as const,
      disabled: isSubmitting || hasErrors,
      loading: isSubmitting,
    },
  ];

  return (
    <>
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          title="Cadastrar Tarefa"
          icon={IconClipboardList}
          variant="form"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Produção", href: "/producao" },
            { label: "Agenda", href: "/producao/agenda" },
            { label: "Cadastrar" }
          ]}
          actions={navigationActions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <Form {...form}>
          <form id="task-form-submit" className="container mx-auto max-w-4xl space-y-4">
            {/* Basic Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconClipboardList className="h-5 w-5" />
                  Informações da Tarefa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name Field with Autocomplete */}
                <TaskNameAutocomplete control={form.control} disabled={isSubmitting} />

                {/* Customer Selector */}
                <CustomerSelector control={form.control} disabled={isSubmitting} />

                {/* Truck Category and Implement Type - Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Truck Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Categoria do Caminhão</FormLabel>
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={[
                            { value: "", label: "Nenhuma" },
                            ...Object.values(TRUCK_CATEGORY).map((cat) => ({
                              value: cat,
                              label: TRUCK_CATEGORY_LABELS[cat],
                            })),
                          ]}
                          placeholder="Selecione a categoria"
                          searchPlaceholder="Buscar categoria..."
                          emptyText="Nenhuma categoria encontrada"
                          disabled={isSubmitting}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Truck Implement Type */}
                  <FormField
                    control={form.control}
                    name="implementType"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Tipo de Implemento</FormLabel>
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={[
                            { value: "", label: "Nenhum" },
                            ...Object.values(IMPLEMENT_TYPE).map((type) => ({
                              value: type,
                              label: IMPLEMENT_TYPE_LABELS[type],
                            })),
                          ]}
                          placeholder="Selecione o tipo de implemento"
                          searchPlaceholder="Buscar tipo de implemento..."
                          emptyText="Nenhum tipo de implemento encontrado"
                          disabled={isSubmitting}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Plate Tags Input */}
                <PlateTagsInput
                  control={form.control}
                  disabled={isSubmitting || serialNumbers.length > 1}
                />

                {/* Serial Number Range Input */}
                <SerialNumberRangeInput
                  control={form.control}
                  disabled={isSubmitting || plates.length > 1}
                />

                {/* Task Count Preview - only show when combining plates and serial numbers */}
                {plates.length > 0 && serialNumbers.length > 0 && taskCount > 1 && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {taskCount} tarefas serão criadas
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          {plates.length} {plates.length === 1 ? 'placa' : 'placas'} × {serialNumbers.length} {serialNumbers.length === 1 ? 'número de série' : 'números de série'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </>
  );
};
