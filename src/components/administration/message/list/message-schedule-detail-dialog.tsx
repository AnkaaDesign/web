import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconRepeat, IconExternalLink, IconAlertTriangle } from "@tabler/icons-react";
import { MessageCanvas } from "@/components/messaging/MessageCanvas";
import { transformBlocksForDisplay } from "@/utils/message-transformer";
import { useMessageSchedule } from "@/hooks/administration/use-message-schedule";
import { getScheduleCadenceLabel, routes } from "@/constants";
import type { ContentBlock } from "@/components/administration/message/editor/types";

const TARGET_LABELS: Record<string, string> = {
  ALL: "Todos os usuários",
  SPECIFIC: "Usuários específicos",
  SECTOR: "Por setor",
  POSITION: "Por cargo",
};

const OCCURRENCE_STATUS: Record<string, { label: string; variant: "active" | "pending" | "expired" | "muted" | "secondary" }> = {
  ACTIVE: { label: "Ativa", variant: "active" },
  SCHEDULED: { label: "Agendada", variant: "pending" },
  EXPIRED: { label: "Expirada", variant: "expired" },
  ARCHIVED: { label: "Arquivada", variant: "muted" },
  DRAFT: { label: "Rascunho", variant: "secondary" },
};

const fmtDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

/** Uma linha rótulo/valor da coluna de fatos. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * O comunicado recorrente, visto por dentro.
 *
 * Um agendamento cujo primeiro disparo ainda não aconteceu não tem NENHUMA linha
 * `Message` para abrir — não dá para mandar o usuário à página de detalhe da
 * mensagem, porque ela ainda não existe. Este diálogo mostra o conteúdo tal como
 * será publicado (mesmo `MessageCanvas` do preview do compositor, então o que se
 * vê aqui é o que sai), os fatos da regra, e a lista do que JÁ foi publicado —
 * cada publicação levando à página de detalhe da mensagem de verdade, com suas
 * estatísticas de leitura.
 */
export function MessageScheduleDetailDialog({
  scheduleId,
  open,
  onOpenChange,
}: {
  scheduleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useMessageSchedule(scheduleId ?? "", {
    enabled: open && !!scheduleId,
  });
  const schedule = data?.data;

  // `content` vem como `{ blocks: [...] }` — mesmo envelope de `Message.content`
  // — mas às vezes chega como STRING JSON. Mesma desembrulhada da página de
  // detalhe da mensagem, para os dois renderizarem igual.
  const blocks = useMemo<ContentBlock[]>(() => {
    let raw: any = schedule?.content;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (raw?.blocks) raw = raw.blocks;
    return Array.isArray(raw) ? raw : [];
  }, [schedule]);

  const rendererBlocks = useMemo(() => transformBlocksForDisplay(blocks), [blocks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <IconRepeat className="h-5 w-5 text-muted-foreground" />
            <span className="truncate">{schedule?.name ?? "Comunicado recorrente"}</span>
            {schedule &&
              (schedule.finishedAt ? (
                <Badge variant="muted">Encerrado</Badge>
              ) : schedule.isActive ? (
                <Badge variant="active">Ativo</Badge>
              ) : (
                <Badge variant="secondary">Pausado</Badge>
              ))}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !schedule ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* O conteúdo, exatamente como será publicado */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-6">
              <div className="mx-auto max-w-[672px] overflow-hidden rounded-xl border border-border bg-background text-foreground">
                <div className="px-6 pb-4 pt-5">
                  <h2 className="break-words text-2xl font-bold">{schedule.title}</h2>
                </div>
                <Separator />
                {rendererBlocks.length > 0 ? (
                  <MessageCanvas blocks={rendererBlocks} className="py-4" />
                ) : (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    Sem conteúdo
                  </div>
                )}
              </div>
            </div>

            {/* Os fatos da regra + o que já saiu */}
            <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto border-l border-border p-5">
              <Fact label="Repetição">
                {getScheduleCadenceLabel(schedule.frequency, schedule.frequencyCount, {
                  dayOfMonth: schedule.dayOfMonth,
                  monthlyConfig: schedule.monthlyConfig,
                  weeklyConfig: schedule.weeklyConfig,
                  yearlyConfig: schedule.yearlyConfig,
                })}
              </Fact>

              <Fact label="Público">
                {TARGET_LABELS[schedule.targetType] ?? schedule.targetType}
              </Fact>

              <Fact label="Próxima publicação">
                {schedule.isActive ? fmtDateTime(schedule.nextRun) : "— (pausado)"}
              </Fact>

              <Fact label="Cada publicação">
                {schedule.displayDurationDays} dia(s) no ar, às{" "}
                {String(schedule.publishHour).padStart(2, "0")}:00
              </Fact>

              <Fact label="Vigência">
                {schedule.startsOn || schedule.endsOn
                  ? `${fmtDate(schedule.startsOn)} — ${fmtDate(schedule.endsOn)}`
                  : "Sem limite"}
              </Fact>

              {schedule.maxOccurrences && (
                <Fact label="Limite">
                  {schedule.occurrenceCount} de {schedule.maxOccurrences} publicada(s)
                </Fact>
              )}

              {schedule.lastRunError && (
                <div className="flex items-start gap-1.5 rounded-md border border-border bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                  <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{schedule.lastRunError}</span>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Publicações ({schedule.occurrenceCount})
                </div>

                {!schedule.occurrences || schedule.occurrences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ainda não publicou. A primeira sai em{" "}
                    <span className="font-medium text-foreground">
                      {fmtDateTime(schedule.nextRun)}
                    </span>
                    .
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {schedule.occurrences.map(o => {
                      const st = OCCURRENCE_STATUS[o.status] ?? {
                        label: o.status,
                        variant: "secondary" as const,
                      };
                      return (
                        <li key={o.id}>
                          {/* Cada publicação É uma mensagem de verdade — daí o
                              link para a página de detalhe dela, com as
                              estatísticas de leitura. */}
                          <button
                            type="button"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(routes.administration.messages.details(o.id));
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            <span className="flex-1 truncate">
                              {fmtDate(o.occurrenceDate ?? o.publishedAt)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {o._count?.views ?? 0}/{o._count?.targets ?? 0}
                            </span>
                            <Badge variant={st.variant} className="text-[10px]">
                              {st.label}
                            </Badge>
                            <IconExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
