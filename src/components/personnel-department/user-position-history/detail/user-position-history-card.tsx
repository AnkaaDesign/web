import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTimeline, IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";
import { POSITION_CHANGE_REASON_LABELS } from "../../../../constants";
import type { POSITION_CHANGE_REASON } from "../../../../constants";
import { useUserPositionHistories } from "../../../../hooks/personnel-department/use-user-position-history";
import { getReasonBadgeVariant, PositionChangeSummary } from "../list/user-position-history-table-columns";
import type { UserPositionHistory } from "../../../../types/user-position-history";

interface UserPositionHistoryCardProps {
  userId: string;
  className?: string;
  /** Maximum height of the scrollable timeline area (defaults to none). */
  maxHeight?: string;
}

/**
 * "Histórico de Cargos" — self-contained timeline card for the collaborator
 * detail page. Fetches its own data (UserPositionHistory by userId) and renders
 * a vertical timeline: position, reason badge, start/end dates, changed-by and
 * note. The open row (endedAt = null) is highlighted as the current position.
 */
export function UserPositionHistoryCard({ userId, className, maxHeight }: UserPositionHistoryCardProps) {
  const {
    data: response,
    isLoading,
    error,
  } = useUserPositionHistories(
    {
      userIds: [userId],
      orderBy: { startedAt: "desc" },
      limit: 100,
      include: {
        position: true,
        previousPosition: true,
        changedBy: true,
      },
    },
    { enabled: !!userId },
  );

  const records: UserPositionHistory[] = response?.data || [];

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconTimeline className="h-5 w-5 text-muted-foreground" />
          Histórico de Cargos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-destructive">
            <IconAlertTriangle className="h-8 w-8 mb-3" />
            <div className="text-sm font-medium">Não foi possível carregar o histórico de cargos</div>
          </div>
        ) : records.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Nenhum registro de cargo para este colaborador.</div>
        ) : (
          <div className="relative pl-5 space-y-5 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border">
            {records.map((record) => {
              const isCurrent = !record.endedAt;
              return (
                <div key={record.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-background",
                      isCurrent ? "bg-green-700" : "bg-muted-foreground/40",
                    )}
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PositionChangeSummary history={record} />
                      <Badge variant={getReasonBadgeVariant(record.reason)} className="text-xs whitespace-nowrap">
                        {POSITION_CHANGE_REASON_LABELS[record.reason as POSITION_CHANGE_REASON] || record.reason}
                      </Badge>
                      {isCurrent && (
                        <Badge variant="active" className="text-xs whitespace-nowrap">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.startedAt ? formatDate(new Date(record.startedAt)) : "-"}
                      {isCurrent ? (
                        <span> — presente</span>
                      ) : (
                        <span>
                          {" — "}
                          {record.endedAt ? formatDate(new Date(record.endedAt)) : "-"}
                        </span>
                      )}
                      <span> · por {record.changedBy?.name || <span className="italic">Sistema</span>}</span>
                    </div>
                    {record.note && <div className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{record.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
