import { Link } from "react-router-dom";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCheck,
  IconFileInvoice,
  IconLink,
  IconLinkOff,
  IconScale,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import type { BankTransaction, SettlementNf } from "@/types/reconciliation";

/**
 * "Conciliação" — the single card that answers the one question the reconciled
 * badge never used to: **resolved against WHAT?**
 *
 * Before this, a transaction could read "Liquidado"/"Resolvido" while every
 * panel on the page stayed silent, because each anchor had its own bespoke
 * renderer and four of the seven had none at all:
 *   • a supplier PIX cleared against a purchase order showed an empty Vínculo
 *   • a credit matched to our own NFS-e showed only "já está conciliado com uma
 *     ou mais parcelas" — naming neither the note nor the customer
 *   • rent/energia cleared against a recurring bill showed nothing
 *
 * This card is anchor-agnostic: it reads the API-derived `settlement` and always
 * renders the same three lines a person would check by hand — extrato,
 * obrigação, nota — plus the link out to whatever backs it.
 */

type LegState = "ok" | "missing" | "mismatch" | "na";

function Leg({
  label,
  value,
  state,
  hint,
}: {
  label: string;
  value: string | null;
  state: LegState;
  hint?: string | null;
}) {
  const icon =
    state === "ok" ? (
      <IconCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    ) : state === "missing" ? (
      <IconX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    ) : state === "mismatch" ? (
      <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
    ) : (
      <span className="h-4 w-4 text-center text-muted-foreground">–</span>
    );
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        {label}
      </span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            "block text-sm font-semibold tabular-nums",
            state === "missing" && "text-amber-700 dark:text-amber-400",
            state === "mismatch" && "text-red-700 dark:text-red-400",
            state === "na" && "text-muted-foreground font-normal",
          )}
        >
          {value ?? "—"}
        </span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}

/** Compact NF line — number, emitter, total and how it was reached. */
function NfLine({ nf }: { nf: SettlementNf }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <Link
        to={routes.financial.reconciliation.fiscalDocumentDetail(nf.id)}
        className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
      >
        NF {nf.nfNumber ?? "—"}
        <IconArrowUpRight className="h-3 w-3 text-muted-foreground" />
      </Link>
      {nf.emitName && <span className="text-sm text-muted-foreground">{nf.emitName}</span>}
      {nf.emitCnpj && (
        <span className="font-mono text-xs text-muted-foreground">
          {formatCnpjCpf(nf.emitCnpj)}
        </span>
      )}
      {nf.totalValue != null && (
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(nf.totalValue)}</span>
      )}
      {nf.issueDate && (
        <span className="text-xs text-muted-foreground">
          emitida {formatDate(new Date(nf.issueDate))}
        </span>
      )}
    </div>
  );
}

/** Route the "Vínculo" label should link to, per anchor kind. */
function anchorHref(tx: BankTransaction): string | null {
  const link = tx.settlement?.link;
  if (!link?.id) return null;
  switch (link.kind) {
    case "fiscalDocument":
      return routes.financial.reconciliation.fiscalDocumentDetail(link.id);
    case "order":
      return routes.inventory.orders.details(link.id);
    case "task":
      return routes.production.schedule.details(link.id);
    case "recurrent":
      // No read-only detail page for a recurring bill — its edit screen is the
      // only place that shows the payee, cadence and expectsNf flag.
      return routes.financial.recurrentPayables.edit(link.id);
    default:
      return null;
  }
}

const ANCHOR_NOUN: Record<string, string> = {
  FISCAL_DOCUMENT: "Nota fiscal",
  BANK_SLIP: "Boleto",
  RECEIVABLE_INSTALLMENT: "Parcela a receber",
  ORDER_INSTALLMENT: "Pedido de compra",
  RECURRENT_OCCURRENCE: "Conta recorrente",
  AIRBRUSHING: "Aerografia",
  PAYROLL: "Folha de pagamento",
  CATEGORY: "Categoria",
  NONE: "—",
};

