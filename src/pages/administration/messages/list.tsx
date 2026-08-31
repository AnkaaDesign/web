/**
 * Message List Page
 *
 * Duas tabelas, independentes uma da outra:
 *
 *   1. COMUNICADOS RECORRENTES — as REGRAS. Curta (10 por página, sem rolagem
 *      própria), porque um agendamento não é um registro que se folheia às
 *      centenas e a lista precisa caber acima da outra sem roubar a altura dela.
 *   2. MENSAGENS — o que foi de fato publicado, inclusive as ocorrências que os
 *      agendamentos geraram (marcadas com o ícone de repetição).
 *
 * Cada uma tem a SUA busca, os SEUS filtros e a SUA paginação: são recortes
 * diferentes de coisas diferentes, e um único campo de busca no topo daria a
 * impressão errada de que filtrar uma filtra a outra.
 */

import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes } from "../../../constants";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { MessageTable } from "@/components/administration/message/list/message-table";
import { MessageFilters } from "@/components/administration/message/list/message-filters";
import { MessageScheduleTable } from "@/components/administration/message/list/message-schedule-table";
import { MessageScheduleFilters } from "@/components/administration/message/list/message-schedule-filters";
import {
  IconPlus,
  IconFilter,
  IconX,
  IconMessagePlus,
  IconRepeat,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { SCHEDULE_FREQUENCY_LABELS } from "@/constants";
import type { MessageGetManyFormData } from "@/schemas/message";
import type { Message } from "@/types/message";
import type { MessageScheduleGetManyFormData } from "@/schemas/message-schedule";
import { cn } from "@/lib/utils";

// Filter indicator component
function FilterIndicator({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium">{value}</span>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-muted rounded-full p-0.5"
      >
        <IconX className="h-3 w-3" />
      </button>
    </Badge>
  );
}

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  finished: "Encerrado",
};

const SCHEDULE_TARGET_LABELS: Record<string, string> = {
  ALL: "Todos",
  SPECIFIC: "Usuários específicos",
  SECTOR: "Por setor",
  POSITION: "Por cargo",
};

/** Busca com atraso: uma consulta por tecla digitada é ruído, não resultado. */
function useDebouncedSearch() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const onChange = useCallback((value: string) => {
    setInput(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setTerm(value), 300);
  }, []);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setInput("");
    setTerm("");
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { input, term, onChange, clear, isPending: input !== term };
}

