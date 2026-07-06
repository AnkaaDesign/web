import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconUsers, IconCalculator, IconFilter, IconBuilding, IconUserMinus, IconBriefcase, IconUserCheck } from "@tabler/icons-react";
import { formatCurrency, getCurrentPayrollPeriod } from "../../../utils";
import { useUsers, useSectors, usePositions } from "../../../hooks";
import { bonusService } from "../../../api-client";
import { useBonusSimulation } from "../../../hooks/personnel-department/use-bonus";
import { cn } from "@/lib/utils";
import { CONTRACT_STATUS, EMPLOYEE_TYPE } from "../../../constants";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { usePersistedState } from "@/hooks/common/use-persisted-state";
import { DataTable } from "@/components/ui/datatable";
import { PromotionsSimulationFilters } from "./promotions-simulation-filters";
import {
  createPromotionsSimulationColumns,
  getPositionRemuneration,
  formatSignedCurrency,
  type SimulatedUser,
  type RowOverride,
} from "./promotions-simulation-columns";

// localStorage keys — persist filters/task config/row edits so the user returns to
// exactly where they left off after navigating away. (Column layout + sort are
// persisted server-side by the DataTable via its `tableId`.)
const FILTERS_STORAGE_KEY = "promotions-simulation-filters";
const TASK_STORAGE_KEY = "promotions-simulation-task";
const OVERRIDES_STORAGE_KEY = "promotions-simulation-row-overrides";

interface PromotionsSimulationInteractiveTableProps {
  className?: string;
}

