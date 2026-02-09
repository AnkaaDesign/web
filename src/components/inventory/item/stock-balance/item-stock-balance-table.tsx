import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Item } from "../../../../types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/number";
import { useActivityBatchMutations } from "../../../../hooks";
import { ACTIVITY_OPERATION, ACTIVITY_REASON } from "../../../../constants";

// Schema for stock balance form
const stockBalanceSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      currentQuantity: z.number(),
      countedQuantity: z.number().min(0, "Quantidade deve ser não-negativa"),
    }),
  ),
});

type StockBalanceFormData = z.infer<typeof stockBalanceSchema>;

interface ItemStockBalanceTableProps {
  items: Item[];
  onCancel: () => void;
  onSubmit?: () => void;
}

export function ItemStockBalanceTable({ items, onCancel: _onCancel, onSubmit: _onSubmit }: ItemStockBalanceTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchCreateAsync } = useActivityBatchMutations();

  const form = useForm<StockBalanceFormData>({
    resolver: zodResolver(stockBalanceSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      items: items.map((item) => ({
        id: item.id,
        currentQuantity: item.quantity,
        countedQuantity: item.quantity, // Default to current quantity
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const handleSubmit = async (data: StockBalanceFormData) => {
    // Filter only items with differences
    const itemsWithDifferences = data.items.filter((item) => {
      return item.countedQuantity !== item.currentQuantity;
    });

    if (itemsWithDifferences.length === 0) {
      toast.info("Nenhuma diferença detectada no balanço de estoque");
      return;
    }

    // Create activities for stock adjustments
    const activities = itemsWithDifferences.map((item) => {
      const difference = item.countedQuantity - item.currentQuantity;
      const operation = difference > 0 ? ACTIVITY_OPERATION.INBOUND : ACTIVITY_OPERATION.OUTBOUND;
      const quantity = Math.abs(difference);

      return {
        itemId: item.id,
        quantity,
        operation,
        reason: ACTIVITY_REASON.INVENTORY_COUNT,
      };
    });

    setIsSubmitting(true);
    try {
      await batchCreateAsync({ activities });
      toast.success(`Balanço de estoque realizado com sucesso! ${itemsWithDifferences.length} item(ns) ajustado(s).`);
      navigate(routes.inventory.products.list);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error during stock balance:", error);
      }
      toast.error("Erro ao realizar balanço de estoque");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate difference display
  const getDifferenceDisplay = (currentQty: number, countedQty: number) => {
    const diff = countedQty - currentQty;
    if (diff === 0) {
      return <span className="font-mono text-muted-foreground">0</span>;
    } else if (diff > 0) {
      return <span className="font-mono text-green-600 font-medium">+{formatNumber(diff)}</span>;
    } else {
      return <span className="font-mono text-red-600 font-medium">{formatNumber(diff)}</span>;
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button
          id="stock-balance-form-submit"
          type="button"
          onClick={form.handleSubmit(handleSubmit)}
          style={{ display: "none" }}
          disabled={isSubmitting}
        />
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="font-semibold text-sm">Balanço de Estoque</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Digite a quantidade contada para cada item. O sistema ajustará automaticamente o estoque e atualizará os campos de consumo e ponto de reposição.
            </p>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table className={cn(TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="h-10">
                  <TableHead className="w-32 whitespace-nowrap">Código</TableHead>
                  <TableHead className="w-64 whitespace-nowrap">Nome</TableHead>
                  <TableHead className="w-40 whitespace-nowrap">Marca</TableHead>
                  <TableHead className="w-40 whitespace-nowrap">Categoria</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">Estoque Atual</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">Contagem</TableHead>
                  <TableHead className="w-28 whitespace-nowrap">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const item = items[index];
                  const currentQuantity = form.watch(`items.${index}.currentQuantity`);
                  const countedQuantity = form.watch(`items.${index}.countedQuantity`);

                  return (
                    <TableRow key={field.id} className={cn("h-12", index % 2 === 1 && "bg-muted/10")}>
                      {/* Unicode - Read-only */}
                      <TableCell className="font-mono text-sm py-2">
                        {item.uniCode || "-"}
                      </TableCell>

                      {/* Name - Read-only */}
                      <TableCell className="font-medium py-2">
                        {item.name}
                      </TableCell>

                      {/* Brand - Read-only */}
                      <TableCell className="py-2">
                        {item.brand?.name || "-"}
                      </TableCell>

                      {/* Category - Read-only */}
                      <TableCell className="py-2">
                        {item.category?.name || "-"}
                      </TableCell>

                      {/* Current Quantity - Read-only */}
                      <TableCell className="py-2">
                        <span className="font-mono">{formatNumber(currentQuantity)}</span>
                      </TableCell>

                      {/* Counted Quantity - Editable */}
                      <TableCell className="py-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.countedQuantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="w-28 h-8 font-mono text-sm"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </TableCell>

                      {/* Difference - Calculated */}
                      <TableCell className="py-2">
                        {getDifferenceDisplay(currentQuantity, countedQuantity)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Total de itens:</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="font-medium">Itens com diferença:</span>
              <span className="font-mono">
                {form.watch("items").filter((item) => item.countedQuantity !== item.currentQuantity).length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Form>
  );
}
