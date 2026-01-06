import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconCut, IconFileText, IconPlus, IconTrash, IconInfoCircle, IconClipboardList } from "@tabler/icons-react";
import { useState } from "react";
import type { Cut, File as FileType, Task } from "../../../../types";
import { CUT_TYPE, CUT_ORIGIN, CUT_TYPE_LABELS } from "../../../../constants";
import { useCutMutations } from "../../../../hooks";
import { useToast } from "@/hooks/use-toast";

// Schema for individual cut plan item
const cutPlanItemSchema = z.object({
  type: z.nativeEnum(CUT_TYPE),
  quantity: z.number().int().min(1).max(50),
  notes: z.string().optional(),
});

// Schema for the entire cut plan
const cutPlanSchema = z.object({
  fileId: z.string().uuid("ID do arquivo deve ser um UUID válido"),
  taskId: z.string().uuid("ID da tarefa deve ser um UUID válido").nullable().optional(),
  planName: z.string().min(1, "Nome do plano é obrigatório").max(100),
  planDescription: z.string().optional(),
  cutItems: z.array(cutPlanItemSchema).min(1, "Pelo menos um item de corte é necessário"),
});

type CutPlanFormData = z.infer<typeof cutPlanSchema>;
type CutPlanItem = z.infer<typeof cutPlanItemSchema>;

interface CutPlanFormProps {
  fileId?: string;
  fileName?: string;
  taskId?: string;
  taskName?: string;
  onSuccess?: (cuts: Cut[]) => void;
  onCancel?: () => void;
  className?: string;
}

export function CutPlanForm({ fileId, fileName, taskId, taskName, onSuccess, onCancel, className }: CutPlanFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { batchCreate } = useCutMutations();

  const form = useForm<CutPlanFormData>({
    resolver: zodResolver(cutPlanSchema),
    defaultValues: {
      fileId: fileId || "",
      taskId: taskId || null,
      planName: "",
      planDescription: "",
      cutItems: [
        {
          type: CUT_TYPE.VINYL,
          quantity: 1,
          notes: "",
        },
      ],
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "cutItems",
  });

  const handleSubmit = async (data: CutPlanFormData) => {
    if (!data.fileId) {
      toast({
        title: "Erro",
        description: "É necessário selecionar um arquivo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create cuts based on the plan
      const cuts = data.cutItems.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          fileId: data.fileId,
          type: item.type,
          origin: CUT_ORIGIN.PLAN,
          ...(data.taskId && { taskId: data.taskId }),
        })),
      );

      const response = await batchCreate.mutateAsync({
        data: { cuts },
        include: {
          file: true,
          task: {
            include: {
              customer: true,
            },
          },
        },
      });

      const totalCuts = cuts.length;
      toast({
        title: "Plano de corte criado",
        description: `${totalCuts} corte(s) criado(s) conforme o plano "${data.planName}".`,
      });

      onSuccess?.(response.data.success);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar plano de corte.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCutItem = () => {
    append({
      type: CUT_TYPE.VINYL,
      quantity: 1,
      notes: "",
    });
  };

  const removeCutItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Calculate total cuts
  const totalCuts = form.watch("cutItems").reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconClipboardList className="h-5 w-5 text-primary" />
          Criar Plano de Corte
        </CardTitle>

        {/* Context info */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {fileName && (
            <div className="flex items-center gap-2">
              <IconFileText className="h-4 w-4" />
              <span>Arquivo: {fileName}</span>
            </div>
          )}
          {taskName && (
            <div className="flex items-center gap-2">
              <IconCut className="h-4 w-4" />
              <span>Tarefa: {taskName}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* File selection - only if not provided */}
            {!fileId && (
              <FormField
                control={form.control}
                name="fileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arquivo *</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        // TODO: Implement file selector with files list
                        options={[{ value: "placeholder", label: "Selecionar arquivo..." }]}
                        placeholder="Selecione um arquivo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Task selection - only if not provided */}
            {!taskId && (
              <FormField
                control={form.control}
                name="taskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarefa (Opcional)</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || undefined}
                        onValueChange={(value) => field.onChange(value || null)}
                        // TODO: Implement task selector with tasks list
                        options={[{ value: "placeholder", label: "Selecionar tarefa..." }]}
                        placeholder="Selecionar tarefa..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Plan details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="planName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Plano *</FormLabel>
                    <FormControl>
                      <Input value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} placeholder="Ex: Cortes para produção inicial" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-end">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Total de cortes:</span>
                  <Badge variant="secondary" className="ml-2">
                    {totalCuts}
                  </Badge>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="planDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Plano (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="Descreva o objetivo deste plano de corte..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Cut items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Itens do Plano</h3>
                <Button type="button" variant="outline" size="sm" onClick={addCutItem} className="flex items-center gap-2">
                  <IconPlus className="h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCutItem(index)} className="text-red-600 hover:text-red-700">
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`cutItems.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Corte</FormLabel>
                              <FormControl>
                                <Combobox
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                                    value,
                                    label,
                                  }))}
                                  placeholder="Tipo"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`cutItems.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantidade</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} max={50} placeholder="1" {...field} onChange={(value) => field.onChange(typeof value === "number" ? value : 1)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`cutItems.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Observações</FormLabel>
                              <FormControl>
                                <Input value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} placeholder="Observações..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Info alert */}
            <Alert className="border-blue-200 bg-blue-50">
              <IconInfoCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Todos os cortes serão criados com status "Pendente" e origem "Plano". O plano organiza os cortes necessários para a produção.
              </AlertDescription>
            </Alert>

            {/* Form actions */}
            <div className="flex gap-3 pt-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={!form.formState.isValid || isSubmitting || totalCuts === 0} className="min-w-[140px]">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Criando...
                  </div>
                ) : (
                  `Criar Plano (${totalCuts} cortes)`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
