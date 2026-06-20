import { useEffect, useMemo, useState } from "react";
import { IconLinkOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useReceivableCandidates,
  useReceivableMutations,
} from "@/hooks/financial/use-receivable";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils";
import type {
  BankTransaction,
  ReconciliationMatchInstallment,
} from "@/types/reconciliation";
import type { ReceivableCandidate } from "@/types/receivable";
import { getConfidenceBadgeVariant } from "./match-status-badge";

interface Props {
  transaction: BankTransaction;
}

const TOLERANCE = 0.01;

/**
 * Inflow (ENTRADA) conciliation for a single bank CREDIT. Lists open receivable
 * installments and settles the credit against ONE (full) or SEVERAL with explicit
 * amounts — a lump PIX paying several parcelas, or a partial receipt. The mirror
 * of TransactionMatchSection for the outflow side.
 *
 * - Pick a single installment and click → full match (the common case).
 * - Pick several, or edit the amount(s) → partial / multi allocation.
 *
 * Mutations invalidate the receivables + reconciliation namespaces, so the detail
 * page refetches in place.
 */
export function ReceivableMatchSection({ transaction }: Props) {
  const txId = transaction.id;
  const creditAmount = Math.abs(Number(transaction.amount));

  // installmentId -> amount string (presence = selected).
  const [selections, setSelections] = useState<Record<string, string>>({});

  const {
    matchMutation,
    unmatchMutation,
    allocateMutation,
    matchAsync,
    unmatchAsync,
    allocateAsync,
  } = useReceivableMutations();

  const isReconciled = useMemo(
    () =>
      transaction.reconciliationStatus === "RECONCILED" ||
      (transaction.matches ?? []).some((m) => !m.reversedAt),
    [transaction],
  );

  const { data: candidates, isLoading } = useReceivableCandidates(
    txId,
    !isReconciled,
  );

  // Reset selections when the transaction identity changes (post-save).
  useEffect(() => {
    setSelections({});
  }, [transaction.id]);

  const candidateById = useMemo(() => {
    const m = new Map<string, ReceivableCandidate>();
    (candidates ?? []).forEach((c) => m.set(c.installmentId, c));
    return m;
  }, [candidates]);

  const toggle = (c: ReceivableCandidate) =>
    setSelections((prev) => {
      const next = { ...prev };
      if (next[c.installmentId] !== undefined) delete next[c.installmentId];
      // Prefill the outstanding balance (full amount for untouched parcelas),
      // not the gross amount, so topping up a partial receipt is correct.
      else next[c.installmentId] = (c.remaining ?? c.amount).toFixed(2);
      return next;
    });

  const setAmount = (id: string, value: string) =>
    setSelections((prev) => ({ ...prev, [id]: value }));

  const entries = Object.entries(selections);
  const allocated = entries.reduce((sum, [, v]) => sum + (parseFloat(v) || 0), 0);
  const overCredit = allocated > creditAmount + TOLERANCE;
  const anyInvalid = entries.some(([, v]) => !(parseFloat(v) > 0));
  const isPending =
    matchMutation.isPending ||
    allocateMutation.isPending ||
    unmatchMutation.isPending;
  const canSubmit =
    entries.length > 0 && !anyInvalid && !overCredit && allocated > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const allocations = entries.map(([installmentId, v]) => ({
      installmentId,
      amount: parseFloat(v),
    }));
    try {
      // Single installment settled to its FULL outstanding balance → simple
      // match; anything else (multi, or a partial top-up) → allocate. Compare to
      // the remaining balance, not the gross amount, so a partially-paid parcela
      // routes to allocate (which accrues) instead of match (which overwrites).
      const single = allocations.length === 1 ? allocations[0] : null;
      const cand = single ? candidateById.get(single.installmentId) : undefined;
      const singleFull =
        single &&
        cand != null &&
        (cand.paidAmount ?? 0) <= TOLERANCE &&
        Math.abs((cand.remaining ?? cand.amount) - single.amount) <= TOLERANCE;
      if (single && singleFull) {
        await matchAsync({ transactionId: txId, installmentId: single.installmentId });
      } else {
        await allocateAsync({ transactionId: txId, allocations });
      }
      setSelections({});
    } catch {
      // Errors are toasted by the API client.
    }
  };

  const handleUnmatch = async () => {
    try {
      await unmatchAsync({ transactionId: txId });
    } catch {
      // Errors are toasted by the API client.
    }
  };

  if (isReconciled) {
    // A credit settles a receivable either directly (PIX/TED → installment) or
    // via a boleto (Sicredi liquidation → bankSlip → installment).
    const linkedInstallments = (transaction.matches ?? [])
      .filter((m) => !m.reversedAt)
      .map((m) => ({
        match: m,
        installment: m.installment ?? m.bankSlip?.installment ?? null,
      }))
      .filter(
        (x): x is { match: (typeof x)["match"]; installment: ReconciliationMatchInstallment } =>
          x.installment != null,
      );
    return (
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base leading-none">
              Recebimento conciliado
            </CardTitle>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUnmatch}
              disabled={unmatchMutation.isPending}
              className="h-8"
            >
              <IconLinkOff className="h-4 w-4 mr-1.5" /> Desvincular
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {linkedInstallments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este crédito já está conciliado com uma ou mais parcelas a receber.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Este crédito quitou{" "}
                {linkedInstallments.length === 1
                  ? "a parcela abaixo"
                  : `${linkedInstallments.length} parcelas`}{" "}
                a receber.
              </p>
              <LinkedInstallmentsTable rows={linkedInstallments} />
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Parcelas a receber</CardTitle>
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-8"
          >
            Conciliar recebimento
          </Button>
        </div>
        {entries.length > 0 && (
          <p
            className={cn(
              "text-xs tabular-nums mt-1",
              overCredit ? "text-destructive" : "text-muted-foreground",
            )}
          >
            Alocado {formatCurrency(allocated)} de {formatCurrency(creditAmount)}
            {overCredit && " — excede o valor do crédito"}
            {!overCredit &&
              allocated < creditAmount - TOLERANCE &&
              ` — restante ${formatCurrency(creditAmount - allocated)} (parcial)`}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !candidates || candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma parcela em aberto encontrada para conciliar este crédito.
          </p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <CandidateRow
                key={c.installmentId}
                candidate={c}
                checked={selections[c.installmentId] !== undefined}
                amount={selections[c.installmentId]}
                onToggle={() => toggle(c)}
                onAmountChange={(v) => setAmount(c.installmentId, v)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Maps an InstallmentStatus to a short PT label + badge variant. */
const INSTALLMENT_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  PAID: { label: "Pago", variant: "success" },
  PARTIAL: { label: "Parcial", variant: "warning" },
  PENDING: { label: "Pendente", variant: "secondary" },
  OVERDUE: { label: "Vencida", variant: "destructive" },
};

/**
 * Receivable installments a credit settled, as a column-header table mirroring
 * the saída side's FiscalItemsTable: muted uppercase header, divided rows and a
 * bold total footer. One row per parcela (a lump receipt may quit several).
 */
function LinkedInstallmentsTable({
  rows,
}: {
  rows: { match: { id: string; allocatedAmount: number }; installment: ReconciliationMatchInstallment }[];
}) {
  const cell = "px-3 py-2.5";
  const headCell = "px-3 h-11 align-middle";
  const total = rows.reduce((s, r) => s + (r.match.allocatedAmount || 0), 0);
  return (
    <div className="rounded-md border border-border/60 overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col style={{ width: "90px" }} />
          <col style={{ width: "150px" }} />
          <col />
          <col style={{ width: "100px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "130px" }} />
          <col style={{ width: "140px" }} />
        </colgroup>
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Parcela</th>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Tarefa</th>
            <th className={cn("text-left font-medium", headCell)}>Cliente</th>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Situação</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Vencimento</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Pago em</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Fatura</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ match, installment: i }) => {
            const invoice = i.invoice;
            const totalParcelas = invoice?.installments?.length ?? 0;
            const customerName = invoice?.customer?.fantasyName;
            const task = invoice?.task;
            const taskLabel = task
              ? [task.serialNumber, task.name].filter(Boolean).join(" · ")
              : null;
            const status = INSTALLMENT_STATUS[i.status];
            return (
              <tr key={match.id} className="align-middle">
                <td className={cell}>
                  <Badge variant="secondary" className="whitespace-nowrap font-mono">
                    {i.number}
                    {totalParcelas > 1 ? `/${totalParcelas}` : ""}
                  </Badge>
                </td>
                <td className={cell}>
                  {taskLabel ? (
                    <p className="truncate text-muted-foreground" title={taskLabel}>
                      {taskLabel}
                    </p>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cell}>
                  <p className="truncate font-medium" title={customerName ?? undefined}>
                    {customerName || "—"}
                  </p>
                </td>
                <td className={cell}>
                  {status ? (
                    <Badge variant={status.variant} size="sm" className="whitespace-nowrap">
                      {status.label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cn("text-right tabular-nums whitespace-nowrap text-foreground", cell)}>
                  {formatDate(i.dueDate)}
                </td>
                <td className={cn("text-right tabular-nums whitespace-nowrap text-muted-foreground", cell)}>
                  {i.paidAt ? formatDate(i.paidAt) : "—"}
                </td>
                <td className={cn("text-right tabular-nums whitespace-nowrap text-muted-foreground", cell)}>
                  {invoice ? formatCurrency(invoice.totalAmount) : "—"}
                </td>
                <td className={cn("text-right font-semibold tabular-nums whitespace-nowrap", cell)}>
                  {formatCurrency(match.allocatedAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/30 border-t-2 border-border">
          <tr>
            <td className={cell} colSpan={7} />
            <td className={cn("text-right font-bold text-base tabular-nums whitespace-nowrap", cell)}>
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Open installment — click to (de)select; when selected, an editable amount lets
 *  the operator allocate a partial value. */
function CandidateRow({
  candidate: c,
  checked,
  amount,
  onToggle,
  onAmountChange,
}: {
  candidate: ReceivableCandidate;
  checked: boolean;
  amount: string | undefined;
  onToggle: () => void;
  onAmountChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden transition-colors px-3 py-3",
        checked ? "border-2 border-green-500" : "border border-border",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={checked}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex items-center gap-2.5 cursor-pointer focus:outline-none"
      >
        <Badge variant="secondary" className="whitespace-nowrap font-mono">
          Parcela {c.number}
        </Badge>
        <span className="font-medium truncate min-w-0">
          {c.customerName || "—"}
        </span>
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          <span className="text-sm font-medium tabular-nums text-foreground whitespace-nowrap">
            {formatCurrency(c.amount)}
          </span>
          {(c.paidAmount ?? 0) > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-500 whitespace-nowrap tabular-nums">
              Resta {formatCurrency(c.remaining ?? c.amount)}
            </span>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Venc. {formatDate(c.dueDate)}
          </span>
          <Badge variant={getConfidenceBadgeVariant(c.confidence)}>
            {c.confidence}%
          </Badge>
        </div>
      </div>
      {checked && (
        <div className="mt-2.5 flex items-center gap-2 pl-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Valor a alocar
          </span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount ?? ""}
            onChange={(e) => onAmountChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-8 w-36 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">
            de {formatCurrency(c.remaining ?? c.amount)}
          </span>
        </div>
      )}
    </div>
  );
}
