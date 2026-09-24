// Seção "Cotação" do detalhe da aerografia — o lado do comercial da negociação.
//
// Uma aerografia criada sem aerografista nasce Em Cotação: cada aerografista abre UMA
// negociação (AirbrushingQuote) e o comercial compara, contrapropõe ou seleciona. Aceitar
// uma contraproposta NÃO é ser selecionado — só "Selecionar" grava aerografista e valor
// (o da negociação, nunca digitado), encerra as demais e leva a aerografia para Em
// Preparação. Depois de encerrada, a seção fica como histórico somente leitura.
//
// As regras de quem pode o quê espelham utils/airbrushing-quote.ts da API; a API valida
// de novo, isto só evita oferecer o botão que devolveria 400.

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconArrowsExchange,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClockHour4,
  IconHandFinger,
  IconLoader2,
  IconMessage,
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
import { useAirbrushingQuotes, useCounterAirbrushingQuote, useSelectAirbrushingQuote } from "@/hooks/production/use-airbrushing-quote";
import { airbrushingKeys } from "@/hooks/common/query-keys";
import { airbrushingQuoteCounterSchema, type AirbrushingQuoteCounterFormData } from "@/schemas/airbrushing-quote";
import {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_QUOTE_STATUS,
  AIRBRUSHING_QUOTE_STATUS_LABELS,
  AIRBRUSHING_QUOTE_ACTION,
  AIRBRUSHING_QUOTE_ACTION_LABELS,
  AIRBRUSHING_QUOTE_PARTY,
  ENTITY_BADGE_CONFIG,
} from "@/constants";
import { formatCurrency } from "@/utils/number";
import { formatDateTime, formatRelativeTime } from "@/utils/date";
import type { Airbrushing, AirbrushingQuote, AirbrushingQuoteEvent, File as AnkaaFile } from "@/types";

// =====================
// Regras (espelham utils/airbrushing-quote.ts da API)
// =====================

/** Vez do comercial: há um valor que o aerografista sustenta — dá para selecionar. */
const SELECTABLE = new Set<AIRBRUSHING_QUOTE_STATUS>([AIRBRUSHING_QUOTE_STATUS.PROPOSED, AIRBRUSHING_QUOTE_STATUS.ACCEPTED]);
/** Negociações ainda vivas — o comercial pode contrapropor (inclusive revisar a própria). */
const COUNTERABLE = new Set<AIRBRUSHING_QUOTE_STATUS>([
  AIRBRUSHING_QUOTE_STATUS.PROPOSED,
  AIRBRUSHING_QUOTE_STATUS.COUNTERED,
  AIRBRUSHING_QUOTE_STATUS.ACCEPTED,
]);

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

  const selected = quotes.find((q) => q.status === AIRBRUSHING_QUOTE_STATUS.SELECTED) ?? null;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (quoteId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });

  const [counterTarget, setCounterTarget] = useState<AirbrushingQuote | null>(null);
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
              <span className="font-semibold">{selected.amount != null ? formatCurrency(selected.amount) : "—"}</span>.
            </span>
          </div>
        )
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
          {sorted.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              isOpen={isOpen}
              canAct={canAct}
              isLowest={quote.id === lowestSelectableId && counts.awaitingCompany > 1}
              expanded={expanded.has(quote.id)}
              onToggle={() => toggleExpanded(quote.id)}
              onCounter={() => setCounterTarget(quote)}
              onSelect={() => setSelectTarget(quote)}
            />
          ))}
        </div>
      )}

      <CounterQuoteDialog quote={counterTarget} onClose={() => setCounterTarget(null)} />
      <SelectQuoteDialog quote={selectTarget} onClose={() => setSelectTarget(null)} />
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
  isLowest: boolean;
  expanded: boolean;
  onToggle: () => void;
  onCounter: () => void;
  onSelect: () => void;
}

