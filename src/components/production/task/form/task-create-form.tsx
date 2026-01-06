import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconLoader2,
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconFileText,
  IconHash,
  IconLicense,
} from "@tabler/icons-react";
import type { TaskCreateFormData } from "../../../../schemas";
import { taskCreateSchema } from "../../../../schemas";
import { useTaskMutations } from "../../../../hooks";
import { TASK_STATUS } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerSelector } from "./customer-selector";
import { toast } from "sonner";

export const TaskCreateForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with simple default values
  const form = useForm<TaskCreateFormData>({
    resolver: zodResolver(taskCreateSchema),
    mode: "onChange",
    defaultValues: {
      status: TASK_STATUS.PREPARATION,
      name: "",
      customerId: "",
      serialNumber: "",
      truck: {
        plate: "",
      },
    },
  });

  // Mutations
  const { createAsync } = useTaskMutations();

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: TaskCreateFormData) => {
      try {
        setIsSubmitting(true);

        const result = await createAsync(data as any);
        if (result?.success && result.data) {
          // Navigate after success message
          window.location.href = "/producao/cronograma";
        } else {
          toast.error(result?.message || "Erro ao criar tarefa");
        }
      } catch (error) {
        console.error("Error creating task:", error);
        toast.error("Erro ao criar tarefa");
      } finally {
        setIsSubmitting(false);
      }
    },
    [createAsync],
  );

  const handleCancel = useCallback(() => {
    window.location.href = "/producao/cronograma";
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
      <PageHeader
        title="Cadastrar Tarefa"
        icon={IconClipboardList}
        variant="form"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Produção", href: "/producao" },
          { label: "Cronograma", href: "/producao/cronograma" },
          { label: "Cadastrar" }
        ]}
        actions={navigationActions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <Form {...form}>
          <form id="task-form-submit" className="space-y-4">
            {/* Basic Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconClipboardList className="h-5 w-5" />
                  Informações da Tarefa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconFileText className="h-4 w-4" />
                        Nome
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value || ""}
                          onChange={(value) => field.onChange(value)}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          placeholder="Ex: Pintura completa do caminhão"
                          disabled={isSubmitting}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Serial Number Field */}
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconHash className="h-4 w-4" />
                        Número de Série
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value || ""}
                          placeholder="Ex: ABC-123456"
                          className="uppercase bg-transparent"
                          onChange={(value) => {
                            const upperValue = (value || "").toUpperCase();
                            field.onChange(upperValue);
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Plate Field */}
                <FormField
                  control={form.control}
                  name="truck.plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconLicense className="h-4 w-4" />
                        Placa
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value || ""}
                          placeholder="Ex: ABC1234"
                          className="uppercase bg-transparent"
                          onChange={(value) => {
                            const upperValue = (value || "").toUpperCase();
                            field.onChange(upperValue);
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Customer Selector */}
                <CustomerSelector control={form.control} disabled={isSubmitting} />
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </>
  );
};
