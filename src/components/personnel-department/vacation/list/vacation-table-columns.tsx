import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import { formatDate, formatCurrency } from "../../../../utils";
import type { Vacation } from "../../../../types/vacation";

export interface VacationColumn {
  key: string;
  header: string;
  accessor: (vacation: Vacation) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

const FINAL_STATUSES: VACATION_STATUS[] = [VACATION_STATUS.PAID, VACATION_STATUS.EXPIRED];

export function isVacationFinal(vacation: Vacation): boolean {
  return FINAL_STATUSES.includes(vacation.status);
}

/** Maps the vacation status to a generic badge variant (no VACATION map in badge-colors yet). */
export function getVacationStatusVariant(status: VACATION_STATUS): "secondary" | "warning" | "default" | "success" | "destructive" {
  switch (status) {
    case VACATION_STATUS.OPEN:
      return "secondary";
    case VACATION_STATUS.SCHEDULED:
      return "warning";
    case VACATION_STATUS.IN_PROGRESS:
      return "default";
    case VACATION_STATUS.PAID:
      return "success";
    case VACATION_STATUS.EXPIRED:
      return "destructive";
    default:
      return "secondary";
  }
}

/** Days remaining until concessivo expiry (negative = already expired). */
export function getConcessiveDaysRemaining(vacation: Vacation): number | null {
  if (!vacation.concessiveEnd) return null;
  const end = new Date(vacation.concessiveEnd).getTime();
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Concessivo expiring soon (≤60 dias) but not yet expired and not finalized. */
export function isConcessiveExpiringSoon(vacation: Vacation): boolean {
  if (isVacationFinal(vacation)) return false;
  if (vacation.isDouble) return false;
  const remaining = getConcessiveDaysRemaining(vacation);
  return remaining !== null && remaining >= 0 && remaining <= 60;
}

/** Concessivo already expired (art. 137) — vacation owed in dobro. */
export function isConcessiveExpired(vacation: Vacation): boolean {
  if (vacation.isDouble) return true;
  if (vacation.status === VACATION_STATUS.EXPIRED) return true;
  if (isVacationFinal(vacation)) return false;
  const remaining = getConcessiveDaysRemaining(vacation);
  return remaining !== null && remaining < 0;
}

export const createVacationColumns = (): VacationColumn[] => [
  // Colaborador
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (vacation: Vacation) => (
      <div className="truncate">
        <div className="font-medium truncate" title={vacation.user?.name}>
          {vacation.user?.name || <span className="text-muted-foreground">-</span>}
        </div>
        {vacation.user?.position?.name && <div className="text-xs text-muted-foreground truncate">{vacation.user.position.name}</div>}
      </div>
    ),
    sortable: true,
    className: "min-w-[220px]",
    align: "left",
  },

  // Período Aquisitivo
  {
    key: "acquisitiveStart",
    header: "PERÍODO AQUISITIVO",
    accessor: (vacation: Vacation) => (
      <div className="text-sm truncate">
        {vacation.acquisitiveStart && vacation.acquisitiveEnd ? (
          `${formatDate(new Date(vacation.acquisitiveStart))} — ${formatDate(new Date(vacation.acquisitiveEnd))}`
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    ),
    sortable: true,
    className: "min-w-[200px]",
    align: "left",
  },

  // Limite Concessivo
  {
    key: "concessiveEnd",
    header: "LIMITE CONCESSIVO",
    accessor: (vacation: Vacation) => {
      if (!vacation.concessiveEnd) return <span className="text-sm text-muted-foreground">-</span>;
      const expired = isConcessiveExpired(vacation);
      const expiring = isConcessiveExpiringSoon(vacation);
      return (
        <div className="flex items-center gap-2">
          <span className={expired ? "text-sm font-medium text-destructive" : expiring ? "text-sm font-medium text-amber-600" : "text-sm"}>
            {formatDate(new Date(vacation.concessiveEnd))}
          </span>
          {expired && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Vencido
            </Badge>
          )}
          {!expired && expiring && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              A vencer
            </Badge>
          )}
        </div>
      );
    },
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Dias de Direito
  {
    key: "entitledDays",
    header: "DIAS DE DIREITO",
    accessor: (vacation: Vacation) => <div className="text-sm font-medium tabular-nums">{vacation.entitledDays}</div>,
    sortable: true,
    className: "min-w-[140px]",
    align: "center",
  },

  // Abono
  {
    key: "abonoPecuniarioDays",
    header: "ABONO",
    accessor: (vacation: Vacation) =>
      vacation.abonoPecuniarioDays > 0 ? (
        <Badge variant="secondary" className="text-xs whitespace-nowrap">
          {vacation.abonoPecuniarioDays} dia{vacation.abonoPecuniarioDays > 1 ? "s" : ""}
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    sortable: false,
    className: "min-w-[110px]",
    align: "center",
  },

  // Dobro (art. 137)
  {
    key: "isDouble",
    header: "DOBRO",
    accessor: (vacation: Vacation) =>
      vacation.isDouble ? (
        <Badge variant="destructive" className="text-xs whitespace-nowrap">
          Em dobro
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    sortable: false,
    className: "min-w-[110px]",
    align: "center",
  },

  // Status
  {
    key: "statusOrder",
    header: "STATUS",
    accessor: (vacation: Vacation) => (
      <Badge variant={getVacationStatusVariant(vacation.status)} className="text-xs whitespace-nowrap">
        {VACATION_STATUS_LABELS[vacation.status] || vacation.status}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Pagamento
  {
    key: "paymentDate",
    header: "PAGAMENTO",
    accessor: (vacation: Vacation) =>
      vacation.paymentDate ? (
        <div className="text-sm truncate">{formatDate(new Date(vacation.paymentDate))}</div>
      ) : vacation.paymentDueDate ? (
        <div className="text-sm text-muted-foreground truncate">Prazo: {formatDate(new Date(vacation.paymentDueDate))}</div>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    sortable: true,
    className: "min-w-[150px]",
    align: "left",
  },

  // Total Líquido (best-effort from computed fields)
  {
    key: "net",
    header: "BASE",
    accessor: (vacation: Vacation) =>
      vacation.baseRemuneration != null ? (
        <div className="text-sm font-medium tabular-nums">{formatCurrency(vacation.baseRemuneration)}</div>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    sortable: false,
    className: "min-w-[130px]",
    align: "right",
  },

  // Criado em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (vacation: Vacation) => (
      <div className="text-sm truncate">{vacation.createdAt ? formatDate(new Date(vacation.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },
];

export const DEFAULT_VACATION_VISIBLE_COLUMNS = new Set(["user.name", "acquisitiveStart", "concessiveEnd", "entitledDays", "abonoPecuniarioDays", "isDouble", "statusOrder"]);
