// /estatisticas/recursos-humanos/competencias
//
// Cross-campaign Skill-Assessment statistics. Mirrors the structural pattern
// of /estatisticas/producao/produtividade (the productivity page) — the user
// composes the view via X-axis × Y-axis × Compare instead of picking from
// hardcoded presets. The page multiplexes between the three backend
// endpoints (overview / comparison / evolution) based on that composition.
//
// All charts use ECharts via the shared StatisticsChart / StatisticsRadarChart.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  IconAlertCircle,
  IconBuilding,
  IconChartArcs3,
  IconChartArea,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconDownload,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFilter,
  IconRadar,
  IconRefresh,
  IconStack2,
  IconStar,
  IconTrendingUp,
  IconUsers,
  IconX,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';

import {
  StatisticsChart,
  type StatisticsChartHandle,
} from '@/components/statistics/statistics-chart';
import {
  StatisticsRadarChart,
  type StatisticsRadarChartHandle,
} from '@/components/statistics/statistics-radar-chart';
import {
  SkillStatsEntriesModal,
  type SkillStatsClickContext,
} from '@/components/human-resources/statistics/skill-stats-entries-modal';

import { CHART_COLORS, formatNumber, formatPercentage } from '@/types/statistics-common';
import type { StatisticsChartType, TrendLineType, YAxisMode } from '@/types/statistics-common';
import type {
  SkillStatsBaseFilters,
  SkillStatsChartType,
  SkillStatsComparisonMode,
  SkillStatsCompareMode,
  SkillStatsEvolutionMode,
  SkillStatsXAxisMode,
  SkillStatsYAxisMode,
} from '@/types/skill-analytics';

import {
  useSkillStatsOverview,
  useSkillStatsComparison,
  useSkillStatsEvolution,
} from '@/hooks/skill/use-skill-analytics';
import { usePageTracker } from '@/hooks/common/use-page-tracker';

import { getAssessments } from '@/api-client/assessment';
import { getPositions } from '@/api-client/position';
import { getSectors } from '@/api-client/sector';
import { getSkills } from '@/api-client/skill';
import { getTopics } from '@/api-client/topic';
import { getUsers } from '@/api-client/user';
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from '@/constants';
import { cn } from '@/lib/utils';

// =====================
// Constants
// =====================

const COMBOBOX_PAGE_SIZE = 20;

const SCORE_LEVEL_LABELS = [
  'Não atende',
  'Crítico',
  'Insuficiente',
  'Atende parcialmente',
  'Atende',
  'Referência',
] as const;

// Hard cap on series when comparing many skills under a single sector/user X.
// Above this we'd render an unreadable rainbow; truncate to the top N per row.
const MAX_SKILL_SERIES = 10;
const TOP_N_USERS_DEFAULT = 15;
const TOP_N_TOPICS_DEFAULT = 20;

type XOption = { value: SkillStatsXAxisMode; label: string; icon: typeof IconChartBar; description: string };

const X_AXIS_OPTIONS: XOption[] = [
  { value: 'skill',    label: 'Competência', icon: IconRadar,      description: 'Uma barra/eixo por competência' },
  { value: 'topic',    label: 'Tópico',      icon: IconChartBar,   description: 'Uma barra/eixo por tópico' },
  { value: 'sector',   label: 'Setor',       icon: IconBuilding,   description: 'Ranking ou média por setor' },
  { value: 'user',     label: 'Colaborador', icon: IconUsers,      description: 'Ranking ou média por colaborador' },
  { value: 'campaign', label: 'Campanha (Tempo)', icon: IconChartLine, description: 'Evolução ao longo das campanhas' },
];

type YOption = { value: SkillStatsYAxisMode; label: string; description: string };

const Y_AXIS_OPTIONS: YOption[] = [
  { value: 'averageScore', label: 'Média de Pontuação (0–5)', description: 'Média das notas no escopo' },
  { value: 'volume',       label: 'Volume',                   description: 'Quantidade (avaliados / respostas)' },
  { value: 'distribution', label: 'Distribuição de Notas',    description: 'Histograma de notas 0–5' },
];

type CompareOption = { value: SkillStatsCompareMode; label: string; description: string };

const COMPARE_MODE_OPTIONS: CompareOption[] = [
  { value: 'none',     label: 'Sem comparação', description: 'Uma única série' },
  { value: 'sector',   label: 'Setor',          description: 'Uma série por setor selecionado' },
  { value: 'position', label: 'Cargo',          description: 'Uma série por cargo selecionado' },
  { value: 'user',     label: 'Colaborador',    description: 'Uma série por colaborador selecionado' },
  { value: 'skill',    label: 'Competência',    description: 'Médias por competência como séries' },
];

type ChartTypeOption = {
  value: SkillStatsChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
};

const CHART_TYPE_CATALOG: Record<SkillStatsChartType, ChartTypeOption> = {
  'bar':         { value: 'bar',         label: 'Colunas',          icon: IconChartBar,  description: 'Colunas verticais' },
  'bar-stacked': { value: 'bar-stacked', label: 'Colunas Empilhadas', icon: IconStack2,  description: 'Séries empilhadas' },
  'line':        { value: 'line',        label: 'Linha Reta',       icon: IconChartLine, description: 'Linhas retas' },
  'line-smooth': { value: 'line-smooth', label: 'Linha Suave',      icon: IconChartLine, description: 'Linhas suavizadas' },
  'area':        { value: 'area',        label: 'Área Reta',        icon: IconChartArea, description: 'Área preenchida' },
  'area-smooth': { value: 'area-smooth', label: 'Área Suave',       icon: IconChartArea, description: 'Área suavizada' },
  'radar':       { value: 'radar',       label: 'Radar',            icon: IconChartPie,  description: 'Radar multidimensional' },
};

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3 pts', sma6: 'Média 6 pts', sma12: 'Média 12 pts',
};

const formatAvg = (v: number | null | undefined): string =>
  v == null ? '—' : v.toFixed(2);

// Cascade-prune helper: drop child ids whose parent is no longer in the
// allowed set. Conservative — if the parent is unknown (not yet hydrated in
// the map), keep the child so we don't wipe selections we haven't verified.
function pruneChildIds(
  childIds: string[] | undefined,
  parentIds: string[],
  childToParent: Map<string, string>,
): string[] {
  if (!childIds?.length) return [];
  if (!parentIds.length) return childIds;
  const allowed = new Set(parentIds);
  return childIds.filter(id => {
    const parent = childToParent.get(id);
    return !parent || allowed.has(parent);
  });
}

// =====================
// Composition rules
// =====================

// Which Y-axis metrics are valid for each X dimension.
function availableYsFor(x: SkillStatsXAxisMode): SkillStatsYAxisMode[] {
  switch (x) {
    case 'skill':
    case 'topic':
      return ['averageScore', 'distribution', ...(x === 'topic' ? (['volume'] as const) : [])];
    case 'sector':
      return ['averageScore', 'volume'];
    case 'user':
    case 'campaign':
      return ['averageScore'];
  }
}

// Which compare modes are valid for each (X, Y) combination.
function availableComparesFor(x: SkillStatsXAxisMode, y: SkillStatsYAxisMode): SkillStatsCompareMode[] {
  if (y === 'distribution') return ['none'];
  if (y === 'volume') return ['none'];
  switch (x) {
    case 'skill':
      // 'position' is derived client-side from overview.byUser (needs
      // perSkillAverage), so it only works here.
      return ['none', 'sector', 'user', 'position'];
    case 'topic':
      return ['none', 'sector', 'user'];
    case 'sector':
    case 'user':
      return ['none', 'skill'];
    case 'campaign':
      return ['none', 'sector', 'user'];
  }
}

// Which chart types are valid for each (X, Y, compare) combination.
function availableChartTypesFor(
  x: SkillStatsXAxisMode,
  y: SkillStatsYAxisMode,
  c: SkillStatsCompareMode,
): SkillStatsChartType[] {
  if (y === 'distribution') return ['bar-stacked'];
  if (x === 'campaign') {
    return c === 'none'
      ? ['line', 'line-smooth', 'area', 'area-smooth', 'bar']
      : ['line', 'line-smooth'];
  }
  if (x === 'skill' || x === 'topic') {
    if (c === 'none') return ['bar', 'radar'];
    return ['bar', 'bar-stacked', 'radar'];
  }
  // sector / user
  if (c === 'none') return ['bar'];
  return ['bar', 'bar-stacked'];
}

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Composition. There's no compareMode prop — comparison is fully derived
  // from filter selection counts at the page level (≥2 of any entity type
  // becomes a comparison series; 1 narrows scope).
  xAxisMode: SkillStatsXAxisMode;
  yAxisMode: SkillStatsYAxisMode;
  filters: SkillStatsBaseFilters;

  onApply: (next: {
    xAxisMode: SkillStatsXAxisMode;
    yAxisMode: SkillStatsYAxisMode;
    filters: SkillStatsBaseFilters;
  }) => void;
}

