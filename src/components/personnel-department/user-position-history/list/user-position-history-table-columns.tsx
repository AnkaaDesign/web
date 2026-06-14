import React from "react";
import { formatDate } from "../../../../utils";
import { POSITION_CHANGE_REASON, POSITION_CHANGE_REASON_LABELS } from "../../../../constants";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconArrowRight, IconArrowUpRight, IconArrowDownRight, IconUserPlus, IconPencil } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { UserPositionHistory } from "../../../../types/user-position-history";

export interface UserPositionHistoryColumn {
  key: string;
  header: string;
  accessor: (history: UserPositionHistory) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// DEMOTION=Reversão, ADJUSTMENT=Readaptação e CORRECTION=Reenquadramento são
// movimentos LÍCITOS (não punitivos), então usam variantes neutras — nada de
// vermelho/"cancelled", que sugeriria rebaixamento.
const REASON_BADGE_VARIANTS: Record<string, BadgeProps["variant"]> = {
  ADMISSION: "blue",
  PROMOTION: "active",
  TRANSFER: "secondary",
  DEMOTION: "secondary",
  ADJUSTMENT: "muted",
  CORRECTION: "outline",
};

export const getReasonBadgeVariant = (reason: string): BadgeProps["variant"] => REASON_BADGE_VARIANTS[reason] || "default";

/**
 * Semantic rendering of a position change, per reason:
 * - ADMISSION  → "Admitido como <Cargo>" (no arrow — there is no previous position)
 * - PROMOTION  → "<Anterior> ↗ <Novo>" (upward, green)
 * - DEMOTION   → "<Anterior> ↘ <Novo>" (downward, red)
 * - TRANSFER   → "<Anterior> → <Novo>" (neutral)
 * - ADJUSTMENT/CORRECTION → neutral; without previous position renders only the position.
 * A null previousPosition NEVER renders a dangling "— →".
 */
export function PositionChangeSummary({ history, className }: { history: UserPositionHistory; className?: string }) {
  const positionName = history.position?.name || "Sem cargo";
  const previousName = history.previousPosition?.name;

  if (history.reason === POSITION_CHANGE_REASON.ADMISSION || !previousName) {
    const isAdmission = history.reason === POSITION_CHANGE_REASON.ADMISSION;
    return (
      <div className={cn("flex items-center gap-1.5 text-sm min-w-0", className)}>
        {isAdmission ? (
          <IconUserPlus className="h-4 w-4 flex-shrink-0 text-blue-700 dark:text-blue-400" />
        ) : (
          <IconPencil className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
        {isAdmission && <span className="text-muted-foreground flex-shrink-0">Admitido como</span>}
        <span className="truncate font-medium" title={positionName}>
          {positionName}
        </span>
      </div>
    );
  }

  const arrowByReason: Record<string, React.ReactNode> = {
    [POSITION_CHANGE_REASON.PROMOTION]: <IconArrowUpRight className="h-4 w-4 flex-shrink-0 text-green-700 dark:text-green-500" />,
    // DEMOTION = Reversão (lícita, CLT art.468 §único): seta para baixo NEUTRA
    // (não vermelha), pois não é punição/rebaixamento.
    [POSITION_CHANGE_REASON.DEMOTION]: <IconArrowDownRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />,
  };
  const arrow = arrowByReason[history.reason] ?? <IconArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;

  return (
    <div className={cn("flex items-center gap-1.5 text-sm min-w-0", className)}>
      <span className="truncate text-muted-foreground" title={previousName}>
        {previousName}
      </span>
      {arrow}
      <span
        className={cn(
          "truncate font-medium",
          history.reason === POSITION_CHANGE_REASON.PROMOTION && "text-green-700 dark:text-green-500",
          // Reversão (DEMOTION) é lícita — sem destaque vermelho.
        )}
        title={positionName}
      >
        {positionName}
      </span>
    </div>
  );
}

/** "Alterado por" rendering — null changedBy means the system/seed created the row. */
export function ChangedByLabel({ history, className }: { history: UserPositionHistory; className?: string }) {
  if (!history.changedBy?.name) {
    return <span className={cn("text-muted-foreground italic", className)}>Sistema</span>;
  }
  return (
    <span className={cn("truncate", className)} title={history.changedBy.name}>
      {history.changedBy.name}
    </span>
  );
}


export const createUserPositionHistoryColumns = (): UserPositionHistoryColumn[] => [
  // Colaborador (apenas o nome — sem avatar, por decisão do owner)
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (history: UserPositionHistory) => (
      <div className="font-medium truncate" title={history.user?.name}>
        {history.user?.name || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: false,
    // table-layout:fixed ignora min-width — é o `w-` que define a largura da coluna.
    className: "w-[340px] min-w-[340px]",
    align: "left",
  },

  // Mudança de cargo — semântica por motivo (admissão sem seta, promoção ↗, rebaixamento ↘)
  {
    key: "positionChange",
    header: "MUDANÇA DE CARGO",
    accessor: (history: UserPositionHistory) => <PositionChangeSummary history={history} />,
    sortable: false,
    className: "min-w-[280px]",
    align: "left",
  },

  // Motivo
  {
    key: "reason",
    header: "MOTIVO",
    accessor: (history: UserPositionHistory) => (
      <Badge variant={getReasonBadgeVariant(history.reason)} className="text-xs whitespace-nowrap">
        {POSITION_CHANGE_REASON_LABELS[history.reason as POSITION_CHANGE_REASON] || history.reason}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Início
  {
    key: "startedAt",
    header: "INÍCIO",
    accessor: (history: UserPositionHistory) => (
      <div className="text-sm truncate">{history.startedAt ? formatDate(new Date(history.startedAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Fim
  {
    key: "endedAt",
    header: "FIM",
    accessor: (history: UserPositionHistory) =>
      history.endedAt ? (
        <div className="text-sm truncate">{formatDate(new Date(history.endedAt))}</div>
      ) : (
        <Badge variant="active" className="text-xs whitespace-nowrap">
          Atual
        </Badge>
      ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Alterado Por — null = registro criado pelo sistema (admissão/backfill)
  {
    key: "changedBy.name",
    header: "ALTERADO POR",
    accessor: (history: UserPositionHistory) => (
      <div className="text-sm truncate">
        <ChangedByLabel history={history} />
      </div>
    ),
    sortable: false,
    className: "min-w-[180px]",
    align: "left",
  },

  // Observação
  {
    key: "note",
    header: "OBSERVAÇÃO",
    accessor: (history: UserPositionHistory) => (
      <div className="text-sm truncate">{history.note ? <TruncatedTextWithTooltip text={history.note} /> : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[220px]",
    align: "left",
  },

  // Criado Em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (history: UserPositionHistory) => (
      <div className="text-sm truncate">{history.createdAt ? formatDate(new Date(history.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_USER_POSITION_HISTORY_VISIBLE_COLUMNS = new Set(["user.name", "positionChange", "reason", "startedAt", "endedAt", "changedBy.name"]);