export function SettlementCard({
  transaction,
  onLinkNf,
  linking,
  onRequestUnmatch,
}: {
  transaction: BankTransaction;
  /** Links the order's note to this transaction. Omit to render read-only. */
  onLinkNf?: (nf: SettlementNf) => void;
  linking?: boolean;
  /** Undo the conciliation. Lives here because for a non-NF anchor this is the
   *  only card on the page that names what would be undone. */
  onRequestUnmatch?: () => void;
}) {
  const s = transaction.settlement;
  if (!s) return null;

  const bank = Math.abs(Number(transaction.amount) || 0);
  const tw = s.threeWay;
  const mismatch = tw?.flag === "MISMATCH";
  const href = anchorHref(transaction);

  const linkedNfs = s.nfs ?? (s.nf ? [s.nf] : []);
  // The obligation leg only exists for anchors that carry an amount of their
  // own; for the rest we show the anchor's name rather than a fake figure.
  const anchorValue = tw?.anchor != null ? formatCurrency(tw.anchor) : null;
  const anchorState: LegState =
    s.anchor === "NONE" ? "na" : anchorValue == null ? "ok" : mismatch ? "mismatch" : "ok";

  const nfShown = linkedNfs[0] ?? s.suggestedNf;
  // A linked note is never itself "wrong": a divergence is about how much of the
  // payment reached the notes, which the "Alocado às notas" leg above reports.
  // Reddening this leg because a note's total differs from the payment is what
  // made a legitimate installment look broken.
  const nfState: LegState =
    linkedNfs.length > 0 ? "ok" : s.expectsNf ? "missing" : "na";

  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <IconScale className="h-5 w-5 text-muted-foreground" />
            Conciliação
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" size="sm" className="whitespace-nowrap">
              {ANCHOR_NOUN[s.anchor] ?? s.anchor}
            </Badge>
            {onRequestUnmatch && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={onRequestUnmatch}
              >
                <IconLinkOff className="h-4 w-4 mr-1.5" /> Desvincular
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* What it is conciliated against, in words, with a way to get there. */}
        {s.label && (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IconLink className="h-4 w-4" />
              Vínculo
            </span>
            {href ? (
              <Link
                to={href}
                className="inline-flex items-center gap-1 text-right text-sm font-semibold hover:underline"
              >
                {s.label}
                <IconArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              </Link>
            ) : (
              <span className="text-right text-sm font-semibold">{s.label}</span>
            )}
          </div>
        )}

        {/* The three legs a person would check by hand. */}
        <Leg label="Extrato" value={formatCurrency(bank)} state="ok" />
        <Leg
          // For an NF anchor this leg IS the allocated money, so call it what it
          // is. It differs from the notes' face totals whenever one payment
          // covers several notes, or only one installment of a big one.
          label={
            s.anchor === "ORDER_INSTALLMENT"
              ? "Pedido"
              : s.anchor === "FISCAL_DOCUMENT"
                ? "Alocado às notas"
                : "Obrigação"
          }
          value={anchorValue ?? (s.anchor === "NONE" ? null : ANCHOR_NOUN[s.anchor])}
          state={anchorState}
          hint={
            anchorValue && mismatch
              ? `Diferença de ${formatCurrency(Math.abs(bank - (tw?.anchor ?? 0)))}`
              : null
          }
        />
        <Leg
          label={linkedNfs.length > 1 ? `Notas fiscais (${linkedNfs.length})` : "Nota fiscal"}
          value={
            linkedNfs.length > 0
              ? tw?.nf != null
                ? formatCurrency(tw.nf)
                : `NF ${linkedNfs[0].nfNumber ?? ""}`.trim()
              : s.expectsNf
                ? "Faltando"
                : "Não se aplica"
          }
          state={nfState}
          hint={
            linkedNfs.length > 0
              ? // Say so explicitly instead of letting the reader wonder why the
                // note total doesn't equal the payment.
                tw?.anchor != null && tw.nf != null && Math.abs(tw.nf - tw.anchor) > 0.005
                ? tw.nf > tw.anchor
                  ? `Total das notas — este pagamento cobre ${formatCurrency(tw.anchor)}`
                  : `Total das notas · alocado ${formatCurrency(tw.anchor)}`
                : null
              : !s.expectsNf
                ? s.anchor === "CATEGORY"
                  ? "Resolvida por categoria — não haverá nota"
                  : "Este tipo de pagamento não gera nota de entrada"
                : null
          }
        />

        {/* The notes themselves — linked, or reachable through the order. */}
        {nfShown && (
          <div className="rounded-lg border border-border px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IconFileInvoice className="h-4 w-4" />
              {linkedNfs.length > 1
                ? `${linkedNfs.length} notas vinculadas`
                : linkedNfs.length === 1
                  ? "Nota vinculada"
                  : nfShown.viaOrderCode
                    ? `Nota encontrada pelo pedido ${nfShown.viaOrderCode}`
                    : "Nota encontrada pelo pedido"}
            </div>
            {/* Every linked note, not just the first — listing one of two made
                the card contradict the "Notas vinculadas" table below it. */}
            {linkedNfs.length > 0 ? (
              linkedNfs.map((n) => <NfLine key={n.id} nf={n} />)
            ) : (
              <NfLine nf={nfShown} />
            )}
            {linkedNfs.length === 0 && (
              <>
                {nfShown.totalValue != null &&
                  Math.abs(nfShown.totalValue - bank) > 0.005 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Diferença de {formatCurrency(Math.abs(nfShown.totalValue - bank))} em relação
                      ao valor pago — confira antes de vincular.
                    </p>
                  )}
                {onLinkNf && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={linking}
                    onClick={() => onLinkNf(nfShown)}
                  >
                    <IconLink className="h-4 w-4 mr-1.5" />
                    Vincular nota
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {s.state === "AWAITING_NF" && !nfShown && (
          <p className="text-xs text-muted-foreground">
            O pagamento está confirmado pelo extrato e pela obrigação, mas nenhuma nota fiscal foi
            encontrada. Importe o XML ou vincule a nota manualmente abaixo para fechar a
            conciliação.
          </p>
        )}
        {s.overAllocated && (
          <p className="rounded-lg border border-red-500/40 bg-red-50/50 px-4 py-3 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
            Os vínculos desta transação somam {formatCurrency(s.allocated)}, mas só{" "}
            {formatCurrency(bank)} saiu da conta. O mesmo pagamento está lançado mais de uma vez —
            desvincule os excedentes.
          </p>
        )}
        {s.state === "UNTIED" && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-50/50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Fechada apenas pela categoria <strong>{s.label}</strong>, que tem contas recorrentes
            cadastradas. A obrigação correspondente existe, mas este pagamento não foi amarrado a
            nenhuma — cadastre a conta que falta ou vincule a ocorrência do mês.
          </p>
        )}
        {s.state === "UNBACKED" && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Esta transação está marcada como resolvida sem nenhum documento nem categoria que a
            justifique. Vincule uma nota ou atribua uma categoria.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
