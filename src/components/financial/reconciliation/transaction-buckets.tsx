import { Link } from "react-router-dom";
import {
  IconArrowUpRight,
  IconBan,
  IconCheck,
  IconClockHour4,
  IconEqual,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/constants";
import { formatCNPJ } from "@/utils";
import type { BankTransaction, ReconciliationStatus } from "@/types/reconciliation";

/**
 * Shared status-bucket model + linked-document cell for the Conciliação
 * Bancária views (Extrato — which now absorbs Saídas/Entradas — and any other
 * transaction list). DISPUTED rides along with PENDING: both mean "ainda não
 * explicada".
 */
export type BucketKey = "PENDING" | "PARTIAL" | "RECONCILED" | "IGNORED";

export const BUCKET_STATUSES: Record<BucketKey, ReconciliationStatus[]> = {
  PENDING: ["PENDING", "DISPUTED"],
  PARTIAL: ["PARTIAL"],
  RECONCILED: ["RECONCILED"],
  IGNORED: ["IGNORED"],
};

export const BUCKET_META: Record<
  BucketKey,
  { label: string; Icon: typeof IconCheck; tone: string }
> = {
  PENDING: {
    label: "Pendentes",
    Icon: IconClockHour4,
    tone: "text-amber-600 bg-amber-500/10",
  },
  PARTIAL: {
    label: "Parciais",
    Icon: IconEqual,
    tone: "text-blue-600 bg-blue-500/10",
  },
  RECONCILED: {
    label: "Conciliadas",
    Icon: IconCheck,
    tone: "text-emerald-600 bg-emerald-500/10",
  },
  IGNORED: {
    label: "Ignoradas",
    Icon: IconBan,
    tone: "text-neutral-500 bg-neutral-500/10",
  },
};

export const ALL_BUCKETS: BucketKey[] = ["PENDING", "PARTIAL", "RECONCILED", "IGNORED"];

/** Map a transaction's reconciliation status onto its summary bucket. */
export function bucketOf(status: ReconciliationStatus): BucketKey {
  return status === "PARTIAL"
    ? "PARTIAL"
    : status === "RECONCILED"
      ? "RECONCILED"
      : status === "IGNORED"
        ? "IGNORED"
        : "PENDING";
}

/**
 * Parse the `status` URL param into a bucket list. `fallback` is returned when
 * the param is absent or contains no recognized buckets (callers choose their
 * own default — the Extrato shows every bucket, a triage view shows pendentes).
 */
export function parseBuckets(raw: string | null, fallback: BucketKey[]): BucketKey[] {
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .filter((s): s is BucketKey => (ALL_BUCKETS as string[]).includes(s));
  return parsed.length > 0 ? parsed : fallback;
}

/** Renders the fiscal document / bank slip linked to a transaction (or —). */
export function LinkedDocCell({ tx }: { tx: BankTransaction }) {
  const docMatches = (tx.matches ?? []).filter((m) => m.fiscalDocument);
  const slipMatch = (tx.matches ?? []).find((m) => m.bankSlip);
  const firstDoc = docMatches[0]?.fiscalDocument;
  if (firstDoc?.id) {
    const label = firstDoc.emitName
      ? firstDoc.emitName
      : firstDoc.emitCnpj
        ? formatCNPJ(firstDoc.emitCnpj)
        : "NF";
    return (
      <Link
        to={routes.financial.reconciliation.fiscalDocumentDetail(firstDoc.id)}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs hover:underline max-w-[13rem]"
        title={label}
      >
        <span className="truncate">{label}</span>
        {docMatches.length > 1 && (
          <span className="text-muted-foreground">(+{docMatches.length - 1})</span>
        )}
        <IconArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  if (slipMatch?.bankSlip) {
    return (
      <Badge variant="secondary" size="sm" className="whitespace-nowrap">
        Boleto {slipMatch.bankSlip.nossoNumero}
      </Badge>
    );
  }
  // Entrada conciliada contra parcelas a receber — inclusive as conciliadas
  // por tarefa, cujo orçamento foi criado no momento da conciliação. Sem este
  // ramo toda conciliação de crédito aparecia como "—" no extrato.
  const instMatches = (tx.matches ?? []).filter(
    (m) => m.installment ?? m.bankSlip?.installment,
  );
  const firstInst = instMatches[0]?.installment ?? instMatches[0]?.bankSlip?.installment;
  if (firstInst) {
    const task = firstInst.invoice?.task;
    const label =
      [task?.serialNumber, task?.name].filter(Boolean).join(" · ") ||
      firstInst.invoice?.customer?.fantasyName ||
      `Parcela ${firstInst.number}`;
    const to = task?.id
      ? routes.financial.billing.details(task.id)
      : routes.financial.accountsReceivable.root;
    return (
      <Link
        to={to}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs hover:underline max-w-[13rem]"
        title={label}
      >
        <span className="truncate">{label}</span>
        {instMatches.length > 1 && (
          <span className="text-muted-foreground">(+{instMatches.length - 1})</span>
        )}
        <IconArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
      </Link>
    );
  }
  return <span className="text-muted-foreground text-xs">—</span>;
}
