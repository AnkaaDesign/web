import { differenceInCalendarDays } from "date-fns";
import { IconAlertTriangle } from "@tabler/icons-react";

import { formatDate } from "../../../../utils";
import { FISPQ_STATUS, GHS_SIGNAL_WORD_LABELS } from "../../../../constants";
import type { GHS_SIGNAL_WORD } from "../../../../constants";
import { GhsPictogramList } from "../ghs-pictogram";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import type { Fispq } from "@/types/fispq";
import type { FispqColumn } from "./types";

// Status badges (no entity config in badge-colors for FISPQ — local mapping)
export const FISPQ_STATUS_BADGE_VARIANTS: Record<string, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  ACTIVE: "green",
  EXPIRED: "destructive",
  ARCHIVED: "outline",
};

// Expiry highlight: red when past, amber when within 30 days
export function getExpiryClassName(validUntil: Date | string | null | undefined): string {
  if (!validUntil) return "";
  const daysLeft = differenceInCalendarDays(new Date(validUntil), new Date());
  if (daysLeft < 0) return "text-destructive font-semibold";
  if (daysLeft <= 30) return "text-amber-600 dark:text-amber-500 font-semibold";
  return "";
}

/**
 * Effective FDS status for the row badge: Arquivada / Sem PDF / Vencida / Vence em Nd / OK.
 * Mirrors the legacy hand-rolled getFdsStatusBadge logic.
 */
export function FdsStatusBadge({ fispq }: { fispq: Fispq }) {
  const hasPdf = !!fispq.pdfFileId;
  const validUntil = fispq.validUntil ? new Date(fispq.validUntil) : null;
  const daysLeft = validUntil ? differenceInCalendarDays(validUntil, new Date()) : null;

  if (fispq.status === FISPQ_STATUS.ARCHIVED) {
    return (
      <Badge variant="secondary" className="text-xs whitespace-nowrap">
        Arquivada
      </Badge>
    );
  }
  if (!hasPdf) {
    return (
      <Badge variant="destructive" className="text-xs whitespace-nowrap">
        Sem PDF
      </Badge>
    );
  }
  if (daysLeft !== null && daysLeft < 0) {
    return (
      <Badge variant="destructive" className="text-xs whitespace-nowrap">
        Vencida
      </Badge>
    );
  }
  if (daysLeft !== null && daysLeft <= 30) {
    return (
      <Badge variant="amber" className="text-xs whitespace-nowrap">
        Vence em {daysLeft}d
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs whitespace-nowrap">
      OK
    </Badge>
  );
}

export const createFispqColumns = (): FispqColumn[] => [
  // Produto
  {
    key: "item.name",
    header: "PRODUTO",
    accessor: (fispq: Fispq) => (
      <div className="truncate">
        <p className="font-medium truncate" title={fispq.item?.name || fispq.productName || undefined}>
          {fispq.item?.name || fispq.productName || <span className="text-muted-foreground">-</span>}
        </p>
      </div>
    ),
    sortable: true,
    className: "min-w-[220px]",
    align: "left",
  },

  // Pictogramas
  {
    key: "ghsPictograms",
    header: "PICTOGRAMAS",
    accessor: (fispq: Fispq) => <GhsPictogramList codes={fispq.ghsPictograms} size={38} />,
    sortable: false,
    className: "min-w-[160px]",
    align: "left",
  },

  // Palavra de advertência
  {
    key: "signalWord",
    header: "ADVERTÊNCIA",
    accessor: (fispq: Fispq) => {
      if (!fispq.signalWord) return <span className="text-muted-foreground">-</span>;
      const isDanger = fispq.signalWord === "DANGER";
      return (
        <span className={cn("text-sm", isDanger && "text-destructive font-semibold flex items-center gap-1")}>
          {isDanger && <IconAlertTriangle className="h-3.5 w-3.5" />}
          {GHS_SIGNAL_WORD_LABELS[fispq.signalWord as GHS_SIGNAL_WORD]}
        </span>
      );
    },
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // CAS
  {
    key: "casNumber",
    header: "CAS",
    accessor: (fispq: Fispq) => <div className="text-sm font-mono truncate">{fispq.casNumber || <span className="text-muted-foreground font-sans">-</span>}</div>,
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // ONU
  {
    key: "onuNumber",
    header: "ONU",
    accessor: (fispq: Fispq) => <div className="text-sm font-mono truncate">{fispq.onuNumber || <span className="text-muted-foreground font-sans">-</span>}</div>,
    sortable: true,
    className: "min-w-[110px]",
    align: "left",
  },

  // Classe de risco
  {
    key: "unRiskClass",
    header: "CLASSE DE RISCO",
    accessor: (fispq: Fispq) => (
      <div className="text-sm truncate" title={fispq.unRiskClass ?? undefined}>
        {fispq.unRiskClass || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: false,
    className: "min-w-[140px]",
    align: "left",
  },

  // EPI
  {
    key: "requiredPpeText",
    header: "EPI",
    accessor: (fispq: Fispq) =>
      fispq.requiredPpeText ? (
        <div className="max-w-[200px]">
          <TruncatedTextWithTooltip text={fispq.requiredPpeText} />
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    sortable: false,
    className: "min-w-[180px]",
    align: "left",
  },

  // FDS (computed status)
  {
    key: "fdsStatus",
    header: "FDS",
    accessor: (fispq: Fispq) => <FdsStatusBadge fispq={fispq} />,
    sortable: false,
    className: "min-w-[120px]",
    align: "left",
  },

  // Validade
  {
    key: "validUntil",
    header: "VALIDADE",
    accessor: (fispq: Fispq) => (
      <div className={cn("text-sm truncate", getExpiryClassName(fispq.validUntil))}>
        {fispq.validUntil ? formatDate(new Date(fispq.validUntil)) : <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Fabricante
  {
    key: "manufacturer",
    header: "FABRICANTE",
    accessor: (fispq: Fispq) => (
      <div className="text-sm truncate" title={fispq.manufacturer ?? undefined}>
        {fispq.manufacturer || <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: true,
    className: "min-w-[160px]",
    align: "left",
  },

  // Data de revisão
  {
    key: "revisionDate",
    header: "REVISÃO",
    accessor: (fispq: Fispq) => (
      <div className="text-sm truncate">{fispq.revisionDate ? formatDate(new Date(fispq.revisionDate)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },
];

// Default visible columns
export const DEFAULT_VISIBLE_COLUMNS = new Set(["item.name", "ghsPictograms", "signalWord", "casNumber", "onuNumber", "requiredPpeText", "fdsStatus", "validUntil"]);
