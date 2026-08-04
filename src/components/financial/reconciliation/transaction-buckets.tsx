import { Link } from "react-router-dom";
import {
  IconArrowUpRight,
  IconBan,
  IconCheck,
  IconClockHour4,
  IconEqual,
  IconFileInvoice,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/constants";
import { formatCNPJ } from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";

/**
 * Shared status-bucket model + linked-document cell for the Conciliação
 * Bancária views (Extrato — which now absorbs Saídas/Entradas — and any other
 * transaction list). DISPUTED rides along with PENDING: both mean "ainda não
 * explicada".
 */
export type BucketKey =
  | "PENDING"
  | "PARTIAL"
  | "AWAITING_NF"
  | "RECONCILED"
  | "IGNORED";

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
  // Split out of "Conciliadas": the money is proven, the nota is not. These used
  // to hide inside the green count, which is exactly why nobody noticed them.
  AWAITING_NF: {
    // Covers every "conciliada no papel, mas falta algo" state — aguardando
    // nota, sem vínculo com a obrigação, sem lastro. Short on purpose: this
    // label sits in a 7-across KPI row where a long string steals width from
    // the currency value. The badge carries the precise wording per row.
    label: "A revisar",
    Icon: IconFileInvoice,
    tone: "text-amber-600 bg-amber-500/10",
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

export const ALL_BUCKETS: BucketKey[] = [
  "PENDING",
  "PARTIAL",
  "AWAITING_NF",
  "RECONCILED",
  "IGNORED",
];

/**
 * Map a transaction onto its summary bucket.
 *
 * Keyed on the derived `settlement` rather than `reconciliationStatus` alone,
 * because the status column cannot express "reconciled but still owes a nota" —
 * a payment cleared against a pedido is RECONCILED in the database and yet is
 * unfinished work.
 */
export function bucketOf(tx: BankTransaction): BucketKey {
  const status = tx.reconciliationStatus;
  if (status === "IGNORED") return "IGNORED";
  if (status === "PARTIAL") return "PARTIAL";
  if (status === "RECONCILED") {
    const state = tx.settlement?.state;
    return state === "AWAITING_NF" || state === "UNTIED" || state === "UNBACKED"
      ? "AWAITING_NF"
      : "RECONCILED";
  }
  return "PENDING";
}

/**
 * Carry a selection saved before "Aguardando nota" existed onto the new set.
 *
 * Those rows used to sit inside RECONCILED, so anyone who had RECONCILED
 * selected was already seeing them and must keep seeing them — otherwise the
 * split would silently HIDE exactly the rows it exists to surface, for every
 * user with a stored view or a shared `?status=` link.
 */
export function migrateBuckets(keys: BucketKey[]): BucketKey[] {
  if (keys.includes("RECONCILED") && !keys.includes("AWAITING_NF")) {
    return [...keys, "AWAITING_NF"];
  }
  return keys;
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
  return parsed.length > 0 ? migrateBuckets(parsed) : fallback;
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
  // Pedido de compra, conta recorrente, aerografia e folha — as quatro âncoras
  // que o walk acima nunca soube renderizar, e que por isso apareciam como "—"
  // ao lado de um selo verde. O rótulo vem pronto da API (settlement.label).
  const s = tx.settlement;
  if (s?.label && s.anchor !== "NONE" && s.anchor !== "CATEGORY") {
    const to =
      s.link?.kind === "order" && s.link.id
        ? routes.inventory.orders.details(s.link.id)
        : s.link?.kind === "task" && s.link.id
          ? routes.production.schedule.details(s.link.id)
          : s.link?.kind === "recurrent" && s.link.id
            ? routes.financial.recurrentPayables.edit(s.link.id)
            : null;
    const body = (
      <>
        <span className="truncate">{s.label}</span>
        {to && <IconArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
      </>
    );
    return to ? (
      <Link
        to={to}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs hover:underline max-w-[13rem]"
        title={s.label}
      >
        {body}
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs max-w-[13rem]" title={s.label}>
        {body}
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">—</span>;
}
