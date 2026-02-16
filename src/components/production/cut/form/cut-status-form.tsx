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
import { IconClock, IconPlayerPlay, IconCheck, IconFileText, IconInfoCircle, IconArrowRight } from "@tabler/icons-react";
import { useState } from "react";
import type { Cut } from "../../../../types";
import { CUT_STATUS, CUT_STATUS_LABELS, CUT_TYPE_LABELS } from "../../../../constants";
import { useCutMutations } from "../../../../hooks";
import { useToast } from "@/hooks/common/use-toast";
import { formatDate, formatDateTime } from "../../../../utils";

const statusUpdateSchema = z.object({
  status: z.nativeEnum(CUT_STATUS),
  notes: z.string().optional(),
});

type StatusUpdateFormData = z.infer<typeof statusUpdateSchema>;

interface CutStatusFormProps {
  cut: Cut;
  onSuccess?: (updatedCut: Cut) => void;
  onCancel?: () => void;
  className?: string;
}

// Define valid status transitions
const VALID_TRANSITIONS: Record<CUT_STATUS, CUT_STATUS[]> = {
  [CUT_STATUS.PENDING]: [CUT_STATUS.CUTTING],
  [CUT_STATUS.CUTTING]: [CUT_STATUS.COMPLETED, CUT_STATUS.PENDING],
  [CUT_STATUS.COMPLETED]: [],
};

const STATUS_ICONS = {
  [CUT_STATUS.PENDING]: IconClock,
  [CUT_STATUS.CUTTING]: IconPlayerPlay,
  [CUT_STATUS.COMPLETED]: IconCheck,
};

const STATUS_COLORS = {
  [CUT_STATUS.PENDING]: "text-yellow-600",
  [CUT_STATUS.CUTTING]: "text-blue-600",
  [CUT_STATUS.COMPLETED]: "text-green-600",
};

export function CutStatusForm({ cut, onSuccess, onCancel, className }: CutStatusFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateAsync } = useCutMutations();

  const form = useForm<StatusUpdateFormData>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: {
      status: cut.status,
      notes: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const watchedStatus = form.watch("status");
  const validStatuses = VALID_TRANSITIONS[cut.status] || [];

  const handleSubmit = async (data: StatusUpdateFormData) => {
    if (data.status === cut.status) {
      toast({
        title: "Nenhuma alteração",
        description: "O status selecionado é o mesmo do atual.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: any = { status: data.status };

      // Add timestamps based on status transition
      if (data.status === CUT_STATUS.CUTTING && cut.status === CUT_STATUS.PENDING) {
        updateData.startedAt = new Date();
      } else if (data.status === CUT_STATUS.COMPLETED && cut.status === CUT_STATUS.CUTTING) {
        updateData.completedAt = new Date();
      } else if (data.status === CUT_STATUS.PENDING && cut.status === CUT_STATUS.CUTTING) {
        // Reset started time if going back to pending
        updateData.startedAt = null;
      }

      const response = await updateAsync({
        id: cut.id,
        data: updateData,
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
        title: "Status atualizado",
        description: `Status alterado para "${CUT_STATUS_LABELS[data.status]}".`,
      });

      onSuccess?.(response.data!);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do corte.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const StatusIcon = STATUS_ICONS[cut.status];
  const NewStatusIcon = STATUS_ICONS[watchedStatus];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${STATUS_COLORS[cut.status]}`} />
          Atualizar Status do Corte
        </CardTitle>

        {/* Cut info */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {cut.file && (
            <div className="flex items-center gap-2">
              <IconFileText className="h-4 w-4" />
              <span>Arquivo: {cut.file.filename}</span>
              <Badge variant="outline">{CUT_TYPE_LABELS[cut.type]}</Badge>
            </div>
          )}

          {cut.task && (
            <div>
              Tarefa: {cut.task.name}
              {cut.task.customer && ` - ${cut.task.customer.fantasyName}`}
            </div>
          )}

          <div className="space-y-1">
            <div>Criado em: {formatDate(cut.createdAt)}</div>
            {cut.startedAt && <div>Iniciado em: {formatDateTime(cut.startedAt)}</div>}
            {cut.completedAt && <div>Concluído em: {formatDateTime(cut.completedAt)}</div>}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Current status display */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-muted-foreground">Status Atual:</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <StatusIcon className={`h-3 w-3 ${STATUS_COLORS[cut.status]}`} />
                  {CUT_STATUS_LABELS[cut.status]}
                </Badge>
              </div>

              {/* Status transition preview */}
              {watchedStatus !== cut.status && (
                <div className="flex items-center gap-2 mt-2">
                  <StatusIcon className={`h-4 w-4 ${STATUS_COLORS[cut.status]}`} />
                  <span className="text-sm">{CUT_STATUS_LABELS[cut.status]}</span>
                  <IconArrowRight className="h-4 w-4 text-muted-foreground" />
                  <NewStatusIcon className={`h-4 w-4 ${STATUS_COLORS[watchedStatus]}`} />
                  <span className="text-sm font-medium">{CUT_STATUS_LABELS[watchedStatus]}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Status selection */}
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
                      options={[
                        // Current status (disabled)
                        {
                          value: cut.status,
                          label: `${CUT_STATUS_LABELS[cut.status]} (atual)`,
                          disabled: true,
                        },
                        // Valid transitions
                        ...validStatuses.map((status) => ({
                          value: status,
                          label: CUT_STATUS_LABELS[status],
                        })),
                      ]}
                      placeholder="Selecione o novo status"
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
                      placeholder="Adicione observações sobre a mudança de status..."
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status change effects */}
            {watchedStatus !== cut.status && (
              <Alert className="border-blue-200 bg-blue-50">
                <IconInfoCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {watchedStatus === CUT_STATUS.CUTTING && cut.status === CUT_STATUS.PENDING && "O corte será marcado como iniciado e receberá um timestamp de início."}
                  {watchedStatus === CUT_STATUS.COMPLETED && cut.status === CUT_STATUS.CUTTING && "O corte será marcado como concluído e receberá um timestamp de conclusão."}
                  {watchedStatus === CUT_STATUS.PENDING && cut.status === CUT_STATUS.CUTTING && "O corte voltará para pendente e perderá o timestamp de início."}
                </AlertDescription>
              </Alert>
            )}

            {/* No valid transitions warning */}
            {validStatuses.length === 0 && (
              <Alert>
                <IconInfoCircle className="h-4 w-4" />
                <AlertDescription>Não há transições de status disponíveis para este corte.</AlertDescription>
              </Alert>
            )}

            {/* Form actions */}
            <div className="flex gap-3 pt-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={!form.formState.isValid || isSubmitting || validStatuses.length === 0 || watchedStatus === cut.status} className="min-w-[120px]">
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Atualizando...
                  </div>
                ) : (
                  "Atualizar Status"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
