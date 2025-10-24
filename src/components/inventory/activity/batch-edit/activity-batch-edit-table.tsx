import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Activity } from "../../../../types";
import { activityUpdateSchema } from "../../../../schemas";
import { useActivityBatchMutations } from "../../../../hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { QuantityCell } from "./cells/quantity-cell";
import { UserCell } from "./cells/user-cell";
import { OperationCell } from "./cells/operation-cell";
import { ReasonCell } from "./cells/reason-cell";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../../../../utils";

// Schema for batch edit form
const activityBatchEditSchema = z.object({
  activities: z.array(
    z.object({
      id: z.string(),
      data: activityUpdateSchema,
    }),
  ),
});

export type ActivityBatchEditFormData = z.infer<typeof activityBatchEditSchema>;

interface ActivityBatchEditTableProps {
  activities: Activity[];
  onCancel: () => void;
}

export function ActivityBatchEditTable({ activities, onCancel }: ActivityBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchUpdateAsync } = useActivityBatchMutations();

  const form = useForm<ActivityBatchEditFormData>({
    resolver: zodResolver(activityBatchEditSchema),
    mode: "onChange",
    defaultValues: {
      activities: activities.map((activity) => ({
        id: activity.id,
        data: {
          quantity: activity.quantity,
          operation: activity.operation,
          reason: activity.reason || undefined,
          userId: activity.userId || undefined,
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "activities",
  });

  const handleSubmit = async (data: ActivityBatchEditFormData) => {
    const updateActivities = data.activities.map((activity) => ({
      id: activity.id,
      data: {
        ...activity.data,
        // Filter out undefined values
        ...(activity.data.quantity !== undefined && { quantity: activity.data.quantity }),
        ...(activity.data.operation !== undefined && { operation: activity.data.operation }),
        ...(activity.data.reason !== undefined && { reason: activity.data.reason }),
        ...(activity.data.userId !== undefined && { userId: activity.data.userId }),
      },
    }));

    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync({ activities: updateActivities });

      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "movimentação atualizada" : "movimentações atualizadas"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "movimentação falhou" : "movimentações falharam"} ao atualizar`);
        }

        if (totalFailed === 0) {
          navigate(routes.inventory.movements.list);
        }
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        toast.success("Movimentações atualizadas com sucesso");
        navigate(routes.inventory.movements.list);
      }
    } catch (error) {
      toast.error("Erro ao atualizar movimentações em lote");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="activity-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {activities.length} {activities.length === 1 ? "movimentação selecionada" : "movimentações selecionadas"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas a todas as movimentações listadas abaixo</p>
          </div>

            {/* Single scrollable container for both header and body */}
            <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
              <Table className={cn("w-full min-w-[1200px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                  <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-80">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Item</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-80">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Usuário</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Operação</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-60">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Motivo</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Quantidade</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Data</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const activity = activities[index];

                    return (
                      <TableRow
                        key={field.id}
                        className={cn(
                          "cursor-default transition-colors border-b border-border",
                          // Alternating row colors
                          index % 2 === 1 && "bg-muted/10",
                          // Hover state that works with alternating colors
                          "hover:bg-muted/20",
                        )}
                      >
                        <TableCell className="p-0 !border-r-0 w-80">
                          <div className="px-4 py-2">
                            <p className="font-medium">{activity.item?.uniCode ? `${activity.item.uniCode} - ${activity.item.name}` : activity.item?.name || "Item não encontrado"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="w-80 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <UserCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-40 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <OperationCell form={form} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-60 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <ReasonCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-32 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <QuantityCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-48 p-0 !border-r-0">
                          <div className="px-4 py-2 text-sm">{formatDateTime(activity.createdAt)}</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
    </Form>
  );
}
