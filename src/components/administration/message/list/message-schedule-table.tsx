import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconEdit,
  IconTrash,
  IconSend,
  IconPlayerPause,
  IconPlayerPlay,
  IconEye,
  IconAlertTriangle,
  IconRepeat,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useMessageSchedules,
  usePauseMessageSchedule,
  useResumeMessageSchedule,
  useRunMessageScheduleNow,
  useDeleteMessageSchedule,
} from "@/hooks/administration/use-message-schedule";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { getScheduleCadenceLabel, routes } from "@/constants";
import { MessageScheduleDetailDialog } from "./message-schedule-detail-dialog";
import { cn } from "@/lib/utils";
import type {
  MessageSchedule,
  MessageScheduleGetManyFormData,
} from "@/schemas/message-schedule";

/**
 * Comunicados recorrentes, na MESMA tabela das mensagens.
 *
 * Antes era uma faixa de linhas soltas com três botões à direita de cada uma.
 * Ela dizia menos (não tinha ordenação, filtro nem busca), ocupava mais altura e
 * ensinava um gesto diferente do resto do sistema — em toda outra lista as ações
 * moram no clique direito, e três alvos de clique dentro de uma linha que também
 * é clicável são um convite ao acidente.
 *
 * A tabela é curta DE PROPÓSITO: 10 por página e sem rolagem própria. Um
 * agendamento não é um registro que se folheia às centenas; a lista precisa
 * caber inteira acima da tabela de mensagens sem roubar a altura dela nem criar
 * uma segunda barra de rolagem dentro da página.
 */

const PAGE_SIZE = 10;

interface MessageScheduleTableProps {
  filters: Partial<MessageScheduleGetManyFormData>;
  onDataChange?: (data: { items: MessageSchedule[]; totalRecords: number }) => void;
  className?: string;
}

interface ScheduleColumn {
  key: string;
  header: string;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
  accessor: (schedule: MessageSchedule) => React.ReactNode;
}

const TARGET_LABELS: Record<string, string> = {
  ALL: "Todos",
  SPECIFIC: "Usuários específicos",
  SECTOR: "Por setor",
  POSITION: "Por cargo",
};

/**
 * Um agendamento tem TRÊS situações, não duas: encerrado é diferente de pausado.
 * Pausado volta com um clique; encerrado chegou ao fim da vigência ou ao limite
 * de publicações e precisa da regra editada para voltar a existir.
 */
const statusOf = (s: MessageSchedule): "finished" | "active" | "paused" =>
  s.finishedAt ? "finished" : s.isActive ? "active" : "paused";

const STATUS_BADGE: Record<
  ReturnType<typeof statusOf>,
  { label: string; variant: "active" | "secondary" | "muted" }
> = {
  active: { label: "Ativo", variant: "active" },
  paused: { label: "Pausado", variant: "secondary" },
  finished: { label: "Encerrado", variant: "muted" },
};

const fmtDateTime = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

const fmtDate = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "dd/MM/yy", { locale: ptBR }) : "—";

/** Vigência da REGRA (não a janela de exibição de cada publicação). */
const validity = (s: MessageSchedule): string => {
  if (!s.startsOn && !s.endsOn) return "Sem limite";
  if (s.startsOn && s.endsOn) return `${fmtDate(s.startsOn)} – ${fmtDate(s.endsOn)}`;
  if (s.startsOn) return `A partir de ${fmtDate(s.startsOn)}`;
  return `Até ${fmtDate(s.endsOn)}`;
};

type ConfirmAction = {
  type: "delete" | "pause" | "resume" | "run";
  items: MessageSchedule[];
};

