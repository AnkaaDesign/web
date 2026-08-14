import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { useCancelNfse, useCancelNfseByDocument } from "@/hooks/production/use-invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CANCEL_REASONS = [
  { code: "1", label: "Erro na emissão" },
  { code: "2", label: "Serviço não prestado" },
  { code: "4", label: "Duplicidade da nota" },
];

interface NfseCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When provided, cancellation uses the invoice-scoped endpoint. When omitted, the
   * document-scoped endpoint (PUT /nfse/document/:id/cancel) is used instead — this works
   * for ANY note, including invoice-less (orphan) ones.
   */
  invoiceId?: string;
  nfseDocumentId: string;
  /** Number shown in the dialog header */
  nfseNumber?: number | string | null;
  /** Rejection message from a previous request (surfaced so the user can correct & resubmit) */
  previousRejectionMessage?: string | null;
  /**
   * Número da nota que já substituiu esta (NfseDocument.supersededByNfseNumber). Quando o
   * refaturamento emitiu a nota nova, o sistema já sabe qual é a substituta — então o campo
   * vem preenchido e o operador não precisa ir procurar o número em outra tela.
   */
  supersededByNfseNumber?: number | null;
  onCancelled?: () => void;
}

/**
 * Shared NFS-e cancellation dialog. Cancellation at the prefeitura is asynchronous:
 * submitting only registers a request (AGUARDANDO_FISCAL) that is later authorized or
 * rejected. The backend message already states the outcome — we surface it via toast.
 *
 * Sobre a nota substituta: a regra antiga só a exigia em Duplicidade (código 4). Na prática o
 * fiscal de Ibiporã a exige em QUALQUER cancelamento de nota que não seja do dia — a NF 3199
 * foi recusada com motivo 1 pedindo "o MOTIVO do cancelamento e o NÚMERO da nota fiscal
 * substituta". Então ela passa a ser exigida também sempre que já houve uma recusa anterior.
 */
export function NfseCancelDialog({
  open,
  onOpenChange,
  invoiceId,
  nfseDocumentId,
  nfseNumber,
  previousRejectionMessage,
  supersededByNfseNumber,
  onCancelled,
}: NfseCancelDialogProps) {
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState("1");
  const [substituteNumber, setSubstituteNumber] = useState("");
  const cancelNfse = useCancelNfse();
  const cancelNfseByDocument = useCancelNfseByDocument();
  // Invoice-less notes (orphans) must use the document-scoped endpoint.
  const isPending = invoiceId ? cancelNfse.isPending : cancelNfseByDocument.isPending;

  // Reset fields whenever the dialog (re)opens
  useEffect(() => {
    if (open) {
      setReason("");
      setReasonCode("1");
      // Pré-preenche com a substituta que o refaturamento já emitiu, quando existe.
      setSubstituteNumber(supersededByNfseNumber ? String(supersededByNfseNumber) : "");
    }
  }, [open, supersededByNfseNumber]);

  // Duplicidade sempre exige. Uma recusa anterior também: o fiscal já disse, por escrito,
  // que sem o número da substituta ele não cancela — reenviar sem ela só queima outra recusa.
  const substituteRequired = reasonCode === "4" || !!previousRejectionMessage;

  const handleConfirm = () => {
    if (!reason.trim() || reason.trim().length < 15) {
      toast.error("Motivo do cancelamento é obrigatório e deve ter no mínimo 15 caracteres.");
      return;
    }
    if (substituteRequired && !substituteNumber.trim()) {
      toast.error(
        reasonCode === "4"
          ? "Informe o número da nota fiscal substituta para cancelamento por duplicidade."
          : "A prefeitura já recusou este cancelamento pedindo o número da nota substituta. Informe-o antes de reenviar.",
      );
      return;
    }

    const data = {
      reason,
      reasonCode: Number(reasonCode),
      substituteNfseNumber: substituteNumber.trim() ? Number(substituteNumber) : undefined,
    };

    const onSuccess = (result: any) => {
      if (result?.message) {
        if (result.rejected) {
          toast.error(result.message);
        } else {
          toast.success(result.message);
        }
      }
      onOpenChange(false);
      onCancelled?.();
    };

    if (invoiceId) {
      cancelNfse.mutate({ invoiceId, nfseDocumentId, data }, { onSuccess });
    } else {
      cancelNfseByDocument.mutate({ nfseDocumentId, data }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar NFS-e</DialogTitle>
          <DialogDescription>
            Informe o motivo do cancelamento da NFS-e
            {nfseNumber ? ` nº ${nfseNumber}` : ""}. A solicitação será enviada ao
            fiscal da prefeitura para análise.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Motivo</label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Justificativa</label>
            <Input
              value={reason}
              onChange={(value) => setReason(String(value ?? ""))}
              placeholder="Descreva o motivo do cancelamento..."
            />
          </div>
          <div>
            <label
              className={`text-sm font-medium mb-1.5 block ${substituteRequired ? "text-destructive" : ""}`}
            >
              Nota fiscal substituta (Nº)
              {substituteRequired && <span className="text-destructive"> *</span>}
            </label>
            <Input
              type="number"
              value={substituteNumber}
              onChange={(value) => setSubstituteNumber(String(value ?? ""))}
              placeholder="Número da NFS-e que substitui esta nota"
              className={substituteRequired ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {substituteRequired && (
              <p className="text-xs text-destructive mt-1">
                {reasonCode === "4"
                  ? "Obrigatório para cancelamento por duplicidade."
                  : "Obrigatório: a prefeitura já recusou este cancelamento pedindo o número da nota substituta."}
              </p>
            )}
            {!!supersededByNfseNumber && (
              <p className="text-xs text-muted-foreground mt-1">
                Preenchido automaticamente com a NFS-e nº {supersededByNfseNumber}, emitida no
                refaturamento desta tarefa.
              </p>
            )}
          </div>
          {previousRejectionMessage && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-medium text-destructive">Solicitação anterior rejeitada</p>
              <p className="text-xs text-destructive/90 mt-0.5">{previousRejectionMessage}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Enviando..." : "Confirmar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
