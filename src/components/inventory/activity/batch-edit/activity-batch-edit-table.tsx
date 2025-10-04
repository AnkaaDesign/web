import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Activity } from "../../../../types";
import { activityUpdateSchema } from "../../../../schemas";
import { useActivityBatchMutations } from "../../../../hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { routes, ACTIVITY_OPERATION } from "../../../../constants";
import { IconLoader, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { IconWand, IconArrowUp, IconArrowDown, IconPackage } from "@tabler/icons-react";
import { QuantityCell } from "./cells/quantity-cell";
import { UserCell } from "./cells/user-cell";
import { OperationCell } from "./cells/operation-cell";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";

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
  const [globalOperation, setGlobalOperation] = useState<string | null>(null);
  const [originalOperations, setOriginalOperations] = useState<(string | undefined)[]>([]);
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

  // Initialize original operations on mount
  useEffect(() => {
    const operations = activities.map((activity) => activity.operation);
    setOriginalOperations(operations);
  }, [activities]);

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
      <div className="space-y-4">
        <PageHeader
          title="Editar Movimentações em Lote"
          icon={IconPackage}
          variant="batch"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Estoque", href: "/estoque" },
            { label: "Movimentações", href: routes.inventory.movements.list },
            { label: "Editar em Lote" },
          ]}
          selection={{
            count: activities.length,
            entityName: "movimentações",
            onClearSelection: onCancel,
          }}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              icon: IconX,
              onClick: onCancel,
              variant: "outline",
              disabled: isSubmitting,
            },
            {
              key: "save",
              label: "Salvar Alterações",
              icon: isSubmitting ? IconLoader : IconDeviceFloppy,
              onClick: form.handleSubmit(handleSubmit),
              variant: "default",
              disabled: isSubmitting || !form.formState.isValid,
              loading: isSubmitting,
            },
          ]}
        />

        <Card className="h-full flex flex-col">
          <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
            {/* Global Operation Controls */}
            <div className="mb-4 p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <IconWand className="h-4 w-4 text-primary" />
                  <Label htmlFor="global-operation" className="text-sm font-medium">
                    Operação Global:
                  </Label>
                </div>
                <div className="flex-1 max-w-xs">
                  <Combobox
                    value={globalOperation || "none"}
                    onValueChange={(value) => {
                      const newOperation = value === "none" ? null : value;
                      setGlobalOperation(newOperation);

                      if (newOperation && Object.values(ACTIVITY_OPERATION).includes(newOperation as ACTIVITY_OPERATION)) {
                        // Apply global operation to all activities
                        activities.forEach((_, index) => {
                          form.setValue(`activities.${index}.data.operation`, newOperation as ACTIVITY_OPERATION);
                        });
                      } else {
                        // Restore original operations when global control is disabled
                        activities.forEach((_, index) => {
                          const originalOperation = originalOperations[index] || activities[index].operation;
                          form.setValue(`activities.${index}.data.operation`, originalOperation as ACTIVITY_OPERATION);
                        });
                      }
                    }}
                    options={[
                      { value: "none", label: "Manter individuais" },
                      { value: ACTIVITY_OPERATION.INBOUND, label: "Entrada (todas)" },
                      { value: ACTIVITY_OPERATION.OUTBOUND, label: "Saída (todas)" },
                    ]}
                    placeholder="Selecione operação para todas"
                    className="h-9"
                    searchable={false}
                  />
                </div>
                {globalOperation && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                    Aplicada a todas as movimentações
                  </div>
                )}
              </div>
            </div>

            {/* Single scrollable container for both header and body */}
            <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
              <Table className={cn("w-full min-w-[1200px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                  <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-80">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Item (Somente Leitura)</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Operação</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Quantidade</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-52">
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span className="truncate">Usuário</span>
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
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
                          <div className="px-4 py-2 text-sm">
                            {activity.item ? (
                              <div className="whitespace-nowrap text-foreground truncate">
                                {activity.item.uniCode ? `${activity.item.uniCode} - ${activity.item.name}` : activity.item.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Item não encontrado</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-32 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <OperationCell form={form} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-32 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <QuantityCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-52 p-0 !border-r-0">
                          <div className="px-4 py-2">
                            <UserCell control={form.control} index={index} />
                          </div>
                        </TableCell>
                        <TableCell className="w-40 p-0 !border-r-0">
                          <div className="px-4 py-2 text-sm text-muted-foreground">{formatDate(activity.createdAt)}</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Form>
  );
}
