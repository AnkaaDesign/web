import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconBrain,
  IconCircleCheck,
  IconLinkOff,
  IconRefresh,
} from "@tabler/icons-react";
import {
  useChangeCategory,
  useMatchCandidates,
} from "@/hooks/financial/use-reconciliation";
import { routes } from "@/constants";
import { formatCNPJ, formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type { BankTransaction, MatchCandidate } from "@/types/reconciliation";
import type { ManualMatchPayload } from "@/schemas/reconciliation";
import { getConfidenceBadgeVariant } from "./match-status-badge";
import { CategoryEditor } from "./category-editor";
import { MatchCard } from "./match-card";
import { docTypeLabel, docTypeVariant } from "./fiscal-doc-badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onConfirm: (payload: ManualMatchPayload) => void;
  onRequestUnmatch?: () => void;
  isLoading?: boolean;
}

export function ManualMatchDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  onRequestUnmatch,
  isLoading,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  // Category state lives here and feeds both the (inline) CategoryEditor and
  // the unified save below.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoryAllocations, setCategoryAllocations] = useState<Record<string, number>>({});
  const [categoryNotes, setCategoryNotes] = useState("");
  const changeCategoryMut = useChangeCategory();

  const txId = transaction?.id;
  const txAmount = transaction ? Math.abs(transaction.amount) : 0;

  const { data: candidates, isLoading: candidatesLoading, refetch } = useMatchCandidates(
    txId,
    open,
  );

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setAllocations({});
      setNotes("");
    }
  }, [open]);

  // Seed the category editor from the transaction's current tags whenever the
  // dialog opens on a (new) transaction.
  useEffect(() => {
    if (open && transaction) {
      // Dedupe in case a category has both an AUTO and a MANUAL tag.
      setCategoryIds([
        ...new Set(transaction.categories?.map(c => c.categoryId) ?? []),
      ]);
      const seed: Record<string, number> = {};
      for (const c of transaction.categories ?? []) {
        if (c.allocatedAmount != null) seed[c.categoryId] = Math.abs(Number(c.allocatedAmount));
      }
      setCategoryAllocations(seed);
      setCategoryNotes("");
    }
  }, [open, transaction]);

  const toggleSelect = (id: string, candidate: MatchCandidate) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (!prev.includes(id)) {
        setAllocations(a => ({ ...a, [id]: candidate.totalValue }));
      } else {
        setAllocations(a => {
          const next = { ...a };
          delete next[id];
          return next;
        });
      }
      return next;
    });
  };

  // Non-reversed matches already persisted for this transaction.
  const existingMatches = useMemo(
    () => (transaction?.matches ?? []).filter(m => !m.reversedAt),
    [transaction],
  );
  const hasExistingMatch = existingMatches.length > 0;

  // Amount already covered by persisted (non-reversed) matches. The "Alocado"
  // total must include this so the remaining-to-allocate is correct for a
  // PARTIAL transaction, and so a fully-matched tx doesn't read R$ 0,00.
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
  const isValidAllocation = Math.abs(diff) <= 0.05;

  // A transaction is "fully reconciled" when the API marked it RECONCILED and
  // the existing non-reversed matches already cover the amount. Such a tx
  // shouldn't invite re-matching — we hide the candidate list/allocation UI and
  // show only the linked NF(s) + categories.
  const isFullyReconciled =
    transaction?.reconciliationStatus === "RECONCILED" &&
    hasExistingMatch &&
    existingAllocated + 0.05 >= txAmount;

  // The candidate/allocation UI is only meaningful while there's still work to
  // do — i.e. PENDING or PARTIAL transactions.
  const showCandidates =
    transaction?.reconciliationStatus === "PENDING" ||
    transaction?.reconciliationStatus === "PARTIAL";

  // Category set differs from what's currently persisted on the transaction?
  const currentCategoryIds = useMemo(
    () => (transaction?.categories ?? []).map(c => c.categoryId),
    [transaction],
  );
  const categoriesChanged = useMemo(() => {
    const a = [...categoryIds].sort();
    const b = [...currentCategoryIds].sort();
    return a.length !== b.length || a.some((id, i) => id !== b[i]);
  }, [categoryIds, currentCategoryIds]);

  // Per-category amounts differ from what's persisted (only relevant for >1).
  const allocationsChanged = useMemo(() => {
    if (categoryIds.length <= 1) return false;
    const cur = new Map(
      (transaction?.categories ?? []).map(c => [
        c.categoryId,
        c.allocatedAmount != null ? Math.round(Math.abs(Number(c.allocatedAmount)) * 100) / 100 : null,
      ]),
    );
    return categoryIds.some(
      id => Math.round((categoryAllocations[id] ?? 0) * 100) / 100 !== (cur.get(id) ?? null),
    );
  }, [categoryIds, categoryAllocations, transaction]);

  const hasMatchChanges = selectedIds.length > 0;
  const matchAllocationValid = !hasMatchChanges || isValidAllocation;
  const canSave =
    (hasMatchChanges && matchAllocationValid) || categoriesChanged || allocationsChanged;
  const saving = !!isLoading || changeCategoryMut.isPending;

  // Unified save: persist NF allocations (if any selected) AND the category
  // selection (if it changed). Toasts are emitted by the axios interceptor —
  // do NOT toast here. Closes once both writes settle.
  const handleSave = () => {
    if (!transaction) return;
    if (hasMatchChanges && !isValidAllocation) return;

    const saveCategoriesThenClose = (afterClose?: () => void) => {
      if (!categoriesChanged && !allocationsChanged) {
        afterClose?.();
        return;
      }
      changeCategoryMut.mutate(
        {
          transactionId: transaction.id,
          payload: {
            categoryIds,
            allocations:
              categoryIds.length > 1
                ? categoryIds.map(id => ({
                    categoryId: id,
                    allocatedAmount: categoryAllocations[id] ?? 0,
                  }))
                : undefined,
            // Always learn an alias from a manual categorization.
            saveAlias: true,
            notes: categoryNotes.trim() || undefined,
          },
        },
        { onSuccess: () => afterClose?.() },
      );
    };

    if (hasMatchChanges) {
      // onConfirm owns the match mutation (and closing the dialog). Persist
      // categories alongside it; the parent closes on the match success.
      const payload: ManualMatchPayload = {
        fiscalDocumentIds: selectedIds,
        allocations: selectedIds.map(id => ({
          fiscalDocumentId: id,
          amount: allocations[id] || 0,
        })),
        notes: notes || undefined,
      };
      saveCategoriesThenClose();
      onConfirm(payload);
      return;
    }

    // Categories-only change: save and close ourselves.
    saveCategoriesThenClose(() => onOpenChange(false));
  };

  const isLikelyTax =
    !!transaction?.memo &&
    /DARF|ARRECADAC|TRIBUTO|IMPOSTO|TARIFA|TAR\.BANC|TAR BANC|\bIOF\b/i.test(transaction.memo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Conciliar transação</DialogTitle>
          <DialogDescription>
            Selecione as notas fiscais que correspondem a esta movimentação bancária.
          </DialogDescription>
        </DialogHeader>

        {transaction && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Transação
              </span>
              <Badge variant={transaction.type === "CREDIT" ? "completed" : "cancelled"} size="sm">
                {transaction.type === "CREDIT" ? "Crédito" : "Débito"}
              </Badge>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-base">{formatDate(transaction.postedAt)}</span>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(txAmount)}</span>
            </div>
            {transaction.memo && (
              <p className="text-xs text-muted-foreground">{transaction.memo}</p>
            )}
            {transaction.counterpartyCnpjCpf && (
              <p className="text-xs">
                <span className="text-muted-foreground">Contraparte:</span>{" "}
                <span className="font-medium">
                  {transaction.counterpartyName ||
                    formatCnpjCpf(transaction.counterpartyCnpjCpf)}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Categorias — inline, always visible. The editor is controlled by the
            dialog's category state and persisted by the unified save below. */}
        {transaction && (
          <div className="space-y-3">
            <CategoryEditor
              transaction={transaction}
              value={categoryIds}
              onChange={setCategoryIds}
              notes={categoryNotes}
              onNotesChange={setCategoryNotes}
              allocations={categoryAllocations}
              onAllocationsChange={setCategoryAllocations}
            />
          </div>
        )}

        {isLikelyTax && !hasExistingMatch && (
          <div className="rounded-md border border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/10 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Movimentação tributária ou tarifária
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              DARF, IOF, tarifas bancárias e tributos não exigem conciliação com NFe. Sugerimos
              marcar como "Ignorar" e descrever o motivo.
            </p>
          </div>
        )}

        {hasExistingMatch && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Notas vinculadas a esta transação
              </p>
              {onRequestUnmatch && (
                <Button variant="destructive" size="sm" onClick={onRequestUnmatch}>
                  <IconLinkOff className="h-4 w-4 mr-1.5" /> Desvincular
                </Button>
              )}
            </div>
            <ul className="space-y-2">
              {existingMatches.map(m => {
                const doc = m.fiscalDocument;
                const slip = m.bankSlip;
                const nfHref = doc?.id
                  ? `${routes.financial.reconciliation.fiscalDocuments}?nfId=${doc.id}`
                  : null;
                const inner = (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {doc?.docType && (
                          <Badge size="sm" variant={docTypeVariant(doc.docType)}>
                            {docTypeLabel(doc.docType)}
                          </Badge>
                        )}
                        <span className="font-medium truncate">
                          {doc?.emitName ||
                            (doc?.emitCnpj
                              ? formatCNPJ(doc.emitCnpj)
                              : slip
                                ? `Boleto ${slip.nossoNumero}`
                                : "—")}
                        </span>
                        <Badge size="sm" variant={getConfidenceBadgeVariant(m.confidenceScore)}>
                          {m.confidenceScore}%
                        </Badge>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(m.allocatedAmount)}
                      </span>
                    </div>
                    {doc?.issueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Emissão {formatDate(doc.issueDate)}
                        {typeof doc.totalValue === "number" &&
                          doc.totalValue > 0 &&
                          ` • Valor da NF ${formatCurrency(doc.totalValue)}`}
                      </p>
                    )}
                    {doc?.accessKey && (
                      <p className="text-[10px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                        {doc.accessKey}
                      </p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{m.notes}</p>
                    )}
                  </>
                );

                if (nfHref) {
                  return (
                    <li key={m.id}>
                      <MatchCard to={nfHref} linkLabel="nota fiscal">
                        {inner}
                      </MatchCard>
                    </li>
                  );
                }
                // Boleto-only match has no NF detail to open — render the same
                // card shell without the navigation affordance.
                return (
                  <li
                    key={m.id}
                    className="rounded-md bg-background/70 dark:bg-background/40 border border-emerald-500/30 p-3 text-sm"
                  >
                    {inner}
                  </li>
                );
              })}
            </ul>
            {isFullyReconciled && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                <IconCircleCheck className="h-4 w-4" />
                Conciliação completa
              </p>
            )}
          </div>
        )}

        {/* Candidate list + allocation — only while there's work to do
            (PENDING / PARTIAL). A fully auto-matched transaction hides this. */}
        {showCandidates && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {hasExistingMatch ? "Adicionar outra nota" : "Notas fiscais candidatas"}
              </p>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <IconRefresh className="h-4 w-4 mr-1" /> Atualizar
              </Button>
            </div>

            <div className="border border-border/60 rounded-md max-h-80 overflow-y-auto divide-y divide-border/40">
              {candidatesLoading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !candidates || candidates.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {isLikelyTax
                    ? "Sem candidatas — esta transação não exige conciliação fiscal."
                    : "Nenhuma candidata encontrada. Tente importar mais XMLs ou ampliar o período."}
                </p>
              ) : (
                candidates.map(c => {
                  const checked = selectedIds.includes(c.fiscalDocumentId);
                  // Surface alias-assisted matches with a distinct badge so users
                  // see when the learning system is the reason a candidate ranks
                  // high. The backend writes "Memo reconhecido (Nx confirmado)"
                  // into the rationale string when an alias contributed.
                  const aliasMatch = c.rationale?.match(/Memo reconhecido \((\d+)× confirmado\)/);
                  return (
                    <label
                      key={c.fiscalDocumentId}
                      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(c.fiscalDocumentId, c)}
                        className="mt-1.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge size="sm" variant={docTypeVariant(c.docType)}>
                            {docTypeLabel(c.docType)}
                          </Badge>
                          <span className="font-medium truncate">
                            {c.emitName || (c.emitCnpj ? formatCNPJ(c.emitCnpj) : "—")}
                          </span>
                          <Badge size="sm" variant={getConfidenceBadgeVariant(c.confidence)}>
                            {c.confidence}%
                          </Badge>
                          {aliasMatch && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-300/60 dark:border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              title={`Sugerido pelo histórico — esta combinação já foi conciliada ${aliasMatch[1]}× antes`}
                            >
                              <IconBrain className="h-3 w-3" />
                              Aprendido {aliasMatch[1]}×
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(c.issueDate)} • {formatCurrency(c.totalValue)} • {c.rationale}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5 truncate">
                          {c.accessKey}
                        </p>
                      </div>
                      {checked && (
                        <div className="w-40">
                          <Label className="text-xs">Alocação</Label>
                          <Input
                            type="currency"
                            value={allocations[c.fiscalDocumentId] ?? 0}
                            onChange={v =>
                              setAllocations(a => ({
                                ...a,
                                [c.fiscalDocumentId]: typeof v === "number" ? v : 0,
                              }))
                            }
                            transparent
                          />
                        </div>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>
                Alocado:{" "}
                <strong
                  className={
                    isValidAllocation
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }
                >
                  {formatCurrency(totalAllocated)}
                </strong>{" "}
                / {formatCurrency(txAmount)}
              </span>
              {!isValidAllocation && (selectedIds.length > 0 || hasExistingMatch) && (
                <Badge variant="pending" size="sm">
                  Diferença: {formatCurrency(diff)}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">
                Observações (opcional)
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={v => setNotes(typeof v === "string" ? v : "")}
                maxLength={500}
                placeholder="Anotações para auditoria"
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
