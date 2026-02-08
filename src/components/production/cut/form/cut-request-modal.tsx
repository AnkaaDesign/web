import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconFileText, IconCut, IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";
import type { Cut } from "../../../../types";
import { CUT_REQUEST_REASON, CUT_ORIGIN, CUT_STATUS } from "../../../../constants";
import { CUT_REQUEST_REASON_LABELS, CUT_TYPE_LABELS, CUT_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import { useCutMutations } from "../../../../hooks";
import { useToast } from "@/hooks/common/use-toast";
import { formatDate } from "../../../../utils";

const requestSchema = z.object({
  quantity: z.coerce.number().int("Quantidade deve ser um número inteiro").min(1, "Quantidade deve ser maior que zero").max(100, "Quantidade não pode exceder 100"),
  reason: z.nativeEnum(CUT_REQUEST_REASON, {
    errorMap: () => ({ message: "Motivo inválido" }),
  }),
  notes: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface CutRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cutItem: Cut | null;
  onSuccess?: (cuts: Cut[]) => void;
}

export function CutRequestModal({ open, onOpenChange, cutItem, onSuccess }: CutRequestModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { batchCreate } = useCutMutations();

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      quantity: 1,
      reason: CUT_REQUEST_REASON.WRONG_APPLY,
      notes: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const handleSubmit = async (data: RequestFormData) => {
    if (!cutItem) {
      toast({
        title: "Erro",
        description: "Nenhum corte selecionado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { quantity, notes, ...requestData } = data;

      // Create multiple new cuts based on the original cut
      const cuts = Array.from({ length: quantity }, () => ({
        fileId: cutItem.fileId,
        type: cutItem.type,
        origin: CUT_ORIGIN.REQUEST,
        reason: requestData.reason,
        parentCutId: cutItem.id,
        ...(cutItem.taskId && { taskId: cutItem.taskId }),
      }));

      const response = await batchCreate.mutateAsync({
        data: { cuts },
        include: {
          file: true,
          task: {
            include: {
              customer: true,
            },
          },
          parentCut: {
            include: {
              file: true,
            },
          },
        },
      });

      toast({
        title: "Solicitação criada",
        description: `${quantity} novo(s) corte(s) solicitado(s) com sucesso.`,
      });

      onSuccess?.(response.data.success);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao solicitar novos cortes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cutType = cutItem?.type;
  const fileName = cutItem?.file?.filename || "arquivo";
  const taskName = cutItem?.task?.name;
  const customerName = cutItem?.task?.customer?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCut className="h-5 w-5 text-primary" />
            Solicitar Novo Corte
          </DialogTitle>
          <DialogDescription>Crie uma solicitação de novo corte baseada no corte existente</DialogDescription>
        </DialogHeader>

        {cutItem && (
          <div className="space-y-3 py-4">
            {/* Cut info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconFileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{CUT_TYPE_LABELS[cutType!]}</Badge>
                <Badge variant={getBadgeVariant(cutItem.status, "CUT")}>{CUT_STATUS_LABELS[cutItem.status]}</Badge>
              </div>
            </div>

            {/* Task info */}
            {taskName && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Tarefa:</span> {taskName}
                {customerName && ` - ${customerName}`}
              </div>
            )}

            {/* Cut dates */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Criado em: {formatDate(cutItem.createdAt)}</div>
              {cutItem.startedAt && <div>Iniciado em: {formatDate(cutItem.startedAt)}</div>}
              {cutItem.completedAt && <div>Concluído em: {formatDate(cutItem.completedAt)}</div>}
            </div>

            <Separator />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Quantity field */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de Novos Cortes</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} placeholder="1" ref={field.ref} value={field.value} onChange={(value) => field.onChange(typeof value === "number" ? value : 1)} onBlur={field.onBlur} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason field */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo da Solicitação</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value}
                      onValueChange={field.onChange}
                      options={Object.entries(CUT_REQUEST_REASON_LABELS).map(
                        ([value, label]): ComboboxOption => ({
                          value,
                          label: label as string,
                        }),
                      )}
                      placeholder="Selecione o motivo"
                      searchable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      placeholder="Adicione detalhes sobre a solicitação..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info alert */}
            <Alert className="border-blue-200 bg-blue-50">
              <IconInfoCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">Os novos cortes serão criados com status "Pendente" e marcados como retrabalho do corte original.</AlertDescription>
            </Alert>

            {/* Summary */}
            {form.watch("quantity") > 1 && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <span className="font-medium">Serão criados {form.watch("quantity")} novos cortes</span>
                <div className="text-xs text-muted-foreground mt-1">Motivo: {CUT_REQUEST_REASON_LABELS[form.watch("reason")]}</div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!form.formState.isValid || isSubmitting || !cutItem} className="min-w-[120px]">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Solicitando...
                  </div>
                ) : (
                  "Solicitar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
