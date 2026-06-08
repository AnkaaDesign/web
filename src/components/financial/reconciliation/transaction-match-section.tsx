import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconAlertTriangle,
  IconBrain,
  IconCircleCheck,
  IconExternalLink,
  IconLinkOff,
  IconStack2,
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
import { formatCNPJ, formatDate } from "@/utils";
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
        setAllocations((a) => ({ ...a, [id]: candidate.totalValue }));
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

  const existingMatches = useMemo(
    () => (transaction.matches ?? []).filter((m) => !m.reversedAt),
    [transaction],
  );
  const hasExistingMatch = existingMatches.length > 0;
  const existingAllocated = useMemo(
    () => existingMatches.reduce((sum, m) => sum + (m.allocatedAmount || 0), 0),
    [existingMatches],
  );
  const newlyAllocated = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (allocations[id] || 0), 0),
    [selectedIds, allocations],
  );
  const totalAllocated = existingAllocated + newlyAllocated;
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
                  : "Nenhuma candidata encontrada. Tente importar mais XMLs ou ampliar o período."}
              </p>
            ) : (
              <div className="space-y-6">
                {candidates.map((c) => (
                  <CandidateRow
                    key={c.fiscalDocumentId}
                    candidate={c}
                    checked={selectedIds.includes(c.fiscalDocumentId)}
                    onToggle={() => toggleSelect(c.fiscalDocumentId, c)}
                    onItemCategoryChange={handleItemCategory}
                  />
                ))}
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
  onToggle,
  onItemCategoryChange,
}: {
  candidate: MatchCandidate;
  checked: boolean;
  onToggle: () => void;
  onItemCategoryChange: (itemId: string, categoryId: string | null) => void;
}) {
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

      {/* Services / items of the NF, with per-line category combobox. The NF
          total (table footer) IS the amount allocated when selected. */}
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
    </div>
  );
}
