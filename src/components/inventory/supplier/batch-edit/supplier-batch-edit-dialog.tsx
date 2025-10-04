import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Supplier } from "../../../../types";
import { useBatchUpdateSuppliers, useBatchDeleteSuppliers } from "../../../../hooks";
import { BRAZILIAN_STATES } from "../../../../constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { IconLoader2, IconDeviceFloppy, IconTrash, IconX, IconAlertTriangle, IconEdit, IconBuilding, IconCheck } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Schema for batch operations
const batchUpdateSchema = z
  .object({
    city: z.string().min(1, "Cidade é obrigatória").max(100, "Cidade deve ter no máximo 100 caracteres").optional(),
    state: z
      .enum(BRAZILIAN_STATES as unknown as [string, ...string[]])
      .nullable()
      .optional(),
    neighborhood: z.string().max(100, "Bairro deve ter no máximo 100 caracteres").nullable().optional(),
    addressComplement: z.string().max(100, "Complemento deve ter no máximo 100 caracteres").nullable().optional(),
  })
  .partial();

type BatchUpdateFormData = z.infer<typeof batchUpdateSchema>;

interface SupplierBatchEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSuppliers: Supplier[];
  onSuccess?: () => void;
}

type BatchOperation = "update" | "delete" | null;

export function SupplierBatchEditDialog({ isOpen, onClose, selectedSuppliers, onSuccess }: SupplierBatchEditDialogProps) {
  const [currentOperation, setCurrentOperation] = useState<BatchOperation>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { mutateAsync: batchUpdateAsync } = useBatchUpdateSuppliers();
  const { mutateAsync: batchDeleteAsync } = useBatchDeleteSuppliers();

  const form = useForm<BatchUpdateFormData>({
    resolver: zodResolver(batchUpdateSchema),
    defaultValues: {
      city: "",
      state: null,
      neighborhood: "",
      addressComplement: "",
    },
  });

  const handleBatchUpdate = async (data: BatchUpdateFormData) => {
    // Only include fields that have values
    const updateData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== "" && value !== null && value !== undefined));

    if (Object.keys(updateData).length === 0) {
      toast.error("Selecione pelo menos um campo para atualizar");
      return;
    }

    setIsProcessing(true);
    setCurrentOperation("update");
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const suppliers = selectedSuppliers.map((supplier) => ({
        id: supplier.id,
        data: updateData,
      }));

      const result = await batchUpdateAsync({ suppliers });

      clearInterval(progressInterval);
      setProgress(100);

      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "fornecedor atualizado" : "fornecedores atualizados"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "fornecedor falhou" : "fornecedores falharam"} ao atualizar`);
        }
      } else {
        toast.success("Fornecedores atualizados com sucesso");
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error during batch update:", error);
      toast.error("Erro ao atualizar fornecedores em lote");
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
      setProgress(0);
    }
  };

  const handleBatchDelete = async () => {
    setIsProcessing(true);
    setCurrentOperation("delete");
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 90));
      }, 150);

      const supplierIds = selectedSuppliers.map((supplier) => supplier.id);

      const result = await batchDeleteAsync({ supplierIds });

      clearInterval(progressInterval);
      setProgress(100);

      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "fornecedor excluído" : "fornecedores excluídos"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "fornecedor falhou" : "fornecedores falharam"} ao excluir`);
        }
      } else {
        toast.success("Fornecedores excluídos com sucesso");
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error during batch delete:", error);
      toast.error("Erro ao excluir fornecedores em lote");
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
      setProgress(0);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    form.reset();
    setCurrentOperation(null);
    setProgress(0);
    onClose();
  };

  const selectedCount = selectedSuppliers.length;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconEdit className="h-5 w-5" />
              Operações em Lote - Fornecedores
            </DialogTitle>
          </DialogHeader>

          {isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                {currentOperation === "update" && "Atualizando fornecedores..."}
                {currentOperation === "delete" && "Excluindo fornecedores..."}
              </div>
              <div className="w-full">
                <Progress value={progress} />
              </div>
              <p className="text-xs text-center text-muted-foreground">{progress}% completo</p>
            </div>
          )}

          {!isProcessing && (
            <div className="space-y-6">
              {/* Selection Summary */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <IconBuilding className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedCount} {selectedCount === 1 ? "fornecedor selecionado" : "fornecedores selecionados"}
                </span>
              </div>

              {/* Selected Suppliers Preview */}
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedSuppliers.slice(0, 5).map((supplier) => (
                  <div key={supplier.id} className="flex items-center gap-2 text-sm">
                    <IconCheck className="h-3 w-3 text-green-500" />
                    <span className="truncate">{supplier.fantasyName}</span>
                    {supplier.city && (
                      <Badge variant="secondary" className="text-xs">
                        {supplier.city}
                      </Badge>
                    )}
                  </div>
                ))}
                {selectedSuppliers.length > 5 && <div className="text-xs text-muted-foreground">E mais {selectedSuppliers.length - 5} fornecedores...</div>}
              </div>

              <Separator />

              {/* Batch Update Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IconEdit className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Atualização em Lote</h3>
                </div>
                <p className="text-xs text-muted-foreground">Preencha apenas os campos que deseja atualizar. Os campos vazios não serão modificados.</p>

                <Form {...form}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Cidade</FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={(value) => {
                                  field.onChange(value);
                                }}
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Nova cidade"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Estado</FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value || "_no_change"}
                                onValueChange={(value) => field.onChange(value === "_no_change" ? "" : value)}
                                options={[
                                  { label: "Não alterar", value: "_no_change" },
                                  ...BRAZILIAN_STATES.map((state) => ({
                                    label: state,
                                    value: state,
                                  })),
                                ]}
                                placeholder="Novo estado"
                                searchPlaceholder="Buscar estado..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="neighborhood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Bairro</FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={(value) => {
                                  field.onChange(value);
                                }}
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Novo bairro"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressComplement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Complemento</FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={(value) => {
                                  field.onChange(value);
                                }}
                                name={field.name}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Novo complemento"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </form>
                </Form>
              </div>

              <Separator />

              {/* Danger Zone */}
              <div className="space-y-3 p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-950/20">
                <div className="flex items-center gap-2">
                  <IconAlertTriangle className="h-4 w-4 text-red-600" />
                  <h3 className="text-sm font-medium text-red-900 dark:text-red-100">Zona de Perigo</h3>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300">Esta ação não pode ser desfeita. Todos os fornecedores selecionados serão excluídos permanentemente.</p>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} className="w-full">
                  <IconTrash className="mr-2 h-4 w-4" />
                  Excluir {selectedCount} {selectedCount === 1 ? "Fornecedor" : "Fornecedores"}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              <IconX className="mr-2 h-4 w-4" />
              Cancelar
            </Button>

            {!isProcessing && (
              <Button onClick={form.handleSubmit(handleBatchUpdate)} disabled={isProcessing}>
                <IconDeviceFloppy className="mr-2 h-4 w-4" />
                Atualizar Selecionados
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <IconAlertTriangle className="h-5 w-5" />
              Confirmar Exclusão em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{selectedCount}</strong> {selectedCount === 1 ? "fornecedor" : "fornecedores"}.
              <br />
              <br />
              Esta ação não pode ser desfeita. Todos os dados relacionados aos fornecedores também serão afetados.
              <br />
              <br />
              Fornecedores que serão excluídos:
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm max-h-32 overflow-y-auto">
                {selectedSuppliers.map((supplier) => (
                  <div key={supplier.id} className="flex items-center gap-2">
                    <span className="font-enhanced-unicode">•</span>
                    <span className="truncate">{supplier.fantasyName}</span>
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} disabled={isProcessing} className="bg-red-700 hover:bg-red-800">
              {isProcessing ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <IconTrash className="mr-2 h-4 w-4" />
                  Sim, Excluir Todos
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
