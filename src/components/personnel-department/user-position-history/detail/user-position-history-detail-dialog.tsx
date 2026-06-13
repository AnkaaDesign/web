import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { POSITION_CHANGE_REASON_LABELS } from "../../../../constants";
import type { POSITION_CHANGE_REASON } from "../../../../constants";
import { formatDate, formatDateTime } from "../../../../utils";
import { getReasonBadgeVariant, PositionChangeSummary, ChangedByLabel } from "../list/user-position-history-table-columns";
import type { UserPositionHistory } from "../../../../types/user-position-history";

interface UserPositionHistoryDetailDialogProps {
  history: UserPositionHistory | null;
  onOpenChange: (open: boolean) => void;
}

export function UserPositionHistoryDetailDialog({ history, onOpenChange }: UserPositionHistoryDetailDialogProps) {
  return (
    <Dialog open={!!history} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Detalhes da Mudança de Cargo</DialogTitle>
          <DialogDescription>Registro do histórico de cargos do colaborador</DialogDescription>
        </DialogHeader>

        {history && (
          <div className="space-y-3 text-sm py-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Colaborador</span>
              <span className="font-medium truncate">{history.user?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Mudança</span>
              <PositionChangeSummary history={history} className="justify-end" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Motivo</span>
              <Badge variant={getReasonBadgeVariant(history.reason)}>{POSITION_CHANGE_REASON_LABELS[history.reason as POSITION_CHANGE_REASON] || history.reason}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Início</span>
              <span className="font-medium">{history.startedAt ? formatDate(new Date(history.startedAt)) : "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Fim</span>
              {history.endedAt ? <span className="font-medium">{formatDate(new Date(history.endedAt))}</span> : <Badge variant="active">Atual</Badge>}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Alterado Por</span>
              <span className="font-medium truncate">
                <ChangedByLabel history={history} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Criado Em</span>
              <span className="font-medium">{history.createdAt ? formatDateTime(new Date(history.createdAt)) : "-"}</span>
            </div>
            {history.note && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">Observação</div>
                <div className="whitespace-pre-wrap break-words">{history.note}</div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
