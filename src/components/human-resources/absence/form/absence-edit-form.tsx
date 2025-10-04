import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Edit, AlertCircle, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { absenceUpdateSchema, type AbsenceUpdateFormData } from "../../../../schemas";
import { useAbsenceMutations } from "../../../../hooks";
import { ABSENCE_STATUS, ABSENCE_STATUS_LABELS } from "../../../../constants";
import type { Absence } from "../../../../types";
import { toast } from "sonner";

interface AbsenceEditFormProps {
  absence: Absence;
  onSuccess?: () => void;
  onCancel?: () => void;
  allowStatusChange?: boolean;
}

export function AbsenceEditForm({
  absence,
  onSuccess,
  onCancel,
  allowStatusChange = false
}: AbsenceEditFormProps) {
  const { update } = useAbsenceMutations();

  const form = useForm<AbsenceUpdateFormData>({
    resolver: zodResolver(absenceUpdateSchema),
    defaultValues: {
      reason: absence.reason || "",
      status: absence.status,
    },
  });

  const watchedStatus = form.watch("status");

  useEffect(() => {
    // Reset form when absence changes
    form.reset({
      reason: absence.reason || "",
      status: absence.status,
    });
  }, [absence, form]);

  const onSubmit = async (data: AbsenceUpdateFormData) => {
    try {
      await update({
        id: absence.id,
        data,
      });
      toast.success("Falta atualizada com sucesso!");
      onSuccess?.();
    } catch (error) {
      toast.error("Erro ao atualizar falta");
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case ABSENCE_STATUS.PENDING_JUSTIFICATION:
        return "bg-amber-100 text-amber-800 border-amber-200";
      case ABSENCE_STATUS.JUSTIFICATION_SUBMITTED:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case ABSENCE_STATUS.APPROVED:
        return "bg-green-100 text-green-800 border-green-200";
      case ABSENCE_STATUS.REJECTED:
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const isPastDate = () => {
    const today = new Date();
    const absenceDate = new Date(absence.date);
    today.setHours(0, 0, 0, 0);
    absenceDate.setHours(0, 0, 0, 0);
    return absenceDate < today;
  };

  const canChangeStatus = () => {
    return allowStatusChange &&
           (absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION ||
            absence.status === ABSENCE_STATUS.JUSTIFICATION_SUBMITTED);
  };

  const getAvailableStatuses = () => {
    const statuses = [];

    // Always allow the current status
    statuses.push(absence.status);

    if (absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION) {
      statuses.push(ABSENCE_STATUS.JUSTIFICATION_SUBMITTED);
    }

    if (allowStatusChange) {
      if (absence.status === ABSENCE_STATUS.JUSTIFICATION_SUBMITTED) {
        statuses.push(ABSENCE_STATUS.APPROVED, ABSENCE_STATUS.REJECTED);
      }
      if (absence.status === ABSENCE_STATUS.PENDING_JUSTIFICATION) {
        statuses.push(ABSENCE_STATUS.APPROVED, ABSENCE_STATUS.REJECTED);
      }
    }

    // Remove duplicates
    return [...new Set(statuses)];
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit className="h-5 w-5" />
          Editar Falta
        </CardTitle>
        <CardDescription>
          Atualize as informações da falta registrada
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Absence Info */}
        <div className="mb-6 p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{absence.user?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(absence.date), "PPP", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={getStatusColor(absence.status)}>
              {ABSENCE_STATUS_LABELS[absence.status as keyof typeof ABSENCE_STATUS_LABELS]}
            </Badge>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Status Selection (if allowed) */}
            {canChangeStatus() && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableStatuses().map((status) => (
                            <SelectItem key={status} value={status}>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(status)}>
                                  {ABSENCE_STATUS_LABELS[status as keyof typeof ABSENCE_STATUS_LABELS]}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Reason/Justification */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isPastDate() || watchedStatus === ABSENCE_STATUS.JUSTIFICATION_SUBMITTED
                      ? "Justificativa"
                      : "Motivo"}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Informe a justificativa ou motivo da falta..."
                      className="min-h-[120px] resize-none"
                      maxLength={500}
                    />
                  </FormControl>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <FormMessage />
                    <span>{field.value?.length || 0}/500</span>
                  </div>
                </FormItem>
              )}
            />

            {/* Validation Alerts */}
            {watchedStatus === ABSENCE_STATUS.JUSTIFICATION_SUBMITTED && !form.getValues("reason")?.trim() && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Justificativa é obrigatória para submeter a falta
                </AlertDescription>
              </Alert>
            )}

            {watchedStatus === ABSENCE_STATUS.APPROVED && (
              <Alert className="border-green-200 bg-green-50">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Esta falta será marcada como aprovada
                </AlertDescription>
              </Alert>
            )}

            {watchedStatus === ABSENCE_STATUS.REJECTED && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  Esta falta será marcada como rejeitada
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={update.isPending}
                className="flex-1"
              >
                {update.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}