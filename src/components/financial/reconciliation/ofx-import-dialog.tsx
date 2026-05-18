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
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const importMutation = useImportOfx({
    onUploadProgress: e => {
      if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  useEffect(() => {
    if (!open) {
      setFile(null);
      setProgress(0);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!file) return;
    importMutation.mutate(file, {
      onSuccess: data => {
        toast({
          title: "Extrato importado",
          description: `${data.transactionCount} transações, ${data.autoMatchedCount} conciliadas automaticamente`,
          variant: "success",
        });
        onImported?.(data);
        onOpenChange(false);
      },
      onError: err => {
        toast({
          title: "Erro ao importar extrato",
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
          <DialogTitle>Importar Extrato OFX</DialogTitle>
          <DialogDescription>
            Envie o extrato exportado do Sicredi (.ofx). Executamos pareamento automático contra
            boletos pagos e notas fiscais já conhecidas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <OfxUploadDropzone
            onFileSelected={f => {
              setFile(f ?? null);
              setProgress(0);
            }}
            selectedFile={file}
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
          <Button onClick={handleSubmit} disabled={!file || importMutation.isPending}>
            <IconUpload className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
