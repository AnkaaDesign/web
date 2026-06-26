import { useState } from "react";
import { formatCurrency } from "@/utils/number";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Position, BatchOperationResult } from "../../../../types";
import { usePositionBatchMutations } from "../../../../hooks";
import { BatchOperationResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { INSALUBRITY_DEGREE, INSALUBRITY_DEGREE_LABELS } from "../../../../constants";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
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
          // Part F — encargos e saúde
          salaryFloor: z.number().min(0, "Piso salarial deve ser maior ou igual a zero").max(999999.99, "Piso salarial deve ser menor que R$ 1.000.000,00").nullable().optional(),
          insalubrityDegree: z.nativeEnum(INSALUBRITY_DEGREE).optional(),
          hazardPay: z.boolean().optional(),
          examPeriodicityMonths: z
            .number()
            .int("Periodicidade deve ser um número inteiro de meses")
            .min(1, "Periodicidade deve ser de pelo menos 1 mês")
            .max(60, "Periodicidade deve ser menor ou igual a 60 meses")
            .nullable()
            .optional(),
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

export function PositionBatchEditTable({ positions, onCancel: _onCancel, onSubmit: _onSubmit }: PositionBatchEditTableProps) {
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
          salaryFloor: position.salaryFloor ?? null,
          insalubrityDegree: position.insalubrityDegree ?? INSALUBRITY_DEGREE.NONE,
          hazardPay: position.hazardPay ?? false,
          examPeriodicityMonths: position.examPeriodicityMonths ?? null,
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
        position.data.bonifiable !== originalPosition.bonifiable ||
        (position.data.salaryFloor ?? null) !== (originalPosition.salaryFloor ?? null) ||
        (position.data.insalubrityDegree ?? INSALUBRITY_DEGREE.NONE) !== (originalPosition.insalubrityDegree ?? INSALUBRITY_DEGREE.NONE) ||
        (position.data.hazardPay ?? false) !== (originalPosition.hazardPay ?? false) ||
        (position.data.examPeriodicityMonths ?? null) !== (originalPosition.examPeriodicityMonths ?? null);

      return hasChanges;
    });

    if (updatedPositions.length === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    }

    // allowBelowFloor é um flag de validação transitório exigido pelo schema de
    // atualização (default false na api). O batch edit nunca confirma piso.
    const batchPayload = {
      positions: updatedPositions.map((position: any) => ({
        id: position.id,
        data: { ...position.data, allowBelowFloor: false },
      })),
    };
    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync(batchPayload as any);
      if (result?.data) {
        // Show the detailed result dialog
        setBatchResult(result.data as unknown as BatchOperationResult<Position, Position>);
        setShowResultDialog(true);
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        navigate(routes.personnelDepartment.positions.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error during batch update:", error);
        console.error("Error details:", {
          message: (error as Error).message,
          response: (error as any).response?.data,
          status: (error as any).response?.status,
          stack: (error as Error).stack,
        });
      }
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
        navigate(routes.personnelDepartment.positions.root);
      }
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="position-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
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
            <Table className={cn("w-full min-w-[1200px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-80">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Nome do Cargo</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Remuneração</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Piso da Categoria</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-48">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Insalubridade</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Periodicidade Exame</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                    <div className="flex items-center justify-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Periculosidade</span>
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
                      <TableCell className="w-80 p-4 !border-r-0 h-16">
                        <div className="flex items-center h-full">
                          <FormInput name={`positions.${index}.data.name`} placeholder="Nome do cargo" className="h-8 border-muted-foreground/20 w-full" disabled={isSubmitting} />
                        </div>
                      </TableCell>

                      {/* Remuneração */}
                      <TableCell className="w-40 p-4 !border-r-0 h-16">
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

                      {/* Piso da Categoria */}
                      <TableCell className="w-40 p-4 !border-r-0 h-16">
                        <div className="flex items-center h-full">
                          <FormInput
                            name={`positions.${index}.data.salaryFloor`}
                            type="currency"
                            placeholder="Salário-mínimo"
                            className="h-8 border-muted-foreground/20 w-full"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Insalubridade */}
                      <TableCell className="w-48 p-4 !border-r-0 h-16">
                        <div className="flex items-center h-full">
                          <FormField
                            control={form.control}
                            name={`positions.${index}.data.insalubrityDegree`}
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormControl>
                                  <Combobox
                                    mode="single"
                                    value={field.value ?? INSALUBRITY_DEGREE.NONE}
                                    onValueChange={field.onChange}
                                    options={Object.values(INSALUBRITY_DEGREE).map((value) => ({
                                      value,
                                      label: INSALUBRITY_DEGREE_LABELS[value],
                                    }))}
                                    disabled={isSubmitting}
                                    searchable={false}
                                    className="h-8"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TableCell>

                      {/* Periodicidade do Exame */}
                      <TableCell className="w-40 p-4 !border-r-0 h-16">
                        <div className="flex items-center h-full">
                          <FormInput
                            name={`positions.${index}.data.examPeriodicityMonths`}
                            type="number"
                            placeholder="Cadência legal"
                            className="h-8 border-muted-foreground/20 w-full"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>

                      {/* Periculosidade */}
                      <TableCell className="w-32 p-4 !border-r-0 h-16">
                        <div className="flex items-center justify-center h-full">
                          <FormField
                            control={form.control}
                            name={`positions.${index}.data.hazardPay`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch checked={field.value || false} onCheckedChange={field.onChange} disabled={isSubmitting} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
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
                - {formatCurrency(item.remuneration)}
              </span>
            )}
          </div>
        )}
      />
    </Form>
  );
}
