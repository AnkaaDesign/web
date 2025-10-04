import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconCheck, IconTruck, IconRuler, IconId, IconMap, IconLayout } from "@tabler/icons-react";
import type { TruckUpdateFormData, Truck } from "../../../../schemas";
import { truckUpdateSchema, mapTruckToFormData } from "../../../../schemas";
import { useTruckMutations } from "../../../../hooks";
import { TRUCK_MANUFACTURER, TRUCK_MANUFACTURER_LABELS, routes } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Combobox } from "@/components/ui/combobox";
import { LayoutSelector } from "@/components/production/layout/layout-selector";
import { toast } from "sonner";

interface TruckEditFormProps {
  truck: Truck;
  onSuccess?: (truckId: string) => void;
}

export function TruckEditForm({ truck, onSuccess }: TruckEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const form = useForm<TruckUpdateFormData>({
    resolver: zodResolver(truckUpdateSchema),
    mode: "onChange",
    defaultValues: mapTruckToFormData(truck),
  });

  // Update form when truck data changes
  useEffect(() => {
    const formData = mapTruckToFormData(truck);
    form.reset(formData);
  }, [truck, form]);

  const { update } = useTruckMutations();

  const handleSubmit = async (data: TruckUpdateFormData) => {
    try {
      setIsSubmitting(true);

      const result = await update({ id: truck.id, data });

      if (result?.success && result.data) {
        // Success toast is handled automatically by API client

        if (onSuccess) {
          onSuccess(result.data.id);
        } else {
          navigate(routes.production.trucks?.details?.(result.data.id) || `/production/trucks/details/${result.data.id}`);
        }
      } else {
        toast.error(result?.message || "Erro ao atualizar caminhão");
      }
    } catch (error) {
      console.error("Error updating truck:", error);
      toast.error("Erro ao atualizar caminhão. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.production.trucks?.details?.(truck.id) || `/production/trucks/details/${truck.id}`);
  };

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
      label: "Salvar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: form.handleSubmit(handleSubmit),
      variant: "default" as const,
      disabled: !form.formState.isValid || isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4">
          <PageHeader
            title={`Editar Caminhão - ${truck.plate}`}
            icon={IconTruck}
            variant="form"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Caminhões", href: routes.production.trucks?.list || "/production/trucks" },
              {
                label: truck.plate,
                href: routes.production.trucks?.details?.(truck.id) || `/production/trucks/details/${truck.id}`,
              },
              { label: "Editar" },
            ]}
            actions={navigationActions}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-4 h-full overflow-y-auto">
          <Form {...form}>
            <form className="space-y-6 py-2">
              {/* Basic Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconId className="h-5 w-5" />
                    Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Plate and Model */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="plate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Placa <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="plate" {...field} value={field.value || ""} disabled={isSubmitting} />
                          </FormControl>
                          <FormDescription>Formato: ABC1234 ou ABC-1234</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Modelo <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="Ex: Constellation 26.280" disabled={isSubmitting} maxLength={100} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Manufacturer */}
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Montadora <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value}
                            onValueChange={field.onChange}
                            options={Object.values(TRUCK_MANUFACTURER).map((manufacturer) => ({
                              value: manufacturer,
                              label: TRUCK_MANUFACTURER_LABELS[manufacturer],
                            }))}
                            placeholder="Selecione a montadora"
                            emptyText="Nenhuma montadora encontrada"
                            searchPlaceholder="Buscar montadora..."
                            searchable={false}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>


              {/* Position Card (Optional) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconMap className="h-5 w-5" />
                    Posição (Opcional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="xPosition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição X</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="Ex: 10.50"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormDescription>Coordenada X na garagem (em metros)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="yPosition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição Y</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="Ex: 5.25"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormDescription>Coordenada Y na garagem (em metros)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Layouts Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconLayout className="h-5 w-5" />
                    Layouts do Caminhão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="leftSideLayoutId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Layout Lateral Esquerdo</FormLabel>
                          <FormControl>
                            <LayoutSelector
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Selecione o layout"
                              disabled={isSubmitting}
                              side="left"
                            />
                          </FormControl>
                          <FormDescription>Layout para o lado esquerdo do caminhão</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rightSideLayoutId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Layout Lateral Direito</FormLabel>
                          <FormControl>
                            <LayoutSelector
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Selecione o layout"
                              disabled={isSubmitting}
                              side="right"
                            />
                          </FormControl>
                          <FormDescription>Layout para o lado direito do caminhão</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="backSideLayoutId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Layout Traseiro</FormLabel>
                          <FormControl>
                            <LayoutSelector
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Selecione o layout"
                              disabled={isSubmitting}
                              side="back"
                            />
                          </FormControl>
                          <FormDescription>Layout para a parte traseira do caminhão</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Relations Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconTruck className="h-5 w-5" />
                    Vínculos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="taskId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            ID da Tarefa <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="ID da tarefa associada" disabled={isSubmitting} />
                          </FormControl>
                          <FormDescription>Tarefa à qual este caminhão está vinculado</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="garageId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID da Garagem</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="ID da garagem (opcional)" disabled={isSubmitting} />
                          </FormControl>
                          <FormDescription>Garagem onde o caminhão está estacionado</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
