import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GOAL_METRIC, routes } from '@/constants';
import { USER_STATUS, ACTIVE_USER_STATUSES } from '@/constants/enums';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { useHeadcountAnalytics, useTurnoverAnalytics, hrAnalyticsKeys } from '@/hooks/human-resources/use-hr-analytics';
import { useUsers } from '@/hooks/human-resources/use-user';
import { useSectors } from '@/hooks/administration/use-sector';
import { usePositions } from '@/hooks/human-resources/use-position';
import type { HeadcountFilters, HrChartType, HeadcountTimeseriesItem, HeadcountResponse, TurnoverFilters } from '@/types/hr-analytics';
import { getHeadcount } from '@/api-client/hr-analytics';
import { useQueries } from '@tanstack/react-query';
import { StatisticsChart, type StatisticsChartHandle } from '@/components/statistics/statistics-chart';
import { formatNumber, CHART_COLORS } from '@/types/statistics-common';
import type { YAxisMode, TrendLineType } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { getPositions } from '@/api-client/position';
import { sectorKeys, positionKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconStack2,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconUsers,
  IconBuilding,
  IconCalendar,
  IconX,
  IconCalendarStats,
  IconUserPlus,
  IconUserMinus,
  IconInfoCircle,
  IconBriefcase,
  IconTrendingUp,
  IconArrowsExchange,
  IconPercentage,
  IconTarget,
  IconFileTypeCsv,
  IconFileTypeXls,
} from '@tabler/icons-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
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

// =====================
// Constants
// =====================

const COMBOBOX_PAGE_SIZE = 20;

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => {
    const y = currentYear - i;
    return { value: y.toString(), label: y.toString() };
  });
};

const YEAR_OPTIONS = generateYearOptions();

type EquipeYAxisMode = 'headcount' | 'newHires' | 'dismissals' | 'netChange';

const Y_AXIS_OPTIONS: Array<{ value: EquipeYAxisMode; label: string }> = [
  { value: 'headcount', label: 'Efetivo total' },
  { value: 'newHires', label: 'Admissões' },
  { value: 'dismissals', label: 'Desligamentos' },
  { value: 'netChange', label: 'Variação líquida' },
];

const Y_AXIS_LABEL_BY_MODE: Record<EquipeYAxisMode, string> = {
  headcount: 'Efetivo total',
  newHires: 'Admissões',
  dismissals: 'Desligamentos',
  netChange: 'Variação líquida',
};

type EquipeCompareMode = 'combined' | 'separated' | 'separatedWithTotal';

const COMPARE_MODE_OPTIONS: Array<{ value: EquipeCompareMode; label: string }> = [
  { value: 'combined',           label: 'Combinado (uma série)' },
  { value: 'separated',          label: 'Separado (por entidade)' },
  { value: 'separatedWithTotal', label: 'Separado + Total' },
];

const CHART_TYPE_OPTIONS: Array<{ value: HrChartType; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'area', label: 'Área', icon: IconChartArea, description: 'Área preenchida' },
  { value: 'bar', label: 'Barras', icon: IconChartBar, description: 'Barras verticais' },
  { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Linha simples' },
  { value: 'bar-stacked', label: 'Empilhadas', icon: IconStack2, description: 'Empilhamento de séries' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

// =====================
// Business period helpers (26→25)
// =====================
//
// Mirrors the helpers used by `productivity.tsx` and `bonus-value.tsx`. The
// "business month M of year Y" refers to the cycle ending on 25/M/Y — so
// today=2026-05-14 belongs to period (2026, 5) which runs 26/04 → 25/05.
function businessPeriodStartDate(year: number, month: number): Date {
  if (month === 1) return startOfDay(new Date(year - 1, 11, 26));
  return startOfDay(new Date(year, month - 2, 26));
}
function businessPeriodEndDate(year: number, month: number): Date {
  return endOfDay(new Date(year, month - 1, 25));
}
function getCurrentBusinessPeriod(): { year: number; month: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() > 25) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return { year, month };
}

function defaultBusinessPeriodRange(): { startDate: Date; endDate: Date; year: number; month: number } {
  const bp = getCurrentBusinessPeriod();
  return {
    startDate: businessPeriodStartDate(bp.year, bp.month),
    endDate: businessPeriodEndDate(bp.year, bp.month),
    year: bp.year,
    month: bp.month,
  };
}

const DEFAULT_FILTERS_BASE = {
  includeInactive: false,
  includeUnassigned: true,
  useBusinessPeriod: true,
} as const;

// =====================
// Filter Sheet
// =====================

interface EquipeFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: HeadcountFilters;
  selectedYear: number | undefined;
  selectedMonths: string[];
  yAxisMode: EquipeYAxisMode;
  compareMode: EquipeCompareMode;
  includeExperienceFailures: boolean;
  onApply: (next: {
    filters: HeadcountFilters;
    selectedYear: number | undefined;
    selectedMonths: string[];
    yAxisMode: EquipeYAxisMode;
    compareMode: EquipeCompareMode;
    includeExperienceFailures: boolean;
  }) => void;
}

