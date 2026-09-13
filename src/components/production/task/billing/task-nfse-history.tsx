import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils";
import { useTaskNfseHistory, useResendNfseToAdn } from "@/hooks/production/use-invoice";
import { toast } from "@/components/ui/sonner";
import { NfseStatusBadge } from "./nfse-status-badge";
import { NfseCancelDialog } from "@/components/financial/nfse/nfse-cancel-dialog";
import type { TaskNfseHistory, TaskNfseHistoryItem } from "@/types/invoice";
import { routes } from "@/constants";
import { IconAlertTriangle, IconFileInvoice, IconLoader2, IconRefresh, IconX } from "@tabler/icons-react";

interface TaskNfseHistoryProps {
  taskId: string;
}

// A note is still "active" at the prefeitura (and thus cancellable) when it is not yet
// cancelled and is authorized or had a previous cancellation request rejected.
function isActiveNote(nfse: TaskNfseHistoryItem): boolean {
  return !nfse.cancelada && (nfse.status === "AUTHORIZED" || nfse.status === "CANCEL_REJECTED");
}

/**
 * Unified NFS-e section for a task — lists EVERY note (active, cancelled, rejected, orphan)
 * with its number, situação badge, emissão, valor and ISS. Each still-active note exposes a
 * Cancelar action (document-scoped, so invoice-less orphans can be cancelled too).
 */
export function TaskNfseHistoryCard({ taskId }: TaskNfseHistoryProps) {
  const navigate = useNavigate();
  const [cancelTarget, setCancelTarget] = useState<TaskNfseHistoryItem | null>(null);
  // Poll while any note has a cancellation awaiting fiscal — the prefeitura
  // resolves CANCEL_REQUESTED → CANCELLED/CANCEL_REJECTED asynchronously.
  const [pollInterval, setPollInterval] = useState<number | false>(false);
  const { data: response, isLoading } = useTaskNfseHistory(taskId, { refetchInterval: pollInterval });
  const resendToAdn = useResendNfseToAdn();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const history: TaskNfseHistory | undefined = response?.data;
  // Latest first (highest NF number on top; not-yet-emitted notes last).
  const nfses: TaskNfseHistoryItem[] = [...(history?.nfses ?? [])].sort(
    (a, b) => (b.nfseNumber ?? -1) - (a.nfseNumber ?? -1),
  );

  // Keep polling alive only while a cancellation is in flight; stop once it resolves.
  const hasPendingCancellation = nfses.some((nfse) => nfse.status === "CANCEL_REQUESTED");
  useEffect(() => {
    setPollInterval(hasPendingCancellation ? 15000 : false);
  }, [hasPendingCancellation]);

  // Hide the card entirely when there is nothing to show (keeps the review page clean).
  if (!isLoading && nfses.length === 0) return null;

  const handleResendToAdn = (nfse: TaskNfseHistoryItem) => {
    setResendingId(nfse.id);
    resendToAdn.mutate(nfse.id, {
      // A mutation dá sucesso mesmo quando o ADN continua fora — quem decide é o estado
      // devolvido, não o status HTTP.
      onSuccess: (result) => {
        if (result?.hasError) toast.error(result.message);
        else toast.success(result?.message ?? "NFS-e compartilhada com o ADN.");
      },
      onError: (error: any) =>
        toast.error(
          error?.response?.data?.message ?? "Falha ao reenviar a NFS-e ao ADN.",
        ),
      onSettled: () => setResendingId(null),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
          Histórico de NFS-e
          {history && history.total > 0 && (
            <Badge variant="secondary" className="ml-1">{history.total}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando NFS-e...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {nfses.map((nfse) => {
              const clickable = !!nfse.elotechNfseId;
              const active = isActiveNote(nfse);
              return (
                <div
                  key={nfse.id}
                  className={`rounded-md border border-border/50 px-3 py-2.5 transition-colors ${clickable ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  onClick={() =>
                    clickable && navigate(routes.financial.nfse.detail(nfse.elotechNfseId!))
                  }
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-medium">
                        {nfse.nfseNumber ? `Nº ${nfse.nfseNumber}` : "Sem número"}
                      </span>
                      {/* When the prefeitura already shows the note cancelled, reflect that
                          explicitly; otherwise show the local lifecycle status. */}
                      {nfse.cancelada ? (
                        <Badge variant="cancelled" size="sm" className="font-medium">
                          Cancelada
                        </Badge>
                      ) : (
                        <NfseStatusBadge status={nfse.status} size="sm" />
                      )}
                    </div>
                    {active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelTarget(nfse);
                        }}
                      >
                        <IconX className="h-3.5 w-3.5" />
                        {nfse.status === "CANCEL_REJECTED" ? "Corrigir e reenviar" : "Cancelar NFS-e"}
                      </Button>
                    )}
                  </div>

                  {/* Fiscal figures — Número/Emissão/Valor/ISS (matches the old NFS-e block) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 p-2.5 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Número</p>
                      <p className="text-xs font-semibold">{nfse.nfseNumber ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Emissão</p>
                      <p className="text-xs font-semibold">
                        {nfse.dataEmissao ? formatDate(nfse.dataEmissao) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Valor</p>
                      <p className="text-xs font-semibold">
                        {nfse.valorDoc != null ? formatCurrency(nfse.valorDoc) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">ISS</p>
                      <p className="text-xs font-semibold">
                        {nfse.valorISS != null ? formatCurrency(nfse.valorISS) : "-"}
                      </p>
                    </div>
                  </div>

                  {/* Nota válida no município mas ausente do ADN: é o estado em que o
                      DANFSe sai com marca d'água de erro e o cancelamento é recusado
                      (E1831). O reenvio é a saída, e precisa vir ANTES de qualquer evento. */}
                  {nfse.adnError && (
                    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2">
                      <div className="flex items-start gap-2">
                        <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
                            Não compartilhada com o Ambiente Nacional (ADN)
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            A nota é válida na prefeitura, mas o envio ao ADN falhou. O PDF sai com
                            marca d'água de erro e o cancelamento é recusado até o reenvio.
                          </p>
                          {nfse.adnCanResend && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 mt-2"
                              disabled={resendingId === nfse.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResendToAdn(nfse);
                              }}
                            >
                              {resendingId === nfse.id ? (
                                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <IconRefresh className="h-3.5 w-3.5" />
                              )}
                              Reenviar ao ADN
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error / rejection details */}
                  {nfse.errorMessage && (
                    <p className="text-xs text-destructive mt-1">{nfse.errorMessage}</p>
                  )}
                  {nfse.status === "CANCEL_REJECTED" && nfse.cancelRejectionMessage && (
                    <p className="text-xs text-destructive mt-1">
                      Cancelamento rejeitado: {nfse.cancelRejectionMessage}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {cancelTarget && (
        <NfseCancelDialog
          open={!!cancelTarget}
          onOpenChange={(open) => !open && setCancelTarget(null)}
          // No invoiceId → uses the document-scoped endpoint (works for orphan notes too).
          nfseDocumentId={cancelTarget.id}
          nfseNumber={cancelTarget.nfseNumber}
          previousRejectionMessage={
            cancelTarget.status === "CANCEL_REJECTED" ? cancelTarget.cancelRejectionMessage : null
          }
          supersededByNfseNumber={cancelTarget.supersededByNfseNumber}
          onCancelled={() => setCancelTarget(null)}
        />
      )}
    </Card>
  );
}
