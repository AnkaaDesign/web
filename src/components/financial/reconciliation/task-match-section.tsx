import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconAlertTriangle,
  IconExternalLink,
  IconFileInvoice,
  IconSearch,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReceivableMutations,
  useTaskMatchCandidates,
} from "@/hooks/financial/use-receivable";
import { useDebounce } from "@/hooks/common/use-debounce";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import { formatCnpjCpf, formatCurrency, formatDate } from "@/utils";
import type { BankTransaction } from "@/types/reconciliation";
import type {
  TaskBillingState,
  TaskMatchAllocation,
  TaskMatchCandidate,
} from "@/types/receivable";
import { getConfidenceBadgeVariant } from "./match-status-badge";
import type { MatchSaveState } from "./transaction-match-section";

/** Centavo drift, matching the server's tolerance. */
const TOLERANCE = 0.01;

const BILLING_STATE: Record<
  TaskBillingState,
  {
    label: string;
    variant: "secondary" | "warning" | "success" | "muted";
    hint: string;
    /** Verb for the header button — what saving will do to the orçamento. */
    action: string;
  }
> = {
  NO_QUOTE: {
    label: "Sem orçamento",
    variant: "warning",
    hint: "O orçamento será criado com este valor e conciliado com o crédito.",
    action: "Criar orçamento e conciliar",
  },
  QUOTE_UNBILLED: {
    label: "Não faturado",
    variant: "secondary",
    hint: "A fatura e a parcela serão geradas pelo valor do próprio orçamento.",
    action: "Faturar orçamento e conciliar",
  },
  QUOTE_OPEN: {
    label: "Parcela em aberto",
    variant: "success",
    hint: "O valor será alocado nas parcelas em aberto, da mais antiga para a mais nova.",
    action: "Conciliar com o orçamento",
  },
  QUOTE_SETTLED: {
    label: "Já liquidado",
    variant: "muted",
    hint: "O orçamento já está quitado; este crédito entra como uma nova parcela.",
    action: "Atualizar orçamento e conciliar",
  },
};

interface Selection {
  /** Free-text so the operator can clear the field while typing. */
  amount: string;
}

interface Props {
  transaction: BankTransaction;
  /**
   * Reports save-ability up so the page header owns the button, exactly like the
   * NF and parcela sections. Reports `null` while nothing is selected so this
   * section never steals the header from the parcela section beside it.
   */
  onSaveStateChange?: (state: MatchSaveState | null) => void;
  /** Credit already spoken for by the sibling parcela section, in reais. */
  allocatedElsewhere?: number;
}

/**
 * Conciliate a bank CREDIT by way of a **tarefa**, when its orçamento is missing.
 *
 * The money is always conciliated against the ORÇAMENTO — same as every other
 * receipt in the system, which anchors on the orçamento's parcela. The tarefa is
 * only the picker: for the jobs the migration left with no orçamento there is
 * nothing to pick, because with no orçamento there is no fatura and no parcela,
 * so `ReceivableMatchSection` has nothing to list. Choosing the tarefa here lets
 * the server build the missing orçamento (priced at the amount being
 * conciliated), materialize its fatura and parcela, and only then allocate.
 *
 * Choosing the SAME tarefa again for a later credit updates the orçamento that
 * already exists rather than creating a second one — `Task.quoteId` is 1:1, so
 * there can only ever be one.
 *
 * Tasks that already have an open parcela are deliberately NOT listed here:
 * those are the ordinary case and belong to the parcela section above. This
 * section only surfaces what that section structurally cannot reach.
 *
 * Both cardinalities are real and both are supported:
 *  - several tarefas on one credit (a lump PIX paying several jobs) — tick more
 *    than one row and split the amounts;
 *  - several credits on one orçamento (a job paid in parts) — conciliate each
 *    credit in turn; the parcela accrues and only flips to Pago when covered.
 */
