import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { IconCut, IconTrash, IconEdit, IconCheck, IconPlay, IconClock, IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import type { Cut } from "../../../../types";
import { CUT_STATUS, CUT_STATUS_LABELS, CUT_TYPE_LABELS } from "../../../../constants";
import { useCutMutations } from "../../../../hooks";
import { useToast } from "@/hooks/use-toast";

type BatchOperation = "delete" | "updateStatus" | "updateType";

const batchOperationSchema = z.object({
  operation: z.enum(["delete", "updateStatus", "updateType"] as const),
  status: z.nativeEnum(CUT_STATUS).optional(),
  type: z.enum(["VINYL", "STENCIL"] as const).optional(),
  notes: z.string().optional(),
});

type BatchOperationFormData = z.infer<typeof batchOperationSchema>;

interface CutBatchOperationsProps {
  selectedCuts: Cut[];
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function CutBatchOperations({ selectedCuts, onSuccess, onCancel, className }: CutBatchOperationsProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { batchUpdate, batchDelete } = useCutMutations();

  const form = useForm<BatchOperationFormData>({
    resolver: zodResolver(batchOperationSchema),
    defaultValues: {
      operation: "updateStatus",
      notes: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const watchedOperation = form.watch("operation");

  const handleSubmit = async (data: BatchOperationFormData) => {
    if (selectedCuts.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum corte selecionado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let result;

      switch (data.operation) {
        case "delete":
          result = await batchDelete.mutateAsync({
            data: {
              cutIds: selectedCuts.map((cut) => cut.id),
            },
          });
          toast({
            title: "Cortes excluídos",
            description: `${selectedCuts.length} corte(s) excluído(s) com sucesso.`,
          });
          break;

        case "updateStatus":
          if (!data.status) {
            toast({
              title: "Erro",
              description: "Status é obrigatório para esta operação.",
              variant: "destructive",
            });
            return;
          }

          const statusUpdates = selectedCuts.map((cut) => ({
            id: cut.id,
            status: data.status!,
            // Add timestamps based on status
            ...(data.status === CUT_STATUS.CUTTING && { startedAt: new Date() }),
            ...(data.status === CUT_STATUS.COMPLETED && { completedAt: new Date() }),
          }));

          result = await batchUpdate.mutateAsync({
            data: { cuts: statusUpdates },
            include: {
              file: true,
              task: {
                include: {
                  customer: true,
                },
              },
            },
          });

          toast({
            title: "Status atualizado",
            description: `${selectedCuts.length} corte(s) atualizado(s) para "${CUT_STATUS_LABELS[data.status]}".`,
          });
          break;

        case "updateType":
          if (!data.type) {
            toast({
              title: "Erro",
              description: "Tipo é obrigatório para esta operação.",
              variant: "destructive",
            });
            return;
          }

          const typeUpdates = selectedCuts.map((cut) => ({
            id: cut.id,
            type: data.type!,
          }));

          result = await batchUpdate.mutateAsync({
            data: { cuts: typeUpdates },
            include: {
              file: true,
              task: {
                include: {
                  customer: true,
                },
              },
            },
          });

          toast({
            title: "Tipo atualizado",
            description: `${selectedCuts.length} corte(s) atualizado(s) para "${CUT_TYPE_LABELS[data.type]}".`,
          });
          break;
      }

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao executar operação em lote.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOperationIcon = (operation: BatchOperation) => {
    switch (operation) {
      case "delete":
        return IconTrash;
      case "updateStatus":
        return IconEdit;
      case "updateType":
        return IconCut;
    }
  };

  const getOperationColor = (operation: BatchOperation) => {
    switch (operation) {
      case "delete":
        return "text-red-600";
      case "updateStatus":
        return "text-blue-600";
      case "updateType":
        return "text-green-600";
    }
  };

  const OperationIcon = getOperationIcon(watchedOperation);

  // Group cuts by status and type for display
  const cutsByStatus = selectedCuts.reduce(
    (acc, cut) => {
      acc[cut.status] = (acc[cut.status] || 0) + 1;
      return acc;
    },
    {} as Record<CUT_STATUS, number>,
  );

  const cutsByType = selectedCuts.reduce(
    (acc, cut) => {
      acc[cut.type] = (acc[cut.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <OperationIcon className={`h-5 w-5 ${getOperationColor(watchedOperation)}`} />
          Operações em Lote
        </CardTitle>

        {/* Selection summary */}
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">{selectedCuts.length} corte(s) selecionado(s)</span>
          </div>

          {/* Status breakdown */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span>Por status:</span>
              {Object.entries(cutsByStatus).map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {CUT_STATUS_LABELS[status as CUT_STATUS]}: {count}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span>Por tipo:</span>
              {Object.entries(cutsByType).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {CUT_TYPE_LABELS[type as keyof typeof CUT_TYPE_LABELS]}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Operation selection */}
            <FormField
              control={form.control}
              name="operation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operação</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={[
                        {
                          value: "updateStatus",
                          label: "Atualizar Status",
                          icon: <IconEdit className="h-4 w-4" />,
                        },
                        {
                          value: "updateType",
                          label: "Atualizar Tipo",
                          icon: <IconCut className="h-4 w-4" />,
                        },
                        {
                          value: "delete",
                          label: "Excluir Cortes",
                          icon: <IconTrash className="h-4 w-4 text-red-600" />,
                          className: "text-red-600",
                        },
                      ]}
                      placeholder="Selecione a operação"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Operation-specific fields */}
            {watchedOperation === "updateStatus" && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo Status</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        options={Object.entries(CUT_STATUS_LABELS).map(([value, label]) => ({
                          value,
                          label,
                          icon:
                            value === CUT_STATUS.PENDING ? (
                              <IconClock className="h-4 w-4 text-yellow-600" />
                            ) : value === CUT_STATUS.CUTTING ? (
                              <IconPlay className="h-4 w-4 text-blue-600" />
                            ) : value === CUT_STATUS.COMPLETED ? (
                              <IconCheck className="h-4 w-4 text-green-600" />
                            ) : undefined,
                        }))}
                        placeholder="Selecione o status"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchedOperation === "updateType" && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo Tipo</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onValueChange={field.onChange}
                        options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        placeholder="Selecione o tipo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Notes field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="Adicione observações sobre a operação..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Warning for destructive operations */}
            {watchedOperation === "delete" && (
              <Alert className="border-red-200 bg-red-50">
                <IconAlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Atenção:</strong> Esta operação não pode ser desfeita. Todos os {selectedCuts.length} corte(s) selecionado(s) serão excluído(s) permanentemente.
                </AlertDescription>
              </Alert>
            )}

            {/* Info for batch operations */}
            {watchedOperation !== "delete" && (
              <Alert className="border-blue-200 bg-blue-50">
                <IconInfoCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Esta operação será aplicada a todos os {selectedCuts.length} corte(s) selecionado(s).
                  {watchedOperation === "updateStatus" && " Timestamps apropriados serão adicionados automaticamente."}
                </AlertDescription>
              </Alert>
            )}

            {/* Form actions */}
            <div className="flex gap-3 pt-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={!form.formState.isValid || isSubmitting || selectedCuts.length === 0}
                variant={watchedOperation === "delete" ? "destructive" : "default"}
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Executando...
                  </div>
                ) : (
                  `Executar ${watchedOperation === "delete" ? "Exclusão" : "Atualização"}`
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
