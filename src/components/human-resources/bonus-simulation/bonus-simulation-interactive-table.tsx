import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  IconCurrencyDollar,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconX,
  IconBuilding,
  IconDownload,
  IconUserMinus
} from "@tabler/icons-react";
import { formatCurrency, getBonusPeriod, getCurrentPayrollPeriod } from "../../../utils";
import { useUsers, useSectors, useTasks } from "../../../hooks";
import { calculateBonusForPosition } from "../../../utils/bonus";
import { cn } from "@/lib/utils";
import { TASK_STATUS, COMMISSION_STATUS, USER_STATUS } from "../../../constants";
import { FilterIndicators, FilterIndicator } from "@/components/ui/filter-indicator";

// Position levels mapping
const POSITIONS = [
  "Junior I", "Junior II", "Junior III", "Junior IV",
  "Pleno I", "Pleno II", "Pleno III", "Pleno IV",
  "Senior I", "Senior II", "Senior III", "Senior IV"
];

// Performance level selector with chevron buttons
interface PerformanceLevelSelectorProps {
  value: number;
  onChange: (value: number) => void;
  userId: string;
  isModified?: boolean;
  disabled?: boolean;
  className?: string;
}

function PerformanceLevelSelector({
  value,
  onChange,
  userId,
  isModified,
  disabled,
  className,
}: PerformanceLevelSelectorProps) {
  const handleDecrease = () => {
    const newValue = Math.max(0, value - 1);
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleIncrease = () => {
    const newValue = Math.min(5, value + 1);
    if (newValue !== value) {
      onChange(newValue);
    }
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

interface SimulatedUser {
  id: string;
  name: string;
  email: string;
  originalPosition: string;
  originalPerformanceLevel: number;
  sectorId: string | null;
  sectorName: string | null;
  // Simulation fields
  position: string;
  performanceLevel: number;
  bonusAmount: number;
}

interface BonusSimulationInteractiveTableProps {
  className?: string;
}

export function BonusSimulationInteractiveTable({ className }: BonusSimulationInteractiveTableProps) {
  // State
  const [taskQuantity, setTaskQuantity] = useState<number>(0); // Will be set from current period
  const [originalTaskQuantity, setOriginalTaskQuantity] = useState<number>(0); // Store original for restore
  const [taskInput, setTaskInput] = useState<string>('0.0'); // String value for controlled input
  const [averageInput, setAverageInput] = useState<string>('0.0'); // String value for controlled input
  const [simulatedUsers, setSimulatedUsers] = useState<SimulatedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state - initialize with default sectors
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);

  // Get current bonus period for task counting
  // Get current payroll period (26th-25th cycle) - centralized utility
  // If today is Sept 26th or later, this returns October
  const { year: periodYear, month: periodMonth } = getCurrentPayrollPeriod();
  const currentPeriod = getBonusPeriod(periodYear, periodMonth);

  console.log('Current bonus period:', {
    startDate: currentPeriod.startDate.toLocaleDateString('pt-BR'),
    endDate: currentPeriod.endDate.toLocaleDateString('pt-BR'),
    startDateISO: currentPeriod.startDate.toISOString(),
    endDateISO: currentPeriod.endDate.toISOString()
  });

  // Fetch sectors for filtering (Sector model has no status field)
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100
  });

  // Get default sector IDs (production, warehouse, leader privileges)
  const defaultSectorIds = useMemo(() => {
    if (!sectorsData?.data) return [];

    return sectorsData.data
      .filter(sector =>
        sector.privilege === 'PRODUCTION' ||
        sector.privilege === 'WAREHOUSE' ||
        sector.privilege === 'LEADER'
      )
      .map(sector => sector.id);
  }, [sectorsData?.data]);

  // Set default sectors when they become available
  // Use a ref to track if we've initialized to avoid dependency issues
  const hasInitializedSectorsRef = React.useRef(false);

  useEffect(() => {
    if (!hasInitializedSectorsRef.current && defaultSectorIds.length > 0) {
      setSelectedSectorIds(defaultSectorIds);
      hasInitializedSectorsRef.current = true;
    }
  }, [defaultSectorIds]);

  // Fetch tasks for current period to get actual count
  // Ensure dates are set to exact times: 26th at 00:00:00.000 and 25th at 23:59:59.999
  const startDate = new Date(currentPeriod.startDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(currentPeriod.endDate);
  endDate.setHours(23, 59, 59, 999);

  const taskQuery = {
    where: {
      status: TASK_STATUS.COMPLETED, // Only count completed tasks
      finishedAt: {
        gte: startDate,
        lte: endDate
      },
      commission: {
        in: [COMMISSION_STATUS.FULL_COMMISSION, COMMISSION_STATUS.PARTIAL_COMMISSION]
      }
    },
    limit: 1000, // Maximum allowed by API
    enabled: true // Always enabled to get the count
  };

  console.log('Task query being sent:', taskQuery);

  const { data: currentPeriodTasks } = useTasks(taskQuery);

  // Fetch ALL CONTRACTED users for simulation
  // In simulation mode, user can include/exclude anyone, not just "eligible" users
  const { data: usersData } = useUsers({
    where: {
      status: USER_STATUS.CONTRACTED // Only CONTRACTED users (not experience periods)
    },
    include: {
      position: true,
      sector: true
    },
    orderBy: { name: "asc" },
    limit: 100
  });

  // Set default task quantity from current period when data is available
  useEffect(() => {
    if (currentPeriodTasks?.data && currentPeriodTasks.success) {
      // Calculate weighted task count: full commission = 1.0, partial commission = 0.5
      const weightedTaskCount = currentPeriodTasks.data.reduce((sum, task) => {
        if (task.commission === COMMISSION_STATUS.FULL_COMMISSION) {
          return sum + 1.0;
        } else if (task.commission === COMMISSION_STATUS.PARTIAL_COMMISSION) {
          return sum + 0.5;
        }
        return sum;
      }, 0);

      const fullCommissionCount = currentPeriodTasks.data.filter(
        t => t.commission === COMMISSION_STATUS.FULL_COMMISSION
      ).length;
      const partialCommissionCount = currentPeriodTasks.data.filter(
        t => t.commission === COMMISSION_STATUS.PARTIAL_COMMISSION
      ).length;

      console.log('Commission-eligible tasks from API:', {
        total: currentPeriodTasks.data.length,
        fullCommission: fullCommissionCount,
        partialCommission: partialCommissionCount,
        weightedCount: weightedTaskCount
      });

      console.log('First few tasks:', currentPeriodTasks.data.slice(0, 5).map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        commission: task.commission,
        finishedAt: task.finishedAt
      })));

      // Only set if taskQuantity is still 0 (initial state)
      if (taskQuantity === 0) {
        console.log('Setting initial weighted task quantity to:', weightedTaskCount);
        setTaskQuantity(weightedTaskCount);
        setOriginalTaskQuantity(weightedTaskCount);
        setTaskInput(weightedTaskCount.toFixed(1));
      }
    } else {
      console.log('No tasks data or failed request:', currentPeriodTasks);
    }
  }, [currentPeriodTasks]);

  // Initialize simulated users from fetched data
  useEffect(() => {
    if (usersData?.data && usersData.data.length > 0) {
      const users = usersData.data.map(user => {
        const initialPosition = user.position?.name || "Pleno I";
        const initialPerformanceLevel = user.performanceLevel || 3;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          originalPosition: initialPosition,
          originalPerformanceLevel: initialPerformanceLevel,
          sectorId: user.sector?.id || null,
          sectorName: user.sector?.name || null,
          position: initialPosition,
          performanceLevel: initialPerformanceLevel,
          bonusAmount: 0 // Will be calculated by effect
        };
      });
      setSimulatedUsers(users);
      setIsLoading(false);
    }
  }, [usersData]); // Removed taskQuantity dependency to prevent re-initialization

  // Apply filters to get visible users
  const filteredUsers = useMemo(() => {
    let filtered = simulatedUsers;

    // Apply sector filter
    if (selectedSectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && selectedSectorIds.includes(user.sectorId)
      );
    }

    // Apply exclusion filter
    if (excludedUserIds.length > 0) {
      filtered = filtered.filter(user =>
        !excludedUserIds.includes(user.id)
      );
    }

    return filtered;
  }, [simulatedUsers, selectedSectorIds, excludedUserIds]);

  // Calculate metrics
  // For simulation: ALL filtered users are considered "eligible"
  const eligibleUserCount = filteredUsers.length;

  // Average is calculated using eligible users (not included users)
  // This matches how the backend calculates: total tasks / total eligible users
  const averageTasksPerUser = useMemo(() => {
    if (eligibleUserCount === 0) return 0;
    return taskQuantity / eligibleUserCount;
  }, [taskQuantity, eligibleUserCount]);

  // Calculate total task quantity when using reverse calculation (for display only)
  const calculatedTaskQuantity = useMemo(() => {
    return taskQuantity;
  }, [taskQuantity]);

  const totalBonusAmount = useMemo(() =>
    filteredUsers.reduce((sum, user) => sum + user.bonusAmount, 0),
    [filteredUsers]
  );

  // Effect 1: Update average input when task quantity or eligible count changes
  // Don't overwrite if user is typing (check if current value matches calculated)
  useEffect(() => {
    console.log('[Effect 1] Running - taskQuantity:', taskQuantity, 'eligibleUserCount:', eligibleUserCount, 'averageInput:', averageInput);

    if (eligibleUserCount === 0) {
      console.log('[Effect 1] No eligible users, setting average to 0');
      if (averageInput !== '0.0') {
        setAverageInput('0.0');
      }
      return;
    }

    const newAverage = taskQuantity / eligibleUserCount;
    console.log('[Effect 1] Calculated average:', newAverage);

    // Only update if the current input value doesn't match (to avoid overwriting while typing)
    const currentParsed = parseFloat(averageInput);
    const difference = Math.abs(currentParsed - newAverage);

    // If difference is significant (more than 0.01), update the display
    if (isNaN(currentParsed) || difference > 0.01) {
      console.log('[Effect 1] Updating averageInput to:', newAverage.toFixed(1), 'difference:', difference);
      setAverageInput(newAverage.toFixed(1));
    } else {
      console.log('[Effect 1] Skipping update - current value matches (difference:', difference, ')');
    }
  }, [taskQuantity, eligibleUserCount, averageInput]);

  // Effect 2: Recalculate bonuses when average or filtered users change
  useEffect(() => {
    console.log('[Effect 2] Running - taskQuantity:', taskQuantity, 'filteredUsers.length:', filteredUsers.length, 'eligibleUserCount:', eligibleUserCount);

    if (filteredUsers.length === 0) {
      console.log('[Effect 2] No filtered users, skipping');
      return;
    }

    const currentAverage = eligibleUserCount > 0 ? taskQuantity / eligibleUserCount : 0;
    console.log('[Effect 2] Current average for bonus calculation:', currentAverage);

    // Only update bonuses if needed (avoid unnecessary recalculations)
    setSimulatedUsers(prev => {
      // Check if any updates are needed
      const needsUpdate = prev.some(user => {
        const expectedBonus = filteredUsers.find(f => f.id === user.id) ?
          calculateBonusForPosition(user.position, user.performanceLevel, currentAverage) :
          0;
        return Math.abs(user.bonusAmount - expectedBonus) > 0.01; // Allow small rounding differences
      });

      console.log('[Effect 2] needsUpdate:', needsUpdate);

      if (!needsUpdate) return prev;

      console.log('[Effect 2] Updating bonuses for all users');
      return prev.map(user => {
        const isFiltered = filteredUsers.find(f => f.id === user.id);
        if (!isFiltered) {
          return { ...user, bonusAmount: 0 };
        }
        const bonus = calculateBonusForPosition(user.position, user.performanceLevel, currentAverage);
        return { ...user, bonusAmount: bonus };
      });
    });
  }, [taskQuantity, filteredUsers, eligibleUserCount]);

  // Handlers
  const handleTaskQuantityChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    // Handle both event object and direct value
    const value = typeof e === 'string' ? e : e?.target?.value;

    if (value === undefined) {
      console.error('[Handler] No value received:', e);
      return;
    }

    console.log('[Handler] Task input changed to:', value);

    // Allow empty string, numbers, and decimal points while typing
    if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
      console.log('[Handler] Value passed regex validation');
      setTaskInput(value); // Update input string immediately for smooth typing

      // Only update taskQuantity if it's a valid number (not just a dot or empty)
      if (value !== '' && value !== '.') {
        const num = parseFloat(value);
        console.log('[Handler] Parsed number:', num);
        if (!isNaN(num) && num >= 0) {
          console.log('[Handler] Setting taskQuantity to:', num);
          setTaskQuantity(num);
        }
      } else if (value === '') {
        console.log('[Handler] Empty value, setting taskQuantity to 0');
        setTaskQuantity(0);
      }
    } else {
      console.log('[Handler] Value failed regex validation:', value);
    }
  };

  const handleAveragePerUserChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    // Handle both event object and direct value
    const value = typeof e === 'string' ? e : e?.target?.value;

    if (value === undefined) {
      console.error('[Handler] No value received:', e);
      return;
    }

    console.log('[Handler] Average input changed to:', value);

    // Allow empty string, numbers, and decimal points while typing
    if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
      console.log('[Handler] Average value passed regex validation');
      setAverageInput(value); // Update input string immediately for smooth typing

      // Only update taskQuantity if it's a valid number and we have eligible users
      if (value !== '' && value !== '.' && eligibleUserCount > 0) {
        const num = parseFloat(value);
        console.log('[Handler] Parsed average:', num, 'eligibleUserCount:', eligibleUserCount);
        if (!isNaN(num) && num >= 0) {
          // Update task quantity based on average (reverse calculation)
          // Formula: taskQuantity = average × eligible_users
          const newTaskQuantity = num * eligibleUserCount;
          console.log('[Handler] Calculated newTaskQuantity:', newTaskQuantity);
          setTaskQuantity(newTaskQuantity);
          setTaskInput(newTaskQuantity.toFixed(1)); // Format with 1 decimal
        }
      } else if (value === '') {
        console.log('[Handler] Empty average, setting taskQuantity to 0');
        setTaskQuantity(0);
        setTaskInput('0');
      }
    } else {
      console.log('[Handler] Average value failed regex validation:', value);
    }
  };

  const handleSectorFilterChange = (sectorIds: string[]) => {
    setSelectedSectorIds(sectorIds);
  };

  const handleUserExclusionChange = (userIds: string[]) => {
    setExcludedUserIds(userIds);
  };

  const handlePositionChange = (userId: string, newPosition: string) => {
    setSimulatedUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const bonus = calculateBonusForPosition(newPosition, user.performanceLevel, averageTasksPerUser);
        return { ...user, position: newPosition, bonusAmount: bonus };
      }
      return user;
    }));
  };

  const handlePerformanceLevelChange = (userId: string, newLevel: number) => {
    setSimulatedUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const bonus = calculateBonusForPosition(user.position, newLevel, averageTasksPerUser);
        return { ...user, performanceLevel: newLevel, bonusAmount: bonus };
      }
      return user;
    }));
  };

  const hasActiveFilters = selectedSectorIds.length > 0 || excludedUserIds.length > 0;

  const clearAllFilters = () => {
    setSelectedSectorIds([]);
    setExcludedUserIds([]);
  };

  // Create filter badges for display (like items table)
  const activeFilters = useMemo(() => {
    const filters: Array<{
      key: string;
      label: string;
      value: string;
      onRemove: () => void;
      icon?: React.ReactNode;
    }> = [];

    // Add sector filters
    if (selectedSectorIds.length > 0) {
      const sectorNames = selectedSectorIds
        .map(id => sectorsData?.data?.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      filters.push({
        key: "sectors",
        label: "Setores",
        value: sectorNames,
        onRemove: () => setSelectedSectorIds([]),
        icon: <IconBuilding className="h-3 w-3" />
      });
    }

    // Add excluded users filters
    if (excludedUserIds.length > 0) {
      const userNames = excludedUserIds
        .map(id => simulatedUsers.find(u => u.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      filters.push({
        key: "excludedUsers",
        label: "Usuários Excluídos",
        value: userNames,
        onRemove: () => setExcludedUserIds([]),
        icon: <IconUserMinus className="h-3 w-3" />
      });
    }

    return filters;
  }, [selectedSectorIds, excludedUserIds, sectorsData?.data, simulatedUsers]);

  const restoreCurrentPeriodTasks = () => {
    setTaskQuantity(originalTaskQuantity);
    setTaskInput(originalTaskQuantity.toFixed(1));
    setAverageInput((originalTaskQuantity / eligibleUserCount).toFixed(1));
  };

  const handleExportToExcel = () => {
    // Prepare data for export
    const exportData = filteredUsers.map((user) => ({
      Nome: user.name,
      Setor: user.sectorName || '-',
      Cargo: user.position,
      'Nível de Performance': user.performanceLevel,
      'Bônus': user.bonusAmount.toFixed(2)
    }));

    // Add summary row
    exportData.push({
      Nome: 'TOTAL',
      Setor: '',
      Cargo: '',
      'Nível de Performance': '',
      'Bônus': totalBonusAmount.toFixed(2)
    });

    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape values containing commas or quotes
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    // Add BOM for proper Excel encoding (UTF-8)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `simulacao-bonus-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isTaskQuantityModified = taskQuantity !== originalTaskQuantity && originalTaskQuantity > 0;

  // Debug logging - render state
  console.log('[Render] Current state:', {
    taskQuantity,
    taskInput,
    averageInput,
    eligibleUserCount,
    filteredUsersLength: filteredUsers.length,
    isTaskQuantityModified,
    originalTaskQuantity
  });

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      {/* Header with Task Input and Summary */}
      <div className="p-4 border-b space-y-3">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Sector Filter */}
          <div className="flex flex-col flex-[2]">
            <Label className="text-sm font-medium mb-1.5">
              Filtrar Setores
            </Label>
            <Combobox
              mode="multiple"
              value={selectedSectorIds}
              onValueChange={handleSectorFilterChange}
              options={sectorsData?.data?.map(sector => ({
                value: sector.id,
                label: sector.name
              })) || []}
              placeholder="Todos os setores"
              emptyText="Nenhum setor encontrado"
              className="w-full h-10"
            />
          </div>

          {/* User Exclusion Filter */}
          <div className="flex flex-col flex-[2]">
            <Label className="text-sm font-medium mb-1.5">
              Excluir Usuários
            </Label>
            <Combobox
              mode="multiple"
              value={excludedUserIds}
              onValueChange={handleUserExclusionChange}
              options={simulatedUsers.map(user => ({
                value: user.id,
                label: user.name
              }))}
              placeholder="Nenhuma exclusão"
              emptyText="Nenhum usuário encontrado"
              className="w-full h-10"
            />
          </div>

          {/* Task Quantity Input */}
          <div className="flex flex-col" style={{ width: '120px' }}>
            <Label htmlFor="taskQuantity" className="text-sm font-medium mb-1.5">
              Tarefas
            </Label>
            <Input
              id="taskQuantity"
              type="text"
              inputMode="decimal"
              value={taskInput}
              onChange={handleTaskQuantityChange}
              className="h-10 text-center font-semibold bg-transparent"
              placeholder="0.0"
            />
          </div>

          {/* Eligible Users Count - All filtered/selected users */}
          <div className="flex flex-col" style={{ width: '120px' }}>
            <Label className="text-sm font-medium mb-1.5">
              Colaboradores
            </Label>
            <Input
              type="text"
              value={eligibleUserCount}
              readOnly
              className="h-10 text-center font-semibold bg-transparent cursor-default"
              title={`${eligibleUserCount} usuários elegíveis para cálculo (todos os filtrados/selecionados)`}
            />
          </div>

          {/* Average Tasks per User - Editable for Reverse Calculation */}
          <div className="flex flex-col" style={{ width: '120px' }}>
            <Label htmlFor="averagePerUser" className="text-sm font-medium mb-1.5">
              Média
            </Label>
            <Input
              id="averagePerUser"
              type="text"
              inputMode="decimal"
              value={averageInput}
              onChange={handleAveragePerUserChange}
              className="h-10 text-center font-semibold bg-transparent"
              placeholder="0.0"
              title="Digite a média desejada por usuário para calcular tarefas totais"
            />
          </div>

          {/* Total Bonus */}
          <div className="flex flex-col" style={{ width: '160px' }}>
            <Label className="text-sm font-medium mb-1.5">
              Total
            </Label>
            <Input
              type="text"
              value={formatCurrency(totalBonusAmount)}
              readOnly
              className="h-10 text-center font-semibold bg-transparent cursor-default text-green-600"
            />
          </div>

          {/* Action Buttons - Aligned with inputs */}
          <div className="flex flex-col flex-1">
            <Label className="text-sm font-medium mb-1.5 opacity-0">
              Ações
            </Label>
            <div className="flex gap-2 h-10">
              {isTaskQuantityModified && (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={restoreCurrentPeriodTasks}
                  className="h-10"
                  title="Restaurar quantidade de tarefas do período atual"
                >
                  <IconCalculator className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleExportToExcel}
                disabled={filteredUsers.length === 0}
                className="h-10"
                title="Exportar simulação para CSV"
              >
                <IconDownload className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters}
            onClearAll={clearAllFilters}
            className="px-1 py-1"
          />
        )}

        {/* Current Period Info - Only show when there's actual data and task quantity is not modified */}
        {!isTaskQuantityModified && currentPeriodTasks?.success && currentPeriodTasks.data && currentPeriodTasks.data.length > 0 && (() => {
          const fullCommissionCount = currentPeriodTasks.data.filter(
            t => t.commission === COMMISSION_STATUS.FULL_COMMISSION
          ).length;
          const partialCommissionCount = currentPeriodTasks.data.filter(
            t => t.commission === COMMISSION_STATUS.PARTIAL_COMMISSION
          ).length;
          const weightedCount = fullCommissionCount + (partialCommissionCount * 0.5);

          return (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <IconCalculator className="h-4 w-4" />
                <span className="font-medium">
                  Período atual ({currentPeriod.startDate.toLocaleDateString('pt-BR')} a {currentPeriod.endDate.toLocaleDateString('pt-BR')}):
                </span>
                <Badge variant="outline" className="bg-blue-100">
                  {weightedCount.toFixed(1)} tarefas ponderadas
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({fullCommissionCount} integral{fullCommissionCount !== 1 ? '' : ''} + {partialCommissionCount} parcial{partialCommissionCount !== 1 ? '' : ''})
                </span>
              </div>
            </div>
          );
        })()}
      </div>


      {/* Interactive Table with padding */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full flex flex-col overflow-hidden rounded-lg border border-border">
          {isLoading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : simulatedUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum usuário elegível encontrado
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <IconFilter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">Nenhum usuário encontrado</p>
              <p className="text-sm">Ajuste os filtros para ver os usuários elegíveis.</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Fixed Header Table */}
              <div className="border-b border-border overflow-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader className="[&_tr]:border-b-0">
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="font-bold uppercase text-xs">Nome</TableHead>
                      <TableHead className="w-48 font-bold uppercase text-xs">Setor</TableHead>
                      <TableHead className="w-48 font-bold uppercase text-xs">Cargo</TableHead>
                      <TableHead className="w-44 text-center font-bold uppercase text-xs">Nível Performance</TableHead>
                      <TableHead className="w-36 text-right font-bold uppercase text-xs">Bônus</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

            {/* Scrollable Body Table */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table className="w-full table-fixed">
                <TableBody>
                  {filteredUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "transition-colors border-b border-border h-10",
                        index % 2 === 1 && "bg-muted/10",
                        "hover:bg-muted/20"
                      )}
                    >
                      <TableCell className="font-medium py-2">
                        {user.name}
                      </TableCell>
                      <TableCell className="w-48 py-2">
                        {user.sectorName || '-'}
                      </TableCell>
                      <TableCell className="w-48 py-2">
                        <Combobox
                          mode="single"
                          value={user.position}
                          onValueChange={(value) => {
                            if (value && typeof value === 'string') {
                              handlePositionChange(user.id, value);
                            }
                          }}
                          options={POSITIONS.map(pos => ({
                            value: pos,
                            label: pos
                          }))}
                          placeholder={user.position || "Selecione o cargo"}
                          emptyText="Nenhum cargo encontrado"
                          className="w-full"
                          renderValue={() => user.position || "Selecione o cargo"}
                        />
                      </TableCell>
                      <TableCell className="w-44 py-2">
                        <div className="flex items-center justify-center">
                          <PerformanceLevelSelector
                            value={user.performanceLevel}
                            onChange={(newLevel) => handlePerformanceLevelChange(user.id, newLevel)}
                            userId={user.id}
                            isModified={user.performanceLevel !== user.originalPerformanceLevel}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="w-36 text-right py-2">
                        <span className={cn(
                          "font-bold",
                          user.bonusAmount > 0 ? 'text-green-600' : 'text-muted-foreground'
                        )}>
                          {formatCurrency(user.bonusAmount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
          )}
        </div>
      </div>
    </Card>
  );
}