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
import type { BankTransaction } from "@/types/reconciliation";
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
      else next[c.installmentId] = c.amount.toFixed(2);
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
      // Single installment paid in full → simple match; anything else → allocate.
      const single = allocations.length === 1 ? allocations[0] : null;
      const singleFull =
        single &&
        Math.abs(
          (candidateById.get(single.installmentId)?.amount ?? 0) - single.amount,
        ) <= TOLERANCE;
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
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Este crédito já está conciliado com uma ou mais parcelas a receber.
          </p>
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
            de {formatCurrency(c.amount)}
          </span>
        </div>
      )}
    </div>
  );
}
