import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconLinkOff, IconExternalLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useReceivableCandidates,
  useReceivableMutations,
} from "@/hooks/financial/use-receivable";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type {
  BankTransaction,
  ReconciliationMatchInstallment,
} from "@/types/reconciliation";
import type { ReceivableCandidate } from "@/types/receivable";
import { getConfidenceBadgeVariant } from "./match-status-badge";
import type { MatchSaveState } from "./transaction-match-section";

/** Whole days between an installment due date and the transaction posting date. */
function daysBetween(due: string, posted: string | Date): number {
  const a = new Date(due).getTime();
  const b = new Date(posted).getTime();
  return Math.round(Math.abs(a - b) / 86_400_000);
}

interface Props {
  transaction: BankTransaction;
  /** Reports save-ability + allocation totals up so the page header can render
   *  the "Conciliar recebimento" button + a running "Alocado / Faltam" summary
   *  (mirrors the NF TransactionMatchSection). */
  onSaveStateChange?: (state: MatchSaveState | null) => void;
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
export function ReceivableMatchSection({ transaction, onSaveStateChange }: Props) {
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
      // Deselect.
      if (prev[c.installmentId] !== undefined) {
        const next = { ...prev };
        delete next[c.installmentId];
        return next;
      }
      // A boleto bridge is atomic (the boleto IS the settlement) — mutually
      // exclusive with every other candidate.
      if (c.viaBankSlip) return { [c.installmentId]: (c.remaining ?? c.amount).toFixed(2) };
      // Selecting a direct installment drops any boleto selection, then prefills
      // the outstanding balance so topping up a partial receipt is correct.
      const next = { ...prev };
      for (const cand of candidates ?? []) {
        if (cand.viaBankSlip) delete next[cand.installmentId];
      }
      next[c.installmentId] = (c.remaining ?? c.amount).toFixed(2);
      return next;
    });

  const setAmount = (id: string, value: string) =>
    setSelections((prev) => ({ ...prev, [id]: value }));

  const entries = Object.entries(selections);
  // A single selected boleto candidate is a full bridge of the whole credit — its
  // amount is authoritative and not editable, so the credit counts as fully allocated.
  const boletoSelected =
    entries.length === 1 && candidateById.get(entries[0][0])?.viaBankSlip === true;
  const allocated = boletoSelected
    ? creditAmount
    : entries.reduce((sum, [, v]) => sum + (parseFloat(v) || 0), 0);
  const overCredit = !boletoSelected && allocated > creditAmount + TOLERANCE;
  const anyInvalid = !boletoSelected && entries.some(([, v]) => !(parseFloat(v) > 0));
  const isPending =
    matchMutation.isPending ||
    allocateMutation.isPending ||
    unmatchMutation.isPending;
  const canSubmit =
    entries.length > 0 && !anyInvalid && !overCredit && allocated > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      // Boleto bridge: link the credit to the already-PAID boleto (the backend
      // detects the boleto and bridges instead of re-settling the installment).
      if (boletoSelected) {
        await matchAsync({ transactionId: txId, installmentId: entries[0][0] });
        setSelections({});
        return;
      }
      const allocations = entries.map(([installmentId, v]) => ({
        installmentId,
        amount: parseFloat(v),
      }));
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

  // Report save state up so the page header owns the "Conciliar recebimento"
  // button + the running allocation summary (mirrors the NF section). saveRef
  // keeps the handler stable across renders.
  const fullyAllocated = !overCredit && Math.abs(creditAmount - allocated) <= TOLERANCE;
  const saveRef = useRef(handleSubmit);
  saveRef.current = handleSubmit;
  useEffect(() => {
    if (!onSaveStateChange) return;
    // Only the unreconciled (candidate) view has a save action.
    if (isReconciled) {
      onSaveStateChange(null);
      return;
    }
    onSaveStateChange({
      canSave: canSubmit,
      saving: isPending,
      allocated,
      target: creditAmount,
      missing: Math.max(0, creditAmount - allocated),
      valid: fullyAllocated,
      selectedCount: entries.length,
      save: () => saveRef.current(),
      label: "Conciliar recebimento",
    });
  }, [
    onSaveStateChange,
    isReconciled,
    canSubmit,
    isPending,
    allocated,
    creditAmount,
    fullyAllocated,
    entries.length,
  ]);
  // Clear the header state when the section unmounts.
  useEffect(() => () => onSaveStateChange?.(null), [onSaveStateChange]);

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
        <CardTitle className="text-base">Parcelas a receber</CardTitle>
        {entries.length > 0 && overCredit && (
          <p className="text-xs tabular-nums mt-1 text-destructive">
            Alocado {formatCurrency(allocated)} de {formatCurrency(creditAmount)} — excede o valor do crédito
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
                txPostedAt={transaction.postedAt}
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
  const total = rows.reduce((s, r) => s + (Number(r.match.allocatedAmount) || 0), 0);
  return (
    <div className="rounded-md border border-border/60 overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col style={{ width: "5.625rem" }} />
          <col style={{ width: "16rem" }} />
          <col />
          <col style={{ width: "10rem" }} />
          <col style={{ width: "6.25rem" }} />
          <col style={{ width: "7.5rem" }} />
          <col style={{ width: "7.5rem" }} />
          <col style={{ width: "8.125rem" }} />
          <col style={{ width: "9.5rem" }} />
        </colgroup>
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Parcela</th>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Tarefa</th>
            <th className={cn("text-left font-medium", headCell)}>Cliente</th>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>CNPJ</th>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Situação</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Vencimento</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Pago em</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Fatura</th>
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Valor da Parcela</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ match, installment: i }) => {
            const invoice = i.invoice;
            const totalParcelas = invoice?.installmentsCount ?? 0;
            const customer = invoice?.customer;
            const customerName = customer?.corporateName || customer?.fantasyName;
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
                  {taskLabel && task?.id ? (
                    <Link
                      to={routes.financial.billing.details(task.id)}
                      className="inline-flex items-center gap-1 truncate text-base font-medium text-blue-600 hover:underline dark:text-blue-400"
                      title="Ver tarefa"
                    >
                      <span className="truncate">{taskLabel}</span>
                      <IconExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  ) : taskLabel ? (
                    <p className="truncate text-base text-muted-foreground" title={taskLabel}>
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
                <td className={cn("tabular-nums whitespace-nowrap text-muted-foreground", cell)}>
                  {formatCnpjCpf(customer?.cnpj) || "—"}
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
            <td className={cell} colSpan={8} />
            <td className={cn("text-right font-bold text-base tabular-nums whitespace-nowrap", cell)}>
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Open installment candidate — the entrada analog of the NF candidate card.
 * The ENTIRE card is the toggle target: clicking anywhere selects/deselects it
 * (green border = selected), exactly like the NF candidate. The "Ver Tarefa"
 * link (top-right, mirroring the NF "Ver Notas" placement) and the allocation
 * input stop propagation so they don't flip the selection.
 */
function CandidateRow({
  candidate: c,
  txPostedAt,
  checked,
  amount,
  onToggle,
  onAmountChange,
}: {
  candidate: ReceivableCandidate;
  txPostedAt: string | Date;
  checked: boolean;
  amount: string | undefined;
  onToggle: () => void;
  onAmountChange: (value: string) => void;
}) {
  const status = INSTALLMENT_STATUS[c.status];
  const taskHref = c.taskId ? routes.financial.billing.details(c.taskId) : null;
  const taskLabel = [c.taskSerialNumber, c.taskName].filter(Boolean).join(" · ");
  const days = daysBetween(c.dueDate, txPostedAt);
  const cell = "px-3 py-2";
  const headCell = "px-3 h-9 align-middle";

  return (
    // The whole card toggles selection (mirrors the NF candidate). The Ver Tarefa
    // link + allocation input stop propagation so they don't flip the selection.
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
      className={cn(
        "rounded-lg overflow-hidden transition-colors cursor-pointer w-full text-left",
        "hover:bg-muted/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked ? "border-2 border-green-500" : "border border-border",
      )}
    >
      <div className="flex items-center gap-2.5 px-3 py-3">
        <Badge variant="secondary" className="whitespace-nowrap font-mono">
          Parcela {c.number}
          {c.totalInstallments && c.totalInstallments > 1 ? `/${c.totalInstallments}` : ""}
        </Badge>
        {c.viaBankSlip && (
          <Badge variant="cyan" size="sm" className="whitespace-nowrap">
            Boleto
          </Badge>
        )}
        {status && (
          <Badge variant={status.variant} size="sm" className="whitespace-nowrap">
            {status.label}
          </Badge>
        )}
        <span className="font-medium truncate min-w-0">
          {c.customerName || "—"}
        </span>
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {formatDate(c.dueDate)}
          </span>
          <Badge variant="secondary" title="Diferença de dias para a transação">
            {days === 0 ? "mesmo dia" : `${days}d`}
          </Badge>
          <Badge variant={getConfidenceBadgeVariant(c.confidence)}>
            {c.confidence}%
          </Badge>
          {taskHref && (
            <Link
              to={taskHref}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              title="Ver tarefa"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              Ver Tarefa
            </Link>
          )}
        </div>
      </div>

      {/* Details strip — task, invoice total and parcela value (mirrors the NF
          items table). Tarefa gets a generous fixed width so the name + serial
          are readable without truncation. */}
      <div className="border-t border-border overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: "28rem" }} />
            <col />
            <col style={{ width: "8.75rem" }} />
            <col style={{ width: "8.75rem" }} />
          </colgroup>
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className={cn("text-left font-medium", headCell)}>Tarefa</th>
              <th className={cn("text-left font-medium", headCell)}>Cliente</th>
              <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Fatura</th>
              <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Parcela</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-middle">
              <td className={cell}>
                {taskLabel ? (
                  <span className="truncate text-foreground" title={taskLabel}>{taskLabel}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className={cell}>
                <span className="truncate text-muted-foreground" title={c.customerName ?? undefined}>
                  {c.customerName || "—"}
                </span>
              </td>
              <td className={cn("text-right tabular-nums whitespace-nowrap text-muted-foreground", cell)}>
                {c.invoiceTotal != null ? formatCurrency(c.invoiceTotal) : "—"}
              </td>
              <td className={cn("text-right font-semibold tabular-nums whitespace-nowrap", cell)}>
                {formatCurrency(c.amount)}
                {(c.paidAmount ?? 0) > 0 && (
                  <span className="block text-[10px] font-normal text-amber-600 dark:text-amber-500">
                    Resta {formatCurrency(c.remaining ?? c.amount)}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Boleto candidates link in full (the boleto IS the settlement) — no partial
          allocation. Direct installments allow editing the allocated value. */}
      {checked && !c.viaBankSlip && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-muted/10">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Valor a alocar
          </span>
          <Input
            type="number"
            step={0.01}
            min={0}
            value={amount ?? ""}
            onChange={(v) => onAmountChange(v == null ? "" : String(v))}
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