function EquipeFilters({
  open, onOpenChange, filters, selectedYear, selectedMonths, yAxisMode, compareMode,
  includeExperienceFailures, onApply,
}: EquipeFiltersProps) {
  const [local, setLocal] = useState<HeadcountFilters>(filters);
  const [localYMode, setLocalYMode] = useState<EquipeYAxisMode>(yAxisMode);
  const [localYear, setLocalYear] = useState<number | undefined>(selectedYear);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);
  const [localCmp, setLocalCmp] = useState<EquipeCompareMode>(compareMode);
  const [localIncExpFail, setLocalIncExpFail] = useState<boolean>(includeExperienceFailures);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalYMode(yAxisMode);
      setLocalYear(selectedYear);
      setLocalMonths(selectedMonths);
      setLocalCmp(compareMode);
      setLocalIncExpFail(includeExperienceFailures);
    }
  }, [open, filters, yAxisMode, selectedYear, selectedMonths, compareMode, includeExperienceFailures]);

  const localSectors = local.sectorIds ?? [];
  const localPositions = local.positionIds ?? [];
  const canCompare = localSectors.length >= 2 || localPositions.length >= 2;

  const fetchSectors = useCallback(async (search: string, page = 1) => {
    const response = await getSectors({ searchingFor: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (response.data || []).map(s => ({ value: s.id, label: s.name })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const fetchPositions = useCallback(async (search: string, page = 1) => {
    const response = await getPositions({ searchingFor: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (response.data || []).map(p => ({ value: p.id, label: p.name })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (local.sectorIds?.length) n++;
    if (local.positionIds?.length) n++;
    if (localYear || localMonths.length > 0) n++;
    if (canCompare && localCmp !== 'combined') n++;
    if (localIncExpFail) n++;
    return n;
  }, [local, localMonths, localYear, canCompare, localCmp, localIncExpFail]);

  const handleApply = useCallback(() => {
    const next: HeadcountFilters = { ...local };
    if (localYear && localMonths.length > 0) {
      // Use business-period semantics (26→25) so the dataset stays consistent
      // with productivity.tsx and bonus-value.tsx.
      const monthNums = localMonths.map(m => parseInt(m, 10));
      const minM = Math.min(...monthNums);
      const maxM = Math.max(...monthNums);
      next.startDate = businessPeriodStartDate(localYear, minM);
      next.endDate = businessPeriodEndDate(localYear, maxM);
    } else if (localYear) {
      next.startDate = businessPeriodStartDate(localYear, 1);
      next.endDate = businessPeriodEndDate(localYear, 12);
    } else {
      // No year selected → fall back to the current business period so the
      // chart never goes empty after clearing the dropdowns.
      const def = defaultBusinessPeriodRange();
      next.startDate = def.startDate;
      next.endDate = def.endDate;
    }
    onApply({
      filters: next,
      selectedYear: localYear,
      selectedMonths: localMonths,
      yAxisMode: localYMode,
      compareMode: canCompare ? localCmp : 'combined',
      includeExperienceFailures: localIncExpFail,
    });
    onOpenChange(false);
  }, [local, localYear, localMonths, localYMode, localCmp, canCompare, localIncExpFail, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    // Clearing snaps back to the full current year (Jan→Dec, business-period
    // aware) so the chart shows 12 months of trend by default — matching
    // productivity.tsx. A single-month default makes the chart look empty.
    const y = new Date().getFullYear();
    setLocal({
      startDate: businessPeriodStartDate(y, 1),
      endDate: businessPeriodEndDate(y, 12),
      ...DEFAULT_FILTERS_BASE,
    });
    setLocalYMode('headcount');
    setLocalYear(y);
    setLocalMonths([]);
    setLocalCmp('combined');
    setLocalIncExpFail(false);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Configure período, métrica, setores e cargos</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            {/* Y-axis */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Métrica do gráfico</Label>
              <Combobox
                value={localYMode}
                onValueChange={v => setLocalYMode(v as EquipeYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendar className="h-4 w-4" />Ano
              </Label>
              <Combobox
                value={localYear?.toString() || ''}
                onValueChange={v => {
                  const s = Array.isArray(v) ? v[0] : v;
                  const n = s ? parseInt(s, 10) : undefined;
                  setLocalYear(n);
                  if (!n) setLocalMonths([]);
                }}
                options={YEAR_OPTIONS}
                placeholder="Selecione um ano..."
                searchable={false}
                clearable={true}
              />
            </div>

            {/* Months */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />Meses
              </Label>
              <Combobox
                mode="multiple"
                value={localMonths}
                onValueChange={v => {
                  if (Array.isArray(v)) setLocalMonths(v);
                  else if (v) setLocalMonths([v]);
                  else setLocalMonths([]);
                }}
                options={MONTH_OPTIONS}
                placeholder={localYear ? 'Todos os meses...' : 'Selecione um ano primeiro'}
                disabled={!localYear}
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Sectors */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconBuilding className="h-4 w-4" />Setores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={local.sectorIds || []}
                onValueChange={v => setLocal({
                  ...local,
                  sectorIds: Array.isArray(v) && v.length > 0 ? v : undefined,
                })}
                queryKey={[...sectorKeys.lists()]}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Todos os setores..."
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado"
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Positions */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconBriefcase className="h-4 w-4" />Cargos
              </Label>
              <Combobox
                mode="multiple"
                async
                value={local.positionIds || []}
                onValueChange={v => setLocal({
                  ...local,
                  positionIds: Array.isArray(v) && v.length > 0 ? v : undefined,
                })}
                queryKey={[...positionKeys.lists()]}
                queryFn={fetchPositions}
                minSearchLength={0}
                placeholder="Todos os cargos..."
                searchPlaceholder="Buscar cargo..."
                emptyText="Nenhum cargo encontrado"
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Compare mode — only when 2+ sectors OR 2+ positions */}
            {canCompare && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  Modo de Comparação
                </Label>
                <Combobox
                  value={localCmp}
                  onValueChange={v => setLocalCmp(v as EquipeCompareMode)}
                  options={COMPARE_MODE_OPTIONS}
                  placeholder="Selecione..."
                  searchable={false}
                  clearable={false}
                />
                <p className="text-xs text-muted-foreground">
                  {localSectors.length >= 2 && localPositions.length >= 2
                    ? 'Comparação por setor (prioridade) — cargos selecionados são usados como filtro adicional.'
                    : localSectors.length >= 2
                      ? 'Comparação por setor.'
                      : 'Comparação por cargo.'}
                </p>
              </div>
            )}

            {/* Toggle: include experience-period dismissals in the turnover
                rate. Folded in from the (now removed) Rotatividade page. */}
            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={localIncExpFail}
                  onChange={e => setLocalIncExpFail(e.target.checked)}
                />
                <span className="flex-1 text-sm">
                  <span className="font-medium">Reprovações em experiência</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Inclui desligamentos ocorridos durante o período de experiência (até 90 dias) no cálculo da rotatividade.
                  </span>
                </span>
              </label>
            </div>

          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// KPI Drill-down Modal — shows ACTUAL user records, not period summaries
// =====================
//
// Clicking a KPI card opens this modal scoped to the page's current date range
// and sector/position filters:
//   • headcount   → all colaboradores active right now (status in ACTIVE set,
//                   no dismissedAt) — admissão date shown
//   • newHires    → colaboradores whose createdAt falls inside [start, end]
//   • dismissals  → colaboradores whose dismissedAt falls inside [start, end]
//   • netChange   → derivative, not clickable (the underlying records live in
//                   newHires / dismissals KPIs)

type TeamDrillDownMode = 'headcount' | 'newHires' | 'dismissals' | 'netChange';

const DRILL_DOWN_CONFIG: Record<TeamDrillDownMode, {
  title: string;
  icon: typeof IconUsers;
  dateColumn: 'admission' | 'dismissal';
}> = {
  headcount: { title: 'Efetivo Atual', icon: IconUsers, dateColumn: 'admission' },
  newHires: { title: 'Admissões no período', icon: IconUserPlus, dateColumn: 'admission' },
  dismissals: { title: 'Desligamentos no período', icon: IconUserMinus, dateColumn: 'dismissal' },
  netChange: { title: 'Variação Líquida', icon: IconArrowsExchange, dateColumn: 'admission' },
};

interface TeamDrillDownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TeamDrillDownMode | null;
  startDate?: Date;
  endDate?: Date;
  sectorIds?: string[];
  positionIds?: string[];
  sectorColorMap?: Record<string, string>;
}

function TeamDrillDownModal({
  open, onOpenChange, mode,
  startDate, endDate, sectorIds, positionIds, sectorColorMap,
}: TeamDrillDownModalProps) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (open) setSearch(''); }, [open]);

  const config = mode ? DRILL_DOWN_CONFIG[mode] : null;
  const Icon = config?.icon ?? IconUsers;

  // Build the useUsers query args from the mode. We rely on the same Prisma-
  // like `where` shape that other pages use (UserGetManyFormData supports
  // gte/lte on createdAt + dismissedAt, see schemas/user.ts).
  const queryArgs = useMemo(() => {
    if (!mode || mode === 'netChange') return null;

    const where: Record<string, any> = {};

    if (mode === 'headcount') {
      // Active right now = currently-active status AND not dismissed.
      where.status = { in: [...ACTIVE_USER_STATUSES] };
      where.dismissedAt = null;
    } else if (mode === 'newHires') {
      // Mirror the backend's joinDate() = effectedAt ?? createdAt
      // (hr-statistics.service.ts). Without the fallback the modal counts
      // users by createdAt only and shows far more rows than the summary card.
      if (startDate) {
        const range = { gte: startDate, ...(endDate ? { lte: endDate } : {}) };
        where.OR = [
          { effectedAt: range },
          { effectedAt: null, createdAt: range },
        ];
      }
    } else if (mode === 'dismissals') {
      where.status = USER_STATUS.DISMISSED;
      if (startDate) {
        where.dismissedAt = {
          gte: startDate,
          ...(endDate ? { lte: endDate } : {}),
        };
      } else {
        where.dismissedAt = { not: null };
      }
    }

    if (sectorIds?.length) {
      where.sectorId = { in: sectorIds };
    }
    if (positionIds?.length) where.positionId = { in: positionIds };

    return {
      where,
      orderBy: mode === 'dismissals'
        ? { dismissedAt: 'desc' as const }
        : { name: 'asc' as const },
      include: { position: true, sector: true },
      limit: 100,
    };
  }, [mode, startDate, endDate, sectorIds, positionIds]);

  const { data: response, isLoading, isError } = useUsers(queryArgs ?? {}, {
    enabled: open && !!queryArgs,
  } as any);

  const rawUsers: any[] = (response as any)?.data ?? [];

  // For the "Efetivo Atual" mode we mirror the backend's `isActiveAt(now)`
  // predicate (hr-statistics.service.ts → joinDate = effectedAt ?? createdAt).
  // Without this the modal counts users whose effectedAt/createdAt is in the
  // future (e.g. signed contracts not yet started) and ends up higher than
  // the summary card by exactly those users.
  const scopedUsers = useMemo(() => {
    if (mode !== 'headcount') return rawUsers;
    const now = Date.now();
    return rawUsers.filter(u => {
      const join = u.effectedAt ?? u.createdAt;
      if (!join) return true;
      return new Date(join).getTime() <= now;
    });
  }, [rawUsers, mode]);

  const multiSector = useMemo(() => {
    if (!sectorColorMap) return false;
    const seen = new Set<string>();
    for (const u of scopedUsers) if (u.sectorId) seen.add(u.sectorId);
    return seen.size > 1;
  }, [sectorColorMap, scopedUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? scopedUsers.filter(u =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.position?.name || '').toLowerCase().includes(q) ||
          (u.sector?.name || '').toLowerCase().includes(q),
        )
      : scopedUsers;
    if (!multiSector) return base;
    return [...base].sort((a, b) => {
      const s = (a.sector?.name ?? '').localeCompare(b.sector?.name ?? '');
      if (s !== 0) return s;
      // Within a sector, sort by the date column shown in the table
      // (admission for newHires/headcount/netChange, dismissal otherwise) —
      // newest first.
      const dateA = mode === 'dismissals'
        ? a.dismissedAt
        : (a.effectedAt ?? a.createdAt);
      const dateB = mode === 'dismissals'
        ? b.dismissedAt
        : (b.effectedAt ?? b.createdAt);
      const ta = dateA ? new Date(dateA).getTime() : 0;
      const tb = dateB ? new Date(dateB).getTime() : 0;
      return tb - ta;
    });
  }, [scopedUsers, search, multiSector, mode]);

  const dateColumnLabel = config?.dateColumn === 'dismissal' ? 'Desligamento' : 'Admissão';
  const subtitle = isLoading
    ? 'Carregando...'
    : `${formatNumber(filteredUsers.length)} colaborador${filteredUsers.length !== 1 ? 'es' : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {config?.title ?? 'Detalhamento'}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {subtitle}
            <span className="block text-xs text-foreground/60 mt-1">Exibindo até 100 registros</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b shrink-0">
            <Input
              value={search}
              onChange={(v) => setSearch(v == null ? '' : String(v))}
              placeholder="Buscar por nome, cargo ou setor..."
              className="w-full"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <Table className="[&_th]:px-6 [&_td]:px-6 [&>div]:border-0">
              <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right whitespace-nowrap">{dateColumnLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-destructive py-10">
                      Erro ao carregar colaboradores.
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-6 py-12 text-center text-sm text-foreground/60">
                      {search ? 'Nenhum resultado.' : 'Nenhum colaborador encontrado'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const dateValue = config?.dateColumn === 'dismissal'
                      ? u.dismissedAt
                      // Match backend joinDate() — effectedAt when present,
                      // otherwise fall back to createdAt. Keeps the displayed
                      // date consistent with the summary count.
                      : (u.effectedAt ?? u.createdAt);
                    const formattedDate = dateValue
                      ? format(new Date(dateValue), 'dd/MM/yyyy', { locale: ptBR })
                      : '—';
                    const sectorColor = multiSector && u.sectorId
                      ? sectorColorMap?.[u.sectorId]
                      : undefined;
                    return (
                      <TableRow key={u.id} className="text-sm">
                        <TableCell
                          className="font-medium whitespace-nowrap"
                          style={sectorColor ? { color: sectorColor } : undefined}
                          title={sectorColor ? (u.sector?.name ?? undefined) : undefined}
                        >{u.name}</TableCell>
                        <TableCell className="text-foreground/85 whitespace-nowrap">{u.position?.name ?? '—'}</TableCell>
                        <TableCell className="text-foreground/85 whitespace-nowrap">{u.sector?.name ?? '—'}</TableCell>
                        <TableCell className="text-right text-xs text-foreground/80 whitespace-nowrap">{formattedDate}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================
// Period drill-down (chart-click) — colaboradores active during a period
// =====================
//
// Triggered when the user clicks an x-axis value on the chart. Lists every
// colaborador active at any point during the period's [from, to] window —
// i.e. hired on/before `to` AND (still active OR dismissed after `from`).
// Mirrors `ProductionPeriodTasksModal` in shape (header + search + sticky
// table) so the modal feels native across statistics pages.

interface TeamPeriodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: HeadcountTimeseriesItem | null;
  sectorIds?: string[];
  positionIds?: string[];
  // sectorId → hex color, mirroring the chart's bar colors. Provided only
  // when the page is in "Comparação: Setores" mode. When given and >1 sector
  // is present in the result set, names are tinted by sector and rows are
  // grouped by sector (asc) then by admission date (newest first).
  sectorColorMap?: Record<string, string>;
}

function getPeriodRange(period: string): { from: Date; to: Date } | null {
  if (/^\d{4}$/.test(period)) {
    const y = parseInt(period, 10);
    return { from: businessPeriodStartDate(y, 1), to: businessPeriodEndDate(y, 12) };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  return { from: businessPeriodStartDate(y, mo), to: businessPeriodEndDate(y, mo) };
}

function TeamPeriodModal({
  open, onOpenChange, item, sectorIds, positionIds, sectorColorMap,
}: TeamPeriodModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) setSearch(''); }, [open]);

  const range = item ? getPeriodRange(item.period) : null;

  // Hired ON or BEFORE `to` (created during/before period) AND
  // (dismissedAt is null OR dismissedAt >= from). Server-side filters on the
  // common shape we already use elsewhere — see useUsers / use-user.ts.
  const queryArgs = useMemo(() => {
    if (!range) return null;
    const args: any = {
      where: {
        createdAt: { lte: range.to },
        OR: [
          { dismissedAt: null },
          { dismissedAt: { gte: range.from } },
        ],
      },
      orderBy: { name: 'asc' as const },
      include: { position: true, sector: true },
      limit: 100,
    };
    if (sectorIds?.length) args.sectorIds = sectorIds;
    if (positionIds?.length) args.positionIds = positionIds;
    return args;
  }, [range, sectorIds, positionIds]);

  const { data: response, isLoading, isError } = useUsers(queryArgs ?? {}, {
    enabled: open && !!queryArgs,
  } as any);

  const rawUsers: any[] = (response as any)?.data ?? [];

  const multiSector = useMemo(() => {
    if (!sectorColorMap) return false;
    const seen = new Set<string>();
    for (const u of rawUsers) if (u.sectorId) seen.add(u.sectorId);
    return seen.size > 1;
  }, [sectorColorMap, rawUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rawUsers.filter(u =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.position?.name || '').toLowerCase().includes(q) ||
          (u.sector?.name || '').toLowerCase().includes(q),
        )
      : rawUsers;
    if (!multiSector) return base;
    // Sector asc → admission desc within sector (most recent admissions
    // float to the top of each group, matching the "performance first"
    // intent used in the production modals).
    return [...base].sort((a, b) => {
      const s = (a.sector?.name ?? '').localeCompare(b.sector?.name ?? '');
      if (s !== 0) return s;
      const da = a.exp1StartAt ?? a.createdAt;
      const db = b.exp1StartAt ?? b.createdAt;
      const ta = da ? new Date(da).getTime() : 0;
      const tb = db ? new Date(db).getTime() : 0;
      return tb - ta;
    });
  }, [rawUsers, search, multiSector]);

  const statusLabel = (u: any): { label: string; tone: string } => {
    switch (u.status) {
      case USER_STATUS.EFFECTED: return { label: 'Efetivado', tone: 'text-emerald-700 dark:text-emerald-400' };
      case USER_STATUS.EXPERIENCE_PERIOD_1: return { label: 'Experiência (30d)', tone: 'text-blue-700 dark:text-blue-400' };
      case USER_STATUS.EXPERIENCE_PERIOD_2: return { label: 'Experiência (90d)', tone: 'text-blue-700 dark:text-blue-400' };
      case USER_STATUS.DISMISSED: return { label: 'Desligado', tone: 'text-red-700 dark:text-red-400' };
      default: return { label: u.status ?? '—', tone: 'text-foreground/70' };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5 text-primary" />
            Equipe — {item?.label ?? '—'}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {item ? (
              <>
                <span className="font-medium">{formatNumber(item.headcount)}</span>{' '}
                colaborador{item.headcount !== 1 ? 'es' : ''} ativo{item.headcount !== 1 ? 's' : ''}
                {' · '}
                <span className="font-medium">{formatNumber(item.newHires)}</span> admiss{item.newHires !== 1 ? 'ões' : 'ão'}
                {' · '}
                <span className="font-medium">{formatNumber(item.dismissals)}</span> desligamento{item.dismissals !== 1 ? 's' : ''}
              </>
            ) : '—'}
            <span className="block text-xs text-foreground/60 mt-1">Exibindo até 100 registros</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b shrink-0">
            <Input
              value={search}
              onChange={(v) => setSearch(v == null ? '' : String(v))}
              placeholder="Buscar por nome, cargo ou setor..."
              className="w-full"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <Table className="[&>div]:border-0">
              <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Admissão</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-destructive py-10">
                      Erro ao carregar colaboradores.
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center text-sm text-foreground/60">
                      {search ? 'Nenhum resultado.' : 'Nenhum colaborador no período'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const { label, tone } = statusLabel(u);
                    const admissionDate = u.exp1StartAt ?? u.createdAt;
                    const admittedAt = admissionDate
                      ? format(new Date(admissionDate), 'dd/MM/yyyy', { locale: ptBR })
                      : '—';
                    const sectorColor = multiSector && u.sectorId
                      ? sectorColorMap?.[u.sectorId]
                      : undefined;
                    return (
                      <TableRow key={u.id} className="text-sm">
                        <TableCell
                          className="font-medium whitespace-nowrap"
                          style={sectorColor ? { color: sectorColor } : undefined}
                          title={sectorColor ? (u.sector?.name ?? undefined) : undefined}
                        >{u.name}</TableCell>
                        <TableCell className="text-foreground/85 whitespace-nowrap">{u.position?.name ?? '—'}</TableCell>
                        <TableCell className="text-foreground/85 whitespace-nowrap">{u.sector?.name ?? '—'}</TableCell>
                        <TableCell className="text-right text-xs text-foreground/80 whitespace-nowrap">{admittedAt}</TableCell>
                        <TableCell className={`text-right text-xs font-medium whitespace-nowrap ${tone}`}>{label}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================
// Page Component
// =====================

const EquipePage = () => {
  usePageTracker({
    page: 'hr-equipe-statistics',
    title: 'Equipe - Estatísticas',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const chartHandleRef = useRef<StatisticsChartHandle>(null);

  // Default: the entire current year (Jan→Dec, business-period 26→25 aware).
  // We want the chart to show a full 12-month headcount trend on page load —
  // a single-month default produces a 1-datapoint chart that looks empty.
  // Matches productivity.tsx, which also defaults to the current year.
  const initialDefaults = useMemo(() => {
    const y = new Date().getFullYear();
    return {
      year: y,
      startDate: businessPeriodStartDate(y, 1),
      endDate: businessPeriodEndDate(y, 12),
    };
  }, []);

  const [filters, setFilters] = useState<HeadcountFilters>({
    startDate: initialDefaults.startDate,
    endDate: initialDefaults.endDate,
    ...DEFAULT_FILTERS_BASE,
  });
  const [selectedYear, setSelectedYear] = useState<number | undefined>(initialDefaults.year);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [chartType, setChartType] = useState<HrChartType>('area');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  const [yAxisMode, setYAxisMode] = useState<EquipeYAxisMode>('headcount');
  const [compareMode, setCompareMode] = useState<EquipeCompareMode>('combined');
  const [drillDown, setDrillDown] = useState<TeamDrillDownMode | null>(null);
  const [periodModal, setPeriodModal] = useState<HeadcountTimeseriesItem | null>(null);
  // User override on top of the admin-configured default from the goals feature.
  const [goalOverride, setGoalOverride] = useState<number | null>(null);
  // Whether the turnover-rate card counts dismissals that happened during the
  // experience period. Mirrors the toggle that used to live on the standalone
  // Rotatividade page.
  const [includeExperienceFailures, setIncludeExperienceFailures] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalPopoverOpen, setGoalPopoverOpen] = useState(false);

  // Reset override when switching to a metric with a different scale.
  useEffect(() => {
    setGoalOverride(null);
    setGoalInput('');
  }, [yAxisMode]);

  // Derive the dimension actually used for comparison. When both setores and
  // cargos have 2+ selected, sectors take priority (matches the Combobox
  // helper text). `null` means combined mode (no per-entity comparison).
  const selectedSectorIds = filters.sectorIds ?? [];
  const selectedPositionIds = filters.positionIds ?? [];
  const compareDimension: 'sector' | 'position' | null = useMemo(() => {
    if (compareMode === 'combined') return null;
    if (selectedSectorIds.length >= 2) return 'sector';
    if (selectedPositionIds.length >= 2) return 'position';
    return null;
  }, [compareMode, selectedSectorIds.length, selectedPositionIds.length]);

  const isComparisonMode = compareDimension !== null;

  const { data, isLoading, isError, error, refetch } = useHeadcountAnalytics(filters);
  const summary = data?.data?.summary;
  const timeseries = data?.data?.timeseries ?? [];

  // Turnover-rate KPI — folds in the unique metric from the (now removed)
  // standalone Rotatividade page. Uses the same date / sector / position
  // scope as the headcount query so the rate matches what the user is seeing.
  const turnoverFilters = useMemo<TurnoverFilters>(() => ({
    startDate: filters.startDate,
    endDate: filters.endDate,
    sectorIds: filters.sectorIds,
    positionIds: filters.positionIds,
    useBusinessPeriod: filters.useBusinessPeriod,
    includeExperienceFailures,
  }), [filters.startDate, filters.endDate, filters.sectorIds, filters.positionIds, filters.useBusinessPeriod, includeExperienceFailures]);
  const { data: turnoverData, isLoading: isTurnoverLoading } = useTurnoverAnalytics(turnoverFilters);
  const turnoverSummary = turnoverData?.data?.summary;

  // Default goal from the admin-configured monthly targets. Each yAxisMode
  // maps to a different metric: COLLABORATORS_PER_SECTOR (sector-scoped) for
  // headcount, HR_HIRES_PER_MONTH / HR_DISMISSALS_PER_MONTH for the flow
  // metrics. netChange is a derivative and has no first-class goal.
  const goalMetric =
    yAxisMode === 'headcount' ? GOAL_METRIC.COLLABORATORS_PER_SECTOR
    : yAxisMode === 'newHires' ? GOAL_METRIC.HR_HIRES_PER_MONTH
    : yAxisMode === 'dismissals' ? GOAL_METRIC.HR_DISMISSALS_PER_MONTH
    : null;

  const defaultGoal = useDefaultGoal({
    metric: goalMetric ?? GOAL_METRIC.COLLABORATORS_PER_SECTOR,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    sectorIds: filters.sectorIds,
    // Each chart datapoint is a single month's value, so the goal-line is the
    // average of per-month targets across the range — not the sum.
    aggregation: 'AVERAGE_PER_PERIOD',
    enabled: goalMetric !== null,
  });

  // In comparison mode each chart line represents ONE entity (sector or
  // position), so the goal must reflect the per-entity average — not the sum
  // across all filtered entities. Otherwise a Meta of 16 (= 8+8 across two
  // sectors) hovers above two lines that each only need to hit 8.
  const comparisonCount =
    !isComparisonMode
      ? 0
      : compareDimension === 'sector'
        ? selectedSectorIds.length
        : compareDimension === 'position'
          ? selectedPositionIds.length
          : 0;

  const goalValue = useMemo(() => {
    const raw = goalOverride ?? defaultGoal.value;
    if (raw == null) return null;
    return comparisonCount > 1 ? raw / comparisonCount : raw;
  }, [goalOverride, defaultGoal.value, comparisonCount]);

  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  // Comparison mode: fan-out one query per selected entity so the timeseries
  // for each sector/cargo arrives independently, then stitch them by period.
  // Mirrors the productivity.tsx pattern. We keep the existing root query
  // around for KPI cards + summary so headcount totals stay accurate.
  const comparisonEntityIds = useMemo(
    () => (compareDimension === 'sector' ? selectedSectorIds : compareDimension === 'position' ? selectedPositionIds : []),
    [compareDimension, selectedSectorIds, selectedPositionIds],
  );

  // sectorId → bar color. Mirrors statistics-chart.tsx's per-comparison color
  // assignment (CHART_COLORS indexed by selection order) so the period modal
  // can tint names with the same color the user just clicked. Only built in
  // sector-comparison mode; position-comparison gets no map (modal falls back
  // to its default rendering).
  const sectorColorMap = useMemo<Record<string, string> | undefined>(() => {
    if (compareDimension !== 'sector' || !selectedSectorIds.length) return undefined;
    const map: Record<string, string> = {};
    selectedSectorIds.forEach((id, i) => {
      map[id] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [compareDimension, selectedSectorIds]);

  const comparisonQueries = useQueries({
    queries: isComparisonMode
      ? comparisonEntityIds.map(id => {
          const subFilters: HeadcountFilters = {
            ...filters,
            // Replace the multi-select with a single-entity scope so the API
            // returns the timeseries for THIS one entity only.
            ...(compareDimension === 'sector'
              ? { sectorIds: [id], positionIds: filters.positionIds }
              : { positionIds: [id], sectorIds: filters.sectorIds }),
          };
          return {
            queryKey: hrAnalyticsKeys.headcount(subFilters),
            queryFn: () => getHeadcount(subFilters),
            staleTime: 3 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
          };
        })
      : [],
  });

  // Resolve entity ids → human-readable names for chart legends.
  const { data: sectorsData } = useSectors(
    { where: { id: { in: selectedSectorIds } }, limit: 100 },
    { enabled: compareDimension === 'sector' && selectedSectorIds.length > 0 } as any,
  );
  const { data: positionsData } = usePositions(
    { where: { id: { in: selectedPositionIds } }, limit: 100 },
    { enabled: compareDimension === 'position' && selectedPositionIds.length > 0 } as any,
  );

  const entityNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (compareDimension === 'sector') {
      ((sectorsData as any)?.data ?? []).forEach((s: { id: string; name: string }) => map.set(s.id, s.name));
    } else if (compareDimension === 'position') {
      ((positionsData as any)?.data ?? []).forEach((p: { id: string; name: string }) => map.set(p.id, p.name));
    }
    return map;
  }, [compareDimension, sectorsData, positionsData]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.sectorIds?.length) n++;
    if (filters.positionIds?.length) n++;
    if (selectedYear || selectedMonths.length > 0) n++;
    if (isComparisonMode) n++;
    return n;
  }, [filters, selectedYear, selectedMonths, isComparisonMode]);

  // Pick the right field on a HeadcountTimeseriesItem for the current Y mode.
  const pickValue = useCallback((item: HeadcountTimeseriesItem): number => {
    switch (yAxisMode) {
      case 'newHires':   return item.newHires;
      case 'dismissals': return item.dismissals;
      case 'netChange':  return item.netChange;
      default:           return item.headcount;
    }
  }, [yAxisMode]);

  const pickSecondary = useCallback((item: HeadcountTimeseriesItem): number => {
    switch (yAxisMode) {
      case 'newHires':   return item.dismissals;
      case 'dismissals': return item.newHires;
      case 'netChange':  return item.headcount;
      default:           return item.inExperience;
    }
  }, [yAxisMode]);

  // Per-entity timeseries indexed by period → entity id → item. Used to look
  // up each comparison row when assembling the chartData below.
  const comparisonByPeriod = useMemo(() => {
    if (!isComparisonMode) return null;
    const map = new Map<string, Map<string, HeadcountTimeseriesItem>>();
    comparisonQueries.forEach((q, idx) => {
      const id = comparisonEntityIds[idx];
      const items = ((q.data as HeadcountResponse | undefined)?.data?.timeseries) ?? [];
      items.forEach(item => {
        if (!map.has(item.period)) map.set(item.period, new Map());
        map.get(item.period)!.set(id, item);
      });
    });
    return map;
  }, [isComparisonMode, comparisonQueries, comparisonEntityIds]);

  const chartData = useMemo(() => {
    if (!timeseries.length) return [];
    return timeseries.map(item => {
      const value = pickValue(item);
      const secondaryValue = pickSecondary(item);

      let comparisons: Array<{ entityName: string; value: number; secondaryValue?: number }> | undefined;
      if (isComparisonMode && comparisonByPeriod) {
        const perEntity = comparisonByPeriod.get(item.period);
        comparisons = comparisonEntityIds.map(id => {
          const sub = perEntity?.get(id);
          const name = entityNameById.get(id) ?? id;
          return {
            entityName: name,
            value: sub ? pickValue(sub) : 0,
            secondaryValue: sub ? pickSecondary(sub) : 0,
          };
        });
        if (compareMode === 'separatedWithTotal') {
          comparisons.push({
            entityName: 'Total',
            value,
            secondaryValue,
          });
        }
      }

      return { name: item.label, value, secondaryValue, comparisons };
    });
  }, [timeseries, isComparisonMode, comparisonByPeriod, comparisonEntityIds, entityNameById, compareMode, pickValue, pickSecondary]);

  const valueFormatter = useCallback((value: number, _mode: YAxisMode): string => {
    return Math.round(value).toString();
  }, []);

  const tooltipLabels = useMemo(() => {
    switch (yAxisMode) {
      case 'newHires': return { primary: 'Admissões', secondary: 'Desligamentos' };
      case 'dismissals': return { primary: 'Desligamentos', secondary: 'Admissões' };
      case 'netChange': return { primary: 'Variação líquida', secondary: 'Efetivo' };
      default: return { primary: 'Efetivo', secondary: 'Em experiência' };
    }
  }, [yAxisMode]);

  const yAxisLabel = useMemo(() => {
    switch (yAxisMode) {
      case 'newHires': return 'Admissões';
      case 'dismissals': return 'Desligamentos';
      case 'netChange': return 'Variação';
      default: return 'Efetivo';
    }
  }, [yAxisMode]);

  const periodSummaryLabel = useMemo(() => {
    if (selectedYear && selectedMonths.length > 0) {
      const monthLabels = [...selectedMonths].sort().map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ');
      return `${monthLabels} ${selectedYear}`;
    }
    if (selectedYear) return `Ano ${selectedYear}`;
    return 'Equipe';
  }, [selectedYear, selectedMonths]);

  const handleFilterApply = useCallback((next: {
    filters: HeadcountFilters;
    selectedYear: number | undefined;
    selectedMonths: string[];
    yAxisMode: EquipeYAxisMode;
    compareMode: EquipeCompareMode;
    includeExperienceFailures: boolean;
  }) => {
    setFilters(next.filters);
    setSelectedYear(next.selectedYear);
    setSelectedMonths(next.selectedMonths);
    setYAxisMode(next.yAxisMode);
    setCompareMode(next.compareMode);
    setIncludeExperienceFailures(next.includeExperienceFailures);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!timeseries.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Efetivo', 'Em Experiência', 'Admissões', 'Desligamentos', 'Variação'];
      const rows = timeseries.map(i => [i.label, i.headcount, i.inExperience, i.newHires, i.dismissals, i.netChange]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `equipe-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado!');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [timeseries]);

  const handleExportXLSX = useCallback(() => {
    if (!timeseries.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Efetivo', 'Em Experiência', 'Admissões', 'Desligamentos', 'Variação'];
      const rows = timeseries.map(i => [i.label, i.headcount, i.inExperience, i.newHires, i.dismissals, i.netChange]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 20 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Equipe');
      XLSX.writeFile(wb, `equipe-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado!');
    } catch { toast.error('Erro ao exportar planilha'); }
  }, [timeseries]);

  // Surface loading from both the root query and any in-flight comparison
  // queries so the chart stays in the skeleton state until per-entity data
  // arrives — otherwise comparison series would render zero-filled.
  const comparisonLoading = isComparisonMode && comparisonQueries.some(q => q.isLoading);
  const effectiveIsLoading = isLoading || comparisonLoading;

  const renderChart = () => {
    if (effectiveIsLoading) {
      return (
        <div style={{ height: 'max(380px, calc(100vh - 460px))' }} className="flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={{ height: 'max(380px, calc(100vh - 460px))' }} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{error?.message || 'Erro inesperado'}</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="h-4 w-4 mr-2" />Tentar novamente
          </Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={{ height: 'max(380px, calc(100vh - 460px))' }} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <p className="font-semibold">Nenhum dado encontrado</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar</p>
        </div>
      );
    }
    return (
      <StatisticsChart
        ref={chartHandleRef}
        key={`${isComparisonMode}-${compareDimension}-${compareMode}-${yAxisMode}`}
        data={chartData}
        chartType={chartType}
        yAxisMode="count"
        isComparisonMode={isComparisonMode}
        height="max(380px, calc(100vh - 460px))"
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        tooltipLabels={tooltipLabels}
        trendLine={trendLine}
        goalLine={goalValue != null ? { value: goalValue, label: 'Meta Desempenho Equipe' } : null}
        onDataPointClick={(dataIndex) => {
          const item = timeseries[dataIndex];
          if (item) setPeriodModal(item);
        }}
      />
    );
  };

  const currentChartType = CHART_TYPE_OPTIONS.find(c => c.value === chartType) ?? CHART_TYPE_OPTIONS[0];
  const ChartIcon = currentChartType.icon;

  const hasData = !isLoading && timeseries.length > 0;
  // Variação líquida is a derivative (newHires − dismissals), so it's read-only.
  const isClickableMode = (mode: TeamDrillDownMode): boolean => mode !== 'netChange';
  const openDrillDown = (mode: TeamDrillDownMode) => {
    if (hasData && isClickableMode(mode)) setDrillDown(mode);
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Equipe"
            icon={IconUsers}
            breadcrumbs={[
              { label: 'Início', href: routes.home },
              { label: 'Estatísticas', href: routes.statistics.root },
              { label: 'Recursos Humanos', href: routes.statistics.humanResources.root },
              { label: 'Equipe' },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <IconUsers className="h-5 w-5 text-primary" />
                    {periodSummaryLabel}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span>Evolução do efetivo por período.</span>
                    <Badge variant="outline" className="text-xs">{Y_AXIS_LABEL_BY_MODE[yAxisMode]}</Badge>
                    {isComparisonMode && (
                      <Badge variant="secondary" className="text-xs">
                        {compareDimension === 'sector' ? 'Comparação: Setores' : 'Comparação: Cargos'}
                        {compareMode === 'separatedWithTotal' ? ' + Total' : ''}
                      </Badge>
                    )}
                    {trendLine && (
                      <Badge variant="outline" className="text-xs">{TREND_LABELS[trendLine]}</Badge>
                    )}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Chart type */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ChartIcon className="h-4 w-4 mr-2" />
                        {currentChartType.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Tipo de gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={chartType} onValueChange={v => setChartType(v as HrChartType)}>
                        {CHART_TYPE_OPTIONS.map(c => {
                          const Icon = c.icon;
                          return (
                            <DropdownMenuRadioItem key={c.value} value={c.value} className="group">
                              <Icon className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>{c.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">{c.description}</span>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Trend */}
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
                      <DropdownMenuRadioGroup value={trendLine ?? ''} onValueChange={v => setTrendLine(v ? (v as TrendLineType) : null)}>
                        <DropdownMenuRadioItem value="">Desativada</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma3">Média 3 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma6">Média 6 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma12">Média 12 meses</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Goal line */}
                  {goalMetric && (
                    <Popover open={goalPopoverOpen} onOpenChange={setGoalPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant={goalValue != null ? 'default' : 'outline'} size="sm">
                          <IconTarget className="h-4 w-4 mr-2" />
                          {goalValue != null ? `Meta: ${formatNumber(goalValue, 0)}` : 'Meta'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Definir Meta</p>
                            {goalSource === 'default' && (
                              <p className="text-xs text-muted-foreground">Padrão de Administração › Metas</p>
                            )}
                            {goalSource === 'override' && defaultGoal.value != null && (
                              <p className="text-xs text-muted-foreground">
                                Sobrescrevendo padrão ({formatNumber(defaultGoal.value, 0)})
                              </p>
                            )}
                            {goalSource === 'none' && (
                              <p className="text-xs text-muted-foreground">Sem meta padrão configurada</p>
                            )}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            placeholder={defaultGoal.value != null ? `Padrão: ${defaultGoal.value}` : 'Ex: 50'}
                            value={goalInput}
                            onChange={v => setGoalInput(v == null ? '' : String(v))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const v = parseFloat(goalInput);
                                setGoalOverride(isNaN(v) ? null : v);
                                setGoalPopoverOpen(false);
                              }
                            }}
                            className="bg-transparent"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const v = parseFloat(goalInput);
                                setGoalOverride(isNaN(v) ? null : v);
                                setGoalPopoverOpen(false);
                              }}
                            >
                              Aplicar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setGoalOverride(null);
                                setGoalInput('');
                                setGoalPopoverOpen(false);
                              }}
                            >
                              {goalSource === 'override' ? 'Usar padrão' : 'Limpar'}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Filters */}
                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilterDrawer(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />Filtros
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
                  </Button>

                  {/* Export */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isLoading || !timeseries.length}>
                        <IconDownload className="h-4 w-4 mr-2" />Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* KPI cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Card
                  className={cn('py-2', hasData && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                  onClick={hasData ? () => openDrillDown('headcount') : undefined}
                  role={hasData ? 'button' : undefined}
                  tabIndex={hasData ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (hasData && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openDrillDown('headcount');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconUsers className="h-3.5 w-3.5" /> Efetivo Atual
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Funcionários ativos hoje (efetivados e em experiência).</TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold">{summary ? formatNumber(summary.totalActive) : '0'}</div>
                        <div className="text-[11px] text-foreground/70 mt-0.5">
                          {summary
                            ? `${summary.effected} efetivados · ${summary.inExperiencePeriod} em experiência`
                            : 'Sem dados'}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={cn('py-2', hasData && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                  onClick={hasData ? () => openDrillDown('newHires') : undefined}
                  role={hasData ? 'button' : undefined}
                  tabIndex={hasData ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (hasData && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openDrillDown('newHires');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconUserPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Admissões
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                          {summary ? formatNumber(summary.newHiresInPeriod) : '0'}
                        </div>
                        <div className="text-[11px] text-foreground/70 mt-0.5">No período</div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={cn('py-2', hasData && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                  onClick={hasData ? () => openDrillDown('dismissals') : undefined}
                  role={hasData ? 'button' : undefined}
                  tabIndex={hasData ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (hasData && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openDrillDown('dismissals');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconUserMinus className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      Desligamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold text-red-700 dark:text-red-400">
                          {summary ? formatNumber(summary.dismissalsInPeriod) : '0'}
                        </div>
                        <div className="text-[11px] text-foreground/70 mt-0.5">No período</div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Variação líquida is a derivative (admissões − desligamentos) —
                    not clickable, the underlying records live in those two KPIs. */}
                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconArrowsExchange className="h-3.5 w-3.5" />
                      Variação Líquida
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className={`text-xl font-bold ${summary && summary.netChange >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {summary ? `${summary.netChange >= 0 ? '+' : ''}${summary.netChange}` : '0'}
                        </div>
                        <div className="text-[11px] text-foreground/70 mt-0.5">
                          {summary
                            ? `${summary.newHiresInPeriod} admiss${summary.newHiresInPeriod !== 1 ? 'ões' : 'ão'} · ${summary.dismissalsInPeriod} desligamento${summary.dismissalsInPeriod !== 1 ? 's' : ''}`
                            : 'Sem dados'}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Taxa de rotatividade — folded in from the deleted standalone
                    Rotatividade page. Derived metric (dismissals ÷ efetivo
                    médio), so not clickable. */}
                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconPercentage className="h-3.5 w-3.5" />
                      Taxa de Rotatividade
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Desligamentos no período ÷ efetivo médio.</TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isTurnoverLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold">
                          {turnoverSummary ? `${turnoverSummary.turnoverRate.toFixed(1)}%` : '—'}
                        </div>
                        <div className="text-[11px] text-foreground/70 mt-0.5">
                          {turnoverSummary
                            ? `Efetivo médio: ${formatNumber(turnoverSummary.averageHeadcount)}`
                            : 'Sem dados'}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Chart */}
              <Card>
                <CardContent className="p-4">
                  {renderChart()}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>

        <EquipeFilters
          open={showFilterDrawer}
          onOpenChange={setShowFilterDrawer}
          filters={filters}
          selectedYear={selectedYear}
          selectedMonths={selectedMonths}
          yAxisMode={yAxisMode}
          compareMode={compareMode}
          includeExperienceFailures={includeExperienceFailures}
          onApply={handleFilterApply}
        />

        {/* KPI drill-down — opens when the user clicks Efetivo / Admissões /
            Desligamentos. Variação líquida is not clickable. */}
        <TeamDrillDownModal
          open={drillDown !== null}
          onOpenChange={(o) => { if (!o) setDrillDown(null); }}
          mode={drillDown}
          startDate={filters.startDate}
          endDate={filters.endDate}
          sectorIds={filters.sectorIds}
          positionIds={filters.positionIds}
          sectorColorMap={sectorColorMap}
        />

        {/* Period drill-down — opens when the user clicks an x-axis value */}
        <TeamPeriodModal
          open={periodModal !== null}
          onOpenChange={(o) => { if (!o) setPeriodModal(null); }}
          item={periodModal}
          sectorIds={filters.sectorIds}
          positionIds={filters.positionIds}
          sectorColorMap={sectorColorMap}
        />
      </div>
    </TooltipProvider>
  );
};

export default EquipePage;