export const MessageListPage = () => {
  const navigate = useNavigate();

  // Context-aware trail: shared page — accounting users have root-level "Mensagens"
  // (no "Administração" section in their menu).
  const breadcrumbs = useNavBreadcrumbs([
    { label: "Início", href: "/" },
    { label: "Administração", href: "/administracao" },
    { label: "Mensagens" },
  ]);

  // ---- Mensagens ----
  const messageSearch = useDebouncedSearch();
  const [showMessageFilters, setShowMessageFilters] = useState(false);
  const [messageFilters, setMessageFilters] = useState<Partial<MessageGetManyFormData>>({});
  const [, setTableData] = useState<{ items: Message[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // ---- Comunicados recorrentes ----
  const scheduleSearch = useDebouncedSearch();
  const [showScheduleFilters, setShowScheduleFilters] = useState(false);
  const [scheduleFilters, setScheduleFilters] = useState<Partial<MessageScheduleGetManyFormData>>({});
  const [schedulesCollapsed, setSchedulesCollapsed] = useState(false);
  const [scheduleTotal, setScheduleTotal] = useState<number | null>(null);

  const handleFilterChange = useCallback((newFilters: Partial<MessageGetManyFormData>) => {
    setMessageFilters(newFilters);
  }, []);

  const handleScheduleFilterChange = useCallback(
    (newFilters: Partial<MessageScheduleGetManyFormData>) => {
      setScheduleFilters(newFilters);
    },
    [],
  );

  const handleScheduleDataChange = useCallback(
    ({ totalRecords }: { totalRecords: number }) => setScheduleTotal(totalRecords),
    [],
  );

  const queryFilters = useMemo(() => ({
    ...messageFilters,
    searchingFor: messageSearch.term || undefined,
  }), [messageFilters, messageSearch.term]);

  const scheduleQueryFilters = useMemo(() => ({
    ...scheduleFilters,
    searchingFor: scheduleSearch.term || undefined,
  }), [scheduleFilters, scheduleSearch.term]);

  // Extract active filters for indicators
  const activeFilters = useMemo(() => {
    const indicators: { label: string; value: string; onRemove: () => void }[] = [];

    if (messageSearch.term) {
      indicators.push({
        label: "Busca",
        value: messageSearch.term,
        onRemove: messageSearch.clear,
      });
    }

    if (messageFilters.status?.length) {
      const statusLabels: Record<string, string> = {
        draft: "Rascunho",
        scheduled: "Agendada",
        active: "Ativa",
        expired: "Expirada",
        archived: "Arquivada",
      };
      const statusText = messageFilters.status.map(s => statusLabels[s] || s).join(", ");
      indicators.push({
        label: "Status",
        value: statusText,
        onRemove: () => setMessageFilters((prev) => ({ ...prev, status: undefined })),
      });
    }

    if (messageFilters.recipientIds?.length) {
      indicators.push({
        label: "Destinatários",
        value: `${messageFilters.recipientIds.length} selecionado(s)`,
        onRemove: () => setMessageFilters((prev) => ({ ...prev, recipientIds: undefined })),
      });
    }

    if ((messageFilters as any).sectorIds?.length) {
      indicators.push({
        label: "Setores",
        value: `${(messageFilters as any).sectorIds.length} selecionado(s)`,
        onRemove: () => setMessageFilters((prev) => ({ ...prev, sectorIds: undefined } as any)),
      });
    }

    if (messageFilters.createdAt) {
      indicators.push({
        label: "Período",
        value: "Filtrado",
        onRemove: () => setMessageFilters((prev) => ({ ...prev, createdAt: undefined })),
      });
    }

    return indicators;
  }, [messageSearch.term, messageSearch.clear, messageFilters]);

  const activeScheduleFilters = useMemo(() => {
    const indicators: { label: string; value: string; onRemove: () => void }[] = [];

    if (scheduleSearch.term) {
      indicators.push({
        label: "Busca",
        value: scheduleSearch.term,
        onRemove: scheduleSearch.clear,
      });
    }

    if (scheduleFilters.status?.length) {
      indicators.push({
        label: "Situação",
        value: scheduleFilters.status.map(s => SCHEDULE_STATUS_LABELS[s] ?? s).join(", "),
        onRemove: () => setScheduleFilters(prev => ({ ...prev, status: undefined })),
      });
    }

    if (scheduleFilters.frequency?.length) {
      indicators.push({
        label: "Repetição",
        value: scheduleFilters.frequency
          .map(f => SCHEDULE_FREQUENCY_LABELS[f] ?? f)
          .join(", "),
        onRemove: () => setScheduleFilters(prev => ({ ...prev, frequency: undefined })),
      });
    }

    if (scheduleFilters.targetType?.length) {
      indicators.push({
        label: "Público",
        value: scheduleFilters.targetType
          .map(t => SCHEDULE_TARGET_LABELS[t] ?? t)
          .join(", "),
        onRemove: () => setScheduleFilters(prev => ({ ...prev, targetType: undefined })),
      });
    }

    return indicators;
  }, [scheduleSearch.term, scheduleSearch.clear, scheduleFilters]);

  const clearAllFilters = useCallback(() => {
    messageSearch.clear();
    setMessageFilters({});
  }, [messageSearch]);

  const clearAllScheduleFilters = useCallback(() => {
    scheduleSearch.clear();
    setScheduleFilters({});
  }, [scheduleSearch]);

  const hasActiveFilters = activeFilters.length > 0;
  const hasActiveScheduleFilters = activeScheduleFilters.length > 0;

  // Sem agendamento NENHUM e sem filtro aplicado a faixa some — quem nunca usou
  // recorrência vê a página como antes. Com filtro aplicado ela fica, senão o
  // "nenhum resultado" desapareceria junto com a busca que o produziu.
  const showSchedules = scheduleTotal === null || scheduleTotal > 0 || hasActiveScheduleFilters;

  return (
    <PrivilegeRoute>
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Mensagens"
          icon={IconMessagePlus}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR}
          breadcrumbs={breadcrumbs}
          className="flex-shrink-0"
          actions={[
            {
              key: "create",
              label: "Nova Mensagem",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.messages?.create || "/administracao/mensagens/criar"),
              variant: "default",
            },
          ]}
        />

        {/* A faixa de recorrentes cresce com o número de regras (até 10 linhas),
            e a de mensagens não pode ser espremida a nada por causa disso: ela
            tem altura mínima própria e, quando as duas juntas não cabem, quem
            rola é a página. */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-6 flex flex-col mt-4 gap-4">
          {/* ---- Comunicados recorrentes: as REGRAS ---- */}
          <Card
            className={cn(
              "flex flex-col shadow-sm border border-border flex-shrink-0",
              !showSchedules && "hidden",
            )}
          >
            <CardContent className="flex flex-col p-4 gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSchedulesCollapsed(c => !c)}
                  className="flex items-center gap-2 text-left"
                >
                  {schedulesCollapsed ? (
                    <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <IconRepeat className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Mensagens recorrentes</span>
                  {scheduleTotal !== null && (
                    <Badge variant="secondary" className="ml-1">
                      {scheduleTotal}
                    </Badge>
                  )}
                </button>
                <span className="ml-auto text-xs text-muted-foreground">
                  As publicações geradas aparecem na tabela abaixo
                </span>
              </div>

              {!schedulesCollapsed && (
                <>
                  {/* Busca e filtros PRÓPRIOS desta tabela */}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <TableSearchInput
                      value={scheduleSearch.input}
                      onChange={scheduleSearch.onChange}
                      placeholder="Buscar recorrente por título..."
                      isPending={scheduleSearch.isPending}
                      className="flex-1"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant={hasActiveScheduleFilters ? "default" : "outline"}
                        onClick={() => setShowScheduleFilters(true)}
                      >
                        <IconFilter className="h-4 w-4 mr-2" />
                        Filtros
                        {hasActiveScheduleFilters && ` (${activeScheduleFilters.length})`}
                      </Button>
                    </div>
                  </div>

                  {activeScheduleFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t">
                      {activeScheduleFilters.map((filter, index) => (
                        <FilterIndicator
                          key={index}
                          label={filter.label}
                          value={filter.value}
                          onRemove={filter.onRemove}
                        />
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllScheduleFilters}
                        className="h-6 px-2 text-xs"
                      >
                        Limpar todos
                      </Button>
                    </div>
                  )}

                  <MessageScheduleTable
                    filters={scheduleQueryFilters}
                    onDataChange={handleScheduleDataChange}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* ---- Mensagens publicadas ---- */}
          <Card className={cn("flex flex-col shadow-sm border border-border flex-1 min-h-[420px]")}>
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              {/* Search and Filter Controls */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <TableSearchInput
                  value={messageSearch.input}
                  onChange={messageSearch.onChange}
                  placeholder="Buscar por título..."
                  isPending={messageSearch.isPending}
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    onClick={() => setShowMessageFilters(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {hasActiveFilters && ` (${activeFilters.length})`}
                  </Button>
                </div>
              </div>

              {/* Active Filter Indicators */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  {activeFilters.map((filter, index) => (
                    <FilterIndicator
                      key={index}
                      label={filter.label}
                      value={filter.value}
                      onRemove={filter.onRemove}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-6 px-2 text-xs"
                  >
                    Limpar todos
                  </Button>
                </div>
              )}

              {/* Table */}
              <div className="flex-1 min-h-0 overflow-auto">
                <MessageTable
                  filters={queryFilters}
                  onDataChange={setTableData}
                  className="h-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Drawers — um por tabela */}
      <MessageFilters
        open={showMessageFilters}
        onOpenChange={setShowMessageFilters}
        filters={messageFilters}
        onFilterChange={handleFilterChange}
      />
      <MessageScheduleFilters
        open={showScheduleFilters}
        onOpenChange={setShowScheduleFilters}
        filters={scheduleFilters}
        onFilterChange={handleScheduleFilterChange}
      />
    </PrivilegeRoute>
  );
};
