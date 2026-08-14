import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconReceipt, IconLayoutGrid, IconList, IconPaperclip, IconTrash, IconLoader2 } from "@tabler/icons-react";
import type { Order } from "../../../../types";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode, useFileViewer } from "@/components/common/file";
import { AttachReceiptsDialog } from "@/components/financial/common/attach-receipts-dialog";
import { useOrderMutations } from "@/hooks/inventory/use-order";
import { useToast } from "@/hooks/common/use-toast";
import { createOrderFormData } from "@/utils/form-data-helper";
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

interface OrderDocumentsSectionProps {
  order: Order;
  /**
   * Habilita anexar/remover comprovante. Espelha `PUT /orders/:id/receipts` e
   * `DELETE /orders/:id/receipts/:fileId` (FINANCIAL/ACCOUNTING/ADMIN/WAREHOUSE) —
   * deliberadamente MAIS amplo que a edição do pedido, que é WAREHOUSE/ADMIN.
   */
  canManageReceipts?: boolean;
}

/**
 * "Comprovantes" gallery — grid/list toggle + click-to-preview via the app-level file
 * viewer, plus attach/remove for the payment-side roles.
 *
 * Attach and remove are two SEPARATE single-intent calls against the dedicated receipts
 * endpoints. Neither goes through the generic `PUT /orders/:id` with `receiptIds`: that
 * one is a Prisma `set` (full replace, needs the whole list hydrated) and is
 * WAREHOUSE/ADMIN-only, so the roles that attach a comprovante could never fix a wrong
 * one. Trocar = anexar o novo, remover o antigo.
 */
export function OrderDocumentsSection({ order, canManageReceipts = false }: OrderDocumentsSectionProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const { actions } = useFileViewer();
  const { toast } = useToast();
  const { attachReceiptsAsync, detachReceiptAsync } = useOrderMutations();
  const [attachOpen, setAttachOpen] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<AnkaaFile | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const receipts = order.receipts || [];

  const handleFileClick = (file: AnkaaFile) => {
    const index = receipts.findIndex((f) => f.id === file.id);
    actions.viewFiles(receipts, index);
  };

  const handleAttach = async (selected: File[]) => {
    setIsAttaching(true);
    try {
      await attachReceiptsAsync({ id: order.id, data: createOrderFormData({}, { receipts: selected }) });
      toast({ title: "Comprovante anexado", variant: "success" });
      setAttachOpen(false);
    } catch {
      toast({ title: "Não foi possível anexar o comprovante", variant: "error" });
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemove = async () => {
    if (!pendingRemoval) return;
    const file = pendingRemoval;
    setPendingRemoval(null);
    setRemovingId(file.id);
    try {
      await detachReceiptAsync({ id: order.id, fileId: file.id });
      toast({ title: "Comprovante removido", variant: "success" });
    } catch {
      toast({ title: "Não foi possível remover o comprovante", variant: "error" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        {canManageReceipts && (
          <Button variant="outline" size="sm" className="mr-auto h-8 gap-1.5" onClick={() => setAttachOpen(true)}>
            <IconPaperclip className="h-4 w-4" />
            Anexar comprovante
          </Button>
        )}
        <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="h-8 w-8 p-0">
          <IconList className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0">
          <IconLayoutGrid className="h-4 w-4" />
        </Button>
      </div>

      <AttachReceiptsDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        onConfirm={handleAttach}
        isPending={isAttaching}
        description="Anexe o comprovante do pagamento deste pedido. Os comprovantes já anexados são mantidos."
      />

      {receipts.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto">
          <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
            {receipts.map((file) => (
              <div key={file.id} className={cn("relative min-w-0", viewMode === "grid" && "w-fit")}>
                <FileItem file={file} viewMode={viewMode} onPreview={handleFileClick} />
                {canManageReceipts && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-2 h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingRemoval(file);
                    }}
                    disabled={removingId === file.id}
                    title="Remover comprovante"
                  >
                    {removingId === file.id ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconTrash className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <IconReceipt className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum comprovante cadastrado</h3>
          <p className="text-sm text-muted-foreground">
            {canManageReceipts ? "Anexe o comprovante aqui ou ao registrar o pagamento no Contas a Pagar." : "Este pedido não possui comprovantes anexados."}
          </p>
        </div>
      )}

      <AlertDialog open={!!pendingRemoval} onOpenChange={(o) => !o && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover comprovante</AlertDialogTitle>
            <AlertDialogDescription>
              Remover "{pendingRemoval?.filename}" deste pedido? O arquivo deixa de ficar vinculado ao pedido, mas não é excluído do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
