import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconAlertTriangle,
  IconBrain,
  IconCircleCheck,
  IconExternalLink,
  IconLinkOff,
  IconStack2,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMatchCandidates,
  useMatchTransaction,
  useSetFiscalItemCategory,
} from "@/hooks/financial/use-reconciliation";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCNPJ, formatCurrency, formatDate } from "@/utils";
import type {
  AdjustmentReason,
  BankTransaction,
  MatchCandidate,
} from "@/types/reconciliation";
import { ADJUSTMENT_REASON_LABELS, ADJUSTMENT_REASON_ORDER } from "@/types/reconciliation";
import type { ManualMatchPayload } from "@/schemas/reconciliation";
import {
  formatMatchRationale,
  getConfidenceBadgeVariant,
} from "./match-status-badge";
import { FiscalItemsTable } from "./fiscal-items-table";
import { docTypeLabel, docTypeVariant } from "./fiscal-doc-badge";

/** Reported up to the detail page so the Salvar action + allocation summary can
 *  live in the page header (always visible while selecting notes). */
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
  transaction: BankTransaction;
  /** Opens the unmatch confirm flow owned by the page. */
  onRequestUnmatch?: () => void;
  /** Reports save-ability + allocation totals up so the page header can render
   *  the Salvar button + a running "Alocado / Faltam" summary. */
  onSaveStateChange?: (state: MatchSaveState | null) => void;
}

// Mirror of the API's `valueScore` (reconciliation-matcher.service.ts) so the
// candidate confidence can be re-scored CLIENT-SIDE against the REMAINING
// unallocated amount as notes are selected. Only the value component of the
// score depends on the target amount; date/CNPJ/name are unaffected, so we swap
// just the value slice: liveConfidence = confidence − valueScore(fullPayment) +
// valueScore(remaining). Keep the tiers in sync with the backend.
const VALUE_SCORE_PERFECT_TOLERANCE = 0.5;
function clientValueScore(txAmount: number, docTotal: number): number {
  const diff = Math.abs(txAmount - docTotal);
  const ratio = diff / Math.max(txAmount, docTotal, 0.01);
  if (diff <= VALUE_SCORE_PERFECT_TOLERANCE) return 35;
  if (ratio <= 0.005) return 30;
  if (ratio <= 0.01) return 24;
  if (ratio <= 0.02) return 18;
  if (ratio <= 0.035) return 14;
  if (ratio <= 0.06) return 11;
  if (ratio <= 0.1) return 6;
  if (ratio <= 0.15) return 3;
  return 0;
}

/**
 * Reconciliation controls for a single transaction, rendered as page sections
 * (no dialog shell). The save action + allocation summary are surfaced in the
 * page header via onSaveStateChange. Mutation hooks invalidate the reconciliation
 * query namespace so the detail page refetches in place.
 *
 * Extracted from the former ManualMatchDialog.
 */
