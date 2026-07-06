import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  IconUsers,
  IconCalculator,
  IconFilter,
  IconBuilding,
  IconUserMinus,
  IconBriefcase,
  IconUserCheck,
  IconArrowUp,
  IconArrowDown,
  IconArrowUpRight,
  IconArrowDownRight,
  IconChevronLeft,
  IconChevronRight,
  IconSelector
} from "@tabler/icons-react";
import { formatCurrency, getBonusPeriod, getCurrentPayrollPeriod, formatDate } from "../../../utils";
import { useUsers, useSectors, usePositions } from "../../../hooks";
import { bonusService } from "../../../api-client";
import { useBonusSimulation, usePeriodAdjustment } from "../../../hooks/personnel-department/use-bonus";
import { cn } from "@/lib/utils";
import { CONTRACT_STATUS, EMPLOYEE_TYPE } from "../../../constants";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { usePersistedState } from "@/hooks/common/use-persisted-state";
import { toast } from "@/components/ui/sonner";
import { PromotionsSimulationFilters } from "./promotions-simulation-filters";

// Bumped to v2 when the Performance column was restored so the new column
// appears for users who already had column preferences saved.
const COLUMN_STORAGE_KEY = "promotions-simulation-visible-columns-v2";

// localStorage keys — persist filters/sort/task config so the user returns to
// exactly where they left off after navigating away.
const FILTERS_STORAGE_KEY = "promotions-simulation-filters";
const SORT_STORAGE_KEY = "promotions-simulation-sort";
const TASK_STORAGE_KEY = "promotions-simulation-task";
const OVERRIDES_STORAGE_KEY = "promotions-simulation-row-overrides";

// Per-row simulation edits (keyed by user id) persisted so the Cargo /
// Performance changes survive navigation. Only the fields the user actually
// touched are stored; everything else is rebuilt from the fresh user fetch.
type RowOverride = { positionId?: string; performanceLevel?: number };

// Read the current monthly remuneration off a position. Backend populates the
// virtual `remuneration` field from the current MonetaryValue; fall back to the
// newest history row. Performance level never affects base remuneration.
const getPositionRemuneration = (position?: {
  remuneration?: number;
  remunerations?: Array<{ value: number }>;
} | null): number => {
  return position?.remuneration ?? position?.remunerations?.[0]?.value ?? 0;
};

// Signed currency for delta columns.
const formatSignedCurrency = (value: number): string => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
};

// A right-aligned signed-currency delta cell with up/down arrow + color.
function DeltaCell({ value, zeroThreshold = 0 }: { value: number; zeroThreshold?: number }) {
  if (Math.abs(value) <= zeroThreshold) {
    return <div className="px-4 py-2 text-right text-sm text-muted-foreground">—</div>;
  }
  const positive = value > 0;
  return (
    <div className={cn("px-4 py-2 text-right text-sm font-medium flex items-center justify-end gap-0.5", positive ? "text-green-600" : "text-red-600")}>
      {positive ? <IconArrowUpRight className="h-3 w-3" /> : <IconArrowDownRight className="h-3 w-3" />}
      {formatSignedCurrency(value)}
    </div>
  );
}

// Performance level selector with chevron buttons (0-5). Mirrors the bonus
// simulation — editing it re-runs /bonus/simulate for the "Bônus Previsto".
interface PerformanceLevelSelectorProps {
  value: number;
  onChange: (value: number) => void;
  isModified?: boolean;
  disabled?: boolean;
  className?: string;
}

function PerformanceLevelSelector({ value, onChange, isModified, disabled, className }: PerformanceLevelSelectorProps) {
  const handleDecrease = () => {
    const newValue = Math.max(0, value - 1);
    if (newValue !== value) onChange(newValue);
  };
  const handleIncrease = () => {
    const newValue = Math.min(5, value + 1);
    if (newValue !== value) onChange(newValue);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={disabled || value <= 0}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Diminuir nível"
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "flex items-center justify-center w-8 h-7 font-semibold text-sm",
          isModified ? "text-orange-600" : "text-foreground",
          disabled && "opacity-50"
        )}
        title={`Nível de desempenho: ${value} (0-5)`}
      >
        {value}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={disabled || value >= 5}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Aumentar nível"
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Export columns configuration
const EXPORT_COLUMNS: ExportColumn<SimulatedUser>[] = [
  { id: "payrollNumber", label: "Nº Folha", getValue: (u: SimulatedUser) => u.payrollNumber?.toString() || "-" },
  { id: "name", label: "Nome", getValue: (u: SimulatedUser) => u.name },
  { id: "sectorName", label: "Setor", getValue: (u: SimulatedUser) => u.sectorName || "-" },
  { id: "positionName", label: "Cargo", getValue: (u: SimulatedUser) => u.positionName },
  { id: "performanceLevel", label: "Performance", getValue: (u: SimulatedUser) => u.performanceLevel.toString() },
  { id: "currentRemuneration", label: "Remun. Atual", getValue: (u: SimulatedUser) => formatCurrency(u.originalRemuneration) },
  { id: "expectedRemuneration", label: "Remun. Prevista", getValue: (u: SimulatedUser) => formatCurrency(u.expectedRemuneration) },
  { id: "remunerationDiff", label: "Dif. Remun.", getValue: (u: SimulatedUser) => formatSignedCurrency(u.expectedRemuneration - u.originalRemuneration) },
  { id: "bonusAtual", label: "Bônus Atual", getValue: (u: SimulatedUser) => formatCurrency(u.bonusAtual) },
  { id: "bonusPrevisto", label: "Bônus Previsto", getValue: (u: SimulatedUser) => formatCurrency(u.bonusPrevisto) },
  { id: "bonusDiff", label: "Dif. Bônus", getValue: (u: SimulatedUser) => formatSignedCurrency(u.bonusPrevisto - u.bonusAtual) },
];

