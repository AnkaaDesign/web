import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowsExchange2,
  IconBuildingBank,
  IconExternalLink,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useBankTransaction,
  useMatchTransaction,
  useTransactionCandidates,
} from "@/hooks/financial/use-reconciliation";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type {
  FiscalDocument,
  TransactionMatchCandidate,
} from "@/types/reconciliation";
import type { ManualMatchPayload } from "@/schemas/reconciliation";
import {
  MatchStatusBadge,
  formatMatchRationale,
  getConfidenceBadgeVariant,
} from "./match-status-badge";

/** Reported up to the NF detail page so the Salvar action + allocation summary
 *  can live in the page header (always visible while picking a transaction).
 *  Shape mirrors transaction-match-section's MatchSaveState verbatim. */
export interface MatchSaveState {
  canSave: boolean;
  saving: boolean;
  allocated: number;
  target: number;
  missing: number;
  valid: boolean;
  selectedCount: number;
  save: () => void;
  /** Header action label — defaults to "Salvar conciliação" when omitted. */
  label?: string;
}

interface Props {
  fiscalDocument: FiscalDocument;
  /** Reports save-ability + allocation totals up so the page header can render
   *  the Salvar button + a running "Alocado / Faltam" summary. */
  onSaveStateChange?: (state: MatchSaveState | null) => void;
}

/**
 * NF-side (reverse) reconciliation controls — the mirror of TransactionMatchSection.
 * Here the TARGET is fixed (this fiscal document) and the CANDIDATES are bank
 * transactions that could settle it. Rendered as a page section (no dialog);
 * the save action + allocation summary are surfaced in the page header via
 * onSaveStateChange. Mutation success invalidates the reconciliation namespace so
 * the detail page refetches in place.
 *
 * v1 selects a SINGLE transaction (the common case: one payment settles this
 * note). The conciliation reuses the FORWARD endpoint matchTransaction(txId, …),
 * so the picked transaction's existing non-reversed matches must be re-sent in
 * the payload (the backend treats it as the COMPLETE match set and drops any
 * match not present).
 */