export function PromotionsSimulationInteractiveTable({ className }: PromotionsSimulationInteractiveTableProps) {
  const [simulatedUsers, setSimulatedUsers] = useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Task-count controls (mirrors the bonus simulation) — quantity/input persisted
  const [taskQuantity, setTaskQuantity] = usePersistedState<number>(`${TASK_STORAGE_KEY}-quantity`, 0);
  const [originalTaskQuantity, setOriginalTaskQuantity] = useState<number>(0);
  const [taskInput, setTaskInput] = usePersistedState<string>(`${TASK_STORAGE_KEY}-input`, "0,0");
  const [averageInput, setAverageInput] = useState<string>("0,00");
  const [liveTaskInfo, setLiveTaskInfo] = useState<{ rawCount: number; weightedCount: number; suspendedCount: number; eligibleUsers: number; averageTasksPerEmployee: number } | null>(null);

  // Filter state - promotions view shows all active collaborators by default (persisted)
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = usePersistedState(FILTERS_STORAGE_KEY, {
    sectorIds: [] as string[],
    positionIds: [] as string[],
    includeUserIds: [] as string[],
    excludeUserIds: [] as string[],
    showOnlyEligible: false,
  });

  // Per-row Cargo/Performance edits (persisted). Read via ref in the init
  // effect so applying them doesn't make every edit rebuild the whole table.
  const [rowOverrides, setRowOverrides] = usePersistedState<Record<string, RowOverride>>(OVERRIDES_STORAGE_KEY, {});
  const rowOverridesRef = useRef(rowOverrides);
  rowOverridesRef.current = rowOverrides;

  // Current payroll period (26th-25th cycle) for bonus context
  const { year: periodYear, month: periodMonth } = getCurrentPayrollPeriod();

  // Sectors for filtering
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, limit: 100 });

  // All positions (with remunerations) — the destination-cargo options
  const { data: positionsData } = usePositions({
    include: { remunerations: true },
    orderBy: { name: "asc" },
    limit: 100,
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
    const items = (positionsData?.data || []).map((pos) => ({
      value: pos.id,
      label: pos.name,
      hierarchy: (pos as any).hierarchy ?? (null as number | null),
    }));
    items.sort((a, b) => {
      const ah = a.hierarchy ?? Number.POSITIVE_INFINITY;
      const bh = b.hierarchy ?? Number.POSITIVE_INFINITY;
      if (ah !== bh) return ah - bh;
      return a.label.localeCompare(b.label, "pt-BR");
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
            setTaskInput(weightedCount.toFixed(1).replace(".", ","));
          }
        }
      } catch (err) {
        console.error("[PromotionsSimulation] Failed to fetch weighted task count:", err);
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
      sector: true,
    },
    orderBy: { name: "asc" },
    limit: 100,
  });

  // Initialize simulated users from fetched data
  useEffect(() => {
    if (usersData?.data) {
      if (usersData.data.length > 0) {
        const users = usersData.data.map((user) => {
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
        const withOverrides = users.map((u) => {
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

  // Apply filters to get visible users. Filtering stays at the page level (rather
  // than the DataTable's own filter drawer) because the totals + the bonus
  // average-per-user divisor below are computed over exactly this filtered set.
  const filteredUsers = useMemo(() => {
    let filtered = simulatedUsers;

    if (filters.showOnlyEligible) {
      filtered = filtered.filter((user) => {
        const isBonifiable = user.positionId ? positionById.get(user.positionId)?.bonifiable === true : false;
        return isBonifiable && user.performanceLevel > 0;
      });
    }

    if (filters.sectorIds.length > 0) {
      filtered = filtered.filter((user) => user.sectorId && filters.sectorIds.includes(user.sectorId));
    }

    if (filters.positionIds.length > 0) {
      filtered = filtered.filter((user) => user.originalPositionId && filters.positionIds.includes(user.originalPositionId));
    }

    if (filters.includeUserIds.length > 0) {
      filtered = filtered.filter((user) => filters.includeUserIds.includes(user.id));
    }

    if (filters.excludeUserIds.length > 0) {
      filtered = filtered.filter((user) => !filters.excludeUserIds.includes(user.id));
    }

    return filtered;
  }, [simulatedUsers, filters, positionById]);

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

  const eligibleFilteredCount = useMemo(() => filteredUsers.filter((u) => u.originalBonifiable && u.performanceLevel > 0).length, [filteredUsers]);

  // Prefer the backend eligible count (accurate, all users) when no manual
  // filters are active; otherwise use the eligible subset of filtered users.
  const eligibleUserCount = !hasManualFilters && liveTaskInfo?.eligibleUsers ? liveTaskInfo.eligibleUsers : eligibleFilteredCount;

  const averageTasksPerUser = useMemo(() => {
    if (eligibleUserCount === 0) return 0;
    return taskQuantity / eligibleUserCount;
  }, [taskQuantity, eligibleUserCount]);

  // Keep the "Média" display in sync unless the user is actively typing it
  useEffect(() => {
    if (eligibleUserCount === 0) {
      if (averageInput !== "0,00") setAverageInput("0,00");
      return;
    }
    const newAverage = taskQuantity / eligibleUserCount;
    const currentParsed = parseFloat(averageInput.replace(",", "."));
    if (isNaN(currentParsed) || Math.abs(currentParsed - newAverage) > 0.001) {
      setAverageInput(newAverage.toFixed(2).replace(".", ","));
    }
  }, [taskQuantity, eligibleUserCount, averageInput]);

  // ─────────────────────────────────────────────────────────────
  // Bonus is computed server-side by /bonus/simulate. We run it
  // twice: once with the CURRENT positions (bonus atual) and once
  // with the SIMULATED positions (bonus previsto).
  // ─────────────────────────────────────────────────────────────
  const baselineInput = useMemo(
    () =>
      simulatedUsers.length === 0
        ? null
        : {
            averageTasksPerUser,
            users: simulatedUsers.map((u) => ({
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
            users: simulatedUsers.map((u) => ({
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
    setSimulatedUsers((prev) => {
      const next = prev.map((u) => {
        const atual = bonusAtualByUserId.get(u.id) ?? u.bonusAtual;
        const previsto = bonusPrevistoByUserId.get(u.id) ?? u.bonusPrevisto;
        if (Math.abs(u.bonusAtual - atual) < 0.005 && Math.abs(u.bonusPrevisto - previsto) < 0.005) return u;
        return { ...u, bonusAtual: atual, bonusPrevisto: previsto };
      });
      const changed = next.some((u, i) => u !== prev[i]);
      return changed ? next : prev;
    });
  }, [baselineSim, simulatedSim, bonusAtualByUserId, bonusPrevistoByUserId]);

  // Totals — over the filtered set (matches the rows the DataTable displays).
  const totalCurrentRemuneration = useMemo(() => filteredUsers.reduce((s, u) => s + u.originalRemuneration, 0), [filteredUsers]);
  const totalExpectedRemuneration = useMemo(() => filteredUsers.reduce((s, u) => s + u.expectedRemuneration, 0), [filteredUsers]);
  const totalRemunerationDelta = totalExpectedRemuneration - totalCurrentRemuneration;
  const totalBonusAtual = useMemo(() => filteredUsers.reduce((s, u) => s + u.bonusAtual, 0), [filteredUsers]);
  const totalBonusPrevisto = useMemo(() => filteredUsers.reduce((s, u) => s + u.bonusPrevisto, 0), [filteredUsers]);

  // Handlers
  const handleTaskQuantityChange = (raw: string) => {
    let value = raw.replace(".", ",");
    if (value === "" || value === "," || /^\d*,?\d*$/.test(value)) {
      setTaskInput(value);
      if (value !== "" && value !== ",") {
        const num = parseFloat(value.replace(",", "."));
        if (!isNaN(num) && num >= 0) setTaskQuantity(num);
      } else if (value === "") {
        setTaskQuantity(0);
      }
    }
  };

  const handleAveragePerUserChange = (raw: string) => {
    let value = raw.replace(".", ",");
    if (value === "" || value === "," || /^\d*,?\d*$/.test(value)) {
      setAverageInput(value);
      if (value !== "" && value !== "," && eligibleUserCount > 0) {
        const num = parseFloat(value.replace(",", "."));
        if (!isNaN(num) && num >= 0) {
          const newTaskQuantity = num * eligibleUserCount;
          setTaskQuantity(newTaskQuantity);
          setTaskInput(newTaskQuantity.toFixed(1).replace(".", ","));
        }
      } else if (value === "") {
        setTaskQuantity(0);
        setTaskInput("0");
      }
    }
  };

  const restoreCurrentPeriodTasks = () => {
    setTaskQuantity(originalTaskQuantity);
    setTaskInput(originalTaskQuantity.toFixed(1).replace(".", ","));
    if (eligibleUserCount > 0) {
      setAverageInput((originalTaskQuantity / eligibleUserCount).toFixed(2).replace(".", ","));
    }
  };
  const isTaskQuantityModified = taskQuantity !== originalTaskQuantity && originalTaskQuantity > 0;

  const handleFiltersApply = (newFilters: typeof filters) => setFilters(newFilters);
  const handleFiltersReset = () => setFilters({ sectorIds: [], positionIds: [], includeUserIds: [], excludeUserIds: [], showOnlyEligible: false });

  // Changing the cargo updates the position + expected remuneration. Bonus
  // previsto is recomputed by /bonus/simulate (salary resolved from position).
  const handlePositionChange = useCallback(
    (userId: string, newPositionId: string) => {
      const target = positionById.get(newPositionId);
      if (!target) return;
      setSimulatedUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, positionId: newPositionId, positionName: target.name, expectedRemuneration: target.remuneration } : user)),
      );
      setRowOverrides((prev) => ({ ...prev, [userId]: { ...prev[userId], positionId: newPositionId } }));
    },
    [positionById, setRowOverrides],
  );

  // Performance level only feeds the simulated bonus (never base remuneration).
  // Changing it re-runs /bonus/simulate for "Bônus Previsto".
  const handlePerformanceLevelChange = useCallback(
    (userId: string, newLevel: number) => {
      setSimulatedUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, performanceLevel: newLevel } : user)));
      setRowOverrides((prev) => ({ ...prev, [userId]: { ...prev[userId], performanceLevel: newLevel } }));
    },
    [setRowOverrides],
  );

  const columns = useMemo(
    () => createPromotionsSimulationColumns({ positionOptions, onPositionChange: handlePositionChange, onPerformanceLevelChange: handlePerformanceLevelChange }),
    [positionOptions, handlePositionChange, handlePerformanceLevelChange],
  );

  const hasActiveFilters = hasManualFilters || filters.showOnlyEligible;

  const clearAllFilters = () => setFilters({ sectorIds: [], positionIds: [], includeUserIds: [], excludeUserIds: [], showOnlyEligible: false });

  // Filter badges
  const activeFilters = useMemo(() => {
    const filterBadges: Array<{ key: string; label: string; value: string; onRemove: () => void; icon?: React.ReactNode }> = [];

    filters.sectorIds.forEach((sectorId) => {
      const sector = sectorsData?.data?.find((s) => s.id === sectorId);
      if (sector) {
        filterBadges.push({
          key: `sector-${sectorId}`,
          label: "Setor",
          value: sector.name,
          onRemove: () => setFilters((prev) => ({ ...prev, sectorIds: prev.sectorIds.filter((id) => id !== sectorId) })),
          icon: <IconBuilding className="h-3 w-3" />,
        });
      }
    });

    filters.positionIds.forEach((positionId) => {
      const position = positionById.get(positionId);
      if (position) {
        filterBadges.push({
          key: `position-${positionId}`,
          label: "Cargo",
          value: position.name,
          onRemove: () => setFilters((prev) => ({ ...prev, positionIds: prev.positionIds.filter((id) => id !== positionId) })),
          icon: <IconBriefcase className="h-3 w-3" />,
        });
      }
    });

    filters.includeUserIds.forEach((userId) => {
      const user = simulatedUsers.find((u) => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `include-${userId}`,
          label: "Incluir Usuário",
          value: user.name,
          onRemove: () => setFilters((prev) => ({ ...prev, includeUserIds: prev.includeUserIds.filter((id) => id !== userId) })),
          icon: <IconUserCheck className="h-3 w-3" />,
        });
      }
    });

    filters.excludeUserIds.forEach((userId) => {
      const user = simulatedUsers.find((u) => u.id === userId);
      if (user) {
        filterBadges.push({
          key: `exclude-${userId}`,
          label: "Excluir Usuário",
          value: user.name,
          onRemove: () => setFilters((prev) => ({ ...prev, excludeUserIds: prev.excludeUserIds.filter((id) => id !== userId) })),
          icon: <IconUserMinus className="h-3 w-3" />,
        });
      }
    });

    if (filters.showOnlyEligible) {
      filterBadges.push({
        key: "only-eligible",
        label: "Exibir",
        value: "Apenas elegíveis a bônus",
        onRemove: () => setFilters((prev) => ({ ...prev, showOnlyEligible: false })),
        icon: <IconUsers className="h-3 w-3" />,
      });
    }

    return filterBadges;
  }, [filters, sectorsData?.data, simulatedUsers, positionById]);

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      {/* Header with task controls, summary and filter action */}
      <div className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Left side - Task controls + totals */}
          <div className="flex flex-row flex-wrap gap-4">
            <div className="flex flex-col" style={{ width: "7rem" }}>
              <Label htmlFor="taskQuantity" className="text-sm font-medium mb-1.5">
                Tarefas
              </Label>
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

            <div className="flex flex-col" style={{ width: "7rem" }}>
              <Label className="text-sm font-medium mb-1.5">Elegíveis</Label>
              <Input
                type="text"
                value={eligibleUserCount}
                readOnly
                className="h-10 text-center font-semibold bg-transparent cursor-default"
                title="Colaboradores elegíveis a bônus (base do cálculo da média — exclui não bonificáveis)"
              />
            </div>

            <div className="flex flex-col" style={{ width: "7rem" }}>
              <Label htmlFor="averagePerUser" className="text-sm font-medium mb-1.5">
                Média
              </Label>
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

            <div className="flex flex-col" style={{ width: "9rem" }}>
              <Label className="text-sm font-medium mb-1.5">Remun. Atual</Label>
              <Input type="text" value={formatCurrency(totalCurrentRemuneration)} readOnly className="h-10 text-center font-semibold bg-transparent cursor-default" />
            </div>

            <div className="flex flex-col" style={{ width: "9rem" }}>
              <Label className="text-sm font-medium mb-1.5">Remun. Prevista</Label>
              <Input
                type="text"
                value={formatCurrency(totalExpectedRemuneration)}
                readOnly
                className={cn(
                  "h-10 text-center font-semibold bg-transparent cursor-default",
                  totalRemunerationDelta > 0 ? "text-green-600" : totalRemunerationDelta < 0 ? "text-red-600" : "",
                )}
                title={`Diferença: ${formatSignedCurrency(totalRemunerationDelta)}`}
              />
            </div>

            <div className="flex flex-col" style={{ width: "9rem" }}>
              <Label className="text-sm font-medium mb-1.5">Bônus Atual</Label>
              <Input type="text" value={formatCurrency(totalBonusAtual)} readOnly className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600" />
            </div>

            <div className="flex flex-col" style={{ width: "9rem" }}>
              <Label className="text-sm font-medium mb-1.5">Bônus Previsto</Label>
              <Input type="text" value={formatCurrency(totalBonusPrevisto)} readOnly className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600" />
            </div>
          </div>

          {/* Right side - Restaurar only (Filtros + column layout + export live in the table toolbar) */}
          {isTaskQuantityModified && (
            <div className="flex flex-col">
              <Label className="text-sm font-medium mb-1.5 opacity-0">Ações</Label>
              <div className="flex gap-2 h-10">
                <Button type="button" variant="outline" size="default" onClick={restoreCurrentPeriodTasks} className="h-10" title="Restaurar quantidade de tarefas do período atual">
                  <IconCalculator className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}
      </div>

      {/* Interactive table (search / sort / column layout / export from the DataTable toolbar) */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
        <DataTable<SimulatedUser>
          tableId="promotions-simulation"
          bare
          data={filteredUsers}
          columns={columns}
          getRowId={(u) => u.id}
          isLoading={isLoading}
          enableSelection={false}
          enablePagination={false}
          defaultSorting={[{ id: "name", desc: false }]}
          estimateRowHeight={52}
          searchPlaceholder="Buscar colaborador..."
          emptyMessage="Nenhum colaborador encontrado. Ajuste os filtros para ver os colaboradores."
          exportTitle="Simulação de Promoções"
          exportFilename="simulacao-promocoes"
          toolbarActions={
            <Button variant={hasActiveFilters ? "default" : "outline"} onClick={() => setShowFiltersModal(true)} className="gap-2">
              <IconFilter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-0 px-1.5">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          }
        />
      </div>

      {/* Filters Modal */}
      <PromotionsSimulationFilters open={showFiltersModal} onOpenChange={setShowFiltersModal} filters={filters} onApply={handleFiltersApply} onReset={handleFiltersReset} sectors={sectorsData?.data || []} />
    </Card>
  );
}
