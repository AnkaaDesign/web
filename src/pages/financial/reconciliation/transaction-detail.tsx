import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconAlertCircle,
  IconArrowsExchange2,
  IconBuildingBank,
  IconDeviceFloppy,
  IconLoader2,
  IconTag,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import {
  useBankTransaction,
  useChangeCategory,
  useMatchCandidates,
  useUnmatchTransaction,
} from "@/hooks/financial/use-reconciliation";
import { useReceivableCandidates } from "@/hooks/financial/use-receivable";
import { CategoryEditor } from "@/components/financial/reconciliation/category-editor";
import {
  formatAccountNumber,
  formatCnpjCpf,
  formatCurrency,
  formatDate,
} from "@/utils";
import { cn } from "@/lib/utils";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { MatchStatusBadge } from "@/components/financial/reconciliation/match-status-badge";
import {
  TransactionMatchSection,
  type MatchSaveState,
} from "@/components/financial/reconciliation/transaction-match-section";
import { ReceivableMatchSection } from "@/components/financial/reconciliation/receivable-match-section";
import { UnmatchConfirmDialog } from "@/components/financial/reconciliation/unmatch-confirm-dialog";

// Module-scoped so it isn't redefined on every render (which would remount the
// whole subtree — including the stateful match section — and drop input focus).
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">{children}</div>
    </PrivilegeRoute>
  );
}