const DEFAULT_VISIBLE_COLUMNS = new Set([
  "payrollNumber", "name", "sectorName", "positionName", "performanceLevel",
  "currentRemuneration", "expectedRemuneration", "remunerationDiff",
  "bonusAtual", "bonusPrevisto", "bonusDiff"
]);

interface SimulatedUser {
  id: string;
  name: string;
  email: string | null;
  payrollNumber: number | null;
  sectorId: string | null;
  sectorName: string | null;
  // Baselines (current position/remuneration/performance)
  originalPositionId: string | null;
  originalPositionName: string;
  originalRemuneration: number;
  originalPerformanceLevel: number;
  // Bonifiable flags drive bonus eligibility (average-per-user divisor)
  originalBonifiable: boolean;
  // Simulation fields (only the cargo is editable)
  positionId: string | null;
  positionName: string;
  performanceLevel: number;   // stays at the collaborator's current level
  // Derived
  expectedRemuneration: number;   // remuneration of the (possibly changed) position
  bonusAtual: number;             // bonus at the current position (baseline)
  bonusPrevisto: number;          // bonus at the simulated position
}

type SortColumn =
  | 'payrollNumber'
  | 'name'
  | 'sectorName'
  | 'positionName'
  | 'performanceLevel'
  | 'currentRemuneration'
  | 'expectedRemuneration'
  | 'remunerationDiff'
  | 'bonusAtual'
  | 'bonusPrevisto'
  | 'bonusDiff'
  | null;

interface PromotionsSimulationInteractiveTableProps {
  className?: string;
}