export function TransactionMatchSection({
  transaction,
  onRequestUnmatch,
  onSaveStateChange,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  // Remainder resolution: how the part of the payment NOT backed by an NF (frete,
  // seguro estendido, taxas…) is accounted. A resolving reason marks the tx
  // RECONCILED; "DEFERRED" (or null) leaves it PARTIAL for another transaction.
  const [remainderReason, setRemainderReason] = useState<
    | "FRETE"
    | "SEGURO"
    | "TAXAS"
    | "ITEM_SEM_NOTA"
    | "OUTROS"
    | "DEFERRED"
    | null
  >(null);
  // Per-note shortfall write-off: when this payment settles a note for LESS than
  // its total, the user picks a reason (Desconto, Frete…) so the note closes as
  // settled instead of lingering open. null = leave open (a parcela another
  // transaction pays). Keyed by fiscalDocumentId.
  const [adjustmentByDoc, setAdjustmentByDoc] = useState<
    Record<string, AdjustmentReason | null>
  >({});

  const matchMut = useMatchTransaction();
  const setItemCategory = useSetFiscalItemCategory();

  const txId = transaction.id;
  const txAmount = Math.abs(transaction.amount);

  const { data: candidates, isLoading: candidatesLoading } = useMatchCandidates(
    txId,
    true,
  );

  // Lookup so save/validation can expand an order-group selection into its
  // member NFs and read each candidate's group metadata.
  const candById = useMemo(
    () => new Map((candidates ?? []).map((c) => [c.fiscalDocumentId, c])),
    [candidates],
  );

  // Reset NF selection when the transaction identity changes (post-save). Keyed
  // on the id, NOT the object — a background refetch yields a new `transaction`
  // reference for the same tx and must not wipe an in-progress selection.
  useEffect(() => {
    setSelectedIds([]);
    setAllocations({});
    setNotes("");
    setRemainderReason(null);
    setAdjustmentByDoc({});
  }, [transaction.id]);

  const handleItemCategory = (
    fiscalItemId: string,
    categoryId: string | null,
  ) => setItemCategory.mutate({ fiscalItemId, categoryId });

  const toggleSelect = (id: string, candidate: MatchCandidate) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (!prev.includes(id)) {
        // Default the allocation to what THIS transaction can still cover, capped
        // at the NF's own total. For an installment (parcela) — one NF paid by
        // several transactions — the NF total (e.g. R$36.530) exceeds a single
        // payment (e.g. R$12.179), so the default becomes the remaining payment
        // amount and the NF is linked as a PARTIAL. The other installment
        // transactions later cover the rest of the same NF. Order groups keep
        // their full summed value (handled in handleSave), so they aren't capped.
        setAllocations((a) => {
          if (candidate.isOrderGroup) {
            return { ...a, [id]: candidate.totalValue };
          }
          // The NF's open balance — its full total minus what OTHER transactions
          // already paid (installments). Never allocate more than this, and never
          // more than the payment can still cover: cap at min(openBalance, txRemaining).
          // When the payment is already fully allocated (txRemaining ≤ 0) the new
          // note defaults to 0 so the user rebalances manually instead of the
          // selection silently over-allocating past the transaction amount.
          const openBalance = candidate.remainingValue ?? candidate.totalValue;
          const alreadySelected = Object.entries(a)
            .filter(([k]) => k !== id)
            .reduce((s, [, v]) => s + (v || 0), 0);
          const txRemaining = txAmount - existingAllocated - alreadySelected;
          const def = Math.min(openBalance, Math.max(txRemaining, 0));
          return { ...a, [id]: Number(def.toFixed(2)) };
        });
      } else {
        setAllocations((a) => {
          const copy = { ...a };
          delete copy[id];
          return copy;
        });
        // Drop any shortfall write-off chosen for a now-deselected note.
        setAdjustmentByDoc((m) => {
          if (!(id in m)) return m;
          const copy = { ...m };
          delete copy[id];
          return copy;
        });
      }
      return next;
    });
  };

  const setAdjustment = (id: string, reason: AdjustmentReason | null) =>
    setAdjustmentByDoc((m) => ({ ...m, [id]: reason }));

  const existingMatches = useMemo(
    () => (transaction.matches ?? []).filter((m) => !m.reversedAt),
    [transaction],
  );
  const hasExistingMatch = existingMatches.length > 0;
  // When this one payment settles several NFs of a single purchase order, the
  // matched NFs share a "#Ped:" order code. Surface that as a header so the
  // linked notes read as "one order, one payment" rather than loose NFs.
  const sharedOrderCodes = useMemo(() => {
    const docsByCode = new Map<string, Set<string>>();
    for (const m of existingMatches) {
      for (const oc of m.fiscalDocument?.orderCodes ?? []) {
        const set = docsByCode.get(oc.code) ?? new Set<string>();
        if (m.fiscalDocumentId) set.add(m.fiscalDocumentId);
        docsByCode.set(oc.code, set);
      }
    }
    return [...docsByCode.entries()]
      .filter(([, docs]) => docs.size > 1)
      .map(([code, docs]) => ({ code, count: docs.size }));
  }, [existingMatches]);
  const existingAllocated = useMemo(
    () => existingMatches.reduce((sum, m) => sum + (m.allocatedAmount || 0), 0),
    [existingMatches],
  );

  // Each selected note defaults its allocation (in `toggleSelect`) to what the
  // payment can still cover, capped at the note's own open balance. So a single
  // note worth LESS than the payment allocates only its own total and the surplus
  // surfaces below as "Restante sem nota" (frete/seguro/taxas) instead of
  // over-allocating the note; a note worth MORE than the payment (installment)
  // takes the whole payment as a PARTIAL. Selecting a SECOND note then splits the
  // payment across both by open balance — never inheriting a stale full-payment
  // value from the single-note case (that used to leave the first note allocated
  // the entire payment, so two notes summed past the transaction amount). The
  // per-note "Valor a alocar" input appears only when SEVERAL notes share one
  // payment (then the split is editable).
  const newlyAllocated = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (allocations[id] || 0), 0),
    [selectedIds, allocations],
  );
  // Category remainder counts toward coverage only alongside a selected NF (the
  // backend match requires ≥1 NF); ignore orphan rows when nothing is selected.
  // NF-only allocated (before resolving the non-NF remainder).
  const nfAllocated = existingAllocated + newlyAllocated;

  // Live confidence re-rank: the value component of each candidate's confidence
  // is scored against how much of the payment is STILL open, so as the user
  // links notes the remaining candidates re-rank by how well they fit the
  // residual (e.g. after allocating R$10 of R$100, a R$90 note jumps to the top).
  // The residual excludes notes already allocated (existing partial matches) and
  // the current selection. When nothing is allocated the residual equals the full
  // payment, so idle confidence is identical to the server's.
  const rankTarget = Number((txAmount - existingAllocated - newlyAllocated).toFixed(2));
  const rankedCandidates = useMemo(() => {
    const list = candidates ?? [];
    const meaningfulResidual = rankTarget > VALUE_SCORE_PERFECT_TOLERANCE;
    const withLive = list.map((c) => {
      const noteVal = c.remainingValue ?? c.totalValue;
      // Order groups carry a summed synthetic value; re-scoring them against a
      // partial residual is misleading, so keep their server confidence.
      const displayConfidence =
        meaningfulResidual && !c.isOrderGroup
          ? Math.max(
              0,
              Math.min(
                100,
                c.confidence -
                  clientValueScore(txAmount, noteVal) +
                  clientValueScore(rankTarget, noteVal),
              ),
            )
          : c.confidence;
      return { c, displayConfidence };
    });
    // Selected notes stay pinned on top (they're part of the in-progress match);
    // the rest sort by live confidence so the best fit for the residual floats up.
    return withLive.sort((a, b) => {
      const aSel = selectedIds.includes(a.c.fiscalDocumentId) ? 1 : 0;
      const bSel = selectedIds.includes(b.c.fiscalDocumentId) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return b.displayConfidence - a.displayConfidence;
    });
  }, [candidates, rankTarget, txAmount, selectedIds]);
  // The part of the payment not backed by an NF — the "restante sem nota".
  const remainder = Number((txAmount - nfAllocated).toFixed(2));
  // A resolving reason (frete/seguro/taxas/outros — NOT "deferred") accounts for
  // the remainder, so it counts as fully allocated for the header + validation.
  const remainderResolved =
    selectedIds.length > 0 &&
    remainder > 0.05 &&
    remainderReason != null &&
    remainderReason !== "DEFERRED";
  const totalAllocated = nfAllocated + (remainderResolved ? remainder : 0);
  const diff = totalAllocated - txAmount;
  // Order-group selections sum several NFs, so accumulated rounding can drift a
  // couple reais from the payment; widen the tolerance when one is selected
  // (the save step still residual-adjusts allocations to hit the exact amount).
  const hasOrderGroupSelected = selectedIds.some(
    (id) => candById.get(id)?.isOrderGroup,
  );
  const allocationTolerance = hasOrderGroupSelected ? 2.0 : 0.05;
  const isValidAllocation = Math.abs(diff) <= allocationTolerance;

  const isFullyReconciled =
    transaction.reconciliationStatus === "RECONCILED" &&
    hasExistingMatch &&
    existingAllocated + 0.05 >= txAmount;
  // Show candidates whenever the transaction still needs work:
  //  - PENDING: nothing linked yet.
  //  - PARTIAL: some NFs linked but the payment isn't fully covered — the user
  //    deferred the rest ("Outra transação (depois)") to continue LATER. This is
  //    the case that used to break: the old `!hasExistingMatch` gate hid the
  //    candidate panel the moment one NF was linked, so reopening a partial
  //    conciliation showed only "Desvincular" with no way to add the remaining
  //    notes. A PARTIAL tx always has an existing match, so it must be allowed
  //    to coexist with one ("Adicionar outra nota").
  //  - expectsFiscalDocument with no match yet: assigning a category may flip the
  //    status to RECONCILED, and we still want the match section visible.
  // A fully RECONCILED tx (covered by NFs, or remainder resolved by a reason) is
  // done — the panel stays hidden there.
  const showCandidates =
    transaction.reconciliationStatus === "PENDING" ||
    transaction.reconciliationStatus === "PARTIAL" ||
    (!hasExistingMatch && transaction.expectsFiscalDocument === true);

  const hasMatchChanges = selectedIds.length > 0;
  // Allow saving even when the allocated amount differs from the transaction —
  // handleSave absorbs the residual onto the largest NF so the backend receives
  // an allocation that sums exactly to the payment. isValidAllocation is kept
  // as a visual signal only (amber "Faltam" label) but no longer blocks saving.
  //
  // BUT: a note allocated MORE than its open balance (paid-more) must carry a
  // surcharge reason (frete/seguro…) — otherwise the payload would over-allocate
  // the note and the backend rejects it. Block the save until that's resolved.
  const hasUnresolvedSurplus = useMemo(
    () =>
      selectedIds.some((id) => {
        const c = candById.get(id);
        if (!c || c.isOrderGroup) return false;
        const openBalance = c.remainingValue ?? c.totalValue;
        const alloc = allocations[id] ?? 0;
        return alloc > openBalance + 0.05 && !adjustmentByDoc[id];
      }),
    [selectedIds, candById, allocations, adjustmentByDoc],
  );
  const canSave = hasMatchChanges && !hasUnresolvedSurplus;
  const saving = matchMut.isPending;

  const handleSave = () => {
    if (!hasMatchChanges) return;

    // The backend treats the payload as the COMPLETE match set: it deletes any
    // match whose fiscalDocumentId is NOT in the payload, then validates the
    // payload sum against the FULL transaction amount. So when adding to an
    // already-partially-matched transaction, re-send the existing non-reversed
    // fiscal matches alongside the new ones — otherwise they'd be dropped and the
    // payload could no longer cover the payment (the old `txAmount −
    // existingAllocated` target made partial re-matches fail validation).
    const expanded: {
      fiscalDocumentId: string;
      amount: number;
      adjustmentAmount?: number;
      adjustmentReason?: AdjustmentReason;
    }[] = [];
    for (const m of existingMatches) {
      if (m.fiscalDocumentId) {
        expanded.push({
          fiscalDocumentId: m.fiscalDocumentId,
          amount: m.allocatedAmount || 0,
          // Preserve any write-off already recorded on this note (re-sending the
          // match without it would clear it on the backend).
          adjustmentAmount: m.adjustmentAmount ?? undefined,
          adjustmentReason: m.adjustmentReason ?? undefined,
        });
      }
    }

    // Expand any selected order group into its member NFs (a group's
    // `fiscalDocumentId` is a synthetic "order-group:<code>" sentinel, never a
    // real doc). Each member is allocated its own NF value.
    for (const id of selectedIds) {
      const c = candById.get(id);
      if (c?.isOrderGroup && c.members?.length) {
        for (const m of c.members) {
          expanded.push({
            fiscalDocumentId: m.fiscalDocumentId,
            amount: m.totalValue,
          });
        }
      } else {
        const amount = allocations[id] ?? c?.totalValue ?? 0;
        // Signed settlement adjustment: note total − what this payment covers.
        // >0 = paid less (discount, positive write-off); <0 = paid more (frete/
        // seguro surcharge, negative). Sent only when the user chose a reason so
        // the note closes; a bare shortfall with no reason stays open (parcela).
        const reason = adjustmentByDoc[id] ?? null;
        const openBalance = c?.remainingValue ?? c?.totalValue ?? amount;
        const diff = Number((openBalance - amount).toFixed(2));
        expanded.push({
          fiscalDocumentId: id,
          amount,
          ...(reason && Math.abs(diff) > 0.005
            ? { adjustmentAmount: diff, adjustmentReason: reason }
            : {}),
        });
      }
    }

    // Absorb ONLY a small rounding residual (cents drift across summed
    // order-group NFs) onto the largest member so it sums exactly. Do NOT inflate
    // when the payment genuinely exceeds the NF(s) — e.g. a marketplace debit that
    // bundles DIFAL/fees on top of the NF total: inflating would over-allocate an
    // NF beyond its real value. Such cases save as a PARTIAL conciliation, with
    // the remainder left unreconciled.
    const target = txAmount;
    const sum = expanded.reduce((s, a) => s + a.amount, 0);
    const residual = Number((sum - target).toFixed(2));
    if (
      expanded.length > 0 &&
      Math.abs(residual) >= 0.01 &&
      Math.abs(residual) <= allocationTolerance
    ) {
      let li = 0;
      for (let i = 1; i < expanded.length; i++) {
        if (expanded[i].amount > expanded[li].amount) li = i;
      }
      expanded[li] = {
        ...expanded[li],
        amount: Number((expanded[li].amount - residual).toFixed(2)),
      };
    }

    const payload: ManualMatchPayload = {
      fiscalDocumentIds: expanded.map((e) => e.fiscalDocumentId),
      allocations: expanded,
      // A resolving reason accounts for the non-NF remainder → RECONCILED.
      // "DEFERRED"/none is not sent → the tx stays PARTIAL for another transaction.
      remainderReason:
        remainderReason && remainderReason !== "DEFERRED"
          ? remainderReason
          : undefined,
      notes: notes || undefined,
    };
    // Mutation success invalidates reconciliationKeys.all → detail refetches.
    matchMut.mutate({ transactionId: txId, payload });
  };

  // Report save state up so the page header can own the Salvar button + the
  // running allocation summary. saveRef keeps the handler stable across renders.
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
      allocated: totalAllocated,
      target: txAmount,
      missing: Math.abs(diff),
      valid: isValidAllocation,
      selectedCount: selectedIds.length,
      save: () => saveRef.current(),
    });
  }, [
    onSaveStateChange,
    showCandidates,
    canSave,
    saving,
    totalAllocated,
    txAmount,
    diff,
    isValidAllocation,
    selectedIds.length,
  ]);
  // Clear the header state when the section unmounts.
  useEffect(() => () => onSaveStateChange?.(null), [onSaveStateChange]);

  const isLikelyTax =
    !!transaction.memo &&
    /DARF|ARRECADAC|TRIBUTO|IMPOSTO|TARIFA|TAR\.BANC|TAR BANC|\bIOF\b/i.test(
      transaction.memo,
    );

  return (
    <>
      {isLikelyTax && !hasExistingMatch && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Movimentação tributária ou tarifária
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            DARF, IOF, tarifas bancárias e tributos não têm nota fiscal. Basta
            definir a categoria correspondente (Tarifa, Tributo, etc.).
          </p>
        </div>
      )}

      {/* Notas vinculadas */}
      {hasExistingMatch && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base leading-none">
                Notas vinculadas
              </CardTitle>
              <div className="flex items-center gap-2">
                {isFullyReconciled && (
                  <Button variant="default" size="sm" disabled className="h-8">
                    <IconCircleCheck className="h-4 w-4 mr-1.5" /> Conciliação
                    completa
                  </Button>
                )}
                {onRequestUnmatch && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onRequestUnmatch}
                    className="h-8"
                  >
                    <IconLinkOff className="h-4 w-4 mr-1.5" /> Desvincular
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {sharedOrderCodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                <IconStack2 className="h-4 w-4 text-primary shrink-0" />
                {sharedOrderCodes.map((g) => (
                  <span
                    key={g.code}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                  >
                    Pedido <span className="font-mono">{g.code}</span>
                  </span>
                ))}
                <span className="text-xs text-muted-foreground">
                  {sharedOrderCodes.reduce((s, g) => Math.max(s, g.count), 0)}{" "}
                  notas somadas em um único pagamento
                </span>
              </div>
            )}
            {existingMatches.map((m) => {
              const doc = m.fiscalDocument;
              const slip = m.bankSlip;
              const nfHref = doc?.id
                ? routes.financial.reconciliation.fiscalDocumentDetail(doc.id)
                : null;
              const title =
                doc?.emitName ||
                (doc?.emitCnpj
                  ? formatCNPJ(doc.emitCnpj)
                  : slip
                    ? `Boleto ${slip.nossoNumero}`
                    : "—");
              // Header row: clickable, opens NF detail.
              const header = (
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  {doc?.docType && (
                    <Badge variant={docTypeVariant(doc.docType)}>
                      {docTypeLabel(doc.docType)}
                    </Badge>
                  )}
                  {doc?.nfNumber && (
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap font-mono"
                    >
                      Nº {doc.nfNumber}
                    </Badge>
                  )}
                  {(doc?.orderCodes ?? []).map((oc) => (
                    <Badge
                      key={oc.code}
                      variant="secondary"
                      className="whitespace-nowrap font-mono gap-1"
                      title="Pedido (#Ped) da nota"
                    >
                      <IconStack2 className="h-3 w-3" />
                      {oc.code}
                    </Badge>
                  ))}
                  <span className="font-medium truncate flex-1 min-w-0">
                    {title}
                  </span>
                  {doc?.issueDate && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(doc.issueDate)}
                    </span>
                  )}
                </div>
              );
              return (
                <div
                  key={m.id}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  {nfHref ? (
                    <Link
                      to={nfHref}
                      className="block px-3 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      {header}
                    </Link>
                  ) : (
                    <div className="px-3 py-2.5">{header}</div>
                  )}
                  {/* Items table OUTSIDE the link so the category combobox is clickable. */}
                  {doc?.docType && doc.items && doc.items.length > 0 && (
                    <FiscalItemsTable
                      items={doc.items}
                      docType={doc.docType}
                      editable
                      dense
                      totalValue={doc.totalValue}
                      onItemCategoryChange={handleItemCategory}
                      className="border-0 border-t rounded-none"
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Candidatas à conciliação */}
      {showCandidates && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {hasExistingMatch
                ? "Adicionar outra nota"
                : "Candidatas à conciliação"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {candidatesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !candidates || candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {isLikelyTax
                  ? "Sem candidatas — esta transação não exige conciliação fiscal."
                  : "Nenhuma candidata encontrada. Importe mais XMLs ou amplie o período."}
              </p>
            ) : (
              <div className="space-y-6">
                {rankedCandidates.map(({ c, displayConfidence }) => (
                  <CandidateRow
                    key={c.fiscalDocumentId}
                    candidate={c}
                    displayConfidence={displayConfidence}
                    checked={selectedIds.includes(c.fiscalDocumentId)}
                    allocation={allocations[c.fiscalDocumentId]}
                    multiSelect={selectedIds.length > 1}
                    onToggle={() => toggleSelect(c.fiscalDocumentId, c)}
                    adjustmentReason={
                      adjustmentByDoc[c.fiscalDocumentId] ?? null
                    }
                    onAdjustmentChange={(r) =>
                      setAdjustment(c.fiscalDocumentId, r)
                    }
                    onItemCategoryChange={handleItemCategory}
                  />
                ))}
              </div>
            )}

            {/* Restante sem nota — the part of the payment NOT backed by an NF
                (frete, seguro estendido, taxas). Pick what it is to reconcile the
                whole payment, or defer it to another transaction (stays Parcial).
                No category is added — the transaction keeps only the NF's own. */}
            {selectedIds.length > 0 && remainder > 0.05 && (
              <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <IconTruckDelivery className="h-4 w-4 text-muted-foreground" />
                    Restante sem nota
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      remainderResolved
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {formatCurrency(remainder)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  O pagamento excede a nota em {formatCurrency(remainder)}. O que é esse valor?
                </p>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "FRETE", label: "Frete" },
                      { key: "SEGURO", label: "Seguro estendido" },
                      { key: "TAXAS", label: "Taxas / tarifas" },
                      { key: "ITEM_SEM_NOTA", label: "Item sem nota" },
                      { key: "OUTROS", label: "Outros" },
                      { key: "DEFERRED", label: "Outra transação (depois)" },
                    ] as const
                  ).map((opt) => {
                    const active = remainderReason === opt.key;
                    return (
                      <Button
                        key={opt.key}
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setRemainderReason((prev) =>
                            prev === opt.key ? null : opt.key,
                          )
                        }
                      >
                        {active && <IconCircleCheck className="h-4 w-4 mr-1" />}
                        {opt.label}
                      </Button>
                    );
                  })}
                </div>

                {remainderReason === "DEFERRED" && (
                  <p className="text-xs text-muted-foreground border-t border-border/60 pt-2">
                    O restante ({formatCurrency(remainder)}) fica{" "}
                    <span className="font-medium">pendente</span> — a conciliação será{" "}
                    <span className="font-medium">Parcial</span> até outra transação cobri-lo.
                  </p>
                )}
              </div>
            )}

            {/* Observações — the Alocado summary + Salvar button live in the
                page header (always visible while selecting). */}
            <div className="space-y-1">
              <Label
                htmlFor="match-notes"
                className="text-xs text-muted-foreground"
              >
                Observações (opcional)
              </Label>
              <Input
                id="match-notes"
                value={notes}
                onChange={(v) => setNotes(typeof v === "string" ? v : "")}
                maxLength={500}
                placeholder="Anotações para auditoria"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/**
 * Single candidate — a clickable header (toggles selection) plus the NF's
 * services/items table with an inline category combobox. The items table and
 * allocation input live OUTSIDE the toggle target so editing them doesn't flip
 * the selection.
 */
