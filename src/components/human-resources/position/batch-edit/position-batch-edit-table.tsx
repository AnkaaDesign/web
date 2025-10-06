import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Position, BatchOperationResult } from "../../../../types";
import { usePositionBatchMutations } from "../../../../hooks";
import { BatchOperationResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { routes } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

// Schema for batch edit form - common fields only for bulk update
const positionBatchEditSchema = z.object({
  positions: z.array(
    z.object({
      id: z.string(),
      data: z
        .object({
          // Core fields
          name: z.string().min(1, "Nome do cargo é obrigatório").max(100, "Nome do cargo deve ter no máximo 100 caracteres").optional(),
          remuneration: z.number().min(0, "Remuneração deve ser maior ou igual a zero").max(999999.99, "Remuneração deve ser menor que R$ 1.000.000,00").optional(),
          bonifiable: z.boolean().optional(),
        })
        .partial(),
    }),
  ),
});

type PositionBatchEditFormData = z.infer<typeof positionBatchEditSchema>;

interface PositionBatchEditTableProps {
  positions: Position[];
  onCancel: () => void;
  onSubmit?: () => void;
}

export function PositionBatchEditTable({ positions, onCancel, onSubmit }: PositionBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<Position, Position> | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { batchUpdateAsync } = usePositionBatchMutations();

  const form = useForm<PositionBatchEditFormData>({
    resolver: zodResolver(positionBatchEditSchema),
    defaultValues: {
      positions: positions.map((position: Position) => ({
        id: position.id,
        data: {
          name: position.name,
          remuneration: position.remuneration,
          bonifiable: position.bonifiable,
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "positions",
  });

  const handleSubmit = async (data: PositionBatchEditFormData) => {
    // Filter out positions with no changes
    const updatedPositions = data.positions.filter((position: any) => {
      const originalPosition = positions.find((p: Position) => p.id === position.id);
      if (!originalPosition) return false;

      const hasChanges =
        position.data.name !== originalPosition.name ||
        position.data.remuneration !== originalPosition.remuneration ||
        position.data.bonifiable !== originalPosition.bonifiable;

      return hasChanges;
    });

    if (updatedPositions.length === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    }

    const batchPayload = { positions: updatedPositions };
    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync(batchPayload);
      if (result?.data) {
        // Show the detailed result dialog
        setBatchResult(result.data);
        setShowResultDialog(true);
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        navigate(routes.humanResources.positions.root);
      }
    } catch (error) {
      console.error("Error during batch update:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        response: (error as any).response?.data,
        status: (error as any).response?.status,
        stack: (error as Error).stack,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultDialogClose = (open: boolean) => {
    setShowResultDialog(open);
    if (!open) {
      setBatchResult(null);
      // If there were no failures, navigate back to list
      if (batchResult && batchResult.totalFailed === 0 && batchResult.totalSuccess > 0) {
        navigate(routes.humanResources.positions.root);
      }
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="position-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {positions.length} {positions.length === 1 ? "cargo selecionado" : "cargos selecionados"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas apenas aos campos modificados em cada cargo</p>
          </div>

          {/* Positions Table */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[800px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-96">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Nome do Cargo</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Remuneração</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                    <div className="flex items-center justify-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Bonificável</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field: any, index: number) => {
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
                      {/* Nome do Cargo */}
                      <TableCell className="w-96 p-4 !border-r-0 h-16">
                        <div className="flex items-center h-full">
                          <FormInput name={`positions.${index}.data.name`} placeholder="Nome do cargo" className="h-8 border-muted-foreground/20 w-full" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Remuneração */}
                      <TableCell className="w-48 p-4 !border-r-0 h-16">
                        <div className="flex items-center h-full">
                          <FormInput
                            name={`positions.${index}.data.remuneration`}
                            type="currency"
                            placeholder="R$ 0,00"
                            className="h-8 border-muted-foreground/20 w-full"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Bonificável */}
                      <TableCell className="w-32 p-4 !border-r-0 h-16">
                        <div className="flex items-center justify-center h-full">
                          <FormField
                            control={form.control}
                            name={`positions.${index}.data.bonifiable`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch
                                    checked={field.value || false}
                                    onCheckedChange={field.onChange}
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Operation Result Dialog */}
      <BatchOperationResultDialog
        open={showResultDialog}
        onOpenChange={handleResultDialogClose}
        result={batchResult}
        operationType="update"
        entityName="cargos"
        successItemDisplay={(item) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.remuneration && (
              <span className="text-muted-foreground">
                - R$ {item.remuneration.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        )}
      />
    </Form>
  );
}