export function ReconciliationTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  usePageTracker({ title: "Detalhe da Transação", icon: "list" });

  const { data: tx, isLoading, error } = useBankTransaction(id);
  // Drive the status badge's "%" off the LIVE best candidate (deduped with the
  // match section's query) instead of the stored topMatchScore, which can go
  // stale. CREDITs are receivables (Installment pool, unified scorer); DEBITs are
  // NF candidates — use the matching pool so the badge agrees with the panel below.
  const isCreditTx = tx?.type === "CREDIT";
  const { data: liveNfCandidates } = useMatchCandidates(id, tx ? !isCreditTx : false);
  const { data: liveReceivableCandidates } = useReceivableCandidates(id, !!isCreditTx);
  const liveCandidatePool = isCreditTx ? liveReceivableCandidates : liveNfCandidates;
  const liveTopScore =
    liveCandidatePool && liveCandidatePool.length > 0 ? liveCandidatePool[0].confidence : null;
  const unmatchMut = useUnmatchTransaction();
  const changeCategoryMut = useChangeCategory();
  const [unmatchOpen, setUnmatchOpen] = useState(false);
  // Inline category selection (no-NF case). Seeded from the transaction's tags
  // and resynced whenever it refetches.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  useEffect(() => {
    setCategoryIds([...new Set(tx?.categories?.map(c => c.categoryId) ?? [])]);
  }, [tx?.id, tx?.categories]);
  // The match section reports its save-ability + allocation totals up so the
  // Salvar button and running "Alocado / Faltam" summary live in the header.
  const [matchState, setMatchState] = useState<MatchSaveState | null>(null);

  if (!id) return <Navigate to={routes.financial.reconciliation.statement} replace />;

  if (isLoading) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Frame>
    );
  }

  if (error || !tx) {
    return (
      <Frame>
        <Alert variant="destructive" className="mt-4">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>Não foi possível carregar a transação.</span>
            <button
              className="text-sm underline hover:text-foreground"
              onClick={() => navigate(routes.financial.reconciliation.statement)}
            >
              Voltar para a lista
            </button>
          </AlertDescription>
        </Alert>
      </Frame>
    );
  }

  const isCredit = tx.type === "CREDIT";
  const activeMatches = (tx.matches ?? []).filter(m => !m.reversedAt);
  const hasNf = activeMatches.length > 0;
  const title = `Transação ${formatDate(tx.postedAt)}`;

  // No-NF: picking categories saves immediately (no modal, no value split). The
  // full id set is authoritative; a resolving category auto-conciliates.
  const commitCategories = (ids: string[]) => {
    setCategoryIds(ids);
    changeCategoryMut.mutate({
      transactionId: tx.id,
      payload: { categoryIds: ids, saveAlias: true },
    });
  };

  return (
    <Frame>
      <PageHeader
        variant="detail"
        title={title}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          { label: "Conciliação Bancária", href: routes.financial.reconciliation.root },
          { label: "Extrato", href: routes.financial.reconciliation.statement },
          { label: title },
        ]}
        headerExtra={
          matchState ? (
            <span className="text-sm whitespace-nowrap mr-1">
              Alocado{" "}
              <strong className={matchState.valid ? "text-emerald-600" : "text-amber-600"}>
                {formatCurrency(matchState.allocated)}
              </strong>{" "}
              / {formatCurrency(matchState.target)}
              {matchState.selectedCount > 0 && !matchState.valid && (
                <span className="text-amber-600"> · Faltam {formatCurrency(matchState.missing)}</span>
              )}
            </span>
          ) : undefined
        }
        actions={
          matchState
            ? [
                {
                  key: "save",
                  label: matchState.label ?? "Salvar conciliação",
                  icon: IconDeviceFloppy,
                  onClick: () => matchState.save(),
                  disabled: !matchState.canSave,
                  loading: matchState.saving,
                  variant: "default" as const,
                },
              ]
            : []
        }
        className="flex-shrink-0"
      />

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4">
          {/* Resumo da transação + Categoria (left column) / Conta bancária (right, full height) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <div className="flex flex-col gap-4">
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <IconArrowsExchange2 className="h-5 w-5 text-muted-foreground" />
                      Resumo da transação
                    </CardTitle>
                    <MatchStatusBadge
                      status={tx.reconciliationStatus}
                      topMatchScore={liveTopScore}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground">Valor</span>
                      <span
                        className={cn(
                          "text-base font-bold tabular-nums",
                          isCredit ? "text-emerald-700" : "text-red-700",
                        )}
                      >
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <InfoRow label="Data" value={formatDate(tx.postedAt)} />
                    <InfoRow label="Forma" value={tx.subtype} />
                    <InfoRow
                      label="Contraparte"
                      value={
                        tx.counterpartyName ||
                        (tx.counterpartyCnpjCpf ? formatCnpjCpf(tx.counterpartyCnpjCpf) : null)
                      }
                    />
                    {tx.counterpartyName && tx.counterpartyCnpjCpf && (
                      <InfoRow label="CNPJ / CPF" value={formatCnpjCpf(tx.counterpartyCnpjCpf)} />
                    )}
                    {tx.ignoredReason && <InfoRow label="Motivo ignorado" value={tx.ignoredReason} />}
                    <InfoRow
                      label="Histórico"
                      value={tx.memo ? <span className="font-mono text-xs">{tx.memo}</span> : null}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Categoria — when an NF is linked the categories come from the
                  note's items (read-only here); otherwise it's set inline. */}
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconTag className="h-5 w-5 text-muted-foreground" />
                    Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {!hasNf && !tx.expectsFiscalDocument ? (
                    <CategoryEditor
                      transaction={tx}
                      value={categoryIds}
                      onChange={commitCategories}
                      enableSplit={false}
                      enableNotes={false}
                    />
                  ) : tx.categories && tx.categories.length > 0 ? (
                    <div className="space-y-3">
                      {tx.categories.map(t => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3"
                        >
                          {t.category?.color && (
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.category.color }}
                            />
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            {t.category?.name ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Definida pelas notas vinculadas.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border border-border h-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <IconBuildingBank className="h-5 w-5 text-muted-foreground" />
                  Conta bancária
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <InfoRow label="Banco" value={tx.bankName} />
                  <InfoRow label="Agência" value={tx.agency} />
                  <InfoRow
                    label="Conta"
                    value={tx.accountNumber ? formatAccountNumber(tx.accountNumber) : null}
                  />
                  <InfoRow label="FITID" value={<span className="font-mono text-xs">{tx.fitId}</span>} />
                  {tx.runningBalance != null && (
                    <InfoRow label="Saldo após" value={formatCurrency(tx.runningBalance)} />
                  )}
                  <InfoRow
                    label="Origem da conciliação"
                    value={
                      tx.reconciliationSource === "AUTO"
                        ? "Automática"
                        : tx.reconciliationSource === "MANUAL"
                          ? "Manual"
                          : null
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CREDIT → conciliar contra parcelas a receber (entrada). DEBIT →
              fluxo de notas fiscais existente (saída). */}
          {isCredit ? (
            <ReceivableMatchSection transaction={tx} onSaveStateChange={setMatchState} />
          ) : (
            <TransactionMatchSection
              transaction={tx}
              onRequestUnmatch={activeMatches.length > 0 ? () => setUnmatchOpen(true) : undefined}
              onSaveStateChange={setMatchState}
            />
          )}
        </div>
      </div>

      <UnmatchConfirmDialog
        open={unmatchOpen}
        onOpenChange={setUnmatchOpen}
        matchCount={activeMatches.length}
        isLoading={unmatchMut.isPending}
        onConfirm={() =>
          unmatchMut.mutate(tx.id, { onSuccess: () => setUnmatchOpen(false) })
        }
      />
    </Frame>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

export default ReconciliationTransactionDetailPage;
