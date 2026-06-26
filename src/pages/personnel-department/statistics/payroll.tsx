import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GOAL_METRIC, routes, PAYROLL_EMPLOYEE_TYPES, CONTRACT_STATUS } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { usePayrollTrends, getHrComparisonType } from '@/hooks/personnel-department/use-hr-analytics';
import { useUsers } from '@/hooks/personnel-department/use-user';
import type { HrAnalyticsFilters, HrChartType } from '@/types/hr-analytics';
import { StatisticsChart, type StatisticsChartHandle } from '@/components/statistics/statistics-chart';
import { formatCurrency, formatPercentage, formatNumber, CHART_COLORS } from '@/types/statistics-common';
import type { YAxisMode, TrendLineType } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconReceipt,
  IconPercentage,
  IconGift,
  IconChartArea,
  IconStack2,
  IconBuilding,
  IconCalendarStats,
  IconRuler,
  IconX,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconUsers,
  IconTarget,
} from '@tabler/icons-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useStatisticsPagePersistence } from '@/hooks/common/use-statistics-page-persistence';
import { StatisticsPresetsMenu } from '@/components/statistics/statistics-presets-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

// =====================
// Constants
// =====================

const COMBOBOX_PAGE_SIZE = 20;

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];

const generateYearOptions = (yearsBack = 6) => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: yearsBack + 1 }, (_, i) => {
    const y = currentYear - i;
    return { value: y.toString(), label: y.toString() };
  });
};
const YEAR_OPTIONS = generateYearOptions();

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

type PayrollYAxisMode = 'gross' | 'net' | 'taxes' | 'bonuses';

const Y_AXIS_OPTIONS: Array<{ value: PayrollYAxisMode; label: string }> = [
  { value: 'gross',   label: 'Salário Bruto' },
  { value: 'net',     label: 'Salário Líquido' },
  { value: 'taxes',   label: 'Descontos / Impostos' },
  { value: 'bonuses', label: 'Bônus' },
];


type ChartTypeOption = {
  value: HrChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
};