function SkillStatsFilterSheet({
  open,
  onOpenChange,
  xAxisMode,
  yAxisMode,
  filters,
  onApply,
}: FilterSheetProps) {
  const [localX, setLocalX] = useState<SkillStatsXAxisMode>(xAxisMode);
  const [localY, setLocalY] = useState<SkillStatsYAxisMode>(yAxisMode);
  const [local, setLocal] = useState<SkillStatsBaseFilters>(filters);

  useEffect(() => {
    if (!open) return;
    setLocalX(xAxisMode);
    setLocalY(yAxisMode);
    setLocal(filters);
  }, [open, xAxisMode, yAxisMode, filters]);

  // Auto-correct local Y when local X changes inside the sheet.
  useEffect(() => {
    const validYs = availableYsFor(localX);
    if (!validYs.includes(localY)) setLocalY(validYs[0]);
  }, [localX, localY]);

  // ---- Async fetchers (kept inside sheet for query-key locality) ----

  const fetchAssessments = useCallback(async (search: string, page = 1) => {
    const res = await getAssessments({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      orderBy: [{ periodEnd: 'desc' }],
    } as any);
    return {
      data: (res.data ?? []).map((a: any) => ({
        value: a.id,
        label: a.name,
        description: a.periodEnd ? format(new Date(a.periodEnd), 'dd/MM/yyyy') : undefined,
      })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, []);

  // All sector pickers in this page are scoped to PRODUCTION sectors —
  // skill-assessment is only meaningful for the production team.
  const fetchSectors = useCallback(async (search: string, page = 1) => {
    const res = await getSectors({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      privilege: SECTOR_PRIVILEGES.PRODUCTION,
    } as any);
    return {
      data: (res.data ?? []).map((s: any) => ({ value: s.id, label: s.name })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, []);

  const fetchPositions = useCallback(async (search: string, page = 1) => {
    const res = await getPositions({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      orderBy: [{ hierarchy: 'desc' }, { name: 'asc' }],
    } as any);
    return {
      data: (res.data ?? []).map((p: any) => ({ value: p.id, label: p.name })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, []);

  const fetchSkills = useCallback(async (search: string, page = 1) => {
    const res = await getSkills({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    } as any);
    return {
      data: (res.data ?? []).map((s: any) => ({ value: s.id, label: s.name })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, []);

  // ── Parent → child cascade infrastructure ───────────────────────────────
  //
  // Topics belong to a skill; users belong to a sector. The dropdown query
  // already narrows the OPTIONS shown, but selected child ids can outlive
  // their parent (user picks topics, then removes the parent skill) — which
  // creates ghost selections and surprising empty charts at the backend.
  //
  // We maintain a child→parent map (ref-stored to dodge re-renders) and prune
  // child ids whenever the parent set shrinks. The map is populated:
  //   - opportunistically from every dropdown fetch, and
  //   - on sheet-open via a targeted lookup for any already-selected child
  //     whose parent we don't know yet.
  const topicSkillMapRef = useRef<Map<string, string>>(new Map());
  const userSectorMapRef = useRef<Map<string, string>>(new Map());
  const userPositionMapRef = useRef<Map<string, string>>(new Map());

  // Topics narrow by skillIds — drives the cascading filter.
  const narrowSkillIds = local.skillIds && local.skillIds.length > 0 ? local.skillIds : undefined;
  const fetchTopics = useCallback(async (search: string, page = 1) => {
    const res = await getTopics({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      skillIds: narrowSkillIds,
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
    } as any);
    (res.data ?? []).forEach((t: any) => {
      if (t?.id && t?.skillId) topicSkillMapRef.current.set(t.id, t.skillId);
    });
    return {
      data: (res.data ?? []).map((t: any) => ({
        value: t.id,
        label: t.title,
        description: t.skill?.name,
      })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, [narrowSkillIds]);

  // Users cascade-narrow by BOTH sectorIds AND positionIds — picking either
  // (or both) restricts the options to users matching the intersection.
  const narrowSectorIds = local.sectorIds && local.sectorIds.length > 0 ? local.sectorIds : undefined;
  const narrowPositionIds = local.positionIds && local.positionIds.length > 0 ? local.positionIds : undefined;
  const fetchUsers = useCallback(async (search: string, page = 1) => {
    const res = await getUsers({
      where: {
        isActive: true,
        ...(narrowSectorIds ? { sectorId: { in: narrowSectorIds } } : {}),
        ...(narrowPositionIds ? { positionId: { in: narrowPositionIds } } : {}),
      },
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    } as any);
    (res.data ?? []).forEach((u: any) => {
      if (u?.id && u?.sectorId) userSectorMapRef.current.set(u.id, u.sectorId);
      if (u?.id && u?.positionId) userPositionMapRef.current.set(u.id, u.positionId);
    });
    return {
      data: (res.data ?? []).map((u: any) => ({
        value: u.id,
        label: u.name,
        description: u.sector?.name,
      })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, [narrowSectorIds, narrowPositionIds]);

  // Hydrate maps on sheet-open for pre-selected children whose parent we
  // don't know yet (state restored from URL / persisted filter, etc.). This
  // ensures the prune logic above has the data it needs the first time the
  // user touches the parent selector.
  //
  // After hydration completes we re-run the prune against the CURRENT local
  // selection (not the original filters) — covers the race where the user
  // changes the parent selector before hydration finishes, which would
  // otherwise leave ghost children whose parent was just removed.
  useEffect(() => {
    if (!open) return;
    const selected = filters.topicIds ?? [];
    const unknown = selected.filter(id => !topicSkillMapRef.current.has(id));
    if (!unknown.length) return;
    let cancelled = false;
    getTopics({ where: { id: { in: unknown } }, limit: unknown.length } as any)
      .then(res => {
        if (cancelled) return;
        (res.data ?? []).forEach((t: any) => {
          if (t?.id && t?.skillId) topicSkillMapRef.current.set(t.id, t.skillId);
        });
        setLocal(prev => {
          const skills = prev.skillIds ?? [];
          if (!skills.length || !prev.topicIds?.length) return prev;
          const pruned = pruneChildIds(prev.topicIds, skills, topicSkillMapRef.current);
          if (pruned.length === prev.topicIds.length) return prev;
          return { ...prev, topicIds: pruned };
        });
      })
      .catch(() => { /* swallow — prune is conservative for unknown ids */ });
    return () => { cancelled = true; };
  }, [open, filters.topicIds]);

  useEffect(() => {
    if (!open) return;
    const selected = filters.userIds ?? [];
    const unknown = selected.filter(id =>
      !userSectorMapRef.current.has(id) || !userPositionMapRef.current.has(id),
    );
    if (!unknown.length) return;
    let cancelled = false;
    getUsers({ where: { id: { in: unknown }, isActive: true }, limit: unknown.length } as any)
      .then(res => {
        if (cancelled) return;
        (res.data ?? []).forEach((u: any) => {
          if (u?.id && u?.sectorId) userSectorMapRef.current.set(u.id, u.sectorId);
          if (u?.id && u?.positionId) userPositionMapRef.current.set(u.id, u.positionId);
        });
        setLocal(prev => {
          if (!prev.userIds?.length) return prev;
          let pruned = prev.userIds;
          if (prev.sectorIds?.length) {
            pruned = pruneChildIds(pruned, prev.sectorIds, userSectorMapRef.current);
          }
          if (prev.positionIds?.length) {
            pruned = pruneChildIds(pruned, prev.positionIds, userPositionMapRef.current);
          }
          if (pruned.length === prev.userIds.length) return prev;
          return { ...prev, userIds: pruned };
        });
      })
      .catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [open, filters.userIds]);

  const handleApply = () => {
    onApply({
      xAxisMode: localX,
      yAxisMode: localY,
      filters: local,
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalX('skill');
    setLocalY('averageScore');
    setLocal({});
  };

  const yOptions = availableYsFor(localX);
  // Count summary used by the per-picker hints below.
  const nSectors   = local.sectorIds?.length ?? 0;
  const nPositions = local.positionIds?.length ?? 0;
  const nUsers     = local.userIds?.length ?? 0;
  const nSkills    = local.skillIds?.length ?? 0;
  const nTopics    = local.topicIds?.length ?? 0;

  // Mirror the page's derivation locally so each picker can show the user
  // exactly what its count means right now.
  const localEffX: SkillStatsXAxisMode = (localX === 'skill' && nTopics >= 2) ? 'topic' : localX;
  const localIsContent  = localEffX === 'skill' || localEffX === 'topic';
  const localIsCampaign = localEffX === 'campaign';
  const localIsPerson   = localEffX === 'sector' || localEffX === 'user';
  const localCmpMode: SkillStatsCompareMode = (() => {
    if (localY !== 'averageScore') return 'none';
    if (localIsContent || localIsCampaign) {
      if (nUsers >= 2) return 'user';
      if (!localIsCampaign && nPositions >= 2) return 'position';
      if (nSectors >= 2) return 'sector';
      return 'none';
    }
    if (localIsPerson) {
      if (nSkills >= 2) return 'skill';
      return 'none';
    }
    return 'none';
  })();
  const noteCompare = (mode: SkillStatsCompareMode, count: number) => {
    if (localCmpMode === mode) return `Comparando ${count} como séries do gráfico.`;
    if (localCmpMode === 'none') return 'Filtro de escopo apenas (comparação indisponível neste eixo).';
    const label = COMPARE_MODE_OPTIONS.find(o => o.value === localCmpMode)?.label;
    return `Filtro de escopo (comparação mais específica ativa: ${label}).`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
          </SheetTitle>
          <SheetDescription>
            Componha os eixos e refine o escopo da análise.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 pb-4">
          <div className="space-y-5 py-2">

            {/* X-axis dimension */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartArcs3 className="h-4 w-4" />
                Eixo X (Dimensão)
              </Label>
              <Combobox
                value={localX}
                onValueChange={v => v && setLocalX(v as SkillStatsXAxisMode)}
                options={X_AXIS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                clearable={false}
                searchable={false}
              />
              <p className="text-xs text-muted-foreground">
                {X_AXIS_OPTIONS.find(o => o.value === localX)?.description}
              </p>
            </div>

            {/* Y-axis metric */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconStar className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => v && setLocalY(v as SkillStatsYAxisMode)}
                options={Y_AXIS_OPTIONS.filter(o => yOptions.includes(o.value)).map(o => ({ value: o.value, label: o.label }))}
                clearable={false}
                searchable={false}
              />
              <p className="text-xs text-muted-foreground">
                {Y_AXIS_OPTIONS.find(o => o.value === localY)?.description}
              </p>
            </div>

            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              Selecione 1 entidade para <strong>filtrar</strong> o escopo (ela
                também restringe as opções dos filtros filhos). Selecione 2+
              entidades de um mesmo tipo para <strong>compará-las</strong> como
              séries no gráfico. Prioridade da comparação:
              colaborador &gt; cargo &gt; setor.
            </div>

            {/* Campaigns — pure scope, no comparison axis. */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Campanhas</Label>
              <Combobox
                mode="multiple"
                async
                queryKey={['skill-stats-assessments']}
                queryFn={fetchAssessments}
                minSearchLength={0}
                value={local.assessmentIds ?? []}
                onValueChange={v =>
                  setLocal(prev => ({ ...prev, assessmentIds: Array.isArray(v) ? v : v ? [v] : [] }))
                }
                placeholder="Todas as campanhas"
              />
            </div>

            {/* Sectors — cascades to Cargos and Colaboradores. */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Setores</Label>
              <Combobox
                mode="multiple"
                async
                queryKey={['skill-stats-sectors']}
                queryFn={fetchSectors}
                minSearchLength={0}
                value={local.sectorIds ?? []}
                onValueChange={v => {
                  const nextSectors = Array.isArray(v) ? v : v ? [v] : [];
                  setLocal(prev => ({
                    ...prev,
                    sectorIds: nextSectors,
                    // Cascade: drop any selected user whose sector is no longer
                    // in scope. Atomic so the API can't see a transient state.
                    userIds: pruneChildIds(prev.userIds, nextSectors, userSectorMapRef.current),
                  }));
                }}
                placeholder="Todos os setores"
              />
              {nSectors === 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Filtrando colaboradores deste setor.
                </p>
              )}
              {nSectors >= 2 && (
                <p className="text-[11px] text-muted-foreground">{noteCompare('sector', nSectors)}</p>
              )}
            </div>

            {/* Positions (Cargos) — cascades to Colaboradores. Client-only filter:
                the API doesn't accept positionIds yet, so 1-position-selected
                narrows the Colaboradores picker (cascade) but does not restrict
                the chart server-side. 2+ becomes a client-derived comparison
                from overview.byUser. */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cargos</Label>
              <Combobox
                mode="multiple"
                async
                queryKey={['skill-stats-positions']}
                queryFn={fetchPositions}
                minSearchLength={0}
                value={local.positionIds ?? []}
                onValueChange={v => {
                  const nextPositions = Array.isArray(v) ? v : v ? [v] : [];
                  setLocal(prev => ({
                    ...prev,
                    positionIds: nextPositions,
                    userIds: pruneChildIds(prev.userIds, nextPositions, userPositionMapRef.current),
                  }));
                }}
                placeholder="Todos os cargos"
              />
              {nPositions === 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Filtrando colaboradores deste cargo (escopo client-side).
                </p>
              )}
              {nPositions >= 2 && (
                <p className="text-[11px] text-muted-foreground">{noteCompare('position', nPositions)}</p>
              )}
            </div>

            {/* Users — cascades from sectorIds AND positionIds. */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Colaboradores</Label>
              <Combobox
                mode="multiple"
                async
                queryKey={['skill-stats-users', narrowSectorIds, narrowPositionIds]}
                queryFn={fetchUsers}
                minSearchLength={0}
                value={local.userIds ?? []}
                onValueChange={v =>
                  setLocal(prev => ({ ...prev, userIds: Array.isArray(v) ? v : v ? [v] : [] }))
                }
                placeholder={
                  narrowSectorIds || narrowPositionIds
                    ? 'Colaboradores no escopo selecionado'
                    : 'Todos os colaboradores'
                }
              />
              {nUsers === 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Visão individual deste colaborador.
                </p>
              )}
              {nUsers >= 2 && (
                <p className="text-[11px] text-muted-foreground">{noteCompare('user', nUsers)}</p>
              )}
            </div>

            {/* Skills — cascades to Tópicos. */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Competências</Label>
              <Combobox
                mode="multiple"
                async
                queryKey={['skill-stats-skills']}
                queryFn={fetchSkills}
                minSearchLength={0}
                value={local.skillIds ?? []}
                onValueChange={v => {
                  const nextSkills = Array.isArray(v) ? v : v ? [v] : [];
                  setLocal(prev => ({
                    ...prev,
                    skillIds: nextSkills,
                    topicIds: pruneChildIds(prev.topicIds, nextSkills, topicSkillMapRef.current),
                  }));
                }}
                placeholder="Todas as competências"
              />
              {nSkills === 1 && (
                <p className="text-[11px] text-muted-foreground">
                  Filtrando tópicos desta competência.
                </p>
              )}
              {nSkills >= 2 && (
                <p className="text-[11px] text-muted-foreground">{noteCompare('skill', nSkills)}</p>
              )}
            </div>

            {/* Topics (cascades from skillIds) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tópicos</Label>
              <Combobox
                mode="multiple"
                async
                queryKey={['skill-stats-topics', narrowSkillIds]}
                queryFn={fetchTopics}
                minSearchLength={0}
                value={local.topicIds ?? []}
                onValueChange={v =>
                  setLocal(prev => ({ ...prev, topicIds: Array.isArray(v) ? v : v ? [v] : [] }))
                }
                placeholder={narrowSkillIds ? 'Tópicos das competências selecionadas' : 'Todos os tópicos'}
              />
              {nTopics >= 2 && localX === 'skill' && (
                <p className="text-[11px] text-muted-foreground">
                  Eixo X auto-promovido para <strong>Tópico</strong> — os {nTopics} tópicos
                  serão exibidos como barras.
                </p>
              )}
              {nTopics > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Tópicos têm precedência — o filtro de competências é ignorado
                  enquanto houver tópicos escolhidos.
                </p>
              )}
            </div>

          </div>
        </ScrollArea>

        <div className="flex-shrink-0 border-t bg-background px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClear}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// Main Page
// =====================

export const HRSkillAssessmentStatisticsPage = () => {
  usePageTracker({
    title: 'Estatísticas de Competências',
    icon: 'radar',
  });

  // --- Composition state ---
  // xAxisModeRaw is the user's explicit choice; xAxisMode (below) is the
  // effective value after a smart-default promotion (skill → topic when the
  // user has picked 2+ topics but hasn't customized X). Manual X choices are
  // always respected.
  const [xAxisModeRaw, setXAxisMode]  = useState<SkillStatsXAxisMode>('skill');
  const [yAxisMode, setYAxisMode]     = useState<SkillStatsYAxisMode>('averageScore');
  const [filters, setFilters]         = useState<SkillStatsBaseFilters>({});
  const [chartType, setChartType]     = useState<SkillStatsChartType>('bar');
  const [trendLine, setTrendLine]     = useState<TrendLineType | null>(null);
  const [radarShape, setRadarShape]   = useState<'polygon' | 'circle'>('polygon');
  const [showFilters, setShowFilters] = useState(false);

  // Smart-X default: when the user is on the default 'skill' axis and picks
  // 2+ topics, surface those topics as bars instead. Once they manually change
  // X (to anything other than 'skill'), respect that choice unconditionally.
  const xAxisMode = useMemo<SkillStatsXAxisMode>(() => {
    if (xAxisModeRaw === 'skill' && (filters.topicIds?.length ?? 0) >= 2) return 'topic';
    return xAxisModeRaw;
  }, [xAxisModeRaw, filters.topicIds]);

  // Derive comparison entirely from selection counts. Most-specific wins on
  // the WHO axis (user > position > sector); skill comparison drives the WHAT
  // axis when X is a person dimension.
  const { compareMode, compareEntityIds } = useMemo<{
    compareMode: SkillStatsCompareMode;
    compareEntityIds: string[];
  }>(() => {
    // Distribution / volume render single-value bars — no comparison series.
    if (yAxisMode !== 'averageScore') return { compareMode: 'none', compareEntityIds: [] };

    const isContent  = xAxisMode === 'skill' || xAxisMode === 'topic';
    const isCampaign = xAxisMode === 'campaign';
    const isPerson   = xAxisMode === 'sector' || xAxisMode === 'user';

    if (isContent || isCampaign) {
      if ((filters.userIds?.length ?? 0) >= 2)
        return { compareMode: 'user', compareEntityIds: filters.userIds! };
      // Position comparison is client-derived from overview.byUser.perSkillAverage —
      // only supported on X='skill'. byUser has no perTopicAverage, and evolution
      // has no per-position breakdown, so X='topic' and X='campaign' fall through.
      if (xAxisMode === 'skill' && (filters.positionIds?.length ?? 0) >= 2)
        return { compareMode: 'position', compareEntityIds: filters.positionIds! };
      if ((filters.sectorIds?.length ?? 0) >= 2)
        return { compareMode: 'sector', compareEntityIds: filters.sectorIds! };
      return { compareMode: 'none', compareEntityIds: [] };
    }

    if (isPerson) {
      // Skill comparison is client-derived from overview.bySector|byUser; the
      // server doesn't support compare-by-skill.
      if ((filters.skillIds?.length ?? 0) >= 2)
        return { compareMode: 'skill', compareEntityIds: filters.skillIds! };
      return { compareMode: 'none', compareEntityIds: [] };
    }
    return { compareMode: 'none', compareEntityIds: [] };
  }, [xAxisMode, yAxisMode, filters.userIds, filters.positionIds, filters.sectorIds, filters.skillIds]);

  const chartRef = useRef<StatisticsChartHandle>(null);
  const radarRef = useRef<StatisticsRadarChartHandle>(null);

  // Drill-down modal — opens when the user clicks a chart bar or a KPI card.
  // `baseFiltersOverride` is a *partial* merged on top of apiFilters at render
  // time, so callers can widen scope without re-stating the global filters.
  // The "Taxa de Submissão" card needs this to flip `includeInProgress: true`,
  // since PENDING/IN_PROGRESS entries are excluded from the default view.
  const [modalOpen, setModalOpen] = useState(false);
  const [clickContext, setClickContext] = useState<SkillStatsClickContext | null>(null);
  const [baseFiltersOverride, setBaseFiltersOverride] = useState<Partial<SkillStatsBaseFilters> | null>(null);
  const openModalWithContext = useCallback((
    ctx: SkillStatsClickContext | null,
    override?: Partial<SkillStatsBaseFilters>,
  ) => {
    setClickContext(ctx);
    setBaseFiltersOverride(override ?? null);
    setModalOpen(true);
  }, []);

  // --- Derived flags ---
  const useEvolution  = xAxisMode === 'campaign';
  const useComparison =
    (compareMode === 'sector' || compareMode === 'user') &&
    (xAxisMode === 'skill' || xAxisMode === 'topic');
  const useOverview = !useEvolution && !useComparison;

  const evolutionMode: SkillStatsEvolutionMode =
    compareMode === 'sector' ? 'sector' : compareMode === 'user' ? 'user' : 'company';

  const comparisonMode: SkillStatsComparisonMode =
    compareMode === 'sector' ? 'sector' : 'user';

  // Position-compare is derived client-side from Overview's byUser, so it
  // routes through useOverview rather than useComparison. useComparison is
  // therefore restricted to the backend-supported sector/user modes.

  // --- Available options (derived from composition) ---
  const availableYs    = useMemo(() => availableYsFor(xAxisMode), [xAxisMode]);
  const availableTypes = useMemo(() => availableChartTypesFor(xAxisMode, yAxisMode, compareMode), [xAxisMode, yAxisMode, compareMode]);

  // --- Auto-correct composition when an upstream axis changes ---
  useEffect(() => {
    if (!availableYs.includes(yAxisMode)) setYAxisMode(availableYs[0]);
  }, [availableYs, yAxisMode]);

  // compareMode is fully derived now — no auto-correct effect needed.

  useEffect(() => {
    if (!availableTypes.includes(chartType)) {
      setChartType(availableTypes[0] ?? 'bar');
    }
  }, [availableTypes, chartType]);

  // Trend line only makes sense for time/cartesian. Drop when switching off.
  useEffect(() => {
    if (xAxisMode !== 'campaign' || chartType === 'radar') {
      if (trendLine !== null) setTrendLine(null);
    }
  }, [xAxisMode, chartType, trendLine]);

  // --- Filter precedence ---
  //
  // Topics are strictly more specific than the skill that owns them. When the
  // user has explicitly picked topics, sending skillIds to the backend would
  // AND them with topicIds and produce surprising empty results if the topic
  // selection drifted (e.g., during cascading edits). Mental model from the
  // UX: "topics > skills". Drop the skill filter at the API boundary.
  const apiFilters = useMemo<SkillStatsBaseFilters>(() => {
    // positionIds is FE-only (no server support yet) — strip before serializing.
    const { positionIds: _positions, ...withoutPositions } = filters;
    if (withoutPositions.topicIds && withoutPositions.topicIds.length > 0) {
      const { skillIds: _skillIds, ...rest } = withoutPositions;
      return rest;
    }
    return withoutPositions;
  }, [filters]);

  // --- Queries ---
  //
  // Overview is ALWAYS enabled because the summary block (totalEvaluated,
  // overallAverage, submissionRate, bestSector, strongestSkill) powers the
  // KPI cards regardless of which endpoint the chart itself is drawing from.
  // Comparison/Evolution don't return that summary, so without this the cards
  // sit empty whenever the user composes a comparison view.
  const overviewQuery = useSkillStatsOverview(apiFilters);

  const comparisonQuery = useSkillStatsComparison(
    {
      ...apiFilters,
      mode: comparisonMode,
      entityIds: compareEntityIds,
      includeCompanyAverage: true,
    },
    { enabled: useComparison && compareEntityIds.length > 0 },
  );

  const evolutionQuery = useSkillStatsEvolution(
    {
      ...apiFilters,
      mode: evolutionMode,
      entityIds: compareMode === 'none' ? undefined : compareEntityIds,
    },
    { enabled: useEvolution && (compareMode === 'none' || compareEntityIds.length > 0) },
  );

  const overview = overviewQuery.data?.data;
  const comparison = comparisonQuery.data?.data;
  const evolution = evolutionQuery.data?.data;

  const activeQuery = useComparison ? comparisonQuery : useEvolution ? evolutionQuery : overviewQuery;

  // --- KPI cards (always derived from Overview; comparison/evolution
  // still report the same overall counts since the backend returns the
  // same summary block on Overview).
  // We fetch Overview only when active; for comparison/evolution we
  // re-use the comparison's company-average and counts when present.
  const summary = overview?.summary ?? null;

  // --- Filter badge count ---
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.assessmentIds?.length) c++;
    if (filters.sectorIds?.length)     c++;
    if (filters.positionIds?.length)   c++;
    if (filters.skillIds?.length)      c++;
    if (filters.topicIds?.length)      c++;
    if (filters.userIds?.length)       c++;
    // compareMode is derived from the picker counts above, so don't double-count.
    if (xAxisModeRaw !== 'skill')      c++;
    if (yAxisMode !== 'averageScore')  c++;
    return c;
  }, [filters, xAxisModeRaw, yAxisMode]);

  // ============================================================
  // Chart data builders — one per (X, Y, compare) family
  // ============================================================

  // Compute the radar view: indicators + series. Returns null when chartType
  // isn't radar or the source data isn't a fit.
  const radarView = useMemo(() => {
    if (chartType !== 'radar') return null;
    if (yAxisMode !== 'averageScore') return null;
    if (xAxisMode !== 'skill' && xAxisMode !== 'topic') return null;

    if (useOverview && overview) {
      const points = xAxisMode === 'skill'
        ? overview.bySkill.map(p => ({ name: p.skillName, value: p.average }))
        : overview.byTopic.map(p => ({ name: p.topicTitle, value: p.average }));
      if (!points.length) return { indicators: [], series: [] };
      return {
        indicators: points.map(p => ({ name: p.name, max: 5 })),
        series: [
          {
            id: 'company',
            name: 'Média da empresa',
            values: points.map(p => p.value),
            color: CHART_COLORS[4],
          },
        ],
      };
    }

    if (useComparison && comparison) {
      const useTopic = xAxisMode === 'topic';
      const indicators = useTopic
        ? comparison.topicAxis.map(t => ({ name: t.topicTitle, max: 5 }))
        : comparison.axis.map(s => ({ name: s.skillName, max: 5 }));
      const entitySeries = comparison.entities.map((e, i) => ({
        id: e.entityId,
        name: e.entityName + (e.sectorName ? ` (${e.sectorName})` : ''),
        values: useTopic
          ? e.perTopicAverage.map(p => p.average)
          : e.perSkillAverage.map(p => p.average),
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
      const overlay = comparison.companyAverage
        ? [{
            id: 'company-benchmark',
            name: 'Média da empresa',
            values: useTopic
              ? comparison.companyAverage.perTopicAverage.map(p => p.average)
              : comparison.companyAverage.perSkillAverage.map(p => p.average),
            color: '#71717a',
            isBenchmark: true as const,
          }]
        : [];
      return { indicators, series: [...entitySeries, ...overlay] };
    }

    return { indicators: [], series: [] };
  }, [chartType, yAxisMode, xAxisMode, useOverview, useComparison, overview, comparison]);

  // Cartesian (bar/line/area/stacked) data. Each item is one X-category.
  // For multi-series we use `comparisons[]`; for distribution we encode the
  // 6 score levels as comparisons[].
  const cartesianView = useMemo(() => {
    if (chartType === 'radar') return null;

    type Comp = { entityName: string; value: number; entityId?: string };
    // __primaryType / __primaryId / __secondaryType are click-context
    // metadata consumed by handleChartClick — they ride along on the items
    // but are ignored by StatisticsChart (ChartDataItem has a [key: string]:
    // any escape hatch).
    type Item = {
      name: string;
      value: number;
      comparisons?: Comp[];
      __primaryType?: 'skill' | 'topic' | 'sector' | 'user' | 'campaign';
      __primaryId?: string;
      __secondaryType?: 'sector' | 'user' | 'position' | 'skill';
    };

    // 1. Distribution — only X∈{topic, skill}, Y=distribution, compare=none.
    if (yAxisMode === 'distribution') {
      if (!overview) return { items: [], isComparison: true, axisLabel: 'Quantidade de respostas', truncationNote: null };
      const dist = overview.topicDistribution;

      if (xAxisMode === 'topic') {
        const items: Item[] = dist.map(d => ({
          name: d.topicTitle,
          value: 0,
          comparisons: SCORE_LEVEL_LABELS.map((label, i) => ({
            entityName: label,
            value: d.counts[i] ?? 0,
          })),
          __primaryType: 'topic',
          __primaryId: d.topicId,
        }));
        const truncated = items.length > TOP_N_TOPICS_DEFAULT && !(filters.skillIds?.length || filters.topicIds?.length);
        return {
          items: truncated ? items.slice(0, TOP_N_TOPICS_DEFAULT) : items,
          isComparison: true,
          axisLabel: 'Quantidade de respostas',
          truncationNote: truncated
            ? `Exibindo ${TOP_N_TOPICS_DEFAULT} de ${items.length} tópicos. Use filtros para refinar.`
            : null,
        };
      }

      // X = skill: aggregate distribution counts across the skill's topics.
      const bySkill = new Map<string, { id: string; name: string; counts: number[] }>();
      dist.forEach(d => {
        if (!bySkill.has(d.skillId)) bySkill.set(d.skillId, { id: d.skillId, name: d.skillName, counts: [0,0,0,0,0,0] });
        const b = bySkill.get(d.skillId)!;
        for (let i = 0; i < 6; i++) b.counts[i] += d.counts[i] ?? 0;
      });
      const items: Item[] = Array.from(bySkill.values()).map(b => ({
        name: b.name,
        value: 0,
        comparisons: SCORE_LEVEL_LABELS.map((label, i) => ({ entityName: label, value: b.counts[i] })),
        __primaryType: 'skill',
        __primaryId: b.id,
      }));
      return { items, isComparison: true, axisLabel: 'Quantidade de respostas', truncationNote: null };
    }

    // 2. Volume — X∈{topic, sector}, compare=none.
    if (yAxisMode === 'volume') {
      if (!overview) return { items: [], isComparison: false, axisLabel: 'Volume', truncationNote: null };
      if (xAxisMode === 'topic') {
        const items: Item[] = overview.topicDistribution.map(d => ({
          name: d.topicTitle, value: d.totalResponses,
          __primaryType: 'topic', __primaryId: d.topicId,
        }));
        return { items, isComparison: false, axisLabel: 'Respostas', truncationNote: null };
      }
      if (xAxisMode === 'sector') {
        const items: Item[] = overview.bySector.map(s => ({
          name: s.sectorName, value: s.evaluatedCount,
          __primaryType: 'sector', __primaryId: s.sectorId,
        }));
        return { items, isComparison: false, axisLabel: 'Colaboradores avaliados', truncationNote: null };
      }
      return { items: [], isComparison: false, axisLabel: 'Volume', truncationNote: null };
    }

    // 3. averageScore — the main family.
    // 3a. X = campaign → evolution
    if (xAxisMode === 'campaign') {
      if (!evolution) return { items: [], isComparison: false, axisLabel: 'Média (0–5)', truncationNote: null };
      const series = evolution.series;
      const isMulti = series.length > 1;
      const seriesIsCompany = evolution.mode === 'company';
      const secondaryType: 'sector' | 'user' | undefined = isMulti && !seriesIsCompany
        ? (evolution.mode as 'sector' | 'user')
        : undefined;
      const items: Item[] = evolution.points.map(p => {
        const baseName = format(new Date(p.periodEnd), 'MMM/yy');
        const label = `${baseName} · ${p.assessmentName.slice(0, 22)}`;
        if (isMulti) {
          return {
            name: label,
            value: 0,
            comparisons: series.map(s => ({ entityName: s.name, value: p.values[s.id] ?? 0, entityId: s.id })),
            __primaryType: 'campaign',
            __primaryId: p.assessmentId,
            __secondaryType: secondaryType,
          };
        }
        const onlyId = series[0]?.id ?? 'company';
        return {
          name: label,
          value: +(p.values[onlyId] ?? 0).toFixed(2),
          __primaryType: 'campaign',
          __primaryId: p.assessmentId,
        };
      });
      const note = items.length === 1
        ? 'Selecione 2 ou mais campanhas no filtro para visualizar evolução temporal.'
        : null;
      return { items, isComparison: isMulti, axisLabel: 'Média (0–5)', truncationNote: note };
    }

    // 3b. X∈{skill, topic}, compare=sector|user → Comparison endpoint
    if (useComparison && comparison) {
      const useTopic = xAxisMode === 'topic';
      const categories = useTopic
        ? comparison.topicAxis.map(t => ({ id: t.topicId, name: t.topicTitle }))
        : comparison.axis.map(s => ({ id: s.skillId, name: s.skillName }));
      const secondaryType: 'sector' | 'user' = comparison.mode;
      const items: Item[] = categories.map((cat, i) => ({
        name: cat.name,
        value: 0,
        comparisons: [
          ...comparison.entities.map(e => ({
            entityName: e.entityName + (e.sectorName ? ` (${e.sectorName})` : ''),
            value: useTopic
              ? +(e.perTopicAverage[i]?.average ?? 0).toFixed(2)
              : +(e.perSkillAverage[i]?.average ?? 0).toFixed(2),
            entityId: e.entityId,
          })),
          ...(comparison.companyAverage
            ? [{
                entityName: 'Média da empresa',
                value: useTopic
                  ? +(comparison.companyAverage.perTopicAverage[i]?.average ?? 0).toFixed(2)
                  : +(comparison.companyAverage.perSkillAverage[i]?.average ?? 0).toFixed(2),
              }]
            : []),
        ],
        __primaryType: useTopic ? 'topic' : 'skill',
        __primaryId: cat.id,
        __secondaryType: secondaryType,
      }));
      return { items, isComparison: true, axisLabel: 'Média (0–5)', truncationNote: null };
    }

    // 3b'. X=skill, compare=position → derive from byUser grouped by positionName
    if (xAxisMode === 'skill' && compareMode === 'position' && useOverview && overview) {
      const allUsers = overview.byUser.filter(u => u.positionName);
      const byPosition = new Map<string, { name: string; users: typeof overview.byUser }>();
      allUsers.forEach(u => {
        if (!u.positionName) return;
        const cur = byPosition.get(u.positionName);
        if (cur) cur.users.push(u);
        else byPosition.set(u.positionName, { name: u.positionName, users: [u] });
      });
      const positionGroups = Array.from(byPosition.values());
      if (!positionGroups.length) {
        return { items: [], isComparison: true, axisLabel: 'Média (0–5)', truncationNote: null };
      }
      const skillAxis = overview.bySkill.map(s => ({ id: s.skillId, name: s.skillName }));
      const items: Item[] = skillAxis.map(skill => ({
        name: skill.name,
        value: 0,
        comparisons: positionGroups.map(pg => {
          const values: number[] = [];
          pg.users.forEach(u => {
            const p = u.perSkillAverage.find(x => x.skillId === skill.id);
            if (p?.average != null) values.push(p.average);
          });
          const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          // No entityId — byUser exposes positionName only. The modal joins via
          // users.position.name when secondaryType === 'position'.
          return { entityName: pg.name, value: +mean.toFixed(2) };
        }),
        __primaryType: 'skill',
        __primaryId: skill.id,
        __secondaryType: 'position',
      }));

      return { items, isComparison: true, axisLabel: 'Média (0–5)', truncationNote: null };
    }

    // 3c. X∈{skill, topic}, compare=none → Overview's bySkill/byTopic
    if ((xAxisMode === 'skill' || xAxisMode === 'topic') && useOverview && overview) {
      const points = xAxisMode === 'skill'
        ? overview.bySkill.map(p => ({ id: p.skillId, name: p.skillName, value: p.average ?? 0 }))
        : overview.byTopic.map(p => ({ id: p.topicId, name: p.topicTitle, value: p.average ?? 0 }));
      const primaryType: 'skill' | 'topic' = xAxisMode === 'skill' ? 'skill' : 'topic';
      const items: Item[] = points.map(p => ({
        name: p.name, value: +p.value.toFixed(2),
        __primaryType: primaryType, __primaryId: p.id,
      }));
      const truncated =
        xAxisMode === 'topic' &&
        items.length > TOP_N_TOPICS_DEFAULT &&
        !(filters.skillIds?.length || filters.topicIds?.length);
      return {
        items: truncated ? items.slice(0, TOP_N_TOPICS_DEFAULT) : items,
        isComparison: false,
        axisLabel: 'Média (0–5)',
        truncationNote: truncated
          ? `Exibindo ${TOP_N_TOPICS_DEFAULT} de ${items.length} tópicos. Use filtros para refinar.`
          : null,
      };
    }

    // 3d. X=sector, compare=none
    if (xAxisMode === 'sector' && useOverview && overview && compareMode === 'none') {
      const items: Item[] = overview.bySector
        .filter(s => s.overallAverage != null)
        .map(s => ({
          name: s.sectorName, value: +(s.overallAverage ?? 0).toFixed(2),
          __primaryType: 'sector', __primaryId: s.sectorId,
        }));
      return { items, isComparison: false, axisLabel: 'Média (0–5)', truncationNote: null };
    }

    // 3e. X=sector, compare=skill → derive from bySector[i].perSkillAverage
    if (xAxisMode === 'sector' && useOverview && overview && compareMode === 'skill') {
      const skillRank = new Map<string, { name: string; count: number }>();
      overview.bySector.forEach(s => s.perSkillAverage.forEach(p => {
        if (p.average == null) return;
        const cur = skillRank.get(p.skillId);
        if (cur) cur.count++;
        else skillRank.set(p.skillId, { name: p.skillName, count: 1 });
      }));
      const topSkills = Array.from(skillRank.entries())
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, MAX_SKILL_SERIES)
        .map(([id, v]) => ({ id, name: v.name }));

      const items: Item[] = overview.bySector.map(sec => ({
        name: sec.sectorName,
        value: 0,
        comparisons: topSkills.map(sk => {
          const p = sec.perSkillAverage.find(x => x.skillId === sk.id);
          return { entityName: sk.name, value: +(p?.average ?? 0).toFixed(2), entityId: sk.id };
        }),
        __primaryType: 'sector', __primaryId: sec.sectorId,
        __secondaryType: 'skill',
      }));
      const note = skillRank.size > MAX_SKILL_SERIES
        ? `Exibindo as ${MAX_SKILL_SERIES} competências mais frequentes de ${skillRank.size}. Filtre competências para refinar.`
        : null;
      return { items, isComparison: true, axisLabel: 'Média (0–5)', truncationNote: note };
    }

    // 3f. X=user, compare=none → top-N
    if (xAxisMode === 'user' && useOverview && overview && compareMode === 'none') {
      const sorted = [...overview.byUser]
        .filter(u => u.overallAverage != null)
        .sort((a, b) => (b.overallAverage ?? 0) - (a.overallAverage ?? 0));
      const limit = filters.userIds?.length ? sorted.length : TOP_N_USERS_DEFAULT;
      const items: Item[] = sorted.slice(0, limit).map(u => ({
        name: u.userName + (u.sectorName ? ` · ${u.sectorName}` : ''),
        value: +(u.overallAverage ?? 0).toFixed(2),
        __primaryType: 'user', __primaryId: u.userId,
      }));
      const note = !filters.userIds?.length && sorted.length > TOP_N_USERS_DEFAULT
        ? `Exibindo top ${TOP_N_USERS_DEFAULT} de ${sorted.length} colaboradores. Filtre colaboradores para refinar.`
        : null;
      return { items, isComparison: false, axisLabel: 'Média (0–5)', truncationNote: note };
    }

    // 3g. X=user, compare=skill → derive from byUser[i].perSkillAverage
    if (xAxisMode === 'user' && useOverview && overview && compareMode === 'skill') {
      const sorted = [...overview.byUser]
        .filter(u => u.overallAverage != null)
        .sort((a, b) => (b.overallAverage ?? 0) - (a.overallAverage ?? 0));
      const limit = filters.userIds?.length ? sorted.length : TOP_N_USERS_DEFAULT;
      const users = sorted.slice(0, limit);

      const skillRank = new Map<string, { name: string; count: number }>();
      users.forEach(u => u.perSkillAverage.forEach(p => {
        if (p.average == null) return;
        const cur = skillRank.get(p.skillId);
        if (cur) cur.count++;
        else skillRank.set(p.skillId, { name: p.skillName, count: 1 });
      }));
      const topSkills = Array.from(skillRank.entries())
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, MAX_SKILL_SERIES)
        .map(([id, v]) => ({ id, name: v.name }));

      const items: Item[] = users.map(u => ({
        name: u.userName,
        value: 0,
        comparisons: topSkills.map(sk => {
          const p = u.perSkillAverage.find(x => x.skillId === sk.id);
          return { entityName: sk.name, value: +(p?.average ?? 0).toFixed(2), entityId: sk.id };
        }),
        __primaryType: 'user', __primaryId: u.userId,
        __secondaryType: 'skill',
      }));
      const truncNote = !filters.userIds?.length && sorted.length > TOP_N_USERS_DEFAULT
        ? `Top ${TOP_N_USERS_DEFAULT} colaboradores. `
        : '';
      const skillNote = skillRank.size > MAX_SKILL_SERIES
        ? `Mostrando ${MAX_SKILL_SERIES} de ${skillRank.size} competências.`
        : '';
      const note = (truncNote + skillNote).trim() || null;
      return { items, isComparison: true, axisLabel: 'Média (0–5)', truncationNote: note };
    }

    return { items: [], isComparison: false, axisLabel: 'Média (0–5)', truncationNote: null };
  }, [
    chartType, xAxisMode, yAxisMode, compareMode, useComparison, useOverview,
    overview, comparison, evolution, filters.skillIds, filters.topicIds, filters.userIds,
  ]);

  // Map our SkillStatsChartType to StatisticsChartType used by StatisticsChart.
  const effectiveChartType: StatisticsChartType = useMemo(() => {
    if (chartType === 'radar') return 'bar'; // unused — radar branch renders elsewhere
    return chartType as StatisticsChartType;
  }, [chartType]);

  // YAxisMode mapping: we always use 'count' as the StatisticsChart internal
  // mode and override the formatter so 0–5 averages render with 2 decimals.
  const effectiveYAxisMode: YAxisMode = yAxisMode === 'volume' || yAxisMode === 'distribution' ? 'count' : 'count';

  const valueFormatter = useCallback((value: number): string => {
    if (yAxisMode === 'averageScore') return value.toFixed(2);
    // volume / distribution → integer counts
    return formatNumber(Math.round(value));
  }, [yAxisMode]);

  // Chart click → drill-down modal.
  //
  // StatisticsChart's onDataPointClick gives (dataIndex, name, seriesName).
  // We resolve dataIndex → items[i] (which carries __primary metadata) and
  // map seriesName back to a comparison entry by entityName, picking up its
  // entityId / entityType.
  const handleChartClick = useCallback((dataIndex: number, _name: string, seriesName: string) => {
    if (!cartesianView) return;
    const item = cartesianView.items[dataIndex] as any;
    if (!item?.__primaryType || !item?.__primaryId) return;

    // Distribution comparisons are score-level buckets, not entities. Click on
    // them resolves to the primary (skill/topic) only — no secondary filter.
    const primary = {
      type: item.__primaryType,
      id: item.__primaryId,
      name: item.name,
    } as SkillStatsClickContext['primary'];

    let secondary: SkillStatsClickContext['secondary'] = undefined;
    const secondaryType = item.__secondaryType;
    if (secondaryType && seriesName && Array.isArray(item.comparisons)) {
      const comp = item.comparisons.find((c: any) => c.entityName === seriesName);
      // The "Média da empresa" overlay has no entityId — skip narrowing for it.
      if (comp && comp.entityName !== 'Média da empresa') {
        if (secondaryType === 'position') {
          secondary = { type: 'position', name: comp.entityName };
        } else if (comp.entityId) {
          secondary = {
            type: secondaryType,
            id: comp.entityId,
            name: comp.entityName,
          };
        }
      }
    }

    openModalWithContext({ primary, secondary });
  }, [cartesianView, openModalWithContext]);

  // ============================================================
  // Exports
  // ============================================================

  const handleExportCSV = useCallback(() => {
    try {
      if (chartType === 'radar' ? !radarView?.indicators.length : !cartesianView?.items.length) {
        toast.error('Sem dados para exportar');
        return;
      }
      const rows: string[][] = [];

      if (chartType === 'radar' && radarView) {
        const header = ['Dimensão', ...radarView.series.map(s => s.name)];
        rows.push(header);
        radarView.indicators.forEach((ind, i) => {
          rows.push([
            ind.name,
            ...radarView.series.map(s => formatAvg(s.values[i] ?? null)),
          ]);
        });
      } else if (cartesianView) {
        const sample = cartesianView.items[0];
        const header = sample?.comparisons
          ? ['Categoria', ...sample.comparisons.map(c => c.entityName)]
          : ['Categoria', cartesianView.axisLabel];
        rows.push(header);
        cartesianView.items.forEach(it => {
          if (it.comparisons) {
            rows.push([it.name, ...it.comparisons.map(c => formatAvg(c.value))]);
          } else {
            rows.push([it.name, formatAvg(it.value)]);
          }
        });
      }

      const csv = rows
        .map(r => r.map(cell => `"${(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `competencias-${xAxisMode}-${yAxisMode}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados!');
    } catch {
      toast.error('Erro ao exportar dados');
    }
  }, [chartType, radarView, cartesianView, xAxisMode, yAxisMode]);

  const handleExportXLSX = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      let aoa: (string | number | null)[][] = [];
      if (chartType === 'radar' && radarView) {
        aoa.push(['Dimensão', ...radarView.series.map(s => s.name)]);
        radarView.indicators.forEach((ind, i) => {
          aoa.push([ind.name, ...radarView.series.map(s => s.values[i] ?? null)]);
        });
      } else if (cartesianView) {
        const sample = cartesianView.items[0];
        const header = sample?.comparisons
          ? ['Categoria', ...sample.comparisons.map(c => c.entityName)]
          : ['Categoria', cartesianView.axisLabel];
        aoa.push(header);
        cartesianView.items.forEach(it => {
          if (it.comparisons) {
            aoa.push([it.name, ...it.comparisons.map(c => c.value)]);
          } else {
            aoa.push([it.name, it.value]);
          }
        });
      }
      if (!aoa.length) {
        toast.error('Sem dados para exportar');
        return;
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = aoa[0].map((_, i) => ({ wch: i === 0 ? 28 : 14 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Dados');
      XLSX.writeFile(wb, `competencias-${xAxisMode}-${yAxisMode}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`);
      toast.success('Planilha exportada!');
    } catch {
      toast.error('Erro ao exportar planilha');
    }
  }, [chartType, radarView, cartesianView, xAxisMode, yAxisMode]);

  const handleExportPDF = useCallback(async () => {
    try {
      const chartOption =
        chartType === 'radar'
          ? radarRef.current?.getOption()
          : chartRef.current?.getOption();
      if (!chartOption) {
        toast.error('Sem gráfico para exportar');
        return;
      }
      const { exportSkillStatsPdf } = await import('@/utils/skill-stats-pdf-generator');
      toast.loading('Gerando PDF...', { id: 'skill-pdf' });
      await exportSkillStatsPdf({
        overview: overview ?? null,
        comparison: comparison ?? null,
        evolution: evolution ?? null,
        xAxisMode,
        yAxisMode,
        compareMode,
        chartType,
        chartOption,
        filters,
      });
      toast.success('PDF exportado!', { id: 'skill-pdf' });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar PDF', { id: 'skill-pdf' });
    }
  }, [chartType, overview, comparison, evolution, xAxisMode, yAxisMode, compareMode, filters]);

  // ============================================================
  // KPI card click handlers
  // ============================================================
  //
  // Mirrors the productivity page's "click a summary card → open the
  // drill-down modal" pattern. Each handler turns a card into one of:
  //   • A pure scope view (Card 1, 2): show the same entries the KPI counts
  //   • A status-widened view (Card 3): include PENDING/IN_PROGRESS so the
  //     submission-rate denominator and numerator are both visible
  //   • A primary-entity view (Card 4): focus on the best sector / strongest
  //     skill that the card highlights

  const featuredCard = (xAxisMode === 'sector' || compareMode === 'sector') ? 'sector' : 'skill';

  const canDrillEvaluated   = !!summary && summary.totalEvaluated > 0;
  const canDrillAverage     = !!summary && summary.overallAverage != null && summary.totalEvaluated > 0;
  const canDrillSubmissions = !!summary && (summary.totalEntries ?? 0) > 0;
  const canDrillFeatured    = !!summary && (
    featuredCard === 'sector'
      ? !!summary.bestSector
      : !!summary.strongestSkill
  );

  const openEvaluatedDrilldown = useCallback(() => {
    openModalWithContext({ titleOverride: 'Colaboradores avaliados no escopo' });
  }, [openModalWithContext]);

  const openAverageDrilldown = useCallback(() => {
    openModalWithContext({ titleOverride: 'Avaliações submetidas no escopo' });
  }, [openModalWithContext]);

  const openSubmissionsDrilldown = useCallback(() => {
    // Include PENDING + IN_PROGRESS so the modal shows both numerator and
    // denominator of the submission rate.
    openModalWithContext(
      { titleOverride: 'Submissões — todos os status' },
      { includeInProgress: true },
    );
  }, [openModalWithContext]);

  const openFeaturedDrilldown = useCallback(() => {
    if (!summary) return;
    if (featuredCard === 'sector' && summary.bestSector) {
      openModalWithContext({
        primary: {
          type: 'sector',
          id: summary.bestSector.sectorId,
          name: summary.bestSector.sectorName,
        },
        titleOverride: `Setor destaque: ${summary.bestSector.sectorName}`,
      });
      return;
    }
    if (featuredCard === 'skill' && summary.strongestSkill) {
      openModalWithContext({
        primary: {
          type: 'skill',
          id: summary.strongestSkill.skillId,
          name: summary.strongestSkill.skillName,
        },
        titleOverride: `Competência destaque: ${summary.strongestSkill.skillName}`,
      });
    }
  }, [featuredCard, summary, openModalWithContext]);

  // ============================================================
  // Render helpers
  // ============================================================

  const xAxisOption    = X_AXIS_OPTIONS.find(o => o.value === xAxisMode)!;
  const yAxisLabel     = Y_AXIS_OPTIONS.find(o => o.value === yAxisMode)?.label;
  const compareOption  = COMPARE_MODE_OPTIONS.find(o => o.value === compareMode);
  const currentTypeOpt = CHART_TYPE_CATALOG[chartType];

  const renderEmpty = (msg: string) => (
    <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
      <IconRadar className="h-12 w-12 text-muted-foreground" />
      <p className="font-semibold">Nenhum dado encontrado</p>
      <p className="text-sm text-muted-foreground text-center max-w-xs">{msg}</p>
    </div>
  );

  const renderChart = () => {
    // Loading
    if (activeQuery.isLoading) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="space-y-3 w-full max-w-2xl px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        </div>
      );
    }
    // Error
    if (activeQuery.isError) {
      return (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{(activeQuery.error as any)?.message}</p>
          </div>
          <Button onClick={() => activeQuery.refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      );
    }
    // Comparison/Evolution selected but no entity picked
    if ((useComparison || (useEvolution && compareMode !== 'none')) && compareEntityIds.length === 0) {
      return renderEmpty(
        `Selecione ao menos 1 ${compareMode === 'user' ? 'colaborador' : 'setor'} no filtro para comparar.`,
      );
    }

    // Radar branch
    if (chartType === 'radar') {
      if (!radarView || !radarView.indicators.length || !radarView.series.length) {
        return renderEmpty('Ajuste os filtros ou aguarde a primeira campanha ser finalizada.');
      }
      return (
        <div className="flex-1 min-h-0">
          <StatisticsRadarChart
            ref={radarRef}
            indicators={radarView.indicators}
            series={radarView.series}
            shape={radarShape}
            height="100%"
          />
        </div>
      );
    }

    // Cartesian branch
    if (!cartesianView || !cartesianView.items.length) {
      return renderEmpty('Nenhum dado para a composição atual. Ajuste os filtros.');
    }
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {cartesianView.truncationNote && (
          <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <IconAlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <p>{cartesianView.truncationNote}</p>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <StatisticsChart
            ref={chartRef}
            data={cartesianView.items}
            chartType={effectiveChartType}
            yAxisMode={effectiveYAxisMode}
            isComparisonMode={cartesianView.isComparison}
            height="100%"
            yAxisLabel={cartesianView.axisLabel}
            tooltipLabels={{ primary: cartesianView.axisLabel }}
            valueFormatter={valueFormatter}
            trendLine={trendLine}
            onDataPointClick={handleChartClick}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
      <div className="flex-shrink-0">
        <PageHeader
          title="Estatísticas de Competências"
          icon={IconRadar}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_RECURSOS_HUMANOS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Recursos Humanos', href: routes.statistics.humanResources.root },
            { label: 'Competências' },
          ]}
        />
      </div>

      <Card className="mt-4 flex-1 min-h-0 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <xAxisOption.icon className="h-5 w-5" />
                {xAxisOption.label} × {yAxisLabel}
              </CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                <span>
                  {compareMode === 'none'
                    ? 'Uma série única no escopo selecionado.'
                    : `Comparando por ${compareOption?.label?.toLowerCase()}.`}
                </span>
                {compareMode !== 'none' && compareEntityIds.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {compareEntityIds.length}{' '}
                    {compareMode === 'user'     ? 'colaborador(es)'
                      : compareMode === 'position' ? 'cargo(s)'
                      : compareMode === 'skill'    ? 'competência(s)'
                      : 'setor(es)'}
                  </Badge>
                )}
                {filters.assessmentIds?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {filters.assessmentIds.length} campanha(s)
                  </Badge>
                ) : null}
                {filters.sectorIds?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {filters.sectorIds.length} setor(es)
                  </Badge>
                ) : null}
                {filters.positionIds?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {filters.positionIds.length} cargo(s)
                  </Badge>
                ) : null}
                {filters.skillIds?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {filters.skillIds.length} competência(s)
                  </Badge>
                ) : null}
                {filters.topicIds?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {filters.topicIds.length} tópico(s)
                  </Badge>
                ) : null}
                {filters.userIds?.length ? (
                  <Badge variant="outline" className="text-xs">
                    {filters.userIds.length} colaborador(es)
                  </Badge>
                ) : null}
                {trendLine && (
                  <Badge variant="outline" className="text-xs">{TREND_LABELS[trendLine]}</Badge>
                )}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Chart type selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <currentTypeOpt.icon className="h-4 w-4 mr-2" />
                    {currentTypeOpt.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={chartType}
                    onValueChange={v => setChartType(v as SkillStatsChartType)}
                  >
                    {availableTypes.map(t => {
                      const opt = CHART_TYPE_CATALOG[t];
                      const Icon = opt.icon;
                      return (
                        <DropdownMenuRadioItem key={t} value={t} className="group">
                          <Icon className="h-4 w-4 mr-2" />
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">
                              {opt.description}
                            </span>
                          </div>
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Trend line — only for X=campaign cartesian */}
              {xAxisMode === 'campaign' && chartType !== 'radar' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant={trendLine ? 'default' : 'outline'} size="sm">
                      <IconTrendingUp className="h-4 w-4 mr-2" />
                      {trendLine ? TREND_LABELS[trendLine] : 'Tendência'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Linha de Tendência</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={trendLine ?? ''}
                      onValueChange={v => setTrendLine(v ? (v as TrendLineType) : null)}
                    >
                      <DropdownMenuRadioItem value="">Desativada</DropdownMenuRadioItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sma3">Média Móvel 3 pts</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sma6">Média Móvel 6 pts</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sma12">Média Móvel 12 pts</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Radar shape toggle — only for radar */}
              {chartType === 'radar' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {radarShape === 'polygon' ? 'Polígono' : 'Círculo'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Formato</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={radarShape}
                      onValueChange={v => setRadarShape(v as 'polygon' | 'circle')}
                    >
                      <DropdownMenuRadioItem value="polygon">Polígono</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="circle">Círculo</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Filters */}
              <Button
                variant={activeFilterCount > 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(true)}
              >
                <IconFilter className="h-4 w-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 h-5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {/* Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeQuery.isLoading}
                  >
                    <IconDownload className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <IconFileTypePdf className="h-4 w-4 mr-2" />
                    PDF do Gráfico
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <IconFileTypeCsv className="h-4 w-4 mr-2" />
                    CSV dos Dados
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportXLSX}>
                    <IconFileTypeXls className="h-4 w-4 mr-2" />
                    Excel (XLSX)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
          {/* KPI cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
            <KpiCard
              label="Colaboradores Avaliados"
              value={
                overviewQuery.isLoading || !summary
                  ? <Skeleton className="h-7 w-20" />
                  : formatNumber(summary.totalEvaluated)
              }
              icon={IconUsers}
              subtitle={
                summary
                  ? `${formatNumber(summary.assessmentsCount)} campanha${summary.assessmentsCount === 1 ? '' : 's'}`
                  : undefined
              }
              onClick={openEvaluatedDrilldown}
              disabled={!canDrillEvaluated}
            />
            <KpiCard
              label="Média Geral"
              value={
                overviewQuery.isLoading || !summary
                  ? <Skeleton className="h-7 w-16" />
                  : formatAvg(summary.overallAverage)
              }
              icon={IconStar}
              subtitle="escala 0–5"
              onClick={openAverageDrilldown}
              disabled={!canDrillAverage}
            />
            <KpiCard
              label="Taxa de Submissão"
              value={
                overviewQuery.isLoading || !summary
                  ? <Skeleton className="h-7 w-20" />
                  : formatPercentage((summary.submissionRate ?? 0) * 100, 1)
              }
              icon={IconTrendingUp}
              subtitle={
                summary
                  ? `${formatNumber(summary.submittedEntries)} de ${formatNumber(summary.totalEntries)} enviadas`
                  : undefined
              }
              onClick={openSubmissionsDrilldown}
              disabled={!canDrillSubmissions}
            />
            <KpiCard
              label={featuredCard === 'sector' ? 'Setor Destaque' : 'Competência Destaque'}
              value={
                overviewQuery.isLoading || !summary
                  ? <Skeleton className="h-7 w-20" />
                  : featuredCard === 'sector'
                    ? summary.bestSector?.sectorName ?? '—'
                    : summary.strongestSkill?.skillName ?? '—'
              }
              icon={featuredCard === 'sector' ? IconBuilding : IconRadar}
              subtitle={
                summary
                  ? featuredCard === 'sector'
                    ? summary.bestSector
                      ? formatAvg(summary.bestSector.average)
                      : ' '
                    : summary.strongestSkill
                      ? formatAvg(summary.strongestSkill.average)
                      : ' '
                  : undefined
              }
              onClick={openFeaturedDrilldown}
              disabled={!canDrillFeatured}
            />
          </div>

          {/* Chart area */}
          <div className="flex-1 min-h-0 flex flex-col">{renderChart()}</div>
        </CardContent>
      </Card>

      <SkillStatsFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        xAxisMode={xAxisModeRaw}
        yAxisMode={yAxisMode}
        filters={filters}
        onApply={next => {
          setXAxisMode(next.xAxisMode);
          setYAxisMode(next.yAxisMode);
          setFilters(next.filters);
        }}
      />

      <SkillStatsEntriesModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        context={clickContext}
        baseFilters={baseFiltersOverride
          ? { ...apiFilters, ...baseFiltersOverride }
          : apiFilters}
      />
    </div>
  );
};

// =====================
// KPI Card
// =====================

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: typeof IconUsers;
  subtitle?: string;
  // When provided AND not disabled, the card becomes a button: cursor change,
  // hover state, Enter/Space activation. Pattern mirrors the productivity
  // statistics page's drillable summary cards.
  onClick?: () => void;
  disabled?: boolean;
}

function KpiCard({ label, value, icon: Icon, subtitle, onClick, disabled }: KpiCardProps) {
  const interactive = !!onClick && !disabled;
  return (
    <Card
      className={cn(interactive && 'cursor-pointer transition-colors hover:bg-muted/50')}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive
        ? e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick!();
            }
          }
        : undefined}
    >
      <CardContent className="py-3 px-4">
        <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-xl font-bold mt-0.5 text-foreground truncate">{value}</div>
        {subtitle && (
          <div className="text-[11px] text-foreground/70 mt-0.5 truncate">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default HRSkillAssessmentStatisticsPage;
