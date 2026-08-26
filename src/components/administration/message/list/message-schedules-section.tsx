import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconRepeat,
  IconPlayerPause,
  IconPlayerPlay,
  IconSend,
  IconTrash,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  useMessageSchedules,
  usePauseMessageSchedule,
  useResumeMessageSchedule,
  useRunMessageScheduleNow,
  useDeleteMessageSchedule,
} from "@/hooks/administration/use-message-schedule";
import { getScheduleCadenceLabel } from "@/constants";
import { cn } from "@/lib/utils";
import { MessageScheduleDetailDialog } from "./message-schedule-detail-dialog";
import type { MessageSchedule } from "@/schemas/message-schedule";

const TARGET_LABELS: Record<string, string> = {
  ALL: "Todos",
  SPECIFIC: "Usuários específicos",
  SECTOR: "Por setor",
  POSITION: "Por cargo",
};

const fmtDateTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/**
 * Mensagens recorrentes na própria página de Mensagens.
 *
 * Existe porque um agendamento criado hoje para a segunda que vem NÃO produz
 * nenhuma linha `Message` até disparar — sem esta faixa, o comunicado recorrente
 * simplesmente sumia da tela depois de salvo, e não havia como conferir se ficou
 * certo, pausar ou apagar.
 *
 * É uma faixa separada, e não linhas misturadas na tabela, porque um agendamento
 * não é uma mensagem: não tem data única, não tem visualizações e não tem
 * público congelado. Forçá-lo nas colunas de mensagem só produziria travessões.
 *
 * As mensagens que ele PUBLICA continuam na tabela normal, marcadas com o nome do
 * agendamento (e isoláveis pelo filtro Origem → somente recorrentes).
 */
export function MessageSchedulesSection({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useMessageSchedules({ limit: 50 });

  const pause = usePauseMessageSchedule();
  const resume = useResumeMessageSchedule();
  const runNow = useRunMessageScheduleNow();
  const remove = useDeleteMessageSchedule();
  const busy = pause.isPending || resume.isPending || runNow.isPending || remove.isPending;

  const schedules: MessageSchedule[] = data?.data ?? [];

  // Sem agendamento nenhum a faixa não aparece — quem nunca usou recorrência vê
  // a página exatamente como antes.
  if (isLoading || schedules.length === 0) return null;

  return (
    <Card level={2} className={cn("flex-shrink-0", className)}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          {collapsed ? (
            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <IconChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <IconRepeat className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Mensagens recorrentes</span>
          <Badge variant="secondary" className="ml-1">
            {schedules.length}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            As publicações geradas aparecem na tabela abaixo
          </span>
        </button>

        {!collapsed && (
          <div className="divide-y divide-border border-t border-border">
            {schedules.map(s => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(s.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(s.id);
                  }
                }}
                className="flex cursor-pointer flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 md:flex-row md:items-center md:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    {/* Mesmas variantes da coluna STATUS da tabela: `active` é o
                        verde da casa — `default` sai cinza. */}
                    {s.finishedAt ? (
                      <Badge variant="muted">Encerrado</Badge>
                    ) : s.isActive ? (
                      <Badge variant="active">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Pausado</Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {getScheduleCadenceLabel(s.frequency, s.frequencyCount, {
                      dayOfMonth: s.dayOfMonth,
                      monthlyConfig: s.monthlyConfig,
                      weeklyConfig: s.weeklyConfig,
                      yearlyConfig: s.yearlyConfig,
                    })}
                    {" · "}
                    {TARGET_LABELS[s.targetType] ?? s.targetType}
                    {" · "}
                    {s.displayDurationDays} dia(s) no ar
                  </div>
                  {/* Agendamento que parou de publicar em silêncio é
                      indistinguível de um que nunca existiu. */}
                  {s.lastRunError && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <IconAlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="truncate" title={s.lastRunError}>
                        {s.lastRunError}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col text-xs md:w-56">
                  <span>
                    <span className="text-muted-foreground">Próxima: </span>
                    {s.isActive ? fmtDateTime(s.nextRun) : "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {s.occurrenceCount} publicada(s)
                    {s.maxOccurrences ? ` de ${s.maxOccurrences}` : ""}
                  </span>
                </div>

                {/* Os botões vivem DENTRO da linha clicável: sem parar a
                    propagação, pausar ou excluir também abriria o diálogo. */}
                <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busy || !!s.finishedAt}
                    title="Publicar agora (não altera o ciclo)"
                    onClick={() => runNow.mutate(s.id)}
                  >
                    <IconSend className="h-4 w-4" />
                  </Button>
                  {s.isActive ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      title="Pausar"
                      onClick={() => pause.mutate(s.id)}
                    >
                      <IconPlayerPause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy || !!s.finishedAt}
                      title="Retomar"
                      onClick={() => resume.mutate(s.id)}
                    >
                      <IconPlayerPlay className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    title="Excluir agendamento"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir o agendamento "${s.name}"?\n\n` +
                            `As ${s.occurrenceCount} mensagem(ns) já publicada(s) NÃO serão apagadas — ` +
                            `continuam na lista como mensagens avulsas, com as visualizações intactas.\n\n` +
                            `O agendamento para de gerar novas publicações.`,
                        )
                      ) {
                        remove.mutate(s.id);
                      }
                    }}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <MessageScheduleDetailDialog
        scheduleId={openId}
        open={!!openId}
        onOpenChange={o => !o && setOpenId(null)}
      />
    </Card>
  );
}