const getAvailableChartTypes = (isComparisonMode: boolean): ChartTypeOption[] => {
  const baseTypes: ChartTypeOption[] = [
    { value: 'bar',  label: 'Colunas',     icon: IconChartBar,  description: 'Colunas verticais' },
    { value: 'line', label: 'Linha',       icon: IconChartLine, description: 'Linha simples' },
    { value: 'area', label: 'Área',        icon: IconChartArea, description: 'Área preenchida' },
  ];

  if (isComparisonMode) {
    baseTypes.push({ value: 'bar-stacked', label: 'Empilhadas', icon: IconStack2, description: 'Colunas empilhadas' });
  } else {
    baseTypes.push({ value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Distribuição em pizza' });
  }

  return baseTypes;
};

// Business period helpers (26→25, matching backend / productivity page)
function businessPeriodStartDate(year: number, month: number): Date {
  if (month === 1) return startOfDay(new Date(year - 1, 11, 26));
  return startOfDay(new Date(year, month - 2, 26));
}
function businessPeriodEndDate(year: number, month: number): Date {
  return endOfDay(new Date(year, month - 1, 25));
}

function computeDateRange(
  years: string[],
  months: string[],
): { startDate?: Date; endDate?: Date } {
  if (!years.length) return {};
  const yearNums = years.map(Number).sort((a, b) => a - b);
  const minY = yearNums[0];
  const maxY = yearNums[yearNums.length - 1];
  if (months.length > 0) {
    const monthNums = months.map(Number).sort((a, b) => a - b);
    return {
      startDate: businessPeriodStartDate(minY, monthNums[0]),
      endDate:   businessPeriodEndDate(maxY,   monthNums[monthNums.length - 1]),
    };
  }
  return {
    startDate: businessPeriodStartDate(minY, 1),
    endDate:   businessPeriodEndDate(maxY,   12),
  };
}

// =====================
// Page config persistence (last-seen config + named presets)
// =====================
//
// Plain-JSON snapshot of every user-configurable knob on this page. The filter
// date range is intentionally NOT persisted — it's derived from
// selectedYears/selectedMonths and rebuilt in applyPageConfig exactly as the
// filter sheet does. Per-field `.catch()` keeps stale stored configs from ever
// breaking the page. Goal override/input/popover state is session-only.
const pageConfigSchema = z.object({
  version: z.literal(1).catch(1),
  selectedYears: z.array(z.string()).catch([]),
  selectedMonths: z.array(z.string()).catch([]),
  yAxisMode: z.enum(['gross', 'net', 'taxes', 'bonuses']).catch('gross'),
  chartType: z.enum(['bar', 'pie', 'area', 'line', 'bar-stacked']).catch('area'),
  trendLine: z.enum(['linear', 'sma3', 'sma6', 'sma12']).nullable().catch(null),
  sectorIds: z.array(z.string()).catch([]),
  sortBy: z.string().catch('grossSalary'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc'),
  limit: z.number().int().min(1).catch(50),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

// =====================
// Filter Sheet
// =====================

interface PayrollFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: HrAnalyticsFilters;
  selectedYears: string[];
  selectedMonths: string[];
  yAxisMode: PayrollYAxisMode;
  onApply: (next: {
    filters: HrAnalyticsFilters;
    selectedYears: string[];
    selectedMonths: string[];
    yAxisMode: PayrollYAxisMode;
  }) => void;
}

function PayrollFiltersSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, yAxisMode, onApply,
}: PayrollFiltersProps) {
  const [local, setLocal] = useState<HrAnalyticsFilters>(filters);
  const [localY, setLocalY] = useState<PayrollYAxisMode>(yAxisMode);
  const [localYears, setLocalYears] = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalY(yAxisMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
    }
  }, [open, filters, yAxisMode, selectedYears, selectedMonths]);

  const fetchSectors = useCallback(async (search: string, page = 1) => {
    const res = await getSectors({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (res.data || []).map(s => ({ value: s.id, label: s.name })),
      hasMore: res.meta?.hasNextPage || false,
    };
  }, []);

  const handleApply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths);
    const next: HrAnalyticsFilters = {
      ...local,
      startDate: startDate ?? local.startDate,
      endDate:   endDate   ?? local.endDate,
      periods: undefined,
    };
    onApply({
      filters: next,
      selectedYears: localYears,
      selectedMonths: localMonths,
      yAxisMode: localY,
    });
    onOpenChange(false);
  }, [local, localYears, localMonths, localY, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    const cy = new Date().getFullYear().toString();
    setLocalY('gross');
    setLocalYears([cy]);
    setLocalMonths([]);
    setLocal({
      ...local,
      sectorIds: undefined,
    });
  }, [local]);

  const activeCount = [
    (local.sectorIds?.length ?? 0) > 0,
    (() => {
      const cy = new Date().getFullYear().toString();
      const isDefaultYear = localYears.length === 1 && localYears[0] === cy;
      const isDefaultMonths = localMonths.length === 0;
      return !(isDefaultYear && isDefaultMonths);
    })(),
  ].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-xl border-border/50 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Configure período, métrica e setores</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            {/* Y-axis */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconRuler className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => setLocalY(v as PayrollYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Years */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Anos
              </Label>
              <Combobox
                mode="multiple"
                value={localYears}
                onValueChange={v => setLocalYears(Array.isArray(v) ? v : v ? [v] : [])}
                options={YEAR_OPTIONS}
                placeholder="Selecione os anos..."
                searchPlaceholder="Buscar ano..."
                emptyText="Nenhum ano encontrado"
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                {localYears.length === 0
                  ? 'Sem seleção → ano atual'
                  : `Exibe os meses dos anos: ${[...localYears].sort().join(', ')}`}
              </p>
            </div>

            {/* Months */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Meses
              </Label>
              <Combobox
                mode="multiple"
                value={localMonths}
                onValueChange={v => setLocalMonths(Array.isArray(v) ? v : v ? [v] : [])}
                options={MONTH_OPTIONS}
                placeholder="Todos os meses..."
                searchPlaceholder="Buscar mês..."
                emptyText="Nenhum mês"
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                {localMonths.length === 0
                  ? 'Sem seleção → todos os meses do(s) ano(s)'
                  : `Exibe apenas: ${[...localMonths].sort().map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ')}`}
              </p>
            </div>

            {/* Sectors */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconBuilding className="h-4 w-4" />
                Setores
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
                loadingText="Carregando setores..."
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                Sem seleção = todos. Selecione 2+ para comparação.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// Employees Drill-down Modal
//
// Lists colaboradores active in the filtered window (admitted before the
// window ends and not dismissed before it starts) with their position
// salary, so a click on Folha Total / Bônus shows real per-employee
// records (not synthetic period summaries).
// =====================

type DrillDownMode = 'gross' | 'bonuses';

interface EmployeeRow {
  id: string;
  name: string;
  sectorName: string;
  positionName: string;
  remuneration: number;
}

interface PayrollEmployeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DrillDownMode | null;
  startDate: Date | undefined;
  endDate: Date | undefined;
  sectorIds: string[] | undefined;
  periodLabel: string;
  totalAggregate: number;
  totalBonuses: number;
  // sectorId → hex color, mirroring the chart's bar colors. When provided
  // and >1 sector is present in the result, names are tinted by sector and
  // rows are grouped by sector then remuneration desc.
  sectorColorMap?: Record<string, string>;
}

function PayrollEmployeesModal({
  open,
  onOpenChange,
  mode,
  startDate,
  endDate,
  sectorIds,
  periodLabel,
  totalAggregate,
  totalBonuses,
  sectorColorMap,
}: PayrollEmployeesModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  // admissionDate <= window-end gets every employee admitted before the window
  // ended. The OR on terminationDate is applied client-side: keep employees still
  // active (no terminationDate) OR dismissed at or after window start.
  // Off-folha gate: only employee types that actually run through the payroll
  // (PAYROLL_EMPLOYEE_TYPES = [CLT]) are included.
  const { data: usersResp, isLoading } = useUsers({
    where: {
      currentContract: endDate ? { is: { admissionDate: { lte: endDate } } } : undefined,
      currentEmployeeType: { in: [...PAYROLL_EMPLOYEE_TYPES] },
      sectorId: sectorIds && sectorIds.length > 0 ? { in: sectorIds } : undefined,
    },
    include: { sector: true, position: true, currentContract: true },
    orderBy: { name: 'asc' },
    limit: 100,
    enabled: open,
  } as any);

  const employees: Array<EmployeeRow & { sectorId: string | null }> = useMemo(() => {
    const raw = (usersResp?.data ?? []) as any[];
    return raw
      .filter(u => {
        if (!startDate) return true;
        // Active (not dismissed) employees always pass; dismissed ones only if
        // their termination date falls at or after the window start.
        if (u.currentContractStatus !== CONTRACT_STATUS.TERMINATED) return true;
        const termination = u.currentContract?.terminationDate;
        if (!termination) return true;
        return new Date(termination).getTime() >= startDate.getTime();
      })
      .map(u => ({
        id: u.id as string,
        name: (u.name as string) || '—',
        sectorId: (u.sectorId as string | null) ?? null,
        sectorName: (u.sector?.name as string) || '—',
        positionName: (u.position?.name as string) || '—',
        remuneration: Number(u.position?.remuneration ?? 0),
      }));
  }, [usersResp, startDate]);

  const multiSector = useMemo(() => {
    if (!sectorColorMap) return false;
    const seen = new Set<string>();
    for (const e of employees) if (e.sectorId) seen.add(e.sectorId);
    return seen.size > 1;
  }, [sectorColorMap, employees]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? employees.filter(e =>
          e.name.toLowerCase().includes(term) ||
          e.sectorName.toLowerCase().includes(term) ||
          e.positionName.toLowerCase().includes(term),
        )
      : employees;
    if (!multiSector) return base;
    return [...base].sort((a, b) => {
      const s = a.sectorName.localeCompare(b.sectorName);
      if (s !== 0) return s;
      return b.remuneration - a.remuneration;
    });
  }, [employees, search, multiSector]);

  const title = mode === 'bonuses' ? 'Bônus do período' : 'Folha do período';
  const totalForMode = mode === 'bonuses' ? totalBonuses : totalAggregate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <IconCash className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            <span className="font-semibold text-foreground">{periodLabel}</span>
            {' · '}
            <span className="font-semibold text-foreground">{formatCurrency(totalForMode)}</span>
            {' · '}
            {isLoading
              ? 'carregando colaboradores…'
              : <><span className="font-semibold text-foreground">{employees.length}</span> colaborador{employees.length === 1 ? '' : 'es'} ativo{employees.length === 1 ? '' : 's'} no período</>
            }
            <span className="block text-xs text-foreground/60 mt-1">Exibindo até 100 registros</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b shrink-0">
          <Input
            type="text"
            value={search}
            onChange={v => setSearch(v == null ? '' : String(v))}
            placeholder="Buscar por nome, setor ou cargo..."
            className="w-full"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <Table className="[&>div]:border-0 w-full [&_th]:px-6 [&_td]:px-6">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="text-sm">Colaborador</TableHead>
                <TableHead className="text-sm">Setor</TableHead>
                <TableHead className="text-sm">Cargo</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap">Remuneração base</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-foreground/60">
                    <Skeleton className="h-4 w-48 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-sm text-foreground/60">
                    {search ? 'Nenhum colaborador encontrado.' : 'Nenhum colaborador ativo no período.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(e => {
                  const sectorColor = multiSector && e.sectorId
                    ? sectorColorMap?.[e.sectorId]
                    : undefined;
                  return (
                  <TableRow key={e.id} className="text-sm">
                    <TableCell
                      className="py-3 font-medium whitespace-nowrap"
                      style={sectorColor ? { color: sectorColor } : undefined}
                      title={sectorColor ? e.sectorName : undefined}
                    >{e.name}</TableCell>
                    <TableCell className="text-foreground/85 whitespace-nowrap">{e.sectorName}</TableCell>
                    <TableCell className="text-foreground/85 whitespace-nowrap">{e.positionName}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(e.remuneration)}</TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {search && !isLoading && (
          <div className="px-6 py-2 border-t shrink-0 text-xs text-foreground/60">
            Mostrando {filtered.length} de {employees.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =====================
// Main Page
// =====================

const PayrollStatisticsPage = () => {
  usePageTracker({
    page: 'hr-payroll-analytics',
    title: 'Folha de Pagamento - Estatísticas',
  });

  const initialYear = useMemo(() => new Date().getFullYear().toString(), []);
  const [selectedYears, setSelectedYears] = useState<string[]>([initialYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [filters, setFilters] = useState<HrAnalyticsFilters>(() => {
    const { startDate, endDate } = computeDateRange([initialYear], []);
    return {
      startDate: startDate as Date,
      endDate:   endDate as Date,
      sortBy: 'grossSalary',
      sortOrder: 'desc',
      limit: 50,
    };
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const chartHandleRef = useRef<StatisticsChartHandle>(null);

  const [chartType, setChartType] = useState<HrChartType>('area');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  const [yAxisMode, setYAxisMode] = useState<PayrollYAxisMode>('gross');
  const [drillDown, setDrillDown] = useState<DrillDownMode | null>(null);
  const [goalOverride, setGoalOverride] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [goalPopoverOpen, setGoalPopoverOpen] = useState(false);

  useEffect(() => {
    setGoalOverride(null);
    setGoalInput('');
  }, [yAxisMode]);
  // Drill-down triggered by clicking an x-axis value on the chart. We override
  // the modal's date range with the period-specific bounds derived from
  // `item.period` so the list shows employees active during the clicked month.
  const [periodDrill, setPeriodDrill] = useState<{
    mode: DrillDownMode;
    startDate: Date;
    endDate: Date;
    label: string;
  } | null>(null);

  const comparisonType = useMemo(() => getHrComparisonType(filters), [filters]);
  const isComparisonMode = comparisonType !== 'simple';

  // sectorId → bar color. Mirrors statistics-chart.tsx's per-comparison color
  // assignment so the period modal tints names with the same color the user
  // just clicked on the chart.
  const sectorColorMap = useMemo<Record<string, string> | undefined>(() => {
    if (comparisonType !== 'sectors' || !filters.sectorIds?.length) return undefined;
    const map: Record<string, string> = {};
    filters.sectorIds.forEach((id, i) => {
      map[id] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [comparisonType, filters.sectorIds]);

  const availableChartTypes = useMemo(() => getAvailableChartTypes(isComparisonMode), [isComparisonMode]);

  useEffect(() => {
    const ok = availableChartTypes.some(t => t.value === chartType);
    if (!ok) setChartType('area');
  }, [availableChartTypes, chartType]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.sectorIds?.length) n++;
    const cy = new Date().getFullYear().toString();
    const isDefaultYear = selectedYears.length === 1 && selectedYears[0] === cy;
    const isDefaultMonths = selectedMonths.length === 0;
    if (!(isDefaultYear && isDefaultMonths)) n++;
    return n;
  }, [filters, selectedYears, selectedMonths]);

  const { data, isLoading, isError, error, refetch } = usePayrollTrends(filters);
  const rawItems = data?.data?.items ?? [];
  const summary = data?.data?.summary;

  // Each yAxisMode maps to a different sector-scoped goal. 'taxes' is a
  // derivative (tax burden %) and has no first-class goal today. Gross and net
  // share the single "Folha" goal until separate budgets are needed.
  const goalMetric =
    yAxisMode === 'gross' || yAxisMode === 'net' ? GOAL_METRIC.HR_PAYROLL_GROSS
    : yAxisMode === 'bonuses' ? GOAL_METRIC.HR_PAYROLL_BONUSES_TOTAL
    : null;

  const defaultGoal = useDefaultGoal({
    metric: goalMetric ?? GOAL_METRIC.HR_PAYROLL_GROSS,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    sectorIds: filters.sectorIds,
    // Each chart datapoint is one month's total; goal-line is the average of
    // the monthly budget targets across the displayed range.
    aggregation: 'AVERAGE_PER_PERIOD',
    enabled: goalMetric !== null,
  });

  // When comparing by sectors each line represents ONE sector, so the goal
  // (a sum across the filtered sectors) must be averaged. Period comparison
  // leaves the monthly target unchanged — each year-line still aims at the
  // same per-month budget.
  const goalSectorSplit =
    comparisonType === 'sectors' ? Math.max(1, filters.sectorIds?.length ?? 1) : 1;

  const goalValue = useMemo(() => {
    const raw = goalOverride ?? defaultGoal.value;
    if (raw == null) return null;
    return goalSectorSplit > 1 ? raw / goalSectorSplit : raw;
  }, [goalOverride, defaultGoal.value, goalSectorSplit]);

  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  const perPeriodGoalValues = useMemo(() => {
    if (goalOverride != null || goalMetric === null || !defaultGoal.perPeriodValues) return null;
    return rawItems.map(item => {
      const rawSum = defaultGoal.perPeriodValues!.get(item.period) ?? null;
      if (rawSum == null) return null;
      return goalSectorSplit > 1 ? rawSum / goalSectorSplit : rawSum;
    });
  }, [goalOverride, goalMetric, defaultGoal.perPeriodValues, rawItems, goalSectorSplit]);

  const handleFilterApply = useCallback((next: {
    filters: HrAnalyticsFilters;
    selectedYears: string[];
    selectedMonths: string[];
    yAxisMode: PayrollYAxisMode;
  }) => {
    setFilters({ ...next.filters, limit: next.filters.limit || 50 });
    setSelectedYears(next.selectedYears);
    setSelectedMonths(next.selectedMonths);
    setYAxisMode(next.yAxisMode);
  }, []);

  // ── Page config persistence (auto-restore last config + named presets) ──
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    selectedYears,
    selectedMonths,
    yAxisMode,
    chartType,
    trendLine,
    sectorIds: filters.sectorIds ?? [],
    sortBy: filters.sortBy ?? 'grossSalary',
    sortOrder: (filters.sortOrder ?? 'desc') as PageConfig['sortOrder'],
    limit: filters.limit ?? 50,
  }), [selectedYears, selectedMonths, yAxisMode, chartType, trendLine, filters]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    const years = config.selectedYears;
    const months = config.selectedMonths;
    // Rebuild the derived date range the same way the filter sheet's handleApply
    // does (periods cleared — this page groups by calendar 26→25 internally).
    const { startDate, endDate } = computeDateRange(years, months);
    setFilters(f => ({
      ...f,
      startDate: startDate ?? f.startDate,
      endDate:   endDate   ?? f.endDate,
      periods:   undefined,
      sectorIds: config.sectorIds.length ? config.sectorIds : undefined,
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      limit: config.limit,
    }));
    setSelectedYears(years);
    setSelectedMonths(months);
    setYAxisMode(config.yAxisMode);
    setChartType(config.chartType);
    setTrendLine(config.trendLine);
  }, []);

  const {
    presets,
    activePreset,
    savePreset,
    applyPreset,
    overwritePreset,
    renamePreset,
    deletePreset,
    isSavingPreset,
  } = useStatisticsPagePersistence({
    pageKey: routes.statistics.personnelDepartment.payroll,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

  const handleExportCSV = useCallback(() => {
    if (!rawItems.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Salário Bruto', 'Salário Líquido', 'Descontos', 'INSS', 'IRRF', 'FGTS', 'HE 50%', 'HE 100%', 'Adicional Noturno', 'Bônus', 'Funcionários'];
      const rows = rawItems.map(item => [
        item.label,
        item.grossSalary.toFixed(2),
        item.netSalary.toFixed(2),
        item.totalDiscounts.toFixed(2),
        item.inssAmount.toFixed(2),
        item.irrfAmount.toFixed(2),
        item.fgtsAmount.toFixed(2),
        item.overtime50Amount.toFixed(2),
        item.overtime100Amount.toFixed(2),
        item.nightDifferentialAmount.toFixed(2),
        item.bonusTotal.toFixed(2),
        item.headcount.toString(),
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `folha-pagamento-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado!');
    } catch {
      toast.error('Erro ao exportar dados');
    }
  }, [rawItems]);

  const handleExportXLSX = useCallback(() => {
    if (!rawItems.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Salário Bruto', 'Salário Líquido', 'Descontos', 'INSS', 'IRRF', 'FGTS', 'Bônus', 'Funcionários'];
      const rows = rawItems.map(item => [
        item.label, item.grossSalary, item.netSalary, item.totalDiscounts,
        item.inssAmount, item.irrfAmount, item.fgtsAmount, item.bonusTotal, item.headcount,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 20 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Folha de Pagamento');
      XLSX.writeFile(wb, `folha-pagamento-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado!');
    } catch {
      toast.error('Erro ao exportar planilha');
    }
  }, [rawItems]);

  const chartYAxisMode: YAxisMode = 'value';

  const chartData = useMemo(() => {
    if (!rawItems.length) return [];
    return rawItems.map(item => {
      let value: number;
      let secondaryValue: number;
      switch (yAxisMode) {
        case 'net':
          value = item.netSalary;
          secondaryValue = item.grossSalary;
          break;
        case 'taxes':
          value = item.totalDiscounts;
          secondaryValue = item.grossSalary;
          break;
        case 'bonuses':
          value = item.bonusTotal;
          secondaryValue = item.grossSalary;
          break;
        default:
          value = item.grossSalary;
          secondaryValue = item.netSalary;
          break;
      }
      return { name: item.label, value, secondaryValue };
    });
  }, [rawItems, yAxisMode]);

  const valueFormatter = useCallback(
    (value: number, _mode: YAxisMode): string => formatCurrency(value),
    [],
  );

  const yAxisLabel = useMemo(() => {
    switch (yAxisMode) {
      case 'net':     return 'Salário Líquido (R$)';
      case 'taxes':   return 'Descontos (R$)';
      case 'bonuses': return 'Bônus (R$)';
      default:        return 'Salário Bruto (R$)';
    }
  }, [yAxisMode]);

  const tooltipLabels = useMemo(() => {
    switch (yAxisMode) {
      case 'net':     return { primary: 'Salário Líquido', secondary: 'Salário Bruto' };
      case 'taxes':   return { primary: 'Descontos',       secondary: 'Salário Bruto' };
      case 'bonuses': return { primary: 'Bônus',           secondary: 'Salário Bruto' };
      default:        return { primary: 'Salário Bruto',   secondary: 'Salário Líquido' };
    }
  }, [yAxisMode]);

  const periodSummaryLabel = useMemo(() => {
    if (!selectedYears.length) return 'Folha';
    const yearsSorted = [...selectedYears].sort();
    const monthsSorted = [...selectedMonths].sort();
    if (monthsSorted.length === 0) {
      return yearsSorted.length === 1 ? `Folha · Ano ${yearsSorted[0]}` : `Folha · Anos ${yearsSorted.join(', ')}`;
    }
    const monthNames = monthsSorted.map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ');
    return yearsSorted.length === 1
      ? `Folha · ${monthNames} ${yearsSorted[0]}`
      : `Folha · ${monthNames} · ${yearsSorted.length} anos`;
  }, [selectedYears, selectedMonths]);

  const renderChart = () => {
    const chartHeightStyle = { height: '100%' };
    if (isLoading) {
      return (
        <div style={chartHeightStyle} className="flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'Ocorreu um erro ao buscar os dados'}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros para visualizar os dados
            </p>
          </div>
        </div>
      );
    }
    return (
      <StatisticsChart
        ref={chartHandleRef}
        data={chartData}
        chartType={chartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={isComparisonMode}
        height="100%"
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        tooltipLabels={tooltipLabels}
        trendLine={trendLine}
        goalLine={goalValue != null && !perPeriodGoalValues?.some(v => v != null) ? { value: goalValue, label: 'Meta Folha de Pagamento' } : null}
        perPeriodGoalLine={perPeriodGoalValues?.some(v => v != null) ? { values: perPeriodGoalValues, label: 'Meta Folha de Pagamento' } : null}
        onDataPointClick={(dataIndex) => {
          const it = rawItems[dataIndex];
          if (!it) return;
          const m = /^(\d{4})-(\d{2})$/.exec(it.period);
          if (!m) return;
          const y = parseInt(m[1], 10);
          const mo = parseInt(m[2], 10);
          // Drill into bonuses if the current series highlights bonus totals;
          // otherwise show gross-salary breakdown (the default list mode).
          const driveMode: DrillDownMode = yAxisMode === 'bonuses' ? 'bonuses' : 'gross';
          setPeriodDrill({
            mode: driveMode,
            startDate: businessPeriodStartDate(y, mo),
            endDate: businessPeriodEndDate(y, mo),
            label: it.label,
          });
        }}
      />
    );
  };

  const currentChartType = availableChartTypes.find(t => t.value === chartType) ?? availableChartTypes[0];
  const ChartIcon = currentChartType.icon;

  const hasData = !isLoading && rawItems.length > 0;
  const openDrillDown = (mode: DrillDownMode) => { if (hasData) setDrillDown(mode); };

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
      <div className="flex-shrink-0">
        <PageHeader
          title="Folha de Pagamento"
          icon={IconCash}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Departamento Pessoal', href: routes.statistics.personnelDepartment.root },
            { label: 'Folha de Pagamento' },
          ]}
          headerExtra={
            <>
              <StatisticsPresetsMenu
                presets={presets}
                activePreset={activePreset}
                onSave={savePreset}
                onApply={applyPreset}
                onOverwrite={overwritePreset}
                onRename={renamePreset}
                onDelete={deletePreset}
                isSaving={isSavingPreset}
              />
            </>
          }
        />
      </div>

        <Card className="mt-4 flex-1 min-h-0 flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <IconCash className="h-5 w-5 text-primary" />
                  {periodSummaryLabel}
                </CardTitle>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Chart Type */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ChartIcon className="h-4 w-4 mr-2" />
                      {currentChartType.label}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={chartType}
                      onValueChange={v => setChartType(v as HrChartType)}
                    >
                      {availableChartTypes.map(ct => {
                        const Icon = ct.icon;
                        return (
                          <DropdownMenuRadioItem key={ct.value} value={ct.value} className="group">
                            <Icon className="h-4 w-4 mr-2" />
                            <div className="flex flex-col">
                              <span>{ct.label}</span>
                              <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">
                                {ct.description}
                              </span>
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
                    <DropdownMenuRadioGroup
                      value={trendLine ?? ''}
                      onValueChange={v => setTrendLine(v ? (v as TrendLineType) : null)}
                    >
                      <DropdownMenuRadioItem value="">Desativada</DropdownMenuRadioItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sma3">Média Móvel 3 meses</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sma6">Média Móvel 6 meses</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sma12">Média Móvel 12 meses</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Goal line */}
                {goalMetric && (
                  <Popover open={goalPopoverOpen} onOpenChange={setGoalPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={goalValue != null ? 'default' : 'outline'} size="sm">
                        <IconTarget className="h-4 w-4 mr-2" />
                        {goalValue != null ? `Meta: ${formatCurrency(goalValue)}` : 'Meta'}
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
                              Sobrescrevendo padrão ({formatCurrency(defaultGoal.value)})
                            </p>
                          )}
                          {goalSource === 'none' && (
                            <p className="text-xs text-muted-foreground">Sem meta padrão configurada</p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          placeholder={defaultGoal.value != null ? `Padrão: ${defaultGoal.value}` : 'Ex: 100000'}
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
                  <IconFilter className="h-4 w-4 mr-2" />
                  Filtros
                  {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
                </Button>

                {/* Export */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isLoading || !rawItems.length}>
                      <IconDownload className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Formato</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportXLSX}>
                      <IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col gap-5 overflow-hidden">
            {/* KPI Strip — 4 cards.
                Folha Total and Total de Bônus drill into employees.
                Salário Médio and Carga Tributária are averages → not clickable. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
              <Card
                className={cn('py-2', hasData && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                onClick={hasData ? () => openDrillDown('gross') : undefined}
                role={hasData ? 'button' : undefined}
                tabIndex={hasData ? 0 : undefined}
                onKeyDown={e => {
                  if (hasData && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openDrillDown('gross');
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <IconCash className="h-3.5 w-3.5" /> Folha Total
                  </CardTitle>
                  <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  {isLoading ? (
                    <Skeleton className="h-7 w-32" />
                  ) : (
                    <>
                      <div className="text-xl font-bold">
                        {summary ? formatCurrency(summary.totalGrossSalary) : formatCurrency(0)}
                      </div>
                      {summary && summary.monthOverMonthGrowth !== 0 ? (
                        <div className="text-[11px] text-foreground/70 mt-0.5 flex items-center gap-1">
                          {summary.monthOverMonthGrowth > 0 ? (
                            <IconTrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <IconTrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                          )}
                          <span>{formatPercentage(Math.abs(summary.monthOverMonthGrowth))} vs. mês anterior</span>
                        </div>
                      ) : !hasData ? (
                        <div className="text-[11px] text-foreground/70 mt-0.5">Sem dados</div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <IconReceipt className="h-3.5 w-3.5" /> Salário Médio
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  {isLoading ? (
                    <Skeleton className="h-7 w-28" />
                  ) : (
                    <>
                      <div className="text-xl font-bold">
                        {summary ? formatCurrency(summary.avgGrossSalary) : formatCurrency(0)}
                      </div>
                      <div className="text-[11px] text-foreground/70 mt-0.5">por colaborador / mês</div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <IconPercentage className="h-3.5 w-3.5" /> Carga Tributária
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  {isLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <>
                      <div className="text-xl font-bold">
                        {summary ? formatPercentage(summary.taxBurdenPercent) : '0%'}
                      </div>
                      <div className="text-[11px] text-foreground/70 mt-0.5">descontos / bruto</div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card
                className={cn('py-2', hasData && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                onClick={hasData ? () => openDrillDown('bonuses') : undefined}
                role={hasData ? 'button' : undefined}
                tabIndex={hasData ? 0 : undefined}
                onKeyDown={e => {
                  if (hasData && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openDrillDown('bonuses');
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <IconGift className="h-3.5 w-3.5" /> Total de Bônus
                  </CardTitle>
                  <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  {isLoading ? (
                    <Skeleton className="h-7 w-28" />
                  ) : (
                    <>
                      <div className="text-xl font-bold">
                        {summary ? formatCurrency(summary.totalBonuses) : formatCurrency(0)}
                      </div>
                      {!hasData && (
                        <div className="text-[11px] text-foreground/70 mt-0.5">Sem dados</div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card className="flex-1 min-h-0 flex flex-col">
              <CardContent className="flex-1 min-h-0 p-4">
                {renderChart()}
              </CardContent>
            </Card>

            <div className="text-[11px] text-foreground/55 flex-shrink-0">
              Períodos no intervalo:{' '}
              <strong className="text-foreground/80">{formatNumber(rawItems.length)}</strong>
            </div>
          </CardContent>
        </Card>

      <PayrollFiltersSheet
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        filters={filters}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
        yAxisMode={yAxisMode}
        onApply={handleFilterApply}
      />

      <PayrollEmployeesModal
        open={drillDown !== null}
        onOpenChange={o => { if (!o) setDrillDown(null); }}
        mode={drillDown}
        startDate={filters.startDate}
        endDate={filters.endDate}
        sectorIds={filters.sectorIds}
        periodLabel={periodSummaryLabel.replace(/^Folha\s·\s/, '')}
        totalAggregate={summary?.totalGrossSalary ?? 0}
        totalBonuses={summary?.totalBonuses ?? 0}
        sectorColorMap={sectorColorMap}
      />

      {/* Period drill-down — opens when the user clicks an x-axis value */}
      <PayrollEmployeesModal
        open={periodDrill !== null}
        onOpenChange={o => { if (!o) setPeriodDrill(null); }}
        mode={periodDrill?.mode ?? null}
        startDate={periodDrill?.startDate}
        endDate={periodDrill?.endDate}
        sectorIds={filters.sectorIds}
        periodLabel={periodDrill?.label ?? ''}
        totalAggregate={rawItems.find(i => i.label === periodDrill?.label)?.grossSalary ?? 0}
        totalBonuses={rawItems.find(i => i.label === periodDrill?.label)?.bonusTotal ?? 0}
        sectorColorMap={sectorColorMap}
      />
    </div>
  );
};

export default PayrollStatisticsPage;
