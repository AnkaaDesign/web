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
import { XmlUploadDropzone } from "./xml-upload-dropzone";
import { useImportFiscalDocuments } from "@/hooks/financial/use-reconciliation";
import { useToast } from "@/hooks/common/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function XmlImportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);

  const importMutation = useImportFiscalDocuments();

  useEffect(() => {
    if (!open) setFiles([]);
  }, [open]);

  const handleUpload = () => {
    if (files.length === 0) return;
    importMutation.mutate(files, {
      onSuccess: result => {
        toast({
          title: "Notas processadas",
          description: `${result.created} criadas, ${result.skipped} duplicadas${
            result.failed > 0 ? `, ${result.failed} com erro` : ""
          }`,
          variant: result.failed > 0 ? "warning" : "success",
        });
        onOpenChange(false);
      },
      onError: err => {
        toast({
          title: "Erro ao importar",
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
          <DialogTitle>Importar Notas Fiscais</DialogTitle>
          <DialogDescription>
            Envie XMLs avulsos ou um ZIP. Notas duplicadas pela chave de acesso são ignoradas.
          </DialogDescription>
        </DialogHeader>
        <XmlUploadDropzone
          onFilesSelected={setFiles}
          selectedFiles={files}
          disabled={importMutation.isPending}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || importMutation.isPending}
          >
            <IconUpload className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Enviando..." : `Enviar ${files.length} arquivo(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
