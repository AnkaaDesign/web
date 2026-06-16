import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils";
import { useNfseCancellation } from "@/hooks/financial/use-nfse";
import { NfseCancelDialog } from "./nfse-cancel-dialog";
import type { NfseCancellationStatus } from "@/types/invoice";
import { IconBan, IconLoader2, IconSend } from "@tabler/icons-react";

interface NfseCancellationCardProps {
  elotechNfseId: number;
  /** From the NFS-e detail response — needed to (re)submit a cancellation request */
  invoiceId?: string | null;
  nfseDocumentId?: string | null;
}

// PT-BR label + badge variant for a cancellation-request status code.
function requestStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "AUTORIZADO":
      return <Badge variant="cancelled" className="font-medium">Cancelamento Autorizado</Badge>;
    case "REJEITADO":
      return <Badge variant="destructive" className="font-medium">Cancelamento Rejeitado</Badge>;
    case "AGUARDANDO_FISCAL":
      return <Badge variant="amber" className="font-medium">Aguardando Fiscal</Badge>;
    default:
      return status ? <Badge variant="default" className="font-medium">{status}</Badge> : null;
  }
}

export function NfseCancellationCard({
  elotechNfseId,
  invoiceId,
  nfseDocumentId,
}: NfseCancellationCardProps) {
  const { data: response, isLoading } = useNfseCancellation(elotechNfseId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const data: NfseCancellationStatus | undefined = response?.data;

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <IconBan className="h-5 w-5 text-muted-foreground" />
            Cancelamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 py-6 justify-center">
            <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando dados de cancelamento...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const request = data.request;
  const isRejected = request?.ultimoStatus === "REJEITADO";
  const isPending = request?.ultimoStatus === "AGUARDANDO_FISCAL";
  // A re-request makes sense while the note is still active (not cancelled) and there is
  // no request awaiting fiscal — i.e. no request yet, or the last one was rejected.
  const canResubmit =
    !data.cancelada && !isPending && !!invoiceId && !!nfseDocumentId;

  // The rejection message lives in the latest REJEITADO historico's motivo.
  const rejectionMessage = isRejected
    ? request?.historicos?.find((h) => h.status === "REJEITADO")?.motivo ?? request?.motivo ?? null
    : null;

  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconBan className="h-5 w-5 text-muted-foreground" />
            Cancelamento
          </CardTitle>
          {canResubmit && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setDialogOpen(true)}
            >
              <IconSend className="h-3.5 w-3.5" />
              {isRejected ? "Corrigir e reenviar solicitação" : "Solicitar cancelamento"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!request ? (
          <p className="text-sm text-muted-foreground py-2">
            {data.cancelada
              ? "Esta nota fiscal está cancelada na prefeitura."
              : "Nenhuma solicitação de cancelamento registrada para esta nota."}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Situação da solicitação</span>
              <span>{requestStatusBadge(request.ultimoStatus)}</span>
            </div>

            {request.motivo && (
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground block mb-1">Motivo informado</span>
                <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">{request.motivo}</p>
              </div>
            )}

            {rejectionMessage && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
                <span className="text-sm font-medium text-destructive block mb-1">Motivo da rejeição</span>
                <p className="text-sm text-destructive/90 whitespace-pre-wrap">{rejectionMessage}</p>
              </div>
            )}

            {/* Timeline of request status changes */}
            {request.historicos && request.historicos.length > 0 && (
              <div className="pt-1">
                <span className="text-sm font-medium text-muted-foreground block mb-2">Histórico</span>
                <ol className="space-y-3 border-l border-border pl-4">
                  {request.historicos.map((h, idx) => (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full bg-muted-foreground" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {h.descricaoStatus || h.status || "-"}
                        </span>
                        {h.data && (
                          <span className="text-xs text-muted-foreground">{formatDateTime(h.data)}</span>
                        )}
                      </div>
                      {h.motivo && (
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{h.motivo}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {invoiceId && nfseDocumentId && (
        <NfseCancelDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          invoiceId={invoiceId}
          nfseDocumentId={nfseDocumentId}
          nfseNumber={data.nfseNumber}
          previousRejectionMessage={rejectionMessage}
        />
      )}
    </Card>
  );
}
