import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Item, BatchOperationResult } from "../../../../types";
import { itemUpdateSchema } from "../../../../schemas";
import { useItemBatchMutations } from "../../../../hooks";
import { BatchOperationResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { NameCell } from "./cells/name-cell";
import { BrandCell } from "./cells/brand-cell";
import { CategoryCell } from "./cells/category-cell";
import { SupplierCell } from "./cells/supplier-cell";
import { StatusCell } from "./cells/status-cell";
import { PriceCell } from "./cells/price-cell";
import { QuantityCell } from "./cells/quantity-cell";
import { BarcodeCell } from "./cells/barcode-cell";
import { UnicodeCell } from "./cells/unicode-cell";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";

// Schema for batch edit form
const itemBatchEditSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      data: itemUpdateSchema,
    }),
  ),
});

type ItemBatchEditFormData = z.infer<typeof itemBatchEditSchema>;

interface ItemBatchEditTableProps {
  items: Item[];
  onCancel: () => void;
  onSubmit?: () => void;
}

export function ItemBatchEditTable({ items, onCancel: _onCancel, onSubmit: _onSubmit }: ItemBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchOperationResult<Item, Item> | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { batchUpdateAsync } = useItemBatchMutations();

  const form = useForm<ItemBatchEditFormData>({
    resolver: zodResolver(itemBatchEditSchema),
    mode: "onChange", // Validate on change for immediate feedback
    reValidateMode: "onChange", // Re-validate on change
    defaultValues: {
      items: items.map((item) => ({
        id: item.id,
        data: {
          name: item.name,
          uniCode: item.uniCode || undefined,
          brandId: item.brandId || undefined,
          categoryId: item.categoryId || undefined,
          supplierId: item.supplierId || undefined,
          isActive: item.isActive,
          totalPrice: item.totalPrice || 0,
          quantity: item.quantity,
          barcodes: item.barcodes || [],
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const handleSubmit = async (data: ItemBatchEditFormData) => {
    // Filter out items with no changes
    const updatedItems = data.items.filter((item) => {
      const originalItem = items.find((i) => i.id === item.id);
      if (!originalItem) return false;

      const hasChanges =
        item.data.name !== originalItem.name ||
        item.data.uniCode !== originalItem.uniCode ||
        item.data.brandId !== originalItem.brandId ||
        item.data.categoryId !== originalItem.categoryId ||
        item.data.supplierId !== originalItem.supplierId ||
        item.data.isActive !== originalItem.isActive ||
        item.data.totalPrice !== originalItem.totalPrice ||
        item.data.quantity !== originalItem.quantity ||
        JSON.stringify(item.data.barcodes) !== JSON.stringify(originalItem.barcodes || []);

      return hasChanges;
    });

    if (updatedItems.length === 0) {
      toast.info("Nenhuma alteração detectada");
      return;
    }

    const transformedItems = updatedItems.map((item) => ({
      id: item.id,
      data: {
        ...item.data,
        // Ensure barcodes is always an array, even if empty
        barcodes: item.data.barcodes || [],
      },
    }));
    const batchPayload = { items: transformedItems };
    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync(batchPayload);
      if (result?.data) {
        // Show the detailed result dialog
        setBatchResult(result.data);
        setShowResultDialog(true);
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        navigate(routes.inventory.products.list);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error during batch update:", error);
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
        navigate(routes.inventory.products.list);
      }
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        {/* Hidden submit button for page header to trigger */}
        <button id="item-batch-form-submit" type="button" onClick={form.handleSubmit(handleSubmit)} style={{ display: "none" }} disabled={isSubmitting} />
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {items.length} {items.length === 1 ? "produto selecionado" : "produtos selecionados"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas apenas aos campos modificados em cada produto</p>
          </div>
          {/* Single scrollable container for both header and body */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[1600px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-80">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Nome</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Código Único</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-56">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Marca</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-72">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Categoria</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-72">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Fornecedor</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Status</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-44">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Preço</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Quantidade</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-52">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Códigos de Barras</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  // const _item = items[index]; // Temporarily unused

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
                          <NameCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-40 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <UnicodeCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-56 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <BrandCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-72 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <CategoryCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-72 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <SupplierCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-32 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <StatusCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-44 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <PriceCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-32 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <QuantityCell control={form.control} index={index} />
                        </div>
                      </TableCell>
                      <TableCell className="w-52 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <BarcodeCell control={form.control} index={index} />
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
        entityName="produto"
        successItemDisplay={(item: Item) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{item.name}</span>
            {item.uniCode && <span className="text-xs text-muted-foreground">Código: {item.uniCode}</span>}
          </div>
        )}
        failedItemDisplay={(error) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{error.data?.name || "Produto desconhecido"}</span>
            <span className="text-xs text-destructive">{error.error}</span>
          </div>
        )}
      />
    </Form>
  );
}
