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
import type { BankTransaction, MatchCandidate } from "@/types/reconciliation";
import type { ManualMatchPayload } from "@/schemas/reconciliation";
import { getConfidenceBadgeVariant } from "./match-status-badge";
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
    "FRETE" | "SEGURO" | "TAXAS" | "OUTROS" | "DEFERRED" | null
  >(null);

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
          // already paid (installments). Never allocate more than this.
          const openBalance = candidate.remainingValue ?? candidate.totalValue;
          const alreadySelected = Object.entries(a)
            .filter(([k]) => k !== id)
            .reduce((s, [, v]) => s + (v || 0), 0);
          const txRemaining = txAmount - existingAllocated - alreadySelected;
          const def =
            txRemaining > 0 ? Math.min(openBalance, txRemaining) : openBalance;
          return { ...a, [id]: Number(def.toFixed(2)) };
        });
      } else {
        setAllocations((a) => {
          const copy = { ...a };
          delete copy[id];
          return copy;
        });
      }
      return next;
    });
  };

  const setAllocation = (id: string, value: number) =>
    setAllocations((a) => ({ ...a, [id]: value }));

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
  const newlyAllocated = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (allocations[id] || 0), 0),
    [selectedIds, allocations],
  );
  // Category remainder counts toward coverage only alongside a selected NF (the
  // backend match requires ≥1 NF); ignore orphan rows when nothing is selected.
  // NF-only allocated (before resolving the non-NF remainder).
  const nfAllocated = existingAllocated + newlyAllocated;
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
  // Show candidates when pending/partial, OR when the transaction was expecting
  // an NF but no NF has been linked yet — so that assigning a category (which
  // may flip status to RECONCILED) does not hide the match section.
  const showCandidates =
    !hasExistingMatch &&
    (transaction.reconciliationStatus === "PENDING" ||
      transaction.reconciliationStatus === "PARTIAL" ||
      transaction.expectsFiscalDocument === true);

  const hasMatchChanges = selectedIds.length > 0;
  // Allow saving even when the allocated amount differs from the transaction —
  // handleSave absorbs the residual onto the largest NF so the backend receives
  // an allocation that sums exactly to the payment. isValidAllocation is kept
  // as a visual signal only (amber "Faltam" label) but no longer blocks saving.
  const canSave = hasMatchChanges;
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
    const expanded: { fiscalDocumentId: string; amount: number }[] = [];
    for (const m of existingMatches) {
      if (m.fiscalDocumentId) {
        expanded.push({
          fiscalDocumentId: m.fiscalDocumentId,
          amount: m.allocatedAmount || 0,
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
        expanded.push({
          fiscalDocumentId: id,
          amount: allocations[id] ?? c?.totalValue ?? 0,
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
                {candidates.map((c) => (
                  <CandidateRow
                    key={c.fiscalDocumentId}
                    candidate={c}
                    checked={selectedIds.includes(c.fiscalDocumentId)}
                    allocation={allocations[c.fiscalDocumentId]}
                    txAmount={txAmount}
                    onToggle={() => toggleSelect(c.fiscalDocumentId, c)}
                    onAllocationChange={(v) =>
                      setAllocation(c.fiscalDocumentId, v)
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
  checked,
  allocation,
  txAmount,
  onToggle,
  onAllocationChange,
  onItemCategoryChange,
}: {
  candidate: MatchCandidate;
  checked: boolean;
  allocation: number | undefined;
  txAmount: number;
  onToggle: () => void;
  onAllocationChange: (value: number) => void;
  onItemCategoryChange: (itemId: string, categoryId: string | null) => void;
}) {
  // A single NF paid in installments allocates only PART of its total to this
  // transaction; the value is editable so the user can split it. Order groups
  // sum several NFs at their full value and aren't individually editable.
  const openBalance = c.remainingValue ?? c.totalValue;
  // The NF was already partially paid by OTHER transactions (a prior parcela).
  const alreadyPaid = !c.isOrderGroup && openBalance + 0.05 < c.totalValue;
  // This transaction is covering only part of the NF's open balance.
  const isPartial =
    !c.isOrderGroup && allocation != null && allocation + 0.05 < openBalance;
  // The "Valor a alocar" input is only needed when the NF must be SPLIT — an
  // installment: the note is worth more than this single payment (or was already
  // partly paid by another transaction). Otherwise the allocation is simply the
  // full note value (auto), so the input is hidden to keep the flow clean.
  const showAllocationInput =
    !c.isOrderGroup && (alreadyPaid || openBalance > txAmount + 0.05);
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
        <div className="flex items-center gap-2.5">
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
            <Badge variant={getConfidenceBadgeVariant(c.confidence)}>
              {c.confidence}%
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
      </div>

      {/* Services / items of the NF, with per-line category combobox. When
          selected, the amount allocated to THIS transaction is editable below —
          defaulting to the NF total, or to the remaining payment when the NF is
          worth more than the payment (installment / parcela). */}
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

      {/* Editable allocation — how much of this payment settles this NF. Enables
          linking one NF across several installment transactions: each pays a
          PARTIAL slice of the same NF. Order groups link at their full summed
          value, so no per-NF input. Stops propagation so editing doesn't toggle. */}
      {checked && showAllocationInput && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 border-t border-border bg-muted/10",
            alreadyPaid && "border-t-0",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Valor a alocar
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                type="number"
                step={0.01}
                min={0}
                max={openBalance}
                value={allocation ?? ""}
                onChange={(v) => {
                  const n = v === "" || v == null ? 0 : Number(v);
                  onAllocationChange(Number.isFinite(n) ? n : 0);
                }}
                className="h-8 w-32 pl-8 text-right tabular-nums"
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              de {formatCurrency(openBalance)}
              {alreadyPaid ? " em aberto" : ""}
            </span>
          </div>
          {isPartial && (
            <Badge
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
              title="Esta transação paga apenas parte do saldo em aberto desta nota (parcela). O restante fica em aberto para as demais parcelas."
            >
              Parcial · resta {formatCurrency(openBalance - (allocation ?? 0))}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
