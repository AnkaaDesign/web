import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Borrow } from "../../../../types";
import { useBorrowBatchMutations } from "../../../../hooks";
import { BORROW_STATUS, BORROW_STATUS_LABELS, BORROW_STATUS_ORDER, routes } from "../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { IconLoader, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { formatDate, formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

// Schema for batch edit form - only status editing
const borrowBatchEditSchema = z.object({
  borrows: z.array(
    z.object({
      id: z.string(),
      data: z.object({
        status: z.enum([BORROW_STATUS.ACTIVE, BORROW_STATUS.RETURNED, BORROW_STATUS.LOST]),
        statusOrder: z.number().int().positive().optional(),
        returnedAt: z.date().nullable().optional(),
      }),
    }),
  ),
});

type BorrowBatchEditFormData = z.infer<typeof borrowBatchEditSchema>;

interface BorrowBatchEditTableProps {
  borrows: Borrow[];
  onCancel: () => void;
}

export function BorrowBatchEditTable({ borrows, onCancel }: BorrowBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchUpdateAsync } = useBorrowBatchMutations();

  const form = useForm<BorrowBatchEditFormData>({
    resolver: zodResolver(borrowBatchEditSchema),
    mode: "onChange",
    defaultValues: {
      borrows: borrows.map((borrow) => ({
        id: borrow.id,
        data: {
          status: borrow.status,
          statusOrder: borrow.statusOrder || BORROW_STATUS_ORDER[borrow.status] || 1,
          returnedAt: borrow.returnedAt,
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "borrows",
  });

  const handleSubmit = async (data: BorrowBatchEditFormData) => {
    const updateBorrows = data.borrows.map((borrow) => ({
      id: borrow.id,
      data: {
        ...borrow.data,
        statusOrder: BORROW_STATUS_ORDER[borrow.data.status] || 1,
        // Automatically set returnedAt when marking as returned
        returnedAt: borrow.data.status === BORROW_STATUS.RETURNED ? borrow.data.returnedAt || new Date() : null,
      },
    }));
    const batchPayload = { borrows: updateBorrows };
    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync(batchPayload);
      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;

        if (totalFailed === 0) {
          navigate(routes.inventory.loans.root);
        }
      } else {
        // Even if we don't have detailed results, navigate back on apparent success
        navigate(routes.inventory.loans.root);
      }
    } catch (error: any) {
      console.error("Step 6 - Error during batch update:", error);
      console.error("Error details:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle status change with proper date logic and status order
  const handleStatusChange = (index: number, newStatus: BORROW_STATUS) => {
    form.setValue(`borrows.${index}.data.status`, newStatus);
    form.setValue(`borrows.${index}.data.statusOrder`, BORROW_STATUS_ORDER[newStatus] || 1);

    // Automatically set returnedAt when marking as returned
    if (newStatus === BORROW_STATUS.RETURNED && !form.getValues(`borrows.${index}.data.returnedAt`)) {
      form.setValue(`borrows.${index}.data.returnedAt`, new Date());
    } else if (newStatus === BORROW_STATUS.ACTIVE) {
      form.setValue(`borrows.${index}.data.returnedAt`, null);
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Editar Empréstimos em Lote</CardTitle>
              <div className="mt-2">
                <Breadcrumb />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                <IconX className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? (
                  <>
                    <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <IconDeviceFloppy className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {borrows.length} {borrows.length === 1 ? "empréstimo selecionado" : "empréstimos selecionados"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas a todos os empréstimos listados abaixo</p>
          </div>
          {/* Single scrollable container for both header and body */}
          <div className="border border-border rounded-lg overflow-x-auto overflow-y-auto flex-1">
            <Table className={cn("w-full min-w-[1000px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-96">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Item</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-60">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Usuário</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-32">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Quantidade</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Emprestado</span>
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0 w-40">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">Status</span>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const borrow = borrows[index];

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
                      <TableCell className="w-96 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <div>
                            <p className="font-medium">{borrow.item?.uniCode ? `${borrow.item.uniCode} - ${borrow.item.name}` : borrow.item?.name || "Item não encontrado"}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              {borrow.item?.brand && <span>Marca: {borrow.item.brand.name}</span>}
                              {borrow.item?.category && <span>Categoria: {borrow.item.category.name}</span>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-60 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <div>
                            <p className="font-medium">{borrow.user?.name || "Usuário não encontrado"}</p>
                            {borrow.user?.position && <p className="text-sm text-muted-foreground">{borrow.user.position.name}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-32 p-0 !border-r-0">
                        <div className="px-4 py-2 text-center">
                          <span className="font-mono">{borrow.quantity}</span>
                        </div>
                      </TableCell>
                      <TableCell className="w-40 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <div className="text-sm">
                            <p>{formatDate(borrow.createdAt)}</p>
                            <p className="text-muted-foreground text-xs">{formatDateTime(borrow.createdAt).split(" ")[1]}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-40 p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <FormField
                            control={form.control}
                            name={`borrows.${index}.data.status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Combobox
                                    value={field.value}
                                    onValueChange={(value) => handleStatusChange(index, value as BORROW_STATUS)}
                                    options={[
                                      { value: BORROW_STATUS.ACTIVE, label: BORROW_STATUS_LABELS[BORROW_STATUS.ACTIVE] },
                                      { value: BORROW_STATUS.RETURNED, label: BORROW_STATUS_LABELS[BORROW_STATUS.RETURNED] },
                                      { value: BORROW_STATUS.LOST, label: BORROW_STATUS_LABELS[BORROW_STATUS.LOST] },
                                    ]}
                                    className="w-full h-8 border-muted-foreground/20"
                                    searchable={false}
                                    clearable={false}
                                    placeholder="Selecione status"
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
    </Form>
  );
}