export function TaskMatchSection({
  transaction,
  onSaveStateChange,
  allocatedElsewhere = 0,
}: Props) {
  const txId = transaction.id;
  const creditAmount = Math.abs(Number(transaction.amount));

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  // taskId -> selection (presence = selected).
  const [selections, setSelections] = useState<Record<string, Selection>>({});

  const { matchTasksMutation, matchTasksAsync } = useReceivableMutations();

  const isReconciled = transaction.reconciliationStatus === "RECONCILED";

  const { data: candidates, isLoading } = useTaskMatchCandidates(
    txId,
    debouncedSearch.trim() || undefined,
    open && !isReconciled,
  );

  // Keyed on the id, NOT the object — a background refetch yields a new
  // `transaction` reference for the same credit and must not wipe an
  // in-progress selection.
  useEffect(() => {
    setSelections({});
    setSearch("");
    setOpen(false);
  }, [transaction.id]);

  const candidateById = useMemo(() => {
    const m = new Map<string, TaskMatchCandidate>();
    (candidates ?? []).forEach((c) => m.set(c.taskId, c));
    return m;
  }, [candidates]);

  const entries = Object.entries(selections);
  const allocated = entries.reduce(
    (sum, [, s]) => sum + (parseFloat(s.amount) || 0),
    0,
  );

  /** What this credit still has to give, after the parcela section's claim. */
  const available = Math.max(0, creditAmount - allocatedElsewhere);
  const overCredit = allocated > available + TOLERANCE;
  const anyInvalid = entries.some(([, s]) => !(parseFloat(s.amount) > 0));

  /** Rows that would mint or grow a quote but have no customer to bill. */
  const missingCustomer = entries.filter(([taskId]) => {
    const c = candidateById.get(taskId);
    return c ? c.billingState === "NO_QUOTE" && !c.customerId : false;
  });

  const canSubmit =
    entries.length > 0 &&
    !overCredit &&
    !anyInvalid &&
    missingCustomer.length === 0 &&
    !matchTasksMutation.isPending;

  const toggle = (c: TaskMatchCandidate) =>
    setSelections((prev) => {
      if (prev[c.taskId] !== undefined) {
        const next = { ...prev };
        delete next[c.taskId];
        return next;
      }
      // Propose this task's share: never more than the credit still has, and
      // never more than the task can absorb without new capacity.
      const alreadyPicked = Object.entries(prev).reduce(
        (sum, [, s]) => sum + (parseFloat(s.amount) || 0),
        0,
      );
      const left = Math.max(0, available - alreadyPicked);
      const proposal = Math.min(left, c.suggestedAmount || left);
      return { ...prev, [c.taskId]: { amount: proposal.toFixed(2) } };
    });

  const setAmount = (taskId: string, value: string) =>
    setSelections((prev) => (prev[taskId] ? { ...prev, [taskId]: { amount: value } } : prev));

  const handleSubmit = async () => {
    const allocations: TaskMatchAllocation[] = entries.map(([taskId, s]) => {
      const c = candidateById.get(taskId);
      return {
        taskId,
        amount: parseFloat(s.amount),
        ...(c?.customerId ? { customerId: c.customerId } : {}),
      };
    });
    try {
      await matchTasksAsync({ transactionId: txId, allocations });
      setSelections({});
      setSearch("");
    } catch {
      // Errors are toasted by the API client.
    }
  };

  // Header wiring. saveRef keeps `save` stable so the effect deps stay primitive.
  const saveRef = useRef(handleSubmit);
  saveRef.current = handleSubmit;

  useEffect(() => {
    if (!onSaveStateChange) return;
    // Report nothing until the operator picks a task — otherwise this section
    // and the parcela section would fight over the single header slot.
    if (isReconciled || entries.length === 0) {
      onSaveStateChange(null);
      return;
    }
    onSaveStateChange({
      canSave: canSubmit,
      saving: matchTasksMutation.isPending,
      // Own share only — the page adds the parcela section's and decides
      // whether the credit is fully covered. Reporting the sum here would
      // double-count it once both sections are in play.
      allocated,
      target: creditAmount,
      missing: Math.abs(creditAmount - (allocated + allocatedElsewhere)),
      valid: Math.abs(creditAmount - (allocated + allocatedElsewhere)) <= TOLERANCE,
      selectedCount: entries.length,
      save: () => saveRef.current(),
      label:
        entries.length === 1
          ? (BILLING_STATE[candidateById.get(entries[0][0])?.billingState ?? "NO_QUOTE"].action)
          : `Conciliar ${entries.length} orçamentos`,
    });
  }, [
    onSaveStateChange,
    isReconciled,
    canSubmit,
    matchTasksMutation.isPending,
    allocated,
    allocatedElsewhere,
    creditAmount,
    entries.length,
    candidateById,
  ]);

  useEffect(() => () => onSaveStateChange?.(null), [onSaveStateChange]);

  if (isReconciled) return null;

  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base leading-none">Orçamento pela tarefa</CardTitle>
          {!open && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>
              <IconFileInvoice className="h-4 w-4 mr-1.5" />
              Localizar tarefa
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Para tarefas cujo orçamento se perdeu. Selecione a tarefa e o orçamento é criado
          com o valor conciliado; escolhendo a mesma tarefa em outro crédito, o orçamento
          existente é atualizado. Tarefas que já têm parcela em aberto ficam na lista de
          parcelas acima.
        </p>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 space-y-4">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(v) => setSearch(typeof v === "string" ? v : "")}
              placeholder="Buscar por nome, número de série, placa, chassi ou cliente..."
              className="pl-9"
            />
          </div>

          {overCredit && (
            <p className="text-xs tabular-nums text-destructive">
              Alocado {formatCurrency(allocated)} de {formatCurrency(available)} disponíveis —
              excede o saldo do crédito.
            </p>
          )}

          {missingCustomer.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <IconAlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">
                {missingCustomer.length === 1 ? "Uma tarefa selecionada não tem" : "Tarefas selecionadas não têm"}{" "}
                cliente cadastrado, então não há para quem faturar. Defina o cliente na tarefa
                antes de conciliar.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !candidates || candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {debouncedSearch.trim()
                ? "Nenhuma tarefa encontrada para esta busca."
                : "Nenhuma tarefa sem orçamento encontrada para o pagador deste crédito. Busque por nome, número de série, placa ou cliente."}
            </p>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => (
                <TaskCandidateRow
                  key={c.taskId}
                  candidate={c}
                  txPostedAt={transaction.postedAt}
                  selection={selections[c.taskId]}
                  onToggle={() => toggle(c)}
                  onAmountChange={(v) => setAmount(c.taskId, v)}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** Whole days between two dates. */
function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round(
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000,
  );
}

interface RowProps {
  candidate: TaskMatchCandidate;
  txPostedAt: string | Date;
  selection?: Selection;
  onToggle: () => void;
  onAmountChange: (value: string) => void;
}

/**
 * One task candidate. Mirrors the NF / parcela candidate cards: the whole card
 * is the hit target, a green 2px border marks selection, and every nested
 * control stops propagation so it doesn't toggle the row.
 */
function TaskCandidateRow({
  candidate: c,
  txPostedAt,
  selection,
  onToggle,
  onAmountChange,
}: RowProps) {
  const checked = selection !== undefined;
  const amount = parseFloat(selection?.amount ?? "") || 0;
  const state = BILLING_STATE[c.billingState];
  // What this credit adds beyond the parcelas that already exist — it becomes a
  // new serviço + a new parcela of exactly this value, so several credits on one
  // job each end up as their own parcela.
  const newParcela = checked ? Math.max(0, amount - c.openCapacity) : 0;

  const identity = [c.taskSerialNumber, c.plate].filter(Boolean).join(" · ");

  return (
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
      <div className="px-4 py-3 space-y-2.5">
        {/* Row 1 — identity + the shared date/gap/confidence/link cluster */}
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">
                {c.taskName || "Tarefa sem nome"}
              </span>
              <Badge variant={state.variant} size="sm">
                {state.label}
              </Badge>
              {c.budgetNumber != null && (
                <Badge variant="secondary" size="sm" className="font-mono">
                  Orç. {c.budgetNumber}
                </Badge>
              )}
            </div>
            {identity && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{identity}</p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            {c.referenceDate && (
              <>
                <span className="text-sm font-medium whitespace-nowrap">
                  {formatDate(c.referenceDate)}
                </span>
                <Badge variant="secondary" title="Diferença de dias para a transação">
                  {daysBetween(c.referenceDate, txPostedAt) === 0
                    ? "mesmo dia"
                    : `${daysBetween(c.referenceDate, txPostedAt)}d`}
                </Badge>
              </>
            )}
            <Badge variant={getConfidenceBadgeVariant(c.confidence)}>{c.confidence}%</Badge>
            <Link
              to={routes.production.schedule.details(c.taskId)}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              title="Ver tarefa"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              Ver Tarefa
            </Link>
          </div>
        </div>

        {/* Row 2 — the details strip, mirroring the parcela card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
          <Detail label="Cliente" value={c.customerName ?? "—"} />
          <Detail
            label="CNPJ/CPF"
            value={c.customerCnpjCpf ? formatCnpjCpf(c.customerCnpjCpf) : "—"}
          />
          <Detail
            label="Em aberto"
            value={c.openCapacity > 0 ? formatCurrency(c.openCapacity) : "—"}
          />
          <Detail
            label="Já conciliado"
            value={c.reconciledAmount > 0 ? formatCurrency(c.reconciledAmount) : "—"}
          />
        </div>

        <p className="text-xs text-muted-foreground">{c.reason}</p>

        {/* Row 3 — allocation controls, only once selected */}
        {checked && (
          <div
            className="flex flex-wrap items-center gap-3 pt-2 border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Valor</span>
              <Input
                type="currency"
                value={amount}
                onChange={(v) =>
                  onAmountChange(v == null || v === "" ? "" : String(v))
                }
                className="h-8 w-40 tabular-nums"
              />
            </div>

            <span className="text-xs text-muted-foreground">
              {newParcela > 0
                ? c.openCapacity > 0
                  ? `${formatCurrency(c.openCapacity)} vão para as parcelas em aberto; ` +
                    `${formatCurrency(newParcela)} viram uma nova parcela.`
                  : `Uma nova parcela de ${formatCurrency(newParcela)} será criada neste orçamento.`
                : state.hint}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
