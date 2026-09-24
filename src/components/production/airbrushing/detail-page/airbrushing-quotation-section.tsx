// Seção "Cotação" do detalhe da aerografia — o lado do comercial da negociação.
//
// Uma aerografia criada sem aerografista nasce Em Cotação: cada aerografista abre UMA
// negociação (AirbrushingQuote) com VALOR + TEMPO DE EXECUÇÃO, e o comercial compara,
// contrapropõe ou seleciona. A contraproposta é da COTAÇÃO: uma só, para todos que têm
// proposta aguardando resposta (valor, tempo ou os dois — o que ficar em branco continua o
// de cada um). Aceitar NÃO é ser selecionado — só "Selecionar" grava aerografista, valor e
// tempo (os da negociação, nunca digitados), encerra as demais e leva a aerografia para Em
// Preparação. Depois de encerrada, a seção fica como histórico somente leitura.
//
// As regras de quem pode o quê espelham utils/airbrushing-quote.ts da API; a API valida
// de novo, isto só evita oferecer o botão que devolveria 400.

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconArrowRight,
  IconArrowsExchange,
  IconCalendarCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClockHour4,
  IconHandFinger,
  IconLoader2,
  IconMessage,
  IconReceipt2,
  IconTrophy,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatarDisplay } from "@/components/ui/avatar-display";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { usePricingVisible } from "@/hooks/common/use-pricing-visible";
import { useAirbrushingQuotes, useCounterAllAirbrushingQuotes, useSelectAirbrushingQuote } from "@/hooks/production/use-airbrushing-quote";
import { airbrushingKeys } from "@/hooks/common/query-keys";
import { airbrushingQuoteCounterAllSchema, type AirbrushingQuoteCounterAllFormData } from "@/schemas/airbrushing-quote";
import { ExecutionTimeInput } from "@/components/production/airbrushing/form/execution-time-input";
import {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_QUOTE_STATUS,
  AIRBRUSHING_QUOTE_STATUS_LABELS,
  AIRBRUSHING_QUOTE_ACTION,
  AIRBRUSHING_QUOTE_ACTION_LABELS,
  AIRBRUSHING_QUOTE_PARTY,
  ENTITY_BADGE_CONFIG,
  EXECUTION_TIME_UNIT,
} from "@/constants";
import { formatCurrency } from "@/utils/number";
import { formatExecutionTime, formatExpectedFinishDate, formatQuoteTerms } from "@/utils/airbrushing";
import { formatDateTime, formatRelativeTime } from "@/utils/date";
import type { Airbrushing, AirbrushingQuote, AirbrushingQuoteEvent, File as AnkaaFile } from "@/types";

// =====================
// Regras (espelham utils/airbrushing-quote.ts da API)
// =====================

/** Vez do comercial: há um valor que o aerografista sustenta — dá para selecionar. */
const SELECTABLE = new Set<AIRBRUSHING_QUOTE_STATUS>([AIRBRUSHING_QUOTE_STATUS.PROPOSED, AIRBRUSHING_QUOTE_STATUS.ACCEPTED]);
/**
 * Quem a contraproposta para todos alcança: a proposta do aerografista aguardando resposta
 * (PROPOSED) ou a própria contraproposta em revisão (COUNTERED). Quem já ACEITOU fica de fora
 * — as condições estão combinadas e o que resta é selecionar — espelha canCompanyCounter da API.
 */
const COUNTERABLE = new Set<AIRBRUSHING_QUOTE_STATUS>([AIRBRUSHING_QUOTE_STATUS.PROPOSED, AIRBRUSHING_QUOTE_STATUS.COUNTERED]);
/** Selecionar aparece também em COUNTERED, desabilitado com o motivo — a vez é dele. */
const SELECT_SHOWN = new Set<AIRBRUSHING_QUOTE_STATUS>([...SELECTABLE, AIRBRUSHING_QUOTE_STATUS.COUNTERED]);

/** Ordem da comparação: o fechado primeiro, depois o que pede ação, depois o resto. */
const STATUS_RANK: Record<AIRBRUSHING_QUOTE_STATUS, number> = {
  [AIRBRUSHING_QUOTE_STATUS.SELECTED]: 0,
  [AIRBRUSHING_QUOTE_STATUS.PROPOSED]: 1,
  [AIRBRUSHING_QUOTE_STATUS.ACCEPTED]: 1,
  [AIRBRUSHING_QUOTE_STATUS.COUNTERED]: 2,
  [AIRBRUSHING_QUOTE_STATUS.NOT_SELECTED]: 3,
  [AIRBRUSHING_QUOTE_STATUS.DECLINED]: 4,
};