export function PromotionsSimulationInteractiveTable({ className }: PromotionsSimulationInteractiveTableProps) {
  const [simulatedUsers, setSimulatedUsers] = useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Task-count controls (mirrors the bonus simulation) — quantity/input persisted
  const [taskQuantity, setTaskQuantity] = usePersistedState<number>(`${TASK_STORAGE_KEY}-quantity`, 0);
  const [originalTaskQuantity, setOriginalTaskQuantity] = useState<number>(0);
  const [taskInput, setTaskInput] = usePersistedState<string>(`${TASK_STORAGE_KEY}-input`, '0,0');
  const [averageInput, setAverageInput] = useState<string>('0,00');
  const [liveTaskInfo, setLiveTaskInfo] = useState<{ rawCount: number; weightedCount: number; suspendedCount: number; eligibleUsers: number; averageTasksPerEmployee: number } | null>(null);

  // Filter state - promotions view shows all active collaborators by default (persisted)
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = usePersistedState(FILTERS_STORAGE_KEY, {
    sectorIds: [] as string[],
    positionIds: [] as string[],
    includeUserIds: [] as string[],
    excludeUserIds: [] as string[],
    showOnlyEligible: false
  });

  // Sorting state (persisted)
  const [sortColumn, setSortColumn] = usePersistedState<SortColumn>(`${SORT_STORAGE_KEY}-column`, 'name');
  const [sortDirection, setSortDirection] = usePersistedState<'asc' | 'desc'>(`${SORT_STORAGE_KEY}-direction`, 'asc');

  // Per-row Cargo/Performance edits (persisted). Read via ref in the init
  // effect so applying them doesn't make every edit rebuild the whole table.
  const [rowOverrides, setRowOverrides] = usePersistedState<Record<string, RowOverride>>(OVERRIDES_STORAGE_KEY, {});
  const rowOverridesRef = useRef(rowOverrides);
  rowOverridesRef.current = rowOverrides;

  // Column visibility (persisted to localStorage)
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(COLUMN_STORAGE_KEY, DEFAULT_VISIBLE_COLUMNS);

  // Current payroll period (26th-25th cycle) for bonus context
  const { year: periodYear, month: periodMonth } = getCurrentPayrollPeriod();
  const currentPeriod = getBonusPeriod(periodYear, periodMonth);

  // Saved period reajuste (display badge only — the calc reads the same source server-side)
  const { data: periodAdjustmentData } = usePeriodAdjustment(periodYear, periodMonth);
  const adjustmentPercent = periodAdjustmentData?.adjustment ?? 0;

  // Sectors for filtering
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, limit: 100 });

  // All positions (with remunerations) — the destination-cargo options
  const { data: positionsData } = usePositions({
    include: { remunerations: true },
    orderBy: { name: "asc" },
    limit: 100
  });

  // Map positionId -> { name, remuneration, bonifiable, hierarchy } for fast lookups
  const positionById = useMemo(() => {
    const map = new Map<string, { name: string; remuneration: number; bonifiable: boolean; hierarchy: number | null }>();
    for (const pos of positionsData?.data || []) {
      map.set(pos.id, {
        name: pos.name,
        remuneration: getPositionRemuneration(pos as any),
        bonifiable: (pos as any).bonifiable === true,
        hierarchy: (pos as any).hierarchy ?? null,
      });
    }
    return map;
  }, [positionsData]);

  // Cargo dropdown options, sorted by hierarchy (nulls last), then name.
  const positionOptions = useMemo(() => {
    const items = (positionsData?.data || []).map(pos => ({
      value: pos.id,
      label: pos.name,
      hierarchy: (pos as any).hierarchy ?? null as number | null,
    }));
    items.sort((a, b) => {
      const ah = a.hierarchy ?? Number.POSITIVE_INFINITY;
      const bh = b.hierarchy ?? Number.POSITIVE_INFINITY;
      if (ah !== bh) return ah - bh;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
    return items.map(({ value, label }) => ({ value, label }));
  }, [positionsData]);

  // Fetch weighted task count so the bonus reflects the real current period
  useEffect(() => {
    const fetchWeightedTaskCount = async () => {
      try {
        const response = await bonusService.getPeriodTaskStats(periodYear, periodMonth);
        const liveData = (response.data as any)?.data ?? response.data;
        const weightedCount = Number(liveData.totalWeightedTasks) || 0;
        const rawCount = Number(liveData.totalRawTaskCount) || 0;
        const suspendedCount = Number(liveData.totalSuspendedTasks) || 0;
        const eligibleUsers = Number(liveData.eligibleUsers) || 0;
        const averageTasksPerEmployee = Number(liveData.averageTasksPerEmployee) || 0;
        setLiveTaskInfo({ rawCount, weightedCount, suspendedCount, eligibleUsers, averageTasksPerEmployee });
        if (weightedCount > 0) {
          // originalTaskQuantity is always the fetched period value (baseline
          // for "Restaurar" + the modified indicator).
          setOriginalTaskQuantity(weightedCount);
          // Only seed the working quantity when the user has no persisted
          // override (still at the initial 0) — otherwise keep their value.
          if (taskQuantity === 0) {
            setTaskQuantity(weightedCount);
            setTaskInput(weightedCount.toFixed(1).replace('.', ','));
          }
        }
      } catch (err) {
        console.error('[PromotionsSimulation] Failed to fetch weighted task count:', err);
      }
    };
    fetchWeightedTaskCount();
  }, [periodYear, periodMonth]);

  // Fetch active CLT collaborators with position (+ remunerations) and sector
  const { data: usersData } = useUsers({
    where: {
      currentEmployeeType: EMPLOYEE_TYPE.CLT,
      currentContractStatus: CONTRACT_STATUS.ACTIVE,
      secullumEmployeeId: { not: null },
    },
    include: {
      position: { include: { remunerations: true } },
      sector: true
    },
    orderBy: { name: "asc" },
    limit: 100
  });

  // Initialize simulated users from fetched data
  useEffect(() => {
    if (usersData?.data) {
      if (usersData.data.length > 0) {
        const users = usersData.data.map(user => {
          const positionName = user.position?.name || "Sem cargo";
          const remuneration = getPositionRemuneration(user.position as any);
          const performanceLevel = user.performanceLevel ?? 0;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            payrollNumber: user.payrollNumber || null,
            sectorId: user.sector?.id || null,
            sectorName: user.sector?.name || null,
            originalPositionId: user.positionId || null,
            originalPositionName: positionName,
            originalRemuneration: remuneration,
            originalPerformanceLevel: performanceLevel,
            originalBonifiable: (user.position as any)?.bonifiable === true,
            positionId: user.positionId || null,
            positionName,
            performanceLevel,
            expectedRemuneration: remuneration,
            bonusAtual: 0,
            bonusPrevisto: 0,
          } as SimulatedUser;
        });

        // Re-apply persisted per-row edits. Position overrides need the target
        // position (name + remuneration) — skipped until positionById is ready,
        // then re-applied when this effect re-runs on positionById change.
        const overrides = rowOverridesRef.current;
        const withOverrides = users.map(u => {
          const o = overrides[u.id];
          if (!o) return u;
          let next = u;
          if (o.positionId) {
            const target = positionById.get(o.positionId);
            if (target) next = { ...next, positionId: o.positionId, positionName: target.name, expectedRemuneration: target.remuneration };
          }
          if (o.performanceLevel !== undefined) next = { ...next, performanceLevel: o.performanceLevel };
          return next;
        });
        setSimulatedUsers(withOverrides);
      }
      setIsLoading(false);
    }
  }, [usersData, positionById]);

  // Apply filters to get visible users
  const filteredUsers = useMemo(() => {
    let filtered = simulatedUsers;

    if (filters.showOnlyEligible) {
      filtered = filtered.filter(user => {
        const isBonifiable = user.positionId ? positionById.get(user.positionId)?.bonifiable === true : false;
        return isBonifiable && user.performanceLevel > 0;
      });
    }

    if (filters.sectorIds.length > 0) {
      filtered = filtered.filter(user => user.sectorId && filters.sectorIds.includes(user.sectorId));
    }

    if (filters.positionIds.length > 0) {
      filtered = filtered.filter(user =>
        user.originalPositionId && filters.positionIds.includes(user.originalPositionId)
      );
    }

    if (filters.includeUserIds.length > 0) {
      filtered = filtered.filter(user => filters.includeUserIds.includes(user.id));
    }

    if (filters.excludeUserIds.length > 0) {
      filtered = filtered.filter(user => !filters.excludeUserIds.includes(user.id));
    }

    return filtered;
  }, [simulatedUsers, filters, positionById]);

  // Apply sorting
  const sortedUsers = useMemo(() => {
    if (!sortColumn) return filteredUsers;

    const sorted = [...filteredUsers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'payrollNumber': aValue = a.payrollNumber ?? -1; bValue = b.payrollNumber ?? -1; break;
        case 'name': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'sectorName': aValue = (a.sectorName || '').toLowerCase(); bValue = (b.sectorName || '').toLowerCase(); break;
        case 'positionName': aValue = a.positionName.toLowerCase(); bValue = b.positionName.toLowerCase(); break;
        case 'performanceLevel': aValue = a.performanceLevel; bValue = b.performanceLevel; break;
        case 'currentRemuneration': aValue = a.originalRemuneration; bValue = b.originalRemuneration; break;
        case 'expectedRemuneration': aValue = a.expectedRemuneration; bValue = b.expectedRemuneration; break;
        case 'remunerationDiff': aValue = a.expectedRemuneration - a.originalRemuneration; bValue = b.expectedRemuneration - b.originalRemuneration; break;
        case 'bonusAtual': aValue = a.bonusAtual; bValue = b.bonusAtual; break;
        case 'bonusPrevisto': aValue = a.bonusPrevisto; bValue = b.bonusPrevisto; break;
        case 'bonusDiff': aValue = a.bonusPrevisto - a.bonusAtual; bValue = b.bonusPrevisto - b.bonusAtual; break;
        default: return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return a.id.localeCompare(b.id);
    });

    return sorted;
  }, [filteredUsers, sortColumn, sortDirection]);

  // ─────────────────────────────────────────────────────────────
  // Average tasks per user — divisor is the BONUS-ELIGIBLE count
  // (bonifiable position + performance > 0), NOT every displayed
  // collaborator. Promotions lists non-bonifiable users too, and
  // they must not dilute the per-user average.
  // ─────────────────────────────────────────────────────────────
  const hasManualFilters =
    filters.sectorIds.length > 0 ||
    filters.positionIds.length > 0 ||
    filters.includeUserIds.length > 0 ||
    filters.excludeUserIds.length > 0;

  const eligibleFilteredCount = useMemo(
    () => filteredUsers.filter(u => u.originalBonifiable && u.performanceLevel > 0).length,
    [filteredUsers]
  );

  // Prefer the backend eligible count (accurate, all users) when no manual
  // filters are active; otherwise use the eligible subset of filtered users.
  const eligibleUserCount = !hasManualFilters && liveTaskInfo?.eligibleUsers
    ? liveTaskInfo.eligibleUsers
    : eligibleFilteredCount;

  const averageTasksPerUser = useMemo(() => {
    if (eligibleUserCount === 0) return 0;
    return taskQuantity / eligibleUserCount;
  }, [taskQuantity, eligibleUserCount]);

  // Keep the "Média" display in sync unless the user is actively typing it
  useEffect(() => {
    if (eligibleUserCount === 0) {
      if (averageInput !== '0,00') setAverageInput('0,00');
      return;
    }
    const newAverage = taskQuantity / eligibleUserCount;
    const currentParsed = parseFloat(averageInput.replace(',', '.'));
    if (isNaN(currentParsed) || Math.abs(currentParsed - newAverage) > 0.001) {
      setAverageInput(newAverage.toFixed(2).replace('.', ','));
    }
  }, [taskQuantity, eligibleUserCount, averageInput]);

  // ─────────────────────────────────────────────────────────────
  // Bonus is computed server-side by /bonus/simulate. We run it
  // twice: once with the CURRENT positions (bonus atual) and once
  // with the SIMULATED positions (bonus previsto). Performance level
  // is fixed at each collaborator's current level.
  // ─────────────────────────────────────────────────────────────
  const baselineInput = useMemo(
    () =>
      simulatedUsers.length === 0
        ? null
        : {
            averageTasksPerUser,
            users: simulatedUsers.map(u => ({
              id: u.id,
              name: u.name,
              positionId: u.originalPositionId ?? undefined,
              positionName: u.originalPositionName,
              sectorName: u.sectorName ?? undefined,
              performanceLevel: u.originalPerformanceLevel,
            })),
            year: periodYear,
            month: periodMonth,
          },
    [simulatedUsers, averageTasksPerUser, periodYear, periodMonth],
  );

  const simulatedInput = useMemo(
    () =>
      simulatedUsers.length === 0
        ? null
        : {
            averageTasksPerUser,
            users: simulatedUsers.map(u => ({
              id: u.id,
              name: u.name,
              positionId: u.positionId ?? undefined,
              positionName: u.positionName,
              sectorName: u.sectorName ?? undefined,
              performanceLevel: u.performanceLevel,
            })),
            year: periodYear,
            month: periodMonth,
          },
    [simulatedUsers, averageTasksPerUser, periodYear, periodMonth],
  );

  const { data: baselineSim } = useBonusSimulation(baselineInput, { enabled: baselineInput !== null });
  const { data: simulatedSim } = useBonusSimulation(simulatedInput, { enabled: simulatedInput !== null });

  const bonusAtualByUserId = useMemo(() => {
    const map = new Map<string, number>();
    if (baselineSim?.users) for (const u of baselineSim.users) if (u.id) map.set(u.id, u.bonus);
    return map;
  }, [baselineSim]);

  const bonusPrevistoByUserId = useMemo(() => {
    const map = new Map<string, number>();
    if (simulatedSim?.users) for (const u of simulatedSim.users) if (u.id) map.set(u.id, u.bonus);
    return map;
  }, [simulatedSim]);

  // Sync both bonus values back into rows
  useEffect(() => {
    if (!baselineSim?.users && !simulatedSim?.users) return;
    setSimulatedUsers(prev => {
      const next = prev.map(u => {
        const atual = bonusAtualByUserId.get(u.id) ?? u.bonusAtual;
        const previsto = bonusPrevistoByUserId.get(u.id) ?? u.bonusPrevisto;
        if (Math.abs(u.bonusAtual - atual) < 0.005 && Math.abs(u.bonusPrevisto - previsto) < 0.005) return u;
        return { ...u, bonusAtual: atual, bonusPrevisto: previsto };
      });
      const changed = next.some((u, i) => u !== prev[i]);
      return changed ? next : prev;
    });
  }, [baselineSim, simulatedSim, bonusAtualByUserId, bonusPrevistoByUserId]);

  // Totals
  const totalCurrentRemuneration = useMemo(() => sortedUsers.reduce((s, u) => s + u.originalRemuneration, 0), [sortedUsers]);
  const totalExpectedRemuneration = useMemo(() => sortedUsers.reduce((s, u) => s + u.expectedRemuneration, 0), [sortedUsers]);
  const totalRemunerationDelta = totalExpectedRemuneration - totalCurrentRemuneration;
  const totalBonusAtual = useMemo(() => sortedUsers.reduce((s, u) => s + u.bonusAtual, 0), [sortedUsers]);
  const totalBonusPrevisto = useMemo(() => sortedUsers.reduce((s, u) => s + u.bonusPrevisto, 0), [sortedUsers]);

  // Handlers
  const handleTaskQuantityChange = (raw: string) => {
    let value = raw.replace('.', ',');
    if (value === '' || value === ',' || /^\d*,?\d*$/.test(value)) {
      setTaskInput(value);
      if (value !== '' && value !== ',') {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num) && num >= 0) setTaskQuantity(num);
      } else if (value === '') {
        setTaskQuantity(0);
      }
    }
  };

  const handleAveragePerUserChange = (raw: string) => {
    let value = raw.replace('.', ',');
    if (value === '' || value === ',' || /^\d*,?\d*$/.test(value)) {
      setAverageInput(value);
      if (value !== '' && value !== ',' && eligibleUserCount > 0) {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num) && num >= 0) {
          const newTaskQuantity = num * eligibleUserCount;
          setTaskQuantity(newTaskQuantity);
          setTaskInput(newTaskQuantity.toFixed(1).replace('.', ','));
        }
      } else if (value === '') {
        setTaskQuantity(0);
        setTaskInput('0');
      }
    }
  };

  const restoreCurrentPeriodTasks = () => {
    setTaskQuantity(originalTaskQuantity);
    setTaskInput(originalTaskQuantity.toFixed(1).replace('.', ','));
    if (eligibleUserCount > 0) {
      setAverageInput((originalTaskQuantity / eligibleUserCount).toFixed(2).replace('.', ','));
    }
  };
  const isTaskQuantityModified = taskQuantity !== originalTaskQuantity && originalTaskQuantity > 0;

  const handleFiltersApply = (newFilters: typeof filters) => setFilters(newFilters);
  const handleFiltersReset = () => setFilters({
    sectorIds: [], positionIds: [], includeUserIds: [], excludeUserIds: [], showOnlyEligible: false
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <IconSelector className="h-4 w-4 opacity-50" />;
    return sortDirection === 'asc'
      ? <IconArrowUp className="h-4 w-4" />
      : <IconArrowDown className="h-4 w-4" />;
  };

  // Changing the cargo updates the position + expected remuneration. Bonus
  // previsto is recomputed by /bonus/simulate (salary resolved from position).
  const handlePositionChange = (userId: string, newPositionId: string) => {
    const target = positionById.get(newPositionId);
    if (!target) return;
    setSimulatedUsers(prev =>
      prev.map(user => (user.id === userId
        ? { ...user, positionId: newPositionId, positionName: target.name, expectedRemuneration: target.remuneration }
        : user)),
    );
    setRowOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], positionId: newPositionId } }));
  };

  // Performance level only feeds the simulated bonus (never base remuneration).
  // Changing it re-runs /bonus/simulate for "Bônus Previsto".
  const handlePerformanceLevelChange = (userId: string, newLevel: number) => {
    setSimulatedUsers(prev =>
      prev.map(user => (user.id === userId ? { ...user, performanceLevel: newLevel } : user)),
    );
    setRowOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], performanceLevel: newLevel } }));
  };

  const hasActiveFilters = hasManualFilters || filters.showOnlyEligible;

  const clearAllFilters = () => setFilters({
    sectorIds: [], positionIds: [], includeUserIds: [], excludeUserIds: [], showOnlyEligible: false
  });

  // Filter badges
  const activeFilters = useMemo(() => {
    const filterBadges: Array<{
      key: string; label: string; value: string; onRemove: () => void; icon?: React.ReactNode;
    }> = [];

    filters.sectorIds.forEach(sectorId => {
      const sector = sectorsData?.data?.find(s => s.id === sectorId);
      if (sector) {
        filterBadges.push({
          key: `sector-${sectorId}`, label: "Setor", value: sector.name,
          onRemove: () => setFilters(prev => ({ ...prev, sectorIds: prev.sectorIds.filter(id => id !== sectorId) })),
          icon: <IconBuilding className="h-3 w-3" />
        });
      }
    });

    filters.positionIds.forEach(positionId => {
      const position = positionById.get(positionId);
      if (position) {
        filterBadges.push({
          key: `position-${positionId}`, label: "Cargo", value: position.name,
          onRemove: () => setFilters(prev => ({ ...prev, positionIds: prev.positionIds.filter(id => id !== positionId) })),
          icon: <IconBriefcase className="h-3 w-3" />
        });
      }
    });

    filters.includeUserIds.forEach(userId => {
      const user = simulatedUsers.find(u => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `include-${userId}`, label: "Incluir Usuário", value: user.name,
          onRemove: () => setFilters(prev => ({ ...prev, includeUserIds: prev.includeUserIds.filter(id => id !== userId) })),
          icon: <IconUserCheck className="h-3 w-3" />
        });
      }
    });

    filters.excludeUserIds.forEach(userId => {
      const user = simulatedUsers.find(u => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `exclude-${userId}`, label: "Excluir Usuário", value: user.name,
          onRemove: () => setFilters(prev => ({ ...prev, excludeUserIds: prev.excludeUserIds.filter(id => id !== userId) })),
          icon: <IconUserMinus className="h-3 w-3" />
        });
      }
    });

    if (filters.showOnlyEligible) {
      filterBadges.push({
        key: 'only-eligible', label: "Exibir", value: "Apenas elegíveis a bônus",
        onRemove: () => setFilters(prev => ({ ...prev, showOnlyEligible: false })),
        icon: <IconUsers className="h-3 w-3" />
      });
    }

    return filterBadges;
  }, [filters, sectorsData?.data, simulatedUsers, positionById]);

  // Export handlers
  const handleExport = async (format: ExportFormat, users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    switch (format) {
      case "csv": await exportToCSV(users, columns); break;
      case "excel": await exportToExcel(users, columns); break;
      case "pdf": await exportToPDF(users, columns); break;
    }
    toast.success(`Exportação ${format.toUpperCase()} concluída com sucesso!`);
  };

  const totalRowValue = (colId: string): string => {
    if (colId === "name") return "TOTAL";
    if (colId === "currentRemuneration") return formatCurrency(totalCurrentRemuneration);
    if (colId === "expectedRemuneration") return formatCurrency(totalExpectedRemuneration);
    if (colId === "remunerationDiff") return formatSignedCurrency(totalRemunerationDelta);
    if (colId === "bonusAtual") return formatCurrency(totalBonusAtual);
    if (colId === "bonusPrevisto") return formatCurrency(totalBonusPrevisto);
    return "";
  };

  const exportToCSV = async (users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    const headers = columns.map((col) => col.label);
    const rows = users.map((user) => columns.map((col) => col.getValue(user)));
    rows.push(columns.map((col) => totalRowValue(col.id)));
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `simulacao-promocoes-${formatDate(new Date()).replace(/\//g, "-")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    const headers = columns.map((col) => col.label);
    const rows = users.map((user) => columns.map((col) => col.getValue(user)));
    rows.push(columns.map((col) => totalRowValue(col.id)));
    const excelContent = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
    const blob = new Blob(["﻿" + excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `simulacao-promocoes-${formatDate(new Date()).replace(/\//g, "-")}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (users: SimulatedUser[], columns: ExportColumn<SimulatedUser>[]) => {
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Simulação de Promoções - ${formatDate(new Date())}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: white; font-size: 11px; line-height: 1.2; }
          body { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; }
          .header { margin-bottom: 12px; }
          .logo { width: 140px; height: auto; margin-bottom: 8px; }
          .header-title { font-size: 18px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
          .info { color: #6b7280; font-size: 10px; }
          .info p { margin: 1px 0; }
          .content-wrapper { flex: 1; overflow: auto; min-height: 0; padding-bottom: 35px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background-color: #f9fafb; font-weight: 600; color: #374151; padding: 8px 6px; border: 1px solid #e5e7eb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
          td { padding: 6px; border: 1px solid #e5e7eb; vertical-align: middle; white-space: nowrap; }
          tbody tr:nth-child(even) { background-color: #fafafa; }
          tbody tr:last-child { font-weight: 700; background-color: #f0fdf4; }
          .footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 9px; background: white; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <h1 class="header-title">Simulação de Promoções</h1>
          <div class="info">
            <p><strong>Data:</strong> ${formatDate(new Date())}</p>
            <p><strong>Total de colaboradores:</strong> ${users.length}</p>
            <p><strong>Remuneração atual:</strong> ${formatCurrency(totalCurrentRemuneration)} &nbsp;→&nbsp; <strong>prevista:</strong> ${formatCurrency(totalExpectedRemuneration)} (${formatSignedCurrency(totalRemunerationDelta)})</p>
            <p><strong>Bônus atual:</strong> ${formatCurrency(totalBonusAtual)} &nbsp;→&nbsp; <strong>previsto:</strong> ${formatCurrency(totalBonusPrevisto)}</p>
          </div>
        </div>
        <div class="content-wrapper">
          <table>
            <thead>
              <tr>${columns.map((col) => `<th class="text-left">${col.label}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${users.map((user) => `
                <tr>${columns.map((col) => `<td>${col.getValue(user)}</td>`).join("")}</tr>
              `).join("")}
              <tr>${columns.map((col) => `<td>${totalRowValue(col.id)}</td>`).join("")}</tr>
            </tbody>
          </table>
        </div>
        <div class="footer">
          <div><p>Simulação de Promoções - Sistema Ankaa</p></div>
          <div><p><strong>Gerado em:</strong> ${formatDate(new Date())} ${new Date().toLocaleTimeString('pt-BR')}</p></div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      };
    }
  };

  // Column definitions drive both the header and body render, and column
  // visibility. `px` is the fixed width; the flexible NOME column omits it.
  const columnDefs: Array<{
    key: string;
    label: string;
    align: 'left' | 'center' | 'right';
    px?: number;
    sortColumn: SortColumn;
    cell: (user: SimulatedUser) => React.ReactNode;
  }> = [
    {
      key: 'payrollNumber', label: 'Nº Folha', align: 'left', px: 96, sortColumn: 'payrollNumber',
      cell: (u) => <div className="px-4 py-2 text-sm text-muted-foreground font-medium truncate">{u.payrollNumber || '-'}</div>,
    },
    {
      key: 'name', label: 'Nome', align: 'left', sortColumn: 'name',
      cell: (u) => <div className="px-4 py-2 font-medium truncate">{u.name}</div>,
    },
    {
      key: 'sectorName', label: 'Setor', align: 'left', px: 150, sortColumn: 'sectorName',
      cell: (u) => <div className="px-4 py-2 text-sm text-muted-foreground truncate">{u.sectorName || '-'}</div>,
    },
    {
      key: 'positionName', label: 'Cargo', align: 'left', px: 300, sortColumn: 'positionName',
      cell: (u) => {
        const positionChanged = u.positionId !== u.originalPositionId;
        return (
          <div className="px-3 py-1">
            <Combobox
              mode="single"
              value={u.positionId ?? undefined}
              onValueChange={(value) => { if (value && typeof value === 'string') handlePositionChange(u.id, value); }}
              options={positionOptions}
              placeholder="Selecione o cargo"
              emptyText="Nenhum cargo encontrado"
              searchable={true}
              className={cn("w-full", positionChanged && "ring-1 ring-orange-500/50 rounded-md")}
              renderValue={() => (
                <span className={cn("truncate", positionChanged && "text-orange-600 font-medium")}>{u.positionName}</span>
              )}
            />
          </div>
        );
      },
    },
    {
      key: 'performanceLevel', label: 'Performance', align: 'center', px: 160, sortColumn: 'performanceLevel',
      cell: (u) => (
        <div className="px-3 py-1 flex items-center justify-center">
          <PerformanceLevelSelector
            value={u.performanceLevel}
            onChange={(newLevel) => handlePerformanceLevelChange(u.id, newLevel)}
            isModified={u.performanceLevel !== u.originalPerformanceLevel}
          />
        </div>
      ),
    },
    {
      key: 'currentRemuneration', label: 'Remun. Atual', align: 'right', px: 130, sortColumn: 'currentRemuneration',
      cell: (u) => <div className="px-4 py-2 text-right text-sm text-muted-foreground">{formatCurrency(u.originalRemuneration)}</div>,
    },
    {
      key: 'expectedRemuneration', label: 'Remun. Prevista', align: 'right', px: 140, sortColumn: 'expectedRemuneration',
      cell: (u) => {
        const changed = u.positionId !== u.originalPositionId;
        return <div className={cn("px-4 py-2 text-right font-semibold", changed ? "text-orange-600" : "text-foreground")}>{formatCurrency(u.expectedRemuneration)}</div>;
      },
    },
    {
      key: 'remunerationDiff', label: 'Dif. Remun.', align: 'right', px: 130, sortColumn: 'remunerationDiff',
      cell: (u) => <DeltaCell value={u.expectedRemuneration - u.originalRemuneration} />,
    },
    {
      key: 'bonusAtual', label: 'Bônus Atual', align: 'right', px: 120, sortColumn: 'bonusAtual',
      cell: (u) => <div className="px-4 py-2 text-right text-sm text-muted-foreground">{formatCurrency(u.bonusAtual)}</div>,
    },
    {
      key: 'bonusPrevisto', label: 'Bônus Previsto', align: 'right', px: 140, sortColumn: 'bonusPrevisto',
      cell: (u) => <div className={cn("px-4 py-2 text-right font-bold", u.bonusPrevisto > 0 ? 'text-green-600' : 'text-muted-foreground')}>{formatCurrency(u.bonusPrevisto)}</div>,
    },
    {
      key: 'bonusDiff', label: 'Dif. Bônus', align: 'right', px: 130, sortColumn: 'bonusDiff',
      cell: (u) => <DeltaCell value={u.bonusPrevisto - u.bonusAtual} zeroThreshold={0.005} />,
    },
  ];

  const visibleColumnDefs = columnDefs.filter(c => visibleColumns.has(c.key));
  const NAME_FLEX_MIN = 220;
  const tableMinWidth = visibleColumnDefs.reduce((sum, c) => sum + (c.px ?? NAME_FLEX_MIN), 0);

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      {/* Header with task controls, summary and actions */}
      <div className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Left side - Task controls + totals */}
          <div className="flex flex-row flex-wrap gap-4">
            <div className="flex flex-col" style={{ width: '7rem' }}>
              <Label htmlFor="taskQuantity" className="text-sm font-medium mb-1.5">Tarefas</Label>
              <Input
                id="taskQuantity"
                type="text"
                inputMode="decimal"
                value={taskInput}
                onChange={(value) => handleTaskQuantityChange(String(value))}
                className="h-10 text-center font-semibold bg-transparent"
                placeholder="0,0"
              />
            </div>

            <div className="flex flex-col" style={{ width: '7rem' }}>
              <Label className="text-sm font-medium mb-1.5">Elegíveis</Label>
              <Input
                type="text"
                value={eligibleUserCount}
                readOnly
                className="h-10 text-center font-semibold bg-transparent cursor-default"
                title="Colaboradores elegíveis a bônus (base do cálculo da média — exclui não bonificáveis)"
              />
            </div>

            <div className="flex flex-col" style={{ width: '7rem' }}>
              <Label htmlFor="averagePerUser" className="text-sm font-medium mb-1.5">Média</Label>
              <Input
                id="averagePerUser"
                type="text"
                inputMode="decimal"
                value={averageInput}
                onChange={(value) => handleAveragePerUserChange(String(value))}
                className="h-10 text-center font-semibold bg-transparent"
                placeholder="0,00"
                title="Média de tarefas por colaborador elegível"
              />
            </div>

            <div className="flex flex-col" style={{ width: '9rem' }}>
              <Label className="text-sm font-medium mb-1.5">Remun. Atual</Label>
              <Input type="text" value={formatCurrency(totalCurrentRemuneration)} readOnly className="h-10 text-center font-semibold bg-transparent cursor-default" />
            </div>

            <div className="flex flex-col" style={{ width: '9rem' }}>
              <Label className="text-sm font-medium mb-1.5">Remun. Prevista</Label>
              <Input
                type="text"
                value={formatCurrency(totalExpectedRemuneration)}
                readOnly
                className={cn(
                  "h-10 text-center font-semibold bg-transparent cursor-default",
                  totalRemunerationDelta > 0 ? "text-green-600" : totalRemunerationDelta < 0 ? "text-red-600" : ""
                )}
                title={`Diferença: ${formatSignedCurrency(totalRemunerationDelta)}`}
              />
            </div>

            <div className="flex flex-col" style={{ width: '9rem' }}>
              <Label className="text-sm font-medium mb-1.5">Bônus Atual</Label>
              <Input type="text" value={formatCurrency(totalBonusAtual)} readOnly className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600" />
            </div>

            <div className="flex flex-col" style={{ width: '9rem' }}>
              <Label className="text-sm font-medium mb-1.5">Bônus Previsto</Label>
              <Input type="text" value={formatCurrency(totalBonusPrevisto)} readOnly className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600" />
            </div>
          </div>

          {/* Right side - Action Buttons */}
          <div className="flex flex-col">
            <Label className="text-sm font-medium mb-1.5 opacity-0">Ações</Label>
            <div className="flex gap-2 h-10">
              {isTaskQuantityModified && (
                <Button type="button" variant="outline" size="default" onClick={restoreCurrentPeriodTasks} className="h-10" title="Restaurar quantidade de tarefas do período atual">
                  <IconCalculator className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
              )}
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                onClick={() => setShowFiltersModal(true)}
                className="h-10 gap-2"
              >
                <IconFilter className="h-4 w-4" />
                Filtrar
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 bg-background/20 text-white">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
              <GenericColumnVisibilityManager
                columns={columnDefs.map(c => ({ key: c.key, header: c.label, defaultVisible: true }))}
                visibleColumns={visibleColumns}
                onVisibilityChange={setVisibleColumns}
                storageKey={COLUMN_STORAGE_KEY}
                getDefaultVisibleColumns={() => DEFAULT_VISIBLE_COLUMNS}
              />
              <BaseExportPopover<SimulatedUser>
                className="h-10"
                currentItems={sortedUsers}
                totalRecords={sortedUsers.length}
                visibleColumns={visibleColumns}
                exportColumns={EXPORT_COLUMNS}
                defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
                onExport={handleExport}
                entityName="colaborador"
                entityNamePlural="colaboradores"
              />
            </div>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />
        )}

        {/* Current Period Info (bonus context) */}
        {liveTaskInfo && liveTaskInfo.weightedCount > 0 && (
          <div className="mt-4 p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg border border-blue-500/30">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <IconArrowUpRight className="h-4 w-4" />
              <span className="font-medium">
                O bônus reflete o período atual ({currentPeriod.startDate.toLocaleDateString('pt-BR')} a {currentPeriod.endDate.toLocaleDateString('pt-BR')})
              </span>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">
                {liveTaskInfo.weightedCount.toFixed(1)} tarefas ponderadas
              </Badge>
              {adjustmentPercent !== 0 && (
                <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">
                  Reajuste: {adjustmentPercent > 0 ? '+' : ''}{adjustmentPercent}%
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Table */}
      <div className="flex-1 min-h-0 p-4 pt-0">
        <div className="h-full flex flex-col overflow-hidden rounded-lg border border-border">
          {isLoading ? (
            <div className="p-4">
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : simulatedUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum colaborador encontrado
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <IconFilter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">Nenhum colaborador encontrado</p>
              <p className="text-sm">Ajuste os filtros para ver os colaboradores.</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <Table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
                <TableHeader className="sticky top-0 z-10 [&_tr]:border-b-0">
                  <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                    {visibleColumnDefs.map(col => (
                      <TableHead
                        key={col.key}
                        style={col.px ? { width: col.px } : undefined}
                        className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted p-0 !border-r-0"
                      >
                        <button
                          onClick={() => handleSort(col.sortColumn)}
                          className={cn(
                            "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
                            col.align === 'right' && "justify-end",
                            col.align === 'center' && "justify-center",
                            col.align === 'left' && "text-left"
                          )}
                        >
                          <span className="truncate">{col.label}</span>{getSortIcon(col.sortColumn)}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "transition-colors border-b border-border h-10",
                        index % 2 === 1 && "bg-muted/10",
                        "hover:bg-muted/20"
                      )}
                    >
                      {visibleColumnDefs.map(col => (
                        <TableCell key={col.key} style={col.px ? { width: col.px } : undefined} className="p-0">
                          {col.cell(user)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Filters Modal */}
      <PromotionsSimulationFilters
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        filters={filters}
        onApply={handleFiltersApply}
        onReset={handleFiltersReset}
        sectors={sectorsData?.data || []}
      />
    </Card>
  );
}