function CandidateRow({
  candidate: c,
  displayConfidence,
  checked,
  allocation,
  multiSelect,
  adjustmentReason,
  onToggle,
  onAdjustmentChange,
  onItemCategoryChange,
}: {
  candidate: MatchCandidate;
  /** Confidence re-scored against the remaining unallocated amount; falls back
   *  to the server confidence when no partial allocation is in progress. */
  displayConfidence?: number;
  checked: boolean;
  allocation: number | undefined;
  multiSelect: boolean;
  adjustmentReason: AdjustmentReason | null;
  onToggle: () => void;
  onAdjustmentChange: (reason: AdjustmentReason | null) => void;
  onItemCategoryChange: (itemId: string, categoryId: string | null) => void;
}) {
  // Round for display; keep the server value when no re-rank target is active.
  const shownConfidence = Math.round(displayConfidence ?? c.confidence);
  // A single NF paid in installments allocates only PART of its total to this
  // transaction; the value is editable so the user can split it. Order groups
  // sum several NFs at their full value and aren't individually editable.
  const openBalance = c.remainingValue ?? c.totalValue;
  // The NF was already partially paid by OTHER transactions (a prior parcela).
  const alreadyPaid = !c.isOrderGroup && openBalance + 0.05 < c.totalValue;
  const paid = allocation ?? 0;
  // Signed difference between the note's open balance and what THIS payment puts
  // toward it: >0 paid LESS (discount/installment), <0 paid MORE (surcharge).
  const noteDiff = Number((openBalance - paid).toFixed(2));
  const paidLess = !c.isOrderGroup && noteDiff > 0.05;
  const paidMore = !c.isOrderGroup && noteDiff < -0.05;
  // The "Valor a alocar" input only appears when SEVERAL notes share one payment
  // and the amount must be divided among them. For a single note the whole
  // transaction goes to it (pinned in the parent), so no input — the paid-less/
  // paid-more resolver below still handles any difference from the note total.
  const showAllocationInput = !c.isOrderGroup && multiSelect;
  // Reasons offered per direction — a discount only makes sense when paid LESS.
  const reasonOptions = paidMore
    ? ADJUSTMENT_REASON_ORDER.filter((r) => r !== "DESCONTO")
    : ADJUSTMENT_REASON_ORDER;
  return (
    // The ENTIRE card is the toggle target — clicking anywhere selects/deselects
    // the candidate (green border = selected). The category combobox cell stops
    // propagation (see FiscalItemsTable) so categorizing never flips selection,
    // and the "Ver Notas" link stops propagation so it opens the NF instead.
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
      <div className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {c.isOrderGroup ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide shrink-0"
              title="Pedido — várias notas somadas em um único pagamento"
            >
              <IconStack2 className="h-3.5 w-3.5" />
              Pedido {c.orderCode}
            </span>
          ) : (
            <Badge variant={docTypeVariant(c.docType)}>
              {docTypeLabel(c.docType)}
            </Badge>
          )}
          {c.isOrderGroup ? (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {c.memberCount} notas{c.nfNumber ? ` · Nº ${c.nfNumber}` : ""}
            </span>
          ) : (
            <>
              {c.nfNumber && (
                <Badge
                  variant="secondary"
                  className="whitespace-nowrap font-mono"
                >
                  Nº {c.nfNumber}
                </Badge>
              )}
              {(c.orderCodes ?? []).map((oc) => (
                <Badge
                  key={oc.code}
                  variant="secondary"
                  className="whitespace-nowrap font-mono gap-1"
                >
                  <IconStack2 className="h-3 w-3" />
                  {oc.code}
                </Badge>
              ))}
            </>
          )}
          <span className="font-medium truncate min-w-0">
            {c.emitName || (c.emitCnpj ? formatCNPJ(c.emitCnpj) : "—")}
          </span>
          {c.isOrderGroup && c.cleanGroup === false && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-300/60 dark:border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0"
              title="Contém nota que pertence a mais de um pedido — revisar antes de conciliar"
            >
              <IconAlertTriangle className="h-3 w-3" />
              Revisar
            </span>
          )}
          {c.aliasAssisted && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-300/60 dark:border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0"
              title="Sugerido pelo histórico de conciliações"
            >
              <IconBrain className="h-3 w-3" />
              Aprendido
            </span>
          )}
          {/* Top-right cluster: date (prominent) + proximity day gap + confidence
              + a "Ver Notas" link (single NF only — a group has no single doc to
              open). The link stops propagation so it opens the NF detail instead
              of toggling the candidate selection. */}
          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {formatDate(c.issueDate)}
            </span>
            <Badge
              variant="secondary"
              title="Diferença de dias para a transação"
            >
              {c.daysDelta === 0 ? "mesmo dia" : `${c.daysDelta}d`}
            </Badge>
            <Badge variant={getConfidenceBadgeVariant(shownConfidence)}>
              {shownConfidence}%
            </Badge>
            {!c.isOrderGroup && (
              <Link
                to={routes.financial.reconciliation.fiscalDocumentDetail(
                  c.fiscalDocumentId,
                )}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                title="Ver notas"
              >
                <IconExternalLink className="h-3.5 w-3.5" />
                Ver Notas
              </Link>
            )}
          </div>
        </div>

        {/* Why this note is suggested — distinctive signals only (CNPJ / valor /
            nome). The day gap already has its own badge above, so date-proximity
            phrasing is stripped and the line hides when only proximity remains. */}
        {formatMatchRationale(c.rationale) && (
          <p className="mt-1.5 text-xs text-muted-foreground/90 truncate">
            {formatMatchRationale(c.rationale)}
          </p>
        )}
      </div>

      {/* Services / items of the NF, with per-line category combobox. When several
          notes share one payment, each note is auto-settled for its own open
          balance (shown read-only below); a single note takes the whole payment. */}
      {c.items && c.items.length > 0 && (
        <FiscalItemsTable
          items={c.items}
          docType={c.docType}
          editable
          dense
          totalValue={c.totalValue}
          onItemCategoryChange={onItemCategoryChange}
          className="border-0 border-t rounded-none"
        />
      )}

      {/* Installment banner — the NF was already partially settled by a prior
          transaction; show what's still open so the user allocates correctly. */}
      {checked && alreadyPaid && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pt-2.5 text-xs border-t border-border bg-amber-50/50 dark:bg-amber-500/5">
          <IconStack2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
          <span className="text-amber-800 dark:text-amber-300">
            Nota paga em parcelas — {formatCurrency(c.totalValue - openBalance)}{" "}
            já pago, {formatCurrency(openBalance)} em aberto de{" "}
            {formatCurrency(c.totalValue)}
          </span>
        </div>
      )}

      {/* Allocation — read-only. When several notes share one payment each note is
          auto-settled for its own open balance (capped by what the payment still
          has free); the amount is shown for transparency but never edited. Any
          leftover or shortfall is resolved by the settlement panel below and the
          header's Alocado / Faltam summary. */}
      {checked && showAllocationInput && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 border-t border-border bg-muted/10",
            alreadyPaid && "border-t-0",
          )}
        >
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Valor a alocar
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(paid)}
            </span>
            {paid + 0.05 < openBalance ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                parcial de {formatCurrency(openBalance)}
                {alreadyPaid ? " em aberto" : ""}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                (valor da nota)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Settlement-difference resolver — the amount paid for this note differs
          from its total, in EITHER direction. Paid less: leave open (a parcela) or
          write off the shortfall with a reason (Desconto…). Paid more: attribute
          the surplus as a note-related surcharge (Frete, Seguro…). Both close the
          note as quitada while the payment stays fully allocated. */}
      {checked && (paidLess || paidMore) && (
        <div
          className="border-t border-border bg-muted/20 px-3 py-3 space-y-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header: the difference + its current resolution state */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {paidMore ? "Pagamento excede a nota" : "Pagamento menor que a nota"}
              <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                {formatCurrency(Math.abs(noteDiff))}
              </span>
            </span>
            <Badge
              variant={
                adjustmentReason ? "default" : paidMore ? "cancelled" : "secondary"
              }
              size="sm"
              className="whitespace-nowrap shrink-0"
            >
              {adjustmentReason
                ? `Quitada · ${ADJUSTMENT_REASON_LABELS[adjustmentReason]}`
                : paidMore
                  ? "Escolha o motivo"
                  : "Parcela em aberto"}
            </Badge>
          </div>

          {/* Reason choices */}
          <div className="flex flex-wrap gap-1.5">
            {paidLess && (
              <Button
                type="button"
                variant={adjustmentReason == null ? "default" : "outline"}
                size="sm"
                onClick={() => onAdjustmentChange(null)}
              >
                {adjustmentReason == null && (
                  <IconCircleCheck className="h-4 w-4 mr-1" />
                )}
                Parcela
              </Button>
            )}
            {reasonOptions.map((r) => {
              const active = adjustmentReason === r;
              return (
                <Button
                  key={r}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => onAdjustmentChange(active ? null : r)}
                >
                  {active && <IconCircleCheck className="h-4 w-4 mr-1" />}
                  {ADJUSTMENT_REASON_LABELS[r]}
                </Button>
              );
            })}
          </div>

          {/* Result / warning */}
          {adjustmentReason ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Nota quitada — {formatCurrency(Math.abs(noteDiff))} lançado como{" "}
              {ADJUSTMENT_REASON_LABELS[adjustmentReason]}.
            </p>
          ) : paidMore ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Escolha um motivo para o excedente — senão não será possível salvar.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Deixe como parcela para pagar o restante em outra transação, ou
              escolha um motivo para quitar a nota agora.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