/** O que o valor exibido significa em cada estado — o mesmo número muda de dono. */
const AMOUNT_CAPTION: Record<AIRBRUSHING_QUOTE_STATUS, string> = {
  [AIRBRUSHING_QUOTE_STATUS.PROPOSED]: "Proposta do aerografista",
  [AIRBRUSHING_QUOTE_STATUS.COUNTERED]: "Sua contraproposta — aguardando resposta",
  [AIRBRUSHING_QUOTE_STATUS.ACCEPTED]: "Contraproposta aceita por ele",
  [AIRBRUSHING_QUOTE_STATUS.DECLINED]: "Último valor antes da recusa",
  [AIRBRUSHING_QUOTE_STATUS.SELECTED]: "Valor fechado",
  [AIRBRUSHING_QUOTE_STATUS.NOT_SELECTED]: "Último valor negociado",
};

const painterName = (quote: AirbrushingQuote): string => quote.painter?.name ?? "Aerografista";

/** "R$ 820,00 · 2 dias" — negociação anterior ao tempo de execução mostra só o valor. */
const termsOf = (quote: { amount: number | null; executionTime?: number | null; executionTimeUnit?: string | null }, separator?: string): string =>
  formatQuoteTerms(quote.amount, quote.executionTime, quote.executionTimeUnit as EXECUTION_TIME_UNIT | null | undefined, separator) || "—";

/** Ações em que o aerografista diz as PRÓPRIAS condições (o aceite carrega as que ele topou). */
const PAINTER_ASK_ACTIONS = new Set<AIRBRUSHING_QUOTE_ACTION>([AIRBRUSHING_QUOTE_ACTION.PROPOSAL, AIRBRUSHING_QUOTE_ACTION.COUNTER, AIRBRUSHING_QUOTE_ACTION.ACCEPT]);

interface PainterAsksSummary {
  count: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  /** "2,5 dias" / "8 horas" — vazio quando nenhum pedido tem tempo (negociações antigas). */
  averageTime: string;
}

const formatDecimal = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

/**
 * Média das propostas — a MESMA regra no web e no app: para cada negociação que não foi
 * recusada, o último pedido DO AEROGRAFISTA (evento dele de proposta, contraproposta ou aceite)
 * que tenha valor. A média do tempo converte tudo para horas (1 dia = 24 h) só para a conta e
 * mostra em dias se todos os pedidos foram em dias; senão, em horas.
 */
const summarizePainterAsks = (quotes: AirbrushingQuote[]): PainterAsksSummary | null => {
  const asks: AirbrushingQuoteEvent[] = [];
  for (const quote of quotes) {
    if (quote.status === AIRBRUSHING_QUOTE_STATUS.DECLINED) continue;
    const events = quote.events ?? [];
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event.party === AIRBRUSHING_QUOTE_PARTY.PAINTER && PAINTER_ASK_ACTIONS.has(event.action) && event.amount != null) {
        asks.push(event);
        break;
      }
    }
  }
  if (asks.length === 0) return null;

  const amounts = asks.map((a) => a.amount as number);
  const timed = asks.filter((a) => a.executionTime && a.executionTimeUnit);
  let averageTime = "";
  if (timed.length > 0) {
    const hours = timed.map((a) => (a.executionTimeUnit === EXECUTION_TIME_UNIT.HOURS ? (a.executionTime as number) : (a.executionTime as number) * 24));
    const avgHours = hours.reduce((sum, h) => sum + h, 0) / hours.length;
    const allDays = timed.every((a) => a.executionTimeUnit === EXECUTION_TIME_UNIT.DAYS);
    const value = allDays ? avgHours / 24 : avgHours;
    const shown = formatDecimal(value);
    const one = Math.round(value * 10) / 10 === 1;
    averageTime = `${shown} ${allDays ? (one ? "dia" : "dias") : one ? "hora" : "horas"}`;
  }

  return {
    count: asks.length,
    averageAmount: amounts.reduce((sum, a) => sum + a, 0) / amounts.length,
    minAmount: Math.min(...amounts),
    maxAmount: Math.max(...amounts),
    averageTime,
  };
};

