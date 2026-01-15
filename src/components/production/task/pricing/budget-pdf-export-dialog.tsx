import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import { IconFileDownload, IconX } from "@tabler/icons-react";
import type { FileWithPreview } from "@/types/file";

interface BudgetPdfExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (notes: string, images: FileWithPreview[]) => void;
  isExporting?: boolean;
}

export function BudgetPdfExportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting = false,
}: BudgetPdfExportDialogProps) {
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<FileWithPreview[]>([]);

  const handleExport = () => {
    onExport(notes, images);
  };

  const handleClose = () => {
    if (!isExporting) {
      setNotes("");
      setImages([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFileDownload className="h-5 w-5" />
            Exportar Orçamento em PDF
          </DialogTitle>
          <DialogDescription>
            Adicione observações e imagens do projeto aprovado para incluir no orçamento em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Notes Text Area */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Observações / Notas
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Digite observações ou notas adicionais que serão incluídas no orçamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isExporting}
            />
            <p className="text-xs text-muted-foreground">
              Estas observações aparecerão no orçamento após os itens de precificação.
            </p>
          </div>

          {/* Project Images Upload */}
          <div className="space-y-2">
            <Label>
              Imagens do Projeto
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <FileUploadField
              onFilesChange={setImages}
              maxFiles={5}
              maxSize={10 * 1024 * 1024} // 10MB
              acceptedFileTypes={{
                "image/*": [".jpeg", ".jpg", ".png", ".webp"],
              }}
              existingFiles={images}
              disabled={isExporting}
              showPreview={true}
              variant="compact"
              placeholder="Arraste imagens do projeto aprovado ou clique para selecionar"
              label=""
            />
            <p className="text-xs text-muted-foreground">
              As imagens serão exibidas no final do orçamento. Máximo de 5 imagens, 10MB cada.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            <IconX className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
          >
            <IconFileDownload className="h-4 w-4 mr-2" />
            {isExporting ? "Gerando PDF..." : "Exportar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