export function FiscalDocMatchSection({
  fiscalDocument,
  onSaveStateChange,
}: Props) {
  // Single-select: the transaction chosen to settle this note.
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  // How much of the selected payment is allocated to THIS note (editable so the
  // user can settle a partial balance). Defaults to min(tx free, NF open balance).
  const [allocation, setAllocation] = useState(0);

  const matchMut = useMatchTransaction();

  // The NF's open balance is the target: its total minus what non-reversed
  // matches already allocated (installments / prior partial payments). The
  // embedded matches on a FiscalDocument are the trimmed API shape; reversedAt /
  // adjustmentAmount may be absent, so read them defensively.
  const activeNfMatches = useMemo(
    () =>
      (fiscalDocument.matches ?? []).filter(
        (m) => (m as { reversedAt?: string | null }).reversedAt == null,
      ),
    [fiscalDocument.matches],
  );
  const hasExistingNfMatches = activeNfMatches.length > 0;
  const nfAllocatedExisting = useMemo(
    () =>
      activeNfMatches.reduce(
        (sum, m) =>
          sum +
          (m.allocatedAmount ?? 0) +
          ((m as { adjustmentAmount?: number | null }).adjustmentAmount ?? 0),
        0,
      ),
    [activeNfMatches],
  );
  const nfOpenBalance = Number(
    (fiscalDocument.totalValue - nfAllocatedExisting).toFixed(2),
  );

  // ENTRADA (received) notes are settled by DEBIT transactions — that's the
  // reverse flow this section owns. SAIDA (emitted) notes are settled by
  // receivables (CREDIT) via a different path, and their durable link is the
  // faturamento; don't offer bank-transaction candidates for them. Also hide the
  // picker once the note is fully settled.
  const isFullySettled = nfOpenBalance <= 0.05;
  const showCandidates =
    fiscalDocument.operationType === "ENTRADA" && !isFullySettled;

  const { data: candidates, isLoading: candidatesLoading } =
    useTransactionCandidates(fiscalDocument.id, showCandidates);

  // Fetch the picked transaction in full (with its matches) so save can preserve
  // its existing non-reversed fiscal matches. Disabled until one is selected.
  const { data: selectedTx, isLoading: selectedTxLoading } = useBankTransaction(
    selectedTxId ?? undefined,
  );

  // Reset the selection when the NF identity changes (post-save). Keyed on the id
  // so a background refetch (new object, same NF) doesn't wipe an in-progress pick.
  useEffect(() => {
    setSelectedTxId(null);
    setAllocation(0);
  }, [fiscalDocument.id]);

  const toggleSelect = (candidate: TransactionMatchCandidate) => {
    setSelectedTxId((prev) => {
      if (prev === candidate.transactionId) {
        setAllocation(0);
        return null;
      }
      // Default the allocation to what this payment can still put toward the note:
      // the tx's own free magnitude, capped at the note's open balance. Under the
      // open balance ⇒ the note is settled in installments (stays PARTIAL); equal
      // ⇒ full settlement.
      const def = Math.min(candidate.remainingValue, nfOpenBalance);
      setAllocation(Number(Math.max(def, 0).toFixed(2)));
      return candidate.transactionId;
    });
  };

  const allocated = selectedTxId ? allocation : 0;
  const diff = allocated - nfOpenBalance;
  const isValidAllocation = Math.abs(diff) <= 0.05;

  // Need the picked transaction fully loaded before saving so its existing
  // matches are preserved (dropping them would let the backend delete them).
  const canSave =
    selectedTxId != null &&
    !selectedTxLoading &&
    !!selectedTx &&
    selectedTx.id === selectedTxId &&
    allocation > 0.005;
  const saving = matchMut.isPending;

  const handleSave = () => {
    if (!selectedTxId || !selectedTx || selectedTx.id !== selectedTxId) return;

    // The backend treats the payload as the COMPLETE match set for this
    // transaction: it deletes any match whose fiscalDocumentId is NOT in the
    // payload. So re-send the picked tx's existing non-reversed fiscal matches
    // (with their write-offs) alongside the new allocation for THIS note.
    const existingMatches = (selectedTx.matches ?? []).filter(
      (m) => !m.reversedAt,
    );
    const expanded: NonNullable<ManualMatchPayload["allocations"]> = [];
    for (const m of existingMatches) {
      if (m.fiscalDocumentId) {
        expanded.push({
          fiscalDocumentId: m.fiscalDocumentId,
          amount: m.allocatedAmount || 0,
          // Preserve any write-off already recorded on that note.
          adjustmentAmount: m.adjustmentAmount ?? undefined,
          adjustmentReason: m.adjustmentReason ?? undefined,
        });
      }
    }

    // Add (or top up, if somehow already present) THIS note's allocation.
    const existingForThisNf = expanded.find(
      (e) => e.fiscalDocumentId === fiscalDocument.id,
    );
    if (existingForThisNf) {
      existingForThisNf.amount = allocation;
    } else {
      expanded.push({ fiscalDocumentId: fiscalDocument.id, amount: allocation });
    }

    const payload: ManualMatchPayload = {
      fiscalDocumentIds: [...new Set(expanded.map((e) => e.fiscalDocumentId))],
      allocations: expanded,
    };
    // Success invalidates reconciliationKeys.all → NF detail refetches.
    matchMut.mutate({ transactionId: selectedTxId, payload });
  };

  // Report save state up so the page header can own the Salvar button + running
  // allocation summary. saveRef keeps the handler stable across renders.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    if (!onSaveStateChange) return;
    if (!showCandidates) {
      onSaveStateChange(null);
      return;
    }
    onSaveStateChange({
      canSave,
      saving,
      allocated,
      target: nfOpenBalance,
      missing: Math.abs(diff),
      valid: isValidAllocation,
      selectedCount: selectedTxId ? 1 : 0,
      save: () => saveRef.current(),
    });
  }, [
    onSaveStateChange,
    showCandidates,
    canSave,
    saving,
    allocated,
    nfOpenBalance,
    diff,
    isValidAllocation,
    selectedTxId,
  ]);
  // Clear the header state when the section unmounts.
  useEffect(() => () => onSaveStateChange?.(null), [onSaveStateChange]);

  if (!showCandidates) return null;

  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <IconArrowsExchange2 className="h-5 w-5 text-muted-foreground" />
          {hasExistingNfMatches
            ? "Adicionar outra transação"
            : "Transações candidatas à conciliação"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {candidatesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !candidates || candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma transação candidata encontrada. Importe mais extratos (OFX) ou
            amplie o período.
          </p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <CandidateRow
                key={c.transactionId}
                candidate={c}
                checked={selectedTxId === c.transactionId}
                allocation={allocation}
                nfOpenBalance={nfOpenBalance}
                onToggle={() => toggleSelect(c)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Single transaction candidate — a clickable card (toggles selection, green
 * border when selected) showing date, counterparty, memo, bank, amount and the
 * usual proximity/confidence/status badges. When selected, the amount settled
 * against THIS note is shown read-only — it is the note's own value (its open
 * balance), never an editable field: picking a transaction settles this note for
 * what the note is worth. The "Ver transação" link stops propagation so it opens
 * the transaction instead of toggling.
 */
function CandidateRow({
  candidate: c,
  checked,
  allocation,
  nfOpenBalance,
  onToggle,
}: {
  candidate: TransactionMatchCandidate;
  checked: boolean;
  allocation: number;
  nfOpenBalance: number;
  onToggle: () => void;
}) {
  const isCredit = c.type === "CREDIT";
  // The tx was already partly allocated to OTHER notes when its free magnitude
  // is below its full value.
  const partiallyUsed = c.remainingValue + 0.05 < c.absAmount;
  // Distinctive signals only — the day gap already has its own badge.
  const rationale = formatMatchRationale(c.rationale);
  return (
    // The whole card is the toggle target — clicking anywhere selects/deselects
    // (green border = selected). Nested links/inputs stop propagation.
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
      <div className="px-3.5 py-3">
        {/* Row 1 — type + counterparty (prominent) + signed amount (prominent),
            the two facts that decide a match, on one line. */}
        <div className="flex items-center gap-2.5">
          <Badge variant={isCredit ? "completed" : "cancelled"} size="sm">
            {isCredit ? "Crédito" : "Débito"}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {c.counterpartyName ||
              (c.counterpartyCnpjCpf
                ? formatCnpjCpf(c.counterpartyCnpjCpf)
                : c.memo || "—")}
          </span>
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-base font-bold tabular-nums",
              isCredit
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(c.amount)}
          </span>
        </div>

        {/* Row 2 — match signals: date + day-gap + confidence + status, then the
            detail link pushed to the right. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-medium text-foreground whitespace-nowrap">
            {formatDate(c.postedAt)}
          </span>
          <Badge variant="secondary" size="sm" title="Diferença de dias para a nota">
            {c.daysDelta === 0 ? "mesmo dia" : `${Math.abs(c.daysDelta)} dias`}
          </Badge>
          <Badge variant={getConfidenceBadgeVariant(c.confidence)} size="sm">
            {c.confidence}%
          </Badge>
          <MatchStatusBadge status={c.reconciliationStatus} />
          <Link
            to={routes.financial.reconciliation.transactionDetail(
              c.transactionId,
            )}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            title="Ver transação"
          >
            <IconExternalLink className="h-3.5 w-3.5" />
            Ver transação
          </Link>
        </div>

        {/* Row 3 — one readable metadata line: banco · forma · CNPJ. */}
        {(c.bankName || c.subtype || c.counterpartyCnpjCpf) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconBuildingBank className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {[
                c.bankName,
                c.subtype,
                c.counterpartyName && c.counterpartyCnpjCpf
                  ? formatCnpjCpf(c.counterpartyCnpjCpf)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
        )}

        {/* Row 4 — distinctive match signals only (CNPJ / valor / nome). The day
            gap is already a badge above, so date-proximity phrasing is stripped
            (see formatMatchRationale); the line hides entirely when nothing but
            proximity remains, keeping weak candidates uncluttered. */}
        {rationale && (
          <p className="mt-1.5 text-xs text-muted-foreground/90 truncate">
            {rationale}
          </p>
        )}
      </div>

      {/* Installment banner — the payment was already partly used on OTHER notes;
          show what's still free so the allocation reads correctly. */}
      {checked && partiallyUsed && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pt-2.5 text-xs border-t border-border bg-amber-50/50 dark:bg-amber-500/5">
          <span className="text-amber-800 dark:text-amber-300">
            Pagamento já parcialmente conciliado —{" "}
            {formatCurrency(c.remainingValue)} livre de {formatCurrency(c.absAmount)}
          </span>
        </div>
      )}

      {/* Allocation — read-only. Picking a transaction settles THIS note for what
          the note is worth (its open balance); it is never an editable amount. If
          the chosen payment can't fully cover the note, the remainder stays open
          (the note settles partially). */}
      {checked && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 border-t border-border bg-muted/10">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Valor a alocar
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(allocation)}
            </span>
            {allocation + 0.05 < nfOpenBalance ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                parcial de {formatCurrency(nfOpenBalance)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                (valor da nota)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
