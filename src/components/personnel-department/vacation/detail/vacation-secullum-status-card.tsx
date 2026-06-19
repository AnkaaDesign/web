import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconClockHour4, IconRefresh, IconCloudUpload, IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import { useVacationSecullumStatus, useVacationSyncSecullum } from "../../../../hooks/personnel-department/use-vacations";
import type { VacationSecullumState } from "../../../../api-client/vacation";

interface VacationSecullumStatusCardProps {
  vacationId: string;
  className?: string;
}

const STATE_META: Record<VacationSecullumState, { label: string; variant: "delivered" | "pending" | "secondary" | "destructive" | "outline" }> = {
  SYNCED: { label: "Sincronizado", variant: "delivered" },
  NOT_PUSHED: { label: "Não enviado", variant: "pending" },
  OUT_OF_SYNC: { label: "Divergente", variant: "destructive" },
  NOT_LINKED: { label: "Sem vínculo", variant: "outline" },
  UNKNOWN: { label: "Indisponível", variant: "secondary" },
};

const fmtRange = (r: { inicio: string; fim: string }) => `${r.inicio} → ${r.fim}`;

/**
 * Ponto (Secullum) sync status for a single vacation. Read-derived: compares the
 * gozo períodos with the afastamentos tagged for this vacation in Secullum. Lets
 * HR see whether the férias reached the timeclock and re-push on demand.
 */
export function VacationSecullumStatusCard({ vacationId, className }: VacationSecullumStatusCardProps) {
  const { data, isLoading, isFetching, refetch } = useVacationSecullumStatus(vacationId);
  const sync = useVacationSyncSecullum();

  const status = data?.data;
  const meta = STATE_META[status?.state ?? "UNKNOWN"];

  const handleSync = async () => {
    // The sync endpoint returns HTTP 200 even when Secullum rejected the push;
    // the real outcome is embedded at result.data.{success,message}. The hook
    // already toasts the Secullum message on success === false; just re-read.
    await sync.mutateAsync(vacationId);
    refetch();
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <IconClockHour4 className="h-5 w-5 text-muted-foreground" />
          Ponto (Secullum)
        </CardTitle>
        <Badge variant={meta.variant} className="text-xs">
          {meta.label}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Consultando o ponto...</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{status?.message}</p>

            {status && !status.linked && (
              <Alert variant="warning">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Colaborador não vinculado ao Secullum (sem <code>secullumEmployeeId</code>). As férias não serão enviadas ao ponto até o vínculo ser feito.
                </AlertDescription>
              </Alert>
            )}

            {status && status.linked && (
              <div className="space-y-2 text-sm">
                {status.pushedAbsences.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                      <IconCircleCheck className="h-3.5 w-3.5 text-green-600" /> No ponto ({status.pushedAbsences.length})
                    </div>
                    <ul className="space-y-0.5">
                      {status.pushedAbsences.map((p) => (
                        <li key={p.id} className="tabular-nums text-muted-foreground">
                          {fmtRange(p)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {status.missing.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-destructive mb-1">Faltando no ponto ({status.missing.length})</div>
                    <ul className="space-y-0.5">
                      {status.missing.map((p, i) => (
                        <li key={i} className="tabular-nums text-destructive">
                          {fmtRange(p)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {status.extra.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-amber-600 mb-1">A mais no ponto ({status.extra.length})</div>
                    <ul className="space-y-0.5">
                      {status.extra.map((p) => (
                        <li key={p.id} className="tabular-nums text-amber-600">
                          {fmtRange(p)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching || sync.isPending}>
                <IconRefresh className="h-4 w-4 mr-1.5" />
                Verificar
              </Button>
              <Button size="sm" onClick={handleSync} disabled={sync.isPending || isFetching || !status?.linked}>
                <IconCloudUpload className="h-4 w-4 mr-1.5" />
                {sync.isPending ? "Sincronizando..." : "Sincronizar no ponto"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
