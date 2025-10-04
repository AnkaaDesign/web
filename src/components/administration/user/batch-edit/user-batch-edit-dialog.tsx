import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "../../../../types";
import { useUserBatchMutations } from "../../../../hooks";
import { USER_STATUS, USER_STATUS_LABELS } from "../../../../constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { IconLoader2, IconDeviceFloppy, IconTrash, IconX, IconAlertTriangle, IconEdit, IconUser, IconCheck } from "@tabler/icons-react";
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
import { usePositions, useSectors } from "../../../../hooks";

// Schema for batch operations - limited fields for bulk update
const batchUpdateSchema = z
  .object({
    positionId: z.string().uuid("ID do cargo inválido").nullable().optional(),
    sectorId: z.string().uuid("ID do setor inválido").nullable().optional(),
    managedSectorId: z.string().uuid("ID do setor gerenciado inválido").nullable().optional(),
    status: z
      .enum(Object.values(USER_STATUS) as [string, ...string[]], {
        errorMap: () => ({ message: "status inválido" }),
      })
      .optional(),
  })
  .partial();

type BatchUpdateFormData = z.infer<typeof batchUpdateSchema>;

interface UserBatchEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: User[];
  onSuccess?: () => void;
}

type BatchOperation = "update" | "delete" | null;

export function UserBatchEditDialog({ isOpen, onClose, selectedUsers, onSuccess }: UserBatchEditDialogProps) {
  const [currentOperation, setCurrentOperation] = useState<BatchOperation>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { batchUpdateAsync, batchDeleteAsync } = useUserBatchMutations();

  // Fetch positions and sectors for selectors
  const { data: positions } = usePositions({ orderBy: { name: "asc" } });
  const { data: sectors } = useSectors({ orderBy: { name: "asc" } });

  const positionOptions =
    positions?.data?.map((position) => ({
      value: position.id,
      label: position.name,
    })) || [];

  const sectorOptions =
    sectors?.data?.map((sector) => ({
      value: sector.id,
      label: sector.name,
    })) || [];

  const form = useForm<BatchUpdateFormData>({
    resolver: zodResolver(batchUpdateSchema),
    defaultValues: {
      positionId: null,
      sectorId: null,
      managedSectorId: null,
      status: undefined,
    },
  });

  const handleBatchUpdate = async (data: BatchUpdateFormData) => {
    // Only include fields that have values
    const updateData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== "" && value !== null && value !== undefined && value !== "_no_change"));

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

      const users = selectedUsers.map((user) => ({
        id: user.id,
        data: updateData,
      }));

      const result = await batchUpdateAsync({ users });

      clearInterval(progressInterval);
      setProgress(100);

      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "usuário atualizado" : "usuários atualizados"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "usuário falhou" : "usuários falharam"} ao atualizar`);
        }
      } else {
        toast.success("Usuários atualizados com sucesso");
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error during batch update:", error);
      toast.error("Erro ao atualizar usuários em lote");
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

      const userIds = selectedUsers.map((user) => user.id);

      const result = await batchDeleteAsync({ userIds });

      clearInterval(progressInterval);
      setProgress(100);

      if (result?.data) {
        const { totalSuccess, totalFailed } = result.data;

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "usuário excluído" : "usuários excluídos"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "usuário falhou" : "usuários falharam"} ao excluir`);
        }
      } else {
        toast.success("Usuários excluídos com sucesso");
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Error during batch delete:", error);
      toast.error("Erro ao excluir usuários em lote");
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

  const selectedCount = selectedUsers.length;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconEdit className="h-5 w-5" />
              Operações em Lote - Usuários
            </DialogTitle>
          </DialogHeader>

          {isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin" />
                {currentOperation === "update" && "Atualizando usuários..."}
                {currentOperation === "delete" && "Excluindo usuários..."}
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
                <IconUser className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedCount} {selectedCount === 1 ? "usuário selecionado" : "usuários selecionados"}
                </span>
              </div>

              {/* Selected Users Preview */}
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center gap-2 text-sm">
                    <IconCheck className="h-3 w-3 text-green-500" />
                    <span className="truncate">{user.name}</span>
                    {user.position && (
                      <Badge variant="secondary" className="text-xs">
                        {user.position.name}
                      </Badge>
                    )}
                    {user.sector && (
                      <Badge variant="secondary" className="text-xs">
                        {user.sector.name}
                      </Badge>
                    )}
                  </div>
                ))}
                {selectedUsers.length > 5 && <div className="text-xs text-muted-foreground">E mais {selectedUsers.length - 5} usuários...</div>}
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
                        name="positionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Cargo</FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value || "_no_change"}
                                onValueChange={(value) => field.onChange(value === "_no_change" ? null : value)}
                                options={[{ value: "_no_change", label: "Não alterar" }, ...positionOptions]}
                                placeholder="Selecione um cargo"
                                emptyText="Nenhum cargo encontrado"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sectorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Setor</FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value || "_no_change"}
                                onValueChange={(value) => field.onChange(value === "_no_change" ? null : value)}
                                options={[{ value: "_no_change", label: "Não alterar" }, ...sectorOptions]}
                                placeholder="Selecione um setor"
                                emptyText="Nenhum setor encontrado"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="managedSectorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Setor Gerenciado</FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value || "_no_change"}
                                onValueChange={(value) => field.onChange(value === "_no_change" ? null : value)}
                                options={[{ value: "_no_change", label: "Não alterar" }, ...sectorOptions]}
                                placeholder="Selecione um setor"
                                emptyText="Nenhum setor encontrado"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Status</FormLabel>
                            <FormControl>
                              <Combobox
                                value={field.value || "_no_change"}
                                onValueChange={(value) => field.onChange(value === "_no_change" ? undefined : value)}
                                options={[
                                  { value: "_no_change", label: "Não alterar" },
                                  ...Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({
                                    value,
                                    label,
                                  })),
                                ]}
                                placeholder="Novo status"
                                searchable={false}
                                clearable={false}
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
                <p className="text-xs text-red-700 dark:text-red-300">Esta ação não pode ser desfeita. Todos os usuários selecionados serão excluídos permanentemente.</p>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} className="w-full">
                  <IconTrash className="mr-2 h-4 w-4" />
                  Excluir {selectedCount} {selectedCount === 1 ? "Usuário" : "Usuários"}
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
              Você está prestes a excluir <strong>{selectedCount}</strong> {selectedCount === 1 ? "usuário" : "usuários"}.
              <br />
              <br />
              Esta ação não pode ser desfeita. Todos os dados relacionados aos usuários também serão afetados.
              <br />
              <br />
              Usuários que serão excluídos:
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm max-h-32 overflow-y-auto">
                {selectedUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-2">
                    <span className="font-enhanced-unicode">•</span>
                    <span className="truncate">{user.name}</span>
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
