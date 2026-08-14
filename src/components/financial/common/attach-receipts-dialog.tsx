import { useEffect, useState } from "react";
import { IconPaperclip, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploadField } from "@/components/common/file";

interface AttachReceiptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sobe os arquivos. Deve APENDAR — quem chama usa o endpoint `:id/receipts`. */
  onConfirm: (files: File[]) => Promise<void>;
  isPending: boolean;
  title?: string;
  description?: string;
}

/**
 * Anexo de comprovante(s) de pagamento — compartilhado por pedido e aerografia.
 *
 * Sempre APENDA: quem chama passa por `PUT /:id/receipts`, nunca pelo PUT genérico com
 * `receiptIds` (que é um `set` do Prisma — substituição total da relação, e portanto
 * exige a lista inteira hidratada). Remover é a operação irmã e separada
 * (`DELETE /:id/receipts/:fileId`); trocar = anexar o novo, remover o antigo. Duas
 * intenções únicas em vez de uma composta: se uma falhar, a outra não deixa o registro
 * sem comprovante nenhum.
 */
export function AttachReceiptsDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  title = "Anexar comprovante",
  description = "Anexe o comprovante do pagamento. Os comprovantes já anexados são mantidos.",
}: AttachReceiptsDialogProps) {
  const [files, setFiles] = useState<File[]>([]);

  // Zera a seleção a cada abertura — reabrir não pode reenviar o anexo anterior.
  useEffect(() => {
    if (open) setFiles([]);
  }, [open]);

  const handleConfirm = async () => {
    if (files.length === 0) return;
    await onConfirm(files);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* min-w-0: item de grid do DialogContent não encolhe abaixo do conteúdo, então
            um nome de arquivo longo sem espaços estoura o modal em vez de truncar. */}
        <div className="min-w-0">
          <FileUploadField
            onFilesChange={(f) => setFiles(f as unknown as File[])}
            maxFiles={10}
            maxSize={10 * 1024 * 1024}
            acceptedFileTypes={{ "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png"] }}
            showPreview
            variant="compact"
            placeholder="Adicionar comprovante"
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || files.length === 0}>
            {isPending ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconPaperclip className="mr-2 h-4 w-4" />}
            Anexar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