/** Duração em horas, para comparar prazos em unidades diferentes (dias contam 24h). */
const durationHours = (quote: AirbrushingQuote): number | null => {
  if (!quote.executionTime || !quote.executionTimeUnit) return null;
  return quote.executionTimeUnit === EXECUTION_TIME_UNIT.HOURS ? quote.executionTime : quote.executionTime * 24;
};

/**
 * Condições de uma negociação depois da contraproposta — o que a empresa mandou vence, o
 * que ficou em branco continua o que estava em jogo. Espelha mergeCounterTerms da API.
 */
const mergeCounterTerms = (
  quote: AirbrushingQuote,
  counter: { amount?: number | null; executionTime?: number | null; executionTimeUnit?: string | null },
): { amount: number | null; executionTime: number | null; executionTimeUnit: string | null } => {
  const changesTime = counter.executionTime != null && counter.executionTimeUnit != null;
  return {
    amount: counter.amount != null ? counter.amount : quote.amount,
    executionTime: changesTime ? counter.executionTime! : (quote.executionTime ?? null),
    executionTimeUnit: changesTime ? counter.executionTimeUnit! : (quote.executionTimeUnit ?? null),
  };
};

/** Avatar a partir só do `avatarId` — a API manda o id, não o File inteiro. */
const avatarFile = (avatarId: string | null | undefined): AnkaaFile | null => (avatarId ? ({ id: avatarId } as AnkaaFile) : null);

const lastNoteOf = (quote: AirbrushingQuote): AirbrushingQuoteEvent | null => {
  const events = quote.events ?? [];
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].note) return events[i];
  }
  return null;
};

// =====================
// Seção
// =====================

interface AirbrushingQuotationSectionProps {
  airbrushing: Airbrushing;
  /** ADMIN/COMMERCIAL: contrapropor e selecionar. FINANCIAL só vê. */
  canAct: boolean;
}