function QuoteRow({ quote, isOpen, canAct, isLowest, expanded, onToggle, onCounter, onSelect }: QuoteRowProps) {
  const isSelected = quote.status === AIRBRUSHING_QUOTE_STATUS.SELECTED;
  const isInactive = quote.status === AIRBRUSHING_QUOTE_STATUS.DECLINED || quote.status === AIRBRUSHING_QUOTE_STATUS.NOT_SELECTED;
  const needsCompany = isOpen && SELECTABLE.has(quote.status);
  const lastNote = lastNoteOf(quote);
  const events = quote.events ?? [];

  const selectBlockedReason = (() => {
    if (quote.status === AIRBRUSHING_QUOTE_STATUS.COUNTERED) return "Aguarde a resposta do aerografista à contraproposta";
    if (quote.status === AIRBRUSHING_QUOTE_STATUS.DECLINED) return "O aerografista recusou esta cotação";
    if (quote.amount == null) return "Esta negociação não tem valor";
    return null;
  })();
  const counterBlockedReason = COUNTERABLE.has(quote.status) ? null : "O aerografista recusou esta cotação";

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isSelected ? "border-green-600/50 bg-green-600/5" : needsCompany ? "border-amber-500/40" : "border-border",
        isInactive && "opacity-70",
      )}
    >
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
        {/* Quem + estado */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatarDisplay avatar={avatarFile(quote.painter?.avatarId)} userName={painterName(quote)} size="md" shape="circle" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold">{painterName(quote)}</span>
              {isSelected && <IconCircleCheck className="h-4 w-4 text-green-600" />}
              <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING_QUOTE[quote.status] ?? "default"} className="whitespace-nowrap text-xs">
                {AIRBRUSHING_QUOTE_STATUS_LABELS[quote.status]}
              </Badge>
              {isLowest && (
                <Badge variant="green" className="whitespace-nowrap text-xs">
                  Menor valor
                </Badge>
              )}
            </div>
            {lastNote ? (
              <p className="line-clamp-2 text-xs text-muted-foreground" title={lastNote.note ?? undefined}>
                <IconMessage className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                <span className="font-medium">{lastNote.party === AIRBRUSHING_QUOTE_PARTY.PAINTER ? "Aerografista" : "Comercial"}:</span> “{lastNote.note}”
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" title={formatDateTime(quote.updatedAt)}>
                Atualizado {formatRelativeTime(quote.updatedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Valor em jogo */}
        <div className="md:w-48 md:text-right">
          <p className={cn("text-lg font-semibold tabular-nums", isLowest && "text-green-700 dark:text-green-400")}>
            {quote.amount != null ? formatCurrency(quote.amount) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{AMOUNT_CAPTION[quote.status]}</p>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {canAct && isOpen && (
            <>
              <ActionWithReason reason={counterBlockedReason}>
                <Button type="button" variant="outline" size="sm" onClick={onCounter} disabled={!!counterBlockedReason}>
                  <IconArrowsExchange className="mr-1.5 h-4 w-4" />
                  {quote.status === AIRBRUSHING_QUOTE_STATUS.COUNTERED ? "Revisar" : "Contraproposta"}
                </Button>
              </ActionWithReason>
              <ActionWithReason reason={selectBlockedReason}>
                <Button type="button" size="sm" onClick={onSelect} disabled={!!selectBlockedReason}>
                  <IconHandFinger className="mr-1.5 h-4 w-4" />
                  Selecionar
                </Button>
              </ActionWithReason>
            </>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-expanded={expanded} className="text-muted-foreground">
            {expanded ? <IconChevronUp className="mr-1 h-4 w-4" /> : <IconChevronDown className="mr-1 h-4 w-4" />}
            Negociação ({events.length})
          </Button>
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
          <span title={formatDateTime(event.createdAt)}>{formatDateTime(event.createdAt)}</span>
        </div>
        {event.amount != null && <p className="mt-0.5 font-semibold tabular-nums">{formatCurrency(event.amount)}</p>}
        {event.note && <p className="mt-0.5 whitespace-pre-wrap break-words">{event.note}</p>}
      </div>
    </div>
  );
}

// =====================
// Diálogos
// =====================

function CounterQuoteDialog({ quote, onClose }: { quote: AirbrushingQuote | null; onClose: () => void }) {
  const { mutateAsync, isPending } = useCounterAirbrushingQuote();
  const form = useForm<AirbrushingQuoteCounterFormData>({
    resolver: zodResolver(airbrushingQuoteCounterSchema),
    defaultValues: { amount: undefined as unknown as number, note: null },
  });

  // Reabre com o valor em jogo desta negociação — a contraproposta costuma partir dele.
  useEffect(() => {
    if (quote) form.reset({ amount: (quote.amount ?? undefined) as unknown as number, note: null });
  }, [quote, form]);

  const onSubmit = async (values: AirbrushingQuoteCounterFormData) => {
    if (!quote) return;
    try {
      await mutateAsync({ quoteId: quote.id, data: { amount: values.amount, note: values.note ?? null } });
      onClose();
    } catch {
      // O interceptor global já mostra o erro; o diálogo fica aberto para corrigir.
    }
  };

  const reference =
    quote?.amount != null
      ? quote.status === AIRBRUSHING_QUOTE_STATUS.PROPOSED
        ? `Proposta atual do aerografista: ${formatCurrency(quote.amount)}.`
        : `Valor em jogo: ${formatCurrency(quote.amount)}.`
      : null;

  return (
    <Dialog open={!!quote} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contraproposta para {quote ? painterName(quote) : ""}</DialogTitle>
          <DialogDescription>
            {reference} O aerografista poderá aceitar, recusar ou responder com outro valor. Aceitar não o seleciona: a escolha continua sendo sua.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor da contraproposta</FormLabel>
                  <FormControl>
                    <Input
                      type="currency"
                      value={field.value ?? null}
                      onChange={(value) => field.onChange(typeof value === "number" ? value : undefined)}
                      onBlur={field.onBlur}
                      placeholder="R$ 0,00"
                      disabled={isPending}
                      transparent
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      placeholder="Ex.: conseguimos fechar por este valor se o prazo for mantido."
                      maxLength={1000}
                      rows={3}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <IconArrowsExchange className="mr-1.5 h-4 w-4" />}
                Enviar contraproposta
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SelectQuoteDialog({ quote, onClose }: { quote: AirbrushingQuote | null; onClose: () => void }) {
  const { mutateAsync, isPending } = useSelectAirbrushingQuote();
  const name = quote ? painterName(quote) : "";
  const amount = quote?.amount != null ? formatCurrency(quote.amount) : "—";

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
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-foreground">{name}</span> passa a ser o aerografista desta aerografia pelo valor de{" "}
                <span className="font-semibold text-foreground">{amount}</span>
                {quote?.status === AIRBRUSHING_QUOTE_STATUS.ACCEPTED ? " — a contraproposta que ele aceitou." : " — a proposta que ele enviou."}
              </p>
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