export function MessageScheduleTable({
  filters,
  onDataChange,
  className,
}: MessageScheduleTableProps) {
  const navigate = useNavigate();
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const pause = usePauseMessageSchedule();
  const resume = useResumeMessageSchedule();
  const runNow = useRunMessageScheduleNow();
  const remove = useDeleteMessageSchedule();

  // Estado LOCAL, não `useTableState`: aquele hook grava página, tamanho e
  // seleção na querystring, e esta tabela divide a página com a de mensagens —
  // as duas disputariam os mesmos parâmetros `?page=`/`?selected=`.
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: "createdAt",
    direction: "desc",
  });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: MessageSchedule[];
    isBulk: boolean;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const queryParams = useMemo<MessageScheduleGetManyFormData>(
    () => ({
      ...filters,
      page: page + 1,
      limit: PAGE_SIZE,
      sortBy: sort.column,
      sortOrder: sort.direction,
    }),
    [filters, page, sort],
  );

  const { data: response, isLoading, error } = useMessageSchedules(queryParams);

  const schedules: MessageSchedule[] = response?.data ?? [];
  const totalRecords = response?.meta?.totalRecords ?? 0;
  const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / PAGE_SIZE) : 1;

  // Uma página que sumiu (filtro novo, último agendamento excluído) deixaria a
  // tabela vazia com a paginação apontando para o nada.
  //
  // ⚠️ Só com resposta EM MÃOS. Trocar de página muda a chave da consulta e o
  // React Query devolve `undefined` enquanto busca — sem esta guarda, o total
  // momentâneo de 0 empurraria a página de volta para a primeira, e a paginação
  // simplesmente nunca avançaria.
  React.useEffect(() => {
    if (!response) return;
    if (page > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [response, page, totalPages]);

  const lastNotifiedRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!onDataChange) return;
    const key = `${totalRecords}-${schedules.map(s => s.id).join(",")}`;
    if (key === lastNotifiedRef.current) return;
    lastNotifiedRef.current = key;
    onDataChange({ items: schedules, totalRecords });
  }, [schedules, totalRecords, onDataChange]);

  const columns: ScheduleColumn[] = [
    {
      key: "name",
      header: "TÍTULO",
      sortable: true,
      className: "w-64",
      align: "left",
      accessor: schedule => (
        <div className="flex min-w-0 items-center gap-1.5">
          <IconRepeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{schedule.name}</span>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "STATUS",
      sortable: true,
      className: "w-28",
      align: "left",
      accessor: schedule => {
        const badge = STATUS_BADGE[statusOf(schedule)];
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      key: "frequency",
      header: "REPETIÇÃO",
      sortable: true,
      className: "w-48",
      align: "left",
      accessor: schedule => (
        <div className="truncate text-sm">
          {getScheduleCadenceLabel(schedule.frequency, schedule.frequencyCount, {
            dayOfMonth: schedule.dayOfMonth,
            monthlyConfig: schedule.monthlyConfig,
            weeklyConfig: schedule.weeklyConfig,
            yearlyConfig: schedule.yearlyConfig,
          })}
        </div>
      ),
    },
    {
      key: "targetType",
      header: "PÚBLICO-ALVO",
      sortable: false,
      className: "w-36",
      align: "left",
      accessor: schedule => (
        <div className="text-sm">{TARGET_LABELS[schedule.targetType] ?? schedule.targetType}</div>
      ),
    },
    {
      key: "displayDurationDays",
      header: "NO AR",
      sortable: false,
      className: "w-28",
      align: "left",
      accessor: schedule => (
        <div className="text-sm">
          {schedule.displayDurationDays} dia(s)
          <span className="ml-1 text-xs text-muted-foreground">
            {String(schedule.publishHour).padStart(2, "0")}h
          </span>
        </div>
      ),
    },
    {
      key: "nextRun",
      header: "PRÓXIMA",
      sortable: true,
      className: "w-40",
      align: "left",
      accessor: schedule => (
        <div className={cn("text-sm", !schedule.isActive && "text-muted-foreground")}>
          {schedule.isActive ? fmtDateTime(schedule.nextRun) : "—"}
        </div>
      ),
    },
    {
      key: "occurrenceCount",
      header: "PUBLICADAS",
      sortable: true,
      className: "w-28",
      align: "center",
      accessor: schedule => (
        <div className="text-sm">
          {schedule.occurrenceCount}
          {schedule.maxOccurrences ? ` / ${schedule.maxOccurrences}` : ""}
        </div>
      ),
    },
    {
      key: "validity",
      header: "VIGÊNCIA",
      sortable: false,
      className: "w-36",
      align: "left",
      accessor: schedule => (
        <div
          className={cn(
            "text-sm",
            !schedule.startsOn && !schedule.endsOn && "text-muted-foreground",
          )}
        >
          {validity(schedule)}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      sortable: true,
      className: "w-32",
      align: "left",
      accessor: schedule => (
        <div className="text-sm text-muted-foreground">{fmtDateTime(schedule.createdAt)}</div>
      ),
    },
  ];

  const currentPageIds = useMemo(() => schedules.map(s => s.id), [schedules]);
  const allSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.includes(id));
  const partiallySelected = !allSelected && currentPageIds.some(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      allSelected
        ? prev.filter(id => !currentPageIds.includes(id))
        : Array.from(new Set([...prev, ...currentPageIds])),
    );
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  /** Um clique alterna asc → desc → sem ordenação, como na tabela de mensagens. */
  const toggleSort = (column: string) => {
    setSort(prev => {
      if (prev.column !== column) return { column, direction: "asc" };
      if (prev.direction === "asc") return { column, direction: "desc" };
      return { column: "createdAt", direction: "desc" };
    });
  };

  const renderSortIndicator = (columnKey: string) => {
    const active = sort.column === columnKey;
    return (
      <div className="inline-flex items-center ml-1">
        {!active && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {active && sort.direction === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {active && sort.direction === "desc" && (
          <IconChevronDown className="h-4 w-4 text-foreground" />
        )}
      </div>
    );
  };

  const handleContextMenu = (e: React.MouseEvent, schedule: MessageSchedule) => {
    e.preventDefault();
    e.stopPropagation();

    const isItemSelected = selectedIds.includes(schedule.id);
    if (selectedIds.length > 0 && isItemSelected) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: schedules.filter(s => selectedIds.includes(s.id)),
        isBulk: true,
      });
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, items: [schedule], isBulk: false });
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction || isConfirming) return;
    setIsConfirming(true);
    try {
      // Não há endpoint em lote para agendamento — são poucos por definição, e
      // `allSettled` evita que um erro no meio deixe metade do lote por fazer.
      const call = (id: string) => {
        switch (confirmAction.type) {
          case "delete":
            return remove.mutateAsync(id);
          case "pause":
            return pause.mutateAsync(id);
          case "resume":
            return resume.mutateAsync(id);
          case "run":
            return runNow.mutateAsync(id);
        }
      };
      await Promise.allSettled(confirmAction.items.map(item => call(item.id)));
      if (confirmAction.type === "delete") {
        const removed = new Set(confirmAction.items.map(i => i.id));
        setSelectedIds(prev => prev.filter(id => !removed.has(id)));
      }
      setConfirmAction(null);
    } finally {
      setIsConfirming(false);
    }
  };

  const confirmDialogCopy = (() => {
    if (!confirmAction) return null;
    const count = confirmAction.items.length;
    const name = confirmAction.items[0]?.name ?? "";
    const subject = count > 1 ? `${count} agendamentos` : `o agendamento "${name}"`;

    if (confirmAction.type === "delete") {
      const published = confirmAction.items.reduce((sum, s) => sum + (s.occurrenceCount ?? 0), 0);
      return {
        title: "Excluir agendamento",
        description:
          `Excluir ${subject}?` +
          (published > 0
            ? ` As ${published} mensagem(ns) já publicada(s) NÃO serão apagadas — continuam na lista abaixo como mensagens avulsas, com as visualizações intactas.`
            : "") +
          " O agendamento para de gerar novas publicações.",
        actionLabel: "Excluir",
        destructive: true,
      };
    }
    if (confirmAction.type === "pause") {
      return {
        title: "Pausar agendamento",
        description: `Pausar ${subject}? Nenhuma publicação nova sai até alguém retomar. A regra fica guardada.`,
        actionLabel: "Pausar",
        destructive: false,
      };
    }
    if (confirmAction.type === "resume") {
      return {
        title: "Retomar agendamento",
        description: `Retomar ${subject}? A próxima publicação é recalculada a partir de agora — ciclos perdidos durante a pausa não são repostos.`,
        actionLabel: "Retomar",
        destructive: false,
      };
    }
    return {
      title: "Publicar agora",
      description: `Publicar uma ocorrência de ${subject} imediatamente? O ciclo normal segue no horário de sempre, e publicar duas vezes no mesmo dia não gera duas mensagens.`,
      actionLabel: "Publicar",
      destructive: false,
    };
  })();

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const single = contextMenu?.items.length === 1 ? contextMenu.items[0] : null;

  // Checkbox + colunas + o espaçador da barra de rolagem, quando ele existe.
  const fullSpan = columns.length + (isOverlay ? 1 : 2);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Cabeçalho fixo */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead
                className={cn(
                  TABLE_LAYOUT.checkbox.className,
                  "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                )}
              >
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos os agendamentos"
                    disabled={isLoading || schedules.length === 0}
                  />
                </div>
              </TableHead>

              {columns.map(column => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0",
                    column.className,
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || schedules.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" && "justify-center text-center",
                        column.align === "right" && "justify-end text-right",
                        !column.align && "justify-start text-left",
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Espaçador da barra de rolagem: a tabela de mensagens rola e
                  esta não, mas as duas ficam empilhadas na mesma página — sem o
                  espaçador as colunas das duas não se alinhariam. */}
              {!isOverlay && (
                <TableHead
                  style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }}
                  className="bg-muted p-0 border-0 !border-r-0 shrink-0"
                />
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Corpo — SEM rolagem própria: são 10 linhas no máximo, e a página inteira
          já rola. Uma segunda barra aqui dentro só criaria um poço de rolagem
          dentro de outro. */}
      <div className="border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="border-b border-border">
                  <TableCell colSpan={fullSpan} className="p-0">
                    <div className="h-[2.4rem] animate-pulse bg-muted/40" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={fullSpan} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">
                      Não foi possível carregar os agendamentos
                    </div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={fullSpan} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconRepeat className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">
                      Nenhum comunicado recorrente encontrado
                    </div>
                    <div className="text-sm">
                      {filters && Object.keys(filters).length > 0
                        ? "Ajuste os filtros para ver mais resultados."
                        : 'Ligue "Repetir esta mensagem" ao criar uma mensagem para agendar um comunicado.'}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule, index) => {
                const itemIsSelected = selectedIds.includes(schedule.id);
                return (
                  <TableRow
                    key={schedule.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => setDetailId(schedule.id)}
                    onContextMenu={e => handleContextMenu(e, schedule)}
                  >
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={e => {
                          e.stopPropagation();
                          toggleOne(schedule.id);
                        }}
                      >
                        <Checkbox
                          checked={itemIsSelected}
                          aria-label={`Selecionar ${schedule.name}`}
                          data-checkbox
                        />
                      </div>
                    </TableCell>

                    {columns.map(column => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.align === "left" && "text-left",
                          !column.align && "text-left",
                        )}
                      >
                        <div className="px-4 py-2">{column.accessor(schedule)}</div>
                      </TableCell>
                    ))}

                    {!isOverlay && (
                      <TableCell
                        style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }}
                        className="p-0 border-0 !border-r-0 shrink-0"
                      />
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Um agendamento com erro na última execução para de publicar EM SILÊNCIO,
          e a coluna PRÓXIMA continua mostrando uma data que nunca chega. */}
      {schedules.some(s => s.lastRunError) && (
        <div className="border-l border-r border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-400">
          {schedules
            .filter(s => s.lastRunError)
            .map(s => (
              <div key={s.id} className="flex items-start gap-1.5">
                <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="truncate" title={s.lastRunError ?? undefined}>
                  <span className="font-medium">{s.name}:</span> {s.lastRunError}
                </span>
              </div>
            ))}
        </div>
      )}

      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          totalItems={totalRecords}
          // Sem seletor de tamanho: a altura desta tabela é parte do desenho da
          // página, e deixar o usuário pedir 100 linhas aqui empurraria a tabela
          // de mensagens para fora da tela.
          showPageSizeSelector={false}
          showGoToPage={false}
          showPageInfo={true}
        />
      </div>

      {/* Menu de contexto */}
      <DropdownMenu open={!!contextMenu} onOpenChange={open => !open && setContextMenu(null)}>
        <DropdownMenuContent
          style={{ position: "fixed", left: contextMenu?.x, top: contextMenu?.y }}
          className="w-60"
          onCloseAutoFocus={e => e.preventDefault()}
        >
          {contextMenu?.isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {contextMenu.items.length} agendamentos selecionados
            </div>
          )}

          {single && (
            <DropdownMenuItem onClick={() => { setDetailId(single.id); setContextMenu(null); }}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver detalhes
            </DropdownMenuItem>
          )}

          {single && (
            <DropdownMenuItem
              onClick={() => {
                navigate(routes.administration.messages.schedules.edit(single.id));
                setContextMenu(null);
              }}
            >
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          {/* Publicar agora só faz sentido enquanto o agendamento não encerrou —
              a API recusa depois do fim da vigência ou do limite de publicações. */}
          {contextMenu && contextMenu.items.some(s => !s.finishedAt) && (
            <DropdownMenuItem
              onClick={() => {
                setConfirmAction({
                  type: "run",
                  items: contextMenu.items.filter(s => !s.finishedAt),
                });
                setContextMenu(null);
              }}
            >
              <IconSend className="mr-2 h-4 w-4" />
              Publicar agora
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {contextMenu && contextMenu.items.some(s => s.isActive) && (
            <DropdownMenuItem
              onClick={() => {
                setConfirmAction({
                  type: "pause",
                  items: contextMenu.items.filter(s => s.isActive),
                });
                setContextMenu(null);
              }}
            >
              <IconPlayerPause className="mr-2 h-4 w-4" />
              Pausar
            </DropdownMenuItem>
          )}

          {contextMenu && contextMenu.items.some(s => !s.isActive && !s.finishedAt) && (
            <DropdownMenuItem
              onClick={() => {
                setConfirmAction({
                  type: "resume",
                  items: contextMenu.items.filter(s => !s.isActive && !s.finishedAt),
                });
                setContextMenu(null);
              }}
            >
              <IconPlayerPlay className="mr-2 h-4 w-4" />
              Retomar
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              if (contextMenu) setConfirmAction({ type: "delete", items: contextMenu.items });
              setContextMenu(null);
            }}
            className="text-destructive"
          >
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.items.length > 1
              ? "Excluir selecionados"
              : "Excluir"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={open => {
          if (!open && !isConfirming) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialogCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();
                void runConfirmedAction();
              }}
              disabled={isConfirming}
              className={cn(
                confirmDialogCopy?.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {isConfirming ? "Aguarde..." : confirmDialogCopy?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MessageScheduleDetailDialog
        scheduleId={detailId}
        open={!!detailId}
        onOpenChange={open => !open && setDetailId(null)}
      />
    </div>
  );
}