export function AirbrushingQuotationSection({ airbrushing, canAct }: AirbrushingQuotationSectionProps) {
  // Dinheiro renderizado por fora de campo `money` — assina o "mostrar/ocultar valores".
  void usePricingVisible();
  const queryClient = useQueryClient();

  const detailIsQuoting = airbrushing.status === AIRBRUSHING_STATUS.QUOTING;
  const { data, isLoading, isError } = useAirbrushingQuotes(airbrushing.id, { polling: detailIsQuoting });
  const overview = data?.data;

  // O polling pode descobrir antes do detalhe que a cotação acabou (outro usuário
  // selecionou ou cancelou): o detalhe — status, pintor, valor — também envelheceu.
  const overviewStatus = overview?.airbrushing.status;
  useEffect(() => {
    if (overviewStatus && overviewStatus !== airbrushing.status) {
      queryClient.invalidateQueries({ queryKey: airbrushingKeys.all });
    }
  }, [overviewStatus, airbrushing.status, queryClient]);

  const isOpen = (overviewStatus ?? airbrushing.status) === AIRBRUSHING_STATUS.QUOTING;
  const quotes = useMemo(() => overview?.quotes ?? [], [overview?.quotes]);
  const pendingPainters = overview?.pendingPainters ?? [];

  const sorted = useMemo(
    () =>
      [...quotes].sort((a, b) => {
        const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rank !== 0) return rank;
        return (a.amount ?? Number.POSITIVE_INFINITY) - (b.amount ?? Number.POSITIVE_INFINITY);
      }),
    [quotes],
  );

  const counts = useMemo(() => {
    const by = (status: AIRBRUSHING_QUOTE_STATUS) => quotes.filter((q) => q.status === status).length;
    return {
      proposals: quotes.filter((q) => q.amount != null).length,
      awaitingCompany: by(AIRBRUSHING_QUOTE_STATUS.PROPOSED) + by(AIRBRUSHING_QUOTE_STATUS.ACCEPTED),
      awaitingPainter: by(AIRBRUSHING_QUOTE_STATUS.COUNTERED),
      declined: by(AIRBRUSHING_QUOTE_STATUS.DECLINED),
    };
  }, [quotes]);

  // Menor valor que dá para fechar AGORA — é a comparação que importa para o comercial.
  const lowestSelectableId = useMemo(() => {
    if (!isOpen) return null;
    let best: AirbrushingQuote | null = null;
    for (const q of quotes) {
      if (!SELECTABLE.has(q.status) || q.amount == null) continue;
      if (!best || q.amount < (best.amount ?? Number.POSITIVE_INFINITY)) best = q;
    }
    return best?.id ?? null;
  }, [quotes, isOpen]);

  // Menor prazo entre os que dá para fechar — o valor mais baixo nem sempre é o que entrega antes.
  const fastestSelectableId = useMemo(() => {
    if (!isOpen) return null;
    let best: AirbrushingQuote | null = null;
    let bestHours = Number.POSITIVE_INFINITY;
    for (const q of quotes) {
      const hours = durationHours(q);
      if (!SELECTABLE.has(q.status) || hours == null) continue;
      if (hours < bestHours) {
        best = q;
        bestHours = hours;
      }
    }
    return best?.id ?? null;
  }, [quotes, isOpen]);

  const asksSummary = useMemo(() => summarizePainterAsks(quotes), [quotes]);

  // Quem a contraproposta para todos alcança agora.
  const counterTargets = useMemo(() => (isOpen ? quotes.filter((q) => COUNTERABLE.has(q.status)) : []), [quotes, isOpen]);
  const acceptedCount = useMemo(() => quotes.filter((q) => q.status === AIRBRUSHING_QUOTE_STATUS.ACCEPTED).length, [quotes]);

  const selected = quotes.find((q) => q.status === AIRBRUSHING_QUOTE_STATUS.SELECTED) ?? null;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (quoteId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });

  const [counterAllOpen, setCounterAllOpen] = useState(false);
  const [selectTarget, setSelectTarget] = useState<AirbrushingQuote | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        Carregando cotação...
      </div>
    );
  }

  if (isError || !overview) {
    return <p className="py-4 text-sm text-muted-foreground">Não foi possível carregar a cotação desta aerografia.</p>;
  }

  const openedAt = overview.airbrushing.quotationOpenedAt;
  const closedAt = overview.airbrushing.quotationClosedAt;
  const notifiedAt = overview.airbrushing.quotationNotifiedAt;
  // A visão da cotação traz o início e o orçamento; o detalhe é o reserva (API antiga).
  const startDate = overview.airbrushing.startDate ?? airbrushing.startDate ?? null;
  const offerAmount = overview.airbrushing.quotationOfferAmount ?? airbrushing.quotationOfferAmount ?? null;
  const offerTime = overview.airbrushing.quotationOfferExecutionTime ?? airbrushing.quotationOfferExecutionTime ?? null;
  const offerUnit = overview.airbrushing.quotationOfferExecutionTimeUnit ?? airbrushing.quotationOfferExecutionTimeUnit ?? null;
  const showRowActions = canAct && isOpen;

  return (
    <div className="space-y-4">
      {/* ---------- Cabeçalho: estado da cotação ---------- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={isOpen ? "indigo" : "gray"}>{isOpen ? "Cotação aberta" : "Cotação encerrada"}</Badge>
        {isOpen && openedAt && (
          <span className="text-sm text-muted-foreground" title={formatDateTime(openedAt)}>
            Aberta {formatRelativeTime(openedAt)}
          </span>
        )}
        {!isOpen && closedAt && <span className="text-sm text-muted-foreground">Encerrada em {formatDateTime(closedAt)}</span>}
        {isOpen && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <IconClockHour4 className="h-3.5 w-3.5" />
            Atualiza sozinha a cada 20 segundos
          </span>
        )}
      </div>

      {/* Orçamento de abertura — o ponto de partida que todos receberam. */}
      {offerAmount != null && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm">
          <IconReceipt2 className="h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="text-muted-foreground">Orçamento enviado:</span>
          <span className="font-semibold tabular-nums">{termsOf({ amount: offerAmount, executionTime: offerTime, executionTimeUnit: offerUnit }, " em ")}</span>
          {!offerTime && <span className="text-xs text-muted-foreground">(o tempo fica com cada aerografista)</span>}
        </div>
      )}

      {isOpen ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Propostas" value={counts.proposals} />
          <StatTile label="Aguardando você" value={counts.awaitingCompany} highlight={counts.awaitingCompany > 0} />
          <StatTile label="Aguardando aerografista" value={counts.awaitingPainter} />
          <StatTile label="Recusaram" value={counts.declined} />
        </div>
      ) : (
        selected && (
          <div className="flex items-center gap-3 rounded-lg border border-green-600/30 bg-green-600/10 p-3 text-sm">
            <IconTrophy className="h-5 w-5 flex-shrink-0 text-green-700 dark:text-green-400" />
            <span>
              <span className="font-semibold">{painterName(selected)}</span> foi selecionado por{" "}
              <span className="font-semibold tabular-nums">{termsOf(selected, " em ")}</span>.
            </span>
          </div>
        )
      )}

      {/* ---------- Média das propostas (o que os aerografistas pediram) ---------- */}
      {asksSummary && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Média das propostas</p>
            <p className="leading-tight tabular-nums">
              <span className="text-2xl font-semibold">{formatCurrency(asksSummary.averageAmount)}</span>
              {asksSummary.averageTime && <span className="text-sm font-medium text-muted-foreground"> · {asksSummary.averageTime}</span>}
            </p>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Média de {asksSummary.count} {asksSummary.count === 1 ? "proposta" : "propostas"}
            {asksSummary.count > 1 && asksSummary.minAmount !== asksSummary.maxAmount && (
              <>
                {" · "}de {formatCurrency(asksSummary.minAmount)} a {formatCurrency(asksSummary.maxAmount)}
              </>
            )}
          </p>
        </div>
      )}

      {/* ---------- Quem ainda não respondeu ---------- */}
      {isOpen && pendingPainters.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aguardando resposta de</p>
          <div className="flex flex-wrap gap-2">
            {pendingPainters.map((painter) => (
              <span key={painter.id} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-0.5 pl-0.5 pr-2.5 text-xs">
                <UserAvatarDisplay avatar={avatarFile(painter.avatarId)} userName={painter.name} size="xs" shape="circle" bordered={false} />
                {painter.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Comparação das negociações ---------- */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {isOpen ? (
            <>
              <IconUsersGroup className="mx-auto mb-2 h-6 w-6" />
              Nenhuma proposta recebida ainda.{" "}
              {notifiedAt ? `Os aerografistas foram avisados ${formatRelativeTime(notifiedAt)}.` : "Os aerografistas serão avisados em instantes."}
            </>
          ) : (
            "Nenhum aerografista participou desta cotação."
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Barra da lista: a contraproposta é UMA ação da cotação, para todos de uma vez. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Propostas ({sorted.length})</p>
            {showRowActions && (
              <ActionWithReason reason={counterTargets.length === 0 ? "Nenhuma proposta aguardando resposta" : null}>
                <Button type="button" variant="outline" size="sm" onClick={() => setCounterAllOpen(true)} disabled={counterTargets.length === 0}>
                  <IconArrowsExchange className="mr-1.5 h-4 w-4" />
                  Contraproposta para todos ({counterTargets.length})
                </Button>
              </ActionWithReason>
            )}
          </div>
          {sorted.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              isOpen={isOpen}
              canAct={canAct}
              startDate={startDate}
              isLowest={quote.id === lowestSelectableId && counts.awaitingCompany > 1}
              isFastest={quote.id === fastestSelectableId && counts.awaitingCompany > 1}
              expanded={expanded.has(quote.id)}
              onToggle={() => toggleExpanded(quote.id)}
              onSelect={() => setSelectTarget(quote)}
            />
          ))}
        </div>
      )}

      <CounterAllQuotesDialog
        open={counterAllOpen}
        airbrushingId={airbrushing.id}
        targets={counterTargets}
        acceptedCount={acceptedCount}
        startDate={startDate}
        onClose={() => setCounterAllOpen(false)}
      />
      <SelectQuoteDialog quote={selectTarget} startDate={startDate} onClose={() => setSelectTarget(null)} />
    </div>
  );
}

// =====================
// Peças
// =====================

function StatTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-muted/30")}>
      <p className={cn("text-2xl font-semibold leading-none", highlight && "text-amber-700 dark:text-amber-400")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Botão desabilitado não dispara hover: o span recebe o tooltip no lugar dele. */
function ActionWithReason({ reason, children }: { reason: string | null; children: React.ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}


interface QuoteRowProps {
  quote: AirbrushingQuote;
  isOpen: boolean;
  canAct: boolean;
  /** Início previsto da aerografia — base do término de cada proposta. */
  startDate: Date | string | null;
  isLowest: boolean;
  isFastest: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function QuoteRow({ quote, isOpen, canAct, startDate, isLowest, isFastest, expanded, onToggle, onSelect }: QuoteRowProps) {
  const isSelected = quote.status === AIRBRUSHING_QUOTE_STATUS.SELECTED;
  const isInactive = quote.status === AIRBRUSHING_QUOTE_STATUS.DECLINED || quote.status === AIRBRUSHING_QUOTE_STATUS.NOT_SELECTED;
  const needsCompany = isOpen && SELECTABLE.has(quote.status);
  const lastNote = lastNoteOf(quote);
  const events = quote.events ?? [];
  const time = formatExecutionTime(quote.executionTime, quote.executionTimeUnit);
  const finish = formatExpectedFinishDate(startDate, quote.executionTime, quote.executionTimeUnit);

  const selectBlockedReason = (() => {
    if (quote.status === AIRBRUSHING_QUOTE_STATUS.COUNTERED) return "Aguarde a resposta do aerografista à contraproposta";
    if (quote.amount == null) return "Esta negociação não tem valor";
    return null;
  })();
  const showSelect = canAct && isOpen && SELECT_SHOWN.has(quote.status);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isSelected ? "border-green-600/50 bg-green-600/5" : needsCompany ? "border-amber-500/40" : "border-border",
        isInactive && "opacity-70",
      )}
    >
      <div className="space-y-2 p-3">
        {/* Quem, em que estado, e as condições em jogo — nome e selos nunca são cortados. */}
        <div className="flex items-start gap-3">
          <UserAvatarDisplay avatar={avatarFile(quote.painter?.avatarId)} userName={painterName(quote)} size="md" shape="circle" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="break-words font-semibold leading-tight">{painterName(quote)}</span>
              {isSelected && <IconCircleCheck className="h-4 w-4 shrink-0 text-green-600" />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING_QUOTE[quote.status] ?? "default"} className="whitespace-nowrap text-xs">
                {AIRBRUSHING_QUOTE_STATUS_LABELS[quote.status]}
              </Badge>
              {isLowest && (
                <Badge variant="green" className="whitespace-nowrap text-xs">
                  Menor valor
                </Badge>
              )}
              {isFastest && (
                <Badge variant="teal" className="whitespace-nowrap text-xs">
                  Menor prazo
                </Badge>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="leading-tight tabular-nums" title={finish ? `Término previsto: ${finish}` : undefined}>
              <span className={cn("text-lg font-semibold", isLowest && "text-green-700 dark:text-green-400")}>
                {quote.amount != null ? formatCurrency(quote.amount) : "—"}
              </span>
              {time && <span className={cn("text-sm font-medium text-muted-foreground", isFastest && "text-teal-700 dark:text-teal-400")}> · {time}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{AMOUNT_CAPTION[quote.status]}</p>
          </div>
        </div>

        {lastNote && (
          <p className="line-clamp-2 text-xs text-muted-foreground" title={lastNote.note ?? undefined}>
            <IconMessage className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
            <span className="font-medium">{lastNote.party === AIRBRUSHING_QUOTE_PARTY.PAINTER ? "Aerografista" : "Comercial"}:</span> “{lastNote.note}”
          </p>
        )}

        {/* Rodapé: histórico à esquerda, seleção à direita. A contraproposta é da seção. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-expanded={expanded} className="-ml-2 h-8 text-muted-foreground">
              {expanded ? <IconChevronUp className="mr-1 h-4 w-4" /> : <IconChevronDown className="mr-1 h-4 w-4" />}
              Negociação ({events.length})
            </Button>
            <span className="truncate text-xs text-muted-foreground" title={formatDateTime(quote.updatedAt)}>
              Atualizado {formatRelativeTime(quote.updatedAt)}
            </span>
          </div>
          {showSelect && (
            <ActionWithReason reason={selectBlockedReason}>
              <Button type="button" size="sm" onClick={onSelect} disabled={!!selectBlockedReason}>
                <IconHandFinger className="mr-1.5 h-4 w-4" />
                Selecionar
              </Button>
            </ActionWithReason>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-border bg-muted/20 p-3">
          {events.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">Sem registros.</p>
          ) : (
            events.map((event) => <QuoteEventBubble key={event.id} event={event} painter={painterName(quote)} />)
          )}
        </div>
      )}
    </div>
  );
}

/** Linha do tempo em forma de conversa: aerografista à esquerda, empresa à direita. */
function QuoteEventBubble({ event, painter }: { event: AirbrushingQuoteEvent; painter: string }) {
  const fromCompany = event.party === AIRBRUSHING_QUOTE_PARTY.COMPANY;
  // Encerramento sem autor é do sistema (outra proposta selecionada, aerografia cancelada).
  const author = fromCompany ? (event.user?.name ?? (event.action === AIRBRUSHING_QUOTE_ACTION.CLOSE ? "Sistema" : "Comercial")) : painter;
  const isDecisive = event.action === AIRBRUSHING_QUOTE_ACTION.SELECT;
  // O lance diz valor e/ou tempo — uma contraproposta só de prazo não tem valor.
  const terms = formatQuoteTerms(event.amount, event.executionTime, event.executionTimeUnit);

  return (
    <div className={cn("flex", fromCompany ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg border px-3 py-2 text-sm md:max-w-[70%]",
          fromCompany ? "rounded-br-sm border-indigo-500/25 bg-indigo-500/10" : "rounded-bl-sm border-border bg-background",
          isDecisive && "border-green-600/40 bg-green-600/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{author}</span>
          <span>·</span>
          <span>{AIRBRUSHING_QUOTE_ACTION_LABELS[event.action] ?? event.action}</span>
          <span>·</span>
          <span>{formatDateTime(event.createdAt)}</span>
        </div>
        {terms && <p className="mt-0.5 font-semibold tabular-nums">{terms}</p>}
        {event.note && <p className="mt-0.5 whitespace-pre-wrap break-words">{event.note}</p>}
      </div>
    </div>
  );
}

// =====================
// Diálogos
// =====================

interface CounterAllQuotesDialogProps {
  open: boolean;
  airbrushingId: string;
  /** Negociações que recebem a contraproposta (PROPOSED/COUNTERED). */
  targets: AirbrushingQuote[];
  /** Quem já aceitou — fica de fora, e o diálogo diz isso. */
  acceptedCount: number;
  startDate: Date | string | null;
  onClose: () => void;
}

const EMPTY_COUNTER: AirbrushingQuoteCounterAllFormData = {
  amount: null,
  executionTime: null,
  executionTimeUnit: EXECUTION_TIME_UNIT.DAYS,
  note: null,
};

/**
 * Contraproposta para TODOS que têm proposta aguardando resposta. Novo valor e novo tempo
 * são opcionais (pelo menos um); o que ficar em branco continua o de cada negociação — por
 * isso a lista mostra, para cada um, as condições de hoje e as que ele vai receber.
 */
function CounterAllQuotesDialog({ open, airbrushingId, targets, acceptedCount, startDate, onClose }: CounterAllQuotesDialogProps) {
  const { mutateAsync, isPending } = useCounterAllAirbrushingQuotes();
  const form = useForm<AirbrushingQuoteCounterAllFormData>({
    resolver: zodResolver(airbrushingQuoteCounterAllSchema),
    defaultValues: EMPTY_COUNTER,
  });

  // Cada abertura começa limpa: a contraproposta anterior já foi enviada.
  useEffect(() => {
    if (open) form.reset(EMPTY_COUNTER);
  }, [open, form]);

  const amount = form.watch("amount");
  const executionTime = form.watch("executionTime");
  const executionTimeUnit = form.watch("executionTimeUnit");
  const counter = { amount: amount ?? null, executionTime: executionTime ?? null, executionTimeUnit: executionTime ? (executionTimeUnit ?? EXECUTION_TIME_UNIT.DAYS) : null };
  const hasChange = counter.amount != null || counter.executionTime != null;

  const onSubmit = async (values: AirbrushingQuoteCounterAllFormData) => {
    const time = values.executionTime ?? null;
    try {
      await mutateAsync({
        airbrushingId,
        data: {
          amount: values.amount ?? null,
          executionTime: time,
          executionTimeUnit: time != null ? (values.executionTimeUnit ?? EXECUTION_TIME_UNIT.DAYS) : null,
          note: values.note ?? null,
        },
      });
      onClose();
    } catch {
      // O interceptor global já mostra o erro; o diálogo fica aberto para corrigir.
    }
  };

  const eitherError = form.formState.errors.amount?.message;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contraproposta para todos</DialogTitle>
          <DialogDescription>
            Vale para quem tem proposta aguardando resposta. Informe um novo valor, um novo tempo ou os dois — o que ficar em branco continua o de cada um.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Novo valor</FormLabel>
                    <FormControl>
                      <Input
                        type="currency"
                        value={field.value ?? null}
                        onChange={(value) => {
                          field.onChange(typeof value === "number" && value > 0 ? value : null);
                          if (form.formState.isSubmitted) void form.trigger();
                        }}
                        onBlur={field.onBlur}
                        placeholder="Manter o de cada um"
                        disabled={isPending}
                        transparent
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="executionTime"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Novo tempo</FormLabel>
                    <ExecutionTimeInput
                      value={field.value ?? null}
                      unit={executionTimeUnit}
                      onChange={(next) => {
                        field.onChange(next.executionTime);
                        form.setValue("executionTimeUnit", next.executionTimeUnit);
                        if (form.formState.isSubmitted) void form.trigger();
                      }}
                      placeholder="Manter"
                      disabled={isPending}
                      invalid={!!fieldState.error}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {eitherError && <p className="-mt-2 text-sm font-medium text-destructive">{eitherError}</p>}

            {/* Quem recebe e o que muda para cada um. */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">Recebem ({targets.length})</p>
                {acceptedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {acceptedCount === 1 ? "1 que já aceitou fica de fora" : `${acceptedCount} que já aceitaram ficam de fora`}
                  </p>
                )}
              </div>
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {targets.map((quote) => {
                  const next = mergeCounterTerms(quote, counter);
                  const nextFinish = formatExpectedFinishDate(startDate, next.executionTime, next.executionTimeUnit as EXECUTION_TIME_UNIT | null);
                  return (
                    <li key={quote.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <UserAvatarDisplay avatar={avatarFile(quote.painter?.avatarId)} userName={painterName(quote)} size="xs" shape="circle" bordered={false} />
                      <span className="min-w-0 flex-1 break-words font-medium">{painterName(quote)}</span>
                      <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-1.5 text-right tabular-nums">
                        <span className={cn(hasChange ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground")}>{termsOf(quote)}</span>
                        {hasChange && (
                          <>
                            <IconArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold" title={nextFinish ? `Término previsto: ${nextFinish}` : undefined}>
                              {termsOf(next)}
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      placeholder="Ex.: fechamos neste valor se o prazo for mantido."
                      maxLength={1000}
                      rows={2}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-xs text-muted-foreground">Cada um pode aceitar, recusar ou responder. Aceitar não o seleciona: a escolha continua sendo sua.</p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || targets.length === 0}>
                {isPending ? <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <IconArrowsExchange className="mr-1.5 h-4 w-4" />}
                Enviar para {targets.length}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SelectQuoteDialog({ quote, startDate, onClose }: { quote: AirbrushingQuote | null; startDate: Date | string | null; onClose: () => void }) {
  const { mutateAsync, isPending } = useSelectAirbrushingQuote();
  const name = quote ? painterName(quote) : "";
  const amount = quote?.amount != null ? formatCurrency(quote.amount) : "—";
  const time = quote ? formatExecutionTime(quote.executionTime, quote.executionTimeUnit) : "";
  const finish = quote ? formatExpectedFinishDate(startDate, quote.executionTime, quote.executionTimeUnit) : "";

  const handleConfirm = async (e: React.MouseEvent) => {
    // Mantém o diálogo aberto até a resposta — o AlertDialogAction fecharia no clique.
    e.preventDefault();
    if (!quote) return;
    try {
      await mutateAsync({ quoteId: quote.id });
      onClose();
    } catch {
      // O interceptor global já mostra o erro.
    }
  };

  return (
    <AlertDialog open={!!quote} onOpenChange={(open) => !open && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Selecionar {name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <span className="font-semibold text-foreground">{name}</span> passa a ser o aerografista desta aerografia
                {quote?.status === AIRBRUSHING_QUOTE_STATUS.ACCEPTED ? ", nas condições da contraproposta que ele aceitou:" : ", nas condições da proposta que ele enviou:"}
              </p>
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-semibold tabular-nums text-foreground">{amount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo</p>
                  <p className="font-semibold text-foreground">{time || "—"}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <IconCalendarCheck className="h-3 w-3" />
                    Término
                  </p>
                  <p className="font-semibold tabular-nums text-foreground">{finish || "—"}</p>
                </div>
              </div>
              {time && !finish && <p className="text-xs">Sem início previsto, o término fica em aberto até a data de início ser definida.</p>}
              <p>A cotação é encerrada e a aerografia segue para Em Preparação. Os demais aerografistas serão avisados de que não foram selecionados.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending && <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Selecionar por {amount}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
