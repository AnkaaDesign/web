import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2, IconX, IconAlertTriangle } from "@tabler/icons-react";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Vacation } from "../../../../types";
import type { VacationUpdateFormData } from "../../../../schemas";
import { VACATION_TYPE, VACATION_STATUS } from "../../../../constants";
import { routes } from "../../../../constants";
import { useVacationBatchMutations } from "../../../../hooks";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { TypeSelect } from "../form/type-select";
import { StatusSelect } from "../form/status-select";
import { CollectiveSwitch } from "../form/collective-switch";

const batchFormSchema = z
  .object({
    type: z
      .enum(Object.values(VACATION_TYPE) as [string, ...string[]])
      .nullable()
      .optional(),
    status: z
      .enum(Object.values(VACATION_STATUS) as [string, ...string[]])
      .nullable()
      .optional(),
    isCollective: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // At least one field must be provided
      return data.type !== undefined || data.status !== undefined || data.isCollective !== undefined;
    },
    {
      message: "Pelo menos um campo deve ser alterado",
      path: ["type"], // Show error on type field
    },
  );

type BatchFormData = z.infer<typeof batchFormSchema>;

interface VacationBatchFormProps {
  vacations: (Vacation & { user?: { name: string } })[];
}

export function VacationBatchForm({ vacations }: VacationBatchFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { batchUpdateAsync } = useVacationBatchMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
    mode: "onChange",
    defaultValues: {
      type: undefined,
      status: undefined,
      isCollective: undefined,
    },
  });

  const watchedFields = form.watch();
  const hasChanges = Object.values(watchedFields).some((value) => value !== undefined);

  const handleSubmit = async (data: BatchFormData) => {
    if (!hasChanges) {
      toast.error("Nenhuma alteração foi feita");
      return;
    }

    try {
      setIsSubmitting(true);

      // Build update data, filtering out undefined values
      const updateData: Partial<VacationUpdateFormData> = {};
      if (data.type !== undefined && data.type !== null) updateData.type = data.type;
      if (data.status !== undefined && data.status !== null) updateData.status = data.status;
      if (data.isCollective !== undefined) updateData.isCollective = data.isCollective;

      if (Object.keys(updateData).length === 0) {
        toast.error("Nenhuma alteração válida foi selecionada");
        return;
      }

      const updates = vacations.map((vacation) => ({
        id: vacation.id,
        data: updateData,
      }));

      const result = await batchUpdateAsync({ vacations: updates });

      const successCount = result.data?.totalSuccess || 0;
      const errorCount = result.data?.totalFailed || 0;

      if (successCount > 0) {
        // Success toast is handled automatically by API client
        toast.success(`${successCount} férias processadas${errorCount > 0 ? ` (${errorCount} falharam)` : ""}`);
      }

      if (errorCount > 0 && successCount === 0) {
        toast.error(`Erro ao atualizar ${errorCount} férias`);
      }

      // Navigate back with preserved filters only if there were no errors
      if (errorCount === 0) {
        const params = new URLSearchParams(searchParams);
        navigate(`${routes.humanResources.vacations.root}?${params.toString()}`);
      }
    } catch (error) {
      console.error("Error updating vacations:", error);
      toast.error("Erro inesperado ao atualizar as férias. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    const params = new URLSearchParams(searchParams);
    navigate(`${routes.humanResources.vacations.root}?${params.toString()}`);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <Alert>
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription>As alterações serão aplicadas a todas as {vacations.length} férias selecionadas. Campos não preenchidos não serão alterados.</AlertDescription>
        </Alert>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Edição em Lote</CardTitle>
                <CardDescription>Altere os campos que deseja atualizar em todas as férias selecionadas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.formState.errors.type && <div className="text-sm text-destructive">{form.formState.errors.type.message}</div>}

                <TypeSelect control={form.control as any} disabled={isSubmitting} />

                <StatusSelect control={form.control as any} disabled={isSubmitting} />

                <CollectiveSwitch control={form.control as any} disabled={isSubmitting} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Férias Selecionadas</CardTitle>
                <CardDescription>
                  {vacations.length} {vacations.length === 1 ? "férias" : "férias"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {vacations.map((vacation, index) => (
                      <div key={vacation.id}>
                        {index > 0 && <Separator className="my-2" />}
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{vacation.user?.name || "Colaborador não definido"}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(vacation.startAt), "dd/MM", { locale: ptBR })} -{format(new Date(vacation.endAt), "dd/MM/yyyy", { locale: ptBR })}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {vacation.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {vacation.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            <IconX className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCheck className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
