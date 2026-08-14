import { useEffect, useState } from "react";
import { IconPaperclip, IconLoader2, IconEye, IconDownload, IconTrash, IconReceipt } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploadField, useFileViewer } from "@/components/common/file";
import { useToast } from "@/hooks/common/use-toast";
import { useOrderMutations, useOrder } from "@/hooks/inventory/use-order";
import { useAirbrushing } from "@/hooks/production/use-airbrushing";
import { useAttachAirbrushingReceipts, useDetachAirbrushingReceipt } from "@/hooks/production/use-airbrushing";
import { createOrderFormData, createAirbrushingFormData } from "@/utils/form-data-helper";
import { getFileDownloadUrl, formatFileSize } from "@/utils/file";
import type { PayableRow } from "../../../types/order";
import type { File as AnkaaFile } from "../../../types";

interface ManageReceiptsDialogProps {
  /** null fecha o diálogo. A linha carrega o id da entidade em `id` (polimórfico por `source`). */
  row: PayableRow | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Gerenciar os comprovantes de uma linha do Contas a Pagar sem sair da lista.
 *
 * `PayableRow` NÃO carrega os recibos (só id/valor/vencimento), então o diálogo busca a
 * entidade ao abrir — é por isso que ele existe como componente separado e só monta
 * quando há linha: assim a query não dispara para toda linha da tabela.
 *
 * Anexar e remover são chamadas separadas contra os endpoints dedicados
 * (`PUT /:id/receipts` e `DELETE /:id/receipts/:fileId`), nunca o PUT genérico com
 * `receiptIds` — aquele é um `set` do Prisma (substituição total) e, no caso do pedido,
 * é WAREHOUSE/ADMIN, fechado justamente para quem liquida.
 */
export function ManageReceiptsDialog({ row, onOpenChange }: ManageReceiptsDialogProps) {
  const open = !!row;
  const isOrder = row?.source === "ORDER";
  const isAirbrushing = row?.source === "AIRBRUSHING";

  const { toast } = useToast();
  const { actions } = useFileViewer();
  const [files, setFiles] = useState<File[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);

  const { attachReceiptsAsync, detachReceiptAsync } = useOrderMutations();
  const { mutateAsync: attachAirbrushingReceiptsAsync } = useAttachAirbrushingReceipts();
  const { mutateAsync: detachAirbrushingReceiptAsync } = useDetachAirbrushingReceipt();

  const orderQuery = useOrder(row?.id ?? "", { include: { receipts: true }, enabled: open && isOrder });
  const airbrushingQuery = useAirbrushing(row?.id ?? "", { include: { receipts: true }, enabled: open && isAirbrushing });

  const isLoading = isOrder ? orderQuery.isLoading : airbrushingQuery.isLoading;
  const receipts: AnkaaFile[] = ((isOrder ? orderQuery.data?.data?.receipts : airbrushingQuery.data?.data?.receipts) ?? []) as AnkaaFile[];

  useEffect(() => {
    if (open) setFiles([]);
  }, [open, row?.id]);

  const refresh = async () => {
    if (isOrder) await orderQuery.refetch();
    else await airbrushingQuery.refetch();
  };

  const handleAttach = async () => {
    if (!row || files.length === 0) return;
    setIsAttaching(true);
    try {
      if (isOrder) {
        await attachReceiptsAsync({ id: row.id, data: createOrderFormData({}, { receipts: files }) });
      } else {
        await attachAirbrushingReceiptsAsync({ id: row.id, data: createAirbrushingFormData({}, { receipts: files }) });
      }
      setFiles([]);
      toast({ title: "Comprovante anexado", variant: "success" });
      // Fecha ao anexar com sucesso: anexar é a ação de saída deste diálogo. Remover
      // NÃO fecha — quem está limpando comprovantes normalmente remove mais de um.
      onOpenChange(false);
    } catch {
      toast({ title: "Não foi possível anexar o comprovante", variant: "error" });
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRemove = async (file: AnkaaFile) => {
    if (!row) return;
    setBusyId(file.id);
    try {
      if (isOrder) await detachReceiptAsync({ id: row.id, fileId: file.id });
      else await detachAirbrushingReceiptAsync({ id: row.id, fileId: file.id });
      await refresh();
      toast({ title: "Comprovante removido", variant: "success" });
    } catch {
      toast({ title: "Não foi possível remover o comprovante", variant: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const busy = isAttaching || !!busyId;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovantes</DialogTitle>
          <DialogDescription>
            {row?.payeeName} — {row?.description}
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0 em todo o corpo: item de grid do DialogContent não encolhe abaixo do
            conteúdo, e um nome de arquivo longo sem espaços estouraria o modal. */}
        <div className="min-w-0 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando comprovantes...
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              <IconReceipt className="h-4 w-4 shrink-0" />
              Nenhum comprovante anexado.
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map((file, index) => (
                <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border/40 bg-card p-2">
                  <IconReceipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size ?? 0)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => actions.viewFiles(receipts, index)} title="Visualizar">
                    <IconEye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => window.open(getFileDownloadUrl(file), "_blank", "noopener,noreferrer")}
                    title="Baixar"
                  >
                    <IconDownload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(file)}
                    disabled={busy}
                    title="Remover"
                  >
                    {busyId === file.id ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <FileUploadField
            onFilesChange={(f) => setFiles(f as unknown as File[])}
            maxFiles={10}
            maxSize={10 * 1024 * 1024}
            acceptedFileTypes={{ "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png"] }}
            showPreview
            variant="compact"
            placeholder="Adicionar comprovante"
            disabled={busy}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Fechar
          </Button>
          <Button onClick={handleAttach} disabled={busy || files.length === 0}>
            {isAttaching ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconPaperclip className="mr-2 h-4 w-4" />}
            Anexar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
