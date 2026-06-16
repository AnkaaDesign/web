import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils";
import { useTaskNfseHistory } from "@/hooks/production/use-invoice";
import { NfseStatusBadge } from "./nfse-status-badge";
import { NfseCancelDialog } from "@/components/financial/nfse/nfse-cancel-dialog";
import type { TaskNfseHistory, TaskNfseHistoryItem } from "@/types/invoice";
import { routes } from "@/constants";
import { IconFileInvoice, IconLoader2, IconX } from "@tabler/icons-react";

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
  const { data: response, isLoading } = useTaskNfseHistory(taskId);
  const [cancelTarget, setCancelTarget] = useState<TaskNfseHistoryItem | null>(null);

  const history: TaskNfseHistory | undefined = response?.data;
  // Latest first (highest NF number on top; not-yet-emitted notes last).
  const nfses: TaskNfseHistoryItem[] = [...(history?.nfses ?? [])].sort(
    (a, b) => (b.nfseNumber ?? -1) - (a.nfseNumber ?? -1),
  );

  // Hide the card entirely when there is nothing to show (keeps the review page clean).
  if (!isLoading && nfses.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
          NFS-e
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
          onCancelled={() => setCancelTarget(null)}
        />
      )}
    </Card>
  );
}
