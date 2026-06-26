import { useEffect } from "react";
import { IconDownload, IconLoader2, IconThumbDown, IconThumbUp } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { useDownloadAssinaturaItemPdf } from "../../../../hooks";
import { formatDateTime } from "../../../../utils";

export interface AssinaturaDialogItem {
  Id: number;
  FuncionarioId: number;
  Funcionario: string;
  Status: number;
  DataResposta: string | null;
  Resposta: string | null;
}

interface AssinaturaItemDialogProps {
  open: boolean;
  apuracaoId: number;
  item: AssinaturaDialogItem | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Pendente",
  1: "Aprovado",
  2: "Rejeitado",
};

function StatusBadge({ status }: { status: number }) {
  if (status === 1) {
    return (
      <Badge variant="success" className="gap-1">
        <IconThumbUp className="h-3 w-3" />
        Aprovado
      </Badge>
    );
  }
  if (status === 2) {
    return (
      <Badge variant="destructive" className="gap-1">
        <IconThumbDown className="h-3 w-3" />
        Rejeitado
      </Badge>
    );
  }
  return <Badge variant="outline">{STATUS_LABELS[status] ?? "—"}</Badge>;
}

export function AssinaturaItemDialog({ open, apuracaoId, item, onClose }: AssinaturaItemDialogProps) {
  const downloadPdf = useDownloadAssinaturaItemPdf();

  // Clear any previous mutation state when the dialog opens for a different item.
  useEffect(() => {
    if (open) downloadPdf.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.Id]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assinatura Digital de Cartão Ponto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Funcionário</Label>
            <Input value={item.Funcionario || "—"} readOnly disabled />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="h-9 flex items-center">
                <StatusBadge status={item.Status} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data da Resposta</Label>
              <Input value={item.DataResposta ? formatDateTime(item.DataResposta) : "—"} readOnly disabled />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Justificativa</Label>
            <Textarea
              value={item.Resposta || ""}
              readOnly
              disabled
              rows={3}
              placeholder={item.Resposta ? "" : "Sem justificativa registrada."}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="default"
            onClick={() =>
              downloadPdf.mutate({
                apuracaoId,
                funcionarioId: item.FuncionarioId,
                funcionarioName: item.Funcionario,
              })
            }
            disabled={downloadPdf.isPending}
          >
            {downloadPdf.isPending ? (
              <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <IconDownload className="h-4 w-4 mr-2" />
            )}
            Baixar Cartão Ponto
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
