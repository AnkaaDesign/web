import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconUpload } from "@tabler/icons-react";
import { OfxUploadDropzone } from "./ofx-upload-dropzone";
import { useImportOfx } from "@/hooks/financial/use-reconciliation";
import { useToast } from "@/hooks/common/use-toast";
import type { ImportSummary } from "@/types/reconciliation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (summary: ImportSummary) => void;
}

export function OfxImportDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);

  const importMutation = useImportOfx({
    onUploadProgress: e => {
      if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setProgress(0);
    }
  }, [open]);

  const handleSubmit = () => {
    if (files.length === 0) return;
    importMutation.mutate(files, {
      onSuccess: data => {
        const failed = data.failedFiles.length;
        const desc =
          `${data.transactionsInserted} transações inseridas` +
          (data.duplicatesSkipped > 0 ? `, ${data.duplicatesSkipped} duplicadas ignoradas` : "") +
          (data.autoMatchedCount > 0 ? `, ${data.autoMatchedCount} conciliadas automaticamente` : "");
        toast({
          title: failed > 0 ? "Importação concluída com avisos" : "Extratos importados",
          description: failed > 0 ? `${desc} — ${failed} arquivo(s) falharam` : desc,
          variant: failed > 0 ? "warning" : "success",
        });
        onImported?.(data);
        onOpenChange(false);
      },
      onError: err => {
        toast({
          title: "Erro ao importar extratos",
          description: (err as Error).message || "Tente novamente",
          variant: "error",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Transações OFX</DialogTitle>
          <DialogDescription>
            Envie um ou mais arquivos .ofx/.qfx do Sicredi, ou um .zip com vários extratos.
            Transações repetidas são detectadas pelo FITID e nunca duplicam.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <OfxUploadDropzone
            onFilesSelected={fs => {
              setFiles(fs);
              setProgress(0);
            }}
            selectedFiles={files}
            disabled={importMutation.isPending}
          />
          {importMutation.isPending && progress > 0 && (
            <p className="text-sm text-muted-foreground">Enviando: {progress}%</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={files.length === 0 || importMutation.isPending}>
            <IconUpload className="h-4 w-4 mr-2" />
            {importMutation.isPending
              ? "Importando..."
              : `Importar ${files.length || ""} arquivo(s)`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
